import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { init } from '../src/commands/init.js';
import * as prompts from '@inquirer/prompts';

vi.mock('@inquirer/prompts');
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('init command - directory skipping', () => {
    const testDir = resolve(process.cwd(), 'tests/temp-init-test');

    beforeEach(async () => {
        if (existsSync(testDir)) {
            await rm(testDir, { recursive: true, force: true });
        }
        await mkdir(testDir, { recursive: true });
        vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        if (existsSync(testDir)) {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it('should skip ignored directories like node_modules and .git', async () => {
        const srcDir = resolve(testDir, 'src');
        await mkdir(srcDir);
        await writeFile(resolve(srcDir, 'Localizable.xcstrings'), '{}');

        const nodeModulesDir = resolve(testDir, 'node_modules/some-lib');
        await mkdir(nodeModulesDir, { recursive: true });
        await writeFile(resolve(nodeModulesDir, 'Ignored.xcstrings'), '{}');

        const buildDir = resolve(testDir, '.build');
        await mkdir(buildDir);
        await writeFile(resolve(buildDir, 'SwiftPM.xcstrings'), '{}');

        vi.mocked(prompts.checkbox).mockResolvedValue([
            'src/Localizable.xcstrings',
        ]);
        vi.mocked(prompts.select).mockResolvedValue('none');
        vi.mocked(prompts.confirm).mockResolvedValue(true);

        await init();

        const checkboxCall = vi.mocked(prompts.checkbox).mock.calls[0][0];
        const choices = checkboxCall.choices as any[];

        const paths = choices.map((c) => c.value);
        expect(paths).toContain('src/Localizable.xcstrings');
        expect(paths).not.toContain('node_modules/some-lib/Ignored.xcstrings');
        expect(paths).not.toContain('.build/SwiftPM.xcstrings');
    });
});
