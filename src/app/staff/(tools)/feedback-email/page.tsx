import { inviteEmail, inviteSummary, type Invitee } from '@/lib/feedback-invites';
import { removeSkipAction } from './actions';
import { SendAll, SkipForm, TestForm } from './Controls';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LANG = { zh: '繁中', zhs: '简中', en: 'EN' } as const;

function List({ rows, remove }: { rows: Invitee[]; remove?: boolean }) {
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>（沒有）</p>;
  return (
    <table className="fbi-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.email}>
            <td>{r.names.join('、')}</td>
            <td>{r.email}</td>
            <td>{LANG[r.lang] ?? r.lang}</td>
            {remove ? (
              <td><form action={removeSkipAction}><input type="hidden" name="email" value={r.email} /><button type="submit" className="linkbtn">放回名單</button></form></td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One-time tool (not in the staff tabs): email everyone who signed up an invitation to the feedback
 * form. Shows who will get it, lets staff paste addresses of people who already gave feedback,
 * sends a test, then sends to all in batches. Written in 繁中 only (used by the organiser).
 */
export default async function FeedbackEmail() {
  const s = await inviteSummary();
  const sample = inviteEmail('zh', ['王小明']);
  return (
    <div className="staffbody" style={{ display: 'block' }}>
      <div className="stack fbi" style={{ gap: 22, maxWidth: 820, margin: '0 auto', padding: '24px 20px 60px' }}>
        <h1 className="h1" style={{ margin: 0 }}>寄出回饋表單邀請信</h1>
        <div className="fbi-stats">
          <div><b>{s.todo.length}</b><span>將寄出</span></div>
          <div><b>{s.sent.length}</b><span>已寄出</span></div>
          <div><b>{s.filled.length}</b><span>已在網站填寫（略過）</span></div>
          <div><b>{s.listed.length}</b><span>你名單上的（略過）</span></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          收件人：11/14–11/15 有報名的所有 email（包括取消報名的人），同一個 email 只寄一封，信中稱呼所有用這個 email 報名的人。語言依報名時使用的語言。
          {s.noEmail ? ` 另有 ${s.noEmail} 位現場報名者沒有留 email，無法寄送。` : ''}
        </p>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="fbi-h2">1. 移除已填寫回饋的人</h2>
          <SkipForm />
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="fbi-h2">2. 先寄一封測試信給自己</h2>
          <TestForm />
          <details>
            <summary>預覽信件（繁中）</summary>
            <p style={{ margin: '8px 0 4px' }}><b>主旨：</b>{sample.subject}</p>
            <iframe title="預覽" srcDoc={sample.html} style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }} />
          </details>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="fbi-h2">3. 寄給所有人</h2>
          <SendAll todo={s.todo.length} />
          <details><summary>將寄出的名單（{s.todo.length}）</summary><List rows={s.todo} /></details>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <details><summary>已寄出（{s.sent.length}）</summary><List rows={s.sent} /></details>
          <details><summary>已在網站填寫，不寄（{s.filled.length}）</summary><List rows={s.filled} /></details>
          <details><summary>你名單上的，不寄（{s.listed.length}）</summary><List rows={s.listed} remove /></details>
        </section>
      </div>
    </div>
  );
}
