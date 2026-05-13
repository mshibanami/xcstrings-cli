import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');

async function runCli(args: string[]): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
}> {
    return await new Promise((resolvePromise, reject) => {
        const child = spawn(node, ['--enable-source-maps', cliPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
        child.on('error', reject);
        child.on('exit', (code) => {
            resolvePromise({
                code,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
            });
        });
    });
}

describe('cli: mcp command help', () => {
    it('shows help for xcs mcp', async () => {
        const { code, stdout, stderr } = await runCli(['mcp', '--help']);

        expect(code).toBe(0);
        expect(stderr).toBe('');
        expect(stdout).toMatch(/\bxcs mcp\b/i);
        expect(stdout).toMatch(/MCP/i);
    });
});
