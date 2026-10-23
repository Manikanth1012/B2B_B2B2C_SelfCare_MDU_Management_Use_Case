/*
 * Mock API adapter. Each function corresponds to an operation that would later be
 * served by a TM Forum Open API (noted per section). Calls are async with simulated
 * latency, and every read/write is filtered through resolveScope() for the
 * signed-in user. Nothing here touches a live network element: provisioning,
 * payments and approvals are simulated and labelled as such in the UI.
 */
import { getDb, getSessionUserId, mutate } from '../data/store';
import { TODAY } from '../data/seed';
import type {
  AccountRelationship,
  ApprovalRequest,
  ApprovalType,
  BillingAccount,
  BillingModel,
  BusinessAccount,
  BusinessAccountType,
  ConnectivityStatus,
  Contact,
  Database,
  Invoice,
  Occupancy,
  ProductOrder,
  Property,
  PropertyType,
  QualificationResult,
  RequestCategory,
  RequestStatus,
  Role,
  RoleId,
  Scope,
  ServiceInstance,
  ServiceQualification,
  ServiceRequest,
  Settings,
  Unit,
  UnitType,
  User,
  AccessTech,
  Readiness,
  Permission,
} from '../data/types';
import {
  activeChildren,
  activeParent,
  ancestors,
  AuthError,
  billingChildren,
  billingParent,
  canSeeService,
  descendants,
  hasPermission,
  resolveScope,
  ValidationError,
  type ResolvedScope,
} from './scope';

export { AuthError, ValidationError };

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 220));
const nowIso = () => `${TODAY}T${new Date().toISOString().slice(11, 19)}Z`;
const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function ctx() {
  const db = getDb();
  const user = db.users.find((u) => u.id === getSessionUserId()) ?? db.users[0];
  const scope = resolveScope(db, user);
  return { db, user, scope };
}

function requirePerm(db: Database, user: User, p: Permission) {
  if (!hasPermission(db, user, p)) throw new AuthError(`Your role does not permit this action (${p}).`);
}

function audit(db: Database, tenantId: string, actor: string, action: string, kind: string, id: string, detail: string) {
  db.audit.unshift({ id: `AUD-${++db.seq}`, tenantId, at: nowIso(), actor, action, entity: { kind, id }, detail });
}

/* ======================================================================
 * Session (demo role switcher — not scoped, it is the login simulation)
 * ==================================================================== */

export function currentUser(): User {
  return ctx().user;
}
export function currentScope(): ResolvedScope {
  return ctx().scope;
}
export function can(p: Permission): boolean {
  const { db, user } = ctx();
  return hasPermission(db, user, p);
}
export function demoUsers(): (User & { role: Role })[] {
  const db = getDb();
  return db.users.filter((u) => u.status === 'Active').map((u) => ({ ...u, role: db.roles.find((r) => r.id === u.roleId)! }));
}
export function roles(): Role[] {
  return getDb().roles;
}

/* ======================================================================
 * Business accounts — TMF629 Customer / TMF632 Party / TMF669 Party Role
 * ==================================================================== */

export interface AccountRow extends BusinessAccount {
  parentId?: string;
  parentName?: string;
  childCount: number;
  activeServices: number;
  billingArrangement: string;
  primaryContact?: Contact;
}

function accountRow(db: Database, scope: ResolvedScope, a: BusinessAccount): AccountRow {
  const parentId = activeParent(db, a.id);
  const services = db.services.filter((s) => s.businessAccountId === a.id && s.status === 'Active');
  const ownBilling = db.billingAccounts.filter((b) => b.payerRef.kind === 'business' && b.payerRef.id === a.id);
  const billedTo = new Set(db.services.filter((s) => s.businessAccountId === a.id).map((s) => s.billingAccountId));
  let arrangement = 'No billing account';
  if (ownBilling.length) arrangement = `${ownBilling[0].type} · ${ownBilling[0].id}`;
  else if (billedTo.size) arrangement = `Billed via ${[...billedTo].join(', ')}`;
  return {
    ...a,
    parentId,
    parentName: parentId && scope.accounts.has(parentId) ? db.accounts.find((x) => x.id === parentId)?.name : parentId ? 'Restricted' : undefined,
    childCount: activeChildren(db, a.id).filter((c) => scope.accounts.has(c)).length,
    activeServices: services.length,
    billingArrangement: arrangement,
    primaryContact: db.contacts.find((c) => c.id === a.primaryContactId),
  };
}

export async function listAccounts(): Promise<AccountRow[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.read');
  return db.accounts.filter((a) => scope.accounts.has(a.id)).map((a) => accountRow(db, scope, a));
}

export interface HierarchyNode {
  account: AccountRow;
  children: HierarchyNode[];
  billingLinks: BillingAccount[];
  descendantCount: number;
  aggregatedServices: number;
}

export async function getHierarchy(): Promise<HierarchyNode[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.read');
  const build = (id: string): HierarchyNode => {
    const a = db.accounts.find((x) => x.id === id)!;
    const children = activeChildren(db, id).filter((c) => scope.accounts.has(c)).map(build);
    const row = accountRow(db, scope, a);
    return {
      account: row,
      children,
      billingLinks: db.billingAccounts.filter((b) => b.payerRef.kind === 'business' && b.payerRef.id === id && scope.billing.has(b.id)),
      descendantCount: children.reduce((n, c) => n + 1 + c.descendantCount, 0),
      aggregatedServices: row.activeServices + children.reduce((n, c) => n + c.aggregatedServices, 0),
    };
  };
  const roots = db.accounts.filter((a) => scope.accounts.has(a.id) && !(activeParent(db, a.id) && scope.accounts.has(activeParent(db, a.id)!)));
  return roots.map((r) => build(r.id));
}

export interface AccountDetail {
  account: AccountRow;
  ancestors: { id: string; name: string; visible: boolean }[];
  children: AccountRow[];
  services: (ServiceInstance & { offeringName: string; category: string })[];
  billingAccounts: (BillingAccount & { responsibility: string; balance: number })[];
  contacts: Contact[];
  admins: User[];
  requests: ServiceRequest[];
  history: Database['audit'];
}

export async function getAccount(id: string): Promise<AccountDetail> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.read');
  if (!scope.accounts.has(id)) throw new AuthError('This account is outside your authorised scope.');
  const a = db.accounts.find((x) => x.id === id)!;
  const services = db.services.filter((s) => s.businessAccountId === id && canSeeService(scope, s)).map((s) => ({ ...s, offeringName: offeringName(db, s.offeringId), category: db.offerings.find((o) => o.id === s.offeringId)?.category ?? '' }));
  const baIds = new Set<string>();
  db.billingAccounts.forEach((b) => b.payerRef.kind === 'business' && b.payerRef.id === id && baIds.add(b.id));
  services.forEach((s) => baIds.add(s.billingAccountId));
  const billingAccounts = [...baIds]
    .map((bid) => db.billingAccounts.find((b) => b.id === bid)!)
    .filter((b) => b && scope.billing.has(b.id))
    .map((b) => ({ ...b, responsibility: b.payerRef.kind === 'business' && b.payerRef.id === id ? 'Pays own charges' : `Charges billed to ${payerName(db, b)}`, balance: balanceOf(db, b.id) }));
  return {
    account: accountRow(db, scope, a),
    ancestors: ancestors(db, id).reverse().map((aid) => ({ id: aid, name: scope.accounts.has(aid) ? db.accounts.find((x) => x.id === aid)!.name : 'Restricted', visible: scope.accounts.has(aid) })),
    children: activeChildren(db, id).filter((c) => scope.accounts.has(c)).map((c) => accountRow(db, scope, db.accounts.find((x) => x.id === c)!)),
    services,
    billingAccounts,
    contacts: db.contacts.filter((c) => c.accountId === id),
    admins: db.users.filter((u) => u.scopes.some((g) => g.kind === 'account' && (g.ref === id || (g.inherit && descendants(db, g.ref!).includes(id))))),
    requests: db.requests.filter((r) => r.businessAccountId === id),
    history: db.audit.filter((e) => e.entity.id === id || e.detail.includes(a.name)),
  };
}

/** Which child account types a given parent type may hold. */
export const CHILD_RULES: Record<BusinessAccountType, (BusinessAccountType | 'Billing')[]> = {
  Root: ['Subsidiary', 'Department', 'Branch', 'Service', 'Billing'],
  Subsidiary: ['Subsidiary', 'Department', 'Branch', 'Service', 'Billing'],
  Department: ['Department', 'Service', 'Billing'],
  Branch: ['Service', 'Billing'],
  Service: ['Billing'],
};

export interface CreateChildInput {
  parentId: string;
  type: BusinessAccountType | 'Billing';
  name: string;
  registrationNo?: string;
  industry?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  serviceAddress?: string;
  billingAddress?: string;
  billing: { mode: 'inherit' | 'new' | 'existing'; existingId?: string; parentBillingId?: string };
  admin: { mode: 'none' | 'existing' | 'invite'; userId?: string; name?: string; email?: string; inherit?: boolean };
}

export async function createChildAccount(input: CreateChildInput): Promise<{ accountId?: string; billingId?: string; pendingApproval: boolean }> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.create');
  const parent = db.accounts.find((a) => a.id === input.parentId);
  if (!parent || !scope.accounts.has(parent.id)) throw new AuthError('You are not authorised to add children under this account.');
  if (parent.status !== 'Active') throw new ValidationError(`Parent account is ${parent.status}; children can only be added under an Active account.`);
  if (!CHILD_RULES[parent.type].includes(input.type)) throw new ValidationError(`A ${parent.type} account cannot hold a ${input.type} account.`);
  if (!input.name.trim()) throw new ValidationError('Account name is required.');
  if (db.accounts.some((a) => a.tenantId === parent.tenantId && a.name.toLowerCase() === input.name.trim().toLowerCase())) throw new ValidationError('An account with this name already exists in your organisation.');
  if (input.registrationNo && db.accounts.some((a) => a.registrationNo === input.registrationNo)) throw new ValidationError('Registration number is already used by another account.');

  return mutate((d) => {
    if (input.type === 'Billing') {
      const id = `BA-${++d.seq}`;
      const parentBilling = input.billing.parentBillingId;
      d.billingAccounts.push({ id, tenantId: parent.tenantId, name: input.name.trim(), type: 'Standard', payerRef: { kind: 'business', id: parent.id }, currency: 'INR', billCycleDay: 1, paymentMethod: 'Bank Transfer', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 1000000 });
      if (parentBilling) d.billingRelationships.push({ id: `BREL-${id}`, parentBillingId: parentBilling, childBillingId: id, validFrom: TODAY });
      audit(d, parent.tenantId, user.name, 'Billing account created', 'billing', id, `Payer ${parent.name}`);
      return { billingId: id, pendingApproval: false };
    }
    const id = `ACC-${++d.seq}`;
    const pending = d.settings.approvalForChildAccount && user.roleId !== 'OPERATOR';
    const acc: BusinessAccount = {
      id,
      tenantId: parent.tenantId,
      name: input.name.trim(),
      type: input.type,
      status: pending ? 'Pending Approval' : 'Active',
      registrationNo: input.registrationNo || undefined,
      industry: input.industry || parent.industry,
      serviceAddress: input.serviceAddress,
      billingAddress: input.billingAddress || input.serviceAddress,
      accountOwner: parent.accountOwner,
      createdAt: TODAY,
    };
    d.accounts.push(acc);
    d.relationships.push({ id: `REL-${id}`, parentId: parent.id, childId: id, kind: 'ownership', validFrom: TODAY });
    const cid = `CON-${++d.seq}`;
    d.contacts.push({ id: cid, accountId: id, name: input.contactName, title: 'Primary Contact', email: input.contactEmail, phone: input.contactPhone, isPrimary: true });
    acc.primaryContactId = cid;
    let billingId: string | undefined;
    if (input.billing.mode === 'new') {
      billingId = `BA-${++d.seq}`;
      d.billingAccounts.push({ id: billingId, tenantId: parent.tenantId, name: `${acc.name} Billing`, type: 'Standard', payerRef: { kind: 'business', id }, currency: 'INR', billCycleDay: 1, paymentMethod: 'Bank Transfer', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 1000000 });
      if (input.billing.parentBillingId) d.billingRelationships.push({ id: `BREL-${billingId}`, parentBillingId: input.billing.parentBillingId, childBillingId: billingId, validFrom: TODAY });
    }
    if (input.admin.mode === 'existing' && input.admin.userId) {
      const u = d.users.find((x) => x.id === input.admin.userId);
      if (u) u.scopes.push({ kind: 'account', ref: id, inherit: input.admin.inherit ?? true });
    } else if (input.admin.mode === 'invite' && input.admin.email) {
      d.users.push({ id: `U-${++d.seq}`, tenantId: parent.tenantId, name: input.admin.name || input.admin.email, email: input.admin.email, phone: '', title: `Administrator – ${acc.name}`, roleId: 'BIZ_ADMIN', scopes: [{ kind: 'account', ref: id, inherit: input.admin.inherit ?? true }], status: 'Invited' });
    }
    if (pending) {
      d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId: parent.tenantId, type: 'Create Child Account', summary: `Create ${input.type.toLowerCase()} "${acc.name}" under ${parent.name}`, target: { kind: 'account', id }, payload: { accountId: id }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
    }
    audit(d, parent.tenantId, user.name, pending ? 'Account created (pending approval)' : 'Account created', 'account', id, `${input.type} under ${parent.name}`);
    return { accountId: id, billingId, pendingApproval: pending };
  });
}

