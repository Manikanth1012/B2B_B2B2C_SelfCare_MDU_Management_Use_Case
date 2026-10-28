import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, Building2, ChevronDown, CreditCard, Home, LayoutDashboard, LifeBuoy, Menu, Network, User, Wifi, X } from 'lucide-react';
import { can, currentUser, demoUsers, listApprovals } from '../api/api';
import { setSessionUserId } from '../data/store';
import { useApi, useDbVersion } from '../lib/hooks';
import type { Permission } from '../data/types';
import { useToast } from './ui';

interface NavItem {
  label: string;
  to: string;
  perm?: Permission;
  roles?: string[];
  hideFor?: string[];
}
interface NavGroup extends NavItem {
  items?: NavItem[];
}

/* Top navigation, following the 6D self-care template (My Account · Bills & Payments · Orders · Service Center). */
const NAV: NavGroup[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'My Home', to: '/home', roles: ['RESIDENT'] },
  {
    label: 'Accounts', to: '/accounts', perm: 'account.read', hideFor: ['RESIDENT', 'MDU_PM'],
    items: [
      { label: 'All Business Accounts', to: '/accounts' },
      { label: 'Account Hierarchy', to: '/accounts/hierarchy' },
      { label: 'Create Child Account', to: '/accounts/new', perm: 'account.create' },
      { label: 'Contacts & Delegation', to: '/accounts/contacts' },
    ],
  },
  {
    label: 'MDU', to: '/mdu', perm: 'property.read', hideFor: ['RESIDENT'],
    items: [
      { label: 'MDU Portfolio', to: '/mdu' },
      { label: 'Buildings / Towers / Units', to: '/mdu/units' },
      { label: 'Occupancy Management', to: '/mdu/occupancy', perm: 'unit.manage' },
      { label: 'Register New MDU', to: '/mdu/new', perm: 'property.create' },
      { label: 'Bulk Unit Import', to: '/mdu/import', perm: 'unit.manage' },
    ],
  },
  {
    label: 'Services', to: '/services', perm: 'service.read',
    items: [
      { label: 'Active Services', to: '/services' },
      { label: 'Service Availability', to: '/services/availability' },
      { label: 'New Connection', to: '/services/new', perm: 'service.order' },
      { label: 'Plan Changes', to: '/services/changes', perm: 'service.order' },
      { label: 'Bulk Activation', to: '/services/bulk', perm: 'service.bulk' },
    ],
  },
  {
    label: 'Bills & Payments', to: '/billing', perm: 'billing.read',
    items: [
      { label: 'Bills & Payments', to: '/billing' },
      { label: 'Billing Hierarchy', to: '/billing/hierarchy', hideFor: ['RESIDENT'] },
      { label: 'Cost Allocation', to: '/billing/allocation', hideFor: ['RESIDENT'] },
      { label: 'Billing Preferences', to: '/billing/preferences' },
    ],
  },
  {
    label: 'Service Center', to: '/requests',
    items: [
      { label: 'All Tickets', to: '/requests' },
      { label: 'Service Requests', to: '/requests?kind=Service%20Request' },
      { label: 'Incident Tickets', to: '/requests?kind=Incident' },
      { label: 'Bulk Requests', to: '/requests?category=Bulk%20Activation', hideFor: ['RESIDENT', 'BILLING_ADMIN'] },
      { label: 'Appointments', to: '/requests/appointments' },
      { label: 'Create Ticket', to: '/requests/new', perm: 'request.create' },
    ],
  },
  {
    label: 'Admin', to: '/approvals', hideFor: ['RESIDENT'],
    items: [
      { label: 'Approval Requests', to: '/approvals' },
      { label: 'Portal Users', to: '/users', perm: 'user.manage' },
      { label: 'Roles & Permissions', to: '/users/roles' },
      { label: 'Reports & Analytics', to: '/reports', perm: 'reports.read' },
      { label: 'Read me · Demo guide', to: '/guide', hideFor: ['OPERATOR', 'ENT_SUPER', 'BIZ_ADMIN', 'MDU_PM', 'BILLING_ADMIN', 'RESIDENT'] },
    ],
  },
];

