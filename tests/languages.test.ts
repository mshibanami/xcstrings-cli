import { describe, it, expect } from 'vitest';
import { getLanguagesFromXcodeproj, getLanguagesFromXCStrings, languages } from '../src/commands/languages';
import { resolve } from 'node:path';
import { FIXTURES_DIR } from './utils/resources';

describe('languages', () => {
    it('should extract knownRegions from xcodeproj without Base', () => {
        const xcodeprojPath = resolve(FIXTURES_DIR, 'test.xcodeproj');
        const languages = getLanguagesFromXcodeproj(xcodeprojPath);

        expect(languages).toEqual(['de', 'en', 'ja']);
    });

    it('should extract languages from xcstrings file', async () => {
        const xcstringsPath = resolve(FIXTURES_DIR, 'manual-comment-3langs.xcstrings');
        const languages = await getLanguagesFromXCStrings(xcstringsPath);
        expect(languages).toContain('ja');
        expect(languages).toContain('en');
        expect(languages).toContain('zh-Hans');
    });

    it('should include sourceLanguage even when no localizations exist', async () => {
        const xcstringsPath = resolve(FIXTURES_DIR, 'no-strings.xcstrings');
        const langs = await getLanguagesFromXCStrings(xcstringsPath);
        expect(langs).toEqual(['en']);
    });

    it('languages(): should always include sourceLanguage', async () => {
        const xcstringsPath = resolve(FIXTURES_DIR, 'no-strings.xcstrings');
        const langs = await languages(xcstringsPath);
        expect(langs).toContain('en');
    });
});
