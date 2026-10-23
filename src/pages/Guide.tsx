import { useNavigate } from 'react-router-dom';
import { BookOpen, PlayCircle } from 'lucide-react';
import { currentUser, demoUsers } from '../api/api';
import { resetDb, setSessionUserId } from '../data/store';
import { useDbVersion } from '../lib/hooks';
import { Button, Card, PageHeader, SimNote, useToast } from '../components/ui';
import { BlushPanel } from '../components/template';

/* In-app "read me": the README's demo walkthrough, with one-click persona switching. */

const JOURNEYS: { id: string; title: string; persona: string; steps: { text: string; to?: string }[] }[] = [
  {
    id: 'A', title: 'Create a subsidiary, assign an administrator, see the hierarchy', persona: 'U-100',
    steps: [{ text: 'Open Create Child Account under 6D Global Enterprises', to: '/accounts/new?parent=ACC-1000' }, { text: 'Choose Business / Subsidiary, enter details, create its own billing account and invite an admin' }, { text: 'Submit, then “View in hierarchy” — the new node is highlighted with its billing link' }],
  },
  {
    id: 'B', title: 'Branch services and billing accounts', persona: 'U-101',
    steps: [{ text: 'Open Hyderabad Office', to: '/accounts/ACC-1120' }, { text: 'Services tab: DIA, SD-WAN, SIP trunk' }, { text: 'Billing tab: charges billed to the parent’s India Corporate Billing — location ≠ payer' }],
  },
  {
    id: 'C', title: 'Register an MDU and generate towers and units', persona: 'U-200',
    steps: [{ text: 'Register New MDU', to: '/mdu/new' }, { text: 'Configure towers, floors and units per floor; choose Hybrid billing' }, { text: 'Register → open the unit grid of the generated structure' }],
  },
  {
    id: 'D', title: 'Qualify a vacant unit and order broadband', persona: 'U-200',
    steps: [{ text: 'Green Valley → Buildings & Units → Tower A → A-302', to: '/mdu/units?property=PRP-GV' }, { text: 'Check service availability → Service Available' }, { text: 'Request new connection → plan, billing, installation slot → submit' }, { text: 'Try C-801 (Network Not Ready): ordering is blocked', to: '/services/new?unit=PRP-GV-C-801' }],
  },
  {
    id: 'E', title: 'CSV unit import with partial success', persona: 'U-200',
    steps: [{ text: 'Bulk Unit Import → “load the demo sample”', to: '/mdu/import?property=PRP-GV' }, { text: 'Review row errors (duplicate, invalid type, out-of-scope property…)' }, { text: 'Import valid rows → download the error report' }],
  },
  {
    id: 'F', title: 'Bulk activation with approval and per-unit tracking', persona: 'U-200',
    steps: [{ text: 'Bulk Activation → Green Valley → “Select all ready”', to: '/services/bulk?property=PRP-GV' }, { text: 'Plan → billing → run availability checks → submit (awaits approval)' }, { text: 'Switch to Arjun Nair (operator) → Approvals → Approve' }, { text: 'Open the order → “Simulate next provisioning step” twice → see completed and failed units', to: '/orders' }],
  },
  {
    id: 'J', title: 'Onboard a new (unregistered) customer as occupant with eKYC', persona: 'U-200',
    steps: [{ text: 'Unit grid → Tower A → A-302 → Assign occupant', to: '/mdu/units?property=PRP-GV' }, { text: 'Search 90000 12345 → “not yet registered” → Register new customer' }, { text: 'Enter name, mobile, email, date of birth → duplicate check runs' }, { text: 'Accept the privacy notice → Aadhaar OTP eKYC (any 12 digits, OTP 135790) → Verified' }, { text: 'Set relationship and start date, invite to self-care → Confirm' }],
  },
  {
    id: 'K', title: 'Link an existing Mobile customer as occupant (KYC reused)', persona: 'U-200',
    steps: [{ text: 'Occupancy Management → A-103 → Assign occupant', to: '/mdu/occupancy' }, { text: 'Search 98450 77001 → masked match: Mobile, KYC Verified' }, { text: 'Link this customer → send consent OTP (246810) → profile unlocks' }, { text: 'Confirm: no duplicate customer, KYC reused from mobile activation' }, { text: 'Tip: “Register new customer” with the same mobile is caught by the duplicate check' }],
  },
  {
    id: 'L', title: 'Complete KYC for a legacy occupant; operator reviews the document', persona: 'U-200',
    steps: [{ text: 'Unit grid → A-205 (Harish Gowda, KYC Not Started)', to: '/mdu/units?property=PRP-GV' }, { text: 'Resident-billed bulk activation of A-205 is rejected: “eKYC required”' }, { text: 'Verify occupant KYC → Document upload (PAN ABCDE1234F + file) → Save' }, { text: 'Switch to Arjun Nair → Approvals → approve the KYC Document Review → Verified', to: '/approvals' }],
  },
  {
    id: 'G', title: 'Consolidated billing drill-down', persona: 'U-103',
    steps: [{ text: 'Billing Hierarchy → 6D Global Group Billing (consolidated balance)', to: '/billing/hierarchy?focus=BA-9000' }, { text: 'Drill into India Corporate → Bangalore Office Billing; toggle consolidated vs own invoices' }],
  },
  {
    id: 'H', title: 'Delegated administrator sees only their scope', persona: 'U-102',
    steps: [{ text: 'Business Accounts lists Bangalore Office only', to: '/accounts' }, { text: 'Opening Hyderabad Office is refused by the data layer', to: '/accounts/ACC-1120' }],
  },
  {
    id: 'I', title: 'Resident sees only their own unit', persona: 'U-400',
    steps: [{ text: 'My Home shows unit A-104, plan, bills and tickets', to: '/home' }, { text: 'Opening the property page is refused', to: '/mdu/PRP-GV' }],
  },
];

