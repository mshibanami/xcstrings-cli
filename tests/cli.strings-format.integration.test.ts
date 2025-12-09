import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'child_process';
import { runAddCommand } from '../src/utils/cli';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

describe('cli: strings-format integration', () => {
    it('accepts YAML inline when --strings-format yaml', async () => {
        const yaml = 'en: Hello\nja: こんにちは\nzh-Hans: 你好，世界.';
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        await runAddCommand({
            path: tempFile,
            key: 'greeting-yaml',
            comment: 'Hello, World',
            stringsArg: yaml,
            stringsFormat: 'yaml',
            stdinReader: async () => Promise.resolve(''),
            configPath: tempConfigPath,
        });

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings['greeting-yaml'].localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings['greeting-yaml'].localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings['greeting-yaml'].localizations['zh-Hans'].stringUnit.value).toBe('你好，世界.');
    });

    it('accepts JSON5 inline when --strings-format json', async () => {
        const json5 = `{
            en: 'Hello',
            ja: 'こんにちは',
            'zh-Hans': '你好，世界.',
        }`;
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');

        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting-json5',
            '--comment', 'Hello, World',
            '--strings', json5,
            '--strings-format', 'json',
            '--path', tempFile,
            '--config', tempConfigPath,
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
        expect(content.strings['greeting-json5'].localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings['greeting-json5'].localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings['greeting-json5'].localizations['zh-Hans'].stringUnit.value).toBe('你好，世界.');
    });
});
