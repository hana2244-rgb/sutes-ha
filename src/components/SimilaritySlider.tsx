<<<<<<< HEAD
// ============================================================
// 捨てショ - SimilaritySlider Component（ガラストラック）
// ============================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { SIMILARITY_LEVELS, type SimilarityLevel } from '../types';

interface SimilaritySliderProps {
  value: SimilarityLevel;
  onChange: (level: SimilarityLevel) => void;
  disabled?: boolean;
  onClearCache?: () => void;
}

const ITEM_WIDTH = 105;

const SIMILARITY_LABEL_KEYS: Record<SimilarityLevel, { label: string; desc: string }> = {
  very_similar: { label: 'similarity.verySimilar', desc: 'similarity.verySimilarDesc' },
  similar: { label: 'similarity.similar', desc: 'similarity.similarDesc' },
  maybe_similar: { label: 'similarity.maybeSimilar', desc: 'similarity.maybeSimilarDesc' },
};

export function SimilaritySlider({
  value,
  onChange,
  disabled = false,
  onClearCache,
}: SimilaritySliderProps) {
  const { t } = useTranslation();
  const activeIndex = SIMILARITY_LEVELS.findIndex((l) => l.key === value);
  const indicatorPosition = useSharedValue(activeIndex);

  // prop変更時にインジケーター位置を同期
  useEffect(() => {
    indicatorPosition.value = withTiming(activeIndex, { duration: 200 });
  }, [activeIndex]);

  const handleSelect = (level: SimilarityLevel, index: number) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    indicatorPosition.value = withTiming(index, {
      duration: 200,
    });
    onChange(level);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: indicatorPosition.value * (ITEM_WIDTH + 8),
      },
    ],
  }));

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('similarity.label')}</Text>
        {onClearCache && (
          <TouchableOpacity
            onPress={onClearCache}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearCacheText}>{t('scan.clearCache')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {SIMILARITY_LEVELS.map((level, index) => {
          const isActive = level.key === value;
          return (
            <TouchableOpacity
              key={level.key}
              style={styles.item}
              onPress={() => handleSelect(level.key, index)}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <Text style={styles.emoji}>{level.emoji}</Text>
              <Text
                style={[
                  styles.itemLabel,
                  isActive && styles.itemLabelActive,
                ]}
              >
                {t(SIMILARITY_LABEL_KEYS[level.key].label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.description}>
        {SIMILARITY_LEVELS[activeIndex] ? t(SIMILARITY_LABEL_KEYS[SIMILARITY_LEVELS[activeIndex].key].desc) : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  clearCacheText: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    padding: 4,
    gap: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: ITEM_WIDTH,
    height: '100%',
    backgroundColor: 'rgba(126, 181, 245, 0.2)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(126, 181, 245, 0.4)',
  },
  item: {
    width: ITEM_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 1,
  },
  emoji: {
    fontSize: 20,
  },
  itemLabel: {
    ...theme.typography.tiny,
    color: theme.colors.textTertiary,
  },
  itemLabelActive: {
    color: theme.colors.accentDeep,
    fontWeight: '700',
  },
  description: {
    ...theme.typography.tiny,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
});
=======
// ============================================================
// 捨てショ - SimilaritySlider Component（ガラストラック）
// ============================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { SIMILARITY_LEVELS, type SimilarityLevel } from '../types';

interface SimilaritySliderProps {
  value: SimilarityLevel;
  onChange: (level: SimilarityLevel) => void;
  disabled?: boolean;
  onClearCache?: () => void;
}

const ITEM_WIDTH = 105;

const SIMILARITY_LABEL_KEYS: Record<SimilarityLevel, { label: string; desc: string }> = {
  very_similar: { label: 'similarity.verySimilar', desc: 'similarity.verySimilarDesc' },
  similar: { label: 'similarity.similar', desc: 'similarity.similarDesc' },
  maybe_similar: { label: 'similarity.maybeSimilar', desc: 'similarity.maybeSimilarDesc' },
};

export function SimilaritySlider({
  value,
  onChange,
  disabled = false,
  onClearCache,
}: SimilaritySliderProps) {
  const { t } = useTranslation();
  const activeIndex = SIMILARITY_LEVELS.findIndex((l) => l.key === value);
  const indicatorPosition = useSharedValue(activeIndex);

  // prop変更時にインジケーター位置を同期
  useEffect(() => {
    indicatorPosition.value = withTiming(activeIndex, { duration: 200 });
  }, [activeIndex]);

  const handleSelect = (level: SimilarityLevel, index: number) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    indicatorPosition.value = withTiming(index, {
      duration: 200,
    });
    onChange(level);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: indicatorPosition.value * (ITEM_WIDTH + 8),
      },
    ],
  }));

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('similarity.label')}</Text>
        {onClearCache && (
          <TouchableOpacity
            onPress={onClearCache}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearCacheText}>{t('scan.clearCache')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {SIMILARITY_LEVELS.map((level, index) => {
          const isActive = level.key === value;
          return (
            <TouchableOpacity
              key={level.key}
              style={styles.item}
              onPress={() => handleSelect(level.key, index)}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <Text style={styles.emoji}>{level.emoji}</Text>
              <Text
                style={[
                  styles.itemLabel,
                  isActive && styles.itemLabelActive,
                ]}
              >
                {t(SIMILARITY_LABEL_KEYS[level.key].label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.description}>
        {SIMILARITY_LEVELS[activeIndex] ? t(SIMILARITY_LABEL_KEYS[SIMILARITY_LEVELS[activeIndex].key].desc) : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  clearCacheText: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    padding: 4,
    gap: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: ITEM_WIDTH,
    height: '100%',
    backgroundColor: 'rgba(126, 181, 245, 0.2)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(126, 181, 245, 0.4)',
  },
  item: {
    width: ITEM_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 1,
  },
  emoji: {
    fontSize: 20,
  },
  itemLabel: {
    ...theme.typography.tiny,
    color: theme.colors.textTertiary,
  },
  itemLabelActive: {
    color: theme.colors.accentDeep,
    fontWeight: '700',
  },
  description: {
    ...theme.typography.tiny,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
});
>>>>>>> d8c7055 (Initial commit)
