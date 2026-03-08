// ============================================================
// 捨てショ - Native Photo Gallery View（ネイティブ一覧ラッパー）
// ============================================================

import React from 'react';
import { requireNativeComponent, UIManager, ViewStyle } from 'react-native';

type NativePhotoGalleryViewProps = {
  style?: ViewStyle;
  assetIds: string[];
  currentIndex: number;
  deleteIds: string[];
  skipIds: string[];
  currentBadgeText: string;
  onSelectIndex: (event: { nativeEvent: { index: number } }) => void;
};

const NativePhotoGalleryViewComponent = requireNativeComponent<NativePhotoGalleryViewProps>(
  'PhotoGalleryViewManager'
);

export const isNativeGalleryAvailable =
  UIManager.getViewManagerConfig != null &&
  UIManager.getViewManagerConfig('PhotoGalleryViewManager') != null;

export function NativePhotoGalleryView(props: NativePhotoGalleryViewProps) {
  return <NativePhotoGalleryViewComponent {...props} />;
}
