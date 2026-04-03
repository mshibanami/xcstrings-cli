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
        if (content.length >= 2) {
            if (
                (content[0] === 0xff && content[1] === 0xfe) ||
                (content[0] === 0xfe && content[1] === 0xff)
            ) {
                rawContent = iconv.decode(content, 'utf16');
            } else {
                rawContent = iconv.decode(content, 'utf8');
            }
        } else {
            rawContent = iconv.decode(content, 'utf8');
        }
    } else {
        rawContent = content;
    }

    const result: Record<string, StringsEntry> = {};
    const sanitized = rawContent.replace(/\/\/.*$/gm, '');
    const regex =
        /(?:\/\*([\s\S]*?)\*\/)?\s*?([^/]*?)"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";/g;

    let match;
    while ((match = regex.exec(sanitized)) !== null) {
        const comment = match[1]?.trim();
        const key = unescapeString(match[3]);
        const value = unescapeString(match[4]);

        result[key] = {
            text: value,
            comment: comment,
        };
    }

    return result;
}

function unescapeString(str: string): string {
    return str
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
}
