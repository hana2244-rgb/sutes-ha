// ============================================================
// 捨て写 - AdMob 広告ユニットID
// ============================================================
// app-ads.txt / ads.txt 用（サイトに掲載する1行）:
// google.com, pub-4182152923139643, DIRECT, f08c47fec0942fa0

import { TestIds } from 'react-native-google-mobile-ads';

/** バナー広告ユニットID（常に画面下部） */
export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-4182152923139643/8961635530';

/** リワード広告ユニットID（まとめて削除時） */
export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-4182152923139643/9272474760';
