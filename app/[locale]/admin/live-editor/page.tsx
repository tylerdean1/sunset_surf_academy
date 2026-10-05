import AdminLiveEditor from '@/components/admin/AdminLiveEditor';
import ContentBundleProvider from '@/components/content/ContentBundleContext';
import { AdminNotAuthorized, AdminShell } from '@/components/admin/AdminAuthShell';
import { isAdminRequest } from '@/lib/adminAuth';

export default async function AdminLiveEditorPage({ params }: { params: Promise<{ locale: string }> }) {
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
                <AdminLiveEditor />
            </AdminShell>
        </ContentBundleProvider>
    );
}
