// ============================================================
// 捨てショ - PhotoGroupCard Component（ガラスカード）
// ============================================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { theme, glassCard } from '../theme';
import { getThumbnailURLs, getPreviewImage } from '../native/PhotoSimilarityScanner';
import type { SimilarGroup, PhotoAsset } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// リスト paddingHorizontal(16*2) + カード padding(16*2) = 64
const GRID_AVAILABLE_WIDTH = SCREEN_WIDTH - 64;
const GRID_GAP = 8;
const THUMBNAIL_WIDTH = GRID_AVAILABLE_WIDTH;
const THUMBNAIL_HEIGHT = Math.round(THUMBNAIL_WIDTH * 0.55);
const THUMB_W = Math.min(512, Math.round(THUMBNAIL_WIDTH * 2));
const THUMB_H = Math.min(512, Math.round(THUMBNAIL_HEIGHT * 2));

// Module-level thumbnail cache (survives component unmount/remount)
const thumbnailCache = new Map<string, string>();
const MAX_THUMB_RETRIES = 3;
const RETRY_DELAY_MS = 800;

interface PhotoGroupCardProps {
  group: SimilarGroup;
  index: number;
  onKeepToggle: (groupId: string, assetId: string) => void;
  onDelete: (assetIds: string[]) => void;
}

