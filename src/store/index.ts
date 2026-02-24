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
  groupIdsAllSelectedForDelete: [],

  setScanState: (scanState) => set({ scanState }),

  setScanProgress: (scanProgress) => set({ scanProgress }),

  setSimilarityLevel: (similarityLevel) => set({ similarityLevel }),

  addGroup: (group: SimilarGroup) =>
    set((state) => ({
      groups: [...state.groups, { ...group, keepAssetIds: group.keepAssetIds ?? [] }],
    })),

  setGroups: (groups: SimilarGroup[]) =>
    set((state) => {
      const idSet = new Set(groups.map((g) => g.id));
      const kept = state.groupIdsAllSelectedForDelete.filter((id) => idSet.has(id));
      return {
        groups: groups.map((g) => ({ ...g, keepAssetIds: g.keepAssetIds ?? [] })),
        groupIdsAllSelectedForDelete: kept,
      };
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
    set((state) => {
      const nextGroups = state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.keepAssetIds.includes(assetId);
        return {
          ...g,
          keepAssetIds: has
            ? g.keepAssetIds.filter((id) => id !== assetId)
            : [...g.keepAssetIds, assetId],
        };
      });
      const addingKeep = (() => {
        const g = state.groups.find((x) => x.id === groupId);
        if (!g) return false;
        return !g.keepAssetIds.includes(assetId);
      })();
      const nextAllSelected = addingKeep
        ? state.groupIdsAllSelectedForDelete.filter((id) => id !== groupId)
        : state.groupIdsAllSelectedForDelete;
      return { groups: nextGroups, groupIdsAllSelectedForDelete: nextAllSelected };
    }),

  setKeepAssets: (groupId: string, keepIds: string[]) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, keepAssetIds: keepIds } : g
      ),
    })),

  setGroupAllSelectedForDelete: (groupId: string, value: boolean) =>
    set((state) => {
      const has = state.groupIdsAllSelectedForDelete.includes(groupId);
      if (value && !has) {
        return { groupIdsAllSelectedForDelete: [...state.groupIdsAllSelectedForDelete, groupId] };
      }
      if (!value && has) {
        return {
          groupIdsAllSelectedForDelete: state.groupIdsAllSelectedForDelete.filter((id) => id !== groupId),
        };
      }
      return state;
    }),

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
