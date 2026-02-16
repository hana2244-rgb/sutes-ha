// ============================================================
// 捨て写 - ScanScreen (Main Screen)（ソーダグラス）
// ============================================================

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeIn,
  SlideInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, glassCard } from '../theme';
import { usePhotoScanner } from '../hooks/usePhotoScanner';
import { useAppStore } from '../store';
import { isNativeModuleAvailable, saveCurrentState } from '../native/PhotoSimilarityScanner';
import {
  ProgressBar,
  SimilaritySlider,
  PhotoGroupCard,
  ActionButton,
  ThermalBanner,
} from '../components';
import type { SimilarGroup, PhotoAsset } from '../types';
import { RESUME_FROM_GROUP_INDEX_KEY, HIDDEN_FULLY_KEPT_GROUP_IDS_KEY } from '../constants/storageKeys';
import { useRewardedAdContext } from '../ads/RewardedAdContext';

/** Expo Go 用デモデータ（プレースホルダー画像で類似グループを再現） */
function getDemoGroups(): SimilarGroup[] {
  const base = 'https://picsum.photos/300/300';
  const makeAsset = (id: string, seed: number): PhotoAsset => ({
    id,
    uri: `${base}?random=${seed}`,
    creationDate: new Date().toISOString(),
    fileSize: 1024 * 800,
    width: 300,
    height: 300,
  });
  return [
    {
      id: 'demo-group-1',
      assets: [
        makeAsset('demo-1-a', 1),
        makeAsset('demo-1-b', 2),
        makeAsset('demo-1-c', 3),
      ],
      keepAssetIds: [],
      maxSimilarity: 0.28,
    },
    {
      id: 'demo-group-2',
      assets: [
        makeAsset('demo-2-a', 10),
        makeAsset('demo-2-b', 11),
        makeAsset('demo-2-c', 12),
      ],
      keepAssetIds: [],
      maxSimilarity: 0.31,
    },
  ];
}

type ScanScreenRouteProp = NativeStackScreenProps<RootStackParamList, 'Scan'>['route'];

