<<<<<<< HEAD
// ============================================================
// 捨て写 - AdMob 広告ユニットID
// ============================================================
// 開発時は TestIds、本番は AdMob ダッシュボードで取得したIDに差し替え

import { TestIds } from 'react-native-google-mobile-ads';

/** バナー広告ユニットID（常に画面下部） */
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy'; // 本番用に差し替え

/** リワード広告ユニットID（まとめて削除時） */
export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy'; // 本番用に差し替え
=======
// ============================================================
// 捨て写 - AdMob 広告ユニットID
// ============================================================
// 開発時は TestIds、本番は AdMob ダッシュボードで取得したIDに差し替え

import { TestIds } from 'react-native-google-mobile-ads';

/** バナー広告ユニットID（常に画面下部） */
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy'; // 本番用に差し替え

/** リワード広告ユニットID（まとめて削除時） */
export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy'; // 本番用に差し替え
>>>>>>> d8c7055 (Initial commit)
