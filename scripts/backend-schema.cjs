/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
    const explicit = process.env.ENV_PATH;
    const files = explicit ? [path.resolve(ROOT, explicit)] : [path.join(ROOT, '.env.local'), path.join(ROOT, '.env')];
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        if (typeof process.loadEnvFile === 'function') process.loadEnvFile(file);
        else require('dotenv').config({ path: file, quiet: true });
    }
}

function run(command, args, label, env = process.env) {
    const result = spawnSync(command, args, {
        cwd: ROOT, env, encoding: 'utf8', shell: false, windowsHide: true,
        timeout: 120000, maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
        const detail = result.error?.code || `exit ${result.status}`;
        const stderr = String(result.stderr || '');
        const recognized = [
            ['password authentication failed', 'database authentication failed'],
            ['server version mismatch', 'pg_dump must support the server PostgreSQL version'],
            ['could not translate host name', 'database hostname could not be resolved'],
            ['connection refused', 'database connection refused'],
            ['timeout', 'database connection timed out'],
            ['Cannot connect to the Docker daemon', 'Docker daemon is unavailable'],
            ['Access token not provided', 'Supabase CLI login is required'],
        ].find(([pattern]) => stderr.includes(pattern));
        // Never echo the CLI dry-run script. PostgreSQL diagnostics are redacted before use.
        const diagnostic = label === 'Linked database connection' ? '' : redactDiagnostic(stderr, env);
        throw new Error(`${label} failed (${detail})${recognized ? `: ${recognized[1]}` : ''}.${diagnostic ? ` ${diagnostic}` : ''}`);
    }
    return String(result.stdout || '');
}

function redactDiagnostic(text, env) {
    let output = String(text || '');
    for (const [name, value] of Object.entries(env)) {
        if (/(?:KEY|PASSWORD|TOKEN|SECRET|DATABASE_URL|SUPABASE_DB_URL)$/.test(name) || ['PGUSER', 'PGHOST'].includes(name)) {
            if (value && value.length >= 4) output = output.split(value).join('[REDACTED]');
        }
    }
    return output.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DB_URL]').trim().slice(0, 1600);
}

function parseConnectionScript(script) {
    const connection = {};
    for (const line of script.split(/\r?\n/)) {
        const match = /^export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|PGSSLMODE)=(.*)$/.exec(line.trim());
        if (!match) continue;
        const [, key, assignment] = match;
        let value;
        if (assignment.startsWith("'") && assignment.endsWith("'")) {
            value = assignment.slice(1, -1);
            if (value.includes("'")) throw new Error('Unsupported quoted connection export.');
        } else if (assignment.startsWith('"') && assignment.endsWith('"')) {
            const inner = assignment.slice(1, -1);
            if (/(^|[^\\])[$`]/.test(inner)) throw new Error('Dynamic connection exports are unsupported.');
            value = inner.replace(/\\([\\"$`])/g, '$1');
        } else {
            if (!/^[a-zA-Z0-9._:-]+$/.test(assignment)) throw new Error('Unsupported connection export.');
            value = assignment;
        }
        connection[key] = value;
    }
    for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
        if (!connection[key]) throw new Error(`Supabase CLI dry-run did not provide ${key}.`);
    }
    // CLI credentials are a temporary login. Preserve the role selected by its own dump script.
    const role = script.match(/--role(?:=|\s+)["']?([A-Za-z_][A-Za-z0-9_]*)/);
    if (role) connection.PGOPTIONS = `-c role=${role[1]}`;
    return connection;
}

function databaseUrlEnv(raw) {
    const url = new URL(raw);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected a PostgreSQL DATABASE_URL.');
    const connection = {
        PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)) || 'postgres',
        PGSSLMODE: url.searchParams.get('sslmode') || 'require',
    };
    if (!connection.PGHOST || !connection.PGUSER) throw new Error('DATABASE_URL is missing its host or user.');
    return connection;
}

function projectRef() {
    const env = process.env;
    const explicit = env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_ID;
    if (explicit) return explicit;
    const raw = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    if (!raw) return '';
    const url = new URL(raw);
    return url.hostname.endsWith('.supabase.co') ? url.hostname.split('.')[0] : '';
}

function connectionEnv() {
    const raw = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (raw) return { ...process.env, ...databaseUrlEnv(raw), PGCONNECT_TIMEOUT: '20' };
    const file = path.join(ROOT, 'supabase', '.temp', 'project-ref');
    if (!fs.existsSync(file)) throw new Error('No DATABASE_URL and no linked Supabase project. Run supabase link for the intended project.');
    const linked = fs.readFileSync(file, 'utf8').trim();
    const expected = projectRef();
    if (expected && linked !== expected) throw new Error('Linked Supabase project does not match the application project.');
    const script = run('supabase', ['db', 'dump', '--linked', '--dry-run', '--schema', 'public', '--log-level', 'error'], 'Linked database connection');
    return { ...process.env, ...parseConnectionScript(script), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '20' };
}