/** Validate a proposed move without submitting it — used to grey out ineligible targets. */
export function moveProblem(accountId: string, newParentId: string): string | null {
  const { db, scope } = ctx();
  const a = db.accounts.find((x) => x.id === accountId);
  const p = db.accounts.find((x) => x.id === newParentId);
  if (!a || !p) return 'Unknown account.';
  if (!scope.accounts.has(accountId) || !scope.accounts.has(newParentId)) return 'Outside your authorised scope.';
  if (a.type === 'Root') return 'A root account cannot be moved.';
  if (accountId === newParentId) return 'An account cannot be its own parent.';
  if (descendants(db, accountId).includes(newParentId)) return 'Would create a circular relationship.';
  if (activeParent(db, accountId) === newParentId) return 'Already the current parent.';
  if (a.tenantId !== p.tenantId) return 'Cross-organisation moves are not permitted.';
  if (!CHILD_RULES[p.type].includes(a.type)) return `A ${p.type} cannot hold a ${a.type}.`;
  return null;
}

export async function requestMoveAccount(accountId: string, newParentId: string, reason: string) {
  await latency();
  const { db, user } = ctx();
  requirePerm(db, user, 'account.move');
  const problem = moveProblem(accountId, newParentId);
  if (problem) throw new ValidationError(problem);
  if (db.approvals.some((x) => x.status === 'Pending' && x.type === 'Move Child Account' && x.target.id === accountId)) throw new ValidationError('A move for this account is already awaiting approval.');
  const a = db.accounts.find((x) => x.id === accountId)!;
  const from = db.accounts.find((x) => x.id === activeParent(db, accountId))!;
  const to = db.accounts.find((x) => x.id === newParentId)!;
  return mutate((d) => {
    const id = `APR-${++d.seq}`;
    d.approvals.unshift({ id, tenantId: a.tenantId, type: 'Move Child Account', summary: `Move "${a.name}" from ${from.name} to ${to.name}`, target: { kind: 'account', id: accountId }, payload: { accountId, newParentId, reason }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
    audit(d, a.tenantId, user.name, 'Approval requested', 'account', accountId, `Move to ${to.name}`);
    return id;
  });
}

export async function updateAccount(id: string, patch: Partial<Pick<BusinessAccount, 'name' | 'industry' | 'serviceAddress' | 'billingAddress' | 'registrationNo' | 'sector'>>) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.edit');
  if (!scope.accounts.has(id)) throw new AuthError('This account is outside your authorised scope.');
  const a = db.accounts.find((x) => x.id === id)!;
  const sensitive = patch.registrationNo !== undefined && patch.registrationNo !== a.registrationNo;
  return mutate((d) => {
    const acc = d.accounts.find((x) => x.id === id)!;
    const { registrationNo, ...rest } = patch;
    Object.assign(acc, rest);
    if (sensitive) {
      d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId: acc.tenantId, type: 'Modify Sensitive Account Data', summary: `Change registration number of ${acc.name} to ${registrationNo}`, target: { kind: 'account', id }, payload: { accountId: id, registrationNo }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
    }
    audit(d, acc.tenantId, user.name, 'Account updated', 'account', id, Object.keys(rest).join(', ') + (sensitive ? ' · registration change sent for approval' : ''));
    return { pendingApproval: sensitive };
  });
}

export async function saveContact(c: Omit<Contact, 'id'> & { id?: string }) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.edit');
  if (!scope.accounts.has(c.accountId)) throw new AuthError('This account is outside your authorised scope.');
  if (!/^\S+@\S+\.\S+$/.test(c.email)) throw new ValidationError('Enter a valid email address.');
  return mutate((d) => {
    if (c.id) Object.assign(d.contacts.find((x) => x.id === c.id)!, c);
    else d.contacts.push({ ...c, id: `CON-${++d.seq}` });
    if (c.isPrimary) {
      const id = c.id ?? d.contacts[d.contacts.length - 1].id;
      d.contacts.filter((x) => x.accountId === c.accountId && x.id !== id).forEach((x) => (x.isPrimary = false));
      d.accounts.find((a) => a.id === c.accountId)!.primaryContactId = id;
    }
    audit(d, db.accounts.find((a) => a.id === c.accountId)!.tenantId, user.name, c.id ? 'Contact updated' : 'Contact added', 'account', c.accountId, c.name);
  });
}

export async function removeContact(id: string) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'account.edit');
  const c = db.contacts.find((x) => x.id === id);
  if (!c || !scope.accounts.has(c.accountId)) throw new AuthError('Contact not found in your scope.');
  if (c.isPrimary) throw new ValidationError('Assign another primary contact before removing this one.');
  mutate((d) => {
    d.contacts = d.contacts.filter((x) => x.id !== id);
    audit(d, db.accounts.find((a) => a.id === c.accountId)!.tenantId, user.name, 'Contact removed', 'account', c.accountId, c.name);
  });
}

export async function listContacts() {
  await latency();
  const { db, scope } = ctx();
  return db.contacts.filter((c) => scope.accounts.has(c.accountId)).map((c) => ({ ...c, accountName: db.accounts.find((a) => a.id === c.accountId)!.name }));
}

/* ======================================================================
 * Billing — TMF666 Account Management / TMF678 Customer Bill
 * ==================================================================== */

function payerName(db: Database, b: BillingAccount) {
  if (b.payerRef.kind === 'business') return db.accounts.find((a) => a.id === b.payerRef.id)?.name ?? b.payerRef.id;
  if (b.payerRef.kind === 'property') return db.properties.find((p) => p.id === b.payerRef.id)?.name ?? b.payerRef.id;
  return db.customers.find((c) => c.id === b.payerRef.id)?.name ?? 'Resident';
}

function balanceOf(db: Database, billingId: string) {
  return db.invoices.filter((i) => i.billingAccountId === billingId && i.status !== 'Paid').reduce((a, i) => a + i.amount, 0);
}

export function toReporting(amount: number, currency: string) {
  return currency === 'SGD' ? amount * getDb().settings.reportingFx.SGD : amount;
}

export interface BillingRow extends BillingAccount {
  payerName: string;
  parentId?: string;
  childIds: string[];
  balance: number;
  overdue: number;
  currentCharges: number;
  serviceCount: number;
}

function billingRow(db: Database, b: BillingAccount): BillingRow {
  const inv = db.invoices.filter((i) => i.billingAccountId === b.id);
  return {
    ...b,
    payerName: payerName(db, b),
    parentId: billingParent(db, b.id),
    childIds: billingChildren(db, b.id),
    balance: inv.filter((i) => i.status !== 'Paid').reduce((a, i) => a + i.amount, 0),
    overdue: inv.filter((i) => i.status === 'Overdue').reduce((a, i) => a + i.amount, 0),
    currentCharges: inv.filter((i) => i.period === '2026-10').reduce((a, i) => a + i.amount, 0),
    serviceCount: db.services.filter((s) => s.billingAccountId === b.id && s.status !== 'Terminated').length,
  };
}

export async function listBillingAccounts(opts: { includeResidents?: boolean } = {}): Promise<BillingRow[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'billing.read');
  return db.billingAccounts.filter((b) => scope.billing.has(b.id) && (opts.includeResidents || b.type !== 'Resident' || scope.customerId)).map((b) => billingRow(db, b));
}

export interface BillingNode {
  billing: BillingRow;
  children: BillingNode[];
  services: (ServiceInstance & { offeringName: string })[];
  rolledUpBalance: number;
  rolledUpCharges: number;
}

export async function getBillingHierarchy(): Promise<BillingNode[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'billing.read');
  const fx = (n: number, c: string) => toReporting(n, c);
  const build = (id: string): BillingNode => {
    const b = billingRow(db, db.billingAccounts.find((x) => x.id === id)!);
    const children = b.childIds.filter((c) => scope.billing.has(c)).map(build);
    return {
      billing: b,
      children,
      services: db.services.filter((s) => s.billingAccountId === id && canSeeService(scope, s)).map((s) => ({ ...s, offeringName: offeringName(db, s.offeringId) })),
      rolledUpBalance: fx(b.balance, b.currency) + children.reduce((a, c) => a + c.rolledUpBalance, 0),
      rolledUpCharges: fx(b.currentCharges, b.currency) + children.reduce((a, c) => a + c.rolledUpCharges, 0),
    };
  };
  const visible = db.billingAccounts.filter((b) => scope.billing.has(b.id) && (b.type !== 'Resident' || scope.customerId));
  return visible.filter((b) => !(billingParent(db, b.id) && scope.billing.has(billingParent(db, b.id)!))).map((b) => build(b.id));
}

export async function listInvoices(): Promise<(Invoice & { billingName: string; currency: string })[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'billing.read');
  return db.invoices
    .filter((i) => scope.billing.has(i.billingAccountId))
    .map((i) => {
      const b = db.billingAccounts.find((x) => x.id === i.billingAccountId)!;
      return { ...i, billingName: b.name, currency: b.currency };
    })
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

export async function payInvoice(invoiceId: string, method: BillingAccount['paymentMethod']) {
  await new Promise((r) => setTimeout(r, 900));
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'billing.pay');
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv || !scope.billing.has(inv.billingAccountId)) throw new AuthError('Invoice not in your scope.');
  if (inv.status === 'Paid') throw new ValidationError('Invoice is already paid.');
  return mutate((d) => {
    const i = d.invoices.find((x) => x.id === invoiceId)!;
    i.status = 'Paid';
    const ref = 'SIM' + Math.floor(Math.random() * 1e9);
    d.payments.unshift({ id: `PAY-${++d.seq}`, billingAccountId: i.billingAccountId, invoiceId, date: TODAY, amount: i.amount, method, reference: ref, simulated: true });
    audit(d, d.billingAccounts.find((b) => b.id === i.billingAccountId)!.tenantId, user.name, 'Payment recorded (simulated)', 'billing', i.billingAccountId, `${invoiceId} · ${ref}`);
    return ref;
  });
}

