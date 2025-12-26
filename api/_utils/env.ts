declare const process: any;

export function getEnv(...names: (string | undefined)[]): string | undefined {
    for (const name of names) {
        if (!name) continue;
        const value = process.env[name];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
}
