import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
    ...nextVitals,
    {
        rules: {
            // Route and cache synchronization effects are used throughout this app;
            // keep reviewing them without blocking builds while React's static
            // component identity, purity, and dependency checks remain enforced.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.next15-deps-backup/**']),
]);
