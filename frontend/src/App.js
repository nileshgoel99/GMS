import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useParams,
} from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appTheme } from './theme/appTheme';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import PIViewPage from './pages/PIViewPage';
import Inventory from './pages/Inventory';
import Procurement from './pages/Procurement';
import SupplierPOEditorPage from './pages/SupplierPOEditorPage';
import PurchaseBills from './pages/PurchaseBills';
import PurchaseBillEditorPage from './pages/PurchaseBillEditorPage';
import SalesEntries from './pages/SalesEntries';
import SalesEntryEditorPage from './pages/SalesEntryEditorPage';
import Production from './pages/Production';
import Cuttings from './pages/Cuttings';
import CuttingEditorPage from './pages/CuttingEditorPage';
import Indents from './pages/Indents';
import IndentEditorPage from './pages/IndentEditorPage';
import TrimsLibraryPage from './pages/TrimsLibraryPage';
import SuppliersPage from './pages/SuppliersPage';
import CompanyPage from './pages/CompanyPage';
import BuyerPOs from './pages/BuyerPOs';
import BuyerPOEditorPage from './pages/BuyerPOEditorPage';
import GeneratePIPage from './pages/GeneratePIPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import DocumentationRoute from './components/DocumentationRoute';
import TicketsPage from './pages/TicketsPage';

import LandingPage from './pages/LandingPage';

// Forces a full remount when navigating between different PO IDs (new vs edit)
function BuyerPOEditorPageKeyed() {
  const { id } = useParams();
  return <BuyerPOEditorPage key={id} />;
}

function ProtectedLayout() {
  return (
    <PrivateRoute>
      <Layout />
    </PrivateRoute>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <Login /> },
  { path: '/documentation', element: <DocumentationRoute /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'customers', element: <Customers /> },
      { path: 'orders/pi/:id/view', element: <PIViewPage /> },
      { path: 'orders', element: <Orders /> },
      { path: 'indents', element: <Indents /> },
      { path: 'indents/:id', element: <IndentEditorPage /> },
      { path: 'trims', element: <TrimsLibraryPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'sales/:id', element: <SalesEntryEditorPage /> },
      { path: 'sales', element: <SalesEntries /> },
      { path: 'purchase-bills/:id', element: <PurchaseBillEditorPage /> },
      { path: 'purchase-bills', element: <PurchaseBills /> },
      { path: 'procurement/:id', element: <SupplierPOEditorPage /> },
      { path: 'procurement', element: <Procurement /> },
      { path: 'production/cutting/new', element: <CuttingEditorPage /> },
      { path: 'production/cutting/:id', element: <CuttingEditorPage /> },
      { path: 'production/cutting', element: <Cuttings /> },
      { path: 'production', element: <Production /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'buyer-pos', element: <BuyerPOs /> },
      { path: 'buyer-pos/:id', element: <BuyerPOEditorPageKeyed /> },
      { path: 'buyer-pos/:id/generate-pi', element: <GeneratePIPage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        path: 'users',
        element: (
          <PrivateRoute module="users">
            <UsersPage />
          </PrivateRoute>
        ),
      },
      {
        path: 'tickets',
        element: (
          <PrivateRoute adminOnly>
            <TicketsPage />
          </PrivateRoute>
        ),
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
