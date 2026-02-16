// ============================================================
// 捨てショ - Navigation
// ============================================================

import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore } from '../store';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SwipeAllPhotosScreen } from '../screens/SwipeAllPhotosScreen';
import { theme } from '../theme';

export type RootStackParamList = {
  Onboarding: undefined;
  Scan: { initialAction?: 'swipe' | 'scan' } | undefined;
  SwipeAllPhotos: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.bgCardSolid,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

export function AppNavigator() {
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const setOnboardingSeen = useAppStore((s) => s.setOnboardingSeen);
  const [initialAction, setInitialAction] = useState<'swipe' | 'scan' | undefined>();

  if (!hasSeenOnboarding) {
    return (
      <OnboardingScreen onComplete={(mode) => {
        setInitialAction(mode);
        setOnboardingSeen();
      }} />
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Scan" component={ScanScreen} initialParams={{ initialAction }} />
        <Stack.Screen
          name="SwipeAllPhotos"
          component={SwipeAllPhotosScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
