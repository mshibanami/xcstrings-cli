import { describe, it, expect, afterEach } from 'vitest';
import { add, remove } from '../src/commands/index';
import { readFile } from 'node:fs/promises';
import { setupTempFile, cleanupTempFiles } from './utils/testFileHelper';

afterEach(async () => await cleanupTempFiles());

describe('commands', () => {
    it('add: should add a string to no-strings.xcstrings', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');

        await add(tempFile, 'greeting', 'Hello World', {
            en: 'Hello',
            ja: 'こんにちは'
        });

        const contentString = await readFile(tempFile, 'utf-8');
        const content = JSON.parse(contentString);
        expect(content.strings).toHaveProperty('greeting');
        expect(content.strings.greeting.comment).toBe('Hello World');
        expect(content.strings.greeting.localizations.en.stringUnit.value).toBe('Hello');
        expect(content.strings.greeting.localizations.ja.stringUnit.value).toBe('こんにちは');
        expect(content.strings.greeting.extractionState).toBe('manual');
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
});
