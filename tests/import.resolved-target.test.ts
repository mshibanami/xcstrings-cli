import { afterEach, describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { runImportCommand } from '../src/services/import.js';
import { TEMP_DIR } from './utils/resources';

const createdDirs: string[] = [];

function uniqueTempDir(name: string): string {
    return resolve(
        TEMP_DIR,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`,
    );
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

afterEach(async () => {
    for (const dir of createdDirs.splice(0)) {
        await rm(dir, { recursive: true, force: true });
    }
});

describe('import: resolved target path', () => {
    it('uses resolvedTargetPath without applying config default target resolution', async () => {
        const tempDir = uniqueTempDir('import-resolved-target');
        createdDirs.push(tempDir);
        await mkdir(tempDir, { recursive: true });

        const sourceFile = join(tempDir, 'ja.lproj', 'Localizable.strings');
        await mkdir(join(tempDir, 'ja.lproj'), { recursive: true });
        await writeFile(sourceFile, '"hello" = "こんにちは";', 'utf8');

        const resolvedTargetPath = join(
            tempDir,
            'resolved',
            'Target.xcstrings',
        );
        const configTargetPath = join(
            tempDir,
            'from-config',
            'Default.xcstrings',
        );

        const result = await runImportCommand({
            sources: [sourceFile],
            resolvedTargetPath,
            language: 'en',
            config: {
                xcstringsPaths: [configTargetPath],
            },
        });

        expect(result.targetPath).toBe(resolvedTargetPath);
        expect(await pathExists(resolvedTargetPath)).toBe(true);
        expect(await pathExists(configTargetPath)).toBe(false);
    });
});
