import { describe, it, expect, afterEach } from 'vitest';
import { parseStringsArg, runAddCommand } from '../src/utils/cli';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

describe('cli: stdin strings', () => {
    it('parseStringsArg: should read JSON from stdin when strings option provided without value', async () => {
        const stdin = `{
            "en": "Hello",
            "ja": "こんにちは",
            "zh-Hans": "你好，世界."
        }`;

        const result = await parseStringsArg(true, async () => Promise.resolve(stdin));
        expect(result).toBeDefined();
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
        expect(result?.['zh-Hans']).toBe('你好，世界.');
    });

    it('parseStringsArg: should read JSON from stdin when strings option provided as empty string ("")', async () => {
        const stdin = `{"en":"Hello","ja":"こんにちは","zh-Hans":"你好，世界."}`;

        const result = await parseStringsArg('', async () => Promise.resolve(stdin));
        expect(result).toBeDefined();
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
        expect(result?.['zh-Hans']).toBe('你好，世界.');
    });

    it('add: should add strings read from stdin', async () => {
        const stdin = `{"en":"Hello","ja":"こんにちは","zh-Hans":"你好，世界."}`;

        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');
        await runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: 'Hello, World',
            stringsArg: true,
            stdinReader: async () => Promise.resolve(stdin),
            configPath: tempConfigPath
        });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('greeting');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings.greeting.localizations['zh-Hans'].stringUnit.value).toBe('你好，世界.');
    });

    it('parseStringsArg: should parse strings when provided as an inline JSON string', async () => {
        const str = `{ "en": "Hello", "ja": "こんにちは" }`;
        const result = await parseStringsArg(str, async () => Promise.resolve(''));
        expect(result).toBeDefined();
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
    });

    it('parseStringsArg: should merge arrays passed for --strings multiple times', async () => {
        const items = ['{"en":"Hello"}', '{"ja":"こんにちは"}'];
        const result = await parseStringsArg(items as unknown as string[], async () => Promise.resolve(''));
        expect(result).toBeDefined();
        expect(result?.en).toBe('Hello');
        expect(result?.ja).toBe('こんにちは');
    });
});
