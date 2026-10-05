// A server seed is authoritative once per object identity. Keep that identity
// after invalidation so a mutation refresh cannot restore the original seed.
export function createSeededContentCache<T extends object>(generation: () => number) {
    const values = new Map<string, T>();
    const inflight = new Map<string, Promise<T>>();
    const versions = new Map<string, number>();
    const acceptedSeeds = new WeakSet<T>();
    let currentGeneration = generation();

    const reconcile = () => {
        const next = generation();
        if (next === currentGeneration) return;
        currentGeneration = next;
        values.clear();
        inflight.clear();
        versions.clear();
    };

    const peek = (key: string, seed?: T): T | undefined => {
        reconcile();
        if (seed && !acceptedSeeds.has(seed)) return seed;
        return values.get(key);
    };

    const seed = (key: string, value?: T): T | undefined => {
        reconcile();
        if (!value || acceptedSeeds.has(value)) return values.get(key);
        acceptedSeeds.add(value);
        versions.set(key, (versions.get(key) ?? 0) + 1);
        values.set(key, value);
        inflight.delete(key);
        return value;
    };

    const read = async (key: string, load: () => Promise<T>): Promise<T> => {
        reconcile();
        const cached = values.get(key);
        if (cached) return cached;
        const existing = inflight.get(key);
        if (existing) return existing;
        const startedGeneration = currentGeneration;
        const startedVersion = versions.get(key) ?? 0;
        const isCurrent = () => generation() === startedGeneration && (versions.get(key) ?? 0) === startedVersion;
        const request = (async () => {
            try {
                const result = await load();
                if (!isCurrent()) return await read(key, load);
                values.set(key, result);
                return result;
            } catch (error) {
                if (!isCurrent()) return await read(key, load);
                throw error;
            }
        })();
        inflight.set(key, request);
        try {
            return await request;
        } finally {
            if (inflight.get(key) === request) inflight.delete(key);
        }
    };

    const remove = (key: string) => {
        reconcile();
        versions.set(key, (versions.get(key) ?? 0) + 1);
        values.delete(key);
        inflight.delete(key);
    };

    return { peek, seed, read, remove };
}
