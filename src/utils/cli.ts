import JSON5 from 'json5';
import yaml from 'js-yaml';
import { add } from '../commands/add';
import { LOCALIZATION_STATES, LocalizationState } from '../commands/_shared';

export type StringsFormat = 'auto' | 'yaml' | 'json';

type MultiAddEntry = {
    translations?: Record<string, string>;
    comment?: string;
};

export type ParsedStringsArg =
    | { kind: 'single'; translations: Record<string, string>; comment?: string }
    | { kind: 'multi'; entries: Record<string, MultiAddEntry> };

const errorMessage = (err: unknown): string => err instanceof Error ? err.message : String(err);

const parseAnyObject = (value: unknown, kind: Omit<StringsFormat, 'auto'>): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    throw new Error(`Parsed --strings as ${kind}, but it was not an object.`);
};

const parseContent = (content: string, format: StringsFormat): Record<string, unknown> => {
    const trimmed = content.trim();
    if (!trimmed) {
        return {};
    }
    if (format === 'json') {
        try {
            return parseAnyObject(JSON5.parse(trimmed), 'json');
        } catch (err) {
            throw new Error(`Failed to parse --strings as JSON. Hint: check --strings-format=json. ${errorMessage(err)}`);
        }
    }
    if (format === 'yaml') {
        try {
            return parseAnyObject(yaml.load(trimmed), 'yaml');
        } catch (err) {
            throw new Error(`Failed to parse --strings as YAML. Hint: check --strings-format=yaml. ${errorMessage(err)}`);
        }
    }
    const errors: string[] = [];
    try {
        return parseAnyObject(yaml.load(trimmed), 'yaml');
    } catch (err) {
        errors.push(`yaml error: ${errorMessage(err)}`);
    }
    try {
        return parseAnyObject(JSON5.parse(trimmed), 'json');
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

const normalizeTranslations = (value: unknown, context: string): Record<string, string> | undefined => {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${context} must be an object of language -> text.`);
    }
    const translations: Record<string, string> = {};
    for (const [lang, text] of Object.entries(value)) {
        if (typeof text !== 'string') {
            throw new Error(`${context} for "${lang}" must be a string.`);
        }
        translations[lang] = text;
    }
    return translations;
};

const normalizeMultiEntry = (value: unknown, key: string): MultiAddEntry => {
    if (value === undefined || value === null) {
        return {};
    }
    if (typeof value === 'string') {
        return { comment: value };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Value for "${key}" must be an object.`);
    }

    const obj = value as Record<string, unknown>;
    const entry: MultiAddEntry = {};
    if (typeof obj.comment === 'string') {
        entry.comment = obj.comment;
    }

    const explicitTranslations = normalizeTranslations(obj.translations, `translations for "${key}"`) || {};
    const inlineTranslations: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'comment' || k === 'translations') continue;
        if (typeof v === 'string') {
            inlineTranslations[k] = v;
        }
    }

    const mergedTranslations = { ...explicitTranslations, ...inlineTranslations };
    if (Object.keys(mergedTranslations).length > 0) {
        entry.translations = mergedTranslations;
    }

    return entry;
};

const isAllStringValues = (obj: Record<string, unknown>): obj is Record<string, string> => {
    return Object.values(obj).every((v) => typeof v === 'string');
};

const toParsedStrings = (obj: Record<string, unknown>): ParsedStringsArg => {
    if (isAllStringValues(obj)) {
        return { kind: 'single', translations: obj };
    }
    const hasOnlyTranslationsAndComment =
        Object.keys(obj).every((k) => k === 'translations' || k === 'comment');
    if (hasOnlyTranslationsAndComment && 'translations' in obj) {
        const translations = normalizeTranslations(obj.translations, 'translations') || {};
        const comment = typeof obj.comment === 'string' ? obj.comment : undefined;
        return { kind: 'single', translations, comment };
    }
    const entries: Record<string, MultiAddEntry> = {};
    for (const [key, value] of Object.entries(obj)) {
        entries[key] = normalizeMultiEntry(value, key);
    }
    return { kind: 'multi', entries };
};