function parseSchemas(raw) {
    const schemas = [...new Set(String(raw || 'public').split(',').map((schema) => schema.trim()).filter(Boolean))];
    if (!schemas.length || schemas.some((schema) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema))) {
        throw new Error('Snapshot schemas must be comma-separated PostgreSQL identifiers.');
    }
    if (schemas.some((schema) => ['auth', 'storage', 'vault', 'supabase_migrations'].includes(schema))) {
        throw new Error('Snapshot the application schemas only; Supabase manages auth, storage, vault and migration history.');
    }
    return schemas;
}

function readSchema(schemas) {
    const env = connectionEnv();
    const sql = run('pg_dump', ['--schema-only', '--no-owner', '--no-password', ...schemas.map((schema) => `--schema=${schema}`)], 'Schema-only pg_dump', env);
    if (!sql.includes('PostgreSQL database dump') || !/CREATE (?:TABLE|FUNCTION|TYPE) /.test(sql)) throw new Error('pg_dump returned an incomplete application schema.');
    assertNoCredentials(sql);
    const selected = schemas.map((schema) => `'${schema}'`).join(',');
    const query = `SELECT json_build_object(
        'server_version', current_setting('server_version'),
        'schemas', ARRAY[${selected}],
        'policies', (SELECT coalesce(json_agg(p ORDER BY p.schemaname,p.tablename,p.policyname),'[]'::json) FROM pg_policies p WHERE p.schemaname IN (${selected})),
        'extensions', (SELECT coalesce(json_agg(e ORDER BY e.name),'[]'::json) FROM (SELECT x.extname AS name,n.nspname AS schema,x.extversion AS version FROM pg_extension x JOIN pg_namespace n ON n.oid=x.extnamespace WHERE x.extname <> 'plpgsql') e)
    );`;
    const metadataText = run('psql', ['--no-psqlrc', '--no-password', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--command', query], 'Schema catalog read', {
        ...env, PGOPTIONS: `${env.PGOPTIONS || ''} -c default_transaction_read_only=on -c statement_timeout=30000`,
    });
    return { sql, metadata: JSON.parse(metadataText) };
}

function assertNoCredentials(sql) {
    for (const [name, value] of Object.entries(process.env)) {
        if (/(?:KEY|PASSWORD|TOKEN|SECRET|DATABASE_URL|SUPABASE_DB_URL)$/.test(name) && value && value.length >= 12 && sql.includes(value)) {
            throw new Error(`Schema contains a credential literal matching ${name}; generated files were not replaced.`);
        }
    }
}

function quoteIdentifier(value) { return `"${String(value).replace(/"/g, '""')}"`; }

function generateBaseline(sql, metadata) {
    const declarations = [];
    const schemas = new Set((metadata.extensions || []).map((extension) => extension.schema));
    for (const schema of schemas) {
        if (!schema.startsWith('pg_') && schema !== 'information_schema') declarations.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)};`);
    }
    for (const extension of metadata.extensions || []) {
        declarations.push(`CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(extension.name)} WITH SCHEMA ${quoteIdentifier(extension.schema)};`);
    }
    const schema = sql.replace(/^CREATE SCHEMA (.+);$/gm, 'CREATE SCHEMA IF NOT EXISTS $1;');
    return `-- AUTO-GENERATED from the live database by npm run snapshot. Do not edit.\n-- Application schema baseline captured ${metadata.generated_at}.\n-- Requires a fresh Supabase database with its managed roles and auth/storage schemas.\n-- Includes the schema state after existing migrations; do not replay them after this baseline.\n-- Contains no table data, auth users, vault secrets, storage objects or migration history.\n\n${declarations.join('\n')}\n\n${schema}`;
}

function atomicWrite(file, contents) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(temporary, contents, 'utf8');
        fs.renameSync(temporary, file);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}

function readSnapshot() {
    const sqlPath = path.join(ROOT, 'backend.snapshot.sql');
    const catalogPath = path.join(ROOT, 'backend.snapshot.catalog.json');
    if (!fs.existsSync(sqlPath) || !fs.existsSync(catalogPath)) {
        throw new Error('A real schema snapshot and catalog are required. Run npm run snapshot successfully first.');
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    if (crypto.createHash('sha256').update(sql).digest('hex') !== catalog.sha256) {
        throw new Error('Snapshot SQL and catalog do not match. Run npm run snapshot again.');
    }
    return { sql, catalog };
}

module.exports = { ROOT, loadEnv, run, redactDiagnostic, parseConnectionScript, databaseUrlEnv, parseSchemas, projectRef, readSchema, generateBaseline, atomicWrite, readSnapshot };
