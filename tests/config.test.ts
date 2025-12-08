import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/utils/config';
import { resolve } from 'path';
import fs from 'fs/promises';

describe('loadConfig', () => {
    const cwd = process.cwd();
    const configJsonPath = resolve(cwd, 'xcstrings-cli.json');
    const configJson5Path = resolve(cwd, 'xcstrings-cli.json5');

    beforeEach(async () => {
        try { await fs.unlink(configJsonPath); } catch { }
        try { await fs.unlink(configJson5Path); } catch { }
    });

    afterEach(async () => {
        try { await fs.unlink(configJsonPath); } catch { }
        try { await fs.unlink(configJson5Path); } catch { }
    });

    it('should load config from xcstrings-cli.json', async () => {
        const config = { xcstringsPaths: ['path/to/Localizable.xcstrings'] };
        await fs.writeFile(configJsonPath, JSON.stringify(config));

        const result = await loadConfig();
        expect(result).toEqual(config);
    });

    it('should load config from xcstrings-cli.json5', async () => {
        const configContent = "{ xcstringsPaths: ['path/to/Localizable.xcstrings'] }";
        await fs.writeFile(configJson5Path, configContent);

        const result = await loadConfig();
        expect(result).toEqual({ xcstringsPaths: ['path/to/Localizable.xcstrings'] });
    });

    it('should prefer explicit path', async () => {
        const explicitPath = resolve(cwd, 'custom-config.json');
        const config = { xcstringsPaths: ['custom/path'] };
        await fs.writeFile(explicitPath, JSON.stringify(config));

        try {
            const result = await loadConfig(explicitPath);
            expect(result).toEqual(config);
        } finally {
            await fs.unlink(explicitPath);
        }
    });

    it('should return null if no config found', async () => {
        const result = await loadConfig();
        expect(result).toBeNull();
    });
});
