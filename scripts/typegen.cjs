#!/usr/bin/env node
/* eslint-env node */
const path = require('node:path');
const { ROOT, loadEnv, run, projectRef, atomicWrite } = require('./backend-schema.cjs');
try {
    loadEnv();
    const args = process.argv.slice(2);
    const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
    const schema = option('--schema') || process.env.SUPABASE_TYPEGEN_SCHEMA || 'public,auth';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(?:,[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(schema)) throw new Error('Invalid type generation schema list.');
    const ref = projectRef();
    let dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
    if (!dbUrl && process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
        dbUrl = `postgresql://${encodeURIComponent(process.env.PGUSER)}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;
    }
    if (!ref && !dbUrl) throw new Error('Set the application Supabase URL/project ref or a database connection before type generation.');
    const cliArgs = ['gen', 'types', 'typescript', ...(ref ? ['--project-id', ref] : ['--db-url', dbUrl]), '--schema', schema];
    const source = run('supabase', cliArgs, 'Supabase type generation');
    if (!source.includes('export type Database')) throw new Error('Supabase CLI returned no database type definitions.');
    const output = option('--out') ? path.resolve(ROOT, option('--out')) : path.join(ROOT, 'lib', 'database.types.ts');
    atomicWrite(output, source);
    console.log('Generated Supabase database types.');
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Supabase type generation failed.');
    process.exitCode = 1;
}
