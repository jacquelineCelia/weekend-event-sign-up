import { NextResponse } from 'next/server';
import { attendees } from '@/lib/staff';
import { dayOf, fmtTimeL, localDate } from '@/lib/event';
import { localText } from '@/lib/hans';
import { displayPhone } from '@/lib/contact';
import { isStaff } from '@/lib/session';
import { staffLang } from '@/lib/staff-lang';
import { sdict } from '@/lib/staff-i18n';

export const dynamic = 'force-dynamic';

/** Text typed by attendees: quoted, and a leading = + - @ is defused so spreadsheet apps don't run it as a formula. */
const cell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Phone numbers are stored normalized (+ and digits only). US/Canada numbers are written as (412) 555-0199;
 * others as ="+886…" so spreadsheets keep the + and don't turn the number into 8.86E+11.
 */
const phoneCell = (phone: string) => {
  if (!phone) return '""';
  const shown = displayPhone(phone);
  return shown.startsWith('+') ? `"=""${shown}"""` : `"${shown}"`;
};

/** Staff: every current sign-up as a CSV, one row per sign-up, in the staff language. Under /staff for the staff cookie. */
export async function GET() {
  if (!(await isStaff())) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const lang = await staffLang();
  const t = sdict(lang).people;
  const lines: string[] = [t.csvHead.map(cell).join(',')];
  for (const p of await attendees()) {
    for (const s of p.signups) {
      lines.push([
        cell(p.name), cell(p.email), phoneCell(p.phone),
        cell(dayOf(s.startsAt)?.date ?? localDate(s.startsAt)), cell(fmtTimeL(s.startsAt, lang)),
        cell(localText(s.activityName, s.activityNameZh, lang)), cell(localText(s.place, s.placeZh, lang)),
        cell(s.partySize), cell(s.seats.map((x) => `${localText(x.name, x.nameZh, lang)} × ${x.count}`).join('; ')),
        cell(s.code), cell(s.checkedIn), cell(s.walkIn ? t.walkIn : t.online),
      ].join(','));
    }
  }
  // The byte-order mark makes Excel read the file as UTF-8, so Chinese shows correctly.
  const body = '﻿' + lines.join('\r\n') + '\r\n';
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendees.csv"; filename*=UTF-8''${encodeURIComponent(`${t.file}.csv`)}`,
      'Cache-Control': 'no-store',
    },
  });
}
