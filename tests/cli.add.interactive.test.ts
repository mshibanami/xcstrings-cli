import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { readFile } from 'node:fs/promises';
import * as addCommand from '../src/commands/add';
import * as cli from '../src/utils/cli';
import * as interactive from '../src/utils/interactive';
import { cleanupTempFiles, setupTempFile } from './utils/testFileHelper';

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempFiles();
});

describe('cli add: interactive flag', () => {
    it('shows interactive flag in help output', async () => {
        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const args = ['--enable-source-maps', cliPath, 'add', '--help'];

        const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        const { code, stdout, stderr } = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => stdout += chunk);
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => resolvePromise({ code, stdout, stderr }));
        });

        expect(code).toBe(0);
        expect(stderr).toBe('');
        expect(stdout).toMatch(/--interactive/);
        expect(stdout).toMatch(/-i\b/);
    });

    it('rejects --interactive when --strings is provided', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');

        await expect(cli.runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: undefined,
            stringsArg: '{"en":"Hello"}',
            stringsFormat: 'json',
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        })).rejects.toThrow(/--interactive/);
    });

    it('routes to interactive handler when flag is set', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = 'en: Hello';
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        const result = await cli.runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        });

        expect(result).toEqual({ kind: 'single', keys: ['greeting'] });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');

        prompt.mockRestore();
    });

    it('captures YAML payload and adds a single entry', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = 'en: Hello\nja: こんにちは';
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        const result = await cli.runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        });

        expect(result).toEqual({ kind: 'single', keys: ['greeting'] });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja).toBeUndefined();

        prompt.mockRestore();
    });

    it('supports JSON payload and applies comment from payload', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = '{ "translations": { "en": "Hi" }, "comment": "Greeting" }';
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        const result = await cli.runAddCommand({
            path: tempFile,
            key: 'hello',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        });

        expect(result).toEqual({ kind: 'single', keys: ['hello'] });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.hello.comment).toBe('Greeting');
        expect(content.strings.hello.localizations.en.stringUnit.value).toBe('Hi');

        prompt.mockRestore();
    });

    it('adds multiple keys from interactive payload', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = 'greeting:\n  en: Hello\n  comment: Hi\nfarewell:\n  en: Bye';
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        const result = await cli.runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        });

        expect(result).toEqual({ kind: 'multi', keys: ['greeting', 'farewell'] });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.comment).toBe('Hi');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.farewell.localizations.en.stringUnit.value).toBe('Bye');

        prompt.mockRestore();
    });

    it('rejects empty interactive input', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue('   ');

        await expect(cli.runAddCommand({
            path: tempFile,
            key: 'empty',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        })).rejects.toThrow(/interactive input was empty/i);

        prompt.mockRestore();
    });

    it('shows friendly error on invalid interactive input', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue('not: [valid');

        await expect(cli.runAddCommand({
            path: tempFile,
            key: 'bad',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        })).rejects.toThrow(/interactive input/i);

        prompt.mockRestore();
    });

    it('prefers CLI comment over payload comment for single interactive payloads and preserves per-language state', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = '{ "translations": { "en": { "value": "Hi", "state": "new" } }, "comment": "payload-comment" }';
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        try {
            const result = await cli.runInteractiveAdd({
                path: tempFile,
                key: 'hello.interactive',
                comment: 'cli-comment',
                defaultString: undefined,
                language: undefined,
                configPath: undefined,
                state: 'needs_review',
            });

            expect(result).toEqual({ kind: 'single', keys: ['hello.interactive'] });
            const content = JSON.parse(await readFile(tempFile, 'utf-8'));
            expect(content.strings['hello.interactive'].comment).toBe('cli-comment');
            expect(content.strings['hello.interactive'].localizations.en.stringUnit).toEqual({ value: 'Hi', state: 'new' });
            expect(content.strings['hello.interactive'].localizations.ja).toBeUndefined();
        } finally {
            prompt.mockRestore();
        }
    });

    it('merges inline and translations entries for multi interactive payloads while preserving comments and per-language states', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const payload = `greeting:
  translations:
    en:
      value: Hello explicit
      state: stale
  en:
    value: Hello inline
    state: new
  ja: こんにちは
  comment: payload comment
farewell: Farewell comment`;
        const prompt = vi.spyOn(interactive, 'captureInteractiveStringsInput').mockResolvedValue(payload);

        try {
            const result = await cli.runInteractiveAdd({
                path: tempFile,
                key: undefined,
                comment: undefined,
                defaultString: undefined,
                language: undefined,
                configPath: undefined,
                state: 'needs_review',
            });

            expect(result).toEqual({ kind: 'multi', keys: ['greeting', 'farewell'] });
            const content = JSON.parse(await readFile(tempFile, 'utf-8'));
            expect(content.strings.greeting.comment).toBe('payload comment');
            expect(content.strings.greeting.localizations.en.stringUnit).toEqual({ value: 'Hello inline', state: 'new' });
            expect(content.strings.greeting.localizations.ja).toBeUndefined();
            expect(content.strings.farewell.comment).toBe('Farewell comment');
            expect(content.strings.farewell.localizations).toBeUndefined();
        } finally {
            prompt.mockRestore();
        }
    });
});
