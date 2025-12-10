import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { runAddCommand } from '../src/utils/cli';
import { cleanupTempFiles, setupTempFile } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

describe('cli add: state (single)', () => {
    it('defaults state to translated when not provided', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');

        await runAddCommand({
            path: tempFile,
            key: 'greeting-default-state',
            comment: undefined,
            stringsArg: undefined,
            defaultString: 'Hello',
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings['greeting-default-state'].localizations.en.stringUnit.state).toBe('translated');
    });

    it('applies explicit state to default string and translations when text is provided', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        await runAddCommand({
            path: tempFile,
            key: 'greeting-review',
            comment: undefined,
            stringsArg: '{"ja":"こんにちは"}',
            stringsFormat: 'json',
            defaultString: 'Hello',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
            state: 'needs_review',
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings['greeting-review'].localizations.en.stringUnit.state).toBe('needs_review');
        expect(content.strings['greeting-review'].localizations.ja.stringUnit.state).toBe('needs_review');
    });

    it('rejects invalid state values with a clear message', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        await expect(runAddCommand({
            path: tempFile,
            key: 'greeting-invalid-state',
            comment: undefined,
            stringsArg: undefined,
            defaultString: 'Hello',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
            state: 'pending',
        })).rejects.toThrow('Invalid state "pending". Allowed values: translated, needs_review, new, stale.');
    });
});

describe('cli add: state (multi)', () => {
    it('applies per-language states and falls back to --state for multi payloads', async () => {
        const yaml = `welcome:\n  translations:\n    en:\n      value: Hello\n      state: stale\n    ja:\n      value: こんにちは\nfarewell:\n  en:\n    value: Goodbye\n`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        const result = await runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
            state: 'needs_review',
        });

        expect(result.kind).toBe('multi');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.welcome.localizations.en.stringUnit.state).toBe('stale');
        expect(content.strings.welcome.localizations.ja.stringUnit.state).toBe('needs_review');
        expect(content.strings.farewell.localizations.en.stringUnit.state).toBe('needs_review');
    });

    it('rejects invalid per-language state values with a clear message', async () => {
        const yaml = `welcome:\n  en:\n    value: Welcome\n    state: pending\n`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        await expect(runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
        })).rejects.toThrow('Invalid state "pending". Allowed values: translated, needs_review, new, stale.');
    });

    it('defaults to translated for string shorthand translations', async () => {
        const yaml = `greeting:\n  en: Hello\n  ja: こんにちは\n`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        const result = await runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
        });

        expect(result.kind).toBe('multi');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.localizations.en.stringUnit.state).toBe('translated');
        expect(content.strings.greeting.localizations.ja.stringUnit.state).toBe('translated');
    });

    it('respects missingLanguagePolicy when applying per-language states', async () => {
        const yaml = `welcome:\n  en:\n    value: Welcome\n  ja:\n    value: ようこそ\n`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'skip' }), 'utf-8');

        const result = await runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
            state: 'new',
        });

        expect(result.kind).toBe('multi');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.welcome.localizations.en.stringUnit.state).toBe('new');
        expect(content.strings.welcome.localizations.ja).toBeUndefined();
    });
});

describe('cli add: state (cli validation)', () => {
    it('rejects invalid state values case-sensitively at the CLI layer', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');

        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting-cli-invalid-state',
            '--text', 'Hello',
            '--state', 'Translated',
            '--path', tempFile,
        ];

        const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        const { code, stderr } = await new Promise<{ code: number | null; stderr: string }>((resolvePromise) => {
            let stderr = '';
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => resolvePromise({ code, stderr }));
        });

        expect(code).not.toBe(0);
        expect(stderr).toMatch(/Invalid/i);
        expect(stderr).toMatch(/Translated/);
        expect(stderr).toMatch(/translated[\s\S]*needs_review[\s\S]*new[\s\S]*stale/);
    });
});
