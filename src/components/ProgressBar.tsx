// ============================================================
// 捨てショ - ProgressBar Component（ガラス棒）
// ============================================================

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import type { ScanProgress } from '../types';

interface ProgressBarProps {
  progress: ScanProgress | null;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const { t } = useTranslation();
  const width = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (progress) {
      width.value = withTiming(progress.percent / 100, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [progress?.percent]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(width.value * 100, 1)}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + pulse.value * 0.2,
  }));

  if (!progress) return null;

  const phaseLabels: Record<string, string> = {
    counting: t('progress.counting'),
    clustering: t('progress.clustering'),
    analyzing: t('progress.analyzing'),
    grouping: t('progress.grouping'),
  };

  const overallPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : Math.round(progress.percent);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.phaseLabel}>
          {progress.phaseLabel || phaseLabels[progress.phase] || t('progress.processing')}
        </Text>
        <Text style={styles.percentText}>{t('progress.overall', { percent: overallPercent })}</Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]}>
          <Animated.View style={[styles.glow, glowStyle]} />
        </Animated.View>
      </View>

      <Text style={styles.countText}>
        <Text style={styles.countCurrent}>
          {progress.current.toLocaleString()}
        </Text>
        <Text style={styles.countSlash}> / </Text>
        <Text style={styles.countTotal}>
          {t('progress.photoCount', { total: progress.total.toLocaleString() })}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  percentText: {
    ...theme.typography.mono,
    color: theme.colors.accentDeep,
    fontSize: 16,
  },
  track: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  countText: {
    textAlign: 'center',
  },
  countCurrent: {
    ...theme.typography.mono,
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  countSlash: {
    ...theme.typography.caption,
    color: theme.colors.textTertiary,
  },
  countTotal: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
});
