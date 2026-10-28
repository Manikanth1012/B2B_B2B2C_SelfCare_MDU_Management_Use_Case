import { useNavigate } from 'react-router-dom';
import { demoUsers } from '../api/api';
import { setSessionUserId } from '../data/store';

/** Demo sign-in: pick a persona. Real deployments authenticate via the operator IdP. */
export function Login() {
  const nav = useNavigate();
  const users = demoUsers();
  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="text-[32px] font-medium text-navy">Sign in</h1>
      <p className="mb-6 text-ink-600">
        You have signed out. Choose a demo persona to continue — each sees only its authorised accounts, properties and units. New here?{' '}
        <button className="font-bold text-royal hover:underline" onClick={() => nav('/guide')}>
          Open the demo guide
        </button>
        .
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              setSessionUserId(u.id);
              nav('/');
            }}
            className="rounded-card border border-line-100 bg-white/95 p-5 text-left transition hover:border-crimson/40 hover:shadow-md"
          >
            <p className="text-lg font-bold text-navy">{u.name}</p>
            <p className="text-sm font-semibold text-crimson">{u.role.name}</p>
            <p className="mt-1 text-xs text-ink-600">{u.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
