import { Container } from '@mui/material';
import MediaUpload from '@/components/admin/MediaUpload';
import { isAdminRequest } from '@/lib/adminAuth';
import ContentBundleProvider from '@/components/content/ContentBundleContext';
import { AdminNotAuthorized } from '@/components/admin/AdminAuthShell';
import { AdminMediaUploadShell } from '@/components/admin/AdminMediaUploadShell';

export default async function AdminMediaUploadPage({ params }: { params: Promise<{ locale: string }> }) {
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
            <AdminMediaUploadShell locale={locale}>
                <Container maxWidth="lg" sx={{ py: 6 }}>
                    <MediaUpload />
                </Container>
            </AdminMediaUploadShell>
        </ContentBundleProvider>
    );
}
