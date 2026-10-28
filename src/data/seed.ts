/*
 * Deterministic synthetic seed. Every run produces the same dataset so numbers
 * reconcile across roles and screenshots. No real customer data.
 */
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

export const SCHEMA_VERSION = 7;
export const TODAY = '2026-10-23';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Aarav', 'Diya', 'Ishaan', 'Meera', 'Rohan', 'Kavya', 'Arjun', 'Nisha', 'Siddharth', 'Pooja', 'Rahul', 'Anika', 'Varun', 'Lakshmi', 'Nikhil', 'Tanvi', 'Aditya', 'Shreya', 'Manoj', 'Fatima', 'Joseph', 'Harpreet', 'Gaurav', 'Divya', 'Imran', 'Ritu', 'Suresh', 'Neha', 'Kiran', 'Zoya'];
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Menon', 'Das', 'Khan', 'Rao', 'Kulkarni', 'Fernandes', 'Singh', 'Bose', 'Pillai', 'Mehta', 'Chatterjee', 'Joshi', 'Verma', 'Hegde'];

export const ROLES: Role[] = [
  {
    id: 'ENT_SUPER',
    name: 'Enterprise Super Administrator',
    description: 'All authorised business accounts and subsidiaries; hierarchy, users, consolidated billing and approvals.',
    permissions: ['account.read', 'account.create', 'account.edit', 'account.move', 'property.read', 'service.read', 'service.order', 'billing.read', 'billing.manage', 'billing.pay', 'request.create', 'user.manage', 'approval.decide', 'reports.read', 'audit.read'],
  },
  {
    id: 'BIZ_ADMIN',
    name: 'Business Account Administrator',
    description: 'Assigned business accounts: contacts, users, services, invoices and requests.',
    permissions: ['account.read', 'account.edit', 'account.create', 'service.read', 'service.order', 'billing.read', 'request.create', 'user.manage', 'reports.read'],
  },
  {
    id: 'MDU_PM',
    name: 'MDU Property Manager',
    description: 'Assigned properties: buildings, units, occupancy, connectivity and bulk requests.',
    permissions: ['account.read', 'property.read', 'property.create', 'property.edit', 'unit.manage', 'service.read', 'service.order', 'service.bulk', 'billing.read', 'billing.pay', 'request.create', 'reports.read', 'user.manage'],
  },
  {
    id: 'PROPERTY_STAFF',
    name: 'Property Staff',
    description: 'Assigned property: view units, manage occupancy, order services and raise tickets. Grantable by MDU Property Manager.',
    permissions: ['property.read', 'unit.manage', 'service.read', 'service.order', 'billing.read', 'request.create'],
  },
  {
    id: 'BILLING_ADMIN',
    name: 'Billing Administrator',
    description: 'Billing accounts, invoices, preferences and payments across the authorised billing subtree.',
    permissions: ['account.read', 'billing.read', 'billing.manage', 'billing.pay', 'service.read', 'request.create', 'reports.read'],
  },
  {
    id: 'RESIDENT',
    name: 'Resident / Unit Subscriber',
    description: 'Own unit, own subscriptions, own bills and own requests only.',
    permissions: ['property.read', 'service.read', 'service.order', 'billing.read', 'billing.pay', 'request.create'],
  },
  {
    id: 'OPERATOR',
    name: 'Operator Administrator',
    description: 'Full operator access: provisioning, approvals, user management and operational status across all tenants.',
    permissions: ['account.read', 'account.create', 'account.edit', 'account.move', 'property.read', 'property.create', 'property.edit', 'unit.manage', 'service.read', 'service.order', 'service.bulk', 'billing.read', 'billing.manage', 'billing.pay', 'request.create', 'user.manage', 'approval.decide', 'reports.read', 'audit.read'],
  },
];

