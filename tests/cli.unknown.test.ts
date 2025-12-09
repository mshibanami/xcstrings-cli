import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { FIXTURES_DIR } from './utils/resources';

describe('cli: unknown command', () => {
    it('should exit non-zero and print help when unknown subcommand is passed', async () => {
        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const args = ['--enable-source-maps', cliPath, 'hello'];

        const child = spawn(node, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        await new Promise<void>((resolvePromise) => {
            let stderr = '';
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => {
                expect(code).not.toBe(0);
                expect(stderr).toMatch(/Unknown/i);
                expect(stderr).toMatch(/xcstrings/);
                resolvePromise();
            });
        });
    });

    it('should reject unsupported language when missingLanguagePolicy is skip', async () => {
        const node = process.execPath;
        const cliPath = resolve(process.cwd(), 'dist', 'index.js');
        const tempFile = resolve(FIXTURES_DIR, 'no-strings.xcstrings');
        const args = [
            '--enable-source-maps', cliPath,
            'add',
            '--key', 'greeting-fr',
            '--comment', 'Hello, World',
            '--text', 'Bonjour',
            '--language', 'fr',
            '--path', tempFile,
        ];

        const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        await new Promise<void>((resolvePromise) => {
            let stderr = '';
            child.stderr.on('data', (chunk) => stderr += chunk);
            child.on('exit', (code) => {
                expect(code).not.toBe(0);
                expect(stderr).toMatch(/not supported/i);
                resolvePromise();
            });
        });
    });
});
