import { readFile, writeFile } from 'node:fs/promises';

export const LOCALIZATION_STATES = ['translated', 'needs_review', 'new', 'stale'] as const;
export type LocalizationState = typeof LOCALIZATION_STATES[number];

export interface XCStrings {
    sourceLanguage: string;
    strings: Record<string, XCStringUnit>;
    version?: string;
}

export interface XCStringUnit {
    comment?: string;
    extractionState?: 'manual' | 'migrated' | 'stale' | 'ucheck';
    localizations?: Record<string, XCStringLocalization>;
    shouldTranslate?: boolean;
}

export interface XCStringLocalization {
    stringUnit: {
        state: LocalizationState;
        value: string;
    };
}

export async function readXCStrings(path: string): Promise<XCStrings> {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as XCStrings;
}

export async function writeXCStrings(path: string, data: XCStrings): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    const formatted = formatXCStrings(json);
    await writeFile(path, formatted + '\n', 'utf-8');
}

export function formatXCStrings(json: string): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < json.length; i++) {
        const char = json[i];
        if (inString && char === '\\' && !escape) {
            escape = true;
            result += char;
            continue;
        }
        if (escape) {
            escape = false;
            result += char;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }
        if (!inString && char === ':') {
            result += ' :';
            continue;
        }
        result += char;
    }
    return result;
}
