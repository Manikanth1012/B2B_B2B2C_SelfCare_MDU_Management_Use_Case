import { useNavigate } from 'react-router-dom';
import { Headphones, Home, Phone, Receipt, Settings as SettingsIcon, Smartphone, Wifi } from 'lucide-react';
import { can, currentUser, listInvoices, listServices } from '../api/api';
import { useApi } from '../lib/hooks';
import { date, money } from '../lib/format';
import { ErrorState, LinkButton, Loading, StatusBadge } from '../components/ui';
import { BigAmount, HeroCarousel, QuickLinks, StatusTile, Welcome, type Slide } from '../components/template';

/**
 * Resident dashboard: the subscriber's account at a glance (all services,
 * amount due, offers). Unit-specific detail lives on My Home.
 */
async function load() {
  const [services, invoices] = await Promise.all([listServices(), listInvoices()]);
  return { services, invoices };
}

const SLIDES: Slide[] = [
  { title: 'Upgrade to FiberHome 1 Gbps', body: 'Twice the speed for streaming, gaming and work-from-home. No installation fee for existing customers.', cta: 'Change plan', to: '/services/changes', image: './hero/hero-01.webp' },
  { title: 'Mobile + Broadband, one account', body: 'Already with us on mobile? Bundle both and manage them in one place.', cta: 'View my services', to: '/services', image: './hero/hero-03.webp' },
  { title: 'Wi-Fi in every room', body: 'Add a Mesh Wi-Fi Extender to your plan from just $149/month.', cta: 'Add an add-on', to: '/services', image: './hero/hero-05.webp' },
];

export function ResidentDashboard() {
  const user = currentUser();
  const q = useApi(load, [user.id]);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { services, invoices } = q.data;
  const live = services.filter((s) => s.status !== 'Terminated');
  const due = invoices.filter((i) => i.status !== 'Paid');
  const amountDue = due.reduce((a, i) => a + i.amount, 0);
  const overdue = due.some((i) => i.status === 'Overdue');
  const nextDue = due.map((i) => i.dueDate).sort()[0];
  const tone = (st: string) => (st === 'Active' ? 'green' : st === 'Suspended' ? 'red' : 'amber') as 'green' | 'red' | 'amber';

  return (
    <div>
      <Welcome name={user.name} id={user.customerId ?? user.id} onEdit={() => nav('/settings')} />
      <HeroCarousel slides={SLIDES} />

      <div className="mb-8 grid gap-6 xl:grid-cols-3">
        <section className="rounded-card border border-line-100 bg-brand-soft p-5 xl:col-span-2">
          <h2 className="mb-4 text-[22px] font-medium text-navy">My Services</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {live.map((s) => {
              const mobile = s.category === 'Mobile';
              const voice = s.category === 'Voice';
              return (
                <StatusTile key={s.id} status={s.status} tone={tone(s.status)} onClick={() => nav(`/services/${s.id}`)}>
                  {mobile ? <Smartphone className="h-8 w-8 text-ink-400" /> : voice ? <Phone className="h-8 w-8 text-ink-400" /> : <Wifi className="h-8 w-8 text-ink-400" />}
                  <p className="mt-3 text-[30px] font-semibold leading-tight text-navy">{mobile ? 'Mobile' : voice ? 'Fixed Voice' : 'Broadband'}</p>
                  <p className="text-sm text-ink-600">{s.offeringName}</p>
                  <p className="mt-3 text-sm font-medium text-ink-400">Service Identifier</p>
                  <p className="text-lg text-navy">{mobile ? s.location.replace('Mobile ', '') : voice && s.phoneNumber ? s.phoneNumber : s.id}</p>
                  {s.status === 'Active' && can('service.order') && (
                    <button onClick={(e) => (e.stopPropagation(), nav(`/services/${s.id}?action=suspend`))} className="mt-3 text-[15px] font-medium text-royal hover:underline">
                      Request Service Suspension
                    </button>
                  )}
                </StatusTile>
              );
            })}
            <StatusTile status={overdue ? 'OverDue' : amountDue ? 'Due' : 'Paid up'} tone={overdue ? 'red' : amountDue ? 'amber' : 'green'}>
              <p className="mt-4 text-lg text-ink-400">Amount Due</p>
              <BigAmount amount={amountDue} />
              <p className="mt-4 text-lg font-semibold text-navy">{nextDue ? `Due By ${date(nextDue)}` : 'Nothing due'}</p>
              <div className="mt-4 flex justify-end">
                {amountDue > 0 ? (
                  <LinkButton to="/billing?tab=invoices&status=Open" variant="primary">
                    Pay now
                  </LinkButton>
                ) : (
                  <LinkButton to="/billing" variant="secondary">
                    View bills
                  </LinkButton>
                )}
              </div>
            </StatusTile>
          </div>
        </section>
        <section className="rounded-card border border-line-100 bg-brand-soft p-5">
          <h2 className="mb-4 text-[22px] font-medium text-navy">Quick Links</h2>
          <QuickLinks
            links={[
              { label: 'My Home', to: '/home', icon: <Home className="h-6 w-6" />, colour: 'bg-[#B5672C]' },
              { label: 'Bills', to: '/billing', icon: <Receipt className="h-6 w-6" />, colour: 'bg-[#FF6A13]' },
              { label: 'Settings', to: '/settings', icon: <SettingsIcon className="h-6 w-6" />, colour: 'bg-[#F27D86]' },
              { label: 'Support', to: '/requests', icon: <Headphones className="h-6 w-6" />, colour: 'bg-[#1287D8]' },
            ]}
          />
        </section>
      </div>

      <h2 className="mb-3 text-[22px] font-medium text-navy">Latest bills</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {invoices.slice(0, 4).map((i) => (
          <button key={i.id} onClick={() => nav('/billing?tab=invoices')} className="rounded-card border border-line-100 bg-white/95 p-4 text-left transition hover:shadow-md">
            <p className="text-xs text-ink-400">{i.billingName}</p>
            <p className="mt-1 text-lg font-semibold text-navy">{money(i.amount, i.currency)}</p>
            <p className="mt-1 flex items-center justify-between text-xs text-ink-600">
              {i.period} <StatusBadge status={i.status} />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
