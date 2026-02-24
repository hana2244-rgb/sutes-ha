// ============================================================
// 捨てショ - SwipeAllPhotosScreen（全写真スワイプ整理）
// ============================================================

import React, { useState, useRef, useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { theme, glassCard } from '../theme';
import {
  getAllPhotos,
  getPreviewImage,
  getThumbnailURLs,
  deleteAssets,
  isNativeModuleAvailable,
  requestPhotoPermission,
} from '../native/PhotoSimilarityScanner';
import { useAppStore } from '../store';
import type { PhotoAsset } from '../types';
import { SWIPE_PROGRESS_KEY } from '../constants/storageKeys';
import { useRewardedAdContext } from '../ads/RewardedAdContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const PAGE_SIZE = 100;
const PREFETCH_THRESHOLD = 30;
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;
const REVIEW_THUMB_SIZE = (SCREEN_WIDTH - 16 * 2 - 6 * 3) / 4;
const GALLERY_COLUMNS = 4;
const GALLERY_GAP = 2;
const GALLERY_THUMB_SIZE = (SCREEN_WIDTH - GALLERY_GAP * (GALLERY_COLUMNS - 1)) / GALLERY_COLUMNS;

/** スワイプ一覧のキャッシュ（画面離脱時に保存、再表示時に即復元） */
let swipeListCache: { assets: PhotoAsset[]; total: number } | null = null;
/** 削除実行でキャッシュを無効化した直後は、離脱時に上書き保存しない */
let swipeListCacheInvalidated = false;

type Phase = 'swiping' | 'review';
type HistoryEntry = { index: number; action: 'keep' | 'delete' | 'skip' };

// Expo Go 用デモデータ
function getDemoPhotos(): PhotoAsset[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `demo-swipe-${i}`,
    uri: `https://picsum.photos/400/600?random=${i + 100}`,
    creationDate: new Date(2024, 0, 1 + i).toISOString(),
    fileSize: 1024 * 500 + Math.floor(Math.random() * 1024 * 500),
    width: 400,
    height: 600,
  }));
}

