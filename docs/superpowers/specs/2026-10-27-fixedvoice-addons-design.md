# FixedVoice & Add-ons Management — Design Spec
**Date:** 2026-10-27
**Status:** Approved

---

## 1. Overview

Two features are being added to the B2B/B2B2C/MDU Self-Care prototype:

1. **FixedVoice (Landline/Fixed Line)** — A standalone residential voice service with pre-assigned phone numbers per MDU unit. Reflected in all ordering/onboarding journeys, billing, and the MDU property manager's number inventory view.
2. **Add-ons Management** — An expanded add-ons catalogue with dedicated management UIs for both the MDU Property Manager (Priya) and the Individual Resident (Sneha).

---

## 2. Data Model Changes

### 2.1 New Type: `PhoneNumber`

```ts
interface PhoneNumber {
  id: ID;
  number: string;          // e.g. "+1-555-0104"
  propertyId: ID;
  unitId: ID;
  status: 'Available' | 'Active' | 'Reserved';
  serviceInstanceId?: ID;  // set when FixedVoice service is active on this unit
}
```

Stored as `db.phoneNumbers[]`.

### 2.2 New Product Offerings

| ID | Name | Category | MRC | NRC | Term | Segment |
|----|------|----------|-----|-----|------|---------|
| OFF-V01 | FixedVoice Home | Voice | $12 | $0 | 12-month | Residential |
| OFF-P04 | Property Voice Lines Pack | Voice | $18 | $0 | 24-month | Property |

### 2.3 Expanded Add-ons Catalogue

Added to residential offerings OFF-R01, OFF-R02, OFF-R03:

| ID | Name | MRC |
|----|------|-----|
| ADD-OTT | OTT Entertainment Pack (existing) | $5 |
| ADD-OTT-PREM | OTT Premium Pack – Sports & Movies | $12 |
| ADD-STB | Additional Set-top Box | $8 |
| ADD-MESH | Mesh Router / Wi-Fi Extender (existing) | $4 |
| ADD-MESH-NODE | Extra Mesh Node | $6 |
| ADD-STATIC-IP | Static IP (existing) | $8 |

> Voice/Fixed Line is a **standalone service** (`OFF-V01`), not an add-on.

### 2.4 `ServiceInstance` Update

Add optional field:
```ts
phoneNumber?: string;  // assigned phone number, populated for OFF-V01 services
```

### 2.5 `Settings` Update

```ts
reportingFx: { USD: number };  // already updated
```

---

## 3. Seed Data

### 3.1 Phone Number Inventory — Green Valley (PRP-GV)

Pre-assign 12 numbers to Tower A units:

| Unit | Number | Status |
|------|--------|--------|
| A-101 | +1-555-0101 | Available |
| A-102 | +1-555-0102 | Available |
| A-103 | +1-555-0103 | Available |
| A-104 | +1-555-0104 | **Active** (Sneha) |
| A-201 | +1-555-0201 | Available |
| A-202 | +1-555-0202 | Available |
| A-203 | +1-555-0203 | Available |
| A-204 | +1-555-0204 | Available |
| A-301 | +1-555-0301 | Available |
| A-302 | +1-555-0302 | Available |
| A-303 | +1-555-0303 | Available |
| A-304 | +1-555-0304 | Available |

### 3.2 Sneha's FixedVoice Service

- Service ID: `SVC-VOICE-SNEHA`
- Offering: `OFF-V01` (FixedVoice Home)
- Billing account: `BA-7001` (existing — shared with broadband)
- Status: Active
- Phone number: `+1-555-0104`
- Activation date: `2024-09-02`

### 3.3 Sneha's Updated Add-ons

Sneha already has `ADD-OTT` active. No additional add-ons seeded by default — she can add via self-care.

### 3.4 Billing

Sneha's invoice lines for `BA-7001`:
- FiberHome 300 Mbps — $999/mo (existing, renamed to USD)
- FixedVoice Home — $12/mo (new)
- OTT Entertainment Pack — $5/mo (existing add-on)

---

## 4. New Pages

### 4.1 `/mdu/phone-numbers` — Phone Number Inventory (Priya)

**Purpose:** Property manager views and manages pre-assigned phone numbers per unit.

**Layout:**
- Property selector (if Priya manages multiple properties)
- Floor filter tabs (All / Floor 1 / Floor 2 / Floor 3)
- Table columns: Unit | Assigned Number | Occupant | Plan | Status | Action
- Status badge: Active (green) / Available (grey) / Reserved (amber)
- Per-row toggle: Enable / Disable (requires occupant to have FixedVoice plan)
- Bulk select checkboxes + "Enable Selected" / "Disable Selected" actions
- Disabled toggle with tooltip if unit has no FixedVoice plan: "Occupant has not subscribed to FixedVoice"

