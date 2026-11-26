import { useQuery } from '@tanstack/react-query';
import { posService, DEFAULT_RECEIPT_SETTINGS, ReceiptSettings } from '@/services/pos.service';

export const RECEIPT_SETTINGS_KEY = ['receipt-settings'];

/** إعدادات الإيصال المحفوظة للفرع. لو التحميل فشل نطبع بالافتراضي (الإيصال لازم يطلع) */
export function useReceiptSettings(): ReceiptSettings {
  const { data } = useQuery({
    queryKey: RECEIPT_SETTINGS_KEY,
    queryFn: () => posService.getReceiptSettings(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return data || DEFAULT_RECEIPT_SETTINGS;
}
