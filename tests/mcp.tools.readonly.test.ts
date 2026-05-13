import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';
import { FIXTURES_DIR } from './utils/resources';
import { cleanupTempFiles, setupTempFile } from './utils/testFileHelper';

const createdSessions: McpClientSession[] = [];

function getTextContent(result: {
    content: Array<{ type: string; text?: string }>;
}): string {
    return result.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n');
}

afterEach(async () => {
    for (const session of createdSessions.splice(0)) {
        await closeMcpClient(session);
    }
    await cleanupTempFiles();
});

describe('mcp tools: readonly', () => {
    it('languages_list returns languages from a catalog', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'languages_list',
            arguments: {
                path: tempFile,
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(getTextContent(result)).toContain('en');
        expect(result.structuredContent.languages).toContain('en');
        expect(result.structuredContent.path).toBe(tempFile);
    }, 20000);

    it('strings_list supports filters and formats', async () => {
        const fixturePath = resolve(FIXTURES_DIR, 'list-sample.xcstrings');
        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'strings_list',
            arguments: {
                path: fixturePath,
                languages: ['en'],
                keyFilter: {
                    pattern: 'good*',
                    mode: 'glob',
                },
                format: '[{{language}}] {{key}} => {{text}}',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        const output = getTextContent(result);
        expect(output).toContain('[en] goodbyeWorld => Goodbye, World.');
        expect(output).toContain('[en] goodMorning => Good morning.');
        expect(result.structuredContent.lineCount).toBe(2);
    }, 20000);
});