const RULES = [
  ['Three separate hierarchies', 'Organisational ownership, billing roll-up and physical premises (property → building → floor → unit) are modelled independently.'],
  ['Residents are not children of the property manager', 'Units link to resident customer accounts via dated occupancy assignments; changing occupant never changes billing.'],
  ['Occupancy ≠ readiness ≠ service status', 'Unit connectivity is derived; occupancy has its own glyph; no state relies on colour alone.'],
  ['Authorisation in the API layer', 'Every call is filtered by the user’s account / billing / property / unit scope. Delegation can’t exceed your own role or scope.'],
  ['Controlled change', 'Hierarchy moves, billing responsibility, sensitive data, bulk activation and property-admin grants go through approval with separation of duties.'],
  ['Qualification gates activation', '“Additional Network Work Required” and “Service Not Available” block ordering.'],
  ['Customer identity before resident billing', 'Occupants are found or registered through a lookup-first flow (no duplicates), linked with OTP consent, and verified by eKYC. Resident-billed orders require KYC Verified; only masked ID references are stored.'],
];

const TMF = [
  ['Customer / party / roles', 'TMF629 · TMF632 · TMF669'],
  ['Billing accounts', 'TMF666'],
  ['Bills & payments', 'TMF678 · TMF676'],
  ['Catalogue & qualification', 'TMF620 · TMF679 · TMF645'],
  ['Ordering & inventory', 'TMF622 · TMF641 · TMF637'],
  ['Tickets', 'TMF621'],
  ['Agreements (bulk contracts)', 'TMF651'],
  ['Users & permissions', 'TMF672'],
  ['Premises (mapped, not forced)', 'TMF673 / TMF674 geographic address & site'],
];

