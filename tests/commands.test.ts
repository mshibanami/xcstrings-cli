import { describe, it, expect, afterEach } from 'vitest';
import { add, remove } from '../src/commands/index';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

describe('commands', () => {
    it('add: should add a string to no-strings.xcstrings', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const tempConfigPath = resolve(tempFile + '.config.json');
        await writeFile(tempConfigPath, JSON.stringify({ missingLanguagePolicy: 'include' }), 'utf-8');
        await add(tempFile, 'greeting', 'Hello World', {
            en: 'Hello',
            ja: 'こんにちは'
        }, tempConfigPath);
        const contentString = await readFile(tempFile, 'utf-8');
        const content = JSON.parse(contentString);
        expect(content.strings).toHaveProperty('greeting');
        expect(content.strings.greeting.comment).toBe('Hello World');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings.greeting.extractionState).toBe('manual');
    });

    it('add: should not add languages not present when missingLanguagePolicy is ignore (default)', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        await add(tempFile, 'greeting2', 'Hello World', {
            en: 'Hello',
            ja: 'こんにちは'
        });
        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('greeting2');
        expect(content.strings.greeting2.localizations).toBeUndefined();
    });

    it('remove: should remove a string from manual-comment-3langs.xcstrings', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        let content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).toHaveProperty('closeAction');

        await remove(tempFile, 'closeAction');

        content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).not.toHaveProperty('closeAction');
        expect(content).toHaveProperty('sourceLanguage', 'en');
    });

    it('remove: should remove specific languages for a key', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        await remove(tempFile, 'closeAction', ['ja']);

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.closeAction.localizations).not.toHaveProperty('ja');
        expect(content.strings.closeAction.localizations).toHaveProperty('en');
        expect(content.strings.closeAction.localizations).toHaveProperty('zh-Hans');
    });

    it('remove: should remove languages across all keys when key is not provided', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        await remove(tempFile, undefined, ['zh-Hans']);

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.closeAction.localizations).not.toHaveProperty('zh-Hans');
        expect(content.strings.closeAction.localizations).toHaveProperty('ja');
        expect(content.strings.closeAction.localizations).toHaveProperty('en');
        expect(content.strings).toHaveProperty('nonTranslatableString');
    });

    it('remove: should support dry-run without modifying file', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        const result = await remove(tempFile, 'closeAction', ['ja'], true);

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings.closeAction.localizations).toHaveProperty('ja');
        expect(result['closeAction']).toContain('ja');
    });

    it('remove: returns removed localizations when deleting a key entirely', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        const result = await remove(tempFile, 'closeAction');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).not.toHaveProperty('closeAction');
        expect(result['closeAction']).toEqual(
            expect.arrayContaining(['en', 'ja', 'zh-Hans']),
        );
        expect(result['closeAction']).toHaveLength(3);
        expect((result as any).keysRemoved).toBeUndefined();
    });

    it('remove: removing all languages deletes key and reports removed localizations', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');

        const result = await remove(tempFile, undefined, ['en', 'ja', 'zh-Hans']);

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings).not.toHaveProperty('closeAction');
        expect(content.strings).toHaveProperty('nonTranslatableString');
        expect(result['closeAction']).toEqual(
            expect.arrayContaining(['en', 'ja', 'zh-Hans']),
        );
        expect(result['closeAction']).toHaveLength(3);
    });
});
