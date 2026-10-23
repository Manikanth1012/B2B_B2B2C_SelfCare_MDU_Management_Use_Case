# 6D Business & MDU Self-Care Portal (prototype)

An interactive B2B / B2B2C telecom self-care prototype for enterprise customers, MDU property managers, billing administrators, residents and operator staff. It brings together business account hierarchies, multi-dwelling-unit (MDU) management, services, billing and service requests, with role- and scope-based access enforced in the data-access layer.

The front end follows the **6D consumer self-care template** (Service Center / Bills & Payments / Orders look): a crimson → purple gradient top bar with yellow active underline, Montserrat type, rounded white cards on the teal-ring / coral-ring / dot-grid background, gradient pill buttons, gradient table headers, Tickets-History KPI tiles, left-tab settings and the floating **Ask AARYA** assistant.

All data is synthetic. Every provisioning, payment, approval and notification action is **simulated** and labelled as such in the UI. No live BSS, network or payment system is called.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static build in dist/ (relative paths; hostable on any static server)
npm run preview      # serve dist/ on http://localhost:4173
```

The persona switcher is in the user menu, top right. **Reset demo data** in the same menu reseeds the mock database. State persists in `localStorage` across refreshes.

| Persona | Role | Scope |
|---|---|---|
| Ananya Rao | Enterprise Super Administrator | 6D Global Enterprises and all descendants |
| Vikram Shetty | Business Account Administrator | 6D India subtree |
| Karthik Reddy | Business Account Administrator (delegated) | Bangalore Office only, no inheritance |
| Rahul Iyer | Billing Administrator | 6D Global Group Billing subtree |
| Priya Menon | MDU Property Manager | Green Valley Residences, Sunrise Heights |
| Deepa Joshi | MDU Property Manager (other tenant) | Palm Meadows Towers |
| Sneha Kulkarni | Resident / Unit Subscriber | Green Valley A-104 only |
| Arjun Nair | Operator Administrator (demo) | All tenants; decides MDU approvals; simulates fulfilment |

## What's in it

| Area | Screens |
|---|---|
| Dashboard | Welcome header, offer carousel, My Services / amount-due tiles, Quick Links, KPI tiles, charts, profile |
| Business accounts | Overview and KPIs, **hierarchy explorer** (tree/list, search, ancestor highlighting, side panel, validated move with approval, billing links shown as dashed relationships), account details (7 tabs), 5-step child account wizard, contacts and delegation |
| MDU | Portfolio (cards/table), 5-step property registration (generates towers, floors and units), property details (8 tabs), **tower/floor/unit grid and hierarchy**, unit drawer with eligibility-checked actions, occupancy management, CSV bulk unit import with row-level validation, error report and partial success, resident "My Home" |
| Services | Portfolio with filters, subscription page (Current Active Offer, add-ons, change plan, suspend/resume, usage), availability check, 6-step new connection journey, plan changes, bulk activation with per-unit rejection, order tracking with simulated provisioning |
| Billing | Bills & Payments (Current Bill, invoice and payment history), billing hierarchy with consolidated vs child views, invoices (detail, download, simulated pay), cost allocation, payments, preferences, billing reassignment with approval |
| Service Center | Tickets History tiles, ticket list, Create Ticket (template form), ticket detail with status timeline, comments and attachments, appointments, FAQ |
| Admin | Users (invite, edit access, revoke; you can only grant what you hold), roles and permissions matrix, approval queue (separation of duties), reports (accounts, MDU penetration, revenue, operations), audit history |
| Settings | Customer settings, account settings (basic details, communication preferences, approval policy), notifications, logout |

## Design rules implemented

- **Three separate hierarchies.** Organisational ownership (`AccountRelationship`), billing roll-up (`BillingAccountRelationship`) and physical premises (`Property → Building → Floor → Unit`) never stand in for one another. Hyderabad Office is served at its own site but billed to India Corporate Billing.
- **Residents are not children of the property manager.** Units link to resident `CustomerAccount`s through dated `OccupancyAssignment`s. Changing an occupant never changes billing.
- **Occupancy, network readiness and service status are independent.** Unit connectivity is *derived* (Connected / Ready for Service / Pending Installation / Network Not Ready / Suspended). Occupancy is shown with its own glyph. States never depend on colour alone.
- **Effective dating.** Account moves end-date the old relationship. Occupancy changes end-date the previous assignment.
- **Integrity.** Cycle prevention, type rules (e.g. a Branch can't hold a Subsidiary), duplicate name and registration checks, no cross-tenant moves, and re-validation of a move at approval time.
- **Authorisation in the API layer.** `src/api/scope.ts` resolves each user's visible accounts, billing accounts, properties and units. Every API call filters or refuses on that basis, so hiding a button is never the only control. Delegation can't exceed the delegator's own role or scope.
- **Controlled change.** Hierarchy moves, billing-responsibility changes, sensitive data edits, bulk activations and property-administrator grants go through approvals, with configurable policy for child accounts, bulk activation and billing changes. Orders never silently alter a live service.
- **Qualification gates activation.** An order needs a passing qualification. "Additional Network Work Required" and "Service Not Available" block the journey.

## Architecture

```
src/
  data/types.ts      domain model (≈25 entities)
  data/seed.ts       deterministic synthetic seed (540 MDU units, 3 properties, 12 business accounts…)
  data/store.ts      localStorage persistence + change subscription
  api/scope.ts       scope resolution, hierarchy helpers, auth/validation errors
  api/api.ts         mock TMF-aligned adapter: async, latency, RBAC on every call
  components/        layout (top nav, AARYA), UI kit, template blocks
  pages/             feature pages by domain
e2e/                 Playwright smoke (all routes × all roles) and acceptance journeys
```

Stack: React 18, TypeScript, Vite, Tailwind CSS, React Router (hash routing for static hosting), Recharts, Lucide.

### TM Forum alignment (adapter seams)

| Domain | Open API |
|---|---|
| Customer / party / roles | TMF629, TMF632, TMF669 |
| Billing accounts | TMF666 |
| Bills, payments | TMF678 (+ TMF676 for payments) |
| Catalogue, qualification | TMF620, TMF679, TMF645 |
| Ordering | TMF622, TMF641 |
| Inventory | TMF637 |
| Tickets | TMF621 |
| Agreements (bulk contracts) | TMF651 |
| Users and permissions | TMF672 |

Buildings, floors and units are a separate premises domain with configurable mapping to TMF673/TMF674 (geographic address/site). They are not forced into TMF666.

## Verification

```bash
npm run build && npm run preview &
CHROME_PATH=/path/to/chrome npm run e2e
```

`e2e/smoke.mjs` loads all 37 routes as all 8 personas and fails on any runtime error. `e2e/journeys.mjs` drives acceptance journeys A–I from the specification, plus cross-tenant isolation:

- **A** create subsidiary with admin → visible in hierarchy
- **B** branch services and billing
- **C** register MDU → generated units
- **D** qualify and order for A-302 (and blocked on a not-ready unit)
- **E** CSV import with partial success
- **F** bulk activation → operator approval → simulated per-unit fulfilment
- **G** consolidated → child billing drill-down
- **H** delegated admin sees only Bangalore
- **I** resident sees only their own unit and services

## Known limits

- Single-browser mock persistence; there is no server.
- The AARYA assistant is a guided, deterministic demo that routes to the relevant screen. It is not an LLM.
- Visual design was matched from template screenshots; the live template site was not reachable from the build environment.
