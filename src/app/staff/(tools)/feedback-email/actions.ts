'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/session';
import { addSkips, removeSkip, sendInviteBatch, sendInviteTest } from '@/lib/feedback-invites';
import type { Lang } from '@/lib/event';

async function requireStaff() {
  if (!(await isStaff())) redirect('/staff/login');
}

export async function addSkipsAction(_prev: unknown, form: FormData) {
  await requireStaff();
  const r = await addSkips(String(form.get('emails') ?? ''));
  revalidatePath('/staff/feedback-email');
  return r;
}

export async function removeSkipAction(form: FormData) {
  await requireStaff();
  await removeSkip(String(form.get('email') ?? ''));
  revalidatePath('/staff/feedback-email');
}

export async function sendTestAction(_prev: unknown, form: FormData) {
  await requireStaff();
  const to = String(form.get('to') ?? '').trim();
  const lang = String(form.get('lang') ?? 'zh') as Lang;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: '請輸入有效的 email。' };
  try {
    const r = await sendInviteTest(to, ['zh', 'zhs', 'en'].includes(lang) ? lang : 'zh');
    return r.delivered ? { ok: true, message: `測試信已寄到 ${to}。` } : { ok: false, message: '這個環境沒有設定寄信（EMAIL_FROM / RESEND_API_KEY），信只記錄在伺服器 log。' };
  } catch (e) {
    return { ok: false, message: `寄送失敗：${e instanceof Error ? e.message.slice(0, 200) : e}` };
  }
}

export async function sendBatchAction() {
  await requireStaff();
  const r = await sendInviteBatch(25);
  revalidatePath('/staff/feedback-email');
  return r;
}