const mergeParsed = (base: ParsedStringsArg | undefined, next: ParsedStringsArg): ParsedStringsArg => {
    if (!base) return next;
    if (base.kind !== next.kind) {
        throw new Error('Cannot merge single and multi --strings payloads. Provide one consistent shape.');
    }
    if (base.kind === 'single' && next.kind === 'single') {
        return {
            kind: 'single',
            translations: { ...base.translations, ...next.translations },
            comment: base.comment ?? next.comment,
        };
    }
    if (base.kind === 'multi' && next.kind === 'multi') {
        const entries = { ...base.entries };
        for (const [key, entry] of Object.entries(next.entries)) {
            const prev = entries[key] || {};
            entries[key] = {
                comment: entry.comment ?? prev.comment,
                translations: { ...(prev.translations || {}), ...(entry.translations || {}) },
            };
        }
        return { kind: 'multi', entries };
    }
    return base;
};

export async function parseStringsArg(
    stringsArg: unknown,
    stdinReader: () => Promise<string> = readStdinToString,
    format: StringsFormat = 'auto',
): Promise<ParsedStringsArg | undefined> {
    if (stringsArg === undefined) {
        return undefined;
    }
    const parseFromString = async (raw: string): Promise<ParsedStringsArg | undefined> => {
        if (!raw.trim()) return undefined;
        return toParsedStrings(parseContent(raw, format));
    };

    if (stringsArg === '') {
        const stdin = await stdinReader();
        return parseFromString(stdin);
    }
    if (typeof stringsArg === 'string') {
        return parseFromString(stringsArg);
    }
    if (Array.isArray(stringsArg)) {
        let merged: ParsedStringsArg | undefined;
        for (const item of stringsArg) {
            if (typeof item === 'string') {
                const parsed = await parseFromString(item);
                if (parsed) {
                    merged = mergeParsed(merged, parsed);
                }
            }
        }
        return merged;
    }
    if (typeof stringsArg === 'boolean' && stringsArg === true) {
        const stdin = await stdinReader();
        return parseFromString(stdin);
    }
    return undefined;
}

export type AddResult = { kind: 'single'; keys: string[] } | { kind: 'multi'; keys: string[] };

export async function runAddCommand({
    path,
    key,
    comment,
    stringsArg,
    stringsFormat,
    defaultString,
    language,
    stdinReader = readStdinToString,
    configPath,
    state,
}: {
    path: string;
    key?: string;
    comment: string | undefined;
    stringsArg: unknown;
    stringsFormat?: StringsFormat;
    defaultString?: string;
    language?: string;
    stdinReader?: () => Promise<string>;
    configPath?: string;
    state?: string;
}): Promise<AddResult> {
    const parsedStrings = await parseStringsArg(stringsArg, stdinReader, stringsFormat);

    const resolveState = (value: string | undefined): LocalizationState => {
        if (value === undefined) return 'translated';
        if ((LOCALIZATION_STATES as readonly string[]).includes(value)) {
            return value as LocalizationState;
        }
        throw new Error(`Invalid state "${value}". Allowed values: ${LOCALIZATION_STATES.join(', ')}.`);
    };

    if (parsedStrings?.kind === 'multi') {
        if (key || comment || defaultString !== undefined || language || state !== undefined) {
            throw new Error('When adding multiple strings via --strings payload, omit --key, --comment, --text, --language, and --state.');
        }
        const addedKeys: string[] = [];
        for (const [entryKey, entry] of Object.entries(parsedStrings.entries)) {
            await add(path, entryKey, entry.comment, entry.translations, configPath, undefined, undefined);
            addedKeys.push(entryKey);
        }
        return { kind: 'multi', keys: addedKeys };
    }

    const keyToUse = key;
    if (!keyToUse) {
        throw new Error('--key is required unless the --strings payload contains multiple keys.');
    }

    const strings = parsedStrings?.kind === 'single' ? parsedStrings.translations : undefined;
    const commentFromPayload = parsedStrings?.kind === 'single' ? parsedStrings.comment : undefined;
    const resolvedState = resolveState(state);
    await add(path, keyToUse, comment ?? commentFromPayload, strings, configPath, defaultString, language, resolvedState);
    return { kind: 'single', keys: [keyToUse] };
}
