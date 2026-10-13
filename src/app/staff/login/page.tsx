import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/session';
import { EVENT } from '@/lib/event';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function StaffLogin() {
  if (await isStaff()) redirect('/staff');
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="pad stack" style={{ gap: 18, padding: '40px 20px' }}>
        <span className="eyebrow">{EVENT.name} · Staff</span>
        <h1 className="h1">Staff sign-in</h1>
        <p className="lede">Enter the staff passcode to check people in, add walk-ins and manage the schedule.</p>
        <LoginForm />
      </div>
    </div>
  );
}
