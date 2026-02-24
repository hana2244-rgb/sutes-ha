// ============================================================
// 捨てショ - Error Boundary（未捕捉例外で白画面を防ぐ）
// ============================================================
// クラスコンポーネント必須（componentDidCatch のため）

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import i18n from 'i18next';
import { theme } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  handleRetry = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ error: null, errorInfo: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children } = this.props;

    if (error) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>😵</Text>
            <Text style={styles.title}>{i18n.t('errorBoundary.title')}</Text>
            <Text style={styles.message}>
              {i18n.t('errorBoundary.message')}
            </Text>
            {__DEV__ && error.message ? (
              <Text style={styles.devMessage} numberOfLines={5}>
                {error.message}
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('errorBoundary.retry')}
            >
              <Text style={styles.buttonText}>{i18n.t('errorBoundary.retry')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.bgCardSolid,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? theme.shadow.glass : { elevation: 4 }),
  },
  emoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  devMessage: {
    ...theme.typography.mono,
    color: theme.colors.danger,
    fontSize: 12,
    marginBottom: theme.spacing.md,
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.full,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    ...theme.typography.subheading,
    color: theme.colors.textOnAccent,
  },
});
