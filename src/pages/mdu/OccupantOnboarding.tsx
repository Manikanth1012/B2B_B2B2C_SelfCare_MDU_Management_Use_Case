import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { BadgeCheck, CheckCircle2, FileUp, Fingerprint, KeyRound, Phone, Search, ShieldCheck, Smartphone, UserPlus, Wallet } from 'lucide-react';
import {
  completeOccupantKyc,
  fetchDigiLocker,
  getPhoneNumbers,
  lookupCustomer,
  offerings,
  onboardOccupant,
  requestAadhaarOtp,
  sendConsentOtp,
  submitKycDocument,
  verifyAadhaarOtp,
  verifyConsentOtp,
  type CustomerMatch,
  type KycResult,
} from '../../api/api';
import type { KycRecord } from '../../data/types';
import { TODAY } from '../../data/seed';
import { date, money } from '../../lib/format';
import { Button, Field, inputCls, Modal, SimNote, Stat, StatusBadge, Stepper, useAction } from '../../components/ui';

/* ---------------- KYC badge ---------------- */

export function KycBadge({ kyc }: { kyc?: KycRecord }) {
  if (!kyc) return null;
  const tone = { Verified: 'bg-emerald-50 text-emerald-800 border-emerald-200', 'Pending Review': 'bg-amber-50 text-amber-800 border-amber-200', Failed: 'bg-red-50 text-red-800 border-red-200', 'Not Started': 'bg-slate-100 text-slate-700 border-slate-200' }[kyc.status];
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-semibold', tone)} title={[kyc.method, kyc.maskedRef, kyc.source].filter(Boolean).join(' · ')}>
      <ShieldCheck className="h-3.5 w-3.5" /> KYC {kyc.status}
    </span>
  );
}

/* ---------------- eKYC step (shared by onboarding and "Verify KYC") ---------------- */

type Method = 'aadhaar' | 'digilocker' | 'document';