function visible(x: { perm?: Permission; roles?: string[]; hideFor?: string[] }, role: string) {
  if (x.roles && !x.roles.includes(role)) return false;
  if (x.hideFor?.includes(role)) return false;
  return !x.perm || can(x.perm);
}

function useNavGroups() {
  useDbVersion();
  const role = currentUser().roleId;
  return NAV.filter((g) => visible(g, role)).map((g) => ({ ...g, items: g.items?.filter((i) => visible(i, role)) }));
}

function isGroupActive(g: NavGroup, path: string) {
  if (g.to === '/') return path === '/';
  const prefixes = [g.to, ...(g.items ?? []).map((i) => i.to.split('?')[0])];
  if (g.label === 'Admin') return ['/approvals', '/users', '/reports', '/guide'].some((p) => path.startsWith(p));
  if (g.label === 'Services') return path.startsWith('/services');
  return prefixes.some((p) => p !== '/' && path.startsWith(p));
}

function TopNav() {
  const groups = useNavGroups();
  const loc = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(null);
  }, [loc.pathname, loc.search]);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <nav aria-label="Main" ref={ref} className="hidden items-center gap-0.5 xl:flex 2xl:gap-1">
      {groups.map((g) => {
        const active = isGroupActive(g, loc.pathname);
        const cls = clsx('relative flex items-center gap-1 whitespace-nowrap px-2 py-2 text-[14px] font-bold transition 2xl:px-3 2xl:text-[15px]', active ? 'text-sunny' : 'text-white hover:text-sunny');
        const underline = active && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] rounded bg-sunny" />;
        if (!g.items?.length)
          return (
            <NavLink key={g.label} to={g.to} end className={cls}>
              {g.label}
              {underline}
            </NavLink>
          );
        return (
          <div key={g.label} className="relative">
            <button className={cls} aria-expanded={open === g.label} aria-haspopup="menu" onClick={() => setOpen(open === g.label ? null : g.label)}>
              {g.label}
              <ChevronDown className={clsx('h-3.5 w-3.5 transition', open === g.label && 'rotate-180')} />
              {underline}
            </button>
            {open === g.label && (
              <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line-100 bg-white py-2 shadow-xl">
                {g.items.map((i) => (
                  <NavLink key={i.to} role="menuitem" to={i.to} className="block px-4 py-2 text-sm font-medium text-ink-700 hover:bg-crimson-50 hover:text-crimson">
                    {i.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
  const groups = useNavGroups();
  return (
    <div className="fixed inset-0 z-50 bg-navy/50 xl:hidden" onClick={onClose}>
      <aside className="h-full w-[300px] overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand p-4">
          <img src="./brand/6d-logo-white.png" alt="6D Technologies" className="h-7" />
          <button onClick={onClose} aria-label="Close menu" className="rounded p-1 text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Mobile" className="p-3">
          {groups.map((g) => (
            <div key={g.label} className="mb-2">
              <NavLink to={g.to} end onClick={onClose} className="block rounded-lg px-3 py-2 text-[15px] font-bold text-navy hover:bg-crimson-50">
                {g.label}
              </NavLink>
              {g.items?.map((i) => (
                <NavLink key={i.to} to={i.to} onClick={onClose} className="block rounded-lg px-6 py-1.5 text-sm text-ink-600 hover:text-crimson">
                  {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function UserMenu() {
  useDbVersion();
  const user = currentUser();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const users = demoUsers();
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex items-center gap-3 text-left text-white">
        <span className="hidden max-w-[170px] text-right leading-tight lg:block xl:hidden 2xl:block">
          <span className="block truncate text-[15px] font-bold uppercase">{user.name}</span>
          <span className="block text-[11px] text-white/80">{users.find((u) => u.id === user.id)?.role.name}</span>
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
          <User className="h-5 w-5" />
        </span>
        <ChevronDown className="hidden h-4 w-4 sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute right-0 z-40 mt-3 w-[min(92vw,350px)] rounded-2xl border border-line-100 bg-white p-2 shadow-2xl">
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Switch demo role</p>
            {users.map((u) => (
              <button
                key={u.id}
                role="option"
                aria-selected={u.id === user.id}
                onClick={() => {
                  setSessionUserId(u.id);
                  setOpen(false);
                  nav('/');
                  toast('info', `Signed in as ${u.name} — ${u.role.name}`);
                }}
                className={clsx('flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-crimson-50', u.id === user.id && 'bg-crimson-50')}
              >
                <span className="text-sm font-bold text-navy">{u.name}</span>
                <span className="text-xs text-ink-600">
                  {u.role.name} · {u.title}
                </span>
              </button>
            ))}
            <div className="mt-1 flex gap-1 border-t border-line-100 p-1 pt-2">
              <button onClick={() => (setOpen(false), nav('/settings'))} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-royal-700 hover:bg-royal-50">
                Settings
              </button>
              <button onClick={() => (setOpen(false), nav('/login'))} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-crimson hover:bg-crimson-50">
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ApprovalBell() {
  const approvals = useApi(listApprovals);
  const pending = approvals.data?.filter((a) => a.canDecide).length ?? 0;
  const nav = useNavigate();
  if (currentUser().roleId === 'RESIDENT') return null;
  return (
    <button onClick={() => nav('/approvals')} aria-label={`${pending} approvals awaiting your decision`} className="relative rounded-full p-2 text-white hover:bg-white/10">
      <Bell className="h-5 w-5" />
      {pending > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sunny px-1 text-[10px] font-bold text-navy">{pending}</span>}
    </button>
  );
}

const BOTTOM: { to: string; label: string; icon: ReactNode; perm?: Permission; roles?: string[]; hideFor?: string[] }[] = [
  { to: '/', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/accounts/hierarchy', label: 'Accounts', icon: <Network className="h-5 w-5" />, perm: 'account.read', hideFor: ['RESIDENT', 'MDU_PM'] },
  { to: '/mdu/units', label: 'Units', icon: <Building2 className="h-5 w-5" />, perm: 'property.read', hideFor: ['RESIDENT'] },
  { to: '/home', label: 'My Home', icon: <Home className="h-5 w-5" />, roles: ['RESIDENT'] },
  { to: '/services', label: 'Services', icon: <Wifi className="h-5 w-5" />, roles: ['RESIDENT'] },
  { to: '/billing', label: 'Bills', icon: <CreditCard className="h-5 w-5" />, perm: 'billing.read' },
  { to: '/requests', label: 'Tickets', icon: <LifeBuoy className="h-5 w-5" /> },
];

export function Layout({ children }: { children: ReactNode }) {
  useDbVersion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const user = currentUser();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const bottom = BOTTOM.filter((b) => visible(b, user.roleId)).slice(0, 5);
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Decorative template background — purely visual, never interactive. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[330px] top-[220px] h-[640px] w-[640px] opacity-40 deco-ring-teal md:opacity-70" />
        <div className="absolute -left-10 top-16 h-40 w-40 rounded-full bg-[#D7E7F0]/70" />
        <div className="absolute -right-[230px] top-[40px] hidden h-[480px] w-[480px] opacity-80 deco-ring-coral md:block" />
        <div className="absolute bottom-0 right-0 h-[260px] w-[440px] opacity-25 deco-dots" />
      </div>
      <header className="sticky top-0 z-30 bg-brand shadow-md">
        <div className="mx-auto flex h-[84px] max-w-[1600px] items-center gap-4 px-4 sm:px-8">
          <button className="rounded p-1.5 text-white hover:bg-white/10 xl:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <NavLink to="/" className="shrink-0">
            <img src="./brand/6d-logo.png" alt="6D Technologies" className="h-9 w-auto sm:h-11" />
          </NavLink>
          <div className="ml-auto flex min-w-0 items-center gap-2 xl:ml-4 xl:flex-1">
            <TopNav />
            <div className="ml-auto flex items-center gap-2">
              <ApprovalBell />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>
      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
      <main id="main" className="relative z-10 mx-auto min-w-0 max-w-[1600px] px-4 pb-28 pt-8 sm:px-8 md:pb-24">
        {children}
      </main>
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line-100 bg-white md:hidden">
        {bottom.map((b) => (
          <NavLink key={b.to} to={b.to} end className={({ isActive }) => clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold', isActive ? 'text-crimson' : 'text-ink-400')}>
            {b.icon}
            {b.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
