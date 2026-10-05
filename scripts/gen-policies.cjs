/* eslint-env node */
const path = require('node:path');
const { ROOT, readSnapshot, atomicWrite } = require('./backend-schema.cjs');

function generateTypescript(policies) {
    const values = policies.map((policy) => ({
        schemaname: policy.schemaname,
        tablename: policy.tablename,
        policyname: policy.policyname,
        permissive: policy.permissive === true || policy.permissive === 'PERMISSIVE',
        roles: policy.roles,
        cmd: policy.cmd,
        qual: policy.qual,
        with_check: policy.with_check,
    }));
    return `// AUTO-GENERATED — DO NOT EDIT. Run npm run gen:policies\n\nexport interface Policy {\n  schemaname: string;\n  tablename: string;\n  policyname: string;\n  permissive: boolean;\n  roles: string[];\n  cmd: string;\n  qual: string | null;\n  with_check: string | null;\n}\n\nexport const POLICIES: Policy[] = ${JSON.stringify(values, null, 2)};\n`;
}

function main() {
    try {
        const { catalog } = readSnapshot();
        if (!Array.isArray(catalog.policies)) throw new Error('Snapshot catalog has no policy inventory.');
        atomicWrite(path.join(ROOT, 'lib', 'database.policies.ts'), generateTypescript(catalog.policies));
        console.log(`Generated policy definitions from the database catalog: ${catalog.policies.length} policies.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'Policy generation failed.');
        process.exitCode = 1;
    }
}

module.exports = { generateTypescript, main };
if (require.main === module) main();
