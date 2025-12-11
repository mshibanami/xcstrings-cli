import JSON5 from 'json5';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { CommandModule } from 'yargs';
import { LOCALIZATION_STATES, LocalizationPayload, LocalizationState, readXCStrings, writeXCStrings, XCStringUnit } from './_shared';
import { captureInteractiveStringsInput } from '../utils/interactive.js';
import { loadConfig, MissingLanguagePolicy } from '../utils/config';
import { languages } from './languages';
import logger from '../utils/logger.js';

type LocalizationMap = NonNullable<XCStringUnit['localizations']>;

export type StringsFormat = 'auto' | 'yaml' | 'json';

export type InteractiveAddOptions = {
    path: string;
    key?: string;
    comment?: string;
    defaultString?: string;
    language?: string;
    configPath?: string;
    state: LocalizationState;
};

type MultiAddEntry = {
    translations?: Record<string, LocalizationPayload>;
    comment?: string;
};

export type ParsedStringsArg =
    | { kind: 'single'; translations: Record<string, LocalizationPayload>; comment?: string }
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

const resolveState = (value: string | undefined): LocalizationState => {
    if (value === undefined) return 'translated';
    if ((LOCALIZATION_STATES as readonly string[]).includes(value)) {
        return value as LocalizationState;
    }
    throw new Error(`Invalid state "${value}". Allowed values: ${LOCALIZATION_STATES.join(', ')}.`);
};

const normalizeTranslationValue = (value: unknown, context: string): LocalizationPayload => {
    if (typeof value === 'string') {
        return { value, state: undefined };
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if (typeof obj.value !== 'string') {
            throw new Error(`${context} must include a string "value".`);
        }
        let state: LocalizationState | undefined;
        if (obj.state !== undefined) {
            state = resolveState(String(obj.state));
        }
        return { value: obj.value, state };
    }
    throw new Error(`${context} must be a string or an object with "value" (and optional "state").`);
};