export async function listPayments() {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'billing.read');
  return db.payments.filter((p) => scope.billing.has(p.billingAccountId)).map((p) => ({ ...p, billingName: db.billingAccounts.find((b) => b.id === p.billingAccountId)!.name, currency: db.billingAccounts.find((b) => b.id === p.billingAccountId)!.currency })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function updateBillingPreferences(id: string, patch: Partial<Pick<BillingAccount, 'paymentMethod' | 'invoiceDelivery' | 'paperless' | 'billCycleDay'>>) {
  await latency();
  const { db, user, scope } = ctx();
  if (!(hasPermission(db, user, 'billing.manage') || (user.roleId === 'RESIDENT' && hasPermission(db, user, 'billing.pay')))) throw new AuthError('Your role cannot change billing preferences.');
  if (!scope.billing.has(id)) throw new AuthError('Billing account not in your scope.');
  if (patch.billCycleDay && (patch.billCycleDay < 1 || patch.billCycleDay > 28)) throw new ValidationError('Bill cycle day must be between 1 and 28.');
  mutate((d) => {
    const b = d.billingAccounts.find((x) => x.id === id)!;
    Object.assign(b, patch);
    audit(d, b.tenantId, user.name, 'Billing preferences updated', 'billing', id, Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '));
  });
}

export async function requestBillingReassignment(serviceIds: string[], targetBillingId: string, reason: string) {
  await latency();
  const { db, user, scope } = ctx();
  if (!hasPermission(db, user, 'billing.manage') && !hasPermission(db, user, 'account.edit')) throw new AuthError('Your role cannot change billing responsibility.');
  if (!serviceIds.length) throw new ValidationError('Select at least one service.');
  if (!scope.billing.has(targetBillingId)) throw new AuthError('Target billing account is outside your scope.');
  const services = serviceIds.map((id) => db.services.find((s) => s.id === id)!);
  if (services.some((s) => !s || !canSeeService(scope, s))) throw new AuthError('One or more services are outside your scope.');
  if (services.some((s) => s.billingAccountId === targetBillingId)) throw new ValidationError('Some services are already billed to that account.');
  const target = db.billingAccounts.find((b) => b.id === targetBillingId)!;
  return mutate((d) => {
    const needs = d.settings.approvalForBillingChange;
    if (needs) {
      d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId: target.tenantId, type: 'Change Billing Responsibility', summary: `Re-bill ${services.length} service(s) to ${target.name}`, target: { kind: 'billing', id: targetBillingId }, payload: { serviceIds, targetBillingId, reason }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
    } else {
      services.forEach((s) => (d.services.find((x) => x.id === s.id)!.billingAccountId = targetBillingId));
    }
    audit(d, target.tenantId, user.name, needs ? 'Billing reassignment requested' : 'Billing reassigned', 'billing', targetBillingId, serviceIds.join(', '));
    return { pendingApproval: needs };
  });
}

/* ======================================================================
 * Properties & units — own location domain, mapped to TMF673/674 Geographic
 * Address/Site where an operator's inventory supports it.
 * ==================================================================== */

export function connectivityOf(unit: Unit, services: ServiceInstance[]): ConnectivityStatus {
  const s = services.filter((x) => x.unitId === unit.id && x.status !== 'Terminated');
  if (s.some((x) => x.status === 'Active' || x.status === 'Pending Change')) return 'Connected';
  if (s.some((x) => x.status === 'Suspended')) return 'Suspended';
  if (s.some((x) => x.status === 'Pending Installation')) return 'Pending Installation';
  return unit.networkReadiness === 'Ready' ? 'Ready for Service' : 'Network Not Ready';
}

export interface PropertyRow extends Property {
  buildings: number;
  totalUnits: number;
  connected: number;
  occupied: number;
  vacant: number;
  pending: number;
  ready: number;
  notReady: number;
  suspended: number;
  openTickets: number;
  managerName: string;
}

function propertyRow(db: Database, p: Property): PropertyRow {
  const units = db.units.filter((u) => u.propertyId === p.id);
  const services = db.services.filter((s) => s.propertyId === p.id);
  const byUnit = new Map<string, ServiceInstance[]>();
  services.forEach((s) => s.unitId && byUnit.set(s.unitId, [...(byUnit.get(s.unitId) ?? []), s]));
  const statuses = units.map((u) => connectivityOf(u, byUnit.get(u.id) ?? []));
  return {
    ...p,
    buildings: db.buildings.filter((b) => b.propertyId === p.id).length,
    totalUnits: units.length,
    connected: statuses.filter((s) => s === 'Connected').length,
    pending: statuses.filter((s) => s === 'Pending Installation').length,
    ready: statuses.filter((s) => s === 'Ready for Service').length,
    notReady: statuses.filter((s) => s === 'Network Not Ready').length,
    suspended: statuses.filter((s) => s === 'Suspended').length,
    occupied: units.filter((u) => u.occupancy === 'Occupied').length,
    vacant: units.filter((u) => u.occupancy === 'Vacant').length,
    openTickets: db.requests.filter((r) => r.propertyId === p.id && !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)).length,
    managerName: db.users.find((u) => u.id === p.managerUserId)?.name ?? '—',
  };
}

export async function listProperties(): Promise<PropertyRow[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'property.read');
  return db.properties.filter((p) => scope.properties.has(p.id)).map((p) => propertyRow(db, p));
}

export interface UnitView extends Unit {
  connectivity: ConnectivityStatus;
  building: string;
  floor: number;
  occupant?: { name: string; email: string; phone: string; role: string; since: string; customerId: string };
  services: (ServiceInstance & { offeringName: string; billedTo: string })[];
  openTickets: number;
}

function unitView(db: Database, scope: ResolvedScope, u: Unit): UnitView {
  const occ = db.occupancies.find((o) => o.unitId === u.id && !o.validTo);
  const cust = occ ? db.customers.find((c) => c.id === occ.customerId) : undefined;
  const allSrv = db.services.filter((s) => s.unitId === u.id && s.status !== 'Terminated');
  return {
    ...u,
    connectivity: connectivityOf(u, allSrv),
    building: db.buildings.find((b) => b.id === u.buildingId)!.name,
    floor: db.floors.find((f) => f.id === u.floorId)!.number,
    occupant: cust && occ ? { name: cust.name, email: cust.email, phone: cust.phone, role: occ.role, since: occ.validFrom, customerId: cust.id } : undefined,
    services: allSrv.map((s) => {
      const b = db.billingAccounts.find((x) => x.id === s.billingAccountId)!;
      return { ...s, offeringName: offeringName(db, s.offeringId), billedTo: scope.billing.has(b.id) ? `${b.name} (${b.id})` : b.type === 'Resident' ? 'Resident (individual billing)' : 'Restricted' };
    }),
    openTickets: db.requests.filter((r) => r.unitId === u.id && !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)).length,
  };
}

export interface PropertyDetail {
  property: PropertyRow;
  buildings: { id: string; name: string; floors: { id: string; number: number; units: UnitView[] }[] }[];
  services: (ServiceInstance & { offeringName: string })[];
  requests: ServiceRequest[];
  appointments: Database['appointments'];
  billing: BillingRow[];
  history: Database['audit'];
}

export async function getProperty(id: string): Promise<PropertyDetail> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'property.read');
  if (!scope.properties.has(id)) throw new AuthError('This property is outside your authorised scope.');
  const p = db.properties.find((x) => x.id === id)!;
  return {
    property: propertyRow(db, p),
    buildings: db.buildings
      .filter((b) => b.propertyId === id)
      .map((b) => ({
        id: b.id,
        name: b.name,
        floors: db.floors
          .filter((f) => f.buildingId === b.id)
          .sort((a, c) => a.number - c.number)
          .map((f) => ({ id: f.id, number: f.number, units: db.units.filter((u) => u.floorId === f.id).map((u) => unitView(db, scope, u)) })),
      })),
    services: db.services.filter((s) => s.propertyId === id).map((s) => ({ ...s, offeringName: offeringName(db, s.offeringId) })),
    requests: db.requests.filter((r) => r.propertyId === id),
    appointments: db.appointments.filter((a) => a.propertyId === id),
    billing: db.billingAccounts.filter((b) => b.payerRef.kind === 'property' && b.payerRef.id === id && scope.billing.has(b.id)).map((b) => billingRow(db, b)),
    history: db.audit.filter((e) => e.entity.id === id || e.entity.id.startsWith(id + '-')),
  };
}

export async function getUnit(id: string): Promise<UnitView & { propertyName: string; property: Property }> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'property.read');
  if (!scope.units.has(id)) throw new AuthError('This unit is outside your authorised scope.');
  const u = db.units.find((x) => x.id === id)!;
  const p = db.properties.find((x) => x.id === u.propertyId)!;
  const v = unitView(db, scope, u);
  // A resident sees only their own subscriptions on the unit.
  if (scope.customerId) v.services = v.services.filter((s) => s.owner.id === scope.customerId);
  return { ...v, propertyName: p.name, property: p };
}

export async function listUnits(propertyId?: string): Promise<(UnitView & { propertyName: string })[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'property.read');
  return db.units
    .filter((u) => scope.properties.has(u.propertyId) && (!propertyId || u.propertyId === propertyId))
    .map((u) => ({ ...unitView(db, scope, u), propertyName: db.properties.find((p) => p.id === u.propertyId)!.name }));
}

export async function assignOccupant(unitId: string, o: { name: string; email: string; phone: string; role: 'Owner' | 'Tenant' | 'Authorised Contact'; from: string }) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'unit.manage');
  if (!scope.units.has(unitId) || !scope.properties.has(db.units.find((u) => u.id === unitId)!.propertyId)) throw new AuthError('Unit outside your scope.');
  if (!o.name.trim()) throw new ValidationError('Occupant name is required.');
  if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) throw new ValidationError('Enter a valid email address.');
  mutate((d) => {
    // End-date the current occupancy; billing relationships deliberately stay as they are (spec §7.3).
    d.occupancies.filter((x) => x.unitId === unitId && !x.validTo).forEach((x) => (x.validTo = addDays(o.from, -1)));
    const cid = `CUS-${++d.seq}`;
    d.customers.push({ id: cid, tenantId: 'TEN-RES', name: o.name.trim(), email: o.email, phone: o.phone, createdAt: TODAY });
    d.occupancies.push({ id: `OCC-${++d.seq}`, unitId, customerId: cid, role: o.role, validFrom: o.from });
    const u = d.units.find((x) => x.id === unitId)!;
    u.occupancy = 'Occupied';
    audit(d, d.properties.find((p) => p.id === u.propertyId)!.tenantId, user.name, 'Occupant assigned', 'unit', unitId, `${o.name} (${o.role}) from ${o.from}`);
  });
}

export async function setOccupancy(unitId: string, occupancy: Occupancy) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'unit.manage');
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit || !scope.properties.has(unit.propertyId)) throw new AuthError('Unit outside your scope.');
  mutate((d) => {
    const u = d.units.find((x) => x.id === unitId)!;
    u.occupancy = occupancy;
    if (occupancy !== 'Occupied') d.occupancies.filter((x) => x.unitId === unitId && !x.validTo).forEach((x) => (x.validTo = TODAY));
    audit(d, d.properties.find((p) => p.id === u.propertyId)!.tenantId, user.name, 'Occupancy updated', 'unit', unitId, occupancy + ' (active services and billing unchanged)');
  });
}

export interface RegisterPropertyInput {
  name: string;
  type: PropertyType;
  managementOrg: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  contactPhone: string;
  contactEmail: string;
  towers: { name: string; floors: number; unitsPerFloor: number }[];
  technology: AccessTech;
  readiness: Readiness;
  capacityPorts: number;
  equipment: string;
  plannedActivation: string;
  billingModel: BillingModel;
}