export function ScanScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ScanScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    scanState,
    scanProgress,
    similarityLevel,
    groups,
    thermalLevel,
    startScan,
    pauseScan,
    resumeScan,
    changeSimilarityLevel,
    deleteAssets,
    clearCache,
    checkPartialScan,
    getPhotoCount,
  } = usePhotoScanner();

  const hasPartialScan = useAppStore((s) => s.hasPartialScan);
  const setGroups = useAppStore((s) => s.setGroups);
  const setScanState = useAppStore((s) => s.setScanState);
  const setHasSeenOnboarding = useAppStore((s) => s.setHasSeenOnboarding);
  const addToast = useAppStore((s) => s.addToast);
  const toggleKeepAsset = useAppStore((s) => s.toggleKeepAsset);
  const rewardedAd = useRewardedAdContext();
  const [photoCount, setPhotoCount] = useState<number>(0);

  // Min group size filter
  const [minGroupSize, setMinGroupSize] = useState(2);

  // グループ削除後に非表示にするグループIDセット
  const [dismissedGroupIds, setDismissedGroupIds] = useState<Set<string>>(new Set());
  // グループ内すべて「残す」選択済み → 次回から非表示（永続化）
  const [hiddenFullyKeptGroupIds, setHiddenFullyKeptGroupIds] = useState<Set<string>>(new Set());
  const [hasLoadedHiddenIds, setHasLoadedHiddenIds] = useState(false);

  const filteredGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (g.assets.length < minGroupSize) return false;
        if (dismissedGroupIds.has(g.id)) return false;
        if (hiddenFullyKeptGroupIds.has(g.id)) return false;
        return true;
      }),
    [groups, minGroupSize, dismissedGroupIds, hiddenFullyKeptGroupIds]
  );

  const listRef = useRef<FlatList>(null);
  const firstVisibleIndexRef = useRef<number>(0);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      t('scan.clearCacheTitle'),
      t('scan.clearCacheMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('scan.clearCacheButton'),
          style: 'destructive',
          onPress: clearCache,
        },
      ]
    );
  }, [clearCache]);

  const handleShowDemoData = useCallback(() => {
    setGroups(getDemoGroups());
    setScanState('completed');
  }, [setGroups, setScanState]);

  const initialActionConsumed = useRef(false);

  useEffect(() => {
    (async () => {
      const count = await getPhotoCount();
      setPhotoCount(count);
      await checkPartialScan();
    })();
  }, []);

  // 永続化済み「すべて残す」グループIDを読み込み
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HIDDEN_FULLY_KEPT_GROUP_IDS_KEY);
        if (cancelled) return;
        if (raw != null) {
          const arr = JSON.parse(raw) as string[];
          if (Array.isArray(arr)) setHiddenFullyKeptGroupIds(new Set(arr));
        }
      } catch {
        // 初回 or 不正値は無視
      } finally {
        if (!cancelled) setHasLoadedHiddenIds(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      getPhotoCount().then(setPhotoCount);
    }, [getPhotoCount])
  );

  useEffect(() => {
    if (initialActionConsumed.current) return;
    const action = route.params?.initialAction;
    if (!action) return;
    initialActionConsumed.current = true;
    if (action === 'swipe') {
      navigation.navigate('SwipeAllPhotos');
    } else if (action === 'scan') {
      startScan();
    }
  }, [route.params?.initialAction]);

  const totalDeletable = filteredGroups.reduce((sum, g) => {
    if (g.keepAssetIds.length === 0) return sum;
    return (
      sum +
      g.assets
        .filter((a) => !g.keepAssetIds.includes(a.id))
        .reduce((s, a) => s + a.fileSize, 0)
    );
  }, 0);

  const totalDeletableCount = filteredGroups.reduce((sum, g) => {
    if (g.keepAssetIds.length === 0) return sum;
    return sum + g.assets.filter((a) => !g.keepAssetIds.includes(a.id)).length;
  }, 0);

  const handleGroupDelete = useCallback(
    async (assetIds: string[]) => {
      const result = await deleteAssets(assetIds);
      if (result?.success) {
        const count = await getPhotoCount();
        setPhotoCount(count);
        // 削除後、全写真に判定済み（残す or 削除）のグループを非表示にする
        const currentGroups = useAppStore.getState().groups;
        const toDismiss: string[] = [];
        for (const g of currentGroups) {
          if (g.assets.length === 0) continue;
          // 残っている全写真がkeepAssetIdsに含まれている = 全写真に判定済み
          const allDecided = g.assets.every((a) => g.keepAssetIds.includes(a.id));
          if (allDecided) toDismiss.push(g.id);
        }
        if (toDismiss.length > 0) {
          setDismissedGroupIds((prev) => {
            const next = new Set(prev);
            toDismiss.forEach((id) => next.add(id));
            return next;
          });
        }
      }
    },
    [deleteAssets, getPhotoCount]
  );

  const handleDeleteAll = useCallback(() => {
    // 全写真が残す選択済みのグループも含めて、削除対象IDと完了グループIDを収集
    const allDeletableIds: string[] = [];
    const allDecidedGroupIds: string[] = [];

    for (const g of filteredGroups) {
      if (g.keepAssetIds.length === 0) continue; // 未選択グループはスキップ
      const deletable = g.assets.filter((a) => !g.keepAssetIds.includes(a.id));
      allDeletableIds.push(...deletable.map((a) => a.id));
      // 全写真に判定がある（keepAssetIds.length === assets.length）なら完了グループ
      if (g.keepAssetIds.length === g.assets.length) {
        allDecidedGroupIds.push(g.id);
      }
    }

    // 削除対象がなくても、全写真が残す選択済みのグループがある場合は非表示にする
    if (allDeletableIds.length === 0 && allDecidedGroupIds.length > 0) {
      setDismissedGroupIds((prev) => {
        const next = new Set(prev);
        allDecidedGroupIds.forEach((id) => next.add(id));
        return next;
      });
      return;
    }

    if (allDeletableIds.length === 0) return;

    const sizeMB = (totalDeletable / (1024 * 1024)).toFixed(1);
    const deleteMessage = rewardedAd
      ? `${t('scan.batchDeleteMessage', { size: sizeMB })}\n\n${t('scan.batchDeleteAdNote')}`
      : t('scan.batchDeleteMessage', { size: sizeMB });
    Alert.alert(
      t('scan.batchDeleteTitle', { count: allDeletableIds.length }),
      deleteMessage,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            // リワード広告を表示し、視聴完了後にのみ削除を実行
            const earned = rewardedAd
              ? await rewardedAd.requestShowRewardedAd()
              : true;
            if (!earned) {
              addToast({
                emoji: '📺',
                text: t('scan.watchAdToDelete'),
              });
              return;
            }
            const result = await deleteAssets(allDeletableIds);
            if (result?.success) {
              const count = await getPhotoCount();
              setPhotoCount(count);
              // 削除後、全写真に判定済みのグループを非表示にする
              const currentGroups = useAppStore.getState().groups;
              const toDismiss: string[] = [];
              for (const g of currentGroups) {
                if (g.assets.length === 0) continue;
                const allDecided = g.assets.every((a) => g.keepAssetIds.includes(a.id));
                if (allDecided) toDismiss.push(g.id);
              }
              if (toDismiss.length > 0) {
                setDismissedGroupIds((prev) => {
                  const next = new Set(prev);
                  toDismiss.forEach((id) => next.add(id));
                  return next;
                });
              }
            }
          },
        },
      ]
    );
  }, [filteredGroups, totalDeletable, deleteAssets, rewardedAd, addToast, t]);

  const handleKeepToggle = useCallback(
    (groupId: string, assetId: string) => {
      toggleKeepAsset(groupId, assetId);
    },
    [toggleKeepAsset]
  );

  const keyExtractor = useCallback((item: SimilarGroup) => item.id, []);

  const handleSaveTodayProgress = useCallback(() => {
    Alert.alert(
      t('scan.todayDoneDialogTitle'),
      t('scan.todayDoneDialogMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            const index = firstVisibleIndexRef.current;
            try {
              await AsyncStorage.setItem(RESUME_FROM_GROUP_INDEX_KEY, String(index));
              await saveCurrentState();

              const allKeptIds = groups
                .filter(
                  (g) =>
                    g.assets.length >= 2 &&
                    g.keepAssetIds.length === g.assets.length
                )
                .map((g) => g.id);
              if (allKeptIds.length > 0) {
                const merged = new Set([
                  ...hiddenFullyKeptGroupIds,
                  ...allKeptIds,
                ]);
                await AsyncStorage.setItem(
                  HIDDEN_FULLY_KEPT_GROUP_IDS_KEY,
                  JSON.stringify([...merged])
                );
              }

              setHasSeenOnboarding(false);
            } catch (e) {
              console.warn('[ScanScreen] save resume index failed', e);
            }
          },
        },
      ]
    );
  }, [groups, hiddenFullyKeptGroupIds, setHasSeenOnboarding, t]);

  // 位置復元: 保存済みインデックスを filtered リスト長でキャップしてスクロール（隠しID読み込み後）
  useEffect(() => {
    if (!hasLoadedHiddenIds || scanState === 'scanning' || groups.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(RESUME_FROM_GROUP_INDEX_KEY);
        if (cancelled || saved == null) return;
        const maxIndex = Math.max(
          0,
          filteredGroups.length - 1
        );
        const index = Math.min(Math.max(0, parseInt(saved, 10)), maxIndex);
        await AsyncStorage.removeItem(RESUME_FROM_GROUP_INDEX_KEY);
        if (cancelled) return;
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
        }, 300);
      } catch (e) {
        if (!cancelled) console.warn('[ScanScreen] restore resume index failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLoadedHiddenIds, groups.length, scanState, filteredGroups.length]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: SimilarGroup; index: number | null }> }) => {
      const indices = viewableItems.map((v) => v.index).filter((i): i is number => i != null);
      if (indices.length > 0) {
        firstVisibleIndexRef.current = Math.min(...indices);
      }
    },
    []
  );
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 10 }).current;

  const renderGroup = useCallback(
    ({ item, index }: { item: SimilarGroup; index: number }) => (
      <PhotoGroupCard
        group={item}
        index={index}
        onKeepToggle={handleKeepToggle}
        onDelete={handleGroupDelete}
      />
    ),
    [handleKeepToggle, handleGroupDelete]
  );

  const ListHeader = useMemo(() => (
    <View style={styles.headerContent}>
      {!isNativeModuleAvailable() && (
        <View style={styles.expoGoBanner}>
          <Text style={styles.expoGoBannerText}>
            {t('scan.expoGoBanner')}
          </Text>
        </View>
      )}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={styles.titleRow}
      >
        <Text style={styles.title}>{t('scan.title')}</Text>
        <View style={styles.titleBadge}>
          <Text style={styles.titleBadgeText}>
            {t('scan.photoCountBadge', { count: photoCount })}
          </Text>
        </View>
      </Animated.View>

      <SimilaritySlider
        value={similarityLevel}
        onChange={changeSimilarityLevel}
        disabled={scanState === 'scanning'}
        onClearCache={handleClearCache}
      />

      <ThermalBanner level={thermalLevel} />

      {scanState === 'scanning' && (
        <View>
          <ProgressBar progress={scanProgress} />
          <View style={styles.pauseRow}>
            <ActionButton
              title={t('scan.pauseScan')}
              onPress={pauseScan}
              variant="ghost"
              size="sm"
            />
          </View>
        </View>
      )}

      {scanState === 'paused' && (
        <Animated.View
          entering={SlideInUp.duration(400).springify()}
          style={styles.pausedCard}
        >
          <Text style={styles.pausedEmoji}>⏸️</Text>
          <Text style={styles.pausedTitle}>{t('scan.pausedTitle')}</Text>
          {scanProgress && (
            <Text style={styles.pausedProgress}>
              {t('scan.pausedProgress', {
                current: scanProgress.current.toLocaleString(),
                total: scanProgress.total.toLocaleString(),
              })}
            </Text>
          )}
          <ActionButton
            title={t('scan.resumeScan')}
            onPress={resumeScan}
            variant="secondary"
            size="md"
          />
        </Animated.View>
      )}

      {scanState === 'idle' && !hasPartialScan && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(500).springify()}
          style={styles.idleCard}
        >
          <Text style={styles.idleEmoji}>📸</Text>
          <Text style={styles.idleTitle}>
            {t('scan.idleTitle')}
          </Text>
          <Text style={styles.idleDescription}>
            {t('scan.idleDescription')}
          </Text>
          <Text style={styles.idleAccessNote}>
            {t('scan.idleAccessNote')}
          </Text>
          <ActionButton
            title={t('scan.swipeReview')}
            onPress={() => navigation.navigate('SwipeAllPhotos')}
            variant="secondary"
            size="lg"
            emoji="👆"
            style={styles.scanButton}
          />
          <ActionButton
            title={t('scan.startScan')}
            onPress={startScan}
            size="lg"
            emoji="🔍"
            style={styles.scanButton}
          />
          {!isNativeModuleAvailable() && (
            <ActionButton
              title={t('scan.showDemoData')}
              onPress={handleShowDemoData}
              variant="ghost"
              size="md"
              emoji="👀"
              style={styles.demoButton}
            />
          )}
        </Animated.View>
      )}

      {scanState === 'idle' && hasPartialScan && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(500).springify()}
          style={styles.resumeCard}
        >
          <Text style={styles.resumeEmoji}>📋</Text>
          <Text style={styles.resumeTitle}>
            {t('scan.resumeTitle')}
          </Text>
          <View style={styles.resumeButtons}>
            <ActionButton
              title={t('scan.resumeScan')}
              onPress={resumeScan}
              variant="primary"
              size="md"
              emoji="▶️"
              style={{ flex: 1 }}
            />
            <ActionButton
              title={t('scan.startFromBeginning')}
              onPress={startScan}
              variant="ghost"
              size="md"
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      )}

      {scanState === 'completed' && groups.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(500).springify()}
          style={styles.emptyCard}
        >
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>{t('scan.emptyTitle')}</Text>
          <Text style={styles.emptyDescription}>
            {t('scan.emptyDescription')}
          </Text>
        </Animated.View>
      )}

      {groups.length > 0 && scanState !== 'scanning' && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.groupsHeader}
        >
          <Text style={styles.groupsTitle}>
            {filteredGroups.length === groups.length
              ? t('scan.groupsCount', { count: groups.length })
              : t('scan.groupsCountFiltered', { filtered: filteredGroups.length, total: groups.length })}
          </Text>
          <View style={styles.filterRow}>
            {[2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.filterChip,
                  minGroupSize === n && styles.filterChipActive,
                ]}
                onPress={() => setMinGroupSize(n)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    minGroupSize === n && styles.filterChipTextActive,
                  ]}
                >
                  {t('scan.filterChip', { count: n })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {totalDeletableCount > 0 && (
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {t('scan.selectedStats', {
                  count: totalDeletableCount,
                  size: (totalDeletable / (1024 * 1024)).toFixed(0),
                })}
              </Text>
            </View>
          )}
          <Text style={styles.longPressHint}>{t('scan.longPressHint')}</Text>
        </Animated.View>
      )}
    </View>
  ), [
    scanState, scanProgress, similarityLevel, thermalLevel, groups,
    filteredGroups, hasPartialScan, photoCount, minGroupSize,
    totalDeletableCount, totalDeletable, t, navigation,
    changeSimilarityLevel, handleClearCache, pauseScan, resumeScan,
    startScan, handleShowDemoData, handleSaveTodayProgress,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        ref={listRef}
        data={scanState === 'scanning' ? [] : filteredGroups}
        renderItem={renderGroup}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={(info) => {
          const index = Math.min(info.index, filteredGroups.length - 1);
          if (index >= 0) listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
        }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: insets.bottom + (scanState === 'scanning' ? 70 : totalDeletableCount > 0 ? 80 : 20),
          },
        ]}
        ItemSeparatorComponent={SeparatorComponent}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={31}
        initialNumToRender={10}
      />

      {scanState === 'scanning' && (
        <TouchableOpacity
          style={[styles.pauseFab, { bottom: insets.bottom + 16 }]}
          onPress={pauseScan}
          activeOpacity={0.7}
        >
          <Text style={styles.pauseFabText}>{t('scan.pauseScan')}</Text>
        </TouchableOpacity>
      )}

      {totalDeletableCount > 0 && scanState !== 'scanning' && (
        <TouchableOpacity
          style={[styles.deleteAllFab, { bottom: insets.bottom + 16 }]}
          onPress={handleDeleteAll}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteAllFabText}>
            {t('scan.batchDelete', { count: totalDeletableCount })}
          </Text>
        </TouchableOpacity>
      )}

      {filteredGroups.length > 0 && scanState !== 'scanning' && (
        <View style={[styles.todayDoneContainer, { top: insets.top + 6 }]}>
          <TouchableOpacity
            style={styles.todayDonePill}
            onPress={handleSaveTodayProgress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.todayDonePillText}>
              📌 {t('scan.todayDoneShort')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const SeparatorComponent = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  headerContent: {
    gap: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
  },
  titleBadge: {
    backgroundColor: theme.colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(184, 169, 212, 0.3)',
  },
  titleBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  todayDoneContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  todayDonePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    ...theme.shadow.glassSm,
  },
  todayDonePillText: {
    ...theme.typography.caption,
    color: theme.colors.secondary,
    fontWeight: '700',
  },
  separator: {
    height: 12,
  },

  pauseRow: {
    alignItems: 'center',
    marginTop: 8,
  },

  pausedCard: {
    ...glassCard,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  pausedEmoji: {
    fontSize: 36,
  },
  pausedTitle: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
  },
  pausedProgress: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },

  idleCard: {
    ...glassCard,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  idleEmoji: {
    fontSize: 48,
  },
  idleTitle: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  idleDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  idleAccessNote: {
    ...theme.typography.caption,
    color: theme.colors.accentDeep,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  scanButton: {
    width: '100%',
    marginTop: 8,
    borderRadius: 999,
  },
  demoButton: {
    width: '100%',
    marginTop: 4,
  },

  resumeCard: {
    ...glassCard,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  resumeEmoji: {
    fontSize: 36,
  },
  resumeTitle: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  resumeButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },

  emptyCard: {
    ...glassCard,
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.success,
  },
  emptyDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  groupsHeader: {
    gap: 8,
  },
  groupsTitle: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.accentDeep,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsText: {
    ...theme.typography.caption,
    color: theme.colors.accentDeep,
  },
  longPressHint: {
    ...theme.typography.tiny,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  pauseFab: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: theme.colors.secondary,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    ...theme.shadow.bubble,
  },
  pauseFabText: {
    ...theme.typography.subheading,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deleteAllFab: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: theme.colors.danger,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    ...theme.shadow.bubble,
  },
  deleteAllFabText: {
    ...theme.typography.subheading,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  expoGoBanner: {
    backgroundColor: theme.colors.secondarySoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(184, 169, 212, 0.3)',
  },
  expoGoBannerText: {
    ...theme.typography.caption,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
});
