import React from 'react';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import PublicDocsLayout from './PublicDocsLayout';
import DocumentationPage from '../pages/DocumentationPage';

/** Public docs for guests; full app shell when already signed in. */
export default function DocumentationRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <PublicDocsLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      </PublicDocsLayout>
    );
  }

  if (isAuthenticated) {
    return (
      <Layout>
        <DocumentationPage />
      </Layout>
    );
  }

  return (
    <PublicDocsLayout isAuthenticated={false}>
      <DocumentationPage />
    </PublicDocsLayout>
  );
}
