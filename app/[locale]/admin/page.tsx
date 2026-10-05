import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { isAdminRequest } from '@/lib/adminAuth';
import ContentBundleProvider from '@/components/content/ContentBundleContext';
import { AdminNotAuthorized, AdminShell } from '@/components/admin/AdminAuthShell';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAdmin = await isAdminRequest();

  if (!isAdmin) {
    return (
      <ContentBundleProvider prefix="admin.">
        <AdminNotAuthorized locale={locale} />
      </ContentBundleProvider>
    );
  }

  return (
    <ContentBundleProvider prefix="admin.">
      <AdminShell>
        <AdminDashboard />
      </AdminShell>
    </ContentBundleProvider>
  );
}
