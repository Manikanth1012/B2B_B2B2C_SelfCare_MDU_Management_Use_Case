/*
 * Domain model for the Business Account & MDU self-care prototype.
 *
 * Three hierarchies are kept deliberately separate (spec §11 rule 1):
 *   1. Organisational ownership  — BusinessAccount + AccountRelationship (TMF629/TMF632)
 *   2. Billing responsibility    — BillingAccount + BillingAccountRelationship (TMF666/TMF678)
 *   3. Physical premises         — Property → Building → Floor → Unit (own location domain)
 * A unit links to a resident CustomerAccount through an OccupancyAssignment; the
 * resident is never a child of the property manager's organisation.
 */

export type ID = string;
export type ISODate = string;
export type Currency = 'INR' | 'SGD';

export type TenantId = ID;

export interface Tenant {
  id: TenantId;
  name: string;
  kind: 'Enterprise' | 'PropertyManagement' | 'Operator';
}

/* ---------- Organisational hierarchy ---------- */

export type BusinessAccountType = 'Root' | 'Subsidiary' | 'Department' | 'Branch' | 'Service';
export type AccountStatus = 'Active' | 'Pending Approval' | 'Suspended' | 'Closed';

export interface BusinessAccount {
  id: ID;
  tenantId: TenantId;
  name: string;
  type: BusinessAccountType;
  status: AccountStatus;
  registrationNo?: string;
  industry?: string;
  sector?: string;
  primaryContactId?: ID;
  serviceAddress?: string;
  billingAddress?: string;
  accountOwner: string;
  createdAt: ISODate;
}

/** Ownership edge with effective dating; moving an account end-dates the old edge. */
export interface AccountRelationship {
  id: ID;
  parentId: ID;
  childId: ID;
  kind: 'ownership';
  validFrom: ISODate;
  validTo?: ISODate;
}

export interface Contact {
  id: ID;
  accountId: ID;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary?: boolean;
}

/* ---------- Billing hierarchy ---------- */

export type BillingAccountType = 'Aggregator' | 'Consolidated' | 'Standard' | 'Property Master' | 'Resident';
export type BillingModel = 'Individual' | 'Master' | 'Hybrid' | 'Bulk Contract';

export interface BillingAccount {
  id: ID;
  tenantId: TenantId;
  name: string;
  type: BillingAccountType;
  /** The party responsible for paying: a business account, property or resident customer. */
  payerRef: { kind: 'business' | 'property' | 'customer'; id: ID };
  currency: Currency;
  billCycleDay: number;
  paymentMethod: 'Bank Transfer' | 'Direct Debit' | 'Card' | 'UPI';
  invoiceDelivery: 'Email' | 'Portal' | 'Post';
  paperless: boolean;
  status: 'Active' | 'Suspended' | 'Closed';
  creditLimit: number;
}

/** Billing roll-up edge: a child billing account whose charges aggregate into a parent invoice. */
export interface BillingAccountRelationship {
  id: ID;
  parentBillingId: ID;
  childBillingId: ID;
  validFrom: ISODate;
  validTo?: ISODate;
}

export interface InvoiceLine {
  serviceId?: ID;
  description: string;
  costCentre: string;
  amount: number;
}

export interface Invoice {
  id: ID;
  billingAccountId: ID;
  period: string; // YYYY-MM
  issueDate: ISODate;
  dueDate: ISODate;
  amount: number;
  status: 'Paid' | 'Open' | 'Overdue';
  lines: InvoiceLine[];
}

export interface Payment {
  id: ID;
  billingAccountId: ID;
  invoiceId?: ID;
  date: ISODate;
  amount: number;
  method: BillingAccount['paymentMethod'];
  reference: string;
  simulated: true;
}

/* ---------- Customers (B2B2C residents) ---------- */

export interface CustomerAccount {
  id: ID;
  tenantId: TenantId;
  name: string;
  email: string;
  phone: string;
  createdAt: ISODate;
}

/* ---------- Physical premises (MDU) ---------- */

export type PropertyType = 'Apartment' | 'Gated Community' | 'Condominium' | 'Mixed Use';
export type AccessTech = 'FTTH' | 'FTTB' | 'Ethernet';
export type Readiness = 'Ready' | 'Partially Ready' | 'Survey Pending' | 'Not Ready';

