import { describe, expect, it } from 'vitest';
import { mergeTranslationUnit } from '../src/utils/unit-merger.js';
import { XCStringUnit, sortXCStringsKeys } from '../src/commands/_shared.js';

describe('mergeTranslationUnit', () => {
    const existingUnit: XCStringUnit = {
        extractionState: 'manual',
        comment: 'Old comment',
        localizations: {
            en: { stringUnit: { state: 'translated', value: 'Hello' } },
            ja: { stringUnit: { state: 'translated', value: 'こんにちは' } },
        },
    };

    const newUnit: XCStringUnit = {
        extractionState: 'migrated',
        comment: 'New comment',
        localizations: {
            en: {
                stringUnit: { state: 'needs_review', value: 'Hello Updated' },
            },
            fr: { stringUnit: { state: 'translated', value: 'Bonjour' } },
        },
    };

    it('should use source-first policy by default', () => {
        const merged = mergeTranslationUnit(existingUnit, newUnit);

        expect(merged.comment).toBe('New comment');
        expect(merged.extractionState).toBe('migrated');
        expect(merged.localizations?.['en'].stringUnit.value).toBe(
            'Hello Updated',
        );
        expect(merged.localizations?.['ja'].stringUnit.value).toBe(
            'こんにちは',
        );
        expect(merged.localizations?.['fr'].stringUnit.value).toBe('Bonjour');
    });

    it('should throw an error with error policy if localizations conflict', () => {
        expect(() => {
            mergeTranslationUnit(existingUnit, newUnit, {
                mergePolicy: 'error',
            });
        }).toThrowError('Key already has localization');
    });

    it('should ignore source with destination-first policy on conflict', () => {
        const merged = mergeTranslationUnit(existingUnit, newUnit, {
            mergePolicy: 'destination-first',
        });

        expect(merged.comment).toBe('Old comment');
        expect(merged.extractionState).toBe('manual');
        expect(merged.localizations?.['en'].stringUnit.value).toBe('Hello');
        expect(merged.localizations?.['ja'].stringUnit.value).toBe(
            'こんにちは',
        );
        expect(merged.localizations?.['fr'].stringUnit.value).toBe('Bonjour');
    });

    it('should apply source base properties when target lacks them under destination-first policy', () => {
        const target: XCStringUnit = {
            localizations: {
                en: { stringUnit: { state: 'translated', value: 'Hello' } },
            },
        };
        const source: XCStringUnit = {
            comment: 'Provided by source',
            extractionState: 'migrated',
            localizations: {
                en: {
                    stringUnit: { state: 'translated', value: 'Hello Updated' },
                },
            },
        };

        const merged = mergeTranslationUnit(target, source, {
            mergePolicy: 'destination-first',
        });

        expect(merged.comment).toBe('Provided by source');
        expect(merged.extractionState).toBe('migrated');
        expect(merged.localizations?.['en'].stringUnit.value).toBe('Hello');
    });

    describe('localization sorting', () => {
        it('should sort localizations when a new language is added', () => {
            const target: XCStringUnit = {
                localizations: {
                    ja: {
                        stringUnit: {
                            state: 'translated',
                            value: 'こんにちは',
                        },
                    },
                    en: { stringUnit: { state: 'translated', value: 'Hello' } },
                },
            };
            const source: XCStringUnit = {
                localizations: {
                    fr: {
                        stringUnit: { state: 'translated', value: 'Bonjour' },
                    },
                },
            };

            const merged = mergeTranslationUnit(target, source, {
                sortLocalizations: 'auto',
            });

            const keys = Object.keys(merged.localizations || {});
            expect(keys).toEqual(['en', 'fr', 'ja']);
        });

        it('should NOT sort localizations when no new language is added', () => {
            const target: XCStringUnit = {
                localizations: {
                    ja: {
                        stringUnit: {
                            state: 'translated',
                            value: 'こんにちは',
                        },
                    },
                    en: { stringUnit: { state: 'translated', value: 'Hello' } },
                },
            };
            const source: XCStringUnit = {
                localizations: {
                    en: {
                        stringUnit: {
                            state: 'translated',
                            value: 'Hello Updated',
                        },
                    },
                },
            };

            const merged = mergeTranslationUnit(target, source, {
                sortLocalizations: 'auto',
            });

            const keys = Object.keys(merged.localizations || {});
            expect(keys).toEqual(['ja', 'en']);
        });

        it('should still sort if sortLocalizations is true (backward compatibility/manual override)', () => {
            const target: XCStringUnit = {
                localizations: {
                    ja: {
                        stringUnit: {
                            state: 'translated',
                            value: 'こんにちは',
                        },
                    },
                    en: { stringUnit: { state: 'translated', value: 'Hello' } },
                },
            };
            const source: XCStringUnit = {
                localizations: {
                    en: {
                        stringUnit: {
                            state: 'translated',
                            value: 'Hello Updated',
                        },
                    },
                },
            };

            const merged = mergeTranslationUnit(target, source, {
                sortLocalizations: true,
            });

            const keys = Object.keys(merged.localizations || {});
            expect(keys).toEqual(['en', 'ja']);
        });
    });

    it('should apply source base properties under error policy when there is no conflict', () => {
        const target: XCStringUnit = {
            comment: 'Target comment',
            localizations: {
                ja: {
                    stringUnit: { state: 'translated', value: 'こんにちは' },
                },
            },
        };
        const source: XCStringUnit = {
            comment: 'Source comment',
            extractionState: 'migrated',
            localizations: {
                en: { stringUnit: { state: 'translated', value: 'Hello' } },
            },
        };

        const merged = mergeTranslationUnit(target, source, {
            mergePolicy: 'error',
        });

        expect(merged.comment).toBe('Source comment');
        expect(merged.extractionState).toBe('migrated');
        expect(merged.localizations?.['ja'].stringUnit.value).toBe(
            'こんにちは',
        );
        expect(merged.localizations?.['en'].stringUnit.value).toBe('Hello');
    });

    it('should sort localizations if sortLocalizations is true', () => {
        const target: XCStringUnit = {
            localizations: {
                z: { stringUnit: { state: 'translated', value: '1' } },
            },
        };
        const source: XCStringUnit = {
            localizations: {
                a: { stringUnit: { state: 'translated', value: '2' } },
                c: { stringUnit: { state: 'translated', value: '3' } },
            },
        };

        const merged = mergeTranslationUnit(target, source, {
            sortLocalizations: true,
        });

        expect(Object.keys(merged.localizations || {})).toEqual([
            'a',
            'c',
            'z',
        ]);
    });

    it('should override extractionState if provided via options', () => {
        const merged = mergeTranslationUnit(existingUnit, newUnit, {
            extractionState: 'manual',
        });
        expect(merged.extractionState).toBe('manual');
    });
});

