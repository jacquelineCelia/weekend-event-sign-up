import { z } from 'zod';

/**
 * Without a "+", a number is read as US/Canada. There the area code and the next three digits never
 * start with 0 or 1, so "0912 345 678" (a Taiwan mobile typed the local way) is not one: it needs
 * "+" and the country code. (An 11-digit number starting with 1, like a mainland mobile, can't be
 * told apart from "1 + a US number", so it is still read as US.)
 */
function looksForeign(digits: string) {
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? /^[01]/.test(national) || /^\d{3}[01]/.test(national) : digits.length !== 10;
}

/** Normalises a phone number to E.164, assuming US/Canada when no country code is given. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (looksForeign(digits)) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Why a phone number can't be used: "phone_country_code" when it reads as a non-US number without "+". */
export function phoneProblem(input: string): 'phone_country_code' | 'phone_invalid' | null {
  if (normalizePhone(input)) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  return !trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15 ? 'phone_country_code' : 'phone_invalid';
}

export function normalizeEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  return z.string().email().safeParse(v).success ? v : null;
}

/**
 * A short form of an email for tight spaces: "parks@gmail.com" becomes "pa•••@gmail.com". Longer
 * domains are shortened too: "parks@yellowflower.org" becomes "pa•••@ye•••.org".
 */
export function briefEmail(email: string) {
  const at = email.lastIndexOf('@');
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const shortDomain = domain.length <= 11 || dot < 2 ? domain : `${domain.slice(0, 2)}•••${domain.slice(dot)}`;
  return `${email.slice(0, Math.min(2, at))}•••@${shortDomain}`;
}

const raw = z.object({
  name: z.string().trim().min(1, 'name_required').max(120),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(40).default(''),
});

function build({ emailRequired, phoneRequired }: { emailRequired: boolean; phoneRequired: boolean }) {
  // superRefine runs even when the name is missing, so every problem shows at once.
  // Messages are codes (see errors in i18n.ts), turned into words in the visitor's language.
  return raw
    .superRefine((v, ctx) => {
      if (v.email && !normalizeEmail(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_invalid' });
      if (!v.email && emailRequired) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email_required' });
      const bad = v.phone ? phoneProblem(v.phone) : null;
      if (bad) ctx.addIssue({ code: 'custom', path: ['phone'], message: bad });
      if (!v.phone && phoneRequired) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone_required' });
    })
    .transform((v) => ({
      name: v.name,
      email: v.email ? normalizeEmail(v.email) : null,
      phone: v.phone ? normalizePhone(v.phone) : null,
    }));
}

/**
 * Online and walk-in sign-ups need a name and an email; the mobile number is optional (some
 * attendees don't have one; user's request, 2026-11-03). Without one: no texts, and staff find
 * them at check-in by name or code.
 */
export const contactSchema = build({ emailRequired: true, phoneRequired: false });
export const walkInContactSchema = build({ emailRequired: true, phoneRequired: false });

export type Contact = { name: string; email: string | null; phone: string | null };
