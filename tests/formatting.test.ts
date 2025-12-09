
import { describe, it, expect } from 'vitest';
import { formatXCStrings } from '../src/commands/_shared';

describe('formatXCStrings', () => {
    it('should add space before colon in simple objects', () => {
        const input = JSON.stringify({ key: "value" }, null, 2);
        const expected = input.replace('":', '" :');
        expect(formatXCStrings(input)).toBe(expected);
        expect(formatXCStrings(input)).toContain('"key" : "value"');
    });

    it('should handle nested objects', () => {
        const obj = {
            nested: {
                child: "grandchild"
            }
        };
        const input = JSON.stringify(obj, null, 2);
        const output = formatXCStrings(input);
        expect(output).toContain('"nested" : {');
        expect(output).toContain('"child" : "grandchild"');
    });

    it('should not affect colons inside string values', () => {
        const obj = {
            "key:with:colons": "value:with:colons"
        };
        const input = JSON.stringify(obj, null, 2);
        const output = formatXCStrings(input);
        expect(output).toContain('"key:with:colons" : "value:with:colons"');
    });

    it('should handle escaped quotes inside strings', () => {
        const obj = {
            tricky: 'value has ": sequence inside'
        };
        const input = JSON.stringify(obj, null, 2);
        const output = formatXCStrings(input);
        expect(output).toContain('"tricky" : "value has \\": sequence inside"');
    });

    it('should handle backslashes correctly', () => {
        const obj = {
            path: 'C:\\Windows\\System32'
        };
        const input = JSON.stringify(obj, null, 2);
        const output = formatXCStrings(input);
        expect(output).toContain('"path" : "C:\\\\Windows\\\\System32"');
    });

    it('should maintain data integrity when parsed back', () => {
        const obj = {
            "normalKey": "normalValue",
            "key with spaces": "value with spaces",
            "key:with:colons": "value:with:colons",
            "key\"with\"quotes": "value\"with\"quotes",
            "key\\with\\backslashes": "value\\with\\backslashes",
            "nested": {
                "child": "grandchild"
            },
            "empty": {},
            "tricky": "value has \": sequence inside",
            "tricky2": "value ending in quote\"",
            "tricky3": "value ending in backslash\\"
        };
        const input = JSON.stringify(obj, null, 2);
        const output = formatXCStrings(input);
        const parsed = JSON.parse(output);
        expect(parsed).toEqual(obj);
    });
});
