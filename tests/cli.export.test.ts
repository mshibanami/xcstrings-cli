import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
import { FIXTURES_DIR, TEMP_DIR } from './utils/resources';
import { readFile, mkdir, writeFile, stat, access } from 'node:fs/promises';
import { cleanupTempFiles, createdFiles } from './utils/testFileHelper';

function getTempPath(name: string) {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
    const dest = resolve(TEMP_DIR, unique);
    createdFiles.push(dest);
    return dest;
}

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');
const fixturePath = resolve(FIXTURES_DIR, 'list-sample.xcstrings');

afterEach(async () => await cleanupTempFiles());

async function runExport(pathArg: string, extraArgs: string[]) {
    const args = [
        '--enable-source-maps',
        cliPath,
        'export',
        '--path',
        fixturePath,
        pathArg,
        ...extraArgs,
    ];
    const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    return await new Promise<{ stdout: string; stderr: string; code: number }>(
        (resolvePromise, reject) => {
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
        },
    );
}

async function pathExists(path: string) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

describe('cli: export command', () => {
    it('requires the output path positional argument', async () => {
        const args = [
            '--enable-source-maps',
            cliPath,
            'export',
            '--path',
            fixturePath,
        ];
        const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        let stderr = '';
        child.stderr.on('data', (chunk) => (stderr += chunk.toString('utf8')));

        const code = await new Promise((resolve) =>
            child.on('exit', (c) => resolve(c)),
        );
        expect(code).toBe(1);
        expect(stderr).toMatch(/Not enough non-option arguments/);
    });

    describe('output to xcstrings', () => {
        it('exports all to a new xcstrings file by default', async () => {
            const outPath = getTempPath('new-output.xcstrings');
            const { code, stderr } = await runExport(outPath, []);
            expect(code).toBe(0);
            expect(stderr).toBe('');

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.sourceLanguage).toBe('en');
            expect(Object.keys(content.strings).length).toBeGreaterThan(0);
            expect(content.strings).toHaveProperty('helloWorld');
            expect(content.strings).toHaveProperty('goodbyeWorld');
        });

        it('supports filtering by key', async () => {
            const outPath = getTempPath('new-output-filtered.xcstrings');
            const { code } = await runExport(outPath, ['--key', 'good*']);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.strings).toHaveProperty('goodbyeWorld');
            expect(content.strings).toHaveProperty('goodMorning');
            expect(content.strings).not.toHaveProperty('helloWorld');
        });

        it('supports filtering by languages', async () => {
            const outPath = getTempPath('new-output-langs.xcstrings');
            const { code } = await runExport(outPath, [
                '--languages',
                'en',
                'ja',
            ]);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.strings.helloWorld.localizations).toHaveProperty(
                'en',
            );
            expect(content.strings.helloWorld.localizations).toHaveProperty(
                'ja',
            );
            expect(content.strings.helloWorld.localizations).not.toHaveProperty(
                'zh-Hans',
            );
        });

        it('infers xcstrings output format from extension', async () => {
            const outPath = getTempPath('inferred.xcstrings');
            const { code } = await runExport(outPath, []);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.strings).toHaveProperty('helloWorld');
        });

        it('prioritizes explicit --output xcstrings over a .strings extension', async () => {
            const tempDir = getTempPath('explicit-output-priority');
            await mkdir(tempDir, { recursive: true });
            const conflictingPath = resolve(tempDir, 'Localizable.strings');
            const expectedXCStringsPath = resolve(
                tempDir,
                'Localizable.xcstrings',
            );

            const { code, stderr } = await runExport(conflictingPath, [
                '--output',
                'xcstrings',
            ]);

            expect(code).toBe(0);
            expect(stderr).toBe('');
            expect(await pathExists(conflictingPath)).toBe(false);
            expect(await pathExists(expectedXCStringsPath)).toBe(true);

            const content = JSON.parse(
                await readFile(expectedXCStringsPath, 'utf-8'),
            );
            expect(content.strings).toHaveProperty('helloWorld');
        });
    });

    describe('output to strings', () => {
        it('infers strings format from explicitly providing --output strings', async () => {
            const tempDir = getTempPath('strings-out-1');
            await mkdir(tempDir, { recursive: true });
            const outPrefix = resolve(tempDir, 'Output');
            const { code, stderr } = await runExport(outPrefix, [
                '--output',
                'strings',
            ]);
            expect(code).toBe(0);
            expect(stderr).toBe('');

            const enPath = resolve(tempDir, 'en.lproj', 'Output.strings');
            const jaPath = resolve(tempDir, 'ja.lproj', 'Output.strings');

            const enContent = await readFile(enPath, 'utf-8');
            expect(enContent).toContain('"helloWorld" = "Hello, World.";');
            expect(enContent).toContain('"goodbyeWorld" = "Goodbye, World.";');

            const jaContent = await readFile(jaPath, 'utf-8');
            expect(jaContent).toContain('"helloWorld" = "こんにちは、世界。";');
            expect(jaContent).toContain(
                '"goodbyeWorld" = "さようなら、世界。";',
            );
        });

        it('errors if contradicting configurations are provided', async () => {
            const { code, stderr } = await runExport('output.xcstrings', [
                '--output',
                'strings',
            ]);
            expect(code).not.toBe(0);
            expect(stderr).toMatch(/Output format mismatch/);
        });
    });

    describe('merge policies', () => {
        it('fails if target exists and policy is error (default)', async () => {
            const outPath = getTempPath('existing.xcstrings');
            await writeFile(outPath, '{}');
            const { code, stderr } = await runExport(outPath, []);
            expect(code).toBe(1);
            expect(stderr).toMatch(/already exists/);
        });

        it('does not partially write strings outputs when policy is error', async () => {
            const tempDir = getTempPath('strings-error-no-partial-write');
            await mkdir(tempDir, { recursive: true });
            const outPrefix = resolve(tempDir, 'Output');
            const jaDir = resolve(tempDir, 'ja.lproj');
            const jaFile = resolve(jaDir, 'Output.strings');
            const enFile = resolve(tempDir, 'en.lproj', 'Output.strings');

            await mkdir(jaDir, { recursive: true });
            await writeFile(jaFile, '"helloWorld" = "Old Hello";\n', 'utf-8');

            const { code, stderr } = await runExport(outPrefix, [
                '--output',
                'strings',
            ]);

            expect(code).toBe(1);
            expect(stderr).toMatch(/already exists/);
            expect(await pathExists(enFile)).toBe(false);
            expect(await readFile(jaFile, 'utf-8')).toBe(
                '"helloWorld" = "Old Hello";\n',
            );
        });

        it('overwrites if target exists and policy is force', async () => {
            const outPath = getTempPath('force.xcstrings');
            await writeFile(outPath, '{"invalid": true}');
            const { code } = await runExport(outPath, [
                '--merge-policy',
                'force',
            ]);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.strings).toHaveProperty('helloWorld');
            expect(content).not.toHaveProperty('invalid');
        });

        it('replaces an existing directory when force exporting xcstrings', async () => {
            const outPath = getTempPath('force-dir.xcstrings');
            await mkdir(outPath, { recursive: true });
            await writeFile(resolve(outPath, 'stale.txt'), 'stale', 'utf-8');

            const { code, stderr } = await runExport(outPath, [
                '--merge-policy',
                'force',
            ]);

            expect(code).toBe(0);
            expect(stderr).toBe('');

            const stats = await stat(outPath);
            expect(stats.isFile()).toBe(true);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(content.strings).toHaveProperty('helloWorld');
        });

        it('merges output-first for xcstrings', async () => {
            const outPath = getTempPath('output-first.xcstrings');
            await writeFile(
                outPath,
                JSON.stringify({
                    sourceLanguage: 'en',
                    strings: {
                        helloWorld: {
                            localizations: {
                                en: {
                                    stringUnit: {
                                        value: 'Old Hello',
                                        state: 'translated',
                                    },
                                },
                            },
                        },
                        extraKey: {
                            localizations: {
                                en: {
                                    stringUnit: {
                                        value: 'Extra',
                                        state: 'translated',
                                    },
                                },
                            },
                        },
                    },
                }),
            );
            const { code } = await runExport(outPath, [
                '--merge-policy',
                'output-first',
            ]);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(
                content.strings.helloWorld.localizations.en.stringUnit.value,
            ).toBe('Hello, World.');
            expect(
                content.strings.extraKey.localizations.en.stringUnit.value,
            ).toBe('Extra');
        });

        it('merges existing-first for xcstrings', async () => {
            const outPath = getTempPath('existing-first.xcstrings');
            await writeFile(
                outPath,
                JSON.stringify({
                    sourceLanguage: 'en',
                    strings: {
                        helloWorld: {
                            localizations: {
                                en: {
                                    stringUnit: {
                                        value: 'Old Hello',
                                        state: 'translated',
                                    },
                                },
                            },
                        },
                        extraKey: {
                            localizations: {
                                en: {
                                    stringUnit: {
                                        value: 'Extra',
                                        state: 'translated',
                                    },
                                },
                            },
                        },
                    },
                }),
            );
            const { code } = await runExport(outPath, [
                '--merge-policy',
                'existing-first',
            ]);
            expect(code).toBe(0);

            const content = JSON.parse(await readFile(outPath, 'utf-8'));
            expect(
                content.strings.helloWorld.localizations.en.stringUnit.value,
            ).toBe('Old Hello');
            expect(
                content.strings.goodbyeWorld.localizations.en.stringUnit.value,
            ).toBe('Goodbye, World.');
        });

        it('merges output-first for strings', async () => {
            const tempDir = getTempPath('strings-merge-1');
            await mkdir(tempDir, { recursive: true });
            const outPrefix = resolve(tempDir, 'MergeOutput');
            const enLproj = resolve(tempDir, 'en.lproj');
            await mkdir(enLproj, { recursive: true });
            const enPath = resolve(enLproj, 'MergeOutput.strings');
            await writeFile(
                enPath,
                '"helloWorld" = "Old Hello";\n"extraKey" = "Extra";\n',
            );

            const { code } = await runExport(outPrefix, [
                '--output',
                'strings',
                '--merge-policy',
                'output-first',
            ]);
            expect(code).toBe(0);

            const enContent = await readFile(enPath, 'utf-8');
            expect(enContent).toContain('"helloWorld" = "Hello, World.";');
            expect(enContent).toContain('"extraKey" = "Extra";');
        });

        it('merges existing-first for strings', async () => {
            const tempDir = getTempPath('strings-merge-2');
            await mkdir(tempDir, { recursive: true });
            const outPrefix = resolve(tempDir, 'MergeOutput2');
            const enLproj = resolve(tempDir, 'en.lproj');
            await mkdir(enLproj, { recursive: true });
            const enPath = resolve(enLproj, 'MergeOutput2.strings');
            await writeFile(
                enPath,
                '"helloWorld" = "Old Hello";\n"extraKey" = "Extra";\n',
            );

            const { code } = await runExport(outPrefix, [
                '--output',
                'strings',
                '--merge-policy',
                'existing-first',
            ]);
            expect(code).toBe(0);

            const enContent = await readFile(enPath, 'utf-8');
            expect(enContent).toContain('"helloWorld" = "Old Hello";');
            expect(enContent).toContain('"extraKey" = "Extra";');
            expect(enContent).toContain('"goodbyeWorld" = "Goodbye, World.";');
        });

        it('removes stale localized files when force exporting strings', async () => {
            const tempDir = getTempPath('strings-force-cleans-stale');
            await mkdir(tempDir, { recursive: true });
            const outPrefix = resolve(tempDir, 'Output');
            const staleDir = resolve(tempDir, 'ja.lproj');
            const staleFile = resolve(staleDir, 'Output.strings');

            await mkdir(staleDir, { recursive: true });
            await writeFile(staleFile, '"stale" = "old";\n', 'utf-8');

            const { code, stderr } = await runExport(outPrefix, [
                '--output',
                'strings',
                '--merge-policy',
                'force',
                '--languages=en',
            ]);

            expect(code).toBe(0);
            expect(stderr).toBe('');
            expect(await pathExists(staleFile)).toBe(false);

            const enFile = resolve(tempDir, 'en.lproj', 'Output.strings');
            expect(await pathExists(enFile)).toBe(true);
            const enContent = await readFile(enFile, 'utf-8');
            expect(enContent).toContain('"helloWorld" = "Hello, World.";');
        });
    });
});
