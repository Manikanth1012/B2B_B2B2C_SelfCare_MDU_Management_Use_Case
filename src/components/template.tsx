/*
 * Building blocks lifted from the 6D self-care template: welcome header,
 * offer carousel, status-tab service tiles, amount-due tile and quick links.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Pencil } from 'lucide-react';

export function Welcome({ name, id, onEdit }: { name: string; id: string; onEdit?: () => void }) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-normal leading-tight text-navy sm:text-[34px]">
        Welcome, <b className="font-bold uppercase">{name}</b>
      </h1>
      <p className="mt-1 flex items-center gap-2 text-lg text-ink-700 sm:text-xl">
        {id}
        {onEdit && (
          <button aria-label="Edit profile" onClick={onEdit} className="text-royal hover:text-royal-700">
            <Pencil className="h-5 w-5" />
          </button>
        )}
      </p>
    </div>
  );
}

export interface Slide {
  title: string;
  body: string;
  cta: string;
  to: string;
  image: string;
}

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i];
  return (
    <section aria-roledescription="carousel" aria-label="Offers" className="relative mb-8 h-[240px] overflow-hidden rounded-[28px] bg-navy sm:h-[300px]">
      {slides.map((x, k) => (
        <img key={x.image} src={x.image} alt="" aria-hidden className={clsx('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', k === i ? 'opacity-100' : 'opacity-0')} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
      <div className="relative flex h-full flex-col justify-center px-6 sm:px-14" aria-live="polite">
        <span className="mb-4 w-fit rounded bg-sunny px-4 py-1.5 text-sm font-medium text-navy">Offers</span>
        <h2 className="max-w-xl text-xl font-bold text-white sm:text-2xl">{s.title}</h2>
        <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-[17px]">{s.body}</p>
        <button onClick={() => nav(s.to)} className="mt-6 h-11 w-fit rounded-full bg-brand px-8 text-sm font-bold text-white shadow-lg hover:brightness-110">
          {s.cta}
        </button>
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2.5">
        {slides.map((x, k) => (
          <button key={x.image} aria-label={`Show offer ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={clsx('h-3 w-3 rounded-full transition', k === i ? 'bg-white' : 'bg-white/40')} />
        ))}
      </div>
    </section>
  );
}

/** Service tile with the template's centred status tab on its top edge. */
export function StatusTile({ status, tone, children, onClick }: { status: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'grey'; children: ReactNode; onClick?: () => void }) {
  const tab = { green: 'bg-[#DFF3E8] text-[#13A538]', red: 'bg-[#F7C1CB] text-crimson', amber: 'bg-amber-100 text-amber-800', blue: 'bg-[#B3DAEE] text-navy', grey: 'bg-surface-100 text-ink-600' }[tone];
  return (
    <div onClick={onClick} className={clsx('relative rounded-card border border-line-100 bg-white px-6 pb-5 pt-10', onClick && 'cursor-pointer hover:border-crimson/40 hover:shadow-md')}>
      <span className={clsx('absolute left-1/2 top-0 -translate-x-1/2 rounded-b-md px-10 py-1 text-sm font-semibold', tab)}>{status}</span>
      {children}
    </div>
  );
}

/** "USD 10⁰⁰"-style amount with superscript minor units. */
export function BigAmount({ amount, currency = 'INR' }: { amount: number; currency?: string }) {
  const whole = Math.floor(amount);
  const minor = Math.round((amount - whole) * 100);
  return (
    <span className="text-navy">
      <span className="text-2xl">{currency} </span>
      <span className="text-[40px] font-medium leading-none">{whole.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-SG')}</span>
      <sup className="text-xl">{String(minor).padStart(2, '0')}</sup>
    </span>
  );
}

export interface QuickLink {
  label: string;
  to: string;
  icon: ReactNode;
  colour: string;
}

export function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {links.map((l) => (
        <Link key={l.label} to={l.to} className="flex flex-col items-center gap-2 rounded-card border border-line-100 bg-white px-3 py-4 text-center text-[15px] font-medium text-navy transition hover:border-crimson/40 hover:shadow-md">
          <span className={clsx('flex h-14 w-14 items-center justify-center rounded-full text-white', l.colour)}>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** Soft white→blush panel used for "Tickets History" and "Current Bill". */
export function BlushPanel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-8 rounded-[28px] border border-line-100 bg-brand-soft px-5 pb-6 pt-5 sm:px-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-medium text-navy">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Bordered label/value grid row (Current Bill style). */
export function InfoGrid({ rows }: { rows: { label: string; value: ReactNode; highlight?: boolean }[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line-100 bg-white">
      {rows.map((r, k) => (
        <div key={k} className="grid gap-4 border-b border-line-100 px-6 py-4 last:border-0 sm:grid-cols-3">
          {r.map((c) => (
            <div key={c.label}>
              <p className="text-[15px] font-medium text-ink-400">{c.label}</p>
              <p className={clsx('mt-1', c.highlight ? 'text-2xl font-semibold text-[#13A538]' : 'text-[17px] font-semibold text-navy')}>{c.value}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
