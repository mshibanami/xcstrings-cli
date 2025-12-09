import JSON5 from 'json5';
import yaml from 'js-yaml';
import { add } from '../commands/add';

export type StringsFormat = 'auto' | 'yaml' | 'json';

const parseObject = (value: unknown, kind: Omit<StringsFormat, 'auto'>): Record<string, string> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, string>;
    }
    throw new Error(`Parsed --strings as ${kind}, but it was not an object.`);
};

const errorMessage = (err: unknown): string => err instanceof Error ? err.message : String(err);

const parseContent = (content: string, format: StringsFormat): Record<string, string> => {
    const trimmed = content.trim();
    if (!trimmed) {
        return {};
    }
    if (format === 'json') {
        try {
            return parseObject(JSON5.parse(trimmed), 'json');
        } catch (err) {
            throw new Error(`Failed to parse --strings as JSON. Hint: check --strings-format=json. ${errorMessage(err)}`);
        }
    }
    if (format === 'yaml') {
        try {
            return parseObject(yaml.load(trimmed), 'yaml');
        } catch (err) {
            throw new Error(`Failed to parse --strings as YAML. Hint: check --strings-format=yaml. ${errorMessage(err)}`);
        }
    }
    const errors: string[] = [];
    try {
        return parseObject(yaml.load(trimmed), 'yaml');
    } catch (err) {
        errors.push(`yaml error: ${errorMessage(err)}`);
    }
    try {
        return parseObject(JSON5.parse(trimmed), 'json');
    } catch (err) {
        errors.push(`json error: ${errorMessage(err)}`);
    }
    throw new Error(`Failed to parse --strings input. Provide valid YAML or JSON, or specify --strings-format. ${errors.join(' | ')}`);
};

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
    format: StringsFormat = 'auto',
): Promise<Record<string, string> | undefined> {
    if (stringsArg === undefined) {
        return undefined;
    }
    if (stringsArg === '') {
        const stdin = await stdinReader();
        if (!stdin.trim()) return undefined;
        return parseContent(stdin, format);
    }
    if (typeof stringsArg === 'string') {
        return parseContent(stringsArg, format);
    }
    if (Array.isArray(stringsArg)) {
        const merged: Record<string, string> = {};
        for (const item of stringsArg) {
            if (typeof item === 'string') {
                Object.assign(merged, parseContent(item, format));
            }
        }
        return merged;
    }
    if (typeof stringsArg === 'boolean' && stringsArg === true) {
        const stdin = await stdinReader();
        if (!stdin.trim()) return undefined;
        return parseContent(stdin, format);
    }
    return undefined;
}

export async function runAddCommand({
    path,
    key,
    comment,
    stringsArg,
    stringsFormat,
    defaultString,
    language,
    stdinReader = readStdinToString,
    configPath
}: {
    path: string;
    key: string;
    comment: string | undefined;
    stringsArg: unknown;
    stringsFormat?: StringsFormat;
    defaultString?: string;
    language?: string;
    stdinReader?: () => Promise<string>;
    configPath?: string;
}): Promise<void> {
    const strings = await parseStringsArg(stringsArg, stdinReader, stringsFormat);
    await add(path, key, comment, strings, configPath, defaultString, language);
}
