import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { appTheme } from './theme/appTheme';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import PiEditorPage from './pages/PiEditorPage';
import Inventory from './pages/Inventory';
import Procurement from './pages/Procurement';
import Production from './pages/Production';
import Intents from './pages/Intents';
import IntentEditorPage from './pages/IntentEditorPage';
import CompanyPage from './pages/CompanyPage';

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
              path="/orders/pi/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <PiEditorPage />
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
              path="/intents"
              element={
                <PrivateRoute>
                  <Layout>
                    <Intents />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/intents/:id"
              element={
                <PrivateRoute>
                  <Layout>
                    <IntentEditorPage />
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
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
