import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { FIXTURES_DIR } from './utils/resources';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';
import { runAddCommand } from '../src/utils/cli';
import logger from '../src/utils/logger';
import { readFile } from 'node:fs/promises';

afterEach(async () => await cleanupTempFiles());

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

    it('warns and skips unsupported language when missingLanguagePolicy is skip', async () => {
        const warnSpy = vi.spyOn(logger, 'warn');
        const tempFile = await setupTempFile('no-strings.xcstrings');

        await runAddCommand({
            path: tempFile,
            key: 'greeting-fr',
            comment: 'Hello, World',
            stringsArg: undefined,
            defaultString: 'Bonjour',
            language: 'fr',
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
        });

        const { strings } = JSON.parse(await readFile(tempFile, 'utf-8')) as { strings: Record<string, unknown> };
        expect(strings['greeting-fr']).toBeDefined();
        // fr should be skipped because it's unsupported in fixture (sourceLanguage=en only)
        expect((strings['greeting-fr'] as any).localizations?.fr).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