function EkycStep({ declaredName, result, onResult }: { declaredName: string; result: KycResult | null; onResult: (r: KycResult | null) => void }) {
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<Method>('aadhaar');
  const [aadhaar, setAadhaar] = useState('');
  const [txn, setTxn] = useState<{ txnId: string; sentTo: string; demoOtp: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [doc, setDoc] = useState({ idType: 'PAN' as 'PAN' | 'Passport' | 'Voter ID' | 'Driving Licence', number: '', file: '' });
  const { run, busy } = useAction();
  const methods: { id: Method; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'aadhaar', label: 'Aadhaar OTP eKYC', icon: <Fingerprint className="h-5 w-5" />, desc: 'Instant · OTP to Aadhaar-linked mobile' },
    { id: 'digilocker', label: 'DigiLocker', icon: <Wallet className="h-5 w-5" />, desc: 'Instant · customer shares verified Aadhaar' },
    { id: 'document', label: 'Document upload', icon: <FileUp className="h-5 w-5" />, desc: 'PAN / Passport / Voter ID / DL · back-office review' },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-royal/20 bg-royal-50 p-4 text-sm text-ink-700">
        <p className="mb-1 font-bold text-navy">Privacy notice (DPDP Act 2023)</p>
        <p>
          Identity details are used only to verify <b>{declaredName || 'the customer'}</b> as a telecom subscriber. Only a masked reference and the verification result are kept. Full Aadhaar or document numbers are
          not stored. The customer can withdraw consent or request erasure through the Service Center.
        </p>
        <label className="mt-2 flex items-start gap-2 font-semibold text-navy">
          <input type="checkbox" className="mt-1 accent-[#E31E43]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          The customer has read the notice and consents to identity verification
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((m) => (
          <button key={m.id} onClick={() => (setMethod(m.id), onResult(null), setTxn(null))} className={clsx('rounded-xl border p-3 text-left text-sm transition', method === m.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-line-200 hover:border-crimson')}>
            <span className="flex items-center gap-2 font-bold text-navy">
              {m.icon}
              {m.label}
            </span>
            <span className="text-xs text-ink-600">{m.desc}</span>
          </button>
        ))}
      </div>

      {method === 'aadhaar' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Aadhaar number" hint="Demo: numbers ending 0000 fail authentication, ending 9999 fail the name match">
            <input className={inputCls} inputMode="numeric" maxLength={14} value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/[^\d ]/g, ''))} placeholder="XXXX XXXX XXXX" />
          </Field>
          <Button variant="secondary" loading={busy && !txn} disabled={!consent || aadhaar.replace(/\s/g, '').length !== 12} onClick={async () => setTxn((await run(() => requestAadhaarOtp(aadhaar, consent), 'OTP sent to Aadhaar-linked mobile (simulated)')) ?? null)}>
            <KeyRound className="h-4 w-4" /> Send OTP
          </Button>
          {txn && (
            <>
              <Field label={`OTP sent to ${txn.sentTo}`} hint={`Demo OTP: ${txn.demoOtp}`}>
                <input className={inputCls} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Button loading={busy} disabled={otp.length !== 6} onClick={async () => onResult((await run(() => verifyAadhaarOtp(txn.txnId, otp, declaredName))) ?? null)}>
                Verify with UIDAI
              </Button>
            </>
          )}
        </div>
      )}
      {method === 'digilocker' && (
        <Button disabled={!consent} loading={busy} onClick={async () => onResult((await run(() => fetchDigiLocker(declaredName, consent))) ?? null)}>
          <Wallet className="h-4 w-4" /> Fetch from DigiLocker
        </Button>
      )}
      {method === 'document' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Document type">
            <select className={inputCls} value={doc.idType} onChange={(e) => setDoc({ ...doc, idType: e.target.value as typeof doc.idType })}>
              {['PAN', 'Passport', 'Voter ID', 'Driving Licence'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Document number" hint={{ PAN: 'e.g. ABCDE1234F', Passport: 'e.g. K1234567', 'Voter ID': 'e.g. ABC1234567', 'Driving Licence': 'e.g. KA01 20190012345' }[doc.idType]}>
            <input className={inputCls} value={doc.number} onChange={(e) => setDoc({ ...doc, number: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Scan / photo">
            <input type="file" accept="image/*,.pdf" className="block w-full pt-2 text-sm file:mr-2 file:rounded-full file:border-0 file:bg-crimson-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-crimson" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0]?.name ?? '' })} />
          </Field>
          <div className="sm:col-span-3">
            <Button disabled={!consent} loading={busy} onClick={async () => onResult((await run(() => submitKycDocument(doc.idType, doc.number, doc.file, consent))) ?? null)}>
              Submit for review
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className={clsx('rounded-xl border p-4 text-sm', result.record.status === 'Verified' ? 'border-emerald-200 bg-emerald-50' : result.record.status === 'Failed' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <KycBadge kyc={result.record} />
            <span className="font-mono text-xs text-ink-600">{result.record.maskedRef}</span>
          </div>
          <p className="text-ink-700">{result.message}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Onboarding wizard ---------------- */

type Path = 'existing' | 'new' | null;

export function OccupantOnboardingModal({ unitId, unitLabel, currentOccupant, onClose }: { unitId: string; unitLabel: string; currentOccupant?: string; onClose: () => void }) {
  const [path, setPath] = useState<Path>(null);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CustomerMatch[] | null>(null);
  const [match, setMatch] = useState<CustomerMatch | null>(null);
  const [otp, setOtp] = useState<{ otpRef: string; sentTo: string; demoOtp: string } | null>(null);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState<Awaited<ReturnType<typeof verifyConsentOtp>> | null>(null);
  const [cust, setCust] = useState({ name: '', phone: '', email: '', dob: '' });
  const [dupe, setDupe] = useState<CustomerMatch | null>(null);
  const [kyc, setKyc] = useState<KycResult | null>(null);
  const [occ, setOcc] = useState({ role: 'Tenant' as 'Owner' | 'Tenant' | 'Authorised Contact', from: TODAY, invitePortal: true });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [done, setDone] = useState<Awaited<ReturnType<typeof onboardOccupant>> | null>(null);
  const { run, busy } = useAction();

  const propertyId = unitId.split('-').slice(0, 2).join('-');
  const assignedNumber = useMemo(() => getPhoneNumbers(propertyId).find((n) => n.unitId === unitId && n.status === 'Available')?.number, [propertyId, unitId]);
  const voiceOffering = offerings().find((o) => o.id === 'OFF-V01');

  const steps = path === 'new' ? ['Find customer', 'Customer details', 'eKYC', 'Occupancy', 'Services', 'Review'] : ['Find customer', 'Customer consent', 'Occupancy', 'Services', 'Review'];
  const stepId = path === 'new' ? ['find', 'details', 'ekyc', 'occupancy', 'services', 'review'][step] : ['find', 'consent', 'occupancy', 'services', 'review'][step];

  const search = async () => {
    const r = await run(() => lookupCustomer(query));
    if (r) setMatches(r);
  };
  const startNew = () => {
    const q = query.trim();
    setCust({ name: '', phone: q.includes('@') ? '' : /\d{10}/.test(q.replace(/\D/g, '')) ? q : '', email: q.includes('@') ? q : '', dob: '' });
    setPath('new');
    setStep(1);
  };
  const pickExisting = (m: CustomerMatch) => {
    setMatch(m);
    setPath('existing');
    setOtp(null);
    setConsent(null);
    setCode('');
    setStep(1);
  };
  const detailsValid = cust.name.trim().length >= 3 && cust.phone.replace(/\D/g, '').length >= 10 && /^\S+@\S+\.\S+$/.test(cust.email) && !!cust.dob;
  const checkDupe = async () => {
    const found = (await run(async () => [...(await lookupCustomer(cust.phone)), ...(await lookupCustomer(cust.email))])) ?? [];
    if (found.length) setDupe(found[0]);
    else {
      setDupe(null);
      setStep(2);
    }
  };
  const canNext = { find: false, consent: !!consent, details: false, ekyc: !!kyc && kyc.record.status !== 'Failed', occupancy: !!occ.from, services: true, review: true }[stepId];
  const submit = async () => {
    const r = await run(() =>
      onboardOccupant(unitId, path === 'existing' ? { mode: 'existing', customerId: match!.customerId, consentToken: consent!.consentToken, ...occ } : { mode: 'new', ...cust, kycToken: kyc!.kycToken, dataConsent: true, ...occ }),
    );
    if (r) setDone(r);
  };

  if (done)
    return (
      <Modal open wide onClose={onClose} title="Occupant onboarded" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="mt-3 text-lg font-bold text-navy">
            {done.name} is now the {occ.role.toLowerCase()} of {unitLabel}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Customer <span className="font-mono">{done.customerId}</span> · KYC <b>{done.kycStatus}</b>
            {done.invited && ' · self-care invitation sent (simulated)'}
          </p>
          {done.kycStatus === 'Pending Review' && <p className="mt-2 text-sm text-amber-800">Document review request sent to the operator. Services billed to the resident unlock once it is approved.</p>}
          {path === 'existing' && <p className="mt-2 text-sm text-ink-700">Existing customer profile and KYC were reused. No duplicate customer was created, so broadband can sit alongside their other services (convergent account).</p>}
        </div>
      </Modal>
    );

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={currentOccupant ? `Update occupant · ${unitLabel}` : `Assign occupant · ${unitLabel}`}
      footer={
        stepId !== 'find' && (
          <>
            <Button variant="secondary" onClick={() => (step === 1 ? (setPath(null), setStep(0)) : setStep((s) => s - 1))}>
              Back
            </Button>
            {stepId === 'details' ? (
              <Button disabled={!detailsValid} loading={busy} onClick={checkDupe}>
                Check & continue
              </Button>
            ) : stepId === 'review' ? (
              <Button variant="cta" loading={busy} onClick={submit}>
                Confirm occupant
              </Button>
            ) : (
              <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            )}
          </>
        )
      }
    >
      <Stepper steps={steps} current={step} />
      {currentOccupant && stepId === 'find' && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Current occupant <b>{currentOccupant}</b> will be end-dated the day before the new start date. Their subscriptions and billing stay with them. Nothing transfers automatically.
        </p>
      )}

      {stepId === 'find' && (
        <div>
          <p className="mb-3 text-sm text-ink-700">Search the operator's customer base first, so an existing customer (e.g. a Mobile subscriber) is reused rather than duplicated.</p>
          <form onSubmit={(e) => (e.preventDefault(), search())} className="flex gap-2">
            <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mobile number, email or customer ID (e.g. 98450 77001)" aria-label="Customer search" />
            <Button loading={busy} disabled={query.trim().length < 4}>
              <Search className="h-4 w-4" /> Search
            </Button>
          </form>
          <p className="mt-1 text-xs text-ink-400">Demo: try 98450 77001 (Rohit, Mobile postpaid), 99001 22334 (Ayesha, Mobile prepaid) or 98450 11223 (Sneha, Mobile + Broadband).</p>
          {matches && (
            <div className="mt-4 space-y-3">
              {matches.map((m) => (
                <div key={m.customerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-200 p-4">
                  <div>
                    <p className="text-sm font-bold text-navy">
                      Existing customer · matched on {m.matchedOn}
                    </p>
                    <p className="text-sm text-ink-700">
                      {m.maskedName} · {m.maskedPhone} · {m.maskedEmail}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {m.serviceCategories.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-royal-50 px-2 py-0.5 font-semibold text-royal-700">
                          {c === 'Mobile' ? <Smartphone className="h-3 w-3" /> : null}
                          {c}
                        </span>
                      ))}
                      <StatusBadge status={m.kycStatus === 'Verified' ? 'Verified' : m.kycStatus} />
                      {m.kycSource && <span className="text-ink-600">KYC via {m.kycSource}</span>}
                      <span className="text-ink-400">Customer since {date(m.customerSince)}</span>
                    </div>
                    {(m.occupiesInYourScope.length > 0 || m.occupiesElsewhere > 0) && (
                      <p className="mt-1 text-xs text-amber-800">
                        Already an occupant of {[...m.occupiesInYourScope, ...(m.occupiesElsewhere ? [`${m.occupiesElsewhere} unit(s) at another property`] : [])].join(', ')}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => pickExisting(m)}>
                    Link this customer
                  </Button>
                </div>
              ))}
              {!matches.length && <p className="rounded-md bg-[#D3EAF0] px-5 py-4 text-sm text-ink-700">No customer found with "{query}". This person is not yet registered with us.</p>}
            </div>
          )}
          <div className="mt-5 border-t border-line-100 pt-4">
            <Button variant="secondary" onClick={startNew}>
              <UserPlus className="h-4 w-4" /> Register new customer
            </Button>
          </div>
        </div>
      )}

      {stepId === 'consent' && match && (
        <div className="space-y-4">
          <p className="text-sm text-ink-700">
            Profile details stay masked until the customer approves the link. We'll send a one-time password to their registered mobile <b>{match.maskedPhone}</b>.
          </p>
          {!consent && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              {otp ? (
                <Field label={`OTP sent to ${otp.sentTo}`} hint={`Demo OTP: ${otp.demoOtp} · valid 5 minutes · 3 attempts`}>
                  <input className={inputCls} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </Field>
              ) : (
                <span />
              )}
              {otp ? (
                <Button loading={busy} disabled={code.length !== 6} onClick={async () => setConsent((await run(() => verifyConsentOtp(otp.otpRef, code), 'Customer consent verified')) ?? null)}>
                  Verify OTP
                </Button>
              ) : (
                <Button loading={busy} onClick={async () => setOtp((await run(() => sendConsentOtp(match.customerId), 'Consent OTP sent (simulated SMS)')) ?? null)}>
                  <KeyRound className="h-4 w-4" /> Send consent OTP
                </Button>
              )}
            </div>
          )}
          {consent && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-800">
                <BadgeCheck className="h-4 w-4" /> Consent verified. Profile unlocked.
              </p>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat label="Name">{consent.profile.name}</Stat>
                <Stat label="Mobile">{consent.profile.phone}</Stat>
                <Stat label="Email">{consent.profile.email}</Stat>
                <Stat label="KYC">
                  <KycBadge kyc={consent.profile.kyc} />
                </Stat>
                <Stat label="KYC evidence">{[consent.profile.kyc.method, consent.profile.kyc.maskedRef].filter(Boolean).join(' · ') || '—'}</Stat>
                <Stat label="Verified at">{consent.profile.kyc.source ?? '—'}</Stat>
              </dl>
              <p className="mt-3 text-xs text-ink-700">
                {consent.profile.kyc.status === 'Verified'
                  ? 'KYC is reused from the existing service. No re-verification is needed.'
                  : 'This customer has no verified KYC. You can still assign them, then complete eKYC from the unit drawer before any resident-billed service.'}
              </p>
            </div>
          )}
        </div>
      )}

      {stepId === 'details' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name (as on ID)" required>
              <input className={inputCls} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            </Field>
            <Field label="Mobile number" required>
              <input className={inputCls} value={cust.phone} onChange={(e) => (setCust({ ...cust, phone: e.target.value }), setDupe(null))} placeholder="+91 …" />
            </Field>
            <Field label="Email" required>
              <input className={inputCls} value={cust.email} onChange={(e) => (setCust({ ...cust, email: e.target.value }), setDupe(null))} />
            </Field>
            <Field label="Date of birth" required hint="Subscriber must be 18+">
              <input type="date" max={TODAY} className={inputCls} value={cust.dob} onChange={(e) => setCust({ ...cust, dob: e.target.value })} />
            </Field>
          </div>
          {dupe && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <span className="text-amber-900">
                Duplicate check: <b>{dupe.maskedName}</b> ({dupe.serviceCategories.join(', ') || 'no active services'}) already uses this {dupe.matchedOn}. Link the existing customer instead of creating a duplicate.
              </span>
              <Button size="sm" onClick={() => (setDupe(null), pickExisting(dupe))}>
                Switch to existing customer
              </Button>
            </div>
          )}
        </div>
      )}

      {stepId === 'ekyc' && <EkycStep declaredName={cust.name} result={kyc} onResult={setKyc} />}

      {stepId === 'occupancy' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Relationship to unit">
            <select className={inputCls} value={occ.role} onChange={(e) => setOcc({ ...occ, role: e.target.value as typeof occ.role })}>
              {['Owner', 'Tenant', 'Authorised Contact'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Occupancy from">
            <input type="date" className={inputCls} value={occ.from} onChange={(e) => setOcc({ ...occ, from: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-[#E31E43]" checked={occ.invitePortal} onChange={(e) => setOcc({ ...occ, invitePortal: e.target.checked })} /> Invite to resident self-care (access limited to this unit)
          </label>
          <p className="text-xs text-ink-600 sm:col-span-2">Occupancy does not set billing. Choose who pays when ordering a service.</p>
        </div>
      )}

      {stepId === 'services' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-700">Optionally include FixedVoice Home as part of this occupant's connection. Services can also be ordered separately after onboarding.</p>
          {voiceOffering && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-100 p-4 hover:border-royal/40">
              <input
                type="checkbox"
                checked={selectedServices.includes('OFF-V01')}
                onChange={(e) => setSelectedServices(e.target.checked ? [...selectedServices, 'OFF-V01'] : selectedServices.filter((id) => id !== 'OFF-V01'))}
                className="h-4 w-4 rounded"
              />
              <Phone className="h-5 w-5 shrink-0 text-royal-700" />
              <div>
                <p className="font-semibold text-navy">FixedVoice Home</p>
                <p className="text-sm text-ink-600">Fixed landline — {money(voiceOffering.mrc, 'USD')}/mo · Pre-assigned number activated on connection</p>
              </div>
            </label>
          )}
          {selectedServices.includes('OFF-V01') && assignedNumber && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              Pre-assigned number for this unit: <b>{assignedNumber}</b>. It will be activated when the service goes live.
            </p>
          )}
          {selectedServices.includes('OFF-V01') && !assignedNumber && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No pre-assigned number found for this unit. A number will be allocated at activation.</p>
          )}
        </div>
      )}

      {stepId === 'review' && (
        <div className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label="Unit">{unitLabel}</Stat>
            <Stat label="Customer">{path === 'existing' ? `${consent?.profile.name} (existing ${match?.customerId})` : `${cust.name} (new)`}</Stat>
            <Stat label="Contact">{path === 'existing' ? consent?.profile.phone : `${cust.phone} · ${cust.email}`}</Stat>
            <Stat label="KYC">
              <KycBadge kyc={path === 'existing' ? consent?.profile.kyc : kyc?.record} />
            </Stat>
            <Stat label="Evidence">{(path === 'existing' ? [consent?.profile.kyc.method, consent?.profile.kyc.maskedRef] : [kyc?.record.method, kyc?.record.maskedRef]).filter(Boolean).join(' · ') || '—'}</Stat>
            <Stat label="Consent">{path === 'existing' ? 'OTP on registered mobile' : 'Privacy notice accepted'}</Stat>
            <Stat label="Relationship">{occ.role}</Stat>
            <Stat label="From">{date(occ.from)}</Stat>
            <Stat label="Self-care invite">{occ.invitePortal ? 'Yes' : 'No'}</Stat>
          </dl>
          {selectedServices.includes('OFF-V01') && voiceOffering && (
            <div className="rounded-xl border border-royal/20 bg-royal-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy">
                <Phone className="h-4 w-4" /> FixedVoice Home included
              </p>
              <p className="text-sm text-ink-700">
                {money(voiceOffering.mrc, 'USD')}/mo · {voiceOffering.contractMonths}-month term
                {assignedNumber && <> · Number: <b>{assignedNumber}</b></>}
              </p>
              <p className="mt-1 text-xs text-ink-500">Service will be ordered separately after occupant is confirmed. This selection is for planning reference.</p>
            </div>
          )}
          {currentOccupant && <p className="text-sm text-amber-800">{currentOccupant}'s occupancy will end on the day before {date(occ.from)}.</p>}
          <SimNote>Simulated eKYC and OTP gateways. Real deployments call UIDAI (via an AUA/KUA), DigiLocker and SMS providers. Only masked identifiers and the consent log are stored.</SimNote>
        </div>
      )}
    </Modal>
  );
}

/** Run eKYC for the current occupant of a unit (legacy, imported or failed KYC). */
export function VerifyKycModal({ unitId, occupantName, onClose }: { unitId: string; occupantName: string; onClose: () => void }) {
  const [kyc, setKyc] = useState<KycResult | null>(null);
  const { run, busy } = useAction();
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Verify KYC · ${occupantName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!kyc || kyc.record.status === 'Failed'} onClick={async () => (await run(() => completeOccupantKyc(unitId, kyc!.kycToken), (s) => `KYC ${s}`)) !== undefined && onClose()}>
            Save KYC result
          </Button>
        </>
      }
    >
      <EkycStep declaredName={occupantName} result={kyc} onResult={setKyc} />
    </Modal>
  );
}
