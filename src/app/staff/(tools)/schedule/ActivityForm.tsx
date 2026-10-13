'use client';

import { useActionState } from 'react';
import { saveActivityAction, type ScheduleState } from '../../actions';

type A = { id: string; name: string; place: string; durationMin: number; description: string } | null;

export default function ActivityForm({ activity }: { activity: A }) {
  const [state, action, pending] = useActionState<ScheduleState, FormData>(saveActivityAction.bind(null, activity?.id ?? null), null);
  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="field"><label htmlFor="an">Name</label><input id="an" name="name" className="input" defaultValue={activity?.name} required /></div>
        <div className="field"><label htmlFor="ap">Place</label><input id="ap" name="place" className="input" defaultValue={activity?.place} required /></div>
        <div className="field"><label htmlFor="ad">Length (minutes)</label><input id="ad" name="durationMin" type="number" min={5} max={600} step={5} className="input" defaultValue={activity?.durationMin ?? 60} required /></div>
      </div>
      <div className="field">
        <label htmlFor="ades">Description <span className="muted" style={{ fontWeight: 400 }}>(shown to attendees)</span></label>
        <textarea id="ades" name="description" className="input" rows={3} style={{ padding: 12, minHeight: 90, resize: 'vertical' }} defaultValue={activity?.description} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" type="submit" disabled={pending} style={{ minHeight: 48 }}>{pending ? 'Saving…' : activity ? 'Save details' : 'Create activity'}</button>
        {state?.error ? <span className="error" role="alert">{state.error}</span> : null}
        {state?.saved ? <span role="status" style={{ color: 'var(--moss-dark)', fontSize: 14 }}>Saved.</span> : null}
      </div>
    </form>
  );
}
