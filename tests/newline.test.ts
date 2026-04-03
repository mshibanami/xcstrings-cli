import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { readXCStrings, writeXCStrings } from '../src/commands/_shared';

const TEMP_DIR = resolve(__dirname, 'temp-newline');

describe('XCStrings Newline Handling', () => {
    beforeEach(async () => {
        await mkdir(TEMP_DIR, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should maintain trailing newline if original file had one (Existing File)', async () => {
        const filePath = resolve(TEMP_DIR, 'with-newline.xcstrings');
        const content = JSON.stringify(
            {
                sourceLanguage: 'en',
                strings: {},
                version: '1.0',
            },
            null,
            2,
        );

        await writeFile(filePath, content + '\n', 'utf-8');

        const data = await readXCStrings(filePath);
        await writeXCStrings(filePath, data);

        const savedContent = await readFile(filePath, 'utf-8');
        expect(savedContent.endsWith('\n')).toBe(true);
    });

    it('should NOT add trailing newline if original file had none (Existing File)', async () => {
        const filePath = resolve(TEMP_DIR, 'no-newline.xcstrings');
        const content = JSON.stringify(
            {
                sourceLanguage: 'en',
                strings: {},
                version: '1.0',
            },
            null,
            2,
        );

        await writeFile(filePath, content, 'utf-8');

        const data = await readXCStrings(filePath);
        await writeXCStrings(filePath, data);

        const savedContent = await readFile(filePath, 'utf-8');
        expect(savedContent.endsWith('\n')).toBe(false);
    });

    it('should NOT add trailing newline for a NEW file', async () => {
        const filePath = resolve(TEMP_DIR, 'new-file.xcstrings');
        const data = {
            sourceLanguage: 'en',
            strings: {},
            version: '1.0',
        };

        await writeXCStrings(filePath, data);

        const savedContent = await readFile(filePath, 'utf-8');
        expect(savedContent.endsWith('\n')).toBe(false);
    });
});
