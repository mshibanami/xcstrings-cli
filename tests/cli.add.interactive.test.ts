import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import * as cli from '../src/utils/cli';
import { cleanupTempFiles, setupTempFile } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

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
        expect(stdout).toMatch(/\b-i\b/);
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
        const spy = vi.spyOn(cli, 'runInteractiveAdd').mockResolvedValue({ kind: 'single', keys: ['interactive-key'] });

        const result = await cli.runAddCommand({
            path: tempFile,
            key: 'greeting',
            comment: undefined,
            stringsArg: undefined,
            stdinReader: async () => Promise.resolve(''),
            configPath: undefined,
            interactive: true,
        });

        expect(result).toEqual({ kind: 'single', keys: ['interactive-key'] });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ path: tempFile, key: 'greeting', state: 'translated' }));

        spy.mockRestore();
    });
});