export interface Property {
  id: ID;
  tenantId: TenantId;
  name: string;
  type: PropertyType;
  managementOrg: string;
  managerUserId: ID;
  address: string;
  city: string;
  geo?: { lat: number; lng: number };
  contactPhone: string;
  contactEmail: string;
  technology: AccessTech;
  readiness: Readiness;
  capacityPorts: number;
  equipment: string;
  plannedActivation: ISODate;
  billingModel: BillingModel;
  masterBillingId?: ID;
  status: 'Live' | 'Onboarding' | 'Pending Approval';
  createdAt: ISODate;
}

export interface Building {
  id: ID;
  propertyId: ID;
  name: string;
  floors: number;
}

export interface Floor {
  id: ID;
  buildingId: ID;
  number: number;
}

export type UnitType = '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'Studio' | 'Retail' | 'Amenity';
export type Occupancy = 'Occupied' | 'Vacant' | 'Unknown';
export type NetworkReadiness = 'Ready' | 'Not Ready';

export interface Unit {
  id: ID;
  propertyId: ID;
  buildingId: ID;
  floorId: ID;
  number: string; // e.g. A-302
  unitType: UnitType;
  occupancy: Occupancy;
  networkReadiness: NetworkReadiness;
  existingServiceRef?: string;
}

export interface OccupancyAssignment {
  id: ID;
  unitId: ID;
  customerId: ID;
  role: 'Owner' | 'Tenant' | 'Authorised Contact';
  validFrom: ISODate;
  validTo?: ISODate;
}

/** Displayed unit connectivity — derived, never stored, so it can't drift from its inputs. */
export type ConnectivityStatus =
  | 'Connected'
  | 'Ready for Service'
  | 'Pending Installation'
  | 'Network Not Ready'
  | 'Suspended';

/* ---------- Catalogue, inventory, ordering ---------- */

export type ServiceCategory = 'FTTH Broadband' | 'Leased Line' | 'SD-WAN' | 'Voice' | 'IoT' | 'Managed Services';

export interface ProductOffering {
  id: ID;
  name: string;
  category: ServiceCategory;
  segment: 'Business' | 'Residential';
  speed?: string;
  mrc: number;
  nrc: number;
  contractMonths: number;
  techRequired?: AccessTech[];
  addOns?: { id: ID; name: string; mrc: number }[];
}

export type ServiceStatus = 'Active' | 'Suspended' | 'Pending Installation' | 'Pending Change' | 'Terminated';

/** Product subscription + its realising service instance, collapsed for the prototype (TMF637/TMF638). */
export interface ServiceInstance {
  id: ID;
  offeringId: ID;
  tenantId: TenantId;
  owner: { kind: 'business' | 'customer'; id: ID };
  businessAccountId?: ID;
  unitId?: ID;
  propertyId?: ID;
  location: string;
  billingAccountId: ID;
  status: ServiceStatus;
  activationDate?: ISODate;
  contractEnd?: ISODate;
  mrc: number;
  addOns: string[];
  equipment: { type: string; serial: string }[];
  pendingChange?: string;
}

export type QualificationResult = 'Service Available' | 'Additional Network Work Required' | 'Service Not Available';

export interface ServiceQualification {
  id: ID;
  target: { kind: 'unit' | 'address'; ref: string };
  result: QualificationResult;
  reason: string;
  eligibleOfferingIds: ID[];
  checkedAt: ISODate;
}

export interface ProductOrder {
  id: ID;
  kind: 'New Connection' | 'Plan Change' | 'Suspension' | 'Resumption' | 'Bulk Activation' | 'Add-on';
  requestId: ID;
  items: {
    unitId?: ID;
    businessAccountId?: ID;
    serviceId?: ID;
    offeringId?: ID;
    status: 'Queued' | 'In Progress' | 'Completed' | 'Failed' | 'Awaiting Approval';
    note?: string;
  }[];
  billingAccountId?: ID;
  appointment?: string;
  createdAt: ISODate;
}

/* ---------- Requests, approvals, audit ---------- */

export type RequestCategory =
  | 'New Connection'
  | 'Plan Change'
  | 'Service Suspension'
  | 'Billing Query'
  | 'Network Issue'
  | 'Property Connectivity Issue'
  | 'Account Modification'
  | 'Bulk Activation';

export type RequestStatus =
  | 'Submitted'
  | 'Validating'
  | 'Approved'
  | 'In Progress'
  | 'Completed'
  | 'Rejected'
  | 'Failed'
  | 'Cancelled';