export async function registerProperty(input: RegisterPropertyInput): Promise<string> {
  await new Promise((r) => setTimeout(r, 700));
  const { db, user } = ctx();
  requirePerm(db, user, 'property.create');
  if (db.properties.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase() && p.city.toLowerCase() === input.city.trim().toLowerCase())) throw new ValidationError('A property with this name is already registered in this city.');
  if (!input.towers.length) throw new ValidationError('Add at least one building or tower.');
  const names = input.towers.map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new ValidationError('Tower names must be unique.');
  if (input.towers.some((t) => t.floors < 1 || t.floors > 80 || t.unitsPerFloor < 1 || t.unitsPerFloor > 40)) throw new ValidationError('Floors must be 1–80 and units per floor 1–40.');
  const tenantId = user.roleId === 'OPERATOR' ? 'TEN-EVG' : user.tenantId;
  return mutate((d) => {
    const id = `PRP-${++d.seq}`;
    let masterBillingId: string | undefined;
    if (input.billingModel !== 'Individual') {
      masterBillingId = `BA-${++d.seq}`;
      d.billingAccounts.push({ id: masterBillingId, tenantId, name: `${input.name.trim()} ${input.billingModel === 'Bulk Contract' ? 'Bulk Contract' : 'Master Billing'}`, type: 'Property Master', payerRef: { kind: 'property', id }, currency: 'INR', billCycleDay: 1, paymentMethod: 'Bank Transfer', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 500000 });
    }
    d.properties.push({ id, tenantId, name: input.name.trim(), type: input.type, managementOrg: input.managementOrg, managerUserId: user.roleId === 'MDU_PM' ? user.id : 'U-200', address: input.address, city: input.city, geo: input.lat && input.lng ? { lat: input.lat, lng: input.lng } : undefined, contactPhone: input.contactPhone, contactEmail: input.contactEmail, technology: input.technology, readiness: input.readiness, capacityPorts: input.capacityPorts, equipment: input.equipment, plannedActivation: input.plannedActivation, billingModel: input.billingModel, masterBillingId, status: 'Onboarding', createdAt: TODAY });
    input.towers.forEach((t, ti) => {
      const prefix = /^tower\s+/i.test(t.name) ? t.name.replace(/^tower\s+/i, '').trim() : t.name.trim();
      const code = (prefix.split(/\s+/)[0] || String.fromCharCode(65 + ti)).slice(0, 4).toUpperCase();
      const bid = `${id}-T${code}`;
      d.buildings.push({ id: bid, propertyId: id, name: t.name.trim(), floors: t.floors });
      for (let f = 1; f <= t.floors; f++) {
        const fid = `${bid}-F${f}`;
        d.floors.push({ id: fid, buildingId: bid, number: f });
        for (let n = 1; n <= t.unitsPerFloor; n++) {
          const number = `${code}-${f}${String(n).padStart(2, '0')}`;
          d.units.push({ id: `${id}-${number}`, propertyId: id, buildingId: bid, floorId: fid, number, unitType: '2BHK', occupancy: 'Unknown', networkReadiness: input.readiness === 'Ready' ? 'Ready' : 'Not Ready' });
        }
      }
    });
    // The registering manager is granted the new property; operators already see everything.
    const me = d.users.find((u) => u.id === user.id)!;
    if (me.roleId === 'MDU_PM') me.scopes.push({ kind: 'property', ref: id, inherit: true });
    const units = input.towers.reduce((a, t) => a + t.floors * t.unitsPerFloor, 0);
    audit(d, tenantId, user.name, 'Property registered', 'property', id, `${input.towers.length} building(s), ${units} units, ${input.billingModel} billing`);
    return id;
  });
}

export interface ImportRow {
  line: number;
  propertyId: string;
  tower: string;
  floor: string;
  unitNumber: string;
  unitType: string;
  occupancyStatus: string;
  occupantName?: string;
  contact?: string;
  connectivityReadiness?: string;
  existingServiceRef?: string;
}

export interface ImportValidation {
  row: ImportRow;
  errors: string[];
  warnings: string[];
}

const UNIT_TYPES: UnitType[] = ['1BHK', '2BHK', '3BHK', '4BHK', 'Studio', 'Retail', 'Amenity'];

export function validateImport(rows: ImportRow[]): ImportValidation[] {
  const { db, scope } = ctx();
  const seen = new Set<string>();
  return rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!row.propertyId) errors.push('Property ID is required');
    else if (!db.properties.some((p) => p.id === row.propertyId)) errors.push(`Unknown property ${row.propertyId}`);
    else if (!scope.properties.has(row.propertyId)) errors.push('Property outside your authorised scope');
    if (!row.tower) errors.push('Tower is required');
    const fl = Number(row.floor);
    if (!row.floor || !Number.isInteger(fl) || fl < 0 || fl > 80) errors.push('Floor must be a whole number 0–80');
    if (!row.unitNumber) errors.push('Unit number is required');
    if (!UNIT_TYPES.includes(row.unitType as UnitType)) errors.push(`Unit type must be one of ${UNIT_TYPES.join(', ')}`);
    if (!['Occupied', 'Vacant', 'Unknown'].includes(row.occupancyStatus)) errors.push('Occupancy status must be Occupied, Vacant or Unknown');
    if (row.connectivityReadiness && !['Ready', 'Not Ready'].includes(row.connectivityReadiness)) errors.push('Connectivity readiness must be Ready or Not Ready');
    if (row.occupancyStatus === 'Occupied' && !row.occupantName) warnings.push('Occupied unit has no occupant name');
    if (row.contact && !/^(\S+@\S+\.\S+|\+?[\d\s-]{8,})$/.test(row.contact)) errors.push('Contact must be an email or phone number');
    const key = `${row.propertyId}|${row.unitNumber}`.toLowerCase();
    if (row.unitNumber && seen.has(key)) errors.push('Duplicate unit in this file');
    seen.add(key);
    if (row.propertyId && db.units.some((u) => u.propertyId === row.propertyId && u.number.toLowerCase() === row.unitNumber.toLowerCase())) errors.push('Unit already exists in this property');
    return { row, errors, warnings };
  });
}

export async function commitImport(rows: ImportRow[]): Promise<{ created: number; skipped: number }> {
  await new Promise((r) => setTimeout(r, 900));
  const { db, user } = ctx();
  requirePerm(db, user, 'unit.manage');
  const results = validateImport(rows);
  const ok = results.filter((r) => !r.errors.length).map((r) => r.row);
  mutate((d) => {
    for (const r of ok) {
      let b = d.buildings.find((x) => x.propertyId === r.propertyId && (x.name.toLowerCase() === r.tower.toLowerCase() || x.name.toLowerCase() === `tower ${r.tower}`.toLowerCase()));
      if (!b) {
        b = { id: `${r.propertyId}-T${r.tower.replace(/\W/g, '').toUpperCase()}`, propertyId: r.propertyId, name: /tower/i.test(r.tower) ? r.tower : `Tower ${r.tower}`, floors: Number(r.floor) };
        d.buildings.push(b);
      }
      let f = d.floors.find((x) => x.buildingId === b!.id && x.number === Number(r.floor));
      if (!f) {
        f = { id: `${b.id}-F${r.floor}`, buildingId: b.id, number: Number(r.floor) };
        d.floors.push(f);
        b.floors = Math.max(b.floors, Number(r.floor));
      }
      const uid = `${r.propertyId}-${r.unitNumber}`;
      d.units.push({ id: uid, propertyId: r.propertyId, buildingId: b.id, floorId: f.id, number: r.unitNumber, unitType: r.unitType as UnitType, occupancy: r.occupancyStatus as Occupancy, networkReadiness: (r.connectivityReadiness as 'Ready' | 'Not Ready') || 'Not Ready', existingServiceRef: r.existingServiceRef || undefined });
      if (r.occupantName) {
        const cid = `CUS-${++d.seq}`;
        const email = r.contact?.includes('@') ? r.contact : '';
        d.customers.push({ id: cid, tenantId: 'TEN-RES', name: r.occupantName, email, phone: email ? '' : r.contact ?? '', createdAt: TODAY });
        d.occupancies.push({ id: `OCC-${++d.seq}`, unitId: uid, customerId: cid, role: 'Authorised Contact', validFrom: TODAY });
      }
    }
    const props = [...new Set(ok.map((r) => r.propertyId))];
    props.forEach((pid) => audit(d, d.properties.find((p) => p.id === pid)!.tenantId, user.name, 'Bulk unit import', 'property', pid, `${ok.filter((r) => r.propertyId === pid).length} units created; ${results.length - ok.length} rows rejected`));
  });
  return { created: ok.length, skipped: results.length - ok.length };
}

/* ======================================================================
 * Catalogue, qualification & ordering — TMF620 / TMF679 / TMF645 / TMF622 / TMF641
 * ==================================================================== */

function offeringName(db: Database, id: string) {
  return db.offerings.find((o) => o.id === id)?.name ?? id;
}

export function offerings() {
  return getDb().offerings;
}

export async function listServices(): Promise<(ServiceInstance & { offeringName: string; category: string; customerName: string; unitNumber?: string; billingName: string; currency: string })[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'service.read');
  return db.services
    .filter((s) => canSeeService(scope, s))
    .map((s) => {
      const o = db.offerings.find((x) => x.id === s.offeringId)!;
      const b = db.billingAccounts.find((x) => x.id === s.billingAccountId)!;
      const customerName = s.owner.kind === 'business' ? db.accounts.find((a) => a.id === s.owner.id)?.name ?? '' : db.customers.find((c) => c.id === s.owner.id)?.name ?? 'Resident';
      return { ...s, offeringName: o.name, category: o.category, customerName, unitNumber: s.unitId ? db.units.find((u) => u.id === s.unitId)?.number : undefined, billingName: scope.billing.has(b.id) ? b.name : b.type === 'Resident' ? 'Resident (individual)' : 'Restricted', currency: b.currency };
    });
}

export async function getService(id: string) {
  const all = await listServices();
  const s = all.find((x) => x.id === id);
  if (!s) throw new AuthError('Service not found in your scope.');
  const { db } = ctx();
  return { ...s, offering: db.offerings.find((o) => o.id === s.offeringId)!, requests: db.requests.filter((r) => r.serviceId === id) };
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export async function checkAvailability(target: { kind: 'unit'; unitId: string } | { kind: 'address'; address: string; accountId?: string }): Promise<ServiceQualification> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'service.read');
  let result: QualificationResult;
  let reason: string;
  let eligible: string[];
  if (target.kind === 'unit') {
    if (!scope.units.has(target.unitId)) throw new AuthError('Unit outside your scope.');
    const u = db.units.find((x) => x.id === target.unitId)!;
    const p = db.properties.find((x) => x.id === u.propertyId)!;
    const active = db.services.some((s) => s.unitId === u.id && ['Active', 'Pending Installation', 'Pending Change'].includes(s.status) && s.offeringId.startsWith('OFF-R'));
    if (active) {
      result = 'Service Not Available';
      reason = 'Unit already has an active or pending broadband subscription. Use Change Plan instead.';
      eligible = [];
    } else if (u.networkReadiness === 'Not Ready') {
      result = 'Additional Network Work Required';
      reason = `${p.technology} riser/drop not yet built to ${u.number}. Field survey and civil work required (est. 15–25 days).`;
      eligible = [];
    } else {
      const usedPorts = db.services.filter((s) => s.propertyId === p.id && s.unitId && s.status !== 'Terminated').length;
      if (usedPorts >= p.capacityPorts) {
        result = 'Additional Network Work Required';
        reason = `All ${p.capacityPorts} access ports at ${p.name} are in use. Capacity expansion required.`;
        eligible = [];
      } else {
        result = 'Service Available';
        reason = `${p.technology} ready at ${u.number}; ${p.capacityPorts - usedPorts} access ports free.`;
        eligible = db.offerings.filter((o) => o.segment === 'Residential' && (!o.techRequired || o.techRequired.includes(p.technology))).map((o) => o.id);
      }
    }
  } else {
    if (target.accountId && !scope.accounts.has(target.accountId)) throw new AuthError('Account outside your scope.');
    if (target.address.trim().length < 8) throw new ValidationError('Enter a complete service address.');
    const h = hash(target.address.toLowerCase()) % 10;
    if (h < 7) {
      result = 'Service Available';
      reason = 'On-net building: fibre available within 50 m.';
      eligible = db.offerings.filter((o) => o.segment === 'Business' && !o.id.startsWith('OFF-P')).map((o) => o.id);
    } else if (h < 9) {
      result = 'Additional Network Work Required';
      reason = 'Near-net: 300–800 m fibre extension and building permission required.';
      eligible = [];
    } else {
      result = 'Service Not Available';
      reason = 'Off-net location: no fibre within serviceable distance.';
      eligible = [];
    }
  }
  return mutate((d) => {
    const q: ServiceQualification = { id: `SQ-${++d.seq}`, target: target.kind === 'unit' ? { kind: 'unit', ref: target.unitId } : { kind: 'address', ref: target.address }, result, reason, eligibleOfferingIds: eligible, checkedAt: nowIso() };
    d.qualifications.unshift(q);
    return q;
  });
}

