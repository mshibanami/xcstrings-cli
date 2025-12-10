import { describe, it, expect } from 'vitest';
import { parseStringsArg } from '../src/utils/cli';

describe('cli: strings-format parsing', () => {
    it('parses YAML inline when format=yaml', async () => {
        const yaml = 'en: Hello\nja: こんにちは\nzh-Hans: 你好，世界.';
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'yaml');
        expect(result?.kind).toBe('single');
        expect(result && result.kind === 'single' ? result.translations : {}).toEqual({ en: 'Hello', ja: 'こんにちは', 'zh-Hans': '你好，世界.' });
    });

    it('parses YAML from stdin when flag passed without value and format=yaml', async () => {
        const yaml = 'en: Hello\nja: こんにちは\nzh-Hans: 你好，世界.';
        const result = await parseStringsArg(true, async () => Promise.resolve(yaml), 'yaml');
        expect(result?.kind).toBe('single');
        const translations = result && result.kind === 'single' ? result.translations : {};
        expect(translations.en).toBe('Hello');
        expect(translations.ja).toBe('こんにちは');
        expect(translations['zh-Hans']).toBe('你好，世界.');
    });

    it('parses JSON5 inline when format=json', async () => {
        const json5 = `{
            en: 'Hello',
            ja: 'こんにちは',
            'zh-Hans': '你好，世界.', // trailing comma is allowed
        }`;
        const result = await parseStringsArg(json5, async () => Promise.resolve(''), 'json');
        expect(result?.kind).toBe('single');
        const translations = result && result.kind === 'single' ? result.translations : {};
        expect(translations.en).toBe('Hello');
        expect(translations.ja).toBe('こんにちは');
        expect(translations['zh-Hans']).toBe('你好，世界.');
    });

    it('auto-detects YAML when JSON5 parsing fails', async () => {
        const yaml = 'en: Hello\nja: こんにちは';
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'auto');
        expect(result?.kind).toBe('single');
        expect(result && result.kind === 'single' ? result.translations : {}).toEqual({ en: 'Hello', ja: 'こんにちは' });
    });

    it('merges multiple inputs with specified format', async () => {
        const items = ['{ en: "Hello" }', '{ ja: "こんにちは" }'];
        const result = await parseStringsArg(items as unknown as string[], async () => Promise.resolve(''), 'json');
        expect(result?.kind).toBe('single');
        expect(result && result.kind === 'single' ? result.translations : {}).toEqual({ en: 'Hello', ja: 'こんにちは' });
    });

    it('throws friendly error with hint when parsing fails', async () => {
        const bad = 'not: [valid';
        await expect(parseStringsArg(bad, async () => Promise.resolve(''), 'auto')).rejects.toThrow(/strings-format/i);
    });

    it('parses multi-key payload with translations and comments', async () => {
        const yaml = `greeting:\n  translations:\n    en: Hello\n    ja: こんにちは\n  comment: Greeting\nfarewell:\n  en: Goodbye\n  comment: Bye\n`;
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'yaml');
        expect(result?.kind).toBe('multi');
        if (result?.kind === 'multi') {
            expect(result.entries.greeting.translations?.en).toBe('Hello');
            expect(result.entries.greeting.comment).toBe('Greeting');
            expect(result.entries.farewell.translations?.en).toBe('Goodbye');
            expect(result.entries.farewell.comment).toBe('Bye');
        }
    });

    it('treats single-key object as multi-add payload when no key is provided', async () => {
        const yaml = `greeting:\n  en: Hello`;
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'yaml');
        expect(result?.kind).toBe('multi');
        if (result?.kind === 'multi') {
            expect(result.entries.greeting.translations?.en).toBe('Hello');
        }
    });
});