export function SwipeAllPhotosScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const addToast = useAppStore((s) => s.addToast);
  const isAdFree = useAppStore((s) => s.isAdFree);
  const rewardedAd = useRewardedAdContext();
  const setHasSeenOnboarding = useAppStore((s) => s.setHasSeenOnboarding);
  const isNative = isNativeModuleAvailable();

  // Phase state
  const [phase, setPhase] = useState<Phase>('swiping');
  const [loading, setLoading] = useState(true);

  // Photo data
  const photosRef = useRef<PhotoAsset[]>([]);
  const totalRef = useRef<number>(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Delete/skip tracking
  const deleteIdsRef = useRef<Set<string>>(new Set());
  const skipIdsRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<HistoryEntry[]>([]);
  const [deleteCount, setDeleteCount] = useState(0);

  // Force re-render trigger (for undo button disabled state, which depends on historyRef)
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  // Preview images (sliding window — keep only nearby URIs to limit memory)
  const previewUrisRef = useRef<Record<string, string>>({});
  const [previewUris, setPreviewUris] = useState<Record<string, string>>({});

  // Review phase thumb URIs
  const [reviewThumbUris, setReviewThumbUris] = useState<Record<string, string>>({});
  const [reviewDeleteIds, setReviewDeleteIds] = useState<string[]>([]);

  // Loading more pages
  const loadingMoreRef = useRef(false);

  // Ref for currentIndex so gesture handler always sees latest (avoid stale closure)
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Reanimated
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Load photos
  const loadPage = useCallback(async (offset: number) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const result = await getAllPhotos(offset, PAGE_SIZE);
      totalRef.current = result.total;
      photosRef.current = [...photosRef.current, ...result.assets];
      forceRender();
    } finally {
      loadingMoreRef.current = false;
    }
  }, []);

  // Load demo data for Expo Go
  const loadDemoData = useCallback(() => {
    const demoPhotos = getDemoPhotos();
    photosRef.current = demoPhotos;
    totalRef.current = demoPhotos.length;
    forceRender();
  }, []);

  // 保存済みの再開位置アセットID（写真ロード後にインデックスを補正するために保持）
  const resumeAssetIdRef = useRef<string | null>(null);

  // Restore progress from AsyncStorage
  const restoreProgress = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(SWIPE_PROGRESS_KEY);
      if (saved) {
        const data = JSON.parse(saved) as {
          currentIndex: number;
          resumeAssetId?: string;
          deleteIds: string[];
          skipIds: string[];
        };
        setCurrentIndex(data.currentIndex);
        resumeAssetIdRef.current = data.resumeAssetId ?? null;
        deleteIdsRef.current = new Set(data.deleteIds);
        skipIdsRef.current = new Set(data.skipIds);
        setDeleteCount(data.deleteIds.length);
        return data.currentIndex;
      }
    } catch {}
    return 0;
  }, []);

  // Save progress to AsyncStorage
  const saveProgress = useCallback(async () => {
    try {
      // 現在位置の写真IDを保存（削除後にリストが変わってもIDで位置を特定できるようにする）
      const resumeAsset = photosRef.current[currentIndexRef.current];
      const data = {
        currentIndex: currentIndexRef.current,
        resumeAssetId: resumeAsset?.id ?? undefined,
        deleteIds: Array.from(deleteIdsRef.current),
        skipIds: Array.from(skipIdsRef.current),
      };
      await AsyncStorage.setItem(SWIPE_PROGRESS_KEY, JSON.stringify(data));
    } catch {}
  }, []);

  // Clear saved progress
  const clearProgress = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SWIPE_PROGRESS_KEY);
    } catch {}
  }, []);

  // Initial load（キャッシュがあれば即表示、なければ Native から取得）
  useEffect(() => {
    (async () => {
      if (!isNative) {
        loadDemoData();
        setLoading(false);
        return;
      }
      const perm = await requestPhotoPermission();
      if (perm === 'denied') {
        addToast({ emoji: '🚫', text: t('scanner.permissionDenied') });
        navigation.goBack();
        return;
      }
      // キャッシュがあれば即復元して表示
      if (swipeListCache && swipeListCache.assets.length > 0) {
        photosRef.current = [...swipeListCache.assets];
        totalRef.current = swipeListCache.total;
        await restoreProgress();
        // アセットIDでインデックスを補正（削除後のリスト変更に対応）
        if (resumeAssetIdRef.current) {
          const corrected = photosRef.current.findIndex((p) => p.id === resumeAssetIdRef.current);
          if (corrected >= 0 && corrected !== currentIndexRef.current) {
            setCurrentIndex(corrected);
          }
          resumeAssetIdRef.current = null;
        }
        forceRender();
        setLoading(false);
        return;
      }
      const resumeIndex = await restoreProgress();
      const pagesNeeded = Math.max(1, Math.ceil((resumeIndex + PAGE_SIZE) / PAGE_SIZE));
      for (let i = 0; i < pagesNeeded; i++) {
        await loadPage(i * PAGE_SIZE);
      }
      // アセットIDでインデックスを補正（削除後のリスト変更に対応）
      if (resumeAssetIdRef.current) {
        const corrected = photosRef.current.findIndex((p) => p.id === resumeAssetIdRef.current);
        if (corrected >= 0) {
          setCurrentIndex(corrected);
          currentIndexRef.current = corrected;
        }
        resumeAssetIdRef.current = null;
      }
      if (photosRef.current.length > 0) {
        swipeListCache = { assets: [...photosRef.current], total: totalRef.current };
      }
      setLoading(false);
    })();
  }, []);

  // 画面離脱時に一覧をキャッシュ（削除で無効化した直後は保存しない）
  useEffect(() => {
    return () => {
      if (swipeListCacheInvalidated) {
        swipeListCacheInvalidated = false;
        return;
      }
      if (isNative && photosRef.current.length > 0) {
        swipeListCache = { assets: [...photosRef.current], total: totalRef.current };
      }
    };
  }, [isNative]);

  // Prefetch next pages when approaching the end
  useEffect(() => {
    if (loading || !isNative) return;
    const remaining = photosRef.current.length - currentIndex;
    if (remaining <= PREFETCH_THRESHOLD && photosRef.current.length < totalRef.current) {
      loadPage(photosRef.current.length);
    }
  }, [currentIndex, loading]);

  // Preload preview images with sliding window (keep ±5 around current index)
  const PREVIEW_WINDOW = 5;
  useEffect(() => {
    if (phase !== 'swiping' || loading || !isNative) return;
    const photos = photosRef.current;

    // IDs to keep in cache (current index ± PREVIEW_WINDOW)
    const keepIds = new Set<string>();
    for (let i = Math.max(0, currentIndex - 1); i <= Math.min(photos.length - 1, currentIndex + PREVIEW_WINDOW); i++) {
      if (photos[i]) keepIds.add(photos[i].id);
    }

    // Evict old entries outside the window
    const cached = previewUrisRef.current;
    let evicted = false;
    for (const id of Object.keys(cached)) {
      if (!keepIds.has(id)) {
        delete cached[id];
        evicted = true;
      }
    }

    // Preload current + next few
    const toLoad: { id: string }[] = [];
    for (let i = currentIndex; i <= Math.min(photos.length - 1, currentIndex + 2); i++) {
      const photo = photos[i];
      if (photo && !cached[photo.id]) {
        toLoad.push(photo);
      }
    }

    if (toLoad.length === 0 && evicted) {
      setPreviewUris({ ...cached });
      return;
    }

    (async () => {
      const results = await Promise.all(toLoad.map((photo) => getPreviewImage(photo.id)));
      toLoad.forEach((photo, i) => {
        const uri = results[i];
        if (uri) previewUrisRef.current[photo.id] = uri;
      });
      setPreviewUris({ ...previewUrisRef.current });
    })();
  }, [currentIndex, phase, loading, isNative]);

  // Enter review phase
  const enterReview = useCallback(() => {
    const ids = Array.from(deleteIdsRef.current);
    setReviewDeleteIds(ids);
    setPhase('review');
    // サムネイルを早く見せる: 最小の先行バッチ → 続けて並列バッチを多めに
    if (isNative && ids.length > 0) {
      const FIRST_BATCH = 12;
      const BATCH_SIZE = 32;
      const PARALLEL_BATCHES = 5;
      const thumbSize = Math.round(REVIEW_THUMB_SIZE * 3);
      (async () => {
        try {
          const first = ids.slice(0, FIRST_BATCH);
          const firstThumbs = await getThumbnailURLs(first, thumbSize, thumbSize);
          setReviewThumbUris((prev) => ({ ...prev, ...firstThumbs }));
          for (let i = FIRST_BATCH; i < ids.length; i += BATCH_SIZE * PARALLEL_BATCHES) {
            const promises: Promise<Record<string, string>>[] = [];
            for (let j = 0; j < PARALLEL_BATCHES; j++) {
              const start = i + j * BATCH_SIZE;
              if (start >= ids.length) break;
            const batch = ids.slice(start, start + BATCH_SIZE);
            promises.push(getThumbnailURLs(batch, thumbSize, thumbSize));
            }
            const results = await Promise.all(promises);
            const merged = Object.assign({}, ...results);
            if (Object.keys(merged).length > 0) {
              setReviewThumbUris((prev) => ({ ...prev, ...merged }));
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[SwipeAll] thumb batch failed', e);
        }
      })();
    }
  }, [isNative]);

  // Move to next photo (uses ref so runOnJS from gesture always has latest index)
  const goNext = useCallback((action: 'keep' | 'delete' | 'skip') => {
    const idx = currentIndexRef.current;
    const asset = photosRef.current[idx];
    if (!asset) return;

    historyRef.current.push({ index: idx, action });

    if (action === 'delete') {
      deleteIdsRef.current.add(asset.id);
      setDeleteCount(deleteIdsRef.current.size);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (action === 'skip') {
      skipIdsRef.current.add(asset.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const nextIndex = idx + 1;
    const isAllDone = nextIndex >= totalRef.current;

    if (isAllDone) {
      enterReview();
    } else if (nextIndex >= photosRef.current.length) {
      // 次ページがまだ読み込まれていない → ロード完了後にインデックスを進める（先に進めると undefined 参照でクラッシュ）
      const offset = photosRef.current.length;
      loadPage(offset).then(() => {
        setCurrentIndex(nextIndex);
        requestAnimationFrame(() => {
          translateX.value = 0;
          translateY.value = 0;
          scale.value = 1;
          savedScale.value = 1;
        });
        forceRender();
      });
    } else {
      setCurrentIndex(nextIndex);
      requestAnimationFrame(() => {
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 1;
        savedScale.value = 1;
      });
    }
    forceRender();
  }, [enterReview, loadPage]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const entry = historyRef.current.pop()!;
    const asset = photosRef.current[entry.index];
    if (entry.action === 'delete') {
      deleteIdsRef.current.delete(asset.id);
      setDeleteCount(deleteIdsRef.current.size);
    } else if (entry.action === 'skip') {
      skipIdsRef.current.delete(asset.id);
    }
    setCurrentIndex(entry.index);
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    savedScale.value = 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    forceRender();
  }, []);

  // Swipe complete handler
  const handleSwipeComplete = useCallback(
    (direction: 'left' | 'right') => {
      goNext(direction === 'right' ? 'keep' : 'delete');
    },
    [goNext]
  );

  // Gestures
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        const offscreenX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        translateX.value = withTiming(offscreenX, { duration: 200 }, () => {
          runOnJS(handleSwipeComplete)(direction);
        });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(4, Math.max(1, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const keepLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const discardLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    return {
      transform: [
        { scale: interpolate(progress, [0, 1], [0.92, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(progress, [0, 1], [0.5, 1], Extrapolation.CLAMP),
    };
  });

  // Handle "here for now" button
  const handleFinishForNow = useCallback(async () => {
    await saveProgress();
    if (deleteIdsRef.current.size === 0) {
      setHasSeenOnboarding(false);
      return;
    }
    enterReview();
  }, [enterReview, saveProgress, setHasSeenOnboarding]);

  // Gallery modal
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryThumbUris, setGalleryThumbUris] = useState<Record<string, string>>({});
  const galleryListRef = useRef<FlatList>(null);

  const handleOpenGallery = useCallback(() => {
    setGalleryVisible(true);
    if (!isNative) return;

    (async () => {
      const GALLERY_FIRST_BATCH = 24;
      const GALLERY_BATCH_SIZE = 60;
      const GALLERY_PARALLEL = 5;
      const galleryThumbSize = Math.round(GALLERY_THUMB_SIZE * 3);

      while (photosRef.current.length < totalRef.current) {
        if (loadingMoreRef.current) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        await loadPage(photosRef.current.length);
      }

      const photos = photosRef.current;
      const photoIds = photos.map((p) => p.id);
      try {
        const first = photoIds.slice(0, GALLERY_FIRST_BATCH);
        const firstThumbs = await getThumbnailURLs(first, galleryThumbSize, galleryThumbSize);
        setGalleryThumbUris((prev) => ({ ...prev, ...firstThumbs }));
        for (let i = GALLERY_FIRST_BATCH; i < photoIds.length; i += GALLERY_BATCH_SIZE * GALLERY_PARALLEL) {
          const promises: Promise<Record<string, string>>[] = [];
          for (let j = 0; j < GALLERY_PARALLEL; j++) {
            const start = i + j * GALLERY_BATCH_SIZE;
            if (start >= photoIds.length) break;
            const batch = photoIds.slice(start, start + GALLERY_BATCH_SIZE);
            promises.push(getThumbnailURLs(batch, galleryThumbSize, galleryThumbSize));
          }
          const results = await Promise.all(promises);
          const merged = Object.assign({}, ...results);
          if (Object.keys(merged).length > 0) {
            setGalleryThumbUris((prev) => ({ ...prev, ...merged }));
          }
        }
      } catch {}
    })();

    // Scroll to current position after modal opens
    setTimeout(() => {
      const row = Math.floor(currentIndexRef.current / GALLERY_COLUMNS);
      galleryListRef.current?.scrollToOffset({ offset: row * (GALLERY_THUMB_SIZE + GALLERY_GAP), animated: false });
    }, 100);
  }, [isNative, loadPage]);

  const handleGalleryJump = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentIndex(index);
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    savedScale.value = 1;
    setGalleryVisible(false);
    // If we were in review, go back to swiping
    if (phase === 'review') {
      deleteIdsRef.current = new Set(reviewDeleteIds);
      setDeleteCount(reviewDeleteIds.length);
      setPhase('swiping');
    }
    forceRender();
  }, [phase, reviewDeleteIds]);

  // Review phase: toggle item
  const handleReviewToggle = useCallback((assetId: string) => {
    setReviewDeleteIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      return [...prev, assetId];
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Review phase: go back to swiping
  const handleBackToSwiping = useCallback(() => {
    // Sync toggled items back to deleteIdsRef
    deleteIdsRef.current = new Set(reviewDeleteIds);
    setDeleteCount(reviewDeleteIds.length);
    setPhase('swiping');
  }, [reviewDeleteIds]);

  // Review phase: keep all and exit to onboarding
  const handleKeepAllAndExit = useCallback(async () => {
    deleteIdsRef.current.clear();
    setDeleteCount(0);
    await saveProgress();
    setHasSeenOnboarding(false);
  }, [saveProgress, setHasSeenOnboarding]);

  // Review phase: delete
  const handleDelete = useCallback(() => {
    if (reviewDeleteIds.length === 0) return;

    const totalBytes = reviewDeleteIds.reduce((sum, id) => {
      const photo = photosRef.current.find((p) => p.id === id);
      return sum + (photo?.fileSize ?? 0);
    }, 0);
    const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);

    // 削除実行（広告視聴後に呼ばれる）
    const executeDelete = async () => {
      try {
        const result = await deleteAssets(reviewDeleteIds);
        if (result.success) {
          const freedMB = (result.freedBytes / (1024 * 1024)).toFixed(1);
          addToast({
            emoji: '🎉',
            text: t('swipe.deleteSuccess', { count: result.deletedCount }),
            subtext: t('swipe.deleteFreed', { size: freedMB }),
            duration: 3000,
          });
          swipeListCache = null;
          swipeListCacheInvalidated = true;
          // 削除済み・スキップ済みをクリアし、現在位置を保存して次回続きから再開できるようにする
          deleteIdsRef.current.clear();
          skipIdsRef.current.clear();
          setDeleteCount(0);
          await saveProgress();
          setHasSeenOnboarding(false);
          return;
        }
        addToast({ emoji: '❌', text: t('scanner.deleteFailed'), subtext: result.error });
        return;
      } catch (e) {
        if (__DEV__) console.error('[SwipeAll] delete failed', e);
        addToast({ emoji: '❌', text: t('scanner.deleteError') });
        return;
      }
    };

    const deleteButtonText =
      isAdFree || !rewardedAd ? t('common.delete') : t('swipe.deleteAdButton');

    Alert.alert(
      t('swipe.deleteTitle', { count: reviewDeleteIds.length }),
      t('swipe.deleteMessage', { size: sizeMB }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: deleteButtonText,
          style: 'destructive',
          onPress: async () => {
            if (!isNative) {
              addToast({ emoji: '📱', text: t('swipe.expoGoNoDelete') });
              await clearProgress();
              navigation.goBack();
              return;
            }
            if (isAdFree || !rewardedAd) {
              await executeDelete();
              return;
            }
            // リワード広告を表示し、視聴完了後にのみ削除を実行
            const earned = await rewardedAd.requestShowRewardedAd();
            if (!earned) {
              addToast({
                emoji: '📺',
                text: t('scan.watchAdToDelete'),
              });
              return;
            }
            await executeDelete();
          },
        },
      ]
    );
  }, [reviewDeleteIds, isNative, isAdFree, addToast, clearProgress, setHasSeenOnboarding, navigation, rewardedAd, t]);

  // Estimated total bytes for delete candidates
  const reviewTotalBytes = useMemo(() => {
    return reviewDeleteIds.reduce((sum, id) => {
      const photo = photosRef.current.find((p) => p.id === id);
      return sum + (photo?.fileSize ?? 0);
    }, 0);
  }, [reviewDeleteIds]);

  // Transition to review when all photos swiped (hook must be before early returns)
  useEffect(() => {
    if (!loading && totalRef.current > 0 && currentIndex >= totalRef.current && deleteIdsRef.current.size > 0) {
      enterReview();
    }
  }, [currentIndex, loading, enterReview]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>{t('swipe.loading')}</Text>
        </View>
      </View>
    );
  }

  // No photos
  if (totalRef.current === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.closeBtn} />
          <Text style={styles.headerTitle}>{t('swipe.headerTitle')}</Text>
          <View style={styles.closeBtn} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>{t('swipe.noPhotos')}</Text>
        </View>
      </View>
    );
  }

  // ========== Review Phase ==========
  if (phase === 'review') {
    const reviewPhotos = photosRef.current.filter((p) => deleteIdsRef.current.has(p.id));

    const renderReviewItem = ({ item }: { item: PhotoAsset }) => {
      const isStillDeleting = reviewDeleteIds.includes(item.id);
      const thumbUri = reviewThumbUris[item.id] ?? item.uri;
      return (
        <TouchableOpacity
          onPress={() => handleReviewToggle(item.id)}
          activeOpacity={0.7}
          style={styles.reviewThumbWrap}
        >
          <Image
            source={{ uri: thumbUri }}
            style={[
              styles.reviewThumb,
              !isStillDeleting && styles.reviewThumbRestored,
            ]}
          />
          {!isStillDeleting && (
            <View style={styles.reviewRestoredBadge}>
              <Text style={styles.reviewRestoredBadgeText}>{t('common.keep')}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToSwiping} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('swipe.deleteHeader')}</Text>
          <View style={styles.closeBtn} />
        </View>

        <Animated.View entering={FadeIn.duration(300)} style={styles.reviewStats}>
          <Text style={styles.reviewStatsText}>
            {t('swipe.reviewDeleteCount', { count: reviewDeleteIds.length })}
          </Text>
          <Text style={styles.reviewStatsSubtext}>
            {t('swipe.reviewFreeSpace', { size: (reviewTotalBytes / (1024 * 1024)).toFixed(1) })}
          </Text>
          <Text style={styles.reviewHint}>
            {t('swipe.reviewHint')}
          </Text>
        </Animated.View>

        <FlatList
          data={reviewPhotos}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={[
            styles.reviewGrid,
            { paddingBottom: insets.bottom + 80 },
          ]}
          columnWrapperStyle={styles.reviewRow}
        />

        {reviewDeleteIds.length > 0 ? (
          <TouchableOpacity
            style={[styles.deleteFab, { bottom: insets.bottom + 16 }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteFabText}>
              {t('swipe.reviewDeleteButton', { count: reviewDeleteIds.length })}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.keepAllFab, { bottom: insets.bottom + 16 }]}
            onPress={handleKeepAllAndExit}
            activeOpacity={0.7}
          >
            <Text style={styles.keepAllFabText}>
              {t('swipe.keepAllAndExit')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ========== Swiping Phase ==========
  const currentAsset = photosRef.current[currentIndex];
  const currentUri = currentAsset
    ? (previewUris[currentAsset.id] ?? currentAsset.uri)
    : null;
  const nextAsset = photosRef.current[currentIndex + 1] ?? null;
  const nextUri = nextAsset
    ? (previewUris[nextAsset.id] ?? nextAsset.uri)
    : null;

  const isFinished = currentIndex >= totalRef.current || !currentAsset;

  if (isFinished) {
    if (deleteIdsRef.current.size > 0) {
      return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={styles.closeBtn} />
            <Text style={styles.headerTitle}>{t('swipe.headerTitle')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>{t('swipe.preparingReview')}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.closeBtn} />
          <Text style={styles.headerTitle}>{t('swipe.headerTitle')}</Text>
          <View style={styles.closeBtn} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyText}>{t('swipe.allReviewed')}</Text>
          <Text style={styles.emptySubtext}>{t('swipe.noCandidates')}</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.closeBtn} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerCounter}>
            {currentIndex + 1} / {totalRef.current.toLocaleString()}
          </Text>
          {deleteCount > 0 && (
            <Text style={styles.headerDeleteCount}>
              {t('swipe.deleteCount', { count: deleteCount })}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleOpenGallery} style={styles.galleryPill}>
          <Text style={styles.galleryPillText}>⊞ {t('swipe.gallery')}</Text>
        </TouchableOpacity>
      </View>

      {/* Card Area */}
      <View style={styles.cardArea}>
        {/* Next card (behind) */}
        {nextAsset && nextUri && (
          <Animated.View style={[styles.nextCard, nextCardStyle]}>
            <Image
              source={{ uri: nextUri }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        {/* Current card */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.currentCard, cardAnimatedStyle]}>
            {currentUri && (
              <Image
                source={{ uri: currentUri }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            )}

            {/* Keep label */}
            <Animated.View style={[styles.keepLabel, keepLabelStyle]}>
              <Text style={styles.keepLabelText}>{t('common.keep')}</Text>
            </Animated.View>

            {/* Discard label */}
            <Animated.View style={[styles.discardLabel, discardLabelStyle]}>
              <Text style={styles.discardLabelText}>{t('common.discard')}</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Bottom Controls */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.bottomBtn, styles.bottomBtnUndo]}
            onPress={handleUndo}
            disabled={historyRef.current.length === 0}
          >
            <Text style={[
              styles.bottomBtnText,
              historyRef.current.length === 0 && styles.bottomBtnTextDisabled,
            ]}>
              {t('swipe.undo')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomBtn, styles.bottomBtnSkip]}
            onPress={() => goNext('skip')}
          >
            <Text style={styles.bottomBtnText}>{t('swipe.skip')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomBtn, styles.bottomBtnFinish]}
            onPress={handleFinishForNow}
          >
            <Text style={styles.bottomBtnFinishText}>{t('swipe.finishHere')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomHintRow}>
          <View style={styles.hintItem}>
            <Text style={styles.hintArrow}>←</Text>
            <Text style={styles.hintTextDiscard}>{t('common.discard')}</Text>
          </View>
          <View style={styles.hintDivider} />
          <View style={styles.hintItem}>
            <Text style={styles.hintTextKeep}>{t('common.keep')}</Text>
            <Text style={styles.hintArrow}>→</Text>
          </View>
        </View>
      </View>

      {/* Gallery Modal */}
      <Modal
        visible={galleryVisible}
        animationType="slide"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={[styles.galleryContainer, { paddingTop: insets.top }]}>
          <View style={styles.galleryHeader}>
            <TouchableOpacity onPress={() => setGalleryVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('swipe.galleryTitle')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <FlatList
            ref={galleryListRef}
            data={photosRef.current}
            numColumns={GALLERY_COLUMNS}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: GALLERY_THUMB_SIZE + GALLERY_GAP,
              offset: (GALLERY_THUMB_SIZE + GALLERY_GAP) * Math.floor(index / GALLERY_COLUMNS),
              index,
            })}
            renderItem={({ item, index }) => {
              const isDeleted = deleteIdsRef.current.has(item.id);
              const isSkipped = skipIdsRef.current.has(item.id);
              const isReviewed = index < currentIndexRef.current;
              const isKept = isReviewed && !isDeleted && !isSkipped;
              const isCurrent = index === currentIndexRef.current;
              const thumbUri = galleryThumbUris[item.id];

              return (
                <TouchableOpacity
                  onPress={() => handleGalleryJump(index)}
                  activeOpacity={0.7}
                  style={[
                    styles.galleryThumb,
                    isReviewed && isKept && styles.galleryThumbKeep,
                    isReviewed && isDeleted && styles.galleryThumbDelete,
                    isCurrent && styles.galleryThumbCurrent,
                  ]}
                >
                  {thumbUri ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={styles.galleryThumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.galleryThumbImage, styles.galleryThumbPlaceholder]}>
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                  )}
                  {isReviewed && isDeleted && (
                    <View style={styles.galleryDeleteOverlay}>
                      <Text style={styles.galleryDeleteIcon}>✕</Text>
                    </View>
                  )}
                  {isCurrent && (
                    <View style={styles.galleryCurrentBadge}>
                      <Text style={styles.galleryCurrentBadgeText}>{t('swipe.galleryJumpHere')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            columnWrapperStyle={{ gap: GALLERY_GAP }}
            ItemSeparatorComponent={GallerySeparator}
          />
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const GallerySeparator = () => <View style={{ height: GALLERY_GAP }} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(45, 48, 71, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerCounter: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  headerDeleteCount: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: 2,
  },

  // Card Area
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextCard: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(45, 48, 71, 0.06)',
  },
  currentCard: {
    ...glassCard,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  keepLabel: {
    position: 'absolute',
    top: 24,
    left: 20,
    borderWidth: 3,
    borderColor: theme.colors.success,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(140, 197, 162, 0.2)',
    transform: [{ rotate: '-15deg' }],
  },
  keepLabelText: {
    ...theme.typography.heading,
    color: theme.colors.success,
    fontWeight: '800',
  },
  discardLabel: {
    position: 'absolute',
    top: 24,
    right: 20,
    borderWidth: 3,
    borderColor: theme.colors.danger,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(242, 145, 138, 0.2)',
    transform: [{ rotate: '15deg' }],
  },
  discardLabelText: {
    ...theme.typography.heading,
    color: theme.colors.danger,
    fontWeight: '800',
  },

  // Bottom Area
  bottomArea: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  bottomBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  bottomBtnUndo: {},
  bottomBtnSkip: {},
  bottomBtnFinish: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  bottomBtnText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  bottomBtnTextDisabled: {
    opacity: 0.3,
  },
  bottomBtnFinishText: {
    ...theme.typography.caption,
    color: theme.colors.accentDeep,
    fontWeight: '700',
  },
  bottomHintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintArrow: {
    ...theme.typography.subheading,
    color: theme.colors.textTertiary,
  },
  hintTextKeep: {
    ...theme.typography.body,
    color: theme.colors.success,
  },
  hintTextDiscard: {
    ...theme.typography.body,
    color: theme.colors.danger,
  },
  hintDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },

  // Review Phase
  reviewStats: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  reviewStatsText: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
  },
  reviewStatsSubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  reviewHint: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  reviewGrid: {
    paddingHorizontal: 16,
  },
  reviewRow: {
    gap: 6,
    marginBottom: 6,
  },
  reviewThumbWrap: {
    width: REVIEW_THUMB_SIZE,
    height: REVIEW_THUMB_SIZE,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  reviewThumb: {
    width: '100%',
    height: '100%',
  },
  reviewThumbRestored: {
    opacity: 0.4,
  },
  reviewRestoredBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(140, 197, 162, 0.85)',
    borderRadius: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  reviewRestoredBadgeText: {
    ...theme.typography.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deleteFab: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: theme.colors.danger,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    ...theme.shadow.bubble,
    shadowColor: '#F2918A',
  },
  deleteFabText: {
    ...theme.typography.subheading,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  keepAllFab: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: theme.colors.accentSoft,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  keepAllFabText: {
    ...theme.typography.subheading,
    color: theme.colors.accentDeep,
    fontWeight: '700',
  },

  // Gallery pill button
  galleryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  galleryPillText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },

  // Gallery modal
  galleryContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  galleryThumb: {
    width: GALLERY_THUMB_SIZE,
    height: GALLERY_THUMB_SIZE,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  galleryThumbKeep: {
    borderColor: theme.colors.success,
    borderWidth: 2,
  },
  galleryThumbDelete: {
    opacity: 0.5,
  },
  galleryThumbCurrent: {
    borderColor: theme.colors.accent,
    borderWidth: 3,
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  galleryThumbPlaceholder: {
    backgroundColor: theme.colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryDeleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(223, 230, 246, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryDeleteIcon: {
    color: theme.colors.danger,
    fontSize: 20,
    fontWeight: '800',
  },
  galleryCurrentBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(126, 181, 245, 0.9)',
    borderRadius: 3,
    paddingVertical: 2,
    alignItems: 'center',
  },
  galleryCurrentBadgeText: {
    ...theme.typography.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 9,
  },
});
