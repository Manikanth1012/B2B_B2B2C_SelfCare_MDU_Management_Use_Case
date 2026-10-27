import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Fragment, type ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { AccountsList } from './pages/accounts/AccountsList';
import { Hierarchy } from './pages/accounts/Hierarchy';
import { AccountDetail } from './pages/accounts/AccountDetail';
import { CreateChild } from './pages/accounts/CreateChild';
import { Contacts } from './pages/accounts/Contacts';
import { Portfolio } from './pages/mdu/Portfolio';
import { RegisterMdu } from './pages/mdu/RegisterMdu';
import { PropertyDetail } from './pages/mdu/PropertyDetail';
import { UnitsExplorer } from './pages/mdu/UnitsExplorer';
import { Occupancy } from './pages/mdu/Occupancy';
import { PhoneNumbers } from './pages/mdu/PhoneNumbers';
import { AddonsManagement } from './pages/mdu/AddonsManagement';
import { BulkImport } from './pages/mdu/BulkImport';
import { MyHome } from './pages/mdu/MyHome';
import { ServicesList } from './pages/services/ServicesList';
import { ServiceDetail } from './pages/services/ServiceDetail';
import { Availability } from './pages/services/Availability';
import { NewConnection } from './pages/services/NewConnection';
import { PlanChanges } from './pages/services/PlanChanges';
import { BulkActivation } from './pages/services/BulkActivation';
import { OrderTracking } from './pages/services/OrderTracking';
import { Orders } from './pages/services/Orders';
import { BillingOverview } from './pages/billing/BillingOverview';
import { BillingHierarchy } from './pages/billing/BillingHierarchy';
import { CostAllocation } from './pages/billing/CostAllocation';
import { Preferences } from './pages/billing/Preferences';
import { RequestsList } from './pages/requests/RequestsList';
import { RequestDetail } from './pages/requests/RequestDetail';
import { NewRequest } from './pages/requests/NewRequest';
import { Appointments } from './pages/requests/Appointments';
import { UsersPage } from './pages/users/UsersPage';
import { RolesPage } from './pages/users/RolesPage';
import { Approvals } from './pages/users/Approvals';
import { Reports } from './pages/Reports';
import { AccountSettings, Profile } from './pages/settings/Profile';
import { Login } from './pages/Login';
import { Guide } from './pages/Guide';
import { NotificationsSettings } from './pages/settings/NotificationsSettings';
import { AuditHistory } from './pages/settings/AuditHistory';

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Layout>
          <Boundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/home" element={<MyHome />} />
            <Route path="/accounts" element={<AccountsList />} />
            <Route path="/accounts/hierarchy" element={<Hierarchy />} />
            <Route path="/accounts/new" element={<Fresh><CreateChild /></Fresh>} />
            <Route path="/accounts/contacts" element={<Contacts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/mdu" element={<Portfolio />} />
            <Route path="/mdu/new" element={<RegisterMdu />} />
            <Route path="/mdu/units" element={<UnitsExplorer />} />
            <Route path="/mdu/occupancy" element={<Occupancy />} />
            <Route path="/mdu/phone-numbers" element={<PhoneNumbers />} />
            <Route path="/mdu/addons" element={<AddonsManagement />} />
            <Route path="/mdu/import" element={<Fresh><BulkImport /></Fresh>} />
            <Route path="/mdu/:id" element={<PropertyDetail />} />
            <Route path="/services" element={<ServicesList />} />
            <Route path="/services/availability" element={<Fresh><Availability /></Fresh>} />
            <Route path="/services/new" element={<Fresh><NewConnection /></Fresh>} />
            <Route path="/services/changes" element={<PlanChanges />} />
            <Route path="/services/bulk" element={<Fresh><BulkActivation /></Fresh>} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/services/orders/:id" element={<OrderTracking />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            <Route path="/billing" element={<BillingOverview />} />
            <Route path="/billing/hierarchy" element={<BillingHierarchy />} />
            <Route path="/billing/invoices" element={<ToTab tab="invoices" />} />
            <Route path="/billing/allocation" element={<CostAllocation />} />
            <Route path="/billing/payments" element={<ToTab tab="payments" />} />
            <Route path="/billing/preferences" element={<Preferences />} />
            <Route path="/requests" element={<RequestsList />} />
            <Route path="/requests/new" element={<Fresh><NewRequest /></Fresh>} />
            <Route path="/requests/appointments" element={<Appointments />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/roles" element={<RolesPage />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Profile />} />
            <Route path="/settings/account" element={<AccountSettings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/settings/notifications" element={<NotificationsSettings />} />
            <Route path="/settings/audit" element={<AuditHistory />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Boundary>
        </Layout>
      </ToastProvider>
    </HashRouter>
  );
}

function Boundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <ErrorBoundary key={loc.pathname}>{children}</ErrorBoundary>;
}

/** Wizards restart when re-opened with different query parameters (e.g. another unit). */
function Fresh({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <Fragment key={loc.search}>{children}</Fragment>;
}

/** Old Invoices / Payments URLs now open the matching tab of Bills & Payments (single source). */
function ToTab({ tab }: { tab: string }) {
  const loc = useLocation();
  const q = new URLSearchParams(loc.search);
  q.set('tab', tab);
  return <Navigate to={`/billing?${q.toString()}`} replace />;
}

