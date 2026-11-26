export type PaymentBucket = 'cash' | 'card' | 'wallet' | 'instapay';

// تصنيف طريقة الدفع لخانات ملخص الشفت. فودافون كاش محفظة وليست نقدية الدرج.
export function paymentBucket(methodName: string | null | undefined, isCash?: boolean): PaymentBucket {
  const m = (methodName || '').toLowerCase();
  if (m.includes('فودافون') || m.includes('محفظ') || m.includes('wallet') || m.includes('vodafone')) return 'wallet';
  if (isCash || m.includes('نقد')) return 'cash';
  if (/[اإ]نستاباي/.test(m) || m.includes('instapay')) return 'instapay';
  return 'card';
}
