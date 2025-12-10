import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'child_process';
import { runAddCommand } from '../src/utils/cli';
import logger from '../src/utils/logger';

afterEach(async () => await cleanupTempFiles());

describe('cli: heredoc stdin', () => {
    it('should accept JSON from stdin when --strings flag passed without value (heredoc)', async () => {
        const stdin = JSON.stringify({ en: 'Hello', ja: 'こんにちは', 'zh-Hans': '你好，世界.' });

        const tempFile = await setupTempFile('no-strings.xcstrings');

        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting',
            '--comment', 'Hello, World',
            '--strings',
            '--strings-format', 'json',
            '--path', tempFile,
            '--config', tempConfigPath
        ];
        const child = spawn(node, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        child.stdin.write(stdin);
        child.stdin.end();
        await new Promise<void>((resolvePromise, reject) => {
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => stdout += chunk);
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Process exited with non-zero code ${code}. Stderr: ${stderr}`));
                } else {
                    resolvePromise();
                }
            });
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('greeting');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings.greeting.localizations['zh-Hans'].stringUnit.value).toBe('你好，世界.');
    });

    it('should add text to specified language when --language is provided', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');

        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting-ja-only',
            '--comment', 'Hello, World',
            '--text', 'こんにちは',
            '--language', 'ja',
            '--path', tempFile,
            '--config', tempConfigPath
        ];
        const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        await new Promise<void>((resolvePromise, reject) => {
            let stderr = '';
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Process exited with non-zero code ${code}. Stderr: ${stderr}`));
                } else {
                    resolvePromise();
                }
            });
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('greeting-ja-only');
        expect(content.strings['greeting-ja-only'].localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings['greeting-ja-only'].localizations.en).toBeUndefined();
    });

    it('adds multiple strings from heredoc-style payload without --key/--comment', async () => {
        const yaml = `greeting:\n  translations:\n    en: Hello\n    ja: こんにちは\n  comment: Greeting message\nfarewell:\n  en: Goodbye\n  comment: Farewell message\n`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        await runAddCommand({
            path: tempFile,
            key: undefined,
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.comment).toBe('Greeting message');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings.farewell.comment).toBe('Farewell message');
        expect(content.strings.farewell.localizations.en.stringUnit.value).toBe('Goodbye');
    });

    it('warns and skips unsupported languages when missingLanguagePolicy=skip', async () => {
        const warnSpy = vi.spyOn(logger, 'warn');
        const yaml = `en: Hello\nxx: Hallo`;
        const tempFile = await setupTempFile('no-strings.xcstrings');

        await runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: undefined,
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.xx).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