export interface TimelineEntry {
  at: ISODate;
  status: RequestStatus | 'Comment';
  by: string;
  note?: string;
}

export interface ServiceRequest {
  id: ID;
  tenantId: TenantId;
  kind: 'Service Request' | 'Incident';
  category: RequestCategory;
  title: string;
  description: string;
  businessAccountId?: ID;
  propertyId?: ID;
  unitId?: ID;
  serviceId?: ID;
  billingAccountId?: ID;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: RequestStatus;
  assignedTeam: string;
  createdBy: ID;
  createdAt: ISODate;
  slaDue: ISODate;
  timeline: TimelineEntry[];
  attachments: string[];
  orderId?: ID;
}

export interface Appointment {
  id: ID;
  requestId: ID;
  unitId?: ID;
  propertyId?: ID;
  slot: ISODate;
  window: string;
  technician: string;
  status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled';
}

export type ApprovalType =
  | 'Move Child Account'
  | 'Create Child Account'
  | 'Change Billing Responsibility'
  | 'Bulk Service Activation'
  | 'Reassign Property Administrator'
  | 'Modify Sensitive Account Data'
  | 'Register Property';

export interface ApprovalRequest {
  id: ID;
  tenantId: TenantId;
  type: ApprovalType;
  summary: string;
  target: { kind: 'account' | 'billing' | 'property' | 'order'; id: ID };
  payload: Record<string, unknown>;
  requestedBy: ID;
  requestedAt: ISODate;
  status: 'Pending' | 'Approved' | 'Rejected';
  decidedBy?: ID;
  decidedAt?: ISODate;
  decisionNote?: string;
}

export interface AuditEvent {
  id: ID;
  tenantId: TenantId;
  at: ISODate;
  actor: string;
  action: string;
  entity: { kind: string; id: ID };
  detail: string;
}

/* ---------- Identity & access ---------- */

export type RoleId = 'ENT_SUPER' | 'BIZ_ADMIN' | 'MDU_PM' | 'BILLING_ADMIN' | 'RESIDENT' | 'OPERATOR';

export type Permission =
  | 'account.read'
  | 'account.create'
  | 'account.edit'
  | 'account.move'
  | 'property.read'
  | 'property.create'
  | 'property.edit'
  | 'unit.manage'
  | 'service.read'
  | 'service.order'
  | 'service.bulk'
  | 'billing.read'
  | 'billing.manage'
  | 'billing.pay'
  | 'request.create'
  | 'user.manage'
  | 'approval.decide'
  | 'reports.read'
  | 'audit.read';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
}

/**
 * A grant of visibility. `subtree` scopes include every descendant at evaluation
 * time when `inherit` is true, so new child accounts are covered automatically.
 */
export interface Scope {
  kind: 'all' | 'account' | 'property' | 'unit' | 'billing';
  ref?: ID;
  inherit: boolean;
}

export interface User {
  id: ID;
  tenantId: TenantId;
  name: string;
  email: string;
  phone: string;
  title: string;
  roleId: RoleId;
  scopes: Scope[];
  status: 'Active' | 'Invited' | 'Revoked';
  customerId?: ID;
  lastLogin?: ISODate;
}

export interface Settings {
  approvalForChildAccount: boolean;
  approvalForBulkActivation: boolean;
  approvalForBillingChange: boolean;
  notifications: { email: boolean; sms: boolean; portal: boolean; events: Record<string, boolean> };
  reportingFx: { SGD: number };
}

export interface Database {
  version: number;
  tenants: Tenant[];
  accounts: BusinessAccount[];
  relationships: AccountRelationship[];
  contacts: Contact[];
  billingAccounts: BillingAccount[];
  billingRelationships: BillingAccountRelationship[];
  invoices: Invoice[];
  payments: Payment[];
  customers: CustomerAccount[];
  properties: Property[];
  buildings: Building[];
  floors: Floor[];
  units: Unit[];
  occupancies: OccupancyAssignment[];
  offerings: ProductOffering[];
  services: ServiceInstance[];
  qualifications: ServiceQualification[];
  orders: ProductOrder[];
  requests: ServiceRequest[];
  appointments: Appointment[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
  roles: Role[];
  users: User[];
  settings: Settings;
  seq: number;
}
