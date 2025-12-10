import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { FIXTURES_DIR } from './utils/resources';

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');
const fixturePath = resolve(FIXTURES_DIR, 'list-sample.xcstrings');

async function runList(extraArgs: string[]) {
    const args = ['--enable-source-maps', cliPath, 'strings', '--path', fixturePath, ...extraArgs];
    const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    return await new Promise<{ stdout: string; stderr: string; code: number }>((resolvePromise, reject) => {
        child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
        child.on('error', reject);
        child.on('exit', (code) => {
            resolvePromise({
                code: code ?? -1,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
            });
        });
    });
}

describe('cli: strings command', () => {
    it('lists all strings in default format', async () => {
        const { stdout, stderr, code } = await runList([]);
        expect(code).toBe(0);
        expect(stderr).toBe('');
        expect(stdout.trim()).toBe(`helloWorld:
  en: "Hello, World."
  ja: "こんにちは、世界。"
  zh-Hans: "你好，世界。"
goodbyeWorld:
  en: "Goodbye, World."
  ja: "さようなら、世界。"
goodMorning:
  en: "Good morning."
  ja: "おはようございます。"
noteWithColon:
  en: "Note: check settings"
emptyValue:
  en: ""
jaOnly:
  ja: "日本語のみ"`);
    });

    it('filters by key glob (default)', async () => {
        const { stdout, code } = await runList(['--key', 'good*']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`goodbyeWorld:
  en: "Goodbye, World."
  ja: "さようなら、世界。"
goodMorning:
  en: "Good morning."
  ja: "おはようございます。"`);
    });

    it('filters by key regex', async () => {
        const { stdout, code } = await runList(['--key-regex', 'World$']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`helloWorld:
  en: "Hello, World."
  ja: "こんにちは、世界。"
  zh-Hans: "你好，世界。"
goodbyeWorld:
  en: "Goodbye, World."
  ja: "さようなら、世界。"`);
    });

    it('filters by key substring', async () => {
        const { stdout, code } = await runList(['--key-substring', 'note']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`noteWithColon:
  en: "Note: check settings"`);
    });

    it('filters by text glob (default, per localization)', async () => {
        const { stdout, code } = await runList(['--text', '*World.*']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`helloWorld:
  en: "Hello, World."
goodbyeWorld:
  en: "Goodbye, World."`);
    });

    it('filters by text regex', async () => {
        const { stdout, code } = await runList(['--text-regex', 'こんにちは']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`helloWorld:
  ja: "こんにちは、世界。"`);
    });

    it('filters by text substring', async () => {
        const { stdout, code } = await runList(['--text-substring', '世界']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`helloWorld:
  ja: "こんにちは、世界。"
  zh-Hans: "你好，世界。"
goodbyeWorld:
  ja: "さようなら、世界。"`);
    });

    it('filters languages and preserves order', async () => {
        const { stdout, code } = await runList(['--languages', 'en', 'ja']);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe(`helloWorld:
  en: "Hello, World."
  ja: "こんにちは、世界。"
goodbyeWorld:
  en: "Goodbye, World."
  ja: "さようなら、世界。"
goodMorning:
  en: "Good morning."
  ja: "おはようございます。"
noteWithColon:
  en: "Note: check settings"
emptyValue:
  en: ""
jaOnly:
  ja: "日本語のみ"`);
    });

    it('supports mustache format per localization', async () => {
        const { stdout, code } = await runList([
            '--languages', 'en', 'ja',
            '--format', '[{{language}}] {{key}} => {{text}}',
            '--key', 'good*'
        ]);
        expect(code).toBe(0);
        expect(stdout.trim()).toBe([
            '[en] goodbyeWorld => Goodbye, World.',
            '[ja] goodbyeWorld => さようなら、世界。',
            '[en] goodMorning => Good morning.',
            '[ja] goodMorning => おはようございます。',
        ].join('\n'));
    });
});
