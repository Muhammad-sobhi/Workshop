import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Lazy loaded page components for optimal bundle splitting
const LoginPage = lazy(() => import('./pages/login/page'));
const DashboardPage = lazy(() => import('./pages/dashboard/page'));
const WarehousesPage = lazy(() => import('./pages/warehouses/page'));
const InventoryPage = lazy(() => import('./pages/inventory/page'));
const MovementsPage = lazy(() => import('./pages/inventory/movements/page'));
const LedgerPage = lazy(() => import('./pages/inventory/ledger/detail/page'));
const MaterialsPage = lazy(() => import('./pages/materials/page'));
const ProductsPage = lazy(() => import('./pages/products/page'));
const CategoriesPage = lazy(() => import('./pages/categories/page'));
const SuppliersPage = lazy(() => import('./pages/suppliers/page'));
const ProcurementPage = lazy(() => import('./pages/procurement/page'));
const ProductionPage = lazy(() => import('./pages/production/page'));
const SalesPage = lazy(() => import('./pages/sales/page'));
const ExpensesPage = lazy(() => import('./pages/expenses/page'));
const AccountsPage = lazy(() => import('./pages/accounts/page'));
const ExternalServicesPage = lazy(() => import('./pages/external-services/page'));
const SettingsPage = lazy(() => import('./pages/settings/page'));
const ProfilePage = lazy(() => import('./pages/profile/page'));

function LoadingFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center text-sm font-semibold select-none"
      style={{ background: '#201A30', color: '#D4CEEB' }}
    >
      جاري التحميل...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Main Routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/movements" element={<MovementsPage />} />
          <Route path="/inventory/ledger/:type/:id" element={<LedgerPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/procurement" element={<ProcurementPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/external-services" element={<ExternalServicesPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
