import { describe, it, expect, afterEach } from 'vitest';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'child_process';
import { FIXTURES_DIR, TEMP_DIR } from './utils/resources';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { cleanupTempFiles, createdFiles } from './utils/testFileHelper';

function getTempPath(name: string) {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
    const dest = resolve(TEMP_DIR, unique);
    createdFiles.push(dest);
    return dest;
}

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');

afterEach(async () => await cleanupTempFiles());

async function runImport(
    sources: string[],
    target: string,
    extraArgs: string[] = [],
) {
    const args = [
        '--enable-source-maps',
        cliPath,
        'import',
        ...sources,
        '--target',
        target,
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

describe('cli: import command', () => {
    it('imports from a single .strings file to a new .xcstrings file', async () => {
        const tempDir = getTempPath('import-single-strings');
        await mkdir(tempDir, { recursive: true });
        const sourceDir = join(tempDir, 'ja.lproj');
        await mkdir(sourceDir, { recursive: true });
        const sourceFile = join(sourceDir, 'Localizable.strings');
        await writeFile(
            sourceFile,
            '/* Greeting */\n"hello" = "こんにちは";',
            'utf8',
        );

        const targetFile = join(tempDir, 'Localizable.xcstrings');

        const { code, stderr } = await runImport([sourceFile], targetFile, [
            '--source-language',
            'en',
        ]);

        expect(code).toBe(0);
        expect(await pathExists(targetFile)).toBe(true);

        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.sourceLanguage).toBe('en');
        expect(content.strings.hello.localizations.ja.stringUnit.value).toBe(
            'こんにちは',
        );
        expect(content.strings.hello.comment).toBe('Greeting');
    });

    it('imports from multiple .strings files using glob', async () => {
        const tempDir = getTempPath('import-glob-strings');
        await mkdir(tempDir, { recursive: true });

        const jaDir = join(tempDir, 'ja.lproj');
        await mkdir(jaDir, { recursive: true });
        await writeFile(
            join(jaDir, 'Localizable.strings'),
            '"hello" = "こんにちは";',
            'utf8',
        );

        const enDir = join(tempDir, 'en.lproj');
        await mkdir(enDir, { recursive: true });
        await writeFile(
            join(enDir, 'Localizable.strings'),
            '"hello" = "Hello";',
            'utf8',
        );

        const targetFile = join(tempDir, 'Localizable.xcstrings');

        const { code } = await runImport(
            [join(tempDir, '**/*.strings')],
            targetFile,
            ['--source-language', 'en'],
        );

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.hello.localizations.ja.stringUnit.value).toBe(
            'こんにちは',
        );
        expect(content.strings.hello.localizations.en.stringUnit.value).toBe(
            'Hello',
        );
    });

    it('merges with source-first policy (default)', async () => {
        const tempDir = getTempPath('import-merge-source-first');
        await mkdir(tempDir, { recursive: true });

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await writeFile(
            targetFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    hello: {
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Old Hello',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const sourceFile = join(tempDir, 'en.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(sourceFile, '"hello" = "New Hello";', 'utf8');

        const { code } = await runImport([sourceFile], targetFile);

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.hello.localizations.en.stringUnit.value).toBe(
            'New Hello',
        );
    });

    it('merges with destination-first policy', async () => {
        const tempDir = getTempPath('import-merge-dest-first');
        await mkdir(tempDir, { recursive: true });

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await writeFile(
            targetFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    hello: {
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Old Hello',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const sourceFile = join(tempDir, 'en.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(sourceFile, '"hello" = "New Hello";', 'utf8');

        const { code } = await runImport([sourceFile], targetFile, [
            '--import-merge-policy',
            'destination-first',
        ]);

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.hello.localizations.en.stringUnit.value).toBe(
            'Old Hello',
        );
    });

    it('fails with error policy on conflict', async () => {
        const tempDir = getTempPath('import-merge-error');
        await mkdir(tempDir, { recursive: true });

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await writeFile(
            targetFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    hello: {
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Old Hello',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const sourceFile = join(tempDir, 'en.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(sourceFile, '"hello" = "New Hello";', 'utf8');

        const { code, stderr } = await runImport([sourceFile], targetFile, [
            '--import-merge-policy',
            'error',
        ]);

        expect(code).not.toBe(0);
        expect(stderr).toMatch(/already has localization/);
    });

    it('imports from another .xcstrings file', async () => {
        const tempDir = getTempPath('import-xcstrings');
        await mkdir(tempDir, { recursive: true });

        const sourceFile = join(tempDir, 'Source.xcstrings');
        await writeFile(
            sourceFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    welcome: {
                        extractionState: 'manual',
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Welcome',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await writeFile(
            targetFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    hello: {
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Hello',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const { code } = await runImport([sourceFile], targetFile);

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings).toHaveProperty('hello');
        expect(content.strings).toHaveProperty('welcome');
        expect(content.strings.welcome.extractionState).toBe('manual');
    });

    it('sets extractionState to migrated and state to translated for .strings', async () => {
        const tempDir = getTempPath('import-metadata');
        await mkdir(tempDir, { recursive: true });
        const sourceFile = join(tempDir, 'ja.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(sourceFile, '"test" = "value";', 'utf8');

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        const { code } = await runImport([sourceFile], targetFile, [
            '--source-language',
            'en',
        ]);

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.test.extractionState).toBe('migrated');
        expect(content.strings.test.localizations.ja.stringUnit.state).toBe(
            'translated',
        );
    });

    it('handles importMergePolicy from config file', async () => {
        const tempDir = getTempPath('import-config-policy');
        await mkdir(tempDir, { recursive: true });

        const configFile = join(tempDir, 'xcstrings-cli.json');
        await writeFile(
            configFile,
            JSON.stringify({
                importMergePolicy: 'destination-first',
            }),
        );

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await writeFile(
            targetFile,
            JSON.stringify({
                sourceLanguage: 'en',
                strings: {
                    hello: {
                        localizations: {
                            en: {
                                stringUnit: {
                                    value: 'Old',
                                    state: 'translated',
                                },
                            },
                        },
                    },
                },
            }),
        );

        const sourceFile = join(tempDir, 'en.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(sourceFile, '"hello" = "New";', 'utf8');

        const { code } = await runImport([sourceFile], targetFile, [
            '--config',
            configFile,
        ]);

        expect(code).toBe(0);
        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.hello.localizations.en.stringUnit.value).toBe(
            'Old',
        );
    });

    it('handles complex escape characters in .strings', async () => {
        const tempDir = getTempPath('import-complex');
        await mkdir(tempDir, { recursive: true });
        const sourceFile = join(tempDir, 'ja.lproj', 'Localizable.strings');
        await mkdir(dirname(sourceFile), { recursive: true });
        await writeFile(
            sourceFile,
            '"complex" = "Line 1\\nLine 2\\tTabbed \\"Quote\\" Done.";',
            'utf8',
        );

        const targetFile = join(tempDir, 'Localizable.xcstrings');
        await runImport([sourceFile], targetFile, ['--source-language', 'en']);

        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.strings.complex.localizations.ja.stringUnit.value).toBe(
            'Line 1\nLine 2\tTabbed "Quote" Done.',
        );
    });
});
