import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { can } from '../../api/api';

/** Left vertical section list + content pane, as in the template's settings screens. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const links = [
    { to: '/settings', label: 'Customer Settings' },
    { to: '/settings/account', label: 'Account Settings' },
    { to: '/settings/notifications', label: 'Notifications' },
    ...(can('audit.read') || can('approval.decide') ? [{ to: '/settings/audit', label: 'Audit History' }] : []),
  ];
  return (
    <div className="grid min-h-[640px] overflow-hidden rounded-card border border-line-100 bg-white/90 backdrop-blur-sm lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col border-b border-line-100 px-6 py-6 lg:border-b-0 lg:border-r lg:py-10">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => clsx('whitespace-nowrap border-line-100 px-4 py-4 text-lg lg:border-b lg:text-[22px]', isActive ? 'font-bold text-royal-700' : 'text-ink-700 hover:text-royal-700')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => nav('/login')} className="mx-auto mt-8 hidden h-12 w-44 rounded-full bg-brand text-base font-bold text-white hover:brightness-110 lg:mt-auto lg:block">
          Logout
        </button>
      </aside>
      <section className="min-w-0 px-5 py-6 sm:px-10 lg:py-10">{children}</section>
    </div>
  );
}

export function EditRow({ label, value, action, onAction }: { label: string; value: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-100 px-6 py-5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-ink-600">{label}</p>
        <p className="mt-1 truncate text-lg text-navy sm:text-xl">{value}</p>
      </div>
      {action && onAction && (
        <button onClick={onAction} className="shrink-0 text-[15px] font-bold text-royal hover:underline">
          {action}
        </button>
      )}
    </div>
  );
}
