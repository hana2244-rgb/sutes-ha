<<<<<<< HEAD
// ============================================================
// 捨てショ - ActionButton Component（ガラスバブルビーズ）
// ============================================================

import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, bubbleButton, glassPill } from '../theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  emoji?: string;
  style?: ViewStyle;
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  emoji,
  style,
}: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.94, {
      damping: 12,
      stiffness: 200,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 8,
      stiffness: 250,
    });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const buttonStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    disabled && styles.textDisabled,
  ];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={buttonStyles}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'danger'
                ? '#FFFFFF'
                : theme.colors.accentDeep
            }
          />
        ) : (
          <>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <Text style={textStyles}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  disabled: {
    opacity: 0.4,
  },

  variant_primary: {
    backgroundColor: theme.colors.accent,
    ...bubbleButton,
  },
  variant_secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    ...glassPill,
    ...theme.shadow.glassSm,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: theme.colors.danger,
    ...bubbleButton,
    shadowColor: '#F2918A',
  },

  size_sm: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  size_md: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  size_lg: {
    paddingHorizontal: 32,
    paddingVertical: 18,
  },

  text: {
    fontWeight: '700',
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: theme.colors.accentDeep,
  },
  text_ghost: {
    color: theme.colors.textSecondary,
  },
  text_danger: {
    color: '#FFFFFF',
  },
  text_sm: {
    ...theme.typography.caption,
  },
  text_md: {
    ...theme.typography.body,
  },
  text_lg: {
    fontSize: 18,
    fontWeight: '700',
  },
  textDisabled: {
    opacity: 0.6,
  },

  emoji: {
    fontSize: 18,
  },
});
=======
// ============================================================
// 捨てショ - ActionButton Component（ガラスバブルビーズ）
// ============================================================

import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, bubbleButton, glassPill } from '../theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  emoji?: string;
  style?: ViewStyle;
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  emoji,
  style,
}: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.94, {
      damping: 12,
      stiffness: 200,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 8,
      stiffness: 250,
    });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const buttonStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    disabled && styles.textDisabled,
  ];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={buttonStyles}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'danger'
                ? '#FFFFFF'
                : theme.colors.accentDeep
            }
          />
        ) : (
          <>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <Text style={textStyles}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  disabled: {
    opacity: 0.4,
  },

  variant_primary: {
    backgroundColor: theme.colors.accent,
    ...bubbleButton,
  },
  variant_secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    ...glassPill,
    ...theme.shadow.glassSm,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: theme.colors.danger,
    ...bubbleButton,
    shadowColor: '#F2918A',
  },

  size_sm: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  size_md: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  size_lg: {
    paddingHorizontal: 32,
    paddingVertical: 18,
  },

  text: {
    fontWeight: '700',
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: theme.colors.accentDeep,
  },
  text_ghost: {
    color: theme.colors.textSecondary,
  },
  text_danger: {
    color: '#FFFFFF',
  },
  text_sm: {
    ...theme.typography.caption,
  },
  text_md: {
    ...theme.typography.body,
  },
  text_lg: {
    fontSize: 18,
    fontWeight: '700',
  },
  textDisabled: {
    opacity: 0.6,
  },

  emoji: {
    fontSize: 18,
  },
});
>>>>>>> d8c7055 (Initial commit)
