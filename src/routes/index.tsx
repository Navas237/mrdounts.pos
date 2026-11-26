import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PageSkeleton } from '@/components/ui/Skeleton';

// Lazy loading all pages for optimal performance and smaller initial bundle size
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Cashier = lazy(() => import('@/pages/Cashier').then((m) => ({ default: m.Cashier })));
const WaffleKitchen = lazy(() =>
  import('@/pages/kitchen/WaffleKitchen').then((m) => ({ default: m.WaffleKitchen }))
);
const DrinksKitchen = lazy(() =>
  import('@/pages/kitchen/DrinksKitchen').then((m) => ({ default: m.DrinksKitchen }))
);
const DonutsKitchen = lazy(() =>
  import('@/pages/kitchen/DonutsKitchen').then((m) => ({ default: m.DonutsKitchen }))
);
const DonutsToppingKitchen = lazy(() =>
  import('@/pages/kitchen/DonutsToppingKitchen').then((m) => ({ default: m.DonutsToppingKitchen }))
);
const DonutsInjectionKitchen = lazy(() =>
  import('@/pages/kitchen/DonutsInjectionKitchen').then((m) => ({ default: m.DonutsInjectionKitchen }))
);
const Pickup = lazy(() => import('@/pages/Pickup').then((m) => ({ default: m.Pickup })));
const Admin = lazy(() => import('@/pages/Admin').then((m) => ({ default: m.Admin })));
const Shifts = lazy(() => import('@/pages/Shifts').then((m) => ({ default: m.Shifts })));
const Customers = lazy(() => import('@/pages/Customers').then((m) => ({ default: m.Customers })));
const Orders = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.Orders })));
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Unauthorized = lazy(() =>
  import('@/pages/Unauthorized').then((m) => ({ default: m.Unauthorized }))
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route
            path="cashier"
            element={
              <ProtectedRoute requiredScreen="screen.cashier">
                <Cashier />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen/waffle"
            element={
              <ProtectedRoute requiredDeptId="d-waffle">
                <WaffleKitchen />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen/drinks"
            element={
              <ProtectedRoute requiredDeptId="d-drinks">
                <DrinksKitchen />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen/donuts"
            element={
              <ProtectedRoute requiredDeptId="d-donuts">
                <DonutsKitchen />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen/donuts-topping"
            element={
              <ProtectedRoute requiredDeptId="d-donuts">
                <DonutsToppingKitchen />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen/donuts-injection"
            element={
              <ProtectedRoute requiredDeptId="d-donuts">
                <DonutsInjectionKitchen />
              </ProtectedRoute>
            }
          />

          <Route
            path="pickup"
            element={
              <ProtectedRoute requiredScreen="screen.pickup">
                <Pickup />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin"
            element={
              <ProtectedRoute requiredScreen="screen.admin">
                <Admin />
              </ProtectedRoute>
            }
          />

          <Route
            path="shifts"
            element={
              <ProtectedRoute requiredScreen="screen.drawer">
                <Shifts />
              </ProtectedRoute>
            }
          />

          <Route
            path="customers"
            element={
              <ProtectedRoute requiredScreen="screen.customers">
                <Customers />
              </ProtectedRoute>
            }
          />

          <Route
            path="orders"
            element={
              <ProtectedRoute requiredScreen="screen.orders">
                <Orders />
              </ProtectedRoute>
            }
          />

          <Route
            path="reports"
            element={
              <ProtectedRoute requiredScreen="screen.reports">
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route path="unauthorized" element={<Unauthorized />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
