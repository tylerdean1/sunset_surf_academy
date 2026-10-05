import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/adminAuth';
import { relocateReceipt } from '@/lib/receiptRelocation';
import { rpc } from '@/lib/rpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOLDERS: Record<string, string> = {
    fuel: 'Fuel', equipment: 'Equipment', advertising: 'Advertising', lessons: 'Lessons',
    food: 'Food', software: 'Software', payroll: 'Payroll', other: 'Other',
};

export async function POST(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: 'Expected JSON body' }, { status: 400 });
    }

    const bucket = String(body?.bucket || '').trim();
    const fromPath = String(body?.fromPath || '').trim();
    const toPath = String(body?.toPath || '').trim();
    const receiptId = String(body?.receiptId || '').trim();
    const category = String(body?.category || '').trim();

    if (!bucket) return NextResponse.json({ ok: false, message: 'Missing bucket' }, { status: 400 });
    if (!fromPath) return NextResponse.json({ ok: false, message: 'Missing fromPath' }, { status: 400 });
    if (!toPath) return NextResponse.json({ ok: false, message: 'Missing toPath' }, { status: 400 });
    if (!receiptId) return NextResponse.json({ ok: false, message: 'Missing receiptId' }, { status: 400 });
    if (bucket !== 'Finances' || !FOLDERS[category] || !toPath.startsWith(`${FOLDERS[category]}/`) ||
        [fromPath, toPath].some((path) => path.startsWith('/') || path.includes('\\') || path.split('/').includes('..'))) {
        return NextResponse.json({ ok: false, message: 'Invalid receipt destination' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const storage = supabase.storage.from(bucket);
    const oldStoragePath = `${bucket}/${fromPath}`;
    const newStoragePath = `${bucket}/${toPath}`;
    const { data: receipt, error: receiptError } = await supabase.from('receipts').select('id,receipt_storage_path').eq('id', receiptId).maybeSingle();
    if (receiptError) return NextResponse.json({ ok: false, message: receiptError.message }, { status: 500 });
    if (!receipt || receipt.receipt_storage_path !== oldStoragePath) {
        return NextResponse.json({ ok: false, message: 'Receipt changed. Reload before moving its file.' }, { status: 409 });
    }
    try {
        const update = async () => {
            await rpc(supabase, 'admin_relocate_receipt', {
                p_id: receiptId,
                p_expected_path: oldStoragePath,
                p_new_path: newStoragePath,
                p_category: category,
            });
        };
        if (fromPath === toPath) {
            await update();
            return NextResponse.json({ ok: true, storagePath: newStoragePath });
        }
        const result = await relocateReceipt({
            copy: async () => {
                const { error } = await storage.copy(fromPath, toPath);
                if (error) throw new Error(error.message);
            },
            update,
            removeNew: async () => {
                const { error } = await storage.remove([toPath]);
                if (error) throw new Error(error.message);
            },
            removeOld: async () => {
                // A shared object must remain for any other receipt still referencing it.
                const { data, error: referenceError } = await supabase.from('receipts').select('id')
                    .eq('receipt_storage_path', oldStoragePath).limit(1);
                if (referenceError) throw new Error(referenceError.message);
                if (data?.length) return;
                const { error } = await storage.remove([fromPath]);
                if (error) throw new Error(error.message);
            },
        });
        return NextResponse.json({ ok: true, storagePath: newStoragePath, ...result });
    } catch (error) {
        return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Receipt move failed' }, { status: 500 });
    }
}
