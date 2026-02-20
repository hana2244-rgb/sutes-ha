// ============================================================
// 捨て写 - IAP（広告削除）
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  type ProductIOS,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store';
import { AD_FREE_KEY } from '../constants/storageKeys';

export const REMOVE_ADS_PRODUCT_ID = 'sutesho_remove_ads';
const NORMAL_PRICE = '¥500';

export function usePurchases() {
  const [product, setProduct] = useState<ProductIOS | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setIsAdFree = useAppStore((s) => s.setIsAdFree);

  const markAdFree = useCallback(async () => {
    setIsAdFree(true);
    try {
      await AsyncStorage.setItem(AD_FREE_KEY, 'true');
    } catch {
      // 保存失敗は無視
    }
  }, [setIsAdFree]);

  useEffect(() => {
    let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener> | null = null;
    let purchaseErrorSub: ReturnType<typeof purchaseErrorListener> | null = null;

    const setup = async () => {
      try {
        await initConnection();

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          if (__DEV__) console.log('[IAP] purchase updated:', purchase.productId);
          await finishTransaction({ purchase, isConsumable: false });
          if (purchase.productId === REMOVE_ADS_PRODUCT_ID) {
            await markAdFree();
          }
        });

        purchaseErrorSub = purchaseErrorListener((err: PurchaseError) => {
          if (__DEV__) console.warn('[IAP] purchase error:', err.message);
        });

        const products = await fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID] });
        const found = (products ?? []).find(
          (p) => p.id === REMOVE_ADS_PRODUCT_ID
        ) as ProductIOS | undefined;
        if (found) {
          setProduct(found);
        }
      } catch (err) {
        if (__DEV__) console.warn('[IAP] setup error:', err);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
    };
  }, [markAdFree]);

  const isSale = product != null && product.displayPrice !== NORMAL_PRICE;

  const purchase = useCallback(async () => {
    if (!product) return;
    setIsLoading(true);
    setError(null);
    try {
      await requestPurchase({
        request: { apple: { sku: product.id } },
        type: 'in-app',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // ユーザーキャンセルはエラー扱いしない
      if (!msg.includes('cancel') && !msg.includes('E_USER_CANCELLED')) {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [product]);

  const restore = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const purchases = await getAvailablePurchases();
      const found = purchases.some((p) => p.productId === REMOVE_ADS_PRODUCT_ID);
      if (found) {
        await markAdFree();
      }
      return found;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [markAdFree]);

  return { product, isSale, isLoading, error, purchase, restore };
}
