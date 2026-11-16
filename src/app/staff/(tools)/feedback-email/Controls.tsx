'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addSkipsAction, sendBatchAction, sendTestAction } from './actions';

export function SkipForm() {
  const [state, action, pending] = useActionState(addSkipsAction, null);
  return (
    <form action={action} className="stack" style={{ gap: 8 }}>
      <label htmlFor="skip-emails" style={{ fontWeight: 600 }}>貼上已填寫回饋的 email（任何格式，每行一個或用逗號分開都可以）</label>
      <textarea id="skip-emails" name="emails" className="input" rows={5} placeholder="name@example.com" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <button type="submit" className="btn ghost" disabled={pending}>{pending ? '處理中…' : '從寄送名單移除'}</button>
        {state ? (
          <span role="status" className="stack" style={{ gap: 2 }}>
            <span>找到 {state.found} 個 email：</span>
            {state.removed ? <span>・{state.removed} 個已從寄送名單移除</span> : null}
            {state.alreadyFilled ? <span>・{state.alreadyFilled} 個已在網站填寫過表單，本來就不會寄</span> : null}
            {state.alreadySent ? <span>・{state.alreadySent} 個已經寄出過了</span> : null}
            {state.notFound.length ? <span>・{state.notFound.length} 個找不到 11/14–11/15 的報名：{state.notFound.join('、')}</span> : null}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function TestForm() {
  const [state, action, pending] = useActionState(sendTestAction, null);
  return (
    <form action={action} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input name="to" type="email" className="input" placeholder="你的 email" style={{ flex: '1 1 220px' }} required />
      <select name="lang" className="input" style={{ flex: '0 0 auto', width: 'auto' }} defaultValue="zh">
        <option value="zh">繁中</option>
        <option value="zhs">简中</option>
        <option value="en">English</option>
      </select>
      <button type="submit" className="btn ghost" disabled={pending}>{pending ? '寄送中…' : '寄測試信'}</button>
      {state ? <p role="status" style={{ flex: '1 0 100%', margin: 0, color: state.ok ? 'var(--moss-dark)' : 'var(--ochre)' }}>{state.message}</p> : null}
    </form>
  );
}

/** Sends in batches of 25 until none are left, showing progress; stops on errors. */
export function SendAll({ todo }: { todo: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  async function run() {
    if (!window.confirm(`確定要寄出邀請信給 ${todo} 個 email 嗎？寄出後無法收回。`)) return;
    setBusy(true);
    setLog([]);
    let total = 0;
    try {
      for (;;) {
        const r = await sendBatchAction();
        total += r.sent;
        setLog((x) => [...x, `已寄出 ${total} 封，剩下 ${r.left} 個。`, ...r.failed.map((f) => `⚠ ${f.email}：${f.error}`)]);
        if (r.failed.length || r.left === 0 || r.sent === 0) break;
      }
    } catch (e) {
      setLog((x) => [...x, `⚠ 中斷：${e instanceof Error ? e.message : e}。可以再按一次繼續，已寄出的不會重寄。`]);
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button type="button" className="btn" onClick={run} disabled={busy || todo === 0}>
        {busy ? '寄送中，請不要關閉這個頁面…' : todo ? `寄出邀請信給 ${todo} 個 email` : '沒有需要寄出的 email'}
      </button>
      {log.length ? <div role="status" className="stack" style={{ gap: 2 }}>{log.map((l, i) => <span key={i}>{l}</span>)}</div> : null}
    </div>
  );
}
