const assert = require('node:assert/strict');
const test = require('node:test');
const { parseConnectionScript, databaseUrlEnv, parseSchemas, generateBaseline, redactDiagnostic } = require('../scripts/backend-schema.cjs');
const { generateTypescript } = require('../scripts/gen-policies.cjs');

test('linked CLI exports are decoded without evaluating shell code', () => {
    const script = [
        'export PGHOST="db.example.test"', 'export PGPORT="5432"', 'export PGUSER="temporary-reader"',
        'export PGPASSWORD="fake\\$secret"', 'export PGDATABASE="postgres"', 'pg_dump --role "postgres"',
    ].join('\n');
    const env = parseConnectionScript(script);
    assert.equal(env.PGPASSWORD, 'fake$secret');
    assert.equal(env.PGHOST, 'db.example.test');
    assert.equal(env.PGOPTIONS, '-c role=postgres');
    assert.throws(() => parseConnectionScript(script.replace('fake\\$secret', '$(echo secret)')), /Dynamic/);
    assert.throws(() => parseConnectionScript('export PGHOST="db.example.test"'), /PGPORT/);
});

test('database URL becomes environment variables instead of credential-bearing command arguments', () => {
    const env = databaseUrlEnv('postgresql://reader:fake%21password@db.example.test:6543/postgres?sslmode=require');
    assert.equal(env.PGPASSWORD, 'fake!password');
    assert.equal(env.PGPORT, '6543');
    assert.equal(env.PGSSLMODE, 'require');
    assert.throws(() => databaseUrlEnv('https://db.example.test'), /PostgreSQL/);
});

test('database diagnostics retain the failure while removing credentials', () => {
    const output = redactDiagnostic('permission denied; password fake-long-secret; postgresql://reader:another-secret@db.test/postgres', {
        PGPASSWORD: 'fake-long-secret', PGUSER: 'reader',
    });
    assert.match(output, /permission denied/);
    assert.doesNotMatch(output, /fake-long-secret|another-secret|postgresql:\/\//);
});

test('schema snapshots select application schemas and reject injection or managed schemas', () => {
    assert.deepEqual(parseSchemas('public,private,public'), ['public', 'private']);
    assert.throws(() => parseSchemas('public; DROP TABLE'), /identifiers/);
    assert.throws(() => parseSchemas('public,auth'), /Supabase manages/);
});

test('baseline preserves grants while creating extensions and tolerating an existing empty schema', () => {
    const sql = 'CREATE SCHEMA public;\nCREATE TABLE public.example(id uuid);\nGRANT SELECT ON TABLE public.example TO anon;\n';
    const baseline = generateBaseline(sql, { generated_at: 'test', extensions: [{ name: 'pgcrypto', schema: 'extensions' }, { name: 'pg_cron', schema: 'pg_catalog' }] });
    assert.match(baseline, /CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"/);
    assert.match(baseline, /CREATE SCHEMA IF NOT EXISTS public/);
    assert.match(baseline, /GRANT SELECT ON TABLE public.example TO anon/);
    assert.doesNotMatch(baseline, /DROP SCHEMA|COPY public/);
    assert.doesNotMatch(baseline, /CREATE SCHEMA IF NOT EXISTS "pg_catalog"/);
});

test('policy generation preserves quoted names, roles, restrictive mode and update checks', () => {
    const output = generateTypescript([{
        schemaname: 'public', tablename: 'example', policyname: "Admin's edit policy", permissive: 'RESTRICTIVE',
        roles: ['authenticated'], cmd: 'UPDATE', qual: '(is_site_admin())', with_check: '(owner_id = auth.uid())',
    }]);
    const json = output.slice(output.indexOf('export const POLICIES: Policy[] = ') + 'export const POLICIES: Policy[] = '.length).replace(/;\s*$/, '');
    const [policy] = JSON.parse(json);
    assert.equal(policy.policyname, "Admin's edit policy");
    assert.equal(policy.permissive, false);
    assert.deepEqual(policy.roles, ['authenticated']);
    assert.equal(policy.with_check, '(owner_id = auth.uid())');
});
