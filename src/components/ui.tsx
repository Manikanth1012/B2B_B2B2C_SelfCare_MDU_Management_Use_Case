import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, FileText, CircleSlash, Clock, Info, Loader2, PauseCircle, Search, ShieldAlert, X, XCircle } from 'lucide-react';

/* ---------------- Buttons ---------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cta';
export function Button({ variant = 'primary', size = 'md', loading, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-6 text-sm',
        (variant === 'primary' || variant === 'cta') && 'bg-brand text-white shadow-sm hover:brightness-110',
        variant === 'secondary' && 'border-2 border-crimson/80 bg-white text-navy hover:bg-crimson-50',
        variant === 'ghost' && 'text-royal-700 hover:bg-royal-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', children, className }: { to: string; variant?: BtnVariant; size?: 'sm' | 'md'; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson',
        size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-6 text-sm',
        (variant === 'primary' || variant === 'cta') && 'bg-brand text-white shadow-sm hover:brightness-110',
        variant === 'secondary' && 'border-2 border-crimson/80 bg-white text-navy hover:bg-crimson-50',
        variant === 'ghost' && 'text-royal-700 hover:bg-royal-50',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Layout ---------------- */

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx('rounded-card border border-line-100 bg-white/95 shadow-[0_2px_14px_rgba(27,33,64,0.05)] backdrop-blur-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-6 pb-1 pt-5">
          {typeof title === 'string' ? <h2 className="text-[17px] font-bold text-navy">{title}</h2> : title}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('px-6 pb-6 pt-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, crumbs, actions }: { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; to?: string }[]; actions?: ReactNode }) {
  return (
    <div className="mb-6">
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-400">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {c.to ? (
                <Link to={c.to} className="hover:text-crimson hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-medium leading-tight text-navy">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const KPI_TONE: Record<string, { circle: string; text: string }> = {
  default: { circle: 'bg-[#11A7EA]', text: 'text-navy' },
  red: { circle: 'bg-[#FF4A12]', text: 'text-crimson' },
  orange: { circle: 'bg-[#FF8A00]', text: 'text-[#FF8A00]' },
  green: { circle: 'bg-[#2ECC40]', text: 'text-[#13A538]' },
  teal: { circle: 'bg-teal', text: 'text-cyan-700' },
};

/** Ticket-history style tile: coloured icon disc, large figure, caption. */
export function Kpi({ label, value, hint, tone = 'default', icon, to, active }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'orange' | 'green' | 'red' | 'teal'; icon?: ReactNode; to?: string; active?: boolean }) {
  const t = KPI_TONE[tone];
  const body = (
    <div className={clsx('flex h-full items-center gap-4 rounded-card border px-4 py-4 transition', active ? 'border-royal/30 bg-[#CFDCEB]' : 'border-line-100 bg-white/95', to && 'hover:border-crimson/40 hover:shadow-md')}>
      <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm', t.circle)}>{icon ?? <FileText className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate text-[26px] font-semibold leading-tight', t.text)}>{value}</p>
        <p className="text-[13px] font-medium text-ink-700">{label}</p>
        {hint && <p className="truncate text-[11px] text-ink-400">{hint}</p>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ---------------- Status badges (glyph + text, never colour alone) ---------------- */

const TONES: Record<string, { cls: string; icon: ReactNode }> = {
  green: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  blue: { cls: 'bg-blue-50 text-blue-800 border-blue-200', icon: <CircleDashed className="h-3.5 w-3.5" /> },
  amber: { cls: 'bg-amber-50 text-amber-800 border-amber-200', icon: <Clock className="h-3.5 w-3.5" /> },
  red: { cls: 'bg-red-50 text-red-800 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
  grey: { cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: <CircleSlash className="h-3.5 w-3.5" /> },
  purple: { cls: 'bg-violet-50 text-violet-800 border-violet-200', icon: <PauseCircle className="h-3.5 w-3.5" /> },
  orange: { cls: 'bg-orange-50 text-orange-800 border-orange-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  Active: 'green', Connected: 'green', Completed: 'green', Paid: 'green', Approved: 'green', Live: 'green', Ready: 'green', 'Service Available': 'green', Scheduled: 'blue',
  'Ready for Service': 'blue', Submitted: 'blue', Validating: 'blue', Onboarding: 'blue', Queued: 'blue', Open: 'blue', Invited: 'blue', Rescheduled: 'blue',
  'Pending Installation': 'amber', 'Pending Approval': 'amber', 'Pending Change': 'amber', Pending: 'amber', 'In Progress': 'amber', 'Awaiting Approval': 'amber', 'Partially Ready': 'amber', 'Survey Pending': 'amber', 'Additional Network Work Required': 'orange',
  'Network Not Ready': 'red', 'Not Ready': 'red', Overdue: 'red', Rejected: 'red', Failed: 'red', 'Service Not Available': 'red', Revoked: 'red', Critical: 'red',
  Suspended: 'purple',
  Closed: 'grey', Terminated: 'grey', Cancelled: 'grey', Vacant: 'grey', Unknown: 'grey', Occupied: 'blue',
  High: 'orange', Medium: 'amber', Low: 'grey',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = TONES[STATUS_TONE[status] ?? 'grey'];
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-semibold', t.cls, className)}>
      {t.icon}
      {status}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded bg-royal-50 px-1.5 py-0.5 text-xs font-semibold text-royal', className)}>{children}</span>;
}

export function SimNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-cyan-300 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children ?? 'Simulated operation — the prototype uses mock TM Forum API adapters. No live network, billing or payment system is changed.'}</span>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="mb-5 flex gap-2 overflow-x-auto border-b border-line-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={clsx('-mb-px whitespace-nowrap border-b-[4px] px-4 py-2.5 text-[15px] font-bold transition', active === t.id ? 'border-navy text-navy' : 'border-transparent text-ink-400 hover:text-navy')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Overlays ---------------- */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

function useFocusReturn(panel: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => prev?.focus?.();
  }, [panel]);
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <ModalInner {...{ onClose, title, children, footer, wide }} />;
}
function ModalInner({ onClose, title, children, footer, wide }: { onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useFocusReturn(ref);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={clsx('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-card', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return <DrawerInner {...{ onClose, title, subtitle, children, footer }} />;
}
function DrawerInner({ onClose, title, subtitle, children, footer }: { onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useFocusReturn(ref);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-navy/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl outline-none">
        <header className="flex items-start justify-between gap-3 bg-brand px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close panel" className="rounded p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onClose, loading }: { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-700">{body}</div>
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */

type ToastT = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(kind: ToastT['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastT[]>([]);
  const push = useCallback((kind: ToastT['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2 md:bottom-4">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg', t.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900', t.kind === 'error' && 'border-red-200 bg-red-50 text-red-900', t.kind === 'info' && 'border-blue-200 bg-blue-50 text-blue-900')}>
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : t.kind === 'error' ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Wrap an async action with loading state and error/success toasts. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast('success', typeof success === 'function' ? success(r) : success);
        return r;
      } catch (e) {
        toast('error', (e as Error).message);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}

/* ---------------- Forms ---------------- */

export function Field({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink-600">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}

export const inputCls = 'h-11 w-full rounded-md border border-line-200 bg-white px-3.5 text-sm text-navy placeholder:text-ink-400 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/15 disabled:bg-[#E9ECEF] disabled:text-ink-700';

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} aria-label={placeholder ?? 'Search'} className={clsx(inputCls, 'pl-9')} />
    </div>
  );
}

export function Select({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; label: string; className?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls.replace('w-full ', ''), 'pr-8', className ?? 'w-full')}>
      {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

/* ---------------- Data table (cards on mobile) ---------------- */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  mobileHidden?: boolean;
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, pageSize = 10, empty = 'No records match your filters.', mobileTitle }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; empty?: string; mobileTitle?: (r: T) => ReactNode }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  useEffect(() => {
    setPage(0);
  }, [rows.length]);
  let sorted = rows;
  if (sort) {
    const col = columns.find((c) => c.key === sort.key);
    if (col?.sort) sorted = [...rows].sort((a, b) => (col.sort!(a) > col.sort!(b) ? 1 : col.sort!(a) < col.sort!(b) ? -1 : 0) * sort.dir);
  }
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div>
      <div className="hidden overflow-x-auto rounded-md border border-line-100 md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-brand text-[13px] text-white">
              {columns.map((c) => (
                <th key={c.key} className={clsx('px-4 py-3.5 font-bold first:rounded-tl-md last:rounded-tr-md', c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-sunny" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx('border-b border-line-100 bg-white/90 last:border-0', onRowClick && 'cursor-pointer hover:bg-crimson-50/60')}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-4 py-3 align-middle text-ink-700', c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {view.map((r) => (
          <li key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx('rounded-2xl border border-line-100 bg-white p-4', onRowClick && 'cursor-pointer active:bg-crimson-50')}>
            {mobileTitle && <div className="mb-1.5 font-semibold text-navy">{mobileTitle(r)}</div>}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {columns
                .filter((c) => !c.mobileHidden)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-slate-500">{c.header}</dt>
                    <dd className="truncate text-slate-800">{c.render(r)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="mt-3 rounded-md bg-[#D3EAF0] px-6 py-6 text-[15px] text-ink-700">{empty}</p>}
      {rows.length > pageSize && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>
            {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Loading / error ---------------- */

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-royal" />
      {label}
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  const denied = error.name === 'AuthError';
  return (
    <div className={clsx('mx-auto my-10 max-w-lg rounded-lg border p-6 text-center', denied ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50')}>
      <ShieldAlert className={clsx('mx-auto mb-2 h-8 w-8', denied ? 'text-amber-600' : 'text-red-600')} />
      <h2 className="font-bold text-navy">{denied ? 'Not available for your role' : 'Something went wrong'}</h2>
      <p className="mt-1 text-sm text-slate-700">{error.message}</p>
      {denied && <p className="mt-2 text-xs text-slate-500">Access is enforced by the data-access layer. Switch role in the header to explore other views.</p>}
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-navy">{children ?? '—'}</dd>
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'royal', label }: { value: number; max: number; tone?: 'royal' | 'orange' | 'green' | 'teal'; label?: string }) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div aria-label={label} role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full', tone === 'royal' && 'bg-royal', tone === 'orange' && 'bg-brandorange', tone === 'green' && 'bg-emerald-500', tone === 'teal' && 'bg-teal')} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li key={s} className={clsx('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', i < current && 'border-emerald-200 bg-emerald-50 text-emerald-800', i === current && 'border-transparent bg-brand text-white', i > current && 'border-line-200 bg-white text-ink-400')} aria-current={i === current ? 'step' : undefined}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">{i < current ? '✓' : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
