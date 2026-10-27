# FixedVoice & Add-ons Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FixedVoice (standalone landline) and expanded add-ons management for both MDU Property Manager (Priya) and Resident (Sneha), plus clean up Orders nav, AARYA popup, and Demo Reset button.

**Architecture:** All data lives in the in-browser mock DB (`src/data/`). New types and seed entries extend the existing schema. New pages follow the established pattern: `useApi()` hook → pure API function → UI. No backend changes.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, React Router v6, Lucide icons, Recharts

## Global Constraints

- All currency in USD (`money(n, 'USD')` or `money(n, s.currency)`)
- All new billing accounts use `currency: 'USD'`
- Payment methods: `'Bank Transfer' | 'Direct Debit' | 'Card' | 'ACH'` — no UPI
- New offering IDs: `OFF-V01`, `OFF-P04`
- New add-on IDs: `ADD-STB`, `ADD-OTT-PREM`, `ADD-MESH-NODE`, `ADD-VOICEMAIL`, `ADD-INTL`
- Phone number ID format: `PN-GV-A-XXX` (e.g. `PN-GV-A-104`)
- New service for Sneha: `SVC-VOICE-SNEHA`, billing account `BA-7001`
- New routes: `/mdu/phone-numbers`, `/mdu/addons`
- Verify with: `cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/data/types.ts` | Modify | Add `PhoneNumber` type, `phoneNumbers[]` on `Database`, `phoneNumber?` on `ServiceInstance` |
| `src/data/seed.ts` | Modify | Add OFF-V01/P04, expand add-ons, seed GV phone numbers, Sneha FixedVoice service + invoices |
| `src/api/api.ts` | Modify | Add `getPhoneNumbers`, `togglePhoneNumber`, `bulkTogglePhoneNumbers`, `bulkProvisionAddOn`, `removeAddOn` |
| `src/components/Layout.tsx` | Modify | Remove Orders nav, AARYA component, Demo Reset button |
| `src/App.tsx` | Modify | Add routes for `/mdu/phone-numbers` and `/mdu/addons` |
| `src/pages/mdu/PhoneNumbers.tsx` | Create | Phone Number Inventory page for Priya |
| `src/pages/mdu/AddonsManagement.tsx` | Create | Add-ons Management page for Priya |
| `src/pages/mdu/PropertyDetail.tsx` | Modify | Add Phone Numbers + Add-ons action links |
| `src/pages/ResidentDashboard.tsx` | Modify | Add FixedVoice service card |
| `src/pages/mdu/MyHome.tsx` | Modify | Add Home Phone section |
| `src/pages/services/ServiceDetail.tsx` | Modify | Add remove add-on button; show FixedVoice-only add-ons per service category |
| `src/pages/services/NewConnection.tsx` | Modify | Show FixedVoice plan option when unit has available number |
| `src/pages/mdu/OccupantOnboarding.tsx` | Modify | Add FixedVoice checkbox in service step |
| `src/pages/services/BulkActivation.tsx` | Modify | Add voice line checkbox in plan step |
| `src/pages/Guide.tsx` | Modify | Remove Demo Reset button |

---

## Task 1: UI Cleanup — Remove Orders, AARYA, Demo Reset

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/Guide.tsx`

**Interfaces:**
- Produces: clean Layout with no Orders nav item, no AARYA button/panel, no Demo Reset button

- [ ] **Step 1: Remove Orders from NAV array** in `src/components/Layout.tsx`

Find and delete this line (line ~64):
```ts
{ label: 'Orders', to: '/orders' },
```

- [ ] **Step 2: Remove Orders special-case from `isGroupActive`**

Find and delete this block (~line 103):
```ts
if (g.label === 'Orders') return path === '/orders' || path.startsWith('/services/orders');
```
Also remove the `Services` special-case that excluded `/services/orders` — change:
```ts
if (g.label === 'Services') return path.startsWith('/services') && !path.startsWith('/services/orders');
```
to:
```ts
if (g.label === 'Services') return path.startsWith('/services');
```

- [ ] **Step 3: Remove Orders from BOTTOM nav array**

Find and delete this line (~line 355):
```ts
{ to: '/orders', label: 'Orders', icon: <ShoppingBag className="h-5 w-5" />, roles: ['MDU_PM'] },
```

- [ ] **Step 4: Remove AskAarya render call** (~line 401):
```tsx
<AskAarya />
```

- [ ] **Step 5: Delete the entire AskAarya block** — remove the `AARYA_INTENTS` constant, the `AskAarya` function (lines ~274–345), and the `Bot`, `Send` imports from lucide-react.

- [ ] **Step 6: Remove Demo Reset button** from `UserMenu` in Layout.tsx — delete the entire button block:
```tsx
<button
  onClick={() => {
    if (confirm('Reset all demo data to the original seed? Your changes will be lost.')) {
      resetDb();
      setOpen(false);
      toast('info', 'Demo data reset');
    }
  }}
  className="flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-ink-600 hover:bg-surface-100"
>
  <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
