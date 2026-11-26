import { QueryClient } from '@tanstack/react-query';

// عميل مشترك: تستخدمه الشاشات عبر QueryClientProvider وتستخدمه الخدمات
// (مثل order.service) لإعادة استخدام استعلامات القراءة المتكررة بدل ضرب
// قاعدة البيانات في كل عملية حفظ.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      // شاشات نقطة بيع تعمل باستمرار؛ التحديث الفعلي يتم عبر أحداث
      // mrdonuts:* والاستعلامات الدورية. منع إعادة الجلب الجماعي عند كل
      // تنقّل بين النوافذ (alt+tab) لأنه كان يطلق كل الاستعلامات النشطة دفعة واحدة.
      refetchOnWindowFocus: false,
    },
  },
});
