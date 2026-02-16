// ============================================================
// 捨て写 - AdMob SDK 初期化完了フラグ
// ============================================================
// 広告コンポーネントはこの値が true になってからリクエストする（表示されない原因対策）

import { createContext } from 'react';

export const AdsSdkReadyContext = createContext<boolean>(false);
