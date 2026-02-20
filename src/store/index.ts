// ============================================================
// 捨てショ - Global State (Zustand)
// ============================================================

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, SimilarGroup, ToastMessage } from '../types';
import { AD_FREE_KEY } from '../constants/storageKeys';

let toastCounter = 0;

export const useAppStore = create<AppState>((set, get) => ({
  scanState: 'idle',
  scanProgress: null,
  similarityLevel: 'similar',
  groups: [],
  thermalLevel: 'nominal',

  toasts: [],
  hasSeenOnboarding: false,
  hasPartialScan: false,
  isAdFree: false,

  setScanState: (scanState) => set({ scanState }),

  setScanProgress: (scanProgress) => set({ scanProgress }),

  setSimilarityLevel: (similarityLevel) => set({ similarityLevel }),

  addGroup: (group: SimilarGroup) =>
    set((state) => ({
      groups: [...state.groups, { ...group, keepAssetIds: group.keepAssetIds ?? [] }],
    })),

  setGroups: (groups: SimilarGroup[]) =>
    set({
      groups: groups.map((g) => ({ ...g, keepAssetIds: g.keepAssetIds ?? [] })),
    }),

  removeAssetsFromGroups: (assetIds: string[]) =>
    set((state) => {
      const idSet = new Set(assetIds);
      const updatedGroups = state.groups
        .map((group) => ({
          ...group,
          assets: group.assets.filter((a) => !idSet.has(a.id)),
          keepAssetIds: group.keepAssetIds.filter((id) => !idSet.has(id)),
        }))
        .filter((group) => group.assets.length >= 2);
      return { groups: updatedGroups };
    }),

  toggleKeepAsset: (groupId: string, assetId: string) =>
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.keepAssetIds.includes(assetId);
        return {
          ...g,
          keepAssetIds: has
            ? g.keepAssetIds.filter((id) => id !== assetId)
            : [...g.keepAssetIds, assetId],
        };
      }),
    })),

  setKeepAssets: (groupId: string, keepIds: string[]) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, keepAssetIds: keepIds } : g
      ),
    })),

  setThermalLevel: (thermalLevel) => set({ thermalLevel }),

  addToast: (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    const duration = toast.duration ?? 2500;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setOnboardingSeen: () => set({ hasSeenOnboarding: true }),

  setHasSeenOnboarding: (value: boolean) => set({ hasSeenOnboarding: value }),

  setHasPartialScan: (hasPartialScan) => set({ hasPartialScan }),

  setIsAdFree: (isAdFree: boolean) => set({ isAdFree }),
}));

/** アプリ起動時に AsyncStorage から isAdFree を復元する */
export async function initAdFreeStatus(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(AD_FREE_KEY);
    if (value === 'true') {
      useAppStore.getState().setIsAdFree(true);
    }
  } catch {
    // 読み込み失敗は無視
  }
}
