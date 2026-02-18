// ============================================================
// 捨て写 - リワード広告（AdMob 無効時はスタブ：常に削除許可）
// ============================================================
// 再実装時は docs/ads_backup/RewardedAdContext.tsx を復元し、
// App.tsx で RewardedAdProvider と AdMob SDK 初期化を復元すること

import React, { createContext, useContext } from 'react';

type RewardedAdContextValue = {
  requestShowRewardedAd: () => Promise<boolean>;
};

const RewardedAdContext = createContext<RewardedAdContextValue | null>(null);

export function useRewardedAdContext(): RewardedAdContextValue | null {
  return useContext(RewardedAdContext);
}

/** AdMob 無効時は常に true を返す（削除を許可） */
const stubValue: RewardedAdContextValue = {
  requestShowRewardedAd: () => Promise.resolve(true),
};

export function RewardedAdProvider({ children }: { children: React.ReactNode }) {
  return (
    <RewardedAdContext.Provider value={stubValue}>
      {children}
    </RewardedAdContext.Provider>
  );
}