describe('sortXCStringsKeys', () => {
    it('should sort keys using Xcode/Finder-like natural sorting', () => {
        const inputKeys = [
            '10 items',
            '2 items',
            'item_1',
            'item_10',
            'item_2',
            'Apple',
            'APPLE',
            'apple',
            'banana',
            '_hidden',
            '-dash',
            '.dot',
            '@at_mark',
            ' space_prefix',
            'hello world',
            'hello-world',
            'hello_world',
            'cafe',
            'café',
            'こんにちは',
            'コンニチハ',
            'テスト',
            'test',
            '你好',
            '🍎 Apple',
            '🚀 Rocket',
        ];

        const expectedOrder = [
            ' space_prefix',
            '_hidden',
            '-dash',
            '.dot',
            '@at_mark',
            '🍎 Apple',
            '🚀 Rocket',
            '2 items',
            '10 items',
            'Apple',
            'APPLE',
            'apple',
            'banana',
            'cafe',
            'café',
            'hello world',
            'hello_world',
            'hello-world',
            'item_1',
            'item_2',
            'item_10',
            'test',
            'こんにちは',
            'コンニチハ',
            'テスト',
            '你好',
        ];

        const strings: Record<string, XCStringUnit> = {};
        for (const key of inputKeys) {
            strings[key] = {};
        }

        const sorted = sortXCStringsKeys(strings);
        const actualOrder = Object.keys(sorted);
        expect(actualOrder).toEqual(expectedOrder);
    });
});
