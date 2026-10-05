#!/usr/bin/env node
/* eslint-env node */
const path = require('node:path');
const { ROOT, readSnapshot, atomicWrite } = require('./backend-schema.cjs');
try {
    const { sql } = readSnapshot();
    atomicWrite(path.join(ROOT, 'lib', 'functions.sql'), sql);
    console.log('Generated functions/schema SQL from the verified schema-only snapshot.');
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Functions SQL generation failed.');
    process.exitCode = 1;
}
