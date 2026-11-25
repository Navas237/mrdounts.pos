import { z } from 'zod';

export const openShiftSchema = z.object({
  openingCash: z
    .number()
    .min(0, 'الرصيد الافتتاحي لا يمكن أن يكون سالباً'),
  notes: z.string().optional(),
});

export const closeShiftSchema = z.object({
  actualCash: z
    .number()
    .min(0, 'المبلغ لا يمكن أن يكون سالباً'),
  notes: z.string().optional(),
});

export const cashMovementSchema = z.object({
  kind: z.enum(['in', 'out']),
  amount: z
    .number()
    .positive('المبلغ يجب أن يكون أكبر من صفر'),
  category: z.string().min(1, 'يرجى اختيار البند / التصنيف'),
  description: z.string().optional(),
});

export type OpenShiftFormData = z.infer<typeof openShiftSchema>;
export type CloseShiftFormData = z.infer<typeof closeShiftSchema>;
export type CashMovementFormData = z.infer<typeof cashMovementSchema>;
