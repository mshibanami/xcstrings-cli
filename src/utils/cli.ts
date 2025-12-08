import { add } from '../commands/index.js';

export async function readStdinToString(): Promise<string> {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data);
        });
        if (process.stdin.readableEnded) {
            resolve('');
        }
    });
}

export async function parseStringsArg(
    stringsArg: unknown,
    stdinReader: () => Promise<string> = readStdinToString,
): Promise<Record<string, string> | undefined> {
    if (stringsArg === undefined) {
        return undefined;
    }
    if (stringsArg === '') {
        const stdin = await stdinReader();
        if (!stdin.trim()) return undefined;
        return JSON.parse(stdin);
    }
    if (typeof stringsArg === 'string') {
        return JSON.parse(stringsArg);
    }
    if (Array.isArray(stringsArg)) {
        const merged: Record<string, string> = {};
        for (const item of stringsArg) {
            if (typeof item === 'string') {
                Object.assign(merged, JSON.parse(item));
            }
        }
        return merged;
    }
    if (typeof stringsArg === 'boolean' && stringsArg === true) {
        const stdin = await stdinReader();
        if (!stdin.trim()) return undefined;
        return JSON.parse(stdin);
    }
    return undefined;
}

export async function runAddCommand({
    path,
    key,
    comment,
    stringsArg,
    stdinReader = readStdinToString,
    configPath
}: {
    path: string;
    key: string;
    comment: string | undefined;
    stringsArg: unknown;
    stdinReader?: () => Promise<string>;
    configPath?: string;
}): Promise<void> {
    const strings = await parseStringsArg(stringsArg, stdinReader);
    await add(path, key, comment, strings, configPath);
}