const normalizeTranslations = (value: unknown, context: string): Record<string, LocalizationPayload> | undefined => {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${context} must be an object of language -> text.`);
    }
    const translations: Record<string, LocalizationPayload> = {};
    for (const [lang, text] of Object.entries(value)) {
        translations[lang] = normalizeTranslationValue(text, `${context} for "${lang}"`);
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
    const inlineTranslations: Record<string, LocalizationPayload> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'comment' || k === 'translations') continue;
        inlineTranslations[k] = normalizeTranslationValue(v, `Translation for "${k}" in "${key}"`);
    }

    const mergedTranslations = { ...explicitTranslations, ...inlineTranslations };
    if (Object.keys(mergedTranslations).length > 0) {
        entry.translations = mergedTranslations;
    }

    return entry;
};

const isTranslationValue = (value: unknown): boolean => {
    if (typeof value === 'string') return true;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        return typeof obj.value === 'string' && (obj.state === undefined || typeof obj.state === 'string');
    }
    return false;
};

const isTranslationRecord = (obj: Record<string, unknown>): boolean => {
    return Object.values(obj).every((v) => isTranslationValue(v));
};

const toParsedStrings = (obj: Record<string, unknown>): ParsedStringsArg => {
    if (isTranslationRecord(obj)) {
        const translations = normalizeTranslations(obj, 'translations') || {};
        return { kind: 'single', translations };
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

export async function runInteractiveAdd(options: InteractiveAddOptions): Promise<AddResult> {
    const rawInput = await captureInteractiveStringsInput();
    if (!rawInput.trim()) {
        throw new Error('Interactive input was empty. Provide YAML or JSON payload.');
    }

    const toMessage = (err: unknown): string => err instanceof Error ? err.message : String(err);

    let parsed: ParsedStringsArg | undefined;
    try {
        parsed = await parseStringsArg(rawInput, async () => Promise.resolve(''), 'auto');
    } catch (err) {
        throw new Error(`Failed to parse interactive input. ${toMessage(err)}`);
    }

    if (!parsed) {
        throw new Error('Interactive input was empty. Provide YAML or JSON payload.');
    }

    if (parsed.kind === 'multi') {
        if (options.key || options.comment || options.defaultString !== undefined || options.language) {
            throw new Error('When adding multiple strings via interactive payload, omit --key, --comment, --text, and --language.');
        }
        const addedKeys: string[] = [];
        for (const [entryKey, entry] of Object.entries(parsed.entries)) {
            await add(options.path, entryKey, entry.comment, entry.translations, options.configPath, undefined, undefined, options.state);
            addedKeys.push(entryKey);
        }
        return { kind: 'multi', keys: addedKeys };
    }

    const keyToUse = options.key;
    if (!keyToUse) {
        throw new Error('--key is required unless the interactive payload contains multiple keys.');
    }

    const commentFromPayload = parsed.kind === 'single' ? parsed.comment : undefined;
    const translations = parsed.kind === 'single' ? parsed.translations : undefined;
    await add(
        options.path,
        keyToUse,
        options.comment ?? commentFromPayload,
        translations,
        options.configPath,
        options.defaultString,
        options.language,
        options.state,
    );
    return { kind: 'single', keys: [keyToUse] };
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
    configPath,
    state,
    interactive,
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
    interactive?: boolean;
}): Promise<AddResult> {
    const resolvedState = resolveState(state);

    if (interactive) {
        if (stringsArg !== undefined) {
            throw new Error('--interactive cannot be combined with --strings input.');
        }
        return runInteractiveAdd({
            path,
            key,
            comment,
            defaultString,
            language,
            configPath,
            state: resolvedState,
        });
    }

    const parsedStrings = await parseStringsArg(stringsArg, stdinReader, stringsFormat);

    if (parsedStrings?.kind === 'multi') {
        if (key || comment || defaultString !== undefined || language) {
            throw new Error('When adding multiple strings via --strings payload, omit --key, --comment, --text, and --language.');
        }
        const addedKeys: string[] = [];
        for (const [entryKey, entry] of Object.entries(parsedStrings.entries)) {
            await add(path, entryKey, entry.comment, entry.translations, configPath, undefined, undefined, resolvedState);
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
    await add(path, keyToUse, comment ?? commentFromPayload, strings, configPath, defaultString, language, resolvedState);
    return { kind: 'single', keys: [keyToUse] };
}

const sortLocalizations = (localizations: LocalizationMap): LocalizationMap => {
    const sorted = Object.entries(localizations)
        .sort(([langA], [langB]) => langA.localeCompare(langB, 'en', { sensitivity: 'case' }));
    return Object.fromEntries(sorted) as LocalizationMap;
};

export function createAddCommand(): CommandModule {
    return {
        command: 'add',
        describe: 'Add a string',
        builder: (yargs) => yargs
            .option('key', {
                type: 'string',
                describe: 'The key of the string (omit when adding multiple keys via --strings)',
                demandOption: false,
            })
            .option('comment', {
                type: 'string',
                describe: 'The comment for the string',
            })
            .option('language', {
                type: 'string',
                alias: 'l',
                describe: 'The language of the string provided with --text',
            })
            .option('state', {
                type: 'string',
                choices: LOCALIZATION_STATES,
                describe: 'State to apply to added strings (translated | needs_review | new | stale)',
            })
            .option('text', {
                type: 'string',
                describe: 'The string value for the default language',
            })
            .option('strings', {
                type: 'string',
                describe: 'The strings JSON or YAML'
            })
            .option('strings-format', {
                type: 'string',
                choices: ['auto', 'json', 'yaml'] as const,
                default: 'auto',
                describe: 'Format for the data provided with --strings'
            })
            .option('interactive', {
                type: 'boolean',
                alias: 'i',
                describe: 'Add strings in an interactive flow',
            }),
        handler: async (argv) => {
            const result = await runAddCommand({
                path: argv.path as string,
                key: argv.key as string,
                comment: argv.comment as string | undefined,
                stringsArg: argv.strings,
                stringsFormat: argv['strings-format'] as StringsFormat,
                defaultString: argv.text as string | undefined,
                language: argv.language as string | undefined,
                state: argv.state as string | undefined,
                stdinReader: undefined,
                configPath: argv.config as string | undefined,
                interactive: argv.interactive as boolean | undefined,
            });
            logger.info(chalk.green(`✓ Added keys:\n${result.keys.map((k) => `- ${k}`).join('\n')}`));
        },
    } satisfies CommandModule;
}

export async function add(
    path: string,
    key: string,
    comment: string | undefined,
    strings: Record<string, LocalizationPayload | string> | undefined,
    configPath?: string,
    defaultString?: string,
    language?: string,
    state?: LocalizationState,
): Promise<void> {
    const data = await readXCStrings(path);

    if (!data.sourceLanguage) {
        throw new Error('The xcstrings file is missing "sourceLanguage".');
    }

    const sourceLanguage = data.sourceLanguage;

    if (!data.strings) {
        data.strings = {};
    }

    const config = await loadConfig(configPath);
    const handleMissing: MissingLanguagePolicy = config?.missingLanguagePolicy || 'skip';
    let supportedLanguages: string[] | undefined;

    const ensureSupported = async (lang: string): Promise<boolean> => {
        if (handleMissing === 'include') {
            return true;
        }
        if (!supportedLanguages) {
            supportedLanguages = await languages(path, configPath);
        }
        return supportedLanguages.includes(lang);
    };

    const warnUnsupported = (lang: string): void => {
        logger.warn(`Language "${lang}" is not supported. Skipped adding its translation (missingLanguagePolicy=skip).`);
    };

    const unit: XCStringUnit = {
        ...data.strings[key],
        extractionState: 'manual',
    };

    if (comment) {
        unit.comment = comment;
    }

    const resolvedState: LocalizationState = state ?? 'translated';

    const toPayload = (input?: LocalizationPayload | string): LocalizationPayload | undefined => {
        if (input === undefined) return undefined;
        if (typeof input === 'string') {
            return { value: input };
        }
        return input;
    };

    if (defaultString !== undefined) {
        const targetLanguage = language ?? sourceLanguage;
        if (!(await ensureSupported(targetLanguage))) {
            warnUnsupported(targetLanguage);
        } else {
            unit.localizations = unit.localizations || {};
            const payload = toPayload(strings?.[targetLanguage]);
            unit.localizations[targetLanguage] = {
                stringUnit: {
                    state: payload?.state ?? resolvedState,
                    value: defaultString,
                },
            };
        }
    }

    const mergedStrings = strings ? { ...strings } : undefined;

    if (mergedStrings) {
        const toAdd: Array<[string, LocalizationPayload]> = [];
        for (const [lang, value] of Object.entries(mergedStrings)) {
            const targetLanguage = language ?? sourceLanguage;
            if (defaultString !== undefined && lang === targetLanguage) {
                continue;
            }
            const supported = handleMissing === 'include'
                ? true
                : (lang === sourceLanguage || await ensureSupported(lang));
            if (supported) {
                const payload = toPayload(value);
                if (payload) {
                    toAdd.push([lang, payload]);
                }
            } else {
                warnUnsupported(lang);
            }
        }
        if (toAdd.length > 0) {
            unit.localizations = unit.localizations || {};
            for (const [lang, value] of toAdd) {
                unit.localizations[lang] = {
                    stringUnit: {
                        state: value.state ?? resolvedState,
                        value: value.value,
                    },
                };
            }
        }
    }

    data.strings[key] = unit;

    if (unit.localizations) {
        unit.localizations = sortLocalizations(unit.localizations);
    }
    await writeXCStrings(path, data);
}
