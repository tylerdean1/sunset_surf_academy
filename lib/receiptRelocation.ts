type Operations = {
    copy: () => Promise<void>;
    update: () => Promise<void>;
    removeNew: () => Promise<void>;
    removeOld: () => Promise<void>;
};

export async function relocateReceipt(ops: Operations): Promise<{ warning?: string }> {
    await ops.copy();
    try {
        await ops.update();
    } catch (error) {
        try {
            await ops.removeNew();
        } catch (cleanupError) {
            const message = error instanceof Error ? error.message : 'Receipt update failed';
            const cleanup = cleanupError instanceof Error ? cleanupError.message : 'Cleanup failed';
            throw new Error(`${message}. Original receipt retained; copied file cleanup failed: ${cleanup}`);
        }
        throw error;
    }

    try {
        await ops.removeOld();
        return {};
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Cleanup failed';
        return { warning: `Receipt saved. The previous file could not be removed: ${message}` };
    }
}