export interface NewConnectionInput {
  qualificationId: string;
  unitId?: string;
  businessAccountId?: string;
  address: string;
  offeringId: string;
  addOns: string[];
  billing: { mode: 'existing'; billingId: string } | { mode: 'new-resident' };
  appointment: { date: string; window: string };
  acceptedTerms: boolean;
}

export async function submitNewConnection(input: NewConnectionInput) {
  await new Promise((r) => setTimeout(r, 900));
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'service.order');
  const q = db.qualifications.find((x) => x.id === input.qualificationId);
  // Activation is never permitted without a passing qualification (spec §6.2).
  if (!q || q.result !== 'Service Available') throw new ValidationError('Service qualification has not passed for this location.');
  if (!q.eligibleOfferingIds.includes(input.offeringId)) throw new ValidationError('Selected plan is not eligible at this location.');
  if (!input.acceptedTerms) throw new ValidationError('Accept the charges and terms to submit.');
  if (input.appointment.date <= TODAY) throw new ValidationError('Choose an installation date after today.');
  let unit: Unit | undefined;
  let ownerKind: 'business' | 'customer' = 'business';
  let ownerId = input.businessAccountId ?? '';
  let tenantId = user.tenantId;
  let propertyId: string | undefined;
  if (input.unitId) {
    if (!scope.units.has(input.unitId)) throw new AuthError('Unit outside your scope.');
    unit = db.units.find((u) => u.id === input.unitId)!;
    propertyId = unit.propertyId;
    tenantId = db.properties.find((p) => p.id === propertyId)!.tenantId;
    const occ = db.occupancies.find((o) => o.unitId === unit!.id && !o.validTo);
    if (input.billing.mode === 'new-resident') {
      if (!occ) throw new ValidationError('Resident billing needs an occupant on the unit. Assign an occupant or bill the property.');
      ownerKind = 'customer';
      ownerId = occ.customerId;
    } else {
      ownerKind = occ && user.roleId === 'RESIDENT' ? 'customer' : 'business';
      ownerId = ownerKind === 'customer' ? occ!.customerId : db.properties.find((p) => p.id === propertyId)!.tenantId === 'TEN-PMH' ? 'ACC-3000' : 'ACC-2000';
    }
  } else if (!input.businessAccountId || !scope.accounts.has(input.businessAccountId)) throw new AuthError('Select an authorised business account.');
  else tenantId = db.accounts.find((a) => a.id === input.businessAccountId)!.tenantId;
  if (input.billing.mode === 'existing' && !scope.billing.has(input.billing.billingId)) throw new AuthError('Billing account outside your scope.');

  const offering = db.offerings.find((o) => o.id === input.offeringId)!;
  return mutate((d) => {
    let billingId: string;
    if (input.billing.mode === 'new-resident') {
      billingId = `BA-${++d.seq}`;
      const cust = d.customers.find((c) => c.id === ownerId)!;
      d.billingAccounts.push({ id: billingId, tenantId: 'TEN-RES', name: `${cust.name} – Home`, type: 'Resident', payerRef: { kind: 'customer', id: cust.id }, currency: 'INR', billCycleDay: 5, paymentMethod: 'UPI', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 10000 });
    } else billingId = input.billing.billingId;
    const srvId = `SRV-${++d.seq}`;
    const addOnMrc = (offering.addOns ?? []).filter((a) => input.addOns.includes(a.id)).reduce((a, x) => a + x.mrc, 0);
    d.services.push({ id: srvId, offeringId: offering.id, tenantId, owner: { kind: ownerKind, id: ownerId }, businessAccountId: input.businessAccountId, unitId: unit?.id, propertyId, location: input.address, billingAccountId: billingId, status: 'Pending Installation', mrc: offering.mrc + addOnMrc, addOns: input.addOns, equipment: [] });
    const reqId = `SR-${++d.seq}`;
    const orderId = `PO-${++d.seq}`;
    d.requests.unshift({ id: reqId, tenantId, kind: 'Service Request', category: 'New Connection', title: `${offering.name} – ${input.address}`, description: `New connection order ${orderId}. Qualification ${q.id}: ${q.reason}`, businessAccountId: input.businessAccountId, propertyId, unitId: unit?.id, serviceId: srvId, billingAccountId: billingId, priority: 'Medium', status: 'Submitted', assignedTeam: unit ? 'FTTH Field Engineering' : 'Enterprise Provisioning', createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, unit ? 7 : 21), timeline: [{ at: nowIso(), status: 'Submitted', by: user.name, note: `Order ${orderId} submitted via self-care (simulated)` }], attachments: [], orderId });
    d.orders.unshift({ id: orderId, kind: 'New Connection', requestId: reqId, items: [{ unitId: unit?.id, businessAccountId: input.businessAccountId, serviceId: srvId, offeringId: offering.id, status: 'Queued' }], billingAccountId: billingId, appointment: `${input.appointment.date} ${input.appointment.window}`, createdAt: nowIso() });
    d.appointments.unshift({ id: `APT-${++d.seq}`, requestId: reqId, unitId: unit?.id, propertyId, slot: input.appointment.date, window: input.appointment.window, technician: 'To be assigned', status: 'Scheduled' });
    audit(d, tenantId, user.name, 'Order submitted', unit ? 'unit' : 'account', unit?.id ?? input.businessAccountId!, `${offering.name} · ${orderId}`);
    return { requestId: reqId, orderId, serviceId: srvId };
  });
}

export async function requestServiceChange(serviceId: string, change: { kind: 'Plan Change'; offeringId: string } | { kind: 'Suspension'; from: string; until?: string; reason: string } | { kind: 'Resumption' } | { kind: 'Add-on'; addOnId: string }) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'service.order');
  const s = db.services.find((x) => x.id === serviceId);
  if (!s || !canSeeService(scope, s)) throw new AuthError('Service outside your scope.');
  if (s.pendingChange) throw new ValidationError(`A change is already pending on this service: ${s.pendingChange}.`);
  if (change.kind === 'Plan Change') {
    if (s.status !== 'Active') throw new ValidationError('Only active services can change plan.');
    const cur = db.offerings.find((o) => o.id === s.offeringId)!;
    const next = db.offerings.find((o) => o.id === change.offeringId);
    if (!next || next.id === cur.id) throw new ValidationError('Choose a different plan.');
    if (next.category !== cur.category || next.segment !== cur.segment) throw new ValidationError('Plan changes must stay within the same product family.');
    if (s.propertyId) {
      const p = db.properties.find((x) => x.id === s.propertyId)!;
      if (next.techRequired && !next.techRequired.includes(p.technology)) throw new ValidationError(`${next.name} is not supported on ${p.technology} at this property.`);
    }
  }
  if (change.kind === 'Suspension' && s.status !== 'Active') throw new ValidationError('Only active services can be suspended.');
  if (change.kind === 'Resumption' && s.status !== 'Suspended') throw new ValidationError('Only suspended services can be resumed.');
  if (change.kind === 'Add-on') {
    if (s.status !== 'Active') throw new ValidationError('Add-ons can only be added to active services.');
    const addOn = db.offerings.find((o) => o.id === s.offeringId)?.addOns?.find((a) => a.id === change.addOnId);
    if (!addOn) throw new ValidationError('This add-on is not available on the current plan.');
    if (s.addOns.includes(change.addOnId)) throw new ValidationError('Add-on is already active.');
  }
  return mutate((d) => {
    const srv = d.services.find((x) => x.id === serviceId)!;
    const label =
      change.kind === 'Plan Change'
        ? `Plan change to ${offeringName(d, change.offeringId)}`
        : change.kind === 'Suspension'
          ? `Suspension from ${change.from}${change.until ? ` until ${change.until}` : ''}`
          : change.kind === 'Add-on'
            ? `Add-on ${d.offerings.find((o) => o.id === srv.offeringId)?.addOns?.find((a) => a.id === change.addOnId)?.name ?? change.addOnId}`
            : 'Resumption';
    srv.pendingChange = label;
    if (srv.status === 'Active' && change.kind === 'Plan Change') srv.status = 'Pending Change';
    const reqId = `SR-${++d.seq}`;
    const orderId = `PO-${++d.seq}`;
    d.requests.unshift({ id: reqId, tenantId: srv.tenantId, kind: 'Service Request', category: change.kind === 'Plan Change' || change.kind === 'Add-on' ? 'Plan Change' : 'Service Suspension', title: `${label} – ${srv.location}`, description: change.kind === 'Suspension' ? change.reason : label, businessAccountId: srv.businessAccountId, propertyId: srv.propertyId, unitId: srv.unitId, serviceId, priority: 'Low', status: 'Submitted', assignedTeam: srv.unitId ? 'Residential Provisioning' : 'Enterprise Provisioning', createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, 3), timeline: [{ at: nowIso(), status: 'Submitted', by: user.name, note: `Order ${orderId} (simulated – no network change until fulfilled)` }], attachments: [], orderId });
    d.orders.unshift({ id: orderId, kind: change.kind, requestId: reqId, items: [{ serviceId, offeringId: change.kind === 'Plan Change' ? change.offeringId : change.kind === 'Add-on' ? change.addOnId : undefined, status: 'Queued' }], createdAt: nowIso() });
    audit(d, srv.tenantId, user.name, `${change.kind} requested`, 'service', serviceId, label);
    return reqId;
  });
}

export interface BulkInput {
  propertyId: string;
  unitIds: string[];
  plan: { mode: 'common'; offeringId: string } | { mode: 'per-unit'; map: Record<string, string> };
  billing: 'property' | 'resident';
  appointmentFrom: string;
}

export interface BulkPreview {
  eligible: { unitId: string; number: string; offeringId: string }[];
  ineligible: { unitId: string; number: string; reason: string }[];
  mrcTotal: number;
  nrcTotal: number;
}

