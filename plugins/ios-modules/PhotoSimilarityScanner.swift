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
  private var allAssets: [PHAsset] = []
  private var timeClusters: [[PHAsset]] = []
  private var foundGroups: [[String: Any]] = []
  private var scanProgress: [String: Any] = [:]
  private var featurePrintCache: [String: VNFeaturePrintObservation] = [:]
  /// featurePrintCache を保護
  private let cacheLock = NSLock()
  /// isPaused / shouldCancel を保護（複数スレッドからの同時アクセスによるデータレース防止）
  private let stateLock = NSLock()
  /// scanProgress を保護（scanExecutionQueue ↔ main/JS thread の同時アクセス防止）
  private let progressLock = NSLock()
  /// foundGroups / timeClusters を保護（scanExecutionQueue ↔ JS thread の同時アクセス防止）
  private let groupsLock = NSLock()
  private var cacheURL: URL?
  private var progressFileURL: URL?
  private var foundGroupsFileURL: URL?
  private var thumbDir: URL?
  private let thresholdLock = NSLock()
  private var currentThreshold: Double = 0.32
  private var thermalObserver: NSObjectProtocol?
  /// スキャン実行を直列化し、二重 runScan によるクラッシュを防止
  private let scanExecutionQueue = DispatchQueue(label: "sutesho.scan.execution")
  /// iOS 写真アプリと同様の先読みキャッシュマネージャー
  private let cachingManager = PHCachingImageManager()

  /// isPaused: stateLock で保護した computed property
  private var _isPaused = false
  private var isPaused: Bool {
    get { stateLock.lock(); defer { stateLock.unlock() }; return _isPaused }
    set { stateLock.lock(); _isPaused = newValue; stateLock.unlock() }
  }

  /// shouldCancel: stateLock で保護した computed property
  private var _shouldCancel = false
  private var shouldCancel: Bool {
    get { stateLock.lock(); defer { stateLock.unlock() }; return _shouldCancel }
    set { stateLock.lock(); _shouldCancel = newValue; stateLock.unlock() }
  }

  /// スキャン世代カウンター（stateLock で保護）。古いブロックを早期終了させるために使用
  private var _scanGeneration: Int = 0

  private func nextScanGeneration() -> Int {
    stateLock.lock(); defer { stateLock.unlock() }
    _scanGeneration += 1
    return _scanGeneration
  }

  private func isScanGenerationValid(_ gen: Int) -> Bool {
    stateLock.lock(); defer { stateLock.unlock() }
    return _scanGeneration == gen
  }

  /// サムネイルキャッシュのバージョン。サイズや品質を変えたらインクリメントする
  private static let thumbCacheVersion = 2

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

      // バージョン付きサムネイルディレクトリ（旧バージョンは自動削除）
      let thumbDirName = "sutesho_thumbs_v\(Self.thumbCacheVersion)"
      let thumbDirURL = cacheDir.appendingPathComponent(thumbDirName)
      try? FileManager.default.createDirectory(at: thumbDirURL, withIntermediateDirectories: true)
      self.thumbDir = thumbDirURL

      // 旧バージョンのサムネイルディレクトリを削除
      Self.cleanOldThumbDirs(in: cacheDir, currentName: thumbDirName)
    }
    startThermalMonitoring()
  }

  /// sutesho_thumbs* で始まる旧ディレクトリを削除
  private static func cleanOldThumbDirs(in cacheDir: URL, currentName: String) {
    DispatchQueue.global(qos: .utility).async {
      guard let contents = try? FileManager.default.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil) else { return }
      for item in contents {
        let name = item.lastPathComponent
        if name.hasPrefix("sutesho_thumbs") && name != currentName {
          try? FileManager.default.removeItem(at: item)
          print("[SuteSha] deleted old thumb cache: \(name)")
        }
      }
    }
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
      isPaused = true
      scanQueue.isSuspended = true
      sendEvent(name: "onScanPaused", body: nil)
      progressLock.lock()
      let progress = scanProgress
      progressLock.unlock()
      if !progress.isEmpty, let cur = progress["current"] as? Int, let tot = progress["total"] as? Int {
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
  private var hasListeners = false

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  private func sendEvent(name: String, body: Any?) {
    guard bridge != nil, hasListeners else { return }
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
    shouldCancel = true
    let myGen = nextScanGeneration()

    scanExecutionQueue.async { [weak self] in
      guard let self = self else {
        DispatchQueue.main.async { reject("SCAN_ERROR", "Scanner unavailable", nil) }
        return
      }
      // 前回 runScan が完全に抜けるまで待つ
      self.scanQueue.cancelAllOperations()
      self.scanQueue.waitUntilAllOperationsAreFinished()
      self.scanQueue.isSuspended = false
      Thread.sleep(forTimeInterval: 0.2)
      var resolved = false
      defer {
        if !resolved {
          DispatchQueue.main.async { reject("SCAN_ERROR", "Scan failed", nil) }
        }
      }
      // 新しいスキャン要求が来ていたら古いブロックを早期終了
      guard self.isScanGenerationValid(myGen) else {
        resolved = true
        DispatchQueue.main.async { resolve(NSNull()) }
        return
      }
      self.thresholdLock.lock()
      self.currentThreshold = threshold
      self.thresholdLock.unlock()
      self.isPaused = false
      self.shouldCancel = false
      self.groupsLock.lock()
      self.foundGroups = []
      self.groupsLock.unlock()
      self.deleteProgressFile()
      self.deleteFoundGroupsFile()
      self.loadCache()
      let assets = self.fetchAllImageAssetsOnMainThread()
      do {
        try self.runScan(assets: assets)
        resolved = true
        DispatchQueue.main.async { resolve(NSNull()) }
      } catch {
        resolved = true
        DispatchQueue.main.async { reject("SCAN_ERROR", error.localizedDescription, error) }
      }
    }
  }

  @objc func pauseScan(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isPaused = true
    shouldCancel = true
    scanQueue.cancelAllOperations()
    scanQueue.isSuspended = true
    progressLock.lock()
    let progress = scanProgress
    progressLock.unlock()
    if !progress.isEmpty, let cur = progress["current"] as? Int, let tot = progress["total"] as? Int {
      saveProgressFile(current: cur, total: tot, phase: "grouping")
    }
    saveFoundGroupsFile()
    sendEvent(name: "onScanPaused", body: progress.isEmpty ? nil : progress)
    resolve(NSNull())
  }

  @objc func resumeScan(_ threshold: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    shouldCancel = true
    let myGen = nextScanGeneration()

    scanExecutionQueue.async { [weak self] in
      guard let self = self else {
        DispatchQueue.main.async { reject("SCAN_ERROR", "Scanner unavailable", nil) }
        return
      }
      // 前回 runScan が完全に抜けるまで待つ
      self.scanQueue.cancelAllOperations()
      self.scanQueue.waitUntilAllOperationsAreFinished()
      self.scanQueue.isSuspended = false
      Thread.sleep(forTimeInterval: 0.2)
      var resolved = false
      defer {
        if !resolved {
          DispatchQueue.main.async { reject("SCAN_ERROR", "Resume failed", nil) }
        }
      }
      // 新しいスキャン要求が来ていたら古いブロックを早期終了
      guard self.isScanGenerationValid(myGen) else {
        resolved = true
        DispatchQueue.main.async { resolve(NSNull()) }
        return
      }
      self.thresholdLock.lock()
      self.currentThreshold = threshold
      self.thresholdLock.unlock()
      self.isPaused = false
      self.shouldCancel = false
      self.loadCache()

      let assets = self.fetchAllImageAssetsOnMainThread()
      if let (resumeFrom, _) = self.loadProgressFromFile() {
        if let saved = self.loadFoundGroupsFile() {
          self.groupsLock.lock()
          self.foundGroups = saved
          self.groupsLock.unlock()
        }
        resolved = true
        DispatchQueue.main.async { resolve(NSNull()) }
        do {
          try self.runScan(assets: assets, resumeFrom: resumeFrom)
          self.saveProgressFile(current: 0, total: 0, phase: "idle")
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
          self.saveCache()
        } catch {
          self.groupsLock.lock()
          let count = self.foundGroups.count
          self.groupsLock.unlock()
          self.sendEvent(name: "onScanCompleted", body: ["totalGroups": count])
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
        }
      } else {
        self.groupsLock.lock()
        self.foundGroups = []
        self.groupsLock.unlock()
        resolved = true
        DispatchQueue.main.async { resolve(NSNull()) }
        do {
          try self.runScan(assets: assets)
          self.saveProgressFile(current: 0, total: 0, phase: "idle")
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
          self.saveCache()
        } catch {
          self.groupsLock.lock()
          let count = self.foundGroups.count
          self.groupsLock.unlock()
          self.sendEvent(name: "onScanCompleted", body: ["totalGroups": count])
          self.deleteProgressFile()
          self.deleteFoundGroupsFile()
        }
      }
    }
  }

  /// メインスレッドで fetch + enumerate を行う（バックグラウンドでの PHBatchFetchingArray クラッシュ対策）
  private func fetchAllImageAssetsOnMainThread() -> [PHAsset] {
    var result: [PHAsset] = []
    let sem = DispatchSemaphore(value: 0)
    DispatchQueue.main.async {
      let options = PHFetchOptions()
      options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
      options.includeAllBurstAssets = true
      let fetchResult = PHAsset.fetchAssets(with: .image, options: options)
      fetchResult.enumerateObjects { asset, _, _ in result.append(asset) }
      sem.signal()
    }
    sem.wait()
    return result
  }

  private func runScan(assets: [PHAsset], resumeFrom: Int? = nil) throws {
    allAssets = assets
    let total = assets.count

    let resumePoint = resumeFrom ?? 0
    if resumePoint == 0 {
      sendProgress(percent: 0, current: 0, total: total, phase: "counting", phaseLabel: "全 \(total) 枚をスキャンします")
      Thread.sleep(forTimeInterval: 1.0)
    }

    let clusters = clusterByTime(assets)
    groupsLock.lock()
    timeClusters = clusters
    groupsLock.unlock()

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
          groupsLock.lock()
          foundGroups.append(groupDict)
          groupsLock.unlock()
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
    groupsLock.lock()
    let finalCount = foundGroups.count
    groupsLock.unlock()
    sendEvent(name: "onScanCompleted", body: ["totalGroups": finalCount])
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
    // ネットワーク不許可: iCloud 同期写真で isSynchronous リクエストが無限ブロックするのを防ぐ
    options.isNetworkAccessAllowed = false
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
    let progress: [String: Any] = [
      "percent": percent,
      "current": current,
      "total": total,
      "phase": phase,
      "phaseLabel": phaseLabel,
    ]
    progressLock.lock()
    scanProgress = progress
    progressLock.unlock()
    sendEvent(name: "onProgressUpdate", body: progress)
  }

  // MARK: - Progress / Groups

  @objc func getScanProgress(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    progressLock.lock()
    let progress = scanProgress
    progressLock.unlock()
    resolve(progress.isEmpty ? NSNull() : progress)
  }

  @objc func getFoundGroups(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    groupsLock.lock()
    let groups = foundGroups
    groupsLock.unlock()
    resolve(groups)
  }

  @objc func regroupWithThreshold(_ threshold: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    thresholdLock.lock()
    currentThreshold = threshold
    thresholdLock.unlock()
    // timeClusters のスナップショットをロック外で処理（findSimilarGroups は時間がかかる可能性があるため）
    groupsLock.lock()
    let clusters = timeClusters
    groupsLock.unlock()
    var newGroups: [[String: Any]] = []
    for cluster in clusters where cluster.count >= 2 {
      let groups = findSimilarGroups(in: cluster, threshold: threshold)
      for group in groups where group.count >= 2 {
        newGroups.append(makeGroupDict(assets: group, threshold: threshold))
      }
    }
    groupsLock.lock()
    foundGroups = newGroups
    groupsLock.unlock()
    resolve(newGroups)
  }

  // MARK: - Delete

  @objc func deleteAssets(_ assetIds: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard !assetIds.isEmpty else {
      resolve(["deletedCount": 0, "freedBytes": 0, "success": true] as [String: Any])
      return
    }
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
      var totalBytes: Int64 = 0
      var toDelete: [PHAsset] = []
      fetchResult.enumerateObjects { asset, _, _ in
        toDelete.append(asset)
        totalBytes += self.getResourceFileSize(asset)
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
  }

  // MARK: - Thumbnail / Preview Image

  /// 指定サイズで画像を取得し、file:// URL を返す（サムネイル一覧用）
  @objc func getThumbnailURL(_ assetId: String, width: NSNumber, height: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    exportImageToFile(assetId: assetId, targetWidth: width.intValue, targetHeight: height.intValue, prefix: "t", quality: 0.9) { url in
      resolve(url ?? NSNull())
    }
  }

  /// 複数アセットのサムネイルを一括取得（PHCachingImageManager で高速化）
  @objc func getThumbnailURLs(_ assetIds: [String], width: NSNumber, height: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let w = width.intValue
    let h = height.intValue
    let targetSize = CGSize(width: w, height: h)
    let quality: CGFloat = 0.85

    guard let dir = thumbDir else {
      resolve([String: String]())
      return
    }

    // PHFetchResult の fetch + enumerate はメインスレッドで実行（クラッシュ対策）
    var assetMap: [String: PHAsset] = [:]
    var assets: [PHAsset] = []
    let sem = DispatchSemaphore(value: 0)
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { sem.signal(); return }
      let fetchOptions = PHFetchOptions()
      fetchOptions.includeAllBurstAssets = true
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: fetchOptions)
      fetchResult.enumerateObjects { asset, _, _ in
        assetMap[asset.localIdentifier] = asset
        assets.append(asset)
      }
      sem.signal()
    }
    sem.wait()

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { resolve([String: String]()); return }

      // ディスクキャッシュ済みを先に振り分け
      let lock = NSLock()
      var result: [String: String] = [:]
      var uncachedAssets: [PHAsset] = []
      var uncachedIds: [String] = []

      for assetId in assetIds {
        let safeId = assetId.replacingOccurrences(of: "/", with: "_")
        let fileURL = dir.appendingPathComponent("t_\(safeId)_\(w)x\(h).jpg")
        if FileManager.default.fileExists(atPath: fileURL.path) {
          result[assetId] = fileURL.absoluteString
        } else if let asset = assetMap[assetId] {
          uncachedAssets.append(asset)
          uncachedIds.append(assetId)
        }
      }

      if uncachedAssets.isEmpty {
        DispatchQueue.main.async { resolve(result) }
        return
      }

      // 2. PHCachingImageManager でプリキャッシュ（iOS 写真アプリと同じ技術）
      let cacheOptions = PHImageRequestOptions()
      cacheOptions.deliveryMode = .opportunistic
      cacheOptions.resizeMode = .fast
      cacheOptions.isNetworkAccessAllowed = true
      self.cachingManager.startCachingImages(for: uncachedAssets, targetSize: targetSize, contentMode: .aspectFill, options: cacheOptions)

      // 3. プリキャッシュ済み画像を取得してファイルに書き出し
      let group = DispatchGroup()
      let semaphore = DispatchSemaphore(value: 6)

      for (index, asset) in uncachedAssets.enumerated() {
        let assetId = uncachedIds[index]
        group.enter()
        semaphore.wait()

        let safeId = assetId.replacingOccurrences(of: "/", with: "_")
        let fileURL = dir.appendingPathComponent("t_\(safeId)_\(w)x\(h).jpg")

        let reqOptions = PHImageRequestOptions()
        reqOptions.deliveryMode = .highQualityFormat
        reqOptions.isNetworkAccessAllowed = true
        reqOptions.isSynchronous = true
        reqOptions.resizeMode = .exact

        self.cachingManager.requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: reqOptions) { [weak self] image, _ in
          guard let image = image else {
            semaphore.signal()
            group.leave()
            return
          }
          let fileURL = fileURL
          let quality = quality
          // PHImageManager のコールバックはメインスレッドで来ることがあり、JPEG エンコードでクラッシュするためバックグラウンドで実行
          DispatchQueue.global(qos: .userInitiated).async {
            defer {
              semaphore.signal()
              group.leave()
            }
            guard let data = self?.imageToData(image, quality: quality) else { return }
            do {
              try data.write(to: fileURL, options: .atomic)
              lock.lock()
              result[assetId] = fileURL.absoluteString
              lock.unlock()
            } catch {}
          }
        }
      }

      group.wait()

      // 4. プリキャッシュを停止してメモリ解放
      self.cachingManager.stopCachingImages(for: uncachedAssets, targetSize: targetSize, contentMode: .aspectFill, options: cacheOptions)

      DispatchQueue.main.async { resolve(result) }
    }
  }

  /// スワイププレビュー用の実画像 file:// URL
  @objc func getPreviewImage(_ assetId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    exportImageToFile(assetId: assetId, targetWidth: 2000, targetHeight: 2000, prefix: "p", quality: 0.92) { url in
      resolve(url ?? NSNull())
    }
  }

  /// UIImage → Data 変換。jpegData が失敗する写真（特定の HEIC/HDR/調整済み等）向けに pngData フォールバック付き
  private func imageToData(_ image: UIImage, quality: CGFloat) -> Data? {
    if let data = image.jpegData(compressionQuality: quality) {
      return data
    }
    // jpegData が nil を返す写真タイプ向け: CIImage 経由で再描画してから JPEG 化
    if let ciImage = image.ciImage ?? (image.cgImage.map { CIImage(cgImage: $0) }) {
      let context = CIContext()
      if let cgImage = context.createCGImage(ciImage, from: ciImage.extent) {
        let redrawn = UIImage(cgImage: cgImage)
        if let data = redrawn.jpegData(compressionQuality: quality) {
          return data
        }
      }
    }
    // 最終手段: pngData
    return image.pngData()
  }

  /// isSynchronous で画像取得（他の方法が全て失敗した場合のフォールバック）。コールバック内の JPEG 変換はバックグラウンドで実行。
  private func requestImageSync(asset: PHAsset, targetSize: CGSize, version: PHImageRequestOptionsVersion, quality: CGFloat) -> Data? {
    let opts = PHImageRequestOptions()
    opts.deliveryMode = .highQualityFormat
    opts.isNetworkAccessAllowed = false
    opts.isSynchronous = true
    opts.resizeMode = .fast
    opts.version = version
    var resultData: Data?
    let sem = DispatchSemaphore(value: 0)
    PHImageManager.default().requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: opts) { [weak self] image, _ in
      guard let image = image else { sem.signal(); return }
      let quality = quality
      DispatchQueue.global(qos: .userInitiated).async {
        defer { sem.signal() }
        resultData = self?.imageToData(image, quality: quality)
      }
    }
    sem.wait()
    return resultData
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

    // PHFetchResult の fetch + firstObject はメインスレッドで実行（バックグラウンドでのクラッシュ対策）
    var asset: PHAsset?
    let fetchSem = DispatchSemaphore(value: 0)
    DispatchQueue.main.async {
      let fetchOptions = PHFetchOptions()
      fetchOptions.includeAllBurstAssets = true
      let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: fetchOptions)
      asset = fetchResult.firstObject
      fetchSem.signal()
    }
    fetchSem.wait()

    guard let asset = asset else {
      print("[SuteSha] thumb: asset not found id=\(assetId.prefix(40))...")
      completion(nil)
      return
    }

    let targetSize = CGSize(width: targetWidth, height: targetHeight)

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { completion(nil); return }
      var resultURL: String?

      // 高速表示: opportunistic で高品質を即座に返す（fastFormat は低解像度すぎるため使わない）
      let fastSem = DispatchSemaphore(value: 0)
      let fastOptions = PHImageRequestOptions()
      fastOptions.deliveryMode = .opportunistic
      fastOptions.isNetworkAccessAllowed = true
      fastOptions.resizeMode = .exact
      fastOptions.version = .current
      var fastId: PHImageRequestID = PHInvalidImageRequestID
      fastId = PHImageManager.default().requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: fastOptions) { [weak self] image, info in
        let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
        if isDegraded { return }
        guard let image = image else { fastSem.signal(); return }
        let fileURL = fileURL
        let quality = quality
        DispatchQueue.global(qos: .userInitiated).async {
          defer { fastSem.signal() }
          guard let data = self?.imageToData(image, quality: quality) else { return }
          try? data.write(to: fileURL, options: .atomic)
          resultURL = fileURL.absoluteString
        }
      }
      if fastSem.wait(timeout: .now() + 3.0) == .timedOut {
        PHImageManager.default().cancelImageRequest(fastId)
      }
      if resultURL != nil {
        completion(resultURL)
        return
      }

      let sem = DispatchSemaphore(value: 0)
      // 1st attempt: highQualityFormat (iCloud download allowed). degraded も受け入れる
      let options = PHImageRequestOptions()
      options.deliveryMode = .highQualityFormat
      options.isNetworkAccessAllowed = true
      options.isSynchronous = false
      options.resizeMode = .exact
      options.version = .current

      var requestId: PHImageRequestID = PHInvalidImageRequestID
      requestId = PHImageManager.default().requestImage(
        for: asset,
        targetSize: targetSize,
        contentMode: .aspectFill,
        options: options
      ) { [weak self] image, info in
        guard let image = image else { sem.signal(); return }
        let fileURL = fileURL
        let quality = quality
        DispatchQueue.global(qos: .userInitiated).async {
          defer { sem.signal() }
          guard let data = self?.imageToData(image, quality: quality) else { return }
          do {
            try data.write(to: fileURL, options: .atomic)
            resultURL = fileURL.absoluteString
          } catch {
            print("[SuteSha] thumb write error: \(error)")
          }
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
        ) { [weak self] image, info in
          guard let image = image else {
            let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            if !isDegraded { sem2.signal() }
            return
          }
          let fileURL = fileURL
          let quality = quality
          DispatchQueue.global(qos: .userInitiated).async {
            defer { sem2.signal() }
            guard let data = self?.imageToData(image, quality: quality) else { return }
            do {
              try data.write(to: fileURL, options: .atomic)
              resultURL = fileURL.absoluteString
            } catch {}
          }
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
        ) { [weak self] image, info in
          guard let image = image else {
            let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            if !isDegraded { sem3.signal() }
            return
          }
          let fileURL = fileURL
          let quality = quality
          DispatchQueue.global(qos: .userInitiated).async {
            defer { sem3.signal() }
            guard let data = self?.imageToData(image, quality: quality) else { return }
            do {
              try data.write(to: fileURL, options: .atomic)
              resultURL = fileURL.absoluteString
            } catch {}
          }
        }

        let waitResult3 = sem3.wait(timeout: .now() + 5.0)
        if waitResult3 == .timedOut {
          PHImageManager.default().cancelImageRequest(retryRequestId3)
        }
      }

      // 4th attempt: unadjusted 版を同期リクエスト（調整済み写真で .current が失敗する場合の最終手段）
      if resultURL == nil {
        if let data = self.requestImageSync(asset: asset, targetSize: targetSize, version: .unadjusted, quality: quality) {
          do {
            try data.write(to: fileURL, options: .atomic)
            resultURL = fileURL.absoluteString
          } catch {}
        }
      }

      // 5th attempt: original 版（unadjusted も失敗する場合）
      if resultURL == nil {
        if let data = self.requestImageSync(asset: asset, targetSize: targetSize, version: .original, quality: quality) {
          do {
            try data.write(to: fileURL, options: .atomic)
            resultURL = fileURL.absoluteString
          } catch {}
        }
      }

      if resultURL == nil {
        print("[SuteSha] thumb: failed after all attempts id=\(assetId.prefix(40))...")
      }
      completion(resultURL)
    }
  }

  // MARK: - All Photos (Swipe Mode)

  @objc func getAllPhotos(_ offset: Int, limit: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // PHFetchResult の fetch と object(at:) はメインスレッドで実行（バックグラウンドでのクラッシュ対策）
    DispatchQueue.main.async { [weak self] in
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
      resolve(["assets": assets, "total": total])
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
    progressLock.lock()
    let progress = scanProgress
    progressLock.unlock()
    if !progress.isEmpty, let cur = progress["current"] as? Int, let tot = progress["total"] as? Int {
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
    DispatchQueue.main.async {
      let result = PHAsset.fetchAssets(with: .image, options: nil).count
      resolve(result)
    }
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
    // ロック外でファイル書き込みを行うためスナップショットを取る
    groupsLock.lock()
    let groups = foundGroups
    groupsLock.unlock()
    guard let url = foundGroupsFileURL, !groups.isEmpty else { return }
    guard let data = try? JSONSerialization.data(withJSONObject: groups) else { return }
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
      // VNObservation を許可すると別サブクラス（VNSceneObservation 等）の decode でクラッシュするため、VNFeaturePrintObservation のみ許可
      let decoded = try NSKeyedUnarchiver.unarchivedObject(
        ofClasses: [NSDictionary.self, NSString.self, NSData.self, VNFeaturePrintObservation.self],
        from: data
      ) as? [String: VNFeaturePrintObservation]
      if let cache = decoded {
        cacheLock.lock()
        featurePrintCache = cache
        cacheLock.unlock()
      }
    } catch {
      // キャッシュ破損・形式不一致時は削除して次回から再計算
      try? FileManager.default.removeItem(at: url)
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
