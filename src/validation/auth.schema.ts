import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'اسم المستخدم مطلوب')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'كلمة المرور مطلوبة')
    .optional()
    .or(z.literal('')),
});

export type LoginFormData = z.infer<typeof loginSchema>;