export async function previewBulk(input: BulkInput): Promise<BulkPreview> {
  await new Promise((r) => setTimeout(r, 1000));
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'service.bulk');
  if (!scope.properties.has(input.propertyId)) throw new AuthError('Property outside your scope.');
  const p = db.properties.find((x) => x.id === input.propertyId)!;
  const usedPorts = db.services.filter((s) => s.propertyId === p.id && s.unitId && s.status !== 'Terminated').length;
  let free = p.capacityPorts - usedPorts;
  const out: BulkPreview = { eligible: [], ineligible: [], mrcTotal: 0, nrcTotal: 0 };
  for (const id of input.unitIds) {
    const u = db.units.find((x) => x.id === id);
    if (!u || u.propertyId !== p.id) continue;
    const offId = input.plan.mode === 'common' ? input.plan.offeringId : input.plan.map[id];
    const o = db.offerings.find((x) => x.id === offId);
    const occ = db.occupancies.find((x) => x.unitId === id && !x.validTo);
    const hasSrv = db.services.some((s) => s.unitId === id && s.status !== 'Terminated' && s.offeringId.startsWith('OFF-R'));
    let reason = '';
    if (hasSrv) reason = 'Already has a broadband subscription';
    else if (u.networkReadiness !== 'Ready') reason = 'Network not ready – riser/drop pending';
    else if (!o) reason = 'No plan selected';
    else if (o.techRequired && !o.techRequired.includes(p.technology)) reason = `${o.name} not supported on ${p.technology}`;
    else if (input.billing === 'resident' && !occ) reason = 'Resident billing selected but unit has no occupant';
    else if (free <= 0) reason = 'No free access port – capacity expansion needed';
    if (reason) out.ineligible.push({ unitId: id, number: u.number, reason });
    else {
      free--;
      out.eligible.push({ unitId: id, number: u.number, offeringId: o!.id });
      out.mrcTotal += o!.mrc;
      out.nrcTotal += o!.nrc;
    }
  }
  return out;
}

export async function submitBulk(input: BulkInput) {
  const preview = await previewBulk(input);
  if (!preview.eligible.length) throw new ValidationError('No eligible units to activate.');
  const { db, user } = ctx();
  const p = db.properties.find((x) => x.id === input.propertyId)!;
  if (input.billing === 'property' && !p.masterBillingId) throw new ValidationError('This property has no property billing account; choose resident billing.');
  return mutate((d) => {
    const needsApproval = d.settings.approvalForBulkActivation && user.roleId !== 'OPERATOR';
    const reqId = `SR-${++d.seq}`;
    const orderId = `PO-${++d.seq}`;
    const items: ProductOrder['items'] = [];
    for (const e of preview.eligible) {
      const srvId = `SRV-${++d.seq}`;
      const occ = d.occupancies.find((x) => x.unitId === e.unitId && !x.validTo);
      let billingId = p.masterBillingId!;
      let owner: ServiceInstance['owner'] = { kind: 'business', id: p.tenantId === 'TEN-PMH' ? 'ACC-3000' : 'ACC-2000' };
      if (input.billing === 'resident' && occ) {
        const cust = d.customers.find((c) => c.id === occ.customerId)!;
        billingId = d.billingAccounts.find((b) => b.payerRef.kind === 'customer' && b.payerRef.id === cust.id)?.id ?? `BA-${++d.seq}`;
        if (!d.billingAccounts.some((b) => b.id === billingId)) d.billingAccounts.push({ id: billingId, tenantId: 'TEN-RES', name: `${cust.name} – Home`, type: 'Resident', payerRef: { kind: 'customer', id: cust.id }, currency: 'INR', billCycleDay: 5, paymentMethod: 'UPI', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 10000 });
        owner = { kind: 'customer', id: cust.id };
      }
      const o = d.offerings.find((x) => x.id === e.offeringId)!;
      d.services.push({ id: srvId, offeringId: o.id, tenantId: p.tenantId, owner, unitId: e.unitId, propertyId: p.id, location: `${p.name}, ${e.number}`, billingAccountId: billingId, status: 'Pending Installation', mrc: o.mrc, addOns: [], equipment: [] });
      items.push({ unitId: e.unitId, serviceId: srvId, offeringId: o.id, status: needsApproval ? 'Awaiting Approval' : 'Queued' });
    }
    preview.ineligible.forEach((x) => items.push({ unitId: x.unitId, status: 'Failed', note: x.reason }));
    d.orders.unshift({ id: orderId, kind: 'Bulk Activation', requestId: reqId, items, billingAccountId: input.billing === 'property' ? p.masterBillingId : undefined, appointment: `From ${input.appointmentFrom}`, createdAt: nowIso() });
    d.requests.unshift({ id: reqId, tenantId: p.tenantId, kind: 'Service Request', category: 'Bulk Activation', title: `Bulk activation – ${preview.eligible.length} units at ${p.name}`, description: `${preview.eligible.length} eligible, ${preview.ineligible.length} rejected at validation. Billing: ${input.billing === 'property' ? 'property account' : 'individual residents'}.`, propertyId: p.id, priority: 'Medium', status: needsApproval ? 'Validating' : 'Approved', assignedTeam: 'FTTH Field Engineering', createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, 14), timeline: [{ at: nowIso(), status: 'Submitted', by: user.name, note: `Bulk order ${orderId}` }, { at: nowIso(), status: needsApproval ? 'Validating' : 'Approved', by: 'System', note: needsApproval ? 'Awaiting operator approval for bulk activation' : 'Auto-approved' }], attachments: [], orderId });
    if (needsApproval) d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId: p.tenantId, type: 'Bulk Service Activation', summary: `Activate ${preview.eligible.length} units at ${p.name} (MRC ₹${preview.mrcTotal.toLocaleString('en-IN')})`, target: { kind: 'order', id: orderId }, payload: { orderId, requestId: reqId }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' });
    audit(d, p.tenantId, user.name, 'Bulk activation submitted', 'property', p.id, `${orderId}: ${preview.eligible.length} eligible / ${preview.ineligible.length} rejected`);
    return { requestId: reqId, orderId, pendingApproval: needsApproval };
  });
}

export async function getOrder(id: string) {
  await latency();
  const { db, scope } = ctx();
  const o = db.orders.find((x) => x.id === id);
  if (!o) throw new ValidationError('Order not found.');
  const req = db.requests.find((r) => r.id === o.requestId);
  if (req && !requestVisible(db, scope, req, ctx().user)) throw new AuthError('Order outside your scope.');
  return { ...o, items: o.items.map((i) => ({ ...i, unitNumber: i.unitId ? db.units.find((u) => u.id === i.unitId)?.number : undefined, offeringName: i.offeringId ? offeringName(db, i.offeringId) : undefined })) };
}