export const PhotoGroupCard = React.memo(function PhotoGroupCard({
  group,
  index,
  onKeepToggle,
  onDelete,
}: PhotoGroupCardProps) {
  const { t } = useTranslation();
  const [thumbUris, setThumbUris] = useState<Record<string, string>>({});
  const [failedThumbIds, setFailedThumbIds] = useState<Set<string>>(new Set());
  const scale = useSharedValue(1);

  const keepSet = useMemo(
    () => new Set(group.keepAssetIds),
    [group.keepAssetIds]
  );
  const hasKeep = keepSet.size > 0;

  const totalSize = group.assets.reduce((sum, a) => sum + a.fileSize, 0);
  const deletableAssets = group.assets.filter((a) => !keepSet.has(a.id));
  const deletableSize = deletableAssets.reduce(
    (sum, a) => sum + a.fileSize,
    0
  );

  const displayAssets = group.assets;

  const assetIds = useMemo(() => displayAssets.map((a) => a.id).join(','), [displayAssets]);

  useEffect(() => {
    let cancelled = false;

    // Immediately set any cached thumbnails
    const newThumbUris: Record<string, string> = {};
    const uncachedIds: string[] = [];

    for (const asset of displayAssets) {
      const cached = thumbnailCache.get(asset.id);
      if (cached) {
        newThumbUris[asset.id] = cached;
      } else {
        uncachedIds.push(asset.id);
      }
    }

    if (Object.keys(newThumbUris).length > 0) {
      setThumbUris((prev) => ({ ...prev, ...newThumbUris }));
    }

    if (uncachedIds.length === 0) return;

    const loadWithRetry = async (ids: string[], attempt: number) => {
      if (cancelled || ids.length === 0 || attempt > MAX_THUMB_RETRIES) return;
      try {
        const map = await getThumbnailURLs(ids, THUMB_W, THUMB_H);
        if (cancelled) return;
        if (Object.keys(map).length > 0) {
          Object.entries(map).forEach(([id, uri]) => thumbnailCache.set(id, uri));
          setThumbUris((prev) => ({ ...prev, ...map }));
        }
        const failedIds = ids.filter((id) => !map[id]);
        if (failedIds.length > 0 && attempt < MAX_THUMB_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          if (!cancelled) await loadWithRetry(failedIds, attempt + 1);
        } else if (!cancelled && failedIds.length > 0) {
          setFailedThumbIds((prev) => new Set([...prev, ...failedIds]));
        }
      } catch {
        if (!cancelled && attempt < MAX_THUMB_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          if (!cancelled) await loadWithRetry(ids, attempt + 1);
        } else if (!cancelled && ids.length > 0) {
          setFailedThumbIds((prev) => new Set([...prev, ...ids]));
        }
      }
    };
    loadWithRetry(uncachedIds, 1);

    return () => {
      cancelled = true;
    };
  }, [group.id, assetIds]);

  useEffect(() => {
    setFailedThumbIds(new Set());
  }, [group.id]);

  const handleThumbError = useCallback((assetId: string) => {
    thumbnailCache.delete(assetId);
    setThumbUris((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
    getThumbnailURLs([assetId], THUMB_W, THUMB_H).then((map) => {
      if (map[assetId]) {
        thumbnailCache.set(assetId, map[assetId]);
        setThumbUris((prev) => ({ ...prev, [assetId]: map[assetId] }));
        setFailedThumbIds((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
      } else {
        setFailedThumbIds((prev) => new Set(prev).add(assetId));
      }
    }).catch(() => setFailedThumbIds((prev) => new Set(prev).add(assetId)));
  }, []);

  const handleThumbnailPress = useCallback(
    (assetId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onKeepToggle(group.id, assetId);
    },
    [group.id, onKeepToggle]
  );

  const handleDelete = useCallback(() => {
    const toDelete = hasKeep ? deletableAssets : group.assets;
    const count = toDelete.length;
    const sizeMB = (hasKeep ? deletableSize : totalSize) / (1024 * 1024);

    const message = hasKeep
      ? t('group.deleteConfirmMessage', { size: sizeMB.toFixed(1) })
      : t('group.deleteConfirmMessageAll', { size: sizeMB.toFixed(1) });

    Alert.alert(
      hasKeep ? t('group.deleteCount', { count }) : t('group.deleteAllCount', { count }),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            onDelete(toDelete.map((a) => a.id));
          },
        },
      ]
    );
  }, [hasKeep, deletableAssets, deletableSize, group.assets, totalSize, onDelete]);

  // ===== Long-press preview modal =====
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewUris, setPreviewUris] = useState<Record<string, string>>({});
  const previewUrisRef = useRef<Record<string, string>>({});
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Set<string>>(new Set());
  const previewListRef = useRef<FlatList>(null);

  // Track whether zoomed for FlatList scrollEnabled (must be JS state, not shared value)
  const [isZoomed, setIsZoomed] = useState(false);

  // Pinch zoom
  const previewPinchScale = useSharedValue(1);
  const previewBaseScale = useSharedValue(1);
  // Pan (drag when zoomed / swipe-to-dismiss when not zoomed)
  const previewTranslateX = useSharedValue(0);
  const previewTranslateY = useSharedValue(0);
  const previewSavedTranslateX = useSharedValue(0);
  const previewSavedTranslateY = useSharedValue(0);
  // Dismiss swipe (vertical drag at scale=1)
  const dismissTranslateY = useSharedValue(0);
  const DISMISS_THRESHOLD = 120;

  const setZoomedTrue = useCallback(() => {
    try {
      setIsZoomed(true);
    } catch (e) {
      if (__DEV__) console.warn('[PhotoGroupCard] setZoomedTrue error:', e);
    }
  }, []);
  const setZoomedFalse = useCallback(() => {
    try {
      setIsZoomed(false);
    } catch (e) {
      if (__DEV__) console.warn('[PhotoGroupCard] setZoomedFalse error:', e);
    }
  }, []);

  // Use ref for close handler to avoid stale closure in gesture worklet
  const closePreviewRef = useRef<() => void>(() => {});

  const previewPinchGesture = useMemo(() => Gesture.Pinch()
    .onUpdate((e) => {
      previewPinchScale.value = previewBaseScale.value * e.scale;
    })
    .onEnd(() => {
      previewBaseScale.value = previewPinchScale.value;
      if (previewPinchScale.value < 1) {
        previewPinchScale.value = withSpring(1);
        previewBaseScale.value = 1;
        previewTranslateX.value = withSpring(0);
        previewTranslateY.value = withSpring(0);
        previewSavedTranslateX.value = 0;
        previewSavedTranslateY.value = 0;
        runOnJS(setZoomedFalse)();
      } else if (previewPinchScale.value > 1) {
        runOnJS(setZoomedTrue)();
      }
    }), []);

  const dismissViaRef = useCallback(() => {
    closePreviewRef.current();
  }, []);

  const dismissPanGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      if (previewPinchScale.value <= 1) {
        dismissTranslateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (previewPinchScale.value <= 1) {
        if (Math.abs(dismissTranslateY.value) > DISMISS_THRESHOLD) {
          dismissTranslateY.value = 0;
          previewTranslateX.value = 0;
          previewTranslateY.value = 0;
          previewSavedTranslateX.value = 0;
          previewSavedTranslateY.value = 0;
          runOnJS(dismissViaRef)();
        } else {
          dismissTranslateY.value = withSpring(0);
        }
      }
    }), [dismissViaRef]);

  const zoomPanGesture = useMemo(() => Gesture.Pan()
    .minPointers(1)
    .enabled(isZoomed)
    .onStart(() => {
      previewSavedTranslateX.value = previewTranslateX.value;
      previewSavedTranslateY.value = previewTranslateY.value;
    })
    .onUpdate((e) => {
      previewTranslateX.value = previewSavedTranslateX.value + e.translationX;
      previewTranslateY.value = previewSavedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      // ズーム時のドラッグ終了（特に処理不要）
    }), [isZoomed]);

  const previewComposedGesture = useMemo(() => Gesture.Simultaneous(
    previewPinchGesture,
    Gesture.Exclusive(zoomPanGesture, dismissPanGesture),
  ), [previewPinchGesture, zoomPanGesture, dismissPanGesture]);

  const previewZoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: previewTranslateX.value },
      { translateY: previewTranslateY.value + dismissTranslateY.value },
      { scale: previewPinchScale.value },
    ],
  }));

  const previewOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(dismissTranslateY.value),
      [0, DISMISS_THRESHOLD],
      [1, 0.4],
      Extrapolation.CLAMP
    ),
  }));

  const loadPreviewUri = useCallback(async (assetId: string) => {
    if (previewUrisRef.current[assetId]) return;
    setPreviewLoadingIds((prev) => new Set(prev).add(assetId));
    try {
      const uri = await getPreviewImage(assetId);
      if (uri) {
        previewUrisRef.current[assetId] = uri;
        setPreviewUris((prev) => ({ ...prev, [assetId]: uri }));
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  }, []);

  const handleLongPress = useCallback(async (assetId: string) => {
    closingPreviewRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const idx = group.assets.findIndex((a) => a.id === assetId);
    setPreviewIndex(idx >= 0 ? idx : 0);
    setPreviewVisible(true);
    // Reset zoom/pan
    previewPinchScale.value = 1;
    previewBaseScale.value = 1;
    previewTranslateX.value = 0;
    previewTranslateY.value = 0;
    previewSavedTranslateX.value = 0;
    previewSavedTranslateY.value = 0;
    dismissTranslateY.value = 0;
    loadPreviewUri(assetId);
    // Preload adjacent
    if (idx > 0) loadPreviewUri(group.assets[idx - 1].id);
    if (idx < group.assets.length - 1) loadPreviewUri(group.assets[idx + 1].id);
  }, [group.assets, loadPreviewUri]);

  const closingPreviewRef = useRef(false);
  const handleClosePreview = useCallback(() => {
    if (closingPreviewRef.current) return;
    closingPreviewRef.current = true;
    setIsZoomed(false);
    setPreviewVisible(false);
    setTimeout(() => {
      closingPreviewRef.current = false;
    }, 300);
  }, []);

  // runOnJS から呼ばれるクロージャは例外を必ず catch する（未捕捉だと Hermes が abort してクラッシュ）
  const safeClosePreview = useCallback(() => {
    try {
      handleClosePreview();
    } catch (e) {
      if (__DEV__) console.warn('[PhotoGroupCard] handleClosePreview error:', e);
    }
  }, [handleClosePreview]);

  closePreviewRef.current = safeClosePreview;

  const handlePreviewToggleKeep = useCallback((assetId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onKeepToggle(group.id, assetId);
  }, [group.id, onKeepToggle]);

  // Reset preview URIs cache when group changes
  useEffect(() => {
    previewUrisRef.current = {};
    setPreviewUris({});
  }, [group.id]);

  const resetZoomAndPan = useCallback(() => {
    previewPinchScale.value = withSpring(1);
    previewBaseScale.value = 1;
    previewTranslateX.value = withSpring(0);
    previewTranslateY.value = withSpring(0);
    previewSavedTranslateX.value = 0;
    previewSavedTranslateY.value = 0;
    setIsZoomed(false);
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(14)}
      layout={Layout.springify()}
    >
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.groupCount}>{t('group.photoCount', { count: group.assets.length })}</Text>
          <View style={styles.sizeBadge}>
            <Text style={styles.sizeText}>
              {(totalSize / (1024 * 1024)).toFixed(1)}MB
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>
            {hasKeep
              ? t('group.deleteCount', { count: deletableAssets.length })
              : t('group.deleteAllCount', { count: group.assets.length })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {displayAssets.map((asset) => {
          const isKept = keepSet.has(asset.id);
          return (
            <TouchableOpacity
              key={asset.id}
              onPress={() => handleThumbnailPress(asset.id)}
              onLongPress={() => handleLongPress(asset.id)}
              delayLongPress={400}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.thumbnailContainer,
                  isKept && styles.thumbnailKeep,
                  hasKeep && !isKept && styles.thumbnailDelete,
                ]}
              >
                {thumbUris[asset.id] ? (
                  <Image
                    source={{ uri: thumbUris[asset.id] }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    onError={() => handleThumbError(asset.id)}
                  />
                ) : failedThumbIds.has(asset.id) ? (
                  <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                    <Text style={styles.thumbnailPlaceholderText}>📷</Text>
                  </View>
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                    <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                  </View>
                )}
                {isKept && (
                  <View style={styles.keepBadge}>
                    <Text style={styles.keepBadgeText}>{t('common.keep')}</Text>
                  </View>
                )}
                {hasKeep && !isKept && (
                  <View style={styles.deleteMask}>
                    <Text style={styles.deleteIcon}>✕</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      </Animated.View>

      {/* Long-press preview modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClosePreview}
      >
        <View style={styles.previewOverlayRoot}>
          <Animated.View style={[styles.previewOverlay, previewOverlayStyle]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleClosePreview}
            />
          </Animated.View>

          <TouchableOpacity style={styles.previewCloseArea} onPress={handleClosePreview}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.previewCounter}>
            {previewIndex + 1} / {group.assets.length}
          </Text>

          <GestureDetector gesture={previewComposedGesture}>
            <Animated.View style={[styles.previewZoomContainer, previewZoomStyle]}>
              <FlatList
                ref={previewListRef}
                data={group.assets}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!isZoomed}
                initialScrollIndex={previewIndex}
                getItemLayout={(_, idx) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * idx,
                  index: idx,
                })}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setPreviewIndex(idx);
                  resetZoomAndPan();
                  const asset = group.assets[idx];
                  if (asset) {
                    loadPreviewUri(asset.id);
                    if (idx > 0) loadPreviewUri(group.assets[idx - 1].id);
                    if (idx < group.assets.length - 1) loadPreviewUri(group.assets[idx + 1].id);
                  }
                }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.previewPage}>
                    {previewLoadingIds.has(item.id) && !previewUris[item.id] ? (
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                      <Image
                        source={{ uri: previewUris[item.id] || thumbUris[item.id] || item.uri }}
                        style={styles.previewImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                )}
              />
            </Animated.View>
          </GestureDetector>

          {/* Keep toggle button (no delete button per requirements) */}
          {(() => {
            const asset = group.assets[previewIndex];
            if (!asset) return null;
            const isKept = keepSet.has(asset.id);
            return (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.previewActionBtn, isKept ? styles.previewKeepActive : styles.previewKeepInactive]}
                  onPress={() => handlePreviewToggleKeep(asset.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.previewActionText, isKept && styles.previewActionTextActive]}>
                    {isKept ? t('common.keep') : t('common.keep')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    ...glassCard,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupCount: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  sizeBadge: {
    backgroundColor: theme.colors.secondarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  sizeText: {
    ...theme.typography.tiny,
    color: theme.colors.secondary,
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    ...theme.shadow.glassSm,
  },
  deleteButtonText: {
    ...theme.typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'column',
    gap: GRID_GAP,
  },
  thumbnailContainer: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailKeep: {
    borderColor: theme.colors.success,
    borderWidth: 3,
  },
  thumbnailDelete: {
    opacity: 0.5,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    backgroundColor: theme.colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 28,
    opacity: 0.5,
  },
  keepBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  keepBadgeText: {
    ...theme.typography.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  deleteMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(223, 230, 246, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    color: theme.colors.danger,
    fontSize: 24,
    fontWeight: '800',
  },
  // Preview modal styles
  previewOverlayRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  previewCloseArea: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  previewCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  previewCounter: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  previewZoomContainer: {
    flex: 1,
  },
  previewPage: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.6,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  previewActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    borderWidth: 2,
  },
  previewKeepActive: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  previewKeepInactive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  previewActionTextActive: {
    color: '#FFFFFF',
  },
});
