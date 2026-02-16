<<<<<<< HEAD
// ============================================================
// 捨てショ - ThermalBanner Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

interface ThermalBannerProps {
  level: string;
}

export function ThermalBanner({ level }: ThermalBannerProps) {
  const { t } = useTranslation();
  if (level === 'nominal' || level === 'fair') return null;

  const isCritical = level === 'critical';

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[
        styles.banner,
        isCritical ? styles.bannerCritical : styles.bannerSerious,
      ]}
    >
      <Text style={styles.emoji}>🌡️</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {isCritical
            ? t('thermal.criticalTitle')
            : t('thermal.seriousTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {isCritical
            ? t('thermal.criticalSubtitle')
            : t('thermal.seriousSubtitle')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  bannerSerious: {
    backgroundColor: 'rgba(242, 204, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 204, 107, 0.3)',
  },
  bannerCritical: {
    backgroundColor: 'rgba(242, 145, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 145, 138, 0.3)',
  },
  emoji: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
  },
});
=======
// ============================================================
// 捨てショ - ThermalBanner Component
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

interface ThermalBannerProps {
  level: string;
}

export function ThermalBanner({ level }: ThermalBannerProps) {
  const { t } = useTranslation();
  if (level === 'nominal' || level === 'fair') return null;

  const isCritical = level === 'critical';

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[
        styles.banner,
        isCritical ? styles.bannerCritical : styles.bannerSerious,
      ]}
    >
      <Text style={styles.emoji}>🌡️</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {isCritical
            ? t('thermal.criticalTitle')
            : t('thermal.seriousTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {isCritical
            ? t('thermal.criticalSubtitle')
            : t('thermal.seriousSubtitle')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  bannerSerious: {
    backgroundColor: 'rgba(242, 204, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 204, 107, 0.3)',
  },
  bannerCritical: {
    backgroundColor: 'rgba(242, 145, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 145, 138, 0.3)',
  },
  emoji: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
  },
});
>>>>>>> d8c7055 (Initial commit)
