import { normalizePhone, type Contact } from '@/lib/contact';

/** A walk-in on record with no email (made before email became required on the form). */
export const noEmail = (name: string, phone: string): Contact => ({ name, email: null, phone: normalizePhone(phone) });
