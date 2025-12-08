import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';

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
});