**Entry point:** PropertyDetail sidebar → "Phone Numbers" link

### 4.2 `/mdu/addons` — Add-ons Management (Priya)

**Purpose:** Property manager views per-unit add-on status and bulk-provisions add-ons.

**Layout — Tab 1: Overview**
- Property/floor filters
- Grid/table: Unit | Occupant | Active Add-ons (chip list) | Action
- Click a unit row → slide-out showing full add-on detail for that unit

**Layout — Tab 2: Bulk Provision**
- Step 1: Select add-on from catalogue (card grid with name, MRC, description)
- Step 2: Select target units (checkbox table with floor grouping, "Select All Floor" shortcut)
- Step 3: Review & confirm (summary: X units, add-on name, total MRC impact)
- On submit: creates a bulk order; triggers approval flow if `approvalForBulkActivation` is enabled
- Success state: order ID + "View in Approvals" link if pending

**Entry point:** PropertyDetail sidebar → "Add-ons" link

---

## 5. Enhancements to Existing Pages

### 5.1 Resident Dashboard (`ResidentDashboard.tsx`)

- Add FixedVoice service card in the "My Services" grid alongside Broadband and Mobile
- Card shows: phone number, status, MRC
- "Manage" link → ServiceDetail for the FixedVoice service

### 5.2 My Home (`MyHome.tsx`)

- Add "Home Phone" section showing assigned number (+1-555-0104), status (Active), and plan name (FixedVoice Home)
- If no FixedVoice plan: show "Add FixedVoice" CTA linking to NewConnection

### 5.3 Service Detail (`ServiceDetail.tsx`)

- Expanded add-ons catalogue: OTT Entertainment Pack, OTT Premium Pack, Additional Set-top Box, Mesh Router, Extra Mesh Node, Static IP
- Each add-on card: name, description, MRC, "Add" / "Remove" button
- Active add-ons section updated to show all new add-on types with remove capability

### 5.4 New Connection (`NewConnection.tsx`)

- Add FixedVoice Home as a selectable service type (alongside Broadband, Mobile)
- Service type card: icon (phone handset), name, description, MRC from $12/mo
- If unit has a pre-assigned number, show it during the order flow ("Your number will be: +1-555-XXXX")

### 5.5 Occupant Onboarding (`OccupantOnboarding.tsx`)

- Add FixedVoice Home checkbox in the service selection step
- Show pre-assigned number for the unit being onboarded
- Include FixedVoice MRC in order summary

### 5.6 Bulk Activation (`BulkActivation.tsx`)

- Add FixedVoice as a service option in the bulk activation flow
- Preview table shows voice line status per eligible unit
- MRC total includes voice if selected

### 5.7 Invoices / Billing Overview

- FixedVoice line item appears in invoice detail under "Voice" product family
- BillingOverview monthly trend includes voice charges
- Invoice PDF export includes FixedVoice line

---

## 6. API Changes (`api.ts`)

### New functions:

```ts
// Phone number inventory
getPhoneNumbers(propertyId: ID): PhoneNumber[]
togglePhoneNumber(numberId: ID, enabled: boolean): void
bulkTogglePhoneNumbers(propertyId: ID, unitIds: ID[], enabled: boolean): void

// Add-ons
bulkProvisionAddOn(propertyId: ID, unitIds: ID[], addOnId: string): { orderId, requestId, pendingApproval }
removeAddOn(serviceId: ID, addOnId: string): void  // complete existing stub
```

### Updates to existing functions:
- `activateOccupantService` — assign phone number when FixedVoice is selected
- `createBulkOrder` — include voice lines in eligible unit calculation
- `newConnection` — handle FixedVoice offering, assign phone number from inventory

---

## 7. Navigation Updates

### Priya (MDU Property Manager)
- PropertyDetail page sidebar/actions: add **"Phone Numbers"** and **"Add-ons"** links
- MDU section nav: surface both new pages

### Sneha (Resident)
- No new nav items — FixedVoice surfaces as a service card in existing dashboard
- Add-ons management remains within ServiceDetail

---

## 8. Personas Affected

| Persona | Role | Changes |
|---------|------|---------|
| Priya Menon | MDU Property Manager (TEN-EVG) | Phone Number Inventory page, Add-ons Management page, PropertyDetail nav links |
| Sneha Kulkarni | Resident (TEN-RES, Unit A-104) | FixedVoice service card, phone number in MyHome, expanded add-ons in ServiceDetail |
| B2B Admin | Enterprise (TEN-6DGE) | FixedVoice available in NewConnection; add-ons catalogue expanded |

---

## 9. Out of Scope

- Call logs / CDR (call detail records)
- Number porting
- Voicemail configuration
- International calling plans
- Number reservation/selection by occupant