export async function listOrders() {
  await latency();
  const { db, user, scope } = ctx();
  return db.orders
    .filter((o) => {
      const r = db.requests.find((x) => x.id === o.requestId);
      return r && requestVisible(db, scope, r, user);
    })
    .map((o) => {
      const r = db.requests.find((x) => x.id === o.requestId)!;
      return { ...o, status: r.status, title: r.title, context: requestContext(db, r), items: o.items.map((i) => ({ ...i, unitNumber: i.unitId ? db.units.find((u) => u.id === i.unitId)?.number : undefined, offeringName: i.offeringId ? offeringName(db, i.offeringId) : undefined })) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Simulated fulfilment: advances an order's queued items. Roughly one in seven
 * installs fails (e.g. no access to unit) so partial success is demonstrable.
 */
export async function simulateFulfilment(orderId: string) {
  await new Promise((r) => setTimeout(r, 1200));
  const { db, user, scope } = ctx();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new ValidationError('Order not found.');
  const orderReq = db.requests.find((r) => r.id === order.requestId);
  if (!orderReq || !requestVisible(db, scope, orderReq, user)) throw new AuthError('Order outside your scope.');
  if (order.items.some((i) => i.status === 'Awaiting Approval')) throw new ValidationError('Order is awaiting approval.');
  return mutate((d) => {
    const o = d.orders.find((x) => x.id === orderId)!;
    const req = d.requests.find((r) => r.id === o.requestId)!;
    for (const item of o.items) {
      if (item.status === 'Queued') item.status = 'In Progress';
      else if (item.status === 'In Progress') {
        const fail = o.kind === 'Bulk Activation' && hash(item.unitId ?? '') % 7 === 3;
        item.status = fail ? 'Failed' : 'Completed';
        const srv = item.serviceId ? d.services.find((s) => s.id === item.serviceId) : undefined;
        if (fail) {
          item.note = 'Installation failed – no access to unit on appointment date';
          if (srv) srv.status = 'Terminated';
        } else if (srv) applyCompletion(d, o, srv, item.offeringId);
      }
    }
    const open = o.items.some((i) => ['Queued', 'In Progress'].includes(i.status));
    const failed = o.items.filter((i) => i.status === 'Failed').length;
    const done = o.items.filter((i) => i.status === 'Completed').length;
    const next: RequestStatus = open ? 'In Progress' : done === 0 ? 'Failed' : 'Completed';
    if (req.status !== next) {
      req.status = next;
      req.timeline.push({ at: nowIso(), status: next, by: 'Fulfilment (simulated)', note: open ? 'Provisioning in progress' : `${done} completed, ${failed} failed` });
    }
    audit(d, req.tenantId, user.name, 'Fulfilment simulated', 'order', orderId, `${done} completed, ${failed} failed`);
  });
}

function applyCompletion(d: Database, o: ProductOrder, srv: ServiceInstance, offeringId?: string) {
  srv.pendingChange = undefined;
  if (o.kind === 'New Connection' || o.kind === 'Bulk Activation') {
    srv.status = 'Active';
    srv.activationDate = TODAY;
    const off = d.offerings.find((x) => x.id === srv.offeringId)!;
    const end = new Date(TODAY);
    end.setMonth(end.getMonth() + off.contractMonths);
    srv.contractEnd = end.toISOString().slice(0, 10);
    srv.equipment = [{ type: srv.unitId ? 'GPON ONT + Wi-Fi 6' : 'CPE Router', serial: 'SIM' + Math.floor(Math.random() * 1e8) }];
  } else if (o.kind === 'Plan Change' && offeringId) {
    srv.offeringId = offeringId;
    srv.mrc = d.offerings.find((x) => x.id === offeringId)!.mrc;
    srv.status = 'Active';
  } else if (o.kind === 'Add-on' && offeringId) {
    const a = d.offerings.find((x) => x.id === srv.offeringId)?.addOns?.find((x) => x.id === offeringId);
    if (a && !srv.addOns.includes(a.id)) {
      srv.addOns.push(a.id);
      srv.mrc += a.mrc;
    }
  } else if (o.kind === 'Suspension') srv.status = 'Suspended';
  else if (o.kind === 'Resumption') srv.status = 'Active';
}

/* ======================================================================
 * Requests & tickets — TMF621 Trouble Ticket / service requests
 * ==================================================================== */

function requestVisible(db: Database, scope: ResolvedScope, r: ServiceRequest, user: User) {
  if (scope.all) return true;
  if (scope.customerId) return r.createdBy === user.id || (!!r.unitId && scope.units.has(r.unitId) && (!r.serviceId || db.services.find((s) => s.id === r.serviceId)?.owner.id === scope.customerId));
  if (r.businessAccountId && scope.accounts.has(r.businessAccountId)) return true;
  if (r.propertyId && scope.properties.has(r.propertyId)) return true;
  if (r.billingAccountId && scope.billing.has(r.billingAccountId)) return true;
  return r.createdBy === user.id;
}

export async function listRequests(): Promise<(ServiceRequest & { context: string })[]> {
  await latency();
  const { db, user, scope } = ctx();
  return db.requests
    .filter((r) => requestVisible(db, scope, r, user))
    .map((r) => ({ ...r, context: requestContext(db, r) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function requestContext(db: Database, r: ServiceRequest) {
  if (r.unitId) {
    const u = db.units.find((x) => x.id === r.unitId);
    return `${db.properties.find((p) => p.id === r.propertyId)?.name ?? ''} · ${u?.number ?? ''}`;
  }
  if (r.propertyId) return db.properties.find((p) => p.id === r.propertyId)?.name ?? r.propertyId;
  if (r.businessAccountId) return db.accounts.find((a) => a.id === r.businessAccountId)?.name ?? r.businessAccountId;
  if (r.billingAccountId) return db.billingAccounts.find((b) => b.id === r.billingAccountId)?.name ?? r.billingAccountId;
  return '—';
}

export async function getRequest(id: string) {
  await latency();
  const { db, user, scope } = ctx();
  const r = db.requests.find((x) => x.id === id);
  if (!r || !requestVisible(db, scope, r, user)) throw new AuthError('Request not found in your scope.');
  return { ...r, context: requestContext(db, r), createdByName: db.users.find((u) => u.id === r.createdBy)?.name ?? r.createdBy, appointment: db.appointments.find((a) => a.requestId === id), order: r.orderId ? db.orders.find((o) => o.id === r.orderId) : undefined };
}

export interface NewRequestInput {
  kind: 'Service Request' | 'Incident';
  category: RequestCategory;
  title: string;
  description: string;
  priority: ServiceRequest['priority'];
  businessAccountId?: string;
  propertyId?: string;
  unitId?: string;
  serviceId?: string;
  billingAccountId?: string;
  attachments: string[];
}

const TEAM: Record<RequestCategory, string> = {
  'New Connection': 'Provisioning',
  'Plan Change': 'Provisioning',
  'Service Suspension': 'Provisioning',
  'Billing Query': 'Billing Operations',
  'Network Issue': 'Network Operations Centre',
  'Property Connectivity Issue': 'FTTH Field Engineering',
  'Account Modification': 'Customer Data Management',
  'Bulk Activation': 'FTTH Field Engineering',
};
const SLA_HOURS: Record<ServiceRequest['priority'], number> = { Critical: 1, High: 2, Medium: 5, Low: 10 };

export async function createRequest(input: NewRequestInput) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'request.create');
  if (input.title.trim().length < 5) throw new ValidationError('Give the request a short descriptive title (5+ characters).');
  if (input.businessAccountId && !scope.accounts.has(input.businessAccountId)) throw new AuthError('Account outside your scope.');
  if (input.propertyId && !scope.properties.has(input.propertyId) && !(input.unitId && scope.units.has(input.unitId))) throw new AuthError('Property outside your scope.');
  if (input.unitId && !scope.units.has(input.unitId)) throw new AuthError('Unit outside your scope.');
  if (input.billingAccountId && !scope.billing.has(input.billingAccountId)) throw new AuthError('Billing account outside your scope.');
  if (!input.businessAccountId && !input.propertyId && !input.unitId && !input.billingAccountId) throw new ValidationError('Link the request to an account, property, unit or billing account.');
  return mutate((d) => {
    const id = `SR-${++d.seq}`;
    const tenantId = input.propertyId ? d.properties.find((p) => p.id === input.propertyId)!.tenantId : input.businessAccountId ? d.accounts.find((a) => a.id === input.businessAccountId)!.tenantId : user.tenantId;
    d.requests.unshift({ ...input, id, tenantId, status: 'Submitted', assignedTeam: TEAM[input.category], createdBy: user.id, createdAt: TODAY, slaDue: addDays(TODAY, SLA_HOURS[input.priority]), timeline: [{ at: nowIso(), status: 'Submitted', by: user.name }] });
    audit(d, tenantId, user.name, 'Request created', 'request', id, input.title);
    return id;
  });
}

export async function commentRequest(id: string, text: string, attachment?: string) {
  await latency();
  const { db, user, scope } = ctx();
  const r = db.requests.find((x) => x.id === id);
  if (!r || !requestVisible(db, scope, r, user)) throw new AuthError('Request not in scope.');
  if (!text.trim() && !attachment) throw new ValidationError('Write a comment or attach a file.');
  mutate((d) => {
    const req = d.requests.find((x) => x.id === id)!;
    req.timeline.push({ at: nowIso(), status: 'Comment', by: user.name, note: text.trim() + (attachment ? ` [attached ${attachment}]` : '') });
    if (attachment) req.attachments.push(attachment);
  });
}

export async function cancelRequest(id: string) {
  await latency();
  const { db, user, scope } = ctx();
  const r = db.requests.find((x) => x.id === id);
  if (!r || !requestVisible(db, scope, r, user)) throw new AuthError('Request not in scope.');
  if (!['Submitted', 'Validating'].includes(r.status)) throw new ValidationError('Only requests not yet approved can be cancelled.');
  mutate((d) => {
    const req = d.requests.find((x) => x.id === id)!;
    req.status = 'Cancelled';
    req.timeline.push({ at: nowIso(), status: 'Cancelled', by: user.name });
    if (req.serviceId) {
      const s = d.services.find((x) => x.id === req.serviceId);
      if (s?.status === 'Pending Installation' && req.category === 'New Connection') s.status = 'Terminated';
      if (s?.pendingChange) {
        s.pendingChange = undefined;
        if (s.status === 'Pending Change') s.status = 'Active';
      }
    }
    if (req.orderId) d.orders.find((o) => o.id === req.orderId)?.items.forEach((i) => ['Queued', 'Awaiting Approval'].includes(i.status) && ((i.status = 'Failed'), (i.note = 'Cancelled by customer')));
    d.appointments.filter((a) => a.requestId === id && a.status === 'Scheduled').forEach((a) => (a.status = 'Cancelled'));
    audit(d, req.tenantId, user.name, 'Request cancelled', 'request', id, req.title);
  });
}

/** Operator-side progression of a single request, clearly labelled as simulated in the UI. */
export async function advanceRequest(id: string, to: RequestStatus, note?: string) {
  await latency();
  const { db, user } = ctx();
  if (user.roleId !== 'OPERATOR') throw new AuthError('Only the operator can progress fulfilment.');
  const r = db.requests.find((x) => x.id === id);
  if (!r) throw new ValidationError('Request not found.');
  mutate((d) => {
    const req = d.requests.find((x) => x.id === id)!;
    req.status = to;
    req.timeline.push({ at: nowIso(), status: to, by: `${user.name} (operator, simulated)`, note });
    if (req.orderId && (to === 'Completed' || to === 'Failed')) {
      const o = d.orders.find((x) => x.id === req.orderId)!;
      o.items.forEach((i) => {
        if (['Queued', 'In Progress'].includes(i.status)) {
          i.status = to === 'Completed' ? 'Completed' : 'Failed';
          const srv = i.serviceId ? d.services.find((s) => s.id === i.serviceId) : undefined;
          if (srv && to === 'Completed') applyCompletion(d, o, srv, i.offeringId);
          if (srv && to === 'Failed') {
            srv.pendingChange = undefined;
            if (srv.status === 'Pending Installation') srv.status = 'Terminated';
            if (srv.status === 'Pending Change') srv.status = 'Active';
          }
        }
      });
      d.appointments.filter((a) => a.requestId === id && a.status === 'Scheduled').forEach((a) => (a.status = to === 'Completed' ? 'Completed' : 'Cancelled'));
    }
    audit(d, req.tenantId, user.name, `Request ${to.toLowerCase()} (simulated)`, 'request', id, req.title);
  });
}

export async function listAppointments() {
  const reqs = await listRequests();
  const { db } = ctx();
  const ids = new Set(reqs.map((r) => r.id));
  return db.appointments
    .filter((a) => ids.has(a.requestId))
    .map((a) => ({ ...a, request: reqs.find((r) => r.id === a.requestId)!, unitNumber: a.unitId ? db.units.find((u) => u.id === a.unitId)?.number : undefined, propertyName: a.propertyId ? db.properties.find((p) => p.id === a.propertyId)?.name : undefined }))
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

export async function rescheduleAppointment(id: string, slot: string, window: string) {
  await latency();
  const { db, user, scope } = ctx();
  const a = db.appointments.find((x) => x.id === id);
  const r = a && db.requests.find((x) => x.id === a.requestId);
  if (!a || !r || !requestVisible(db, scope, r, user)) throw new AuthError('Appointment not in scope.');
  if (slot <= TODAY) throw new ValidationError('Choose a future date.');
  if (new Date(slot + 'T00:00:00Z').getUTCDay() === 0) throw new ValidationError('Installations are not scheduled on Sundays.');
  mutate((d) => {
    const ap = d.appointments.find((x) => x.id === id)!;
    ap.slot = slot;
    ap.window = window;
    ap.status = 'Rescheduled';
    d.requests.find((x) => x.id === ap.requestId)!.timeline.push({ at: nowIso(), status: 'Comment', by: user.name, note: `Appointment rescheduled to ${slot} ${window}` });
  });
}

/* ======================================================================
 * Users, roles, approvals — TMF669 Party Role / TMF672 User Roles & Permissions
 * ==================================================================== */

function scopeWithin(db: Database, me: ResolvedScope, g: Scope) {
  if (me.all) return true;
  if (g.kind === 'all') return false;
  if (g.kind === 'account') return me.accounts.has(g.ref!);
  if (g.kind === 'billing') return me.billing.has(g.ref!);
  if (g.kind === 'property') return me.properties.has(g.ref!);
  if (g.kind === 'unit') return me.units.has(g.ref!) && me.properties.has(db.units.find((u) => u.id === g.ref)?.propertyId ?? '');
  return false;
}

export function describeScope(g: Scope): string {
  const db = getDb();
  if (g.kind === 'all') return 'All tenants';
  const name =
    g.kind === 'account' ? db.accounts.find((a) => a.id === g.ref)?.name : g.kind === 'billing' ? db.billingAccounts.find((b) => b.id === g.ref)?.name : g.kind === 'property' ? db.properties.find((p) => p.id === g.ref)?.name : db.units.find((u) => u.id === g.ref)?.number;
  return `${name ?? g.ref}${g.inherit && g.kind !== 'unit' ? ' + descendants' : ''}`;
}

export async function listUsers(): Promise<(User & { roleName: string; scopeLabels: string[] })[]> {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'user.manage');
  return db.users
    .filter((u) => scope.all || (u.tenantId === user.tenantId && u.scopes.every((g) => scopeWithin(db, scope, g))) || u.id === user.id)
    .map((u) => ({ ...u, roleName: db.roles.find((r) => r.id === u.roleId)!.name, scopeLabels: u.scopes.map(describeScope) }));
}

/** Roles a user may grant: never more than their own permissions (no privilege escalation). */
export function grantableRoles(): Role[] {
  const { db, user } = ctx();
  const mine = new Set(db.roles.find((r) => r.id === user.roleId)!.permissions);
  return db.roles.filter((r) => r.id !== 'OPERATOR' && r.id !== 'RESIDENT' && r.permissions.every((p) => mine.has(p)));
}

export function grantableScopes(): Scope[] {
  const { db, scope } = ctx();
  const out: Scope[] = [];
  db.accounts.filter((a) => scope.accounts.has(a.id)).forEach((a) => out.push({ kind: 'account', ref: a.id, inherit: true }));
  db.billingAccounts.filter((b) => scope.billing.has(b.id) && b.type !== 'Resident').forEach((b) => out.push({ kind: 'billing', ref: b.id, inherit: true }));
  db.properties.filter((p) => scope.properties.has(p.id)).forEach((p) => out.push({ kind: 'property', ref: p.id, inherit: true }));
  return out;
}

export async function inviteUser(input: { name: string; email: string; phone: string; title: string; roleId: RoleId; scopes: Scope[] }) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'user.manage');
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new ValidationError('Enter a valid email address.');
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ValidationError('A user with this email already exists.');
  if (!grantableRoles().some((r) => r.id === input.roleId)) throw new AuthError('You cannot grant a role with more permissions than your own.');
  if (!input.scopes.length) throw new ValidationError('Assign at least one account, billing or property scope.');
  if (input.scopes.some((g) => !scopeWithin(db, scope, g))) throw new AuthError('You can only delegate scopes you hold yourself.');
  const propertyGrant = input.scopes.some((g) => g.kind === 'property');
  return mutate((d) => {
    const id = `U-${++d.seq}`;
    const tenantId = user.roleId === 'OPERATOR' ? (input.scopes[0].kind === 'property' ? d.properties.find((p) => p.id === input.scopes[0].ref)!.tenantId : d.accounts.find((a) => a.id === input.scopes[0].ref)?.tenantId ?? user.tenantId) : user.tenantId;
    // Property administrator grants are sensitive and go through approval.
    const pending = propertyGrant && user.roleId !== 'OPERATOR';
    d.users.push({ id, tenantId, name: input.name, email: input.email, phone: input.phone, title: input.title, roleId: input.roleId, scopes: pending ? input.scopes.filter((g) => g.kind !== 'property') : input.scopes, status: 'Invited' });
    if (pending)
      input.scopes
        .filter((g) => g.kind === 'property')
        .forEach((g) => d.approvals.unshift({ id: `APR-${++d.seq}`, tenantId, type: 'Reassign Property Administrator', summary: `Grant ${input.name} administration of ${describeScope(g)}`, target: { kind: 'property', id: g.ref! }, payload: { userId: id, scope: g }, requestedBy: user.id, requestedAt: nowIso(), status: 'Pending' }));
    audit(d, tenantId, user.name, 'User invited', 'user', id, `${input.email} as ${d.roles.find((r) => r.id === input.roleId)!.name}${pending ? ' (property scope pending approval)' : ''}`);
    return { id, pendingApproval: pending };
  });
}

export async function updateUserAccess(id: string, roleId: RoleId, scopes: Scope[]) {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'user.manage');
  const target = db.users.find((u) => u.id === id);
  if (!target) throw new ValidationError('User not found.');
  if (target.id === user.id) throw new ValidationError('You cannot change your own access.');
  if (!target.scopes.every((g) => scopeWithin(db, scope, g))) throw new AuthError('This user holds scopes outside yours.');
  if (!grantableRoles().some((r) => r.id === roleId)) throw new AuthError('You cannot grant a role with more permissions than your own.');
  if (!scopes.length) throw new ValidationError('Keep at least one scope, or revoke the user instead.');
  if (scopes.some((g) => !scopeWithin(db, scope, g))) throw new AuthError('You can only delegate scopes you hold yourself.');
  mutate((d) => {
    const u = d.users.find((x) => x.id === id)!;
    u.roleId = roleId;
    u.scopes = scopes;
    audit(d, u.tenantId, user.name, 'Access updated', 'user', id, `${d.roles.find((r) => r.id === roleId)!.name}; ${scopes.map(describeScope).join(', ')}`);
  });
}

export async function setUserStatus(id: string, status: 'Active' | 'Revoked') {
  await latency();
  const { db, user, scope } = ctx();
  requirePerm(db, user, 'user.manage');
  const target = db.users.find((u) => u.id === id);
  if (!target) throw new ValidationError('User not found.');
  if (target.id === user.id) throw new ValidationError('You cannot revoke your own access.');
  if (!target.scopes.every((g) => scopeWithin(db, scope, g))) throw new AuthError('This user holds scopes outside yours.');
  mutate((d) => {
    d.users.find((x) => x.id === id)!.status = status;
    audit(d, target.tenantId, user.name, status === 'Revoked' ? 'Access revoked' : 'Access restored', 'user', id, target.email);
  });
}

function approvalVisible(db: Database, scope: ResolvedScope, a: ApprovalRequest) {
  if (scope.all) return true;
  if (a.target.kind === 'account') return scope.accounts.has(a.target.id);
  if (a.target.kind === 'billing') return scope.billing.has(a.target.id);
  if (a.target.kind === 'property') return scope.properties.has(a.target.id);
  const o = db.orders.find((x) => x.id === a.target.id);
  const r = o && db.requests.find((x) => x.id === o.requestId);
  return !!r?.propertyId && scope.properties.has(r.propertyId);
}

/** Who may decide each approval type. MDU-sensitive operations are operator-controlled. */
const DECIDERS: Record<ApprovalType, RoleId[]> = {
  'Move Child Account': ['ENT_SUPER', 'OPERATOR'],
  'Create Child Account': ['ENT_SUPER', 'OPERATOR'],
  'Change Billing Responsibility': ['ENT_SUPER', 'OPERATOR'],
  'Modify Sensitive Account Data': ['ENT_SUPER', 'OPERATOR'],
  'Bulk Service Activation': ['OPERATOR'],
  'Reassign Property Administrator': ['OPERATOR'],
  'Register Property': ['OPERATOR'],
};

export async function listApprovals() {
  await latency();
  const { db, user, scope } = ctx();
  return db.approvals
    .filter((a) => approvalVisible(db, scope, a) || a.requestedBy === user.id)
    .map((a) => ({
      ...a,
      requestedByName: db.users.find((u) => u.id === a.requestedBy)?.name ?? a.requestedBy,
      decidedByName: a.decidedBy ? db.users.find((u) => u.id === a.decidedBy)?.name : undefined,
      canDecide: a.status === 'Pending' && hasPermission(db, user, 'approval.decide') && DECIDERS[a.type].includes(user.roleId) && a.requestedBy !== user.id && approvalVisible(db, scope, a),
      deciderRoles: DECIDERS[a.type].map((r) => db.roles.find((x) => x.id === r)!.name),
    }));
}

export async function decideApproval(id: string, approve: boolean, note: string) {
  await latency();
  const { db, user, scope } = ctx();
  const a = db.approvals.find((x) => x.id === id);
  if (!a || a.status !== 'Pending') throw new ValidationError('Approval is not pending.');
  requirePerm(db, user, 'approval.decide');
  if (!DECIDERS[a.type].includes(user.roleId)) throw new AuthError(`${a.type} must be decided by ${DECIDERS[a.type].join(' or ')}.`);
  if (a.requestedBy === user.id) throw new AuthError('Separation of duties: you cannot approve your own request.');
  if (!approvalVisible(db, scope, a)) throw new AuthError('Approval target outside your scope.');
  if (!approve && !note.trim()) throw new ValidationError('A reason is required when rejecting.');
  // Re-validate moves at decision time: the hierarchy may have changed since the request.
  if (approve && a.type === 'Move Child Account') {
    const problem = moveProblem(a.payload.accountId as string, a.payload.newParentId as string);
    if (problem) throw new ValidationError(`Move is no longer valid: ${problem}`);
  }
  mutate((d) => {
    const ap = d.approvals.find((x) => x.id === id)!;
    ap.status = approve ? 'Approved' : 'Rejected';
    ap.decidedBy = user.id;
    ap.decidedAt = nowIso();
    ap.decisionNote = note;
    const p = ap.payload as Record<string, unknown>;
    switch (ap.type) {
      case 'Move Child Account':
        if (approve) {
          const rel = d.relationships.find((r) => r.childId === p.accountId && !r.validTo)!;
          rel.validTo = TODAY;
          const nr: AccountRelationship = { id: `REL-${++d.seq}`, parentId: p.newParentId as string, childId: p.accountId as string, kind: 'ownership', validFrom: TODAY };
          d.relationships.push(nr);
        }
        break;
      case 'Create Child Account': {
        const acc = d.accounts.find((x) => x.id === p.accountId);
        if (acc) acc.status = approve ? 'Active' : 'Closed';
        break;
      }
      case 'Change Billing Responsibility':
        if (approve && Array.isArray(p.serviceIds)) (p.serviceIds as string[]).forEach((sid) => (d.services.find((s) => s.id === sid)!.billingAccountId = p.targetBillingId as string));
        break;
      case 'Modify Sensitive Account Data':
        if (approve) d.accounts.find((x) => x.id === p.accountId)!.registrationNo = p.registrationNo as string;
        break;
      case 'Bulk Service Activation': {
        const o = d.orders.find((x) => x.id === p.orderId)!;
        const req = d.requests.find((x) => x.id === p.requestId)!;
        o.items.forEach((i) => {
          if (i.status !== 'Awaiting Approval') return;
          i.status = approve ? 'Queued' : 'Failed';
          if (!approve) {
            i.note = 'Rejected at approval';
            const s = d.services.find((x) => x.id === i.serviceId);
            if (s) s.status = 'Terminated';
          }
        });
        req.status = approve ? 'Approved' : 'Rejected';
        req.timeline.push({ at: nowIso(), status: req.status, by: user.name, note });
        break;
      }
      case 'Reassign Property Administrator': {
        const u = d.users.find((x) => x.id === p.userId);
        if (approve && u && p.scope) u.scopes.push(p.scope as Scope);
        break;
      }
    }
    audit(d, ap.tenantId, user.name, approve ? 'Approval granted' : 'Approval rejected', ap.target.kind, ap.target.id, ap.summary + (note ? ` — ${note}` : ''));
  });
}

/* ======================================================================
 * Settings, audit, profile
 * ==================================================================== */

export async function listAudit() {
  await latency();
  const { db, user, scope } = ctx();
  return db.audit.filter((e) => {
    if (scope.all) return true;
    if (!hasPermission(db, user, 'audit.read') && e.actor !== user.name) return false;
    if (e.entity.kind === 'account') return scope.accounts.has(e.entity.id);
    if (e.entity.kind === 'billing') return scope.billing.has(e.entity.id);
    if (e.entity.kind === 'property') return scope.properties.has(e.entity.id);
    if (e.entity.kind === 'unit') return scope.units.has(e.entity.id);
    return e.tenantId === user.tenantId;
  });
}

export function getSettings(): Settings {
  return getDb().settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  await latency();
  const { db, user } = ctx();
  const approvalKeys: (keyof Settings)[] = ['approvalForChildAccount', 'approvalForBulkActivation', 'approvalForBillingChange'];
  if (Object.keys(patch).some((k) => approvalKeys.includes(k as keyof Settings)) && !['ENT_SUPER', 'OPERATOR'].includes(user.roleId)) throw new AuthError('Only super administrators or the operator can change approval policy.');
  void db;
  mutate((d) => {
    Object.assign(d.settings, patch);
    audit(d, user.tenantId, user.name, 'Settings updated', 'settings', 'settings', Object.keys(patch).join(', '));
  });
}

export async function updateMyContact(patch: { email?: string; phone?: string; name?: string }) {
  await latency();
  const { user } = ctx();
  if (patch.email !== undefined && !/^\S+@\S+\.\S+$/.test(patch.email)) throw new ValidationError('Enter a valid email address.');
  if (patch.phone !== undefined && !/^\+?[\d\s-]{8,}$/.test(patch.phone)) throw new ValidationError('Enter a valid phone number.');
  if (patch.name !== undefined && patch.name.trim().length < 2) throw new ValidationError('Enter your name.');
  mutate((d) => {
    const u = d.users.find((x) => x.id === user.id)!;
    Object.assign(u, patch);
    if (u.customerId) Object.assign(d.customers.find((c) => c.id === u.customerId)!, patch);
    audit(d, u.tenantId, u.name, 'Profile updated', 'user', u.id, Object.keys(patch).join(', '));
  });
}

export async function getProfile() {
  await latency();
  const { db, user, scope } = ctx();
  const root = db.accounts.find((a) => a.tenantId === user.tenantId && a.type === 'Root' && scope.accounts.has(a.id));
  return { user, role: db.roles.find((r) => r.id === user.roleId)!, organisation: root, contacts: root ? db.contacts.filter((c) => c.accountId === root.id) : [], tenant: db.tenants.find((t) => t.id === user.tenantId)! };
}
