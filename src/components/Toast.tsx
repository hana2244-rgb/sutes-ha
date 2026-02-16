// ============================================================
// 捨てショ - Toast Notification Component（すりガラス）
// ============================================================

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useAppStore } from '../store';

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { top: insets.top + 12 }]}
      pointerEvents="none"
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          text={toast.text}
          emoji={toast.emoji}
          subtext={toast.subtext}
          index={index}
        />
      ))}
    </View>
  );
}

interface ToastItemProps {
  text: string;
  emoji: string;
  subtext?: string;
  index: number;
}

function ToastItem({ text, emoji, subtext }: ToastItemProps) {
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 350,
      easing: Easing.out(Easing.back(1.5)),
    });
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 180,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.toast, animatedStyle]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{text}</Text>
        {subtext && <Text style={styles.subtext}>{subtext}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    ...theme.shadow.glass,
    maxWidth: 340,
    width: '100%',
  },
  emoji: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  text: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  subtext: {
    ...theme.typography.tiny,
    color: theme.colors.textSecondary,
  },
});