export const OFFERINGS: ProductOffering[] = [
  { id: 'OFF-B01', name: 'Enterprise Fibre 1 Gbps', category: 'Leased Line', segment: 'Business', speed: '1 Gbps symmetric', mrc: 85000, nrc: 25000, contractMonths: 36 },
  { id: 'OFF-B02', name: 'Dedicated Internet Access 500 Mbps', category: 'Leased Line', segment: 'Business', speed: '500 Mbps', mrc: 52000, nrc: 15000, contractMonths: 24 },
  { id: 'OFF-B03', name: 'SD-WAN Branch Pack', category: 'SD-WAN', segment: 'Business', mrc: 18000, nrc: 8000, contractMonths: 24 },
  { id: 'OFF-B04', name: 'SIP Trunk – 30 Channels', category: 'Voice', segment: 'Business', mrc: 9500, nrc: 2000, contractMonths: 12 },
  { id: 'OFF-B05', name: 'IoT Fleet Connect – 100 SIM Pool', category: 'IoT', segment: 'Business', mrc: 12000, nrc: 0, contractMonths: 12 },
  { id: 'OFF-B06', name: 'Managed Wi-Fi & Security', category: 'Managed Services', segment: 'Business', mrc: 22000, nrc: 12000, contractMonths: 36 },
  { id: 'OFF-B07', name: 'Business FTTH 300 Mbps', category: 'FTTH Broadband', segment: 'Business', speed: '300 Mbps', mrc: 3499, nrc: 1000, contractMonths: 12, techRequired: ['FTTH', 'FTTB'] },
  {
    id: 'OFF-R01', name: 'FiberHome 100 Mbps', category: 'FTTH Broadband', segment: 'Residential', speed: '100 Mbps', mrc: 699, nrc: 500, contractMonths: 12, techRequired: ['FTTH', 'FTTB', 'Ethernet'],
    addOns: [
      { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
      { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
      { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
      { id: 'ADD-MESH', name: 'Mesh Wi-Fi Extender', mrc: 4 },
      { id: 'ADD-MESH-NODE', name: 'Extra Mesh Node', mrc: 6 },
      { id: 'ADD-VOICE', name: 'Fixed Voice Line', mrc: 3 },
    ],
  },
  {
    id: 'OFF-R02', name: 'FiberHome 300 Mbps', category: 'FTTH Broadband', segment: 'Residential', speed: '300 Mbps', mrc: 999, nrc: 500, contractMonths: 12, techRequired: ['FTTH', 'FTTB'],
    addOns: [
      { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
      { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
      { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
      { id: 'ADD-MESH', name: 'Mesh Wi-Fi Extender', mrc: 4 },
      { id: 'ADD-MESH-NODE', name: 'Extra Mesh Node', mrc: 6 },
      { id: 'ADD-STATIC-IP', name: 'Static IP', mrc: 8 },
    ],
  },
  {
    id: 'OFF-R03', name: 'FiberHome 1 Gbps', category: 'FTTH Broadband', segment: 'Residential', speed: '1 Gbps', mrc: 1999, nrc: 0, contractMonths: 12, techRequired: ['FTTH'],
    addOns: [
      { id: 'ADD-OTT', name: 'OTT Entertainment Pack', mrc: 5 },
      { id: 'ADD-OTT-PREM', name: 'OTT Premium Pack – Sports & Movies', mrc: 12 },
      { id: 'ADD-STB', name: 'Additional Set-top Box', mrc: 8 },
      { id: 'ADD-STATIC-IP', name: 'Static IP', mrc: 8 },
    ],
  },
  { id: 'OFF-R04', name: 'FiberHome Lite 50 Mbps', category: 'FTTH Broadband', segment: 'Residential', speed: '50 Mbps', mrc: 499, nrc: 500, contractMonths: 6, techRequired: ['FTTH', 'FTTB', 'Ethernet'] },
  { id: 'OFF-P01', name: 'Common Area Wi-Fi', category: 'Managed Services', segment: 'Business', mrc: 15000, nrc: 20000, contractMonths: 36 },
  { id: 'OFF-P02', name: 'CCTV IoT Connect', category: 'IoT', segment: 'Business', mrc: 6500, nrc: 0, contractMonths: 24 },
  { id: 'OFF-P03', name: 'Lift Emergency Voice Lines', category: 'Voice', segment: 'Business', mrc: 2400, nrc: 0, contractMonths: 24 },
  {
    id: 'OFF-V01', name: 'FixedVoice Home', category: 'Voice', segment: 'Residential', mrc: 12, nrc: 0, contractMonths: 12,
    addOns: [
      { id: 'ADD-VOICEMAIL', name: 'Voicemail', mrc: 3 },
      { id: 'ADD-INTL', name: 'International Calling Plan – 200 mins/mo', mrc: 10 },
    ],
  },
  { id: 'OFF-P04', name: 'Property Voice Lines Pack', category: 'Voice', segment: 'Business', mrc: 18, nrc: 0, contractMonths: 24 },
  { id: 'OFF-M01', name: 'Mobile Postpaid 599 (5G, 75 GB)', category: 'Mobile', segment: 'Residential', mrc: 599, nrc: 0, contractMonths: 0 },
  { id: 'OFF-M02', name: 'Mobile Prepaid 299 (28 days)', category: 'Mobile', segment: 'Residential', mrc: 299, nrc: 0, contractMonths: 0 },
];

const off = (id: string) => OFFERINGS.find((o) => o.id === id)!;

function addMonths(iso: string, m: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildSeed(): Database {
  const rnd = mulberry32(6060);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  let seq = 10000;
  const nid = (p: string) => `${p}-${++seq}`;

  const db: Database = {
    version: SCHEMA_VERSION,
    tenants: [
      { id: 'TEN-6DGE', name: '6D Global Enterprises', kind: 'Enterprise' },
      { id: 'TEN-EVG', name: 'Evergreen Estate Management', kind: 'PropertyManagement' },
      { id: 'TEN-PMH', name: 'Palm Meadows Habitat Services', kind: 'PropertyManagement' },
      { id: 'TEN-RES', name: 'Residential Subscribers', kind: 'Operator' },
      { id: 'TEN-OPR', name: 'Operator', kind: 'Operator' },
    ],
    accounts: [],
    relationships: [],
    contacts: [],
    billingAccounts: [],
    billingRelationships: [],
    invoices: [],
    payments: [],
    customers: [],
    properties: [],
    buildings: [],
    floors: [],
    units: [],
    occupancies: [],
    offerings: OFFERINGS,
    services: [],
    phoneNumbers: [] as PhoneNumber[],
    qualifications: [],
    orders: [],
    requests: [],
    appointments: [],
    approvals: [],
    audit: [],
    roles: ROLES,
    users: [],
    settings: {
      approvalForChildAccount: false,
      approvalForBulkActivation: true,
      approvalForBillingChange: true,
      notifications: {
        email: true,
        sms: false,
        portal: true,
        events: { 'Invoice issued': true, 'Payment overdue': true, 'Request status change': true, 'Approval required': true, 'Installation appointment': true, 'Planned network maintenance': false },
      },
      reportingFx: { USD: 1 },
    },
    seq: 0,
  };

  /* ---------------- Business accounts ---------------- */
  const A = (id: string, name: string, type: Database['accounts'][number]['type'], parent: string | null, extra: Partial<Database['accounts'][number]> = {}, tenantId = 'TEN-6DGE') => {
    db.accounts.push({ id, tenantId, name, type, status: 'Active', accountOwner: 'Kiran Desai (Enterprise Sales)', createdAt: '2024-04-01', ...extra });
    if (parent) db.relationships.push({ id: `REL-${id}`, parentId: parent, childId: id, kind: 'ownership', validFrom: extra.createdAt ?? '2024-04-01' });
  };
  A('ACC-1000', '6D Global Enterprises', 'Root', null, { registrationNo: 'U72200KA2009PTC051234', industry: 'Technology Services', sector: 'Trades', serviceAddress: 'No 26, Bannerghatta Road, Bengaluru 560076', billingAddress: 'No 26, Bannerghatta Road, Bengaluru 560076', createdAt: '2023-07-26' });
  A('ACC-1100', '6D India', 'Subsidiary', 'ACC-1000', { registrationNo: 'U72900KA2012PTC064411', industry: 'Technology Services', serviceAddress: 'Bannerghatta Road, Bengaluru 560076', billingAddress: 'Bannerghatta Road, Bengaluru 560076', createdAt: '2023-08-02' });
  A('ACC-1110', 'Bangalore Office', 'Branch', 'ACC-1100', { serviceAddress: 'Tech Park Block C, Whitefield, Bengaluru 560066', billingAddress: 'Bannerghatta Road, Bengaluru 560076', createdAt: '2023-08-10' });
  A('ACC-1120', 'Hyderabad Office', 'Branch', 'ACC-1100', { serviceAddress: 'Cyber Towers, HITEC City, Hyderabad 500081', billingAddress: 'Bannerghatta Road, Bengaluru 560076', createdAt: '2024-01-15' });
  A('ACC-1130', 'Mumbai Sales Office', 'Branch', 'ACC-1100', { serviceAddress: 'BKC G Block, Mumbai 400051', status: 'Pending Approval', createdAt: '2026-10-19' });
  A('ACC-1200', '6D Singapore', 'Subsidiary', 'ACC-1000', { registrationNo: '201912345K', industry: 'Technology Services', serviceAddress: '1 Raffles Place, Singapore 048616', billingAddress: '1 Raffles Place, Singapore 048616', createdAt: '2024-02-01' });
  A('ACC-1210', 'Singapore HQ', 'Service', 'ACC-1200', { serviceAddress: '1 Raffles Place, #20-01, Singapore 048616', createdAt: '2024-02-05' });
  A('ACC-1300', '6D Shared Services', 'Department', 'ACC-1000', { serviceAddress: 'Bannerghatta Road, Bengaluru 560076', createdAt: '2024-03-01' });
  A('ACC-1310', 'IT Operations', 'Department', 'ACC-1300', { createdAt: '2024-03-04' });
  A('ACC-1320', 'Facilities & Fleet', 'Department', 'ACC-1300', { createdAt: '2024-05-20', status: 'Suspended' });
  A('ACC-2000', 'Evergreen Estate Management', 'Root', null, { registrationNo: 'U70200KA2015PTC080012', industry: 'Real Estate Services', serviceAddress: 'Sarjapur Road, Bengaluru 560035', createdAt: '2024-06-11' }, 'TEN-EVG');
  A('ACC-3000', 'Palm Meadows Habitat Services', 'Root', null, { registrationNo: 'U70100MH2017PTC290031', industry: 'Real Estate Services', serviceAddress: 'Kharadi, Pune 411014', createdAt: '2025-01-09' }, 'TEN-PMH');

  const C = (accountId: string, name: string, title: string, primary = false) => {
    const id = nid('CON');
    const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + (accountId.startsWith('ACC-2') ? 'evergreen-estates.example' : accountId.startsWith('ACC-3') ? 'palmmeadows.example' : '6dglobal.example');
    db.contacts.push({ id, accountId, name, title, email, phone: '+91 9' + Math.floor(100000000 + rnd() * 899999999), isPrimary: primary });
    if (primary) db.accounts.find((a) => a.id === accountId)!.primaryContactId = id;
  };
  C('ACC-1000', 'Ananya Rao', 'Group CIO', true);
  C('ACC-1000', 'Rahul Iyer', 'Group Finance Controller');
  C('ACC-1100', 'Vikram Shetty', 'Head of IT – India', true);
  C('ACC-1110', 'Karthik Reddy', 'Site IT Manager', true);
  C('ACC-1110', 'Pallavi Hegde', 'Facilities Lead');
  C('ACC-1120', 'Sanjana Pillai', 'Site IT Manager', true);
  C('ACC-1130', 'Omkar Patil', 'Office Manager', true);
  C('ACC-1200', 'Wei Ling Tan', 'Country Director', true);
  C('ACC-1210', 'Marcus Lim', 'IT Lead', true);
  C('ACC-1300', 'Geeta Krishnan', 'Shared Services Head', true);
  C('ACC-1310', 'Prakash Bhat', 'IT Ops Manager', true);
  C('ACC-1320', 'Rekha Sen', 'Fleet Manager', true);
  C('ACC-2000', 'Priya Menon', 'Property Portfolio Manager', true);
  C('ACC-3000', 'Deepa Joshi', 'Estate Manager', true);

  /* ---------------- Billing accounts ---------------- */
  const B = (id: string, name: string, type: BillingAccount['type'], payer: BillingAccount['payerRef'], parent: string | null, extra: Partial<BillingAccount> = {}, tenantId = 'TEN-6DGE') => {
    db.billingAccounts.push({ id, tenantId, name, type, payerRef: payer, currency: 'USD', billCycleDay: 1, paymentMethod: 'Bank Transfer', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 2500000, ...extra });
    if (parent) db.billingRelationships.push({ id: `BREL-${id}`, parentBillingId: parent, childBillingId: id, validFrom: '2024-04-01' });
  };
  B('BA-9000', '6D Global Group Billing', 'Aggregator', { kind: 'business', id: 'ACC-1000' }, null, { creditLimit: 10000000 });
  B('BA-9100', 'India Corporate Billing', 'Consolidated', { kind: 'business', id: 'ACC-1100' }, 'BA-9000');
  B('BA-9110', 'Bangalore Office Billing', 'Standard', { kind: 'business', id: 'ACC-1110' }, 'BA-9100', { paymentMethod: 'Direct Debit' });
  B('BA-9200', 'Singapore Billing', 'Consolidated', { kind: 'business', id: 'ACC-1200' }, 'BA-9000', { currency: 'USD', creditLimit: 60000 });
  B('BA-9300', 'Shared Services Billing', 'Standard', { kind: 'business', id: 'ACC-1300' }, 'BA-9000');
  B('BA-8100', 'Green Valley Master Billing', 'Property Master', { kind: 'property', id: 'PRP-GV' }, null, { creditLimit: 500000 }, 'TEN-EVG');
  B('BA-8200', 'Sunrise Heights Bulk Contract', 'Property Master', { kind: 'property', id: 'PRP-SH' }, null, { creditLimit: 1500000 }, 'TEN-EVG');
  B('BA-8300', 'Palm Meadows Common Areas', 'Standard', { kind: 'property', id: 'PRP-PM' }, null, { creditLimit: 300000 }, 'TEN-PMH');
  B('BA-9400', 'Evergreen Estate Management Billing', 'Standard', { kind: 'business', id: 'ACC-2000' }, null, { creditLimit: 200000 }, 'TEN-EVG');
  B('BA-9500', 'Palm Meadows Corporate Billing', 'Standard', { kind: 'business', id: 'ACC-3000' }, null, { creditLimit: 150000 }, 'TEN-PMH');

  /* ---------------- Business services ---------------- */
  const S = (s: Omit<ServiceInstance, 'id' | 'tenantId' | 'addOns' | 'equipment'> & Partial<ServiceInstance>, tenantId = 'TEN-6DGE') => {
    const id = nid('SRV');
    db.services.push({ id, tenantId, addOns: [], equipment: [], ...s });
    return id;
  };
  const biz = (acc: string, offId: string, loc: string, ba: string, act: string, status: ServiceInstance['status'] = 'Active', mrc?: number, equipment: ServiceInstance['equipment'] = []) =>
    S({ offeringId: offId, owner: { kind: 'business', id: acc }, businessAccountId: acc, location: loc, billingAccountId: ba, status, activationDate: status === 'Pending Installation' ? undefined : act, contractEnd: addMonths(act, off(offId).contractMonths), mrc: mrc ?? off(offId).mrc, equipment });

  biz('ACC-1110', 'OFF-B01', 'Whitefield Tech Park, Block C', 'BA-9110', '2023-09-01', 'Active', undefined, [{ type: 'CPE Router Cisco ISR 4331', serial: 'FGL2231A0QZ' }]);
  biz('ACC-1110', 'OFF-B03', 'Whitefield Tech Park, Block C', 'BA-9110', '2023-09-01', 'Active', undefined, [{ type: 'SD-WAN Edge', serial: 'VED-88231' }]);
  biz('ACC-1110', 'OFF-B04', 'Whitefield Tech Park, Block C', 'BA-9110', '2024-02-12');
  biz('ACC-1110', 'OFF-B06', 'Whitefield Tech Park, Floors 3-6', 'BA-9110', '2024-06-01');
  biz('ACC-1110', 'OFF-B07', 'Whitefield Tech Park, Guest Lounge', 'BA-9110', '2025-01-10', 'Suspended');
  // Hyderabad is served at its own site but billed to India Corporate Billing: location ≠ payer.
  biz('ACC-1120', 'OFF-B02', 'Cyber Towers, HITEC City', 'BA-9100', '2024-02-01', 'Active', undefined, [{ type: 'CPE Router Juniper SRX345', serial: 'CW4419AF0081' }]);
  biz('ACC-1120', 'OFF-B03', 'Cyber Towers, HITEC City', 'BA-9100', '2024-02-01');
  biz('ACC-1120', 'OFF-B04', 'Cyber Towers, HITEC City', 'BA-9100', '2024-03-15');
  biz('ACC-1130', 'OFF-B02', 'BKC G Block, Mumbai', 'BA-9100', TODAY, 'Pending Installation');
  biz('ACC-1100', 'OFF-B05', 'Pan-India fleet', 'BA-9100', '2024-07-01');
  biz('ACC-1210', 'OFF-B01', '1 Raffles Place, #20-01', 'BA-9200', '2024-03-01', 'Active', 1850, [{ type: 'CPE Router Cisco ISR 4351', serial: 'FDO2310M1KP' }]);
  biz('ACC-1210', 'OFF-B04', '1 Raffles Place, #20-01', 'BA-9200', '2024-03-01', 'Active', 240);
  biz('ACC-1210', 'OFF-B06', '1 Raffles Place, #20-01', 'BA-9200', '2024-05-01', 'Active', 520);
  biz('ACC-1310', 'OFF-B02', 'Bannerghatta Road DC', 'BA-9300', '2024-03-10');
  biz('ACC-1310', 'OFF-B03', 'Bannerghatta Road DC', 'BA-9300', '2024-03-10');
  biz('ACC-1320', 'OFF-B05', 'Fleet vehicles (Bengaluru)', 'BA-9300', '2024-06-01', 'Suspended');
  // Additional 6D services — contract ends spread across 2026 Q4 – 2028 Q1 for renewals chart
  biz('ACC-1120', 'OFF-B01', 'Cyber Towers Dedicated Uplink', 'BA-9100', '2024-10-01'); // +36 = 2027 Q4
  biz('ACC-1120', 'OFF-B06', 'Cyber Towers Managed Wi-Fi', 'BA-9100', '2025-08-01');   // +36 = 2028 Q3
  biz('ACC-1110', 'OFF-B02', 'Whitefield Backup Internet', 'BA-9110', '2024-10-15');   // +24 = 2026 Q4
  biz('ACC-1300', 'OFF-B01', 'Bannerghatta Road HQ Link', 'BA-9300', '2024-11-01');    // +36 = 2027 Q4
  biz('ACC-1100', 'OFF-B03', 'India SD-WAN Overlay', 'BA-9100', '2025-08-01');         // +24 = 2027 Q4
  biz('ACC-1100', 'OFF-B06', 'Pan-India IT Managed Wi-Fi', 'BA-9100', '2025-02-01');   // +36 = 2028 Q1
  biz('ACC-1210', 'OFF-B03', 'Singapore SD-WAN Edge', 'BA-9200', '2025-11-01');        // +24 = 2027 Q4
  biz('ACC-1200', 'OFF-B02', 'Singapore DR Link', 'BA-9200', '2026-01-15');            // +24 = 2028 Q1
  biz('ACC-1310', 'OFF-B01', 'DC Primary Uplink', 'BA-9300', '2024-11-15');            // +36 = 2027 Q4
  // Evergreen Estate Management — management office B2B services (separate from property-billed services)
  S({ offeringId: 'OFF-B07', owner: { kind: 'business', id: 'ACC-2000' }, businessAccountId: 'ACC-2000', location: 'Sarjapur Road Management Office', billingAccountId: 'BA-9400', status: 'Active', activationDate: '2025-03-01', contractEnd: addMonths('2025-03-01', 12), mrc: off('OFF-B07').mrc }, 'TEN-EVG');
  S({ offeringId: 'OFF-B04', owner: { kind: 'business', id: 'ACC-2000' }, businessAccountId: 'ACC-2000', location: 'Sarjapur Road Management Office – SIP Trunk', billingAccountId: 'BA-9400', status: 'Active', activationDate: '2025-03-01', contractEnd: addMonths('2025-03-01', 12), mrc: off('OFF-B04').mrc }, 'TEN-EVG');
  // Palm Meadows Habitat Services — management office
  S({ offeringId: 'OFF-B07', owner: { kind: 'business', id: 'ACC-3000' }, businessAccountId: 'ACC-3000', location: 'Kharadi Management Office', billingAccountId: 'BA-9500', status: 'Active', activationDate: '2025-06-01', contractEnd: addMonths('2025-06-01', 12), mrc: off('OFF-B07').mrc }, 'TEN-PMH');
  S({ offeringId: 'OFF-B05', owner: { kind: 'business', id: 'ACC-3000' }, businessAccountId: 'ACC-3000', location: 'Kharadi Premises IoT', billingAccountId: 'BA-9500', status: 'Active', activationDate: '2025-07-01', contractEnd: addMonths('2025-07-01', 12), mrc: off('OFF-B05').mrc }, 'TEN-PMH');

  /* ---------------- MDU properties ---------------- */
  const props: { p: Property; towers: string[]; readyRule: (tower: string, floor: number) => boolean; occ: number; take: number }[] = [
    {
      p: { id: 'PRP-GV', tenantId: 'TEN-EVG', name: 'Green Valley Residences', type: 'Gated Community', managementOrg: 'Evergreen Estate Management', managerUserId: 'U-200', address: 'Sarjapur Road, Bellandur', city: 'Bengaluru', geo: { lat: 12.9121, lng: 77.6446 }, contactPhone: '+91 80 4110 2200', contactEmail: 'office@greenvalley.example', technology: 'FTTH', readiness: 'Partially Ready', capacityPorts: 192, equipment: 'OLT Huawei MA5800-X7, 3× 1:32 splitters per tower riser', plannedActivation: '2024-08-01', billingModel: 'Hybrid', masterBillingId: 'BA-8100', status: 'Live', createdAt: '2024-06-15' },
      towers: ['A', 'B', 'C'],
      readyRule: (t, f) => t !== 'C' || f <= 6,
      occ: 0.86,
      take: 0.8,
    },
    {
      p: { id: 'PRP-SH', tenantId: 'TEN-EVG', name: 'Sunrise Heights', type: 'Apartment', managementOrg: 'Evergreen Estate Management', managerUserId: 'U-200', address: 'Kondapur Main Road', city: 'Hyderabad', geo: { lat: 17.4599, lng: 78.3637 }, contactPhone: '+91 40 2311 8800', contactEmail: 'manager@sunriseheights.example', technology: 'FTTB', readiness: 'Ready', capacityPorts: 128, equipment: 'FTTB MDU switch per tower, Cat6 in-building', plannedActivation: '2024-11-01', billingModel: 'Bulk Contract', masterBillingId: 'BA-8200', status: 'Live', createdAt: '2024-09-02' },
      towers: ['East', 'West'],
      readyRule: () => true,
      occ: 0.8,
      take: 0.9,
    },
    {
      p: { id: 'PRP-PM', tenantId: 'TEN-PMH', name: 'Palm Meadows Towers', type: 'Condominium', managementOrg: 'Palm Meadows Habitat Services', managerUserId: 'U-300', address: 'Kharadi Bypass', city: 'Pune', geo: { lat: 18.5515, lng: 73.9348 }, contactPhone: '+91 20 6720 4400', contactEmail: 'estate@palmmeadows.example', technology: 'FTTH', readiness: 'Partially Ready', capacityPorts: 256, equipment: 'OLT Nokia ISAM FX-8, towers C/D riser build in progress', plannedActivation: '2025-03-01', billingModel: 'Individual', masterBillingId: 'BA-8300', status: 'Onboarding', createdAt: '2025-01-12' },
      towers: ['A', 'B', 'C', 'D'],
      readyRule: (t) => t === 'A' || t === 'B',
      occ: 0.7,
      take: 0.65,
    },
  ];

  const resPlans = ['OFF-R01', 'OFF-R02', 'OFF-R02', 'OFF-R03', 'OFF-R04'];
  const typeByPos: UnitType[] = ['3BHK', '2BHK', '2BHK', '1BHK', '2BHK', '3BHK'];

  // KYC/consent attributes use their own PRNG so the unit and service layout stays stable.
  const krnd = mulberry32(4242);
  const kycFor = (since: string): Pick<CustomerAccount, 'kyc' | 'consents'> => {
    const r = krnd();
    const last4 = String(1000 + Math.floor(krnd() * 8999));
    if (r < 0.07) return { kyc: { status: 'Not Started', note: 'Legacy occupant migrated before self-care eKYC' }, consents: [] };
    if (r < 0.1) return { kyc: { status: 'Pending Review', method: 'Document upload (manual review)', idType: 'Passport', maskedRef: `XXXXX${last4}`, note: 'Awaiting back-office document check' }, consents: [{ purpose: 'Identity verification for telecom services', channel: 'Portal checkbox', at: since, capturedBy: 'Self' }] };
    const digi = r > 0.75;
    return {
      kyc: { status: 'Verified', method: digi ? 'DigiLocker' : 'Aadhaar OTP eKYC', idType: 'Aadhaar', maskedRef: `XXXX-XXXX-${last4}`, verifiedAt: since, source: 'Broadband onboarding' },
      consents: [{ purpose: 'Identity verification for telecom services', channel: 'OTP', at: since, capturedBy: 'Self' }],
    };
  };
  const addCustomer = (): CustomerAccount => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const c: CustomerAccount = { id: nid('CUS'), tenantId: 'TEN-RES', name, email: name.toLowerCase().replace(' ', '.') + seq + '@mail.example', phone: '+91 9' + Math.floor(100000000 + rnd() * 899999999), createdAt: '2024-08-01', ...kycFor('2024-08-01') };
    db.customers.push(c);
    return c;
  };

  for (const { p, towers, readyRule, occ, take } of props) {
    db.properties.push(p);
    for (const t of towers) {
      const b: Building = { id: `${p.id}-T${t}`, propertyId: p.id, name: towers.length && t.length === 1 ? `Tower ${t}` : `${t} Tower`, floors: 10 };
      db.buildings.push(b);
      for (let f = 1; f <= 10; f++) {
        const fl: Floor = { id: `${b.id}-F${f}`, buildingId: b.id, number: f };
        db.floors.push(fl);
        for (let u = 1; u <= 6; u++) {
          const number = `${t[0]}-${f}${String(u).padStart(2, '0')}`;
          const unit: Unit = {
            id: `${p.id}-${number}`,
            propertyId: p.id,
            buildingId: b.id,
            floorId: fl.id,
            number,
            unitType: typeByPos[u - 1],
            occupancy: 'Occupied',
            networkReadiness: readyRule(t, f) ? 'Ready' : 'Not Ready',
          };
          const r = rnd();
          unit.occupancy = r < occ ? 'Occupied' : r < occ + 0.1 ? 'Vacant' : 'Unknown';
          db.units.push(unit);

          if (unit.occupancy === 'Occupied') {
            const cust = addCustomer();
            const occA: OccupancyAssignment = { id: nid('OCC'), unitId: unit.id, customerId: cust.id, role: rnd() < 0.6 ? 'Owner' : 'Tenant', validFrom: addDays(p.createdAt, Math.floor(rnd() * 400)) };
            db.occupancies.push(occA);
            if (unit.networkReadiness === 'Ready' && rnd() < take) {
              const offId = pick(resPlans);
              const sr = rnd();
              const status: ServiceInstance['status'] = sr < 0.05 ? 'Suspended' : sr < 0.12 ? 'Pending Installation' : 'Active';
              let billingId: string;
              if (p.billingModel === 'Bulk Contract') billingId = p.masterBillingId!;
              else {
                billingId = nid('BA');
                db.billingAccounts.push({ id: billingId, tenantId: 'TEN-RES', name: `${cust.name} – Home`, type: 'Resident', payerRef: { kind: 'customer', id: cust.id }, currency: 'USD', billCycleDay: 5, paymentMethod: pick(['ACH', 'Card', 'Direct Debit'] as const), invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 10000 });
              }
              const act = addDays(occA.validFrom, 10);
              S(
                {
                  offeringId: offId,
                  owner: { kind: 'customer', id: cust.id },
                  unitId: unit.id,
                  propertyId: p.id,
                  location: `${p.name}, ${unit.number}`,
                  billingAccountId: billingId,
                  status,
                  activationDate: status === 'Pending Installation' ? undefined : act,
                  contractEnd: addMonths(act, off(offId).contractMonths),
                  mrc: p.billingModel === 'Bulk Contract' ? 650 : off(offId).mrc,
                  addOns: rnd() < 0.3 ? ['ADD-OTT'] : [],
                  equipment: status === 'Pending Installation' ? [] : [{ type: p.technology === 'FTTB' ? 'Ethernet Wi-Fi 6 Router' : 'GPON ONT + Wi-Fi 6', serial: 'ONT' + Math.floor(rnd() * 1e8) }],
                },
                p.tenantId,
              );
            }
          }
        }
      }
    }
    // Property-level shared services billed to the property, not residents.
    if (p.masterBillingId) {
      const propAccId = p.tenantId === 'TEN-EVG' ? 'ACC-2000' : 'ACC-3000';
      S({ offeringId: 'OFF-P01', owner: { kind: 'business', id: propAccId }, businessAccountId: propAccId, propertyId: p.id, location: `${p.name} – Clubhouse & lobbies`, billingAccountId: p.masterBillingId, status: p.status === 'Live' ? 'Active' : 'Pending Installation', activationDate: p.status === 'Live' ? p.plannedActivation : undefined, contractEnd: addMonths(p.plannedActivation, 36), mrc: off('OFF-P01').mrc }, p.tenantId);
      S({ offeringId: 'OFF-P02', owner: { kind: 'business', id: propAccId }, businessAccountId: propAccId, propertyId: p.id, location: `${p.name} – Perimeter CCTV`, billingAccountId: p.masterBillingId, status: 'Active', activationDate: p.plannedActivation, contractEnd: addMonths(p.plannedActivation, 24), mrc: off('OFF-P02').mrc }, p.tenantId);
      S({ offeringId: 'OFF-P03', owner: { kind: 'business', id: propAccId }, businessAccountId: propAccId, propertyId: p.id, location: `${p.name} – Lift Emergency Lines`, billingAccountId: p.masterBillingId, status: 'Active', activationDate: p.plannedActivation, contractEnd: addMonths(p.plannedActivation, 24), mrc: off('OFF-P03').mrc }, p.tenantId);
    }
  }

  // Fix up the scripted demo units so the journeys always work.
  const GV = (n: string) => db.units.find((u) => u.id === `PRP-GV-${n}`)!;
  const clearUnit = (unitId: string) => {
    db.services = db.services.filter((s) => s.unitId !== unitId);
    db.occupancies = db.occupancies.filter((o) => o.unitId !== unitId);
  };
  // A-302: vacant, network-ready, no service → eligible for connection (Journey D).
  clearUnit('PRP-GV-A-302');
  GV('A-302').occupancy = 'Vacant';
  // A-104: resident persona Sneha Kulkarni with an active 300 Mbps subscription (Journey I).
  clearUnit('PRP-GV-A-104');
  const sneha: CustomerAccount = {
    id: 'CUS-SNEHA', tenantId: 'TEN-RES', name: 'Sneha Kulkarni', email: 'sneha.kulkarni@mail.example', phone: '+91 98450 11223', dob: '1991-03-14', createdAt: '2023-02-11',
    kyc: { status: 'Verified', method: 'Aadhaar OTP eKYC', idType: 'Aadhaar', maskedRef: 'XXXX-XXXX-4417', verifiedAt: '2023-02-11', source: 'Mobile postpaid activation' },
    consents: [{ purpose: 'Identity verification for telecom services', channel: 'OTP', at: '2023-02-11', capturedBy: 'Self' }, { purpose: 'Link Green Valley A-104 occupancy to existing customer profile', channel: 'OTP', at: '2024-08-20', capturedBy: 'Priya Menon' }],
  };
  db.customers.push(sneha);
  GV('A-104').occupancy = 'Occupied';
  db.occupancies.push({ id: 'OCC-SNEHA', unitId: 'PRP-GV-A-104', customerId: sneha.id, role: 'Owner', validFrom: '2024-08-20' });
  db.billingAccounts.push({ id: 'BA-7001', tenantId: 'TEN-RES', name: 'Sneha Kulkarni – Home', type: 'Resident', payerRef: { kind: 'customer', id: sneha.id }, currency: 'USD', billCycleDay: 5, paymentMethod: 'ACH', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 10000 });
  // Sneha was a mobile customer first; her broadband reuses that profile and KYC (convergent customer).
  db.billingAccounts.push({ id: 'BA-7002', tenantId: 'TEN-RES', name: 'Sneha Kulkarni – Mobile', type: 'Resident', payerRef: { kind: 'customer', id: sneha.id }, currency: 'USD', billCycleDay: 12, paymentMethod: 'ACH', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 5000 });
  S({ offeringId: 'OFF-M01', owner: { kind: 'customer', id: sneha.id }, location: 'Mobile +91 98450 11223', billingAccountId: 'BA-7002', status: 'Active', activationDate: '2023-02-11', mrc: 599, equipment: [{ type: '5G SIM', serial: '8991 2310 0044 1723' }] }, 'TEN-RES');
  // Existing mobile-only customers — not yet occupants anywhere. Used by the occupant onboarding journey.
  const mobileOnly: [string, string, string, string, 'OFF-M01' | 'OFF-M02', string, string][] = [
    ['CUS-MOB1', 'Rohit Verma', '+91 98450 77001', 'rohit.verma@mail.example', 'OFF-M01', '2022-06-03', '3381'],
    ['CUS-MOB2', 'Ayesha Siddiqui', '+91 99001 22334', 'ayesha.s@mail.example', 'OFF-M02', '2024-01-19', '9024'],
    ['CUS-MOB3', 'Vivek Nair', '+91 97400 55667', 'vivek.nair@mail.example', 'OFF-M01', '2021-11-27', '6650'],
  ];
  mobileOnly.forEach(([id, name, phone, email, off, since, last4], i) => {
    db.customers.push({ id, tenantId: 'TEN-RES', name, phone, email, createdAt: since, kyc: { status: 'Verified', method: 'Aadhaar OTP eKYC', idType: 'Aadhaar', maskedRef: `XXXX-XXXX-${last4}`, verifiedAt: since, source: off === 'OFF-M01' ? 'Mobile postpaid activation' : 'Mobile prepaid activation' }, consents: [{ purpose: 'Identity verification for telecom services', channel: 'OTP', at: since, capturedBy: 'Self' }] });
    const ba = `BA-71${i}0`;
    db.billingAccounts.push({ id: ba, tenantId: 'TEN-RES', name: `${name} – Mobile`, type: 'Resident', payerRef: { kind: 'customer', id }, currency: 'USD', billCycleDay: 12, paymentMethod: off === 'OFF-M02' ? 'ACH' : 'Card', invoiceDelivery: 'Email', paperless: true, status: 'Active', creditLimit: 5000 });
    S({ offeringId: off, owner: { kind: 'customer', id }, location: `Mobile ${phone}`, billingAccountId: ba, status: 'Active', activationDate: since, mrc: off === 'OFF-M01' ? 599 : 299, equipment: [{ type: '5G SIM', serial: `8991 2310 00${i}5 ${last4}` }] }, 'TEN-RES');
  });
  const snehaSrv = S({ offeringId: 'OFF-R02', owner: { kind: 'customer', id: sneha.id }, unitId: 'PRP-GV-A-104', propertyId: 'PRP-GV', location: 'Green Valley Residences, A-104', billingAccountId: 'BA-7001', status: 'Active', activationDate: '2024-09-02', contractEnd: '2026-12-01', mrc: 999, addOns: ['ADD-OTT'], equipment: [{ type: 'GPON ONT + Wi-Fi 6', serial: 'ONT48213377' }] }, 'TEN-EVG');
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
  // A-101..A-103 vacant + ready so bulk activation has candidates in Tower A.
  for (const n of ['A-103', 'A-105', 'A-201', 'A-202']) {
    clearUnit(`PRP-GV-${n}`);
    GV(n).occupancy = n === 'A-201' ? 'Unknown' : 'Vacant';
  }

  // A-205: occupied by a legacy resident with no KYC yet → demonstrates the KYC gate and "Verify occupant KYC".
  clearUnit('PRP-GV-A-205');
  GV('A-205').occupancy = 'Occupied';
  db.customers.push({ id: 'CUS-LEGACY205', tenantId: 'TEN-RES', name: 'Harish Gowda', email: 'harish.gowda@mail.example', phone: '+91 98861 40205', createdAt: '2019-04-02', kyc: { status: 'Not Started', note: 'Legacy occupant migrated before self-care eKYC' }, consents: [] });
  db.occupancies.push({ id: 'OCC-LEGACY205', unitId: 'PRP-GV-A-205', customerId: 'CUS-LEGACY205', role: 'Owner', validFrom: '2019-04-02' });

  /* ---------------- Invoices & payments ---------------- */
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const costCentre = (s: ServiceInstance) => {
    if (s.unitId) return s.unitId.split('-').slice(2).join('-');
    if (s.owner.kind === 'customer') return 'Mobile';
    if (s.propertyId) return 'Common Areas';
    const acc = db.accounts.find((a) => a.id === s.businessAccountId);
    return acc?.name ?? 'Unallocated';
  };
  const invoiceAccounts = db.billingAccounts.filter((b) => b.type !== 'Aggregator' && (b.type !== 'Resident' || b.id === 'BA-7001' || b.id === 'BA-7002' || rnd() < 0.25));
  for (const ba of invoiceAccounts) {
    // A consolidated account's own invoice only carries services billed directly to it;
    // child accounts invoice separately and roll up in the hierarchy view.
    const srv = db.services.filter((s) => s.billingAccountId === ba.id && s.status !== 'Pending Installation');
    if (!srv.length) continue;
    months.forEach((m, i) => {
      const lines: InvoiceLine[] = srv
        .filter((s) => !s.activationDate || s.activationDate.slice(0, 7) <= m)
        .map((s) => ({ serviceId: s.id, description: off(s.offeringId).name + (s.status === 'Suspended' && i === 5 ? ' (suspended – retention charge)' : ''), costCentre: costCentre(s), amount: s.status === 'Suspended' && i === 5 ? Math.round(s.mrc * 0.2) : s.mrc }));
      if (!lines.length) return;
      const usage = ba.type === 'Resident' ? 0 : Math.round(lines.reduce((a, l) => a + l.amount, 0) * (0.02 + rnd() * 0.05));
      if (usage) lines.push({ description: 'Usage & overage charges', costCentre: lines[0].costCentre, amount: usage });
      const amount = lines.reduce((a, l) => a + l.amount, 0);
      const issue = `${m}-${String(ba.billCycleDay).padStart(2, '0')}`;
      const due = addDays(issue, 21);
      let status: Invoice['status'] = 'Paid';
      if (m === '2026-10') status = 'Open';
      if (m === '2026-09' && (ba.id === 'BA-9100' || ba.id === 'BA-8200')) status = 'Overdue';
      const inv: Invoice = { id: `INV-${ba.id.replace('BA-', '')}-${m.replace('-', '')}`, billingAccountId: ba.id, period: m, issueDate: issue, dueDate: due, amount, status, lines };
      db.invoices.push(inv);
      if (status === 'Paid') {
        const pay: Payment = { id: nid('PAY'), billingAccountId: ba.id, invoiceId: inv.id, date: addDays(issue, 8 + Math.floor(rnd() * 10)), amount, method: ba.paymentMethod, reference: 'UTR' + Math.floor(rnd() * 1e10), simulated: true };
        db.payments.push(pay);
      }
    });
  }

  /* ---------------- Users ---------------- */
  const users: User[] = [
    { id: 'U-100', tenantId: 'TEN-6DGE', name: 'Ananya Rao', email: 'ananya.rao@6dglobal.example', phone: '+91 98450 10001', title: 'Group CIO', roleId: 'ENT_SUPER', scopes: [{ kind: 'account', ref: 'ACC-1000', inherit: true }, { kind: 'billing', ref: 'BA-9000', inherit: true }], status: 'Active', lastLogin: '2026-10-23T08:12:00Z' },
    { id: 'U-101', tenantId: 'TEN-6DGE', name: 'Vikram Shetty', email: 'vikram.shetty@6dglobal.example', phone: '+91 98450 10002', title: 'Head of IT – India', roleId: 'BIZ_ADMIN', scopes: [{ kind: 'account', ref: 'ACC-1100', inherit: true }], status: 'Active', lastLogin: '2026-10-22T16:40:00Z' },
    { id: 'U-102', tenantId: 'TEN-6DGE', name: 'Karthik Reddy', email: 'karthik.reddy@6dglobal.example', phone: '+91 98450 10003', title: 'Site IT Manager (delegated)', roleId: 'BIZ_ADMIN', scopes: [{ kind: 'account', ref: 'ACC-1110', inherit: false }], status: 'Active', lastLogin: '2026-10-21T09:05:00Z' },
    { id: 'U-103', tenantId: 'TEN-6DGE', name: 'Rahul Iyer', email: 'rahul.iyer@6dglobal.example', phone: '+91 98450 10004', title: 'Group Finance Controller', roleId: 'BILLING_ADMIN', scopes: [{ kind: 'billing', ref: 'BA-9000', inherit: true }], status: 'Active', lastLogin: '2026-10-20T11:30:00Z' },
    { id: 'U-104', tenantId: 'TEN-6DGE', name: 'Wei Ling Tan', email: 'weiling.tan@6dglobal.example', phone: '+65 9123 4567', title: 'Country Director', roleId: 'BIZ_ADMIN', scopes: [{ kind: 'account', ref: 'ACC-1200', inherit: true }], status: 'Invited' },
    { id: 'U-200', tenantId: 'TEN-EVG', name: 'Priya Menon', email: 'priya.menon@evergreen-estates.example', phone: '+91 98860 20001', title: 'Property Portfolio Manager', roleId: 'MDU_PM', scopes: [{ kind: 'account', ref: 'ACC-2000', inherit: false }, { kind: 'property', ref: 'PRP-GV', inherit: true }, { kind: 'property', ref: 'PRP-SH', inherit: true }], status: 'Active', lastLogin: '2026-10-23T07:55:00Z' },
    { id: 'U-201', tenantId: 'TEN-EVG', name: 'Farhan Qureshi', email: 'farhan.qureshi@evergreen-estates.example', phone: '+91 98860 20002', title: 'Estate Manager – Sunrise Heights', roleId: 'MDU_PM', scopes: [{ kind: 'account', ref: 'ACC-2000', inherit: false }, { kind: 'property', ref: 'PRP-SH', inherit: true }], status: 'Active', lastLogin: '2026-10-18T10:00:00Z' },
    { id: 'U-300', tenantId: 'TEN-PMH', name: 'Deepa Joshi', email: 'deepa.joshi@palmmeadows.example', phone: '+91 98220 30001', title: 'Estate Manager', roleId: 'MDU_PM', scopes: [{ kind: 'account', ref: 'ACC-3000', inherit: false }, { kind: 'property', ref: 'PRP-PM', inherit: true }], status: 'Active', lastLogin: '2026-10-22T14:20:00Z' },
    { id: 'U-400', tenantId: 'TEN-RES', name: 'Sneha Kulkarni', email: 'sneha.kulkarni@mail.example', phone: '+91 98450 11223', title: 'Resident, Green Valley A-104', roleId: 'RESIDENT', scopes: [{ kind: 'unit', ref: 'PRP-GV-A-104', inherit: false }], customerId: 'CUS-SNEHA', status: 'Active', lastLogin: '2026-10-19T20:10:00Z' },
    { id: 'U-900', tenantId: 'TEN-OPR', name: 'Arjun Nair', email: 'arjun.nair@operator.example', phone: '+91 80 4000 9000', title: 'Operator Administrator', roleId: 'OPERATOR', scopes: [{ kind: 'all', inherit: true }], status: 'Active', lastLogin: '2026-10-23T06:00:00Z' },
  ];
  db.users = users;

  /* ---------------- Requests, appointments, approvals ---------------- */
  const R = (r: Omit<ServiceRequest, 'id' | 'timeline' | 'attachments' | 'slaDue'> & { slaDays?: number; history?: ServiceRequest['status'][] }) => {
    const id = nid('SR');
    const history = r.history ?? [r.status];
    const timeline = history.map((st, i) => ({ at: addDays(r.createdAt, i) + 'T10:00:00Z', status: st, by: i === 0 ? users.find((u) => u.id === r.createdBy)?.name ?? 'System' : r.assignedTeam }));
    const { slaDays, history: _h, ...rest } = r;
    void _h;
    db.requests.push({ ...rest, id, timeline, attachments: [], slaDue: addDays(r.createdAt, slaDays ?? 5) });
    return id;
  };
  R({ tenantId: 'TEN-6DGE', kind: 'Incident', category: 'Network Issue', title: 'Packet loss on Whitefield leased line', description: 'Intermittent 3–5% packet loss during business hours since Monday.', businessAccountId: 'ACC-1110', serviceId: db.services[0].id, priority: 'High', status: 'In Progress', assignedTeam: 'Enterprise NOC', createdBy: 'U-102', createdAt: '2026-10-20', slaDays: 2, history: ['Submitted', 'Validating', 'In Progress'] });
  R({ tenantId: 'TEN-6DGE', kind: 'Service Request', category: 'New Connection', title: 'DIA 500 Mbps for Mumbai Sales Office', description: 'New branch connectivity, BKC G Block.', businessAccountId: 'ACC-1130', priority: 'Medium', status: 'Validating', assignedTeam: 'Enterprise Provisioning', createdBy: 'U-101', createdAt: '2026-10-19', slaDays: 21, history: ['Submitted', 'Validating'] });
  R({ tenantId: 'TEN-6DGE', kind: 'Service Request', category: 'Billing Query', title: 'Clarify usage charges on India Corporate September invoice', description: 'Overage line looks higher than expected.', billingAccountId: 'BA-9100', businessAccountId: 'ACC-1100', priority: 'Medium', status: 'Submitted', assignedTeam: 'Enterprise Billing', createdBy: 'U-103', createdAt: '2026-10-21', slaDays: 5 });
  R({ tenantId: 'TEN-6DGE', kind: 'Service Request', category: 'Plan Change', title: 'Upgrade Hyderabad DIA to 1 Gbps', description: 'Capacity planning for Q1.', businessAccountId: 'ACC-1120', priority: 'Low', status: 'Completed', assignedTeam: 'Enterprise Provisioning', createdBy: 'U-101', createdAt: '2026-08-04', slaDays: 10, history: ['Submitted', 'Validating', 'Approved', 'In Progress', 'Completed'] });
  R({ tenantId: 'TEN-6DGE', kind: 'Service Request', category: 'Service Suspension', title: 'Suspend Facilities fleet IoT pool', description: 'Fleet contract paused.', businessAccountId: 'ACC-1320', priority: 'Low', status: 'Completed', assignedTeam: 'Enterprise Provisioning', createdBy: 'U-100', createdAt: '2026-07-11', history: ['Submitted', 'Approved', 'In Progress', 'Completed'] });
  R({ tenantId: 'TEN-6DGE', kind: 'Service Request', category: 'Account Modification', title: 'Update Singapore registered address', description: 'Registered office move.', businessAccountId: 'ACC-1200', priority: 'Low', status: 'Rejected', assignedTeam: 'Customer Data Management', createdBy: 'U-100', createdAt: '2026-09-02', history: ['Submitted', 'Validating', 'Rejected'] });
  R({ tenantId: 'TEN-6DGE', kind: 'Incident', category: 'Network Issue', title: 'SIP trunk one-way audio – Singapore HQ', description: 'Outbound calls to mobile have one-way audio.', businessAccountId: 'ACC-1210', priority: 'Critical', status: 'Completed', assignedTeam: 'Voice Operations', createdBy: 'U-100', createdAt: '2026-10-02', slaDays: 1, history: ['Submitted', 'In Progress', 'Completed'] });
  const gvRiser = R({ tenantId: 'TEN-EVG', kind: 'Incident', category: 'Property Connectivity Issue', title: 'Tower C riser build – floors 7 to 10', description: 'Fibre riser blocked at floor 7 duct; civil work required before FTTH can reach upper floors.', propertyId: 'PRP-GV', priority: 'High', status: 'In Progress', assignedTeam: 'FTTH Field Engineering', createdBy: 'U-200', createdAt: '2026-10-08', slaDays: 20, history: ['Submitted', 'Validating', 'Approved', 'In Progress'] });
  R({ tenantId: 'TEN-EVG', kind: 'Incident', category: 'Network Issue', title: 'Slow speeds reported in Tower B evenings', description: 'Multiple residents report < 50 Mbps after 8 pm.', propertyId: 'PRP-GV', priority: 'Medium', status: 'Validating', assignedTeam: 'Residential NOC', createdBy: 'U-200', createdAt: '2026-10-21', slaDays: 3, history: ['Submitted', 'Validating'] });
  R({ tenantId: 'TEN-EVG', kind: 'Service Request', category: 'Billing Query', title: 'Bulk contract September invoice overdue – payment in transit', description: 'NEFT initiated 20 Oct; please hold dunning.', propertyId: 'PRP-SH', billingAccountId: 'BA-8200', priority: 'High', status: 'Submitted', assignedTeam: 'Enterprise Billing', createdBy: 'U-201', createdAt: '2026-10-22', slaDays: 2 });
  R({ tenantId: 'TEN-RES', kind: 'Incident', category: 'Network Issue', title: 'Wi-Fi drops in bedroom', description: 'Signal weak in far bedroom; considering mesh add-on.', propertyId: 'PRP-GV', unitId: 'PRP-GV-A-104', serviceId: snehaSrv, priority: 'Low', status: 'In Progress', assignedTeam: 'Residential Support', createdBy: 'U-400', createdAt: '2026-10-17', slaDays: 3, history: ['Submitted', 'In Progress'] });
  R({ tenantId: 'TEN-RES', kind: 'Service Request', category: 'Billing Query', title: 'Duplicate OTT charge in August', description: 'OTT pack billed twice.', propertyId: 'PRP-GV', unitId: 'PRP-GV-A-104', billingAccountId: 'BA-7001', priority: 'Low', status: 'Completed', assignedTeam: 'Residential Billing', createdBy: 'U-400', createdAt: '2026-08-09', history: ['Submitted', 'Validating', 'Completed'] });
  R({ tenantId: 'TEN-PMH', kind: 'Incident', category: 'Property Connectivity Issue', title: 'Towers C & D – OLT port expansion', description: 'Awaiting second OLT card for towers C and D.', propertyId: 'PRP-PM', priority: 'High', status: 'In Progress', assignedTeam: 'FTTH Field Engineering', createdBy: 'U-300', createdAt: '2026-09-28', slaDays: 30, history: ['Submitted', 'Validating', 'Approved', 'In Progress'] });

  // Seeded pending-installation services get matching installation requests & appointments.
  const pendings = db.services.filter((s) => s.status === 'Pending Installation' && s.unitId).slice(0, 12);
  pendings.forEach((s, i) => {
    const prop = db.properties.find((p) => p.id === s.propertyId)!;
    const rid = R({ tenantId: prop.tenantId, kind: 'Service Request', category: 'New Connection', title: `FTTH installation – ${s.location}`, description: 'New residential connection.', propertyId: s.propertyId, unitId: s.unitId, serviceId: s.id, priority: 'Medium', status: 'In Progress', assignedTeam: 'FTTH Field Engineering', createdBy: prop.managerUserId, createdAt: addDays(TODAY, -6 - i), slaDays: 10, history: ['Submitted', 'Validating', 'Approved', 'In Progress'] });
    db.appointments.push({ id: nid('APT'), requestId: rid, unitId: s.unitId, propertyId: s.propertyId, slot: addDays(TODAY, 1 + (i % 6)), window: pick(['09:00–12:00', '12:00–15:00', '15:00–18:00']), technician: pick(['Ravi K.', 'Sunil M.', 'Anil P.', 'Joseph D.']), status: 'Scheduled' });
  });
  db.appointments.push({ id: nid('APT'), requestId: gvRiser, propertyId: 'PRP-GV', slot: '2026-10-27', window: '10:00–17:00', technician: 'Civil crew – Team 3', status: 'Scheduled' });

  const pendingKyc = db.occupancies
    .filter((o) => !o.validTo && o.unitId.startsWith('PRP-GV-'))
    .map((o) => ({ o, c: db.customers.find((c) => c.id === o.customerId)! }))
    .find((x) => x.c.kyc.status === 'Pending Review');
  if (pendingKyc)
    db.approvals.push({ id: nid('APR'), tenantId: 'TEN-EVG', type: 'KYC Document Review', summary: `Verify ${pendingKyc.c.kyc.idType} for ${pendingKyc.c.name} (${pendingKyc.o.unitId.replace('PRP-GV-', 'Green Valley ')})`, target: { kind: 'customer', id: pendingKyc.c.id }, payload: { customerId: pendingKyc.c.id, unitId: pendingKyc.o.unitId, idType: pendingKyc.c.kyc.idType, maskedRef: pendingKyc.c.kyc.maskedRef }, requestedBy: 'U-200', requestedAt: '2026-10-20T11:00:00Z', status: 'Pending' });
  db.approvals.push(
    { id: nid('APR'), tenantId: 'TEN-6DGE', type: 'Create Child Account', summary: 'Create branch "Mumbai Sales Office" under 6D India', target: { kind: 'account', id: 'ACC-1130' }, payload: { accountId: 'ACC-1130' }, requestedBy: 'U-101', requestedAt: '2026-10-19T09:20:00Z', status: 'Pending' },
    { id: nid('APR'), tenantId: 'TEN-6DGE', type: 'Change Billing Responsibility', summary: 'Move Hyderabad Office services from India Corporate Billing to a new site billing account', target: { kind: 'billing', id: 'BA-9100' }, payload: { accountId: 'ACC-1120' }, requestedBy: 'U-103', requestedAt: '2026-10-15T12:00:00Z', status: 'Pending' },
    { id: nid('APR'), tenantId: 'TEN-6DGE', type: 'Move Child Account', summary: 'Move "IT Operations" from 6D Shared Services to 6D India', target: { kind: 'account', id: 'ACC-1310' }, payload: { accountId: 'ACC-1310', newParentId: 'ACC-1100' }, requestedBy: 'U-101', requestedAt: '2026-09-01T09:00:00Z', status: 'Rejected', decidedBy: 'U-100', decidedAt: '2026-09-02T10:00:00Z', decisionNote: 'IT Ops stays global; revisit in FY27 planning.' },
    { id: nid('APR'), tenantId: 'TEN-EVG', type: 'Reassign Property Administrator', summary: 'Add Farhan Qureshi as administrator for Sunrise Heights', target: { kind: 'property', id: 'PRP-SH' }, payload: { userId: 'U-201' }, requestedBy: 'U-200', requestedAt: '2026-06-10T09:00:00Z', status: 'Approved', decidedBy: 'U-900', decidedAt: '2026-06-11T09:00:00Z' },
  );

  const AU = (tenantId: string, at: string, actor: string, action: string, kind: string, id: string, detail: string) => db.audit.push({ id: nid('AUD'), tenantId, at, actor, action, entity: { kind, id }, detail });
  AU('TEN-6DGE', '2026-10-19T09:20:00Z', 'Vikram Shetty', 'Account created (pending approval)', 'account', 'ACC-1130', 'Branch under 6D India');
  AU('TEN-6DGE', '2026-10-15T12:00:00Z', 'Rahul Iyer', 'Approval requested', 'billing', 'BA-9100', 'Change billing responsibility for Hyderabad Office');
  AU('TEN-6DGE', '2026-09-02T10:00:00Z', 'Ananya Rao', 'Approval rejected', 'account', 'ACC-1310', 'Move IT Operations → 6D India');
  AU('TEN-6DGE', '2026-07-11T10:00:00Z', 'Ananya Rao', 'Service suspended', 'account', 'ACC-1320', 'IoT Fleet Connect suspended');
  AU('TEN-6DGE', '2026-05-20T10:00:00Z', 'Ananya Rao', 'Account status changed', 'account', 'ACC-1320', 'Active → Suspended');
  AU('TEN-6DGE', '2024-03-01T10:00:00Z', 'Ananya Rao', 'Account created', 'account', 'ACC-1300', 'Department under 6D Global Enterprises');
  AU('TEN-EVG', '2026-10-08T10:00:00Z', 'Priya Menon', 'Ticket raised', 'property', 'PRP-GV', 'Tower C riser build');
  AU('TEN-EVG', '2026-06-11T09:00:00Z', 'Arjun Nair', 'Administrator assigned', 'property', 'PRP-SH', 'Farhan Qureshi added');
  AU('TEN-PMH', '2025-01-12T10:00:00Z', 'Arjun Nair', 'Property registered', 'property', 'PRP-PM', '4 towers, 240 units');

  db.seq = seq;
  return db;
}
