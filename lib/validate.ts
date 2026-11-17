import { z } from 'zod';

export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const acceptSchema = z.object({
  emails: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .email('Invalid email address')
    )
    .min(1, 'At least one email is required')
    .max(20, 'Cannot accept more than 20 emails at once'),
});

export type AcceptInput = z.infer<typeof acceptSchema>;

export const checkinSchema = z.object({
  ticketId: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Ticket ID is required')
    .max(64, 'Ticket ID is too long'),
});

export type CheckinInput = z.infer<typeof checkinSchema>;

export const resendSchema = z.object({
  ticketId: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Ticket ID is required')
    .max(64, 'Ticket ID is too long'),
});

export type ResendInput = z.infer<typeof resendSchema>;