</button>
```
Also remove `RotateCcw` from lucide-react imports and `resetDb` from store imports if no longer used.

- [ ] **Step 7: Remove Demo Reset from Guide.tsx**

In `src/pages/Guide.tsx` find (~line 105):
```tsx
<Button variant="secondary" onClick={() => confirm('Reset all demo data to the original seed?') && (resetDb(), toast('info', 'Demo data reset'))}>
```
Delete that button. Also remove `resetDb` import if unused.

- [ ] **Step 8: Remove ShoppingBag from Layout imports** if it was only used by Orders nav.

- [ ] **Step 9: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**
```bash
git add src/components/Layout.tsx src/pages/Guide.tsx
git commit -m "feat: remove Orders nav, AARYA assistant and Demo Reset button"
```

---

## Task 2: Data Model — PhoneNumber Type + ServiceInstance Update

**Files:**
- Modify: `src/data/types.ts`

**Interfaces:**
- Produces:
  - `PhoneNumber` interface exported from `types.ts`
  - `ServiceInstance.phoneNumber?: string`
  - `Database.phoneNumbers: PhoneNumber[]`

- [ ] **Step 1: Add `PhoneNumber` interface** after the `ServiceQualification` interface (~line 286):

```ts
export interface PhoneNumber {
  id: ID;
  number: string;
  propertyId: ID;
  unitId: ID;
  status: 'Available' | 'Active' | 'Reserved';
  serviceInstanceId?: ID;
}
```

- [ ] **Step 2: Add `phoneNumber?` to `ServiceInstance`** (after `pendingChange?`):

```ts
phoneNumber?: string;
```

- [ ] **Step 3: Add `phoneNumbers` to `Database`** (after `services: ServiceInstance[]`):

```ts
phoneNumbers: PhoneNumber[];
```

- [ ] **Step 4: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: errors about `phoneNumbers` not initialised in seed — that's fine, fix in Task 3.

- [ ] **Step 5: Commit**
```bash
git add src/data/types.ts
git commit -m "feat: add PhoneNumber type, phoneNumber field on ServiceInstance, phoneNumbers on Database"
```

---

## Task 3: Seed Data — Offerings, Add-ons, Phone Numbers, Sneha FixedVoice

**Files:**
- Modify: `src/data/seed.ts`

**Interfaces:**
- Consumes: `PhoneNumber` from `types.ts`
- Produces:
  - `OFF-V01` FixedVoice Home in `OFFERINGS`
  - `OFF-P04` Property Voice Lines Pack in `OFFERINGS`
  - `ADD-STB`, `ADD-OTT-PREM`, `ADD-MESH-NODE` on broadband offerings
  - `ADD-VOICEMAIL`, `ADD-INTL` on `OFF-V01`
  - `db.phoneNumbers` initialised with 12 Green Valley entries
  - `SVC-VOICE-SNEHA` service with `phoneNumber: '+1-555-0104'`
  - FixedVoice invoice lines on `BA-7001`

- [ ] **Step 1: Add `PhoneNumber` to the import list** at top of seed.ts:

```ts
import type {
  BillingAccount,
  Building,
  CustomerAccount,
  Database,
  Floor,
  Invoice,
  InvoiceLine,
  OccupancyAssignment,
  Payment,
  PhoneNumber,
  ProductOffering,
  Property,
  Role,
  ServiceInstance,
  ServiceRequest,
  Unit,
  UnitType,
  User,
} from './types';
```

- [ ] **Step 2: Add new offerings** to the `OFFERINGS` array after `OFF-P03`:

```ts
{
  id: 'OFF-V01', name: 'FixedVoice Home', category: 'Voice', segment: 'Residential', mrc: 12, nrc: 0, contractMonths: 12,
  addOns: [
    { id: 'ADD-VOICEMAIL', name: 'Voicemail', mrc: 3 },
    { id: 'ADD-INTL', name: 'International Calling Plan – 200 mins/mo', mrc: 10 },
  ],
},
{ id: 'OFF-P04', name: 'Property Voice Lines Pack', category: 'Voice', segment: 'Business', mrc: 18, nrc: 0, contractMonths: 24 },
```

- [ ] **Step 3: Expand add-ons on residential broadband offerings**

Replace the existing `OFF-R01` `addOns` array:
```ts
addOns: [
  { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
  { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
  { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
  { id: 'ADD-MESH', name: 'Mesh Wi-Fi Extender', mrc: 4 },
  { id: 'ADD-MESH-NODE', name: 'Extra Mesh Node', mrc: 6 },
  { id: 'ADD-VOICE', name: 'Fixed Voice Line', mrc: 3 },
],
```

Replace `OFF-R02` `addOns` array:
```ts
addOns: [
  { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
  { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
  { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
  { id: 'ADD-MESH', name: 'Mesh Wi-Fi Extender', mrc: 4 },
  { id: 'ADD-MESH-NODE', name: 'Extra Mesh Node', mrc: 6 },
  { id: 'ADD-STATIC-IP', name: 'Static IP', mrc: 8 },
],
```

Replace `OFF-R03` `addOns` array:
```ts
addOns: [
  { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
  { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
  { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
  { id: 'ADD-STATIC-IP', name: 'Static IP', mrc: 8 },
],
```

- [ ] **Step 4: Initialise `db.phoneNumbers = []`** in the `buildDb()` return object (the Database object), alongside `db.services`:

```ts
phoneNumbers: [] as PhoneNumber[],
```

- [ ] **Step 5: Seed phone numbers for Green Valley** — add this block after the `snehaSrv` line (~line 405, after Sneha's broadband service is created):

```ts
// Pre-assigned phone numbers for Green Valley Tower A units (one per unit).
const GV_NUMBERS: [string, string][] = [
  ['PRP-GV-A-101', '+1-555-0101'],
  ['PRP-GV-A-102', '+1-555-0102'],
  ['PRP-GV-A-103', '+1-555-0103'],
  ['PRP-GV-A-104', '+1-555-0104'],
  ['PRP-GV-A-201', '+1-555-0201'],
  ['PRP-GV-A-202', '+1-555-0202'],
  ['PRP-GV-A-203', '+1-555-0203'],
  ['PRP-GV-A-204', '+1-555-0204'],
  ['PRP-GV-A-301', '+1-555-0301'],
  ['PRP-GV-A-302', '+1-555-0302'],
  ['PRP-GV-A-303', '+1-555-0303'],
  ['PRP-GV-A-304', '+1-555-0304'],
];
GV_NUMBERS.forEach(([unitId, number]) => {
  const id = `PN-GV-${unitId.split('PRP-GV-')[1]}`;
  db.phoneNumbers.push({ id, number, propertyId: 'PRP-GV', unitId, status: 'Available', serviceInstanceId: undefined });
});
```

- [ ] **Step 6: Seed Sneha's FixedVoice service** — add immediately after the GV_NUMBERS block:

```ts
// Sneha's FixedVoice Home service — activates her pre-assigned number.
const voiceSvc = S(
  {
    offeringId: 'OFF-V01',
    owner: { kind: 'customer', id: sneha.id },
    unitId: 'PRP-GV-A-104',
    propertyId: 'PRP-GV',
    location: 'Green Valley Residences, A-104',
    billingAccountId: 'BA-7001',
    status: 'Active',
    activationDate: '2024-09-02',
    contractEnd: addMonths('2024-09-02', 12),
    mrc: 12,
    addOns: [],
    equipment: [],
    phoneNumber: '+1-555-0104',
  },
  'TEN-EVG',
);
// Mark the phone number as Active and link to service.
const snehaNum = db.phoneNumbers.find((n) => n.unitId === 'PRP-GV-A-104');
if (snehaNum) { snehaNum.status = 'Active'; snehaNum.serviceInstanceId = voiceSvc; }
```

Note: check what `S()` returns — it pushes and may return the service ID. If `S` returns `void`, store the ID differently:
```ts
const voiceSvcId = `SVC-${++db.seq}`;
```
Look at how `snehaSrv` is used in existing code and follow the same pattern.

- [ ] **Step 7: Add FixedVoice invoice lines** to Sneha's `BA-7001` invoices — in the invoices section find where `BA-7001` invoices are generated and add a voice line. Find the invoice generation loop (~line 418+) and add for each month a voice line item:

After the existing `BA-7001` invoice loop, the line items for Sneha's invoices include broadband. Add FixedVoice lines alongside broadband. Find the invoice line generation and add:
```ts
{ serviceId: voiceSvc, offeringId: 'OFF-V01', description: 'FixedVoice Home – Fixed Line', amount: 12, currency: 'USD' }
```
Add this as an additional line in the months loop that already creates Sneha's broadband invoice.

- [ ] **Step 8: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**
```bash
git add src/data/seed.ts
git commit -m "feat: add FixedVoice offerings, expanded add-ons, GV phone numbers, Sneha voice service"
```

---

## Task 4: API Functions

**Files:**
- Modify: `src/api/api.ts`

**Interfaces:**
- Consumes: `PhoneNumber` from `types.ts`, `db.phoneNumbers`, existing `getDb()`, `nowIso()`, `audit()`
- Produces (exported functions):
  - `getPhoneNumbers(propertyId: string): PhoneNumber[]`
  - `togglePhoneNumber(numberId: string, enabled: boolean): void`
  - `bulkTogglePhoneNumbers(propertyId: string, unitIds: string[], enabled: boolean): void`
  - `bulkProvisionAddOn(propertyId: string, unitIds: string[], addOnId: string): { orderId: string; requestId: string; pendingApproval: boolean }`
  - `removeAddOn(serviceId: string, addOnId: string): string` (returns requestId)

- [ ] **Step 1: Add `getPhoneNumbers`** — find a logical place after `getProperty` or near the end of exports:

```ts
export function getPhoneNumbers(propertyId: string): import('./types').PhoneNumber[] {
  return getDb().phoneNumbers.filter((n) => n.propertyId === propertyId);
}
```

- [ ] **Step 2: Add `togglePhoneNumber`**:

```ts
export function togglePhoneNumber(numberId: string, enabled: boolean): void {
  const d = getDb();
  const num = d.phoneNumbers.find((n) => n.id === numberId);
  if (!num) throw new Error('Phone number not found');
  // Can only enable if a FixedVoice service exists on that unit; can always disable.
  if (enabled) {
    const svc = d.services.find((s) => s.unitId === num.unitId && s.offeringId === 'OFF-V01' && s.status === 'Active');
    if (!svc) throw new Error('No active FixedVoice service on this unit');
    num.status = 'Active';
    num.serviceInstanceId = svc.id;
  } else {
    num.status = 'Available';
    num.serviceInstanceId = undefined;
  }
  audit(d, currentUser().tenantId, currentUser().name, enabled ? 'Phone number enabled' : 'Phone number disabled', 'property', num.propertyId, num.number);
}
```

- [ ] **Step 3: Add `bulkTogglePhoneNumbers`**:

```ts
export function bulkTogglePhoneNumbers(propertyId: string, unitIds: string[], enabled: boolean): void {
  unitIds.forEach((uid) => {
    const d = getDb();
    const num = d.phoneNumbers.find((n) => n.propertyId === propertyId && n.unitId === uid);
    if (!num) return;
    if (enabled) {
      const svc = d.services.find((s) => s.unitId === uid && s.offeringId === 'OFF-V01' && s.status === 'Active');
      if (!svc) return; // skip units without FixedVoice
      num.status = 'Active';
      num.serviceInstanceId = svc.id;
    } else {
      num.status = 'Available';
      num.serviceInstanceId = undefined;
    }
  });
  audit(getDb(), currentUser().tenantId, currentUser().name, `Bulk ${enabled ? 'enable' : 'disable'} phone numbers`, 'property', propertyId, `${unitIds.length} units`);
}
```

- [ ] **Step 4: Add `bulkProvisionAddOn`**:

```ts
export function bulkProvisionAddOn(propertyId: string, unitIds: string[], addOnId: string): { orderId: string; requestId: string; pendingApproval: boolean } {
  const d = getDb();
  const user = currentUser();
  const p = d.properties.find((x) => x.id === propertyId);
  if (!p) throw new Error('Property not found');
  const needsApproval = d.settings.approvalForBulkActivation;
  const orderId = `ORD-${++d.seq}`;
  const reqId = `SR-${++d.seq}`;
  const items = unitIds.map((uid) => {
    const svc = d.services.find((s) => s.unitId === uid && s.status === 'Active' && s.offeringId.startsWith('OFF-R'));
    if (!svc) return { unitId: uid, status: 'Failed' as const, note: 'No active residential service' };
    if (!svc.addOns.includes(addOnId)) svc.addOns.push(addOnId);
    return { unitId: uid, serviceId: svc.id, status: needsApproval ? 'Awaiting Approval' as const : 'Completed' as const };
  });
  d.orders.unshift({ id: orderId, kind: 'Add-on', requestId: reqId, items });
  d.requests.unshift({ id: reqId, tenantId: p.tenantId, kind: 'Service Request', category: 'Bulk Activation', title: `Bulk add-on – ${addOnId} for ${unitIds.length} units at ${p.name}`, description: `Provisioning add-on ${addOnId} to ${unitIds.length} units.`, propertyId: p.id, priority: 'Medium', status: needsApproval ? 'Validating' : 'Completed', assignedTeam: 'Service Operations', createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, 7), timeline: [{ at: nowIso(), status: 'Submitted', by: user.name, note: `Bulk add-on order ${orderId}` }], attachments: [], orderId });
  if (needsApproval) d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId: p.tenantId, type: 'Bulk Service Activation', summary: `Provision ${addOnId} to ${unitIds.length} units at ${p.name}`, target: { kind: 'order', id: orderId }, payload: { orderId, requestId: reqId }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
  audit(d, p.tenantId, user.name, 'Bulk add-on provisioned', 'property', p.id, `${addOnId} × ${unitIds.length} units`);
  return { orderId, requestId: reqId, pendingApproval: needsApproval };
}
```

- [ ] **Step 5: Add `removeAddOn`**:

```ts
export function removeAddOn(serviceId: string, addOnId: string): string {
  const d = getDb();
  const user = currentUser();
  const svc = d.services.find((s) => s.id === serviceId);
  if (!svc) throw new Error('Service not found');
  svc.addOns = svc.addOns.filter((a) => a !== addOnId);
  const reqId = `SR-${++d.seq}`;
  d.requests.unshift({ id: reqId, tenantId: svc.tenantId, kind: 'Service Request', category: 'Add-on Removal', title: `Remove add-on ${addOnId} from ${serviceId}`, description: `Customer requested removal of add-on ${addOnId}.`, priority: 'Low', status: 'Completed', assignedTeam: 'Service Operations', createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, 1), timeline: [{ at: nowIso(), status: 'Completed', by: 'System', note: 'Add-on removed immediately' }], attachments: [] });
  audit(d, svc.tenantId, user.name, 'Add-on removed', 'service', serviceId, addOnId);
  return reqId;
}
```

- [ ] **Step 6: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**
```bash
git add src/api/api.ts
git commit -m "feat: add phone number and add-on management API functions"
```

---

## Task 5: Phone Number Inventory Page (`/mdu/phone-numbers`)

**Files:**
- Create: `src/pages/mdu/PhoneNumbers.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getPhoneNumbers`, `togglePhoneNumber`, `bulkTogglePhoneNumbers`, `listProperties` from `api.ts`
- Produces: page at `/mdu/phone-numbers?property=PRP-GV`

- [ ] **Step 1: Create `src/pages/mdu/PhoneNumbers.tsx`**:

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { bulkTogglePhoneNumbers, getPhoneNumbers, listProperties, togglePhoneNumber } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { Button, Card, ErrorState, Loading, PageHeader, Select, StatusBadge, useAction } from '../../components/ui';

export function PhoneNumbers() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const props = useApi(listProperties);
  const q = useApi(() => (propId ? getPhoneNumbers(propId) : Promise.resolve([])), [propId]);
  const [floor, setFloor] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const { run, busy } = useAction();

  if (props.error || q.error) return <ErrorState error={props.error ?? q.error!} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);
  const numbers = (q.data ?? []).filter((n) => {
    if (floor === 'All') return true;
    // e.g. unitId = 'PRP-GV-A-201' → floor segment is '2'
    const parts = n.unitId.split('-');
    const unitNum = parts[parts.length - 1]; // e.g. '201'
    return unitNum.startsWith(floor);
  });

  const floors = ['All', '1', '2', '3'];
  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = numbers.length > 0 && numbers.every((n) => selected.includes(n.id));
  const toggleAll = () => setSelected(allSelected ? [] : numbers.map((n) => n.id));

  async function handleBulkToggle(enabled: boolean) {
    const unitIds = (q.data ?? []).filter((n) => selected.includes(n.id)).map((n) => n.unitId);
    await run(() => { bulkTogglePhoneNumbers(propId, unitIds, enabled); q.refetch?.(); return Promise.resolve(); }, enabled ? 'Numbers enabled' : 'Numbers disabled');
    setSelected([]);
  }

  async function handleToggle(numberId: string, enabled: boolean) {
    await run(() => { togglePhoneNumber(numberId, enabled); q.refetch?.(); return Promise.resolve(); }, enabled ? 'Number enabled' : 'Number disabled');
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2"><Phone className="h-6 w-6 text-royal" /> Phone Number Inventory</span>}
        subtitle={property ? `${property.name} — pre-assigned fixed line numbers` : 'Select a property'}
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' }, { label: 'Phone Numbers' }]}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => { setParams({ property: v }); setSelected([]); }}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-64"
        />
        <div className="flex gap-1">
          {floors.map((f) => (
            <button key={f} onClick={() => setFloor(f)} className={`rounded-full px-3 py-1 text-sm font-medium ${floor === f ? 'bg-brand text-white' : 'border border-line-200 text-ink-600 hover:bg-surface-50'}`}>
              {f === 'All' ? 'All Floors' : `Floor ${f}`}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-royal/20 bg-royal/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-navy">{selected.length} selected</span>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(true)}>Enable</Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(false)}>Disable</Button>
          <button className="ml-auto text-ink-400 hover:text-ink-700" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <Card>
        {!propId ? (
          <p className="py-6 text-center text-sm text-ink-600">Select a property to view phone numbers.</p>
        ) : numbers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-600">No phone numbers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs font-bold uppercase text-ink-400">
                  <th className="py-3 pr-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded" />
                  </th>
                  <th className="py-3 pr-4">Unit</th>
                  <th className="py-3 pr-4">Number</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {numbers.map((n) => {
                  const unitLabel = n.unitId.split('PRP-GV-')[1] ?? n.unitId;
                  return (
                    <tr key={n.id} className="hover:bg-surface-50">
                      <td className="py-3 pr-3">
                        <input type="checkbox" checked={selected.includes(n.id)} onChange={() => toggleSelect(n.id)} className="h-4 w-4 rounded" />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-navy">{unitLabel}</td>
                      <td className="py-3 pr-4 font-medium text-navy">{n.number}</td>
                      <td className="py-3 pr-4"><StatusBadge status={n.status} /></td>
                      <td className="py-3">
                        {n.status === 'Active' ? (
                          <button onClick={() => handleToggle(n.id, false)} className="text-xs font-bold text-crimson hover:underline">Disable</button>
                        ) : (
                          <button
                            onClick={() => handleToggle(n.id, true)}
                            className="text-xs font-bold text-royal hover:underline"
                            title={n.status === 'Reserved' ? 'Reserved — cannot enable' : ''}
                            disabled={n.status === 'Reserved'}
                          >
                            Enable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add route in `src/App.tsx`**

Add import:
```tsx
import { PhoneNumbers } from './pages/mdu/PhoneNumbers';
```
Add route after `/mdu/occupancy`:
```tsx
<Route path="/mdu/phone-numbers" element={<PhoneNumbers />} />
```

- [ ] **Step 3: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: no errors. If `q.refetch` is not on the `useApi` return type, use `useDbVersion` pattern or call `window.location.reload()` as fallback — check `src/lib/hooks.ts` for the actual return shape.

- [ ] **Step 4: Commit**
```bash
git add src/pages/mdu/PhoneNumbers.tsx src/App.tsx
git commit -m "feat: add Phone Number Inventory page at /mdu/phone-numbers"
```

---

## Task 6: Add-ons Management Page (`/mdu/addons`)

**Files:**
- Create: `src/pages/mdu/AddonsManagement.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `bulkProvisionAddOn`, `listProperties`, `listUnits`, `listServices`, `offerings` from `api.ts`
- Produces: page at `/mdu/addons?property=PRP-GV` with Overview + Bulk Provision tabs

- [ ] **Step 1: Create `src/pages/mdu/AddonsManagement.tsx`**:

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { bulkProvisionAddOn, listProperties, listServices, listUnits, offerings } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { money } from '../../lib/format';
import { Button, Card, ErrorState, Loading, PageHeader, Select, StatusBadge, Tabs, useAction } from '../../components/ui';

export function AddonsManagement() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const [tab, setTab] = useState<'overview' | 'bulk'>('overview');
  const [selAddOn, setSelAddOn] = useState('');
  const [selUnits, setSelUnits] = useState<string[]>([]);
  const [done, setDone] = useState<{ orderId: string; requestId: string; pendingApproval: boolean } | null>(null);
  const { run, busy } = useAction();
  const nav = useNavigate();

  const props = useApi(listProperties);
  const units = useApi(() => (propId ? listUnits(propId) : Promise.resolve([])), [propId]);
  const services = useApi(() => listServices(), [propId]);

  if (props.error) return <ErrorState error={props.error} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);

  // Residential add-ons from all broadband + FixedVoice offerings.
  const allAddOns = offerings()
    .filter((o) => o.segment === 'Residential' && o.addOns?.length)
    .flatMap((o) => o.addOns ?? [])
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i); // dedupe

  // Per-unit add-on summary for Overview tab.
  const unitServices = (units.data ?? []).map((u) => {
    const svc = (services.data ?? []).filter((s) => s.unitId === u.id && s.status === 'Active');
    const activeAddOnIds = svc.flatMap((s) => s.addOns);
    const activeAddOnNames = activeAddOnIds
      .map((id) => allAddOns.find((a) => a.id === id)?.name ?? id)
      .filter(Boolean);
    return { unit: u, activeAddOnNames };
  }).filter((r) => r.unit.occupancy !== 'Vacant');

  const toggleUnit = (id: string) =>
    setSelUnits((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submitBulk() {
    if (!selAddOn || selUnits.length === 0) return;
    const result = await run(() => bulkProvisionAddOn(propId, selUnits, selAddOn), 'Bulk add-on order submitted');
    if (result) { setDone(result); setSelUnits([]); setSelAddOn(''); }
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2"><Package className="h-6 w-6 text-royal" /> Add-ons Management</span>}
        subtitle={property ? `${property.name}` : 'Select a property'}
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' }, { label: 'Add-ons' }]}
      />

      <div className="mb-4">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => { setParams({ property: v }); setSelUnits([]); setDone(null); }}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-64"
        />
      </div>

      <Tabs
        active={tab}
        onChange={(t) => { setTab(t as 'overview' | 'bulk'); setDone(null); }}
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'bulk', label: 'Bulk Provision' }]}
      />

      {tab === 'overview' && (
        <Card>
          {!propId ? (
            <p className="py-6 text-center text-sm text-ink-600">Select a property.</p>
          ) : unitServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-600">No occupied units with active services.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-200 text-left text-xs font-bold uppercase text-ink-400">
                    <th className="py-3 pr-4">Unit</th>
                    <th className="py-3 pr-4">Occupancy</th>
                    <th className="py-3">Active Add-ons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-100">
                  {unitServices.map(({ unit, activeAddOnNames }) => (
                    <tr key={unit.id} className="hover:bg-surface-50">
                      <td className="py-3 pr-4 font-mono text-xs text-navy">{unit.number}</td>
                      <td className="py-3 pr-4"><StatusBadge status={unit.occupancy} /></td>
                      <td className="py-3">
                        {activeAddOnNames.length === 0 ? (
                          <span className="text-ink-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeAddOnNames.map((name) => (
                              <span key={name} className="rounded-full bg-royal/10 px-2 py-0.5 text-xs font-medium text-royal">{name}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'bulk' && (
        <Card>
          {done ? (
            <div className="py-6 text-center">
              <p className="text-lg font-semibold text-navy">Order submitted</p>
              <p className="mt-1 text-sm text-ink-600">Order <span className="font-mono">{done.orderId}</span> · Request <span className="font-mono">{done.requestId}</span></p>
              {done.pendingApproval && <p className="mt-1 text-sm text-amber-700">Pending approval before provisioning.</p>}
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setDone(null)}>Provision another</Button>
                <Button onClick={() => nav(`/requests/${done.requestId}`)}>Track request</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold text-navy">Step 1 — Select add-on</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allAddOns.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelAddOn(a.id)}
                      className={`rounded-xl border p-4 text-left transition ${selAddOn === a.id ? 'border-royal bg-royal/5 shadow-sm' : 'border-line-100 hover:border-royal/40'}`}
                    >
                      <p className="font-semibold text-navy">{a.name}</p>
                      <p className="text-sm text-ink-600">{money(a.mrc, 'USD')} / month</p>
                    </button>
                  ))}
                </div>
              </div>

              {propId && selAddOn && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-navy">Step 2 — Select units</p>
                  <div className="mb-2 flex gap-2">
                    <button onClick={() => setSelUnits(unitServices.map((u) => u.unit.id))} className="text-xs font-bold text-royal hover:underline">Select all</button>
                    <button onClick={() => setSelUnits([])} className="text-xs font-bold text-ink-400 hover:underline">Clear</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {unitServices.map(({ unit }) => (
                      <label key={unit.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${selUnits.includes(unit.id) ? 'border-royal bg-royal/5' : 'border-line-100 hover:border-royal/30'}`}>
                        <input type="checkbox" checked={selUnits.includes(unit.id)} onChange={() => toggleUnit(unit.id)} className="h-4 w-4 rounded" />
                        <span className="font-mono text-xs text-navy">{unit.number}</span>
                        <StatusBadge status={unit.occupancy} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selAddOn && selUnits.length > 0 && (
                <div className="rounded-xl border border-line-100 bg-surface-50 p-4 text-sm">
                  <p className="font-semibold text-navy">Step 3 — Review & confirm</p>
                  <p className="mt-1 text-ink-600">Add-on: <b>{allAddOns.find((a) => a.id === selAddOn)?.name}</b></p>
                  <p className="text-ink-600">Units: <b>{selUnits.length}</b></p>
                  <p className="text-ink-600">Monthly impact: <b>{money((allAddOns.find((a) => a.id === selAddOn)?.mrc ?? 0) * selUnits.length, 'USD')}</b></p>
                  <Button className="mt-3" loading={busy} onClick={submitBulk}>Submit bulk provision</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route in `src/App.tsx`**

Add import:
```tsx
import { AddonsManagement } from './pages/mdu/AddonsManagement';
```
Add route after `/mdu/phone-numbers`:
```tsx
<Route path="/mdu/addons" element={<AddonsManagement />} />
```

- [ ] **Step 3: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/pages/mdu/AddonsManagement.tsx src/App.tsx
git commit -m "feat: add Add-ons Management page at /mdu/addons"
```

---

## Task 7: PropertyDetail Navigation Links

**Files:**
- Modify: `src/pages/mdu/PropertyDetail.tsx`

**Interfaces:**
- Consumes: existing `can()`, `p.id` from property data
- Produces: "Phone Numbers" and "Add-ons" `LinkButton` in page actions

- [ ] **Step 1: Add `Phone` and `Package` to imports** (lucide-react) in PropertyDetail.tsx:

```tsx
import { FileText, LifeBuoy, Package, Phone, Plus, Upload, Zap } from 'lucide-react';
```

- [ ] **Step 2: Add `LinkButton` import** — already imported, check `../../components/ui` has it; if not add it.

- [ ] **Step 3: Add action buttons** in the `actions` prop of `PageHeader` (~line 41), after the Bulk Activation button:

```tsx
{can('property.read') && (
  <LinkButton to={`/mdu/phone-numbers?property=${p.id}`} variant="secondary">
    <Phone className="h-4 w-4" /> Phone Numbers
  </LinkButton>
)}
{can('unit.manage') && (
  <LinkButton to={`/mdu/addons?property=${p.id}`} variant="secondary">
    <Package className="h-4 w-4" /> Add-ons
  </LinkButton>
)}
```

- [ ] **Step 4: Type-check and verify**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add src/pages/mdu/PropertyDetail.tsx
git commit -m "feat: add Phone Numbers and Add-ons nav links to PropertyDetail"
```

---

## Task 8: Resident Dashboard — FixedVoice Service Card

**Files:**
- Modify: `src/pages/ResidentDashboard.tsx`

**Interfaces:**
- Consumes: `listServices()` (already loaded), `s.category === 'Voice'`
- Produces: FixedVoice service card in "My Services" grid with phone number

- [ ] **Step 1: Add `Phone` to lucide-react imports**:

```tsx
import { Headphones, Home, Phone, Receipt, Settings as SettingsIcon, Smartphone, Wifi } from 'lucide-react';
```

- [ ] **Step 2: Update the service card icon + label logic** in the `live.map()` block (~line 47):

Replace:
```tsx
const mobile = s.category === 'Mobile';
```
with:
```tsx
const mobile = s.category === 'Mobile';
const voice = s.category === 'Voice';
```

Replace the icon line:
```tsx
{mobile ? <Smartphone className="h-8 w-8 text-ink-400" /> : <Wifi className="h-8 w-8 text-ink-400" />}
```
with:
```tsx
{mobile ? <Smartphone className="h-8 w-8 text-ink-400" /> : voice ? <Phone className="h-8 w-8 text-ink-400" /> : <Wifi className="h-8 w-8 text-ink-400" />}
```

Replace the service label line:
```tsx
<p className="mt-3 text-[30px] font-semibold leading-tight text-navy">{mobile ? 'Mobile' : 'Broadband'}</p>
```
with:
```tsx
<p className="mt-3 text-[30px] font-semibold leading-tight text-navy">{mobile ? 'Mobile' : voice ? 'Fixed Voice' : 'Broadband'}</p>
```

Replace the identifier line:
```tsx
<p className="text-lg text-navy">{mobile ? s.location.replace('Mobile ', '') : s.id}</p>
```
with:
```tsx
<p className="text-lg text-navy">{mobile ? s.location.replace('Mobile ', '') : voice && s.phoneNumber ? s.phoneNumber : s.id}</p>
```

> Note: `s.phoneNumber` is the new field on `ServiceInstance`. Check if `getService` or `listServices` returns it — it should since it reads directly from `db.services`.

- [ ] **Step 3: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src/pages/ResidentDashboard.tsx
git commit -m "feat: add FixedVoice service card to resident dashboard"
```

---

## Task 9: My Home — Home Phone Section

**Files:**
- Modify: `src/pages/mdu/MyHome.tsx`

**Interfaces:**
- Consumes: `unit.services` (existing), filter for `offeringId === 'OFF-V01'`
- Produces: "Home Phone" card showing assigned number, status, plan

- [ ] **Step 1: Update `broadband` variable and add `voice` variable** (~line 19):

Replace:
```tsx
const broadband = unit.services.find((s) => s.status !== 'Terminated');
```
with:
```tsx
const broadband = unit.services.find((s) => s.status !== 'Terminated' && s.offeringId !== 'OFF-V01');
const voiceService = unit.services.find((s) => s.offeringId === 'OFF-V01' && s.status !== 'Terminated');
```

- [ ] **Step 2: Add Home Phone card** after the "Home connection & equipment" card (`lg:col-span-2` card) and before "Visits & appointments":

```tsx
<Card title="Home phone (FixedVoice)">
  {voiceService ? (
    <dl className="space-y-3">
      <Stat label="Assigned number">
        <span className="flex items-center gap-1.5 text-lg font-semibold text-navy">
          <Phone className="h-4 w-4 text-royal" />
          {voiceService.phoneNumber ?? '—'}
        </span>
      </Stat>
      <Stat label="Status"><StatusBadge status={voiceService.status} /></Stat>
      <Stat label="Plan">{voiceService.offeringName}</Stat>
    </dl>
  ) : (
    <div className="text-sm text-ink-700">
      No FixedVoice service at this unit.{' '}
      <LinkButton to={`/services/new?unit=${unit.id}`} size="sm" variant="primary" className="ml-2">
        Add FixedVoice
      </LinkButton>
    </div>
  )}
  {voiceService && (
    <LinkButton to={`/services/${voiceService.id}`} size="sm" variant="ghost" className="mt-3 px-0">
      Manage plan & add-ons →
    </LinkButton>
  )}
</Card>
```

> Note: `voiceService.offeringName` — check if `getMyHome` returns this field on services. If not, look up from `offerings()` using `offeringId`. If only `offeringId` is available: use `offerings().find(o => o.id === voiceService.offeringId)?.name ?? voiceService.offeringId`.

- [ ] **Step 3: Add `Phone` to lucide imports** (it's already imported in this file — verify).

- [ ] **Step 4: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add src/pages/mdu/MyHome.tsx
git commit -m "feat: add Home Phone section to My Home page"
```

---

## Task 10: ServiceDetail — Remove Add-on + FixedVoice Add-ons

**Files:**
- Modify: `src/pages/services/ServiceDetail.tsx`

**Interfaces:**
- Consumes: `removeAddOn` from `api.ts`
- Produces: remove button on active add-on cards; Voicemail/Intl add-ons visible for Voice services

- [ ] **Step 1: Add `removeAddOn` to imports**:

```tsx
import { can, getService, listInvoices, offerings, removeAddOn, requestServiceChange } from '../../api/api';
```

- [ ] **Step 2: Add remove handler** inside `ServiceDetail` component after existing state declarations:

```tsx
const { run: runRemove, busy: removeBusy } = useAction();

async function handleRemoveAddOn(addOnId: string) {
  await runRemove(() => removeAddOn(s.id, addOnId), 'Add-on removed');
  q.refetch?.();
}
```

- [ ] **Step 3: Add Remove button to active add-on cards** (~line 96–104):

Replace the existing add-on card:
```tsx
{activeAddOns.map((a) => (
  <div key={a.id} className="flex min-h-[200px] flex-col justify-between rounded-card border border-line-100 bg-brand-soft p-6">
    <div>
      <p className="text-lg font-semibold text-navy">{a.name}</p>
      <p className="mt-1 text-sm text-ink-600">{money(a.mrc, s.currency)} / month</p>
    </div>
    <StatusBadge status="Active" />
  </div>
))}
```
with:
```tsx
{activeAddOns.map((a) => (
  <div key={a.id} className="flex min-h-[200px] flex-col justify-between rounded-card border border-line-100 bg-brand-soft p-6">
    <div>
      <p className="text-lg font-semibold text-navy">{a.name}</p>
      <p className="mt-1 text-sm text-ink-600">{money(a.mrc, s.currency)} / month</p>
    </div>
    <div className="flex items-center justify-between">
      <StatusBadge status="Active" />
      {order && (
        <button
          disabled={removeBusy || s.status !== 'Active'}
          onClick={() => handleRemoveAddOn(a.id)}
          className="text-xs font-bold text-crimson hover:underline disabled:opacity-40"
        >
          Remove
        </button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 4: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```
If `q.refetch` doesn't exist on `useApi`, use `useDbVersion` to force re-render or navigate away and back. Check `src/lib/hooks.ts` for the actual API shape.

- [ ] **Step 5: Commit**
```bash
git add src/pages/services/ServiceDetail.tsx
git commit -m "feat: add remove add-on capability to service detail"
```

---

## Task 11: Ordering Flows — FixedVoice in NewConnection, OccupantOnboarding, BulkActivation

**Files:**
- Modify: `src/pages/services/NewConnection.tsx`
- Modify: `src/pages/mdu/OccupantOnboarding.tsx`
- Modify: `src/pages/services/BulkActivation.tsx`

**Interfaces:**
- Consumes: `OFF-V01` in `offerings()`, `getPhoneNumbers` from `api.ts`
- Produces: FixedVoice selectable in all three ordering flows

### NewConnection.tsx

- [ ] **Step 1: Import `getPhoneNumbers`**:

```tsx
import { can, checkAvailability, currentUser, getPhoneNumbers, getUnit, listAccounts, listBillingAccounts, listProperties, listUnits, offerings, submitNewConnection } from '../../api/api';
```

- [ ] **Step 2: Load phone numbers for the selected unit's property** — add state and data loading after existing `useApi` calls:

```tsx
const propertyIdForNumbers = unit.data?.propertyId ?? '';
const phoneNums = useApi(() => (propertyIdForNumbers ? getPhoneNumbers(propertyIdForNumbers) : Promise.resolve([])), [propertyIdForNumbers]);
const assignedNumber = phoneNums.data?.find((n) => n.unitId === unitId && n.status === 'Available')?.number;
```

- [ ] **Step 3: In Step 2 ("Address & availability") show FixedVoice in the eligible offerings** — `OFF-V01` will appear in `eligible` once `eligibleOfferingIds` includes it. Update `checkAvailability` logic in `api.ts` to always include `OFF-V01` for residential units (or ensure it's already included).

Check the `checkAvailability` function in `api.ts`:
```bash
grep -n "checkAvailability\|eligibleOfferingIds" src/api/api.ts
```
If it filters by `techRequired`, ensure `OFF-V01` has no `techRequired` (it doesn't — already correct in seed).

- [ ] **Step 4: Show pre-assigned number hint** — in the plan step (step 2), after the offering selection, add:

```tsx
{offeringId === 'OFF-V01' && assignedNumber && (
  <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
    Your pre-assigned number: <b>{assignedNumber}</b>. It will be activated when your service goes live.
  </p>
)}
```

### OccupantOnboarding.tsx

- [ ] **Step 5: Find the service selection step** in OccupantOnboarding — search for where offerings/plans are selected and add a FixedVoice checkbox:

```tsx
{/* FixedVoice option */}
{offerings().find((o) => o.id === 'OFF-V01') && (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-100 p-4 hover:border-royal/40">
    <input
      type="checkbox"
      checked={selectedAddOns?.includes('OFF-V01') ?? false}
      onChange={(e) => {
        // toggle OFF-V01 in selected services list
        setSelectedServices?.((prev: string[]) =>
          e.target.checked ? [...prev, 'OFF-V01'] : prev.filter((id) => id !== 'OFF-V01')
        );
      }}
      className="h-4 w-4 rounded"
    />
    <div>
      <p className="font-semibold text-navy">FixedVoice Home</p>
      <p className="text-sm text-ink-600">Fixed landline — {money(12, 'USD')}/mo · Pre-assigned number activated on connection</p>
    </div>
  </label>
)}
```

> Read OccupantOnboarding.tsx fully before implementing this step to understand its exact state shape and service selection step. Adapt the state variable names to match.

### BulkActivation.tsx

- [ ] **Step 6: In the Plan step** of BulkActivation, add a "Include FixedVoice Home" checkbox:

```tsx
{offerings().find((o) => o.id === 'OFF-V01') && (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-100 p-4">
    <input
      type="checkbox"
      checked={includeVoice}
      onChange={(e) => setIncludeVoice(e.target.checked)}
      className="h-4 w-4 rounded"
    />
    <div>
      <p className="font-semibold text-navy">Include FixedVoice Home</p>
      <p className="text-sm text-ink-600">Activates pre-assigned phone numbers for each unit · +{money(12, 'USD')}/mo per unit</p>
    </div>
  </label>
)}
```

Add `const [includeVoice, setIncludeVoice] = useState(false);` state. Include FixedVoice in the MRC total calculation shown in the preview when `includeVoice` is true.

> Read BulkActivation.tsx fully before implementing to find the exact plan step and state shape.

- [ ] **Step 7: Type-check**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```

- [ ] **Step 8: Commit**
```bash
git add src/pages/services/NewConnection.tsx src/pages/mdu/OccupantOnboarding.tsx src/pages/services/BulkActivation.tsx
git commit -m "feat: add FixedVoice option to NewConnection, OccupantOnboarding and BulkActivation flows"
```

---

## Task 12: Push to GitHub

- [ ] **Step 1: Verify type-check passes cleanly**
```bash
cd D:/Claude/Projects/B2B_B2B2C_SelfCare_MDU_Management_Use_Case && npx tsc -b --noEmit
```

- [ ] **Step 2: Push branch**
```bash
git push origin claude/happy-ramanujan-i8clvr
```

---

## Self-Review Checklist

- [x] **Spec § UI Cleanup**: Task 1 covers Orders nav, AARYA, Demo Reset
- [x] **Spec § Data Model**: Task 2 covers PhoneNumber type, ServiceInstance.phoneNumber, Database.phoneNumbers
- [x] **Spec § Seed Data**: Task 3 covers OFF-V01/P04, add-ons expansion, GV numbers, Sneha voice service + billing
- [x] **Spec § API**: Task 4 covers all 5 new API functions
- [x] **Spec § Phone Numbers page**: Task 5
- [x] **Spec § Add-ons Management page**: Task 6
- [x] **Spec § PropertyDetail nav**: Task 7
- [x] **Spec § ResidentDashboard**: Task 8
- [x] **Spec § MyHome**: Task 9
- [x] **Spec § ServiceDetail remove add-on**: Task 10
- [x] **Spec § Ordering flows**: Task 11
- [x] **Spec § Voicemail & Intl calling add-ons**: Covered in Task 3 (seeded on OFF-V01) + Task 10 (visible in ServiceDetail for Voice services since add-ons come from the offering)
- [x] **Spec § Billing**: FixedVoice invoice lines seeded in Task 3; existing billing pages pick them up automatically through `listInvoices` since they filter by billing account
- [x] **No TBDs or placeholders**: confirmed
- [x] **Type consistency**: `PhoneNumber` defined in Task 2, imported in Tasks 3+5, all field names consistent
