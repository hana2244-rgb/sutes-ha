// ============================================================
// 捨て写 - SettingsScreen（広告削除IAP）
// ============================================================

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme, glassCard } from '../theme';
import { useAppStore } from '../store';
import { usePurchases } from '../purchases/usePurchases';
import Constants from 'expo-constants';

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isAdFree = useAppStore((s) => s.isAdFree);
  const addToast = useAppStore((s) => s.addToast);

  const { product, isSale, isLoading, error, purchase, restore } = usePurchases();

  const handlePurchase = useCallback(async () => {
    await purchase();
    if (useAppStore.getState().isAdFree) {
      addToast({ emoji: '🎉', text: t('purchase.success') });
    }
  }, [purchase, addToast, t]);

  const handleRestore = useCallback(async () => {
    const found = await restore();
    if (found) {
      addToast({ emoji: '✅', text: t('purchase.success') });
    } else {
      addToast({ emoji: '🔍', text: t('purchase.restoreNone') });
    }
  }, [restore, addToast, t]);

  // エラーをトーストで表示
  React.useEffect(() => {
    if (error) {
      addToast({ emoji: '⚠️', text: t('purchase.error') });
    }
  }, [error]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.closeButtonText}>{t('common.close')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 購入カード */}
        <View style={styles.purchaseCard}>
          {isAdFree ? (
            <View style={styles.ownedContainer}>
              <Text style={styles.ownedEmoji}>✅</Text>
              <Text style={styles.ownedText}>{t('purchase.alreadyOwned')}</Text>
            </View>
          ) : (
            <>
              {isSale && (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>🎉 {t('purchase.saleBadge')}</Text>
                </View>
              )}
              <Text style={styles.removeAdsTitle}>{t('purchase.removeAds')}</Text>

              {isLoading ? (
                <ActivityIndicator
                  size="large"
                  color={theme.colors.accent}
                  style={styles.spinner}
                />
              ) : product ? (
                <>
                  <View style={styles.priceRow}>
                    {isSale && (
                      <Text style={styles.normalPriceStrike}>
                        {t('purchase.normalPrice', { price: '¥500' })}
                      </Text>
                    )}
                    <Text style={styles.currentPrice}>{product.displayPrice}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.buyButton}
                    onPress={handlePurchase}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buyButtonText}>
                      {t('purchase.buyButton', { price: product.displayPrice })}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.loadingText}>{t('purchase.loading')}</Text>
              )}
            </>
          )}
        </View>

        {/* 購入を復元 */}
        {!isAdFree && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.restoreButtonText}>{t('purchase.restoreButton')}</Text>
          </TouchableOpacity>
        )}

        {/* アプリ情報 */}
        <View style={styles.sectionSeparator}>
          <Text style={styles.sectionLabel}>── {t('purchase.appInfoLabel')} ──</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('purchase.appVersion')}</Text>
          <Text style={styles.infoValue}>{appVersion}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    minWidth: 60,
  },
  closeButtonText: {
    ...theme.typography.body,
    color: theme.colors.accentDeep,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
  },
  headerRight: {
    minWidth: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  purchaseCard: {
    ...glassCard,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  ownedContainer: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  ownedEmoji: {
    fontSize: 40,
  },
  ownedText: {
    ...theme.typography.subheading,
    color: theme.colors.success,
    textAlign: 'center',
  },
  saleBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  saleBadgeText: {
    ...theme.typography.caption,
    color: '#5C4500',
    fontWeight: '700',
  },
  removeAdsTitle: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  spinner: {
    marginVertical: 16,
  },
  priceRow: {
    alignItems: 'center',
    gap: 4,
  },
  normalPriceStrike: {
    ...theme.typography.body,
    color: theme.colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    ...theme.typography.heading,
    color: theme.colors.accentDeep,
  },
  buyButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radius.full,
    width: '100%',
    alignItems: 'center',
    ...theme.shadow.bubble,
  },
  buyButtonText: {
    ...theme.typography.subheading,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreButtonText: {
    ...theme.typography.body,
    color: theme.colors.accentDeep,
    textDecorationLine: 'underline',
  },
  sectionSeparator: {
    alignItems: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
});
