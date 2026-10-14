import { z } from 'zod';

/** Normalises a phone number to E.164, assuming US/Canada when no country code is given. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export function normalizeEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  return z.string().email().safeParse(v).success ? v : null;
}

const raw = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(40).default(''),
});

function build(emailRequired: boolean) {
  // superRefine runs even when the name is missing, so every problem shows at once.
  // Messages are codes (see errors in i18n.ts), turned into words in the visitor's language.
  return raw
    .superRefine((v, ctx) => {
      if (v.email && !normalizeEmail(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_invalid' });
      if (!v.email && emailRequired) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_required' });
      if (v.phone && !normalizePhone(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone_invalid' });
      if (!v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone_required' });
    })
    .transform((v) => ({
      name: v.name,
      email: v.email ? normalizeEmail(v.email) : null,
      phone: v.phone ? normalizePhone(v.phone) : null,
    }));
}

/** Online sign-ups collect name, email and phone. */
export const contactSchema = build(true);
/** Staff walk-in sign-ups need name and phone; email is optional. */
export const walkInContactSchema = build(false);

export type Contact = { name: string; email: string | null; phone: string | null };
