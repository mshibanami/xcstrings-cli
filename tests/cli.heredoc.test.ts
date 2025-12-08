import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'child_process';

afterEach(async () => await cleanupTempFiles());

describe('cli: heredoc stdin', () => {
    it('should accept JSON from stdin when --strings flag passed without value (heredoc)', async () => {
        const stdin = JSON.stringify({ en: 'Hello', ja: 'こんにちは', 'zh-Hans': '你好，世界.' });

        const tempFile = await setupTempFile('no-strings.xcstrings');

        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'add' }), 'utf-8');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting',
            '--comment', 'Hello, World',
            '--strings',
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
});
