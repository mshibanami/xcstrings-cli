import i18nStringsFiles from 'i18n-strings-files';
import iconv from 'iconv-lite';

export interface StringsEntry {
    text: string;
    comment?: string;
}

export function parseStrings(
    content: string | Buffer,
): Record<string, StringsEntry> {
    let rawContent: string;
    if (Buffer.isBuffer(content)) {
        // Detect encoding
        if (
            content.length >= 2 &&
            content[0] === 0xff &&
            content[1] === 0xfe
        ) {
            rawContent = iconv.decode(content, 'utf16-le');
        } else if (
            content.length >= 2 &&
            content[0] === 0xfe &&
            content[1] === 0xff
        ) {
            rawContent = iconv.decode(content, 'utf16-be');
        } else {
            rawContent = iconv.decode(content, 'utf8');
        }
    } else {
        rawContent = content;
    }

    const parsed = i18nStringsFiles.parse(rawContent, { wantsComments: true });

    const result: Record<string, StringsEntry> = {};

    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
            result[key] = {
                text: unescapeString(value),
            };
        } else {
            result[key] = {
                text: unescapeString(value.text),
                comment: value.comment,
            };
        }
    }

    return result;
}

function unescapeString(str: string): string {
    // i18n-strings-files handles \n and \"
    return str
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
}
