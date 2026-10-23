/*
 * Authorisation is resolved here, in the data-access layer, so every list and
 * mutation is filtered by what the signed-in user may see — hiding a button is
 * never the only control (spec §3).
 */
import type { Database, Permission, ServiceInstance, User } from '../data/types';

export interface ResolvedScope {
  all: boolean;
  accounts: Set<string>;
  billing: Set<string>;
  properties: Set<string>;
  units: Set<string>;
  /** Resident customer id when the user is a unit subscriber. */
  customerId?: string;
}

export function activeChildren(db: Database, parentId: string): string[] {
  return db.relationships.filter((r) => r.parentId === parentId && !r.validTo).map((r) => r.childId);
}

export function activeParent(db: Database, childId: string): string | undefined {
  return db.relationships.find((r) => r.childId === childId && !r.validTo)?.parentId;
}

export function descendants(db: Database, id: string): string[] {
  const out: string[] = [];
  const stack = [...activeChildren(db, id)];
  while (stack.length) {
    const c = stack.pop()!;
    if (out.includes(c)) continue; // defensive: a cycle must never hang the UI
    out.push(c);
    stack.push(...activeChildren(db, c));
  }
  return out;
}

export function ancestors(db: Database, id: string): string[] {
  const out: string[] = [];
  let p = activeParent(db, id);
  while (p && !out.includes(p)) {
    out.push(p);
    p = activeParent(db, p);
  }
  return out;
}

export function billingChildren(db: Database, id: string): string[] {
  return db.billingRelationships.filter((r) => r.parentBillingId === id && !r.validTo).map((r) => r.childBillingId);
}

export function billingParent(db: Database, id: string): string | undefined {
  return db.billingRelationships.find((r) => r.childBillingId === id && !r.validTo)?.parentBillingId;
}

function billingDescendants(db: Database, id: string): string[] {
  const out: string[] = [];
  const stack = [...billingChildren(db, id)];
  while (stack.length) {
    const c = stack.pop()!;
    if (out.includes(c)) continue;
    out.push(c);
    stack.push(...billingChildren(db, c));
  }
  return out;
}

export function resolveScope(db: Database, user: User): ResolvedScope {
  const s: ResolvedScope = { all: false, accounts: new Set(), billing: new Set(), properties: new Set(), units: new Set(), customerId: user.customerId };
  if (user.status === 'Revoked') return s;

  for (const g of user.scopes) {
    if (g.kind === 'all') s.all = true;
    if (g.kind === 'account' && g.ref) {
      s.accounts.add(g.ref);
      if (g.inherit) descendants(db, g.ref).forEach((a) => s.accounts.add(a));
    }
    if (g.kind === 'billing' && g.ref) {
      s.billing.add(g.ref);
      if (g.inherit) billingDescendants(db, g.ref).forEach((b) => s.billing.add(b));
    }
    if (g.kind === 'property' && g.ref) s.properties.add(g.ref);
    if (g.kind === 'unit' && g.ref) s.units.add(g.ref);
  }

  if (s.all) {
    db.accounts.forEach((a) => s.accounts.add(a.id));
    db.billingAccounts.forEach((b) => s.billing.add(b.id));
    db.properties.forEach((p) => s.properties.add(p.id));
    db.units.forEach((u) => s.units.add(u.id));
    return s;
  }

  // Business admins see the billing accounts their visible accounts pay for.
  if (user.roleId === 'ENT_SUPER' || user.roleId === 'BIZ_ADMIN') {
    db.billingAccounts.forEach((b) => {
      if (b.payerRef.kind === 'business' && s.accounts.has(b.payerRef.id)) s.billing.add(b.id);
    });
  }
  // Billing admins can read the business accounts that pay into their subtree.
  if (user.roleId === 'BILLING_ADMIN') {
    db.billingAccounts.forEach((b) => {
      if (s.billing.has(b.id) && b.payerRef.kind === 'business') s.accounts.add(b.payerRef.id);
    });
  }
  // Property managers see every unit and the property-level billing of their properties —
  // but not residents' personal billing accounts.
  s.properties.forEach((pid) => {
    db.units.forEach((u) => u.propertyId === pid && s.units.add(u.id));
    db.billingAccounts.forEach((b) => b.payerRef.kind === 'property' && b.payerRef.id === pid && s.billing.add(b.id));
  });
  // Residents see their own billing accounts only.
  if (s.customerId) {
    db.billingAccounts.forEach((b) => b.payerRef.kind === 'customer' && b.payerRef.id === s.customerId && s.billing.add(b.id));
  }
  return s;
}

export function canSeeService(s: ResolvedScope, srv: ServiceInstance): boolean {
  if (s.all) return true;
  if (s.customerId) return srv.owner.kind === 'customer' && srv.owner.id === s.customerId;
  if (srv.businessAccountId && s.accounts.has(srv.businessAccountId)) return true;
  if (srv.propertyId && s.properties.has(srv.propertyId)) return true;
  return s.billing.has(srv.billingAccountId);
}

export function hasPermission(db: Database, user: User, p: Permission): boolean {
  if (user.status !== 'Active') return false;
  return db.roles.find((r) => r.id === user.roleId)?.permissions.includes(p) ?? false;
}

export class AuthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ValidationError';
  }
}
