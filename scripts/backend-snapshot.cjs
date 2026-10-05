/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, loadEnv, run, parseSchemas, projectRef, readSchema, generateBaseline, atomicWrite } = require('./backend-schema.cjs');

function main() {
    loadEnv();
    const args = process.argv.slice(2);
    const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
    const out = option('--out-dir') ? path.resolve(ROOT, option('--out-dir')) : ROOT;
    const schemas = parseSchemas(option('--schema') || process.env.SUPABASE_SNAPSHOT_SCHEMA || 'public');
    const typesPath = path.join(ROOT, 'lib', 'database.types.ts');
    if (!args.includes('--reuse-types')) run(process.execPath, [path.join(ROOT, 'scripts', 'typegen.cjs')], 'Supabase type generation');
    if (!fs.existsSync(typesPath)) throw new Error('Generated types are missing. Run npm run typegen first.');
    const types = fs.readFileSync(typesPath, 'utf8');
    console.log(`Capturing a schema-only snapshot for ${schemas.join(', ')} using local PostgreSQL tools.`);
    const { sql, metadata } = readSchema(schemas);
    metadata.generated_at = new Date().toISOString();
    metadata.project_ref = projectRef();
    metadata.sha256 = crypto.createHash('sha256').update(sql).digest('hex');
    const md = `# Backend Snapshot\n\nGenerated: ${metadata.generated_at}\n\nApplication schemas: ${schemas.join(', ')}\nPostgreSQL: ${metadata.server_version}\nSchema SHA256: ${metadata.sha256}\n\nThe SQL dump contains schema only, including tables, functions, types, policies and grants. No table records, auth users, vault secrets or storage objects are dumped. The generated baseline in supabase/baseline.sql is for a fresh Supabase database; see docs/database-bootstrap.md.\n\n## Generated Types\n\n\`\`\`ts\n${types.trim()}\n\`\`\`\n`;
    atomicWrite(path.join(out, 'backend.snapshot.sql'), sql);
    atomicWrite(path.join(out, 'backend.snapshot.catalog.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    atomicWrite(path.join(out, 'backend.snapshot.md'), md);
    if (out === ROOT) {
        atomicWrite(path.join(ROOT, 'supabase', 'baseline.sql'), generateBaseline(sql, metadata));
        atomicWrite(path.join(ROOT, 'supabase', 'baseline.metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    }
    console.log(`Generated schema snapshot and baseline: ${metadata.policies.length} policies, ${metadata.extensions.length} extension requirements.`);
}

try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : 'Backend snapshot failed.');
    process.exitCode = 1;
}
