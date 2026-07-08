import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import DocumentationPage from './pages/DocumentationPage';

// Forces a full remount when navigating between different PO IDs (new vs edit)
function BuyerPOEditorPageKeyed() {
  const { id } = useParams();
  return <BuyerPOEditorPage key={id} />;
}

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <PrivateRoute>
                  <Layout>
                    <Customers />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/orders/pi/:id/view"
              element={
                <PrivateRoute>
                  <Layout>
                    <PIViewPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PrivateRoute>
                  <Layout>
                    <Orders />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/indents"
              element={
                <PrivateRoute>
                  <Layout>
                    <Indents />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/indents/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <IndentEditorPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/trims"
              element={
                <PrivateRoute>
                  <Layout>
                    <TrimsLibraryPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <PrivateRoute>
                  <Layout>
                    <SuppliersPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <PrivateRoute>
                  <Layout>
                    <Inventory />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/sales/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <SalesEntryEditorPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <PrivateRoute>
                  <Layout>
                    <SalesEntries />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/purchase-bills/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <PurchaseBillEditorPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/purchase-bills"
              element={
                <PrivateRoute>
                  <Layout>
                    <PurchaseBills />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/procurement/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <SupplierPOEditorPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/procurement"
              element={
                <PrivateRoute>
                  <Layout>
                    <Procurement />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/production"
              element={
                <PrivateRoute>
                  <Layout>
                    <Production />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/company"
              element={
                <PrivateRoute>
                  <Layout>
                    <CompanyPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/buyer-pos"
              element={
                <PrivateRoute>
                  <Layout>
                    <BuyerPOs />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/buyer-pos/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <BuyerPOEditorPageKeyed />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/buyer-pos/:id/generate-pi"
              element={
                <PrivateRoute>
                  <Layout>
                    <GeneratePIPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/documentation"
              element={
                <PrivateRoute>
                  <Layout>
                    <DocumentationPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute module="users">
                  <Layout>
                    <UsersPage />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
