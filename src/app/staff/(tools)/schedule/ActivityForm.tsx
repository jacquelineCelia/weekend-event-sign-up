'use client';

import { useActionState } from 'react';
import { saveActivityAction, type ScheduleState } from '../../actions';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

type A = { id: string; name: string; place: string; durationMin: number; description: string; nameZh: string; placeZh: string; descriptionZh: string; instructor: string; instructorZh: string } | null;

export default function ActivityForm({ activity, lang }: { activity: A; lang: Lang }) {
  const t = sdict(lang);
  const [state, action, pending] = useActionState<ScheduleState, FormData>(saveActivityAction.bind(null, activity?.id ?? null), null);
  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="field"><label htmlFor="an">{t.name}</label><input id="an" name="name" className="input" defaultValue={activity?.name} required /></div>
        <div className="field"><label htmlFor="ap">{t.place}</label><input id="ap" name="place" className="input" defaultValue={activity?.place} required /></div>
        <div className="field"><label htmlFor="ad">{t.lengthMin}</label><input id="ad" name="durationMin" type="number" min={5} max={600} step={5} className="input" defaultValue={activity?.durationMin ?? 60} required /></div>
      </div>
      <div className="field">
        <label htmlFor="ai">{t.instructor} <span className="muted" style={{ fontWeight: 400 }}>{t.instructorNote}</span></label>
        <input id="ai" name="instructor" className="input" defaultValue={activity?.instructor} maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="ades">{t.description} <span className="muted" style={{ fontWeight: 400 }}>{t.shownToAttendees}</span></label>
        <textarea id="ades" name="description" className="input" rows={3} style={{ padding: 12, minHeight: 90, resize: 'vertical' }} defaultValue={activity?.description} />
      </div>
      <fieldset lang="zh-Hant-TW" style={{ border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <legend lang="en" style={{ fontWeight: 600, padding: '0 6px' }}>
          {t.chineseLegend} <span className="muted" style={{ fontWeight: 400 }}>{t.chineseLegendNote}</span>
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="field"><label htmlFor="anz">名稱{lang === 'en' ? <> <span lang="en" className="muted" style={{ fontWeight: 400 }}>Name</span></> : null}</label><input id="anz" name="nameZh" className="input" defaultValue={activity?.nameZh} /></div>
          <div className="field"><label htmlFor="apz">地點{lang === 'en' ? <> <span lang="en" className="muted" style={{ fontWeight: 400 }}>Place</span></> : null}</label><input id="apz" name="placeZh" className="input" defaultValue={activity?.placeZh} /></div>
          <div className="field"><label htmlFor="aiz">帶領老師{lang === 'en' ? <> <span lang="en" className="muted" style={{ fontWeight: 400 }}>Instructor</span></> : null}</label><input id="aiz" name="instructorZh" className="input" defaultValue={activity?.instructorZh} maxLength={80} /></div>
        </div>
        <div className="field">
          <label htmlFor="adesz">說明{lang === 'en' ? <> <span lang="en" className="muted" style={{ fontWeight: 400 }}>Description</span></> : null}</label>
          <textarea id="adesz" name="descriptionZh" className="input" rows={3} style={{ padding: 12, minHeight: 90, resize: 'vertical' }} defaultValue={activity?.descriptionZh} />
        </div>
      </fieldset>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" type="submit" disabled={pending} style={{ minHeight: 48 }}>{pending ? t.saving : activity ? t.saveDetails : t.createActivity}</button>
        {state?.error ? <span className="error" role="alert">{state.error}</span> : null}
        {state?.saved ? <span role="status" style={{ color: 'var(--moss-dark)', fontSize: 14 }}>{t.saved}</span> : null}
      </div>
    </form>
  );
}
