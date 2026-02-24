// ============================================================
// 捨て写 - Onboarding Screen（ソーダグラス）
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme, glassCard } from '../theme';
import { ActionButton } from '../components';
import { useAppStore } from '../store';
import { SWIPE_PROGRESS_KEY } from '../constants/storageKeys';
import { usePurchases } from '../purchases/usePurchases';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: (mode: 'swipe' | 'scan') => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setOnboardingSeen = useAppStore((s) => s.setOnboardingSeen);
  const isAdFree = useAppStore((s) => s.isAdFree);
  const addToast = useAppStore((s) => s.addToast);
  const [hasSwipeProgress, setHasSwipeProgress] = useState(false);
  const { product, isSale, isLoading, error, purchase, restore } = usePurchases();

  useEffect(() => {
    AsyncStorage.getItem(SWIPE_PROGRESS_KEY).then((val) => {
      setHasSwipeProgress(val != null);
    });
  }, []);

  useEffect(() => {
    if (error) {
      addToast({ emoji: '⚠️', text: t('purchase.error') });
    }
  }, [error]);

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

  const handleStart = (mode: 'swipe' | 'scan') => {
    setOnboardingSeen();
    onComplete(mode);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <View style={styles.decoration} pointerEvents="none">
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
        <View style={[styles.circle, styles.circle4]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={FadeInDown.delay(200).duration(600).springify()}
          style={styles.titleContainer}
        >
          <Image
            source={require('../../assets/icon-title.png')}
            style={styles.titleIcon}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(600).springify()}
          style={styles.features}
        >
          <FeatureItem
            title={t('onboarding.feature1Title')}
            description={t('onboarding.feature1Desc')}
            delay={500}
          />
          <FeatureItem
            title={t('onboarding.feature2Title')}
            description={t('onboarding.feature2Desc')}
            delay={600}
          />
          <FeatureItem
            title={t('onboarding.feature3Title')}
            description={t('onboarding.feature3Desc')}
            delay={700}
          />
          <FeatureItem
            title={t('onboarding.feature4Title')}
            description={t('onboarding.feature4Desc')}
            delay={800}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(900).duration(500).springify()}
          style={styles.choiceSection}
        >
          <Text style={styles.choiceLabel}>{t('onboarding.choiceLabel')}</Text>

          <View style={styles.choiceCard}>
            <Text style={styles.choiceCardTitle}>{t('onboarding.choiceScanTitle')}</Text>
            <Text style={styles.choiceCardDesc}>
              {t('onboarding.choiceScanDesc')}
            </Text>
            <ActionButton
              title={t('onboarding.choiceScanButton')}
              onPress={() => handleStart('scan')}
              size="lg"
              emoji="🔍"
              style={styles.startButton}
            />
          </View>

          <View style={styles.choiceCard}>
            <Text style={styles.choiceCardTitle}>{t('onboarding.choiceSwipeTitle')}</Text>
            <Text style={styles.choiceCardDesc}>
              {t('onboarding.choiceSwipeDesc')}
            </Text>
            <ActionButton
              title={hasSwipeProgress ? t('onboarding.choiceSwipeButtonResume') : t('onboarding.choiceSwipeButton')}
              onPress={() => handleStart('swipe')}
              variant="secondary"
              size="lg"
              emoji="👆"
              style={styles.startButton}
            />
          </View>
        </Animated.View>

        {/* 広告削除IAP */}
        <Animated.View
          entering={FadeInUp.delay(1100).duration(500).springify()}
          style={styles.iapCard}
        >
          {isAdFree ? (
            <Text style={styles.iapOwned}>{t('purchase.alreadyOwned')}</Text>
          ) : (
            <>
              <View style={styles.iapHeader}>
                {isSale && (
                  <View style={styles.iapSaleBadge}>
                    <Text style={styles.iapSaleBadgeText}>🎉 {t('purchase.saleBadge')}</Text>
                  </View>
                )}
                <Text style={styles.iapTitle}>{t('purchase.removeAds')}</Text>
              </View>

              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : product ? (
                <View style={styles.iapActions}>
                  <View style={styles.iapPriceRow}>
                    {isSale && (
                      <Text style={styles.iapNormalPrice}>
                        {t('purchase.normalPrice', { price: '¥500' })}
                      </Text>
                    )}
                    <Text style={styles.iapCurrentPrice}>{product.displayPrice}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iapBuyButton}
                    onPress={handlePurchase}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.iapBuyButtonText}>
                      {t('purchase.buyButton', { price: product.displayPrice })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRestore} activeOpacity={0.7}>
                    <Text style={styles.iapRestoreText}>{t('purchase.restoreButton')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.iapLoadingText}>{t('purchase.loading')}</Text>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FeatureItem({
  title,
  description,
  delay,
}: {
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={styles.featureItem}
    >
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 24,
  },
  decoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(126, 181, 245, 0.12)',
    top: -80,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(184, 169, 212, 0.1)',
    top: SCREEN_HEIGHT * 0.3,
    left: -80,
  },
  circle3: {
    width: 150,
    height: 150,
    backgroundColor: 'rgba(126, 181, 245, 0.12)',
    bottom: 100,
    right: -40,
  },
  circle4: {
    width: 180,
    height: 180,
    backgroundColor: 'rgba(242, 145, 138, 0.08)',
    bottom: 60,
    right: -20,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  titleIcon: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  features: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    ...theme.shadow.glassSm,
  },
  featureText: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  featureDesc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  choiceSection: {
    paddingTop: 8,
    gap: 16,
  },
  choiceLabel: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  choiceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    gap: 10,
    ...theme.shadow.glassSm,
  },
  choiceCardTitle: {
    ...theme.typography.subheading,
    color: theme.colors.textPrimary,
    fontSize: 17,
  },
  choiceCardDesc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  startButton: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 4,
  },
  iapCard: {
    ...glassCard,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  iapOwned: {
    ...theme.typography.caption,
    color: theme.colors.success,
    textAlign: 'center',
    fontWeight: '700',
  },
  iapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  iapSaleBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  iapSaleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4500',
  },
  iapTitle: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  iapActions: {
    gap: 8,
  },
  iapPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  iapNormalPrice: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  iapCurrentPrice: {
    ...theme.typography.subheading,
    color: theme.colors.accentDeep,
  },
  iapBuyButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    alignItems: 'center',
  },
  iapBuyButtonText: {
    ...theme.typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  iapRestoreText: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  iapLoadingText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
});
