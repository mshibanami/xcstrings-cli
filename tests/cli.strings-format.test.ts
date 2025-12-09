import { describe, it, expect } from 'vitest';
import { parseStringsArg } from '../src/utils/cli';

describe('cli: strings-format parsing', () => {
    it('parses YAML inline when format=yaml', async () => {
        const yaml = 'en: Hello\nja: こんにちは\nzh-Hans: 你好，世界.';
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'yaml');
        expect(result).toEqual({ en: 'Hello', ja: 'こんにちは', 'zh-Hans': '你好，世界.' });
    });

    it('parses YAML from stdin when flag passed without value and format=yaml', async () => {
        const yaml = 'en: Hello\nja: こんにちは\nzh-Hans: 你好，世界.';
        const result = await parseStringsArg(true, async () => Promise.resolve(yaml), 'yaml');
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
        expect(result?.['zh-Hans']).toBe('你好，世界.');
    });

    it('parses JSON5 inline when format=json', async () => {
        const json5 = `{
            en: 'Hello',
            ja: 'こんにちは',
            'zh-Hans': '你好，世界.', // trailing comma is allowed
        }`;
        const result = await parseStringsArg(json5, async () => Promise.resolve(''), 'json');
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
        expect(result?.['zh-Hans']).toBe('你好，世界.');
    });

    it('auto-detects YAML when JSON5 parsing fails', async () => {
        const yaml = 'en: Hello\nja: こんにちは';
        const result = await parseStringsArg(yaml, async () => Promise.resolve(''), 'auto');
        expect(result).toEqual({ en: 'Hello', ja: 'こんにちは' });
    });

    it('merges multiple inputs with specified format', async () => {
        const items = ['{ en: "Hello" }', '{ ja: "こんにちは" }'];
        const result = await parseStringsArg(items as unknown as string[], async () => Promise.resolve(''), 'json');
        expect(result).toEqual({ en: 'Hello', ja: 'こんにちは' });
    });

    it('throws friendly error with hint when parsing fails', async () => {
        const bad = 'not: [valid';
        await expect(parseStringsArg(bad, async () => Promise.resolve(''), 'auto')).rejects.toThrow(/strings-format/i);
    });
});