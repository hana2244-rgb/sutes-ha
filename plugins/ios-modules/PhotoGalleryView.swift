//
// 捨てショ - PhotoGalleryView（ネイティブ一覧・JPEG変換なし）
// UICollectionView + PHImageManager でサムネイルを直接表示
//

import UIKit
import Photos
import React

private let kColumns: CGFloat = 4
private let kGap: CGFloat = 2

// MARK: - Cell

final class PhotoGalleryCell: UICollectionViewCell {
  static let reuseId = "PhotoGalleryCell"

  let imageView: UIImageView = {
    let v = UIImageView()
    v.contentMode = .scaleAspectFill
    v.clipsToBounds = true
    v.backgroundColor = UIColor(white: 0.15, alpha: 1)
    return v
  }()

  let deleteOverlay: UIView = {
    let v = UIView()
    v.backgroundColor = UIColor.black.withAlphaComponent(0.5)
    v.isHidden = true
    return v
  }()

  let deleteIcon: UILabel = {
    let l = UILabel()
    l.text = "✕"
    l.textColor = .white
    l.font = .systemFont(ofSize: 24, weight: .bold)
    l.isHidden = true
    return l
  }()

  let currentBadge: UILabel = {
    let l = UILabel()
    l.font = .systemFont(ofSize: 10, weight: .semibold)
    l.textColor = .white
    l.backgroundColor = UIColor(red: 0.91, green: 0.31, blue: 0.23, alpha: 1) // accent
    l.textAlignment = .center
    l.isHidden = true
    return l
  }()

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.addSubview(imageView)
    contentView.addSubview(deleteOverlay)
    contentView.addSubview(deleteIcon)
    contentView.addSubview(currentBadge)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = contentView.bounds
    deleteOverlay.frame = contentView.bounds
    deleteIcon.center = CGPoint(x: contentView.bounds.midX, y: contentView.bounds.midY)
    deleteIcon.sizeToFit()
    currentBadge.frame = CGRect(x: 0, y: contentView.bounds.maxY - 18, width: contentView.bounds.width, height: 18)
  }

  func configure(image: UIImage?, isDeleted: Bool, isCurrent: Bool, isKept: Bool, currentText: String) {
    imageView.image = image
    deleteOverlay.isHidden = !isDeleted
    deleteIcon.isHidden = !isDeleted
    currentBadge.isHidden = !isCurrent
    currentBadge.text = currentText
    if isCurrent {
      layer.borderWidth = 3
      layer.borderColor = UIColor(red: 0.91, green: 0.31, blue: 0.23, alpha: 1).cgColor
    } else if isKept {
      layer.borderWidth = 2
      layer.borderColor = UIColor(red: 0.49, green: 0.72, blue: 0.49, alpha: 1).cgColor // success
    } else {
      layer.borderWidth = 0
      layer.borderColor = nil
    }
  }
}

// MARK: - Gallery View

@objc(PhotoGalleryView)
final class PhotoGalleryView: UIView {

  @objc var assetIds: NSArray? {
    didSet {
      ids = (assetIds as? [String]) ?? []
      needsScrollToCurrent = true
      collectionView.reloadData()
    }
  }

  @objc var currentIndex: NSNumber? {
    didSet {
      let idx = currentIndex?.intValue ?? 0
      if idx != _currentIndex {
        _currentIndex = idx
        needsScrollToCurrent = true
        collectionView.reloadData()
      }
    }
  }

  @objc var deleteIds: NSArray? {
    didSet { deleteSet = Set((deleteIds as? [String]) ?? []) }
  }

  @objc var skipIds: NSArray? {
    didSet { skipSet = Set((skipIds as? [String]) ?? []) }
  }

  @objc var currentBadgeText: NSString? {
    didSet { _currentBadgeText = (currentBadgeText as String?) ?? "ここへジャンプ" }
  }

  @objc var onSelectIndex: RCTDirectEventBlock?

  private var ids: [String] = []
  private var _currentIndex: Int = 0
  private var deleteSet: Set<String> = []
  private var skipSet: Set<String> = []
  private var _currentBadgeText: String = "ここへジャンプ"

  private lazy var layout: UICollectionViewFlowLayout = {
    let l = UICollectionViewFlowLayout()
    l.minimumInteritemSpacing = kGap
    l.minimumLineSpacing = kGap
    l.scrollDirection = .vertical
    return l
  }()

