// ============================================================
// 捨て写 - AdMob 広告ユニットID
// ============================================================

import { TestIds } from 'react-native-google-mobile-ads';

/** バナー広告ユニットID（常に画面下部） */
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-4182152923139643/8961635530';

/** リワード広告ユニットID（まとめて削除時） */
export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-4182152923139643/6791040834';
