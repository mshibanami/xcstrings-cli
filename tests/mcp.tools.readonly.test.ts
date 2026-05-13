import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';
import { FIXTURES_DIR } from './utils/resources';
import { cleanupTempFiles, setupTempFile } from './utils/testFileHelper';

const createdSessions: McpClientSession[] = [];
const createdDirs: string[] = [];

function uniqueTempDir(name: string): string {
    return resolve(
        process.cwd(),
        'tests',
        'temp',
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`,
    );
}

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
    for (const dir of createdDirs.splice(0)) {
        await rm(dir, { recursive: true, force: true });
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

    it('resolves relative tool path against --project-root', async () => {
        const tempDir = uniqueTempDir('mcp-readonly-relative-path');
        createdDirs.push(tempDir);
        await mkdir(join(tempDir, 'apps', 'demo'), { recursive: true });
        const catalogPath = join(
            tempDir,
            'apps',
            'demo',
            'Localizable.xcstrings',
        );
        await writeFile(
            catalogPath,
            JSON.stringify({
                sourceLanguage: 'en',
                version: '1.0',
                strings: {},
            }),
            'utf8',
        );

        const session = await connectMcpClient({
            args: ['--project-root', tempDir],
        });
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'languages_list',
            arguments: {
                path: 'apps/demo/Localizable.xcstrings',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.path).toBe(catalogPath);
        expect(result.structuredContent.languages).toEqual(['en']);
    }, 20000);

    it('resolves relative xcstringsPaths from config file directory', async () => {
        const tempDir = uniqueTempDir('mcp-readonly-config-relative-path');
        createdDirs.push(tempDir);
        await mkdir(join(tempDir, 'nested'), { recursive: true });
        const catalogPath = join(tempDir, 'nested', 'Localizable.xcstrings');
        await writeFile(
            catalogPath,
            JSON.stringify({
                sourceLanguage: 'en',
                version: '1.0',
                strings: {},
            }),
            'utf8',
        );
        await writeFile(
            join(tempDir, 'xcstrings-cli.yaml'),
            'xcstringsPaths:\n  - nested/Localizable.xcstrings\n',
            'utf8',
        );

        const session = await connectMcpClient({
            args: ['--project-root', tempDir],
        });
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'languages_list',
            arguments: {},
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.path).toBe(catalogPath);
        expect(result.structuredContent.languages).toEqual(['en']);
    }, 20000);
});