  private lazy var collectionView: UICollectionView = {
    let v = UICollectionView(frame: .zero, collectionViewLayout: layout)
    v.register(PhotoGalleryCell.self, forCellWithReuseIdentifier: PhotoGalleryCell.reuseId)
    v.dataSource = self
    v.delegate = self
    v.backgroundColor = UIColor(white: 0.04, alpha: 1)
    v.showsVerticalScrollIndicator = true
    return v
  }()

  private let imageManager = PHCachingImageManager()
  private var cellSize: CGSize = CGSize(width: 80, height: 80)
  private var needsScrollToCurrent = false

  override init(frame: CGRect) {
    super.init(frame: frame)
    addSubview(collectionView)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func layoutSubviews() {
    super.layoutSubviews()
    collectionView.frame = bounds
    let w = bounds.width
    let cellW = (w - kGap * (kColumns - 1)) / kColumns
    cellSize = CGSize(width: cellW, height: cellW)
    layout.itemSize = cellSize
    layout.invalidateLayout()
    if needsScrollToCurrent, ids.count > 0 {
      needsScrollToCurrent = false
      scrollToCurrentIfNeeded()
    }
  }

  private func scrollToCurrentIfNeeded() {
    guard _currentIndex >= 0, _currentIndex < ids.count else { return }
    let row = _currentIndex / Int(kColumns)
    let offset = CGFloat(row) * (cellSize.height + kGap)
    collectionView.setContentOffset(CGPoint(x: 0, y: offset), animated: false)
  }
}

// MARK: - UICollectionViewDataSource

extension PhotoGalleryView: UICollectionViewDataSource {
  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    ids.count
  }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = collectionView.dequeueReusableCell(withReuseIdentifier: PhotoGalleryCell.reuseId, for: indexPath) as! PhotoGalleryCell
    let idx = indexPath.item
    guard idx < ids.count else {
      cell.configure(image: nil, isDeleted: false, isCurrent: false, isKept: false, currentText: _currentBadgeText)
      return cell
    }
    let assetId = ids[idx]
    let isDeleted = deleteSet.contains(assetId)
    let isSkipped = skipSet.contains(assetId)
    let isCurrent = idx == _currentIndex
    let isKept = idx < _currentIndex && !isDeleted && !isSkipped

    let options = PHImageRequestOptions()
    options.deliveryMode = .opportunistic
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = true
    options.isSynchronous = false

    let fetchOptions = PHFetchOptions()
    fetchOptions.includeAllBurstAssets = true
    let result = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: fetchOptions)
    guard let asset = result.firstObject else {
      cell.configure(image: nil, isDeleted: isDeleted, isCurrent: isCurrent, isKept: isKept, currentText: _currentBadgeText)
      return cell
    }

    let targetSize = CGSize(
      width: cellSize.width * UIScreen.main.scale,
      height: cellSize.height * UIScreen.main.scale
    )
    let requestedIndexPath = indexPath
    imageManager.requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: options) { [weak self] image, _ in
      DispatchQueue.main.async {
        guard let self = self else { return }
        guard let c = self.collectionView.cellForItem(at: requestedIndexPath) as? PhotoGalleryCell else { return }
        let stillDeleted = self.deleteSet.contains(assetId)
        let stillSkipped = self.skipSet.contains(assetId)
        let stillCurrent = requestedIndexPath.item == self._currentIndex
        let stillKept = requestedIndexPath.item < self._currentIndex && !stillDeleted && !stillSkipped
        c.configure(image: image, isDeleted: stillDeleted, isCurrent: stillCurrent, isKept: stillKept, currentText: self._currentBadgeText)
      }
    }
    cell.configure(image: nil, isDeleted: isDeleted, isCurrent: isCurrent, isKept: isKept, currentText: _currentBadgeText)
    return cell
  }
}

// MARK: - UICollectionViewDelegate

extension PhotoGalleryView: UICollectionViewDelegate {
  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    let index = indexPath.item
    onSelectIndex?(["index": index])
  }
}

// MARK: - View Manager

@objc(PhotoGalleryViewManager)
final class PhotoGalleryViewManager: RCTViewManager {

  override func view() -> UIView! {
    return PhotoGalleryView()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
