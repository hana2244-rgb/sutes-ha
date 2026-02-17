// ============================================================
// 捨て写 - Onboarding Screen（ソーダグラス）
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { ActionButton } from '../components';
import { useAppStore } from '../store';
import { ONBOARDING_SEEN_KEY, SWIPE_PROGRESS_KEY, RESUME_FROM_GROUP_INDEX_KEY } from '../constants/storageKeys';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: (mode: 'swipe' | 'scan') => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setOnboardingSeen = useAppStore((s) => s.setOnboardingSeen);
  const [hasSwipeProgress, setHasSwipeProgress] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SWIPE_PROGRESS_KEY).then((val) => {
      setHasSwipeProgress(val != null);
    });
  }, []);

  const handleStart = (mode: 'swipe' | 'scan') => {
    setOnboardingSeen();
    // 「今日はここまで」で ONBOARDING_SEEN_KEY が削除済みの場合は書き戻さない
    // → 再起動時に必ずオンボーディングを表示するため
    AsyncStorage.getItem(RESUME_FROM_GROUP_INDEX_KEY).then((val) => {
      if (val == null) {
        AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
      }
    }).catch(() => {});
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
});
