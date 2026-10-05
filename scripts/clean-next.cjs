/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function resolveDistDir() {
    // Keep in sync with next.config.js getDistDir(): default is .next
    const distDir = process.env.NEXT_DIST_DIR || '.next';
    const workspace = path.resolve(process.cwd());
    const target = path.resolve(workspace, distDir);
    const relative = path.relative(workspace, target);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        throw new Error('NEXT_DIST_DIR must resolve to a build directory inside the workspace');
    }
    return target;
}

async function rm(targetPath) {
    try {
        await fs.promises.rm(targetPath, { recursive: true, force: true, maxRetries: 3 });
    } catch (err) {
        // As a last resort on Windows/OneDrive, try a rename then delete.
        try {
            const renamed = `${targetPath}__old__${Date.now()}`;
            await fs.promises.rename(targetPath, renamed);
            await fs.promises.rm(renamed, { recursive: true, force: true, maxRetries: 3 });
        } catch (err2) {
            console.warn('[clean-next] failed:', err2?.message || String(err2));
            process.exitCode = 0;
        }
    }
}

(async () => {
    const dist = resolveDistDir();
    await rm(dist);
    console.log(`[clean-next] removed ${dist}`);
})();