export function Guide() {
  useDbVersion();
  const nav = useNavigate();
  const toast = useToast();
  const users = demoUsers();
  const me = currentUser();
  const start = (persona: string, to?: string) => {
    setSessionUserId(persona);
    toast('info', `Signed in as ${users.find((u) => u.id === persona)?.name}`);
    if (to) nav(to);
  };
  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-crimson" /> Read me · Demo guide
          </span>
        }
        subtitle="6D Business & MDU Self-Care — what the prototype shows, who to sign in as, and how to walk through each journey."
        actions={
          <Button variant="secondary" onClick={() => confirm('Reset all demo data to the original seed?') && (resetDb(), toast('info', 'Demo data reset'))}>
            Reset demo data
          </Button>
        }
      />
      <BlushPanel title="About this prototype">
        <p className="max-w-4xl text-[15px] leading-relaxed text-ink-700">
          An interactive B2B / B2B2C self-care portal for enterprise customers, MDU property managers, billing administrators, residents and operator staff. It covers business account hierarchies, multi-dwelling-unit
          management, services and orders, billing and payments, the Service Center, users and approvals — with role- and scope-based access enforced in the data-access layer. All data is synthetic and stored in
          this browser; every provisioning, payment and approval is simulated.
        </p>
      </BlushPanel>

      <h2 className="mb-4 text-[22px] font-medium text-navy">Personas</h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {users.map((u) => (
          <button key={u.id} onClick={() => start(u.id, '/')} className={`rounded-card border p-4 text-left transition hover:shadow-md ${u.id === me.id ? 'border-crimson bg-crimson-50' : 'border-line-100 bg-white/95'}`}>
            <p className="font-bold text-navy">{u.name}</p>
            <p className="text-sm font-semibold text-crimson">{u.role.name}</p>
            <p className="mt-1 text-xs text-ink-600">{u.title}</p>
            {u.id === me.id && <p className="mt-2 text-[11px] font-bold uppercase text-crimson">Signed in</p>}
          </button>
        ))}
      </div>

      <h2 className="mb-4 text-[22px] font-medium text-navy">Acceptance journeys</h2>
      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        {JOURNEYS.map((j) => {
          const persona = users.find((u) => u.id === j.persona);
          return (
            <Card
              key={j.id}
              title={
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{j.id}</span>
                  <span className="text-[16px] font-bold text-navy">{j.title}</span>
                </span>
              }
            >
              <p className="mb-2 text-xs text-ink-600">
                Sign in as <b>{persona?.name}</b> ({persona?.role.name})
              </p>
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
                {j.steps.map((s) => (
                  <li key={s.text}>
                    {s.to ? (
                      <button className="text-left text-royal hover:underline" onClick={() => start(j.persona, s.to)}>
                        {s.text}
                      </button>
                    ) : (
                      s.text
                    )}
                  </li>
                ))}
              </ol>
              <Button size="sm" onClick={() => start(j.persona, j.steps.find((s) => s.to)?.to)}>
                <PlayCircle className="h-4 w-4" /> Start journey {j.id}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <Card title="Design rules implemented">
          <dl className="space-y-3">
            {RULES.map(([t, d]) => (
              <div key={t}>
                <dt className="text-sm font-bold text-navy">{t}</dt>
                <dd className="text-sm text-ink-700">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="TM Forum Open API alignment">
          <table className="w-full text-sm">
            <tbody>
              {TMF.map(([d, a]) => (
                <tr key={d} className="border-b border-line-100 last:border-0">
                  <td className="py-2 pr-3 text-ink-700">{d}</td>
                  <td className="py-2 font-semibold text-navy">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-600">The mock adapter in <code>src/api/api.ts</code> marks each operation with its target API, so it can be swapped for live endpoints domain by domain.</p>
        </Card>
      </div>
      <SimNote>
        Known limits: single-browser mock persistence (no server); Ask AARYA is a guided, deterministic demo rather than a live model. The full read-me, including screenshots, run instructions and tests, is <b>README.md</b> in the repository.
      </SimNote>
    </div>
  );
}
