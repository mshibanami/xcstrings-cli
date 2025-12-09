import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';
import { TEMP_DIR } from './utils/resources';
import { readFile } from 'node:fs/promises';

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');

const createdConfigs: string[] = [];

async function createTempConfig(content: unknown): Promise<string> {
    if (!existsSync(TEMP_DIR)) {
        await mkdir(TEMP_DIR, { recursive: true });
    }
    const configPath = resolve(TEMP_DIR, `config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(configPath, JSON.stringify(content), 'utf-8');
    createdConfigs.push(configPath);
    return configPath;
}

async function cleanupConfigs(): Promise<void> {
    for (const file of createdConfigs) {
        try {
            await unlink(file);
        } catch {
            // ignore cleanup errors
        }
    }
    createdConfigs.length = 0;
}

async function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return await new Promise((resolvePromise) => {
        const child = spawn(node, ['--enable-source-maps', cliPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => stdout += chunk);
        child.stderr.on('data', (chunk) => stderr += chunk);
        child.on('exit', (code) => resolvePromise({ code, stdout, stderr }));
    });
}

afterEach(async () => {
    await cleanupTempFiles();
    await cleanupConfigs();
});

describe('cli: --path alias resolution', () => {
    it('accepts bare alias from config', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const configPath = await createTempConfig({
            xcstringsPaths: [
                { alias: 'utils', path: tempFile }
            ]
        });

        const { code, stderr } = await runCli([
            'add',
            '--key', 'alias-bare',
            '--comment', 'hello',
            '--text', 'Hello',
            '--path', 'utils',
            '--config', configPath,
        ]);

        expect(code).toBe(0);
        expect(stderr).toBe('');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('alias-bare');
    });

    it('accepts alias:foo format', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const configPath = await createTempConfig({
            xcstringsPaths: [
                { alias: 'core', path: tempFile }
            ]
        });

        const { code, stderr } = await runCli([
            'add',
            '--key', 'alias-format',
            '--comment', 'hello',
            '--text', 'Hello',
            '--path', 'alias:core',
            '--config', configPath,
        ]);

        expect(code).toBe(0);
        expect(stderr).toBe('');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('alias-format');
    });

    it('errors for unknown alias before checking file existence', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const configPath = await createTempConfig({
            xcstringsPaths: [
                { alias: 'core', path: tempFile }
            ]
        });

        const { code, stderr } = await runCli([
            'add',
            '--key', 'alias-missing',
            '--comment', 'hello',
            '--text', 'Hello',
            '--path', 'missing',
            '--config', configPath,
        ]);

        expect(code).not.toBe(0);
        expect(stderr).toMatch(/unknown alias/i);

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).not.toHaveProperty('alias-missing');
    });
});
