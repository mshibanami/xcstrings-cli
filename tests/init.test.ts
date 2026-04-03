import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init } from '../src/commands/init';
import { writeFile, mkdir, rm, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as prompts from '@inquirer/prompts';
import yaml from 'js-yaml';
import { SwiftPackageState } from '../src/utils/swift-package';

vi.mock('@inquirer/prompts');

const TEST_DIR = resolve(__dirname, 'temp-init-test');

describe('init command', () => {
    beforeEach(async () => {
        await mkdir(TEST_DIR, { recursive: true });
        vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
        // vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    it('should omit xcodeprojPaths from YAML if no xcodeproj found in a Swift package', async () => {
        await writeFile(join(TEST_DIR, 'Package.swift'), 'name: "Test"');
        vi.mocked(prompts.checkbox).mockResolvedValue([]);
        vi.mocked(prompts.select).mockResolvedValue('none');
        vi.mocked(prompts.confirm).mockResolvedValue(true);
        vi.mocked(prompts.input).mockResolvedValue('');

        await init();

        const configContent = await readFile(
            join(TEST_DIR, 'xcstrings-cli.yaml'),
            'utf-8',
        );
        const config = yaml.load(configContent) as any;

        expect(config).not.toHaveProperty('xcodeprojPaths');
        expect(config.xcstringsPaths).toEqual([]);
    });

    it('should prompt for manual path if no .xcstrings found and create it', async () => {
        vi.mocked(prompts.checkbox).mockResolvedValue([]);
        vi.mocked(prompts.select).mockImplementation(async (options: any) => {
            if (options.message.includes('.xcstrings')) return 'manual';
            return 'none';
        });
        vi.mocked(prompts.input).mockResolvedValue(
            'Resources/Localizable.xcstrings',
        );
        vi.mocked(prompts.confirm).mockImplementation(async (options: any) => {
            if (options.message.includes('Create xcstrings-cli.yaml'))
                return true;
            if (options.message.includes('create a new one')) return true;
            return true;
        });
        vi.mocked(prompts.input).mockImplementation(async (options: any) => {
            if (options.message.includes('default language')) return 'ja';
            return 'Resources/Localizable.xcstrings';
        });

        await init();

        const xcstringsPath = join(TEST_DIR, 'Resources/Localizable.xcstrings');
        await expect(access(xcstringsPath)).resolves.toBeUndefined();

        const xcstringsContent = JSON.parse(
            await readFile(xcstringsPath, 'utf-8'),
        );
        expect(xcstringsContent.sourceLanguage).toBe('ja');

        const configContent = await readFile(
            join(TEST_DIR, 'xcstrings-cli.yaml'),
            'utf-8',
        );
        expect(configContent).toContain('- "Resources/Localizable.xcstrings"');
    });

    it('should detect Swift package IdentifiedStructure and suggest default path', async () => {
        await writeFile(
            join(TEST_DIR, 'Package.swift'),
            'name: "MyPackage"\ndefaultLocalization: "ja"',
        );
        await mkdir(join(TEST_DIR, 'Sources/MyPackage'), { recursive: true });

        vi.mocked(prompts.checkbox).mockResolvedValue([]);
        vi.mocked(prompts.select).mockImplementation(async (options: any) => {
            if (options.message.includes('.xcstrings'))
                return options.choices[0].value;
            return 'none';
        });
        vi.mocked(prompts.confirm).mockResolvedValue(true);
        vi.mocked(prompts.input).mockImplementation(async (options: any) => {
            if (options.message.includes('default language'))
                return options.default;
            return '';
        });

        await init();

        const expectedPath = join(
            TEST_DIR,
            'Sources/MyPackage/Resources/Localizable.xcstrings',
        );
        await expect(access(expectedPath)).resolves.toBeUndefined();

        const xcstringsContent = JSON.parse(
            await readFile(expectedPath, 'utf-8'),
        );
        expect(xcstringsContent.sourceLanguage).toBe('ja');
    });

    it('should detect Swift package UnknownStructure and prompt for path without suggestion', async () => {
        await writeFile(join(TEST_DIR, 'Package.swift'), 'name: "MyPackage"');

        vi.mocked(prompts.checkbox).mockResolvedValue([]);
        vi.mocked(prompts.select).mockImplementation(async (options: any) => {
            if (options.message.includes('.xcstrings')) return 'manual';
            return 'none';
        });
        vi.mocked(prompts.confirm).mockResolvedValue(true);
        vi.mocked(prompts.input).mockImplementation(async (options: any) => {
            if (options.message.includes('Enter the path to .xcstrings'))
                return 'Manual.xcstrings';
            if (options.message.includes('default language')) return 'en';
            return '';
        });

        await init();

        await expect(
            access(join(TEST_DIR, 'Manual.xcstrings')),
        ).resolves.toBeUndefined();
    });
});
