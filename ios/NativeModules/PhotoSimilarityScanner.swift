//
// 捨てショ - Photo Similarity Scanner (Swift)
// Photos + Vision FeaturePrint で類似写真を検出
//

import Foundation
import Photos
import Vision
import React

// MARK: - Module

@objc(PhotoSimilarityScanner)
class PhotoSimilarityScanner: RCTEventEmitter {

  private var scanQueue: OperationQueue!
  private var isPaused = false
  private var shouldCancel = false
  private var allAssets: [PHAsset] = []
  private var timeClusters: [[PHAsset]] = []
  private var foundGroups: [[String: Any]] = []
  private var scanProgress: [String: Any] = [:]
  private var featurePrintCache: [String: VNFeaturePrintObservation] = [:]
  private let cacheLock = NSLock()
  private var cacheURL: URL?
  private var progressFileURL: URL?
  private var foundGroupsFileURL: URL?
  private var thumbDir: URL?
  private let thresholdLock = NSLock()
  private var currentThreshold: Double = 0.32
  private var thermalObserver: NSObjectProtocol?
  /// スキャン実行を直列化し、二重 runScan によるクラッシュを防止
  private let scanExecutionQueue = DispatchQueue(label: "sutesho.scan.execution")

  override init() {
    super.init()
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = min(max(ProcessInfo.processInfo.processorCount - 1, 2), 4)
    queue.qualityOfService = .userInitiated
    self.scanQueue = queue
    if let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
      self.cacheURL = cacheDir.appendingPathComponent("sutesho_featureprint_cache.dat")
      self.progressFileURL = cacheDir.appendingPathComponent("sutesho_scan_progress.json")
      self.foundGroupsFileURL = cacheDir.appendingPathComponent("sutesho_found_groups.json")
      let thumbDirURL = cacheDir.appendingPathComponent("sutesho_thumbs")
      try? FileManager.default.createDirectory(at: thumbDirURL, withIntermediateDirectories: true)
      self.thumbDir = thumbDirURL
    }
    startThermalMonitoring()
  }

  deinit {
    if let obs = thermalObserver {
      NotificationCenter.default.removeObserver(obs)
    }
  }

  private func startThermalMonitoring() {
    thermalObserver = NotificationCenter.default.addObserver(
      forName: ProcessInfo.thermalStateDidChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.handleThermalStateChange()
    }
    handleThermalStateChange()
  }

  private func thermalStateString() -> String {
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "nominal"
    }
  }

  private func handleThermalStateChange() {
    let level = thermalStateString()
    sendEvent(name: "onThermalWarning", body: ["level": level])

    switch ProcessInfo.processInfo.thermalState {
    case .serious:
      scanQueue.maxConcurrentOperationCount = 2
    case .critical:
      scanQueue.isSuspended = true
      isPaused = true
      sendEvent(name: "onScanPaused", body: nil)
      if !scanProgress.isEmpty, let cur = scanProgress["current"] as? Int, let tot = scanProgress["total"] as? Int {
        saveProgressFile(current: cur, total: tot, phase: "grouping")
      }
    default:
      scanQueue.maxConcurrentOperationCount = min(max(ProcessInfo.processInfo.processorCount - 1, 2), 4)
      if !shouldCancel { scanQueue.isSuspended = false }
    }
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  @objc override static func moduleName() -> String! { "PhotoSimilarityScanner" }

  override func supportedEvents() -> [String]! {
    ["onProgressUpdate", "onGroupFound", "onScanPaused", "onScanCompleted", "onThermalWarning"]
  }

  // RCTEventEmitter は bridge が nil のとき送信をスキップするため、送信可能かチェック
  override func startObserving() {}
  override func stopObserving() {}

  private func sendEvent(name: String, body: Any?) {
    guard bridge != nil else { return }
    sendEvent(withName: name, body: body)
  }

  // MARK: - Permission

  @objc func requestPhotoPermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
      let result: String
      switch status {
      case .authorized: result = "authorized"
      case .limited: result = "limited"
      case .denied: result = "denied"
      case .restricted: result = "denied"
      case .notDetermined: result = "denied"
      @unknown default: result = "denied"
      }
      resolve(result)
    }
  }

  // MARK: - Scan

  @objc func startScan(_ threshold: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // 前回の runScan がまだ動いていれば抜けるようにする（「ここまで」未押しで再スキャンした場合のクラッシュ防止）
    shouldCancel = true

    scanExecutionQueue.async { [weak self] in
      guard let self = self else { return }
      self.thresholdLock.lock()
      self.currentThreshold = threshold
      self.thresholdLock.unlock()
      self.isPaused = false
      self.shouldCancel = false
      self.foundGroups = []
      self.deleteProgressFile()
      self.deleteFoundGroupsFile()
      self.loadCache()
      do {
        try self.runScan()
        DispatchQueue.main.async { resolve(NSNull()) }
      } catch {
        DispatchQueue.main.async { reject("SCAN_ERROR", error.localizedDescription, error) }
      }
    }
  }

  @objc func pauseScan(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isPaused = true
    shouldCancel = true
    scanQueue.cancelAllOperations()
    scanQueue.isSuspended = true
    if !scanProgress.isEmpty, let cur = scanProgress["current"] as? Int, let tot = scanProgress["total"] as? Int {
      saveProgressFile(current: cur, total: tot, phase: "grouping")
    }
    saveFoundGroupsFile()
    sendEvent(name: "onScanPaused", body: scanProgress.isEmpty ? nil : scanProgress)
    resolve(NSNull())
  }

  @objc func resumeScan(_ threshold: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    shouldCancel = true

    scanExecutionQueue.async { [weak self] in
      guard let self = self else { return }
      self.thresholdLock.lock()
      self.currentThreshold = threshold
      self.thresholdLock.unlock()
      self.isPaused = false
      self.shouldCancel = false
      self.scanQueue.isSuspended = false
      self.loadCache()

      if let (resumeFrom, _) = self.loadProgressFromFile() {
        if let saved = self.loadFoundGroupsFile() {
          self.foundGroups = saved
        }
        DispatchQueue.main.async { resolve(NSNull()) }
        do {
          try self.runScan(resumeFrom: resumeFrom)
          self.saveProgressFile(current: 0, total: 0, phase: "idle")
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
          self.saveCache()
        } catch {
          self.sendEvent(name: "onScanCompleted", body: ["totalGroups": self.foundGroups.count])
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
        }
      } else {
        self.foundGroups = []
        DispatchQueue.main.async { resolve(NSNull()) }
        do {
          try self.runScan()
          self.saveProgressFile(current: 0, total: 0, phase: "idle")
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
          self.saveCache()
        } catch {
          self.sendEvent(name: "onScanCompleted", body: ["totalGroups": self.foundGroups.count])
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
        }
      }
    }
  }

  private func runScan(resumeFrom: Int? = nil) throws {
    let options = PHFetchOptions()
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
    options.includeAllBurstAssets = true
    let fetchResult = PHAsset.fetchAssets(with: .image, options: options)
    var assets: [PHAsset] = []
    fetchResult.enumerateObjects { asset, _, _ in assets.append(asset) }
    allAssets = assets
    let total = assets.count

    let resumePoint = resumeFrom ?? 0
    if resumePoint == 0 {
      sendProgress(percent: 0, current: 0, total: total, phase: "counting", phaseLabel: "全 \(total) 枚をスキャンします")
      Thread.sleep(forTimeInterval: 1.0)
    }

    let clusters = clusterByTime(assets)
    timeClusters = clusters
    if resumePoint == 0 {
      sendProgress(percent: 0, current: 0, total: total, phase: "clustering", phaseLabel: "時刻でグルーピング中...")
    } else if resumePoint > 0 && total > 0 {
      let pct = total > 0 ? (resumePoint * 100 / total) : 0
      sendProgress(percent: Double(pct), current: resumePoint, total: total, phase: "grouping", phaseLabel: "再開中...")
    }

    var processed = 0
    var lastSentPercent = -1  // 送信済みの整数パーセント（重複送信を防ぐ）

    for cluster in clusters {
      if shouldCancel { break }
      while isPaused { Thread.sleep(forTimeInterval: 0.2) }

      if resumePoint > 0 && processed + cluster.count <= resumePoint {
        processed += cluster.count
        continue
      }

      if cluster.count < 2 {
        processed += cluster.count
        continue
      }

      let groups = findSimilarGroups(in: cluster, threshold: currentThreshold)
      for group in groups {
        if group.count >= 2 {
          let groupDict = makeGroupDict(assets: group, threshold: currentThreshold)
          foundGroups.append(groupDict)
          sendEvent(name: "onGroupFound", body: groupDict)
        }
      }
      processed += cluster.count
      // 全体のパーセント = 処理済み枚数 / 全枚数 × 100（1枚ごとではなく全写真に対する進捗）
      let pctDouble = total > 0 ? min(100.0, Double(processed) * 100.0 / Double(total)) : 100.0
      let pctInt = Int(pctDouble)
      if pctInt > lastSentPercent || processed >= total {
        sendProgress(percent: pctDouble, current: processed, total: total, phase: "grouping", phaseLabel: "類似判定中...")
        lastSentPercent = pctInt
      }
      saveProgressFile(current: processed, total: total, phase: "grouping")
    }

    // 一時停止で抜けた場合は完了送信をしない（pauseScan が onScanPaused で正しい current/total を送る）
    if shouldCancel { return }

    sendProgress(percent: 100.0, current: total, total: total, phase: "grouping", phaseLabel: "完了")
    sendEvent(name: "onScanCompleted", body: ["totalGroups": foundGroups.count])
    deleteProgressFile()
    deleteFoundGroupsFile()
    saveCache()
  }

  private func clusterByTime(_ assets: [PHAsset]) -> [[PHAsset]] {
    guard !assets.isEmpty else { return [] }
    let calendar = Calendar.current
    var clusters: [[PHAsset]] = []
    var currentCluster: [PHAsset] = []
    var currentStart: Date?

    for asset in assets {
      guard let date = asset.creationDate else { currentCluster.append(asset); continue }
      // 別の日なら現在クラスタを確定し、新しいクラスタを開始
      if let start = currentStart, !calendar.isDate(date, inSameDayAs: start) {
        if currentCluster.count >= 2 { clusters.append(currentCluster) }
        currentCluster = [asset]
        currentStart = date
        continue
      }
      // 同じ日で 5 分以上離れていれば新しい 5 分バケット
      if let start = currentStart, date.timeIntervalSince(start) > 5 * 60 {
        if currentCluster.count >= 2 { clusters.append(currentCluster) }
        currentCluster = [asset]
        currentStart = date
      } else {
        if currentStart == nil { currentStart = date }
        currentCluster.append(asset)
      }
    }
    if currentCluster.count >= 2 { clusters.append(currentCluster) }
    return clusters
  }

  private func findSimilarGroups(in assets: [PHAsset], threshold: Double) -> [[PHAsset]] {
    var prints: [String: VNFeaturePrintObservation] = [:]
    for asset in assets {
      if shouldCancel { break }
      if let fp = getFeaturePrint(for: asset) { prints[asset.localIdentifier] = fp }
    }
    var uf = UnionFind(count: assets.count)
    let ids = assets.map { $0.localIdentifier }
    for i in 0..<assets.count {
      for j in (i+1)..<assets.count {
        guard let pi = prints[ids[i]], let pj = prints[ids[j]] else { continue }
        var distance: Float = 1.0
        try? pi.computeDistance(&distance, to: pj)
        if Float(threshold) > distance {
          uf.union(i, j)
        }
      }
    }
    var groups: [[PHAsset]] = []
    var seen = Set<Int>()
    for i in 0..<assets.count {
      let root = uf.find(i)
      if seen.contains(root) { continue }
      seen.insert(root)
      var group: [PHAsset] = []
      for j in 0..<assets.count where uf.find(j) == root { group.append(assets[j]) }
      if group.count >= 2 { groups.append(group) }
    }
    return groups
  }

  private func getFeaturePrint(for asset: PHAsset) -> VNFeaturePrintObservation? {
    cacheLock.lock()
    if let cached = featurePrintCache[asset.localIdentifier] {
      cacheLock.unlock()
      return cached
    }
    cacheLock.unlock()

    let options = PHImageRequestOptions()
    options.deliveryMode = .fastFormat
    options.isNetworkAccessAllowed = true
    options.isSynchronous = true
    options.resizeMode = .fast
    var result: VNFeaturePrintObservation?
    let targetSize = CGSize(width: 300, height: 300)

    PHImageManager.default().requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: options) { image, _ in
      guard let cgImage = image?.cgImage else { return }
      let request = VNGenerateImageFeaturePrintRequest()
      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try? handler.perform([request])
      if let obs = request.results?.first as? VNFeaturePrintObservation {
        result = obs
      }
    }

    if let obs = result {
      cacheLock.lock()
      featurePrintCache[asset.localIdentifier] = obs
      cacheLock.unlock()
    }
    return result
  }

  private func makeGroupDict(assets: [PHAsset], threshold: Double) -> [String: Any] {
    var assetDicts: [[String: Any]] = []
    for a in assets {
      assetDicts.append([
        "id": a.localIdentifier,
        "uri": "ph://\(a.localIdentifier)",
        "creationDate": (a.creationDate ?? Date()).ISO8601Format(),
        "fileSize": NSNumber(value: getResourceFileSize(a)),
        "width": a.pixelWidth,
        "height": a.pixelHeight,
      ])
    }
    return [
      "id": UUID().uuidString,
      "assets": assetDicts,
      "keepAssetIds": [] as [String],
      "maxSimilarity": 1.0 - threshold,
    ]
  }

  /// PHAssetResource 経由で実ファイルサイズを取得（取得不可なら推定値）
  private func getResourceFileSize(_ asset: PHAsset) -> Int64 {
    let resources = PHAssetResource.assetResources(for: asset)
    if let resource = resources.first,
       let size = (resource.value(forKey: "fileSize") as? NSNumber)?.int64Value,
       size > 0 {
      return size
    }
    // フォールバック: JPEG 圧縮を考慮した推定値
    return Int64(asset.pixelWidth) * Int64(asset.pixelHeight) / 3
  }

  private func sendProgress(percent: Double, current: Int, total: Int, phase: String, phaseLabel: String) {
    scanProgress = [
      "percent": percent,
      "current": current,
      "total": total,
      "phase": phase,
      "phaseLabel": phaseLabel,
    ]
    sendEvent(name: "onProgressUpdate", body: scanProgress)
  }

  // MARK: - Progress / Groups

  @objc func getScanProgress(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(scanProgress.isEmpty ? NSNull() : scanProgress)
  }

  @objc func getFoundGroups(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(foundGroups)
  }

  @objc func regroupWithThreshold(_ threshold: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    thresholdLock.lock()
    currentThreshold = threshold
    thresholdLock.unlock()
    var newGroups: [[String: Any]] = []
    for cluster in timeClusters where cluster.count >= 2 {
      let groups = findSimilarGroups(in: cluster, threshold: threshold)
      for group in groups where group.count >= 2 {
        newGroups.append(makeGroupDict(assets: group, threshold: threshold))
      }
    }
    foundGroups = newGroups
    resolve(newGroups)
  }

  // MARK: - Delete

  @objc func deleteAssets(_ assetIds: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard !assetIds.isEmpty else {
      resolve(["deletedCount": 0, "freedBytes": 0, "success": true] as [String: Any])
      return
    }
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
    var totalBytes: Int64 = 0
    var toDelete: [PHAsset] = []
    fetchResult.enumerateObjects { [weak self] asset, _, _ in
      toDelete.append(asset)
      totalBytes += self?.getResourceFileSize(asset) ?? 0
    }
    PHPhotoLibrary.shared().performChanges({
      PHAssetChangeRequest.deleteAssets(toDelete as NSArray)
    }) { ok, error in
      if ok {
        resolve([
          "deletedCount": toDelete.count,
          "freedBytes": NSNumber(value: totalBytes),
          "success": true,
        ] as [String: Any])
      } else {
        resolve([
          "deletedCount": 0,
          "freedBytes": 0,
          "success": false,
          "error": error?.localizedDescription ?? "unknown",
        ] as [String: Any])
      }
    }
  }

  // MARK: - Thumbnail / Preview Image

  /// 指定サイズで画像を取得し、file:// URL を返す（サムネイル一覧用）
  @objc func getThumbnailURL(_ assetId: String, width: NSNumber, height: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    exportImageToFile(assetId: assetId, targetWidth: width.intValue, targetHeight: height.intValue, prefix: "t", quality: 0.9) { url in
      resolve(url ?? NSNull())
    }
  }

  /// 複数アセットのサムネイルを取得（同時実行数を制限してPHImageManagerの過負荷を防ぐ）
  @objc func getThumbnailURLs(_ assetIds: [String], width: NSNumber, height: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let w = width.intValue
    let h = height.intValue
    let lock = NSLock()
    var result: [String: String] = [:]

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { return }
      let semaphore = DispatchSemaphore(value: 6) // 同時実行数（スワイプ一覧の読み込みを速くする）
      let group = DispatchGroup()

      for assetId in assetIds {
        group.enter()
        semaphore.wait()
        self.exportImageToFile(assetId: assetId, targetWidth: w, targetHeight: h, prefix: "t", quality: 0.85) { url in
          lock.lock()
          if let u = url { result[assetId] = u }
          lock.unlock()
          semaphore.signal()
          group.leave()
        }
      }

      group.notify(queue: .main) {
        resolve(result)
      }
    }
  }

  /// スワイププレビュー用 1500x1500 の実画像 file:// URL
  @objc func getPreviewImage(_ assetId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    exportImageToFile(assetId: assetId, targetWidth: 1500, targetHeight: 1500, prefix: "p", quality: 0.85) { url in
      resolve(url ?? NSNull())
    }
  }

  private func exportImageToFile(assetId: String, targetWidth: Int, targetHeight: Int, prefix: String, quality: CGFloat, completion: @escaping (String?) -> Void) {
    guard let dir = thumbDir else {
      completion(nil)
      return
    }

    let safeId = assetId.replacingOccurrences(of: "/", with: "_")
    let fileURL = dir.appendingPathComponent("\(prefix)_\(safeId)_\(targetWidth)x\(targetHeight).jpg")

    if FileManager.default.fileExists(atPath: fileURL.path) {
      completion(fileURL.absoluteString)
      return
    }

    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetchResult.firstObject else {
      print("[SuteSha] thumb: asset not found id=\(assetId.prefix(40))...")
      completion(nil)
      return
    }

    let targetSize = CGSize(width: targetWidth, height: targetHeight)

    // Use async callback with semaphore instead of isSynchronous to avoid
    // silent failures with iCloud photos on background threads
    DispatchQueue.global(qos: .userInitiated).async {
      let sem = DispatchSemaphore(value: 0)
      var resultURL: String?

      // 1st attempt: highQualityFormat (iCloud download allowed). degraded も受け入れる
      let options = PHImageRequestOptions()
      options.deliveryMode = .highQualityFormat
      options.isNetworkAccessAllowed = true
      options.isSynchronous = false
      options.resizeMode = .fast
      options.version = .current

      var requestId: PHImageRequestID = PHInvalidImageRequestID
      requestId = PHImageManager.default().requestImage(
        for: asset,
        targetSize: targetSize,
        contentMode: .aspectFill,
        options: options
      ) { image, info in
        defer { sem.signal() }
        guard let image = image,
              let data = image.jpegData(compressionQuality: quality) else { return }
        do {
          try data.write(to: fileURL, options: .atomic)
          resultURL = fileURL.absoluteString
        } catch {
          print("[SuteSha] thumb write error: \(error)")
        }
      }

      // Timeout after 15 seconds to avoid hanging forever on iCloud downloads
      let waitResult = sem.wait(timeout: .now() + 15.0)
      if waitResult == .timedOut {
        PHImageManager.default().cancelImageRequest(requestId)
      }

      // 2nd attempt: fastFormat + network (iCloud でプレースホルダだけでも取得)
      if resultURL == nil {
        let sem2 = DispatchSemaphore(value: 0)
        let retryOptions = PHImageRequestOptions()
        retryOptions.deliveryMode = .fastFormat
        retryOptions.isNetworkAccessAllowed = true
        retryOptions.isSynchronous = false
        retryOptions.resizeMode = .fast
        retryOptions.version = .current

        var retryRequestId2: PHImageRequestID = PHInvalidImageRequestID
        retryRequestId2 = PHImageManager.default().requestImage(
          for: asset,
          targetSize: targetSize,
          contentMode: .aspectFill,
          options: retryOptions
        ) { image, info in
          guard let image = image,
                let data = image.jpegData(compressionQuality: quality) else {
            let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            if !isDegraded { sem2.signal() }
            return
          }
          do {
            try data.write(to: fileURL, options: .atomic)
            resultURL = fileURL.absoluteString
          } catch {}
          sem2.signal()
        }
        _ = sem2.wait(timeout: .now() + 8.0)
        if resultURL == nil {
          PHImageManager.default().cancelImageRequest(retryRequestId2)
        }
      }

      // 3rd attempt: local-only fastFormat
      if resultURL == nil {
        let sem3 = DispatchSemaphore(value: 0)
        let localOptions = PHImageRequestOptions()
        localOptions.deliveryMode = .fastFormat
        localOptions.isNetworkAccessAllowed = false
        localOptions.isSynchronous = false
        localOptions.resizeMode = .fast
        localOptions.version = .current

        var retryRequestId3: PHImageRequestID = PHInvalidImageRequestID
        retryRequestId3 = PHImageManager.default().requestImage(
          for: asset,
          targetSize: targetSize,
          contentMode: .aspectFill,
          options: localOptions
        ) { image, info in
          guard let image = image,
                let data = image.jpegData(compressionQuality: quality) else {
            let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            if !isDegraded { sem3.signal() }
            return
          }
          do {
            try data.write(to: fileURL, options: .atomic)
            resultURL = fileURL.absoluteString
          } catch {}
          sem3.signal()
        }

        let waitResult3 = sem3.wait(timeout: .now() + 5.0)
        if waitResult3 == .timedOut {
          PHImageManager.default().cancelImageRequest(retryRequestId3)
        }
      }

      if resultURL == nil {
        print("[SuteSha] thumb: failed after retry id=\(assetId.prefix(40))...")
      }
      completion(resultURL)
    }
  }

  // MARK: - All Photos (Swipe Mode)

  @objc func getAllPhotos(_ offset: Int, limit: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { return }
      let options = PHFetchOptions()
      options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
      options.includeAllBurstAssets = true
      let fetchResult = PHAsset.fetchAssets(with: .image, options: options)
      let total = fetchResult.count
      let start = min(offset, total)
      let end = min(start + limit, total)
      var assets: [[String: Any]] = []
      for i in start..<end {
        let a = fetchResult.object(at: i)
        assets.append([
          "id": a.localIdentifier,
          "uri": "ph://\(a.localIdentifier)",
          "creationDate": (a.creationDate ?? Date()).ISO8601Format(),
          "fileSize": NSNumber(value: self.getResourceFileSize(a)),
          "width": a.pixelWidth,
          "height": a.pixelHeight,
        ])
      }
      DispatchQueue.main.async {
        resolve(["assets": assets, "total": total])
      }
    }
  }

  // MARK: - Partial / Cache / Count

  @objc func hasPartialScan(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // 進捗ファイルまたは保存済みグループが存在するかチェック
    if loadProgressFromFile() != nil {
      resolve(true)
      return
    }
    // スキャン完了後に保存されたグループがあればそちらも partial 扱い
    if let saved = loadFoundGroupsFile(), !saved.isEmpty {
      resolve(true)
      return
    }
    resolve(false)
  }

  @objc func saveCurrentState(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    saveFoundGroupsFile()
    // 進捗ファイルも保存（完了状態なら total == total で保存）
    if !scanProgress.isEmpty, let cur = scanProgress["current"] as? Int, let tot = scanProgress["total"] as? Int {
      saveProgressFile(current: cur, total: tot, phase: "grouping")
    }
    resolve(NSNull())
  }

  @objc func clearCache(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    cacheLock.lock()
    featurePrintCache.removeAll()
    cacheLock.unlock()
    if let url = cacheURL { try? FileManager.default.removeItem(at: url) }
    if let dir = thumbDir { try? FileManager.default.removeItem(at: dir) }
    deleteProgressFile()
    deleteFoundGroupsFile()
    resolve(NSNull())
  }

  @objc func getTotalPhotoCount(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let result = PHAsset.fetchAssets(with: .image, options: nil).count
    resolve(result)
  }

  // MARK: - Persistence

  private func saveProgressFile(current: Int, total: Int, phase: String) {
    guard let url = progressFileURL else { return }
    let dict: [String: Any] = ["current": current, "total": total, "phase": phase]
    guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
    try? data.write(to: url)
  }

  private func loadProgressFromFile() -> (current: Int, total: Int)? {
    guard let url = progressFileURL,
          (try? url.checkResourceIsReachable()) == true,
          let data = try? Data(contentsOf: url),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let current = json["current"] as? Int,
          let total = json["total"] as? Int,
          let phase = json["phase"] as? String,
          phase != "idle",
          current > 0
    else { return nil }
    return (current, total)
  }

  private func deleteProgressFile() {
    guard let url = progressFileURL else { return }
    try? FileManager.default.removeItem(at: url)
  }

  private func saveFoundGroupsFile() {
    guard let url = foundGroupsFileURL, !foundGroups.isEmpty else { return }
    guard let data = try? JSONSerialization.data(withJSONObject: foundGroups) else { return }
    try? data.write(to: url)
  }

  private func loadFoundGroupsFile() -> [[String: Any]]? {
    guard let url = foundGroupsFileURL,
          (try? url.checkResourceIsReachable()) == true,
          let data = try? Data(contentsOf: url),
          let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return nil }
    return json
  }

  private func deleteFoundGroupsFile() {
    guard let url = foundGroupsFileURL else { return }
    try? FileManager.default.removeItem(at: url)
  }

  @objc func getSavedGroups(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(loadFoundGroupsFile() ?? [])
  }

  private func loadCache() {
    guard let url = cacheURL, FileManager.default.fileExists(atPath: url.path) else { return }
    do {
      let data = try Data(contentsOf: url)
      let decoded = try NSKeyedUnarchiver.unarchivedObject(
        ofClasses: [NSDictionary.self, NSString.self, VNObservation.self, VNFeaturePrintObservation.self],
        from: data
      ) as? [String: VNFeaturePrintObservation]
      if let cache = decoded {
        cacheLock.lock()
        featurePrintCache = cache
        cacheLock.unlock()
      }
    } catch {
      // キャッシュ破損時は無視してメモリキャッシュのみで続行
    }
  }

  private func saveCache() {
    cacheLock.lock()
    let snapshot = featurePrintCache
    cacheLock.unlock()
    guard let url = cacheURL, !snapshot.isEmpty else { return }
    do {
      let data = try NSKeyedArchiver.archivedData(
        withRootObject: snapshot as NSDictionary,
        requiringSecureCoding: false
      )
      try data.write(to: url)
    } catch {
      // 保存失敗時は次回スキャンで再計算
    }
  }
}

// MARK: - Union-Find

private class UnionFind {
  var parent: [Int]
  init(count: Int) { parent = (0..<count).map { $0 } }
  func find(_ x: Int) -> Int {
    if parent[x] != x { parent[x] = find(parent[x]) }
    return parent[x]
  }
  func union(_ x: Int, _ y: Int) {
    let px = find(x), py = find(y)
    if px != py { parent[px] = py }
  }
}
