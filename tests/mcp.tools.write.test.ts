import { afterEach, describe, expect, it } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

async function ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

afterEach(async () => {
    for (const session of createdSessions.splice(0)) {
        await closeMcpClient(session);
    }
    for (const dir of createdDirs.splice(0)) {
        try {
            await rm(dir, { recursive: true, force: true });
        } catch {
            // best effort
        }
    }
    await cleanupTempFiles();
});

describe('mcp tools: write', () => {
    it('xcs.add adds a key and returns structured result', async () => {
        const tempFile = await setupTempFile('no-strings.xcstrings');
        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'xcs.add',
            arguments: {
                path: tempFile,
                key: 'mcp.greeting',
                comment: 'Greeting',
                text: 'Hello from MCP',
                language: 'en',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.keys).toEqual(['mcp.greeting']);
        expect(result.structuredContent.kind).toBe('single');

        const content = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(content.strings['mcp.greeting']).toBeDefined();
        expect(
            content.strings['mcp.greeting'].localizations.en.stringUnit.value,
        ).toBe('Hello from MCP');
    }, 20000);

    it('xcs.remove supports dry-run without changing file', async () => {
        const tempFile = await setupTempFile('manual-comment-3langs.xcstrings');
        const before = JSON.parse(await readFile(tempFile, 'utf-8'));
        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'xcs.remove',
            arguments: {
                path: tempFile,
                key: 'closeAction',
                languages: ['ja'],
                dryRun: true,
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.dryRun).toBe(true);
        expect(result.structuredContent.removedCount).toBe(1);

        const after = JSON.parse(await readFile(tempFile, 'utf-8'));
        expect(
            after.strings.closeAction.localizations.ja.stringUnit.value,
        ).toBe(before.strings.closeAction.localizations.ja.stringUnit.value);
    }, 20000);

    it('xcs.import imports from .strings into target catalog', async () => {
        const tempDir = uniqueTempDir('mcp-import');
        createdDirs.push(tempDir);
        await ensureDir(join(tempDir, 'ja.lproj'));
        const sourceFile = join(tempDir, 'ja.lproj', 'Localizable.strings');
        await writeFile(sourceFile, '"hello" = "こんにちは";', 'utf8');
        const targetFile = join(tempDir, 'Localizable.xcstrings');

        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'xcs.import',
            arguments: {
                sources: [sourceFile],
                target: targetFile,
                language: 'en',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.targetPath).toBe(targetFile);
        expect(await pathExists(targetFile)).toBe(true);

        const content = JSON.parse(await readFile(targetFile, 'utf-8'));
        expect(content.sourceLanguage).toBe('en');
        expect(content.strings.hello.localizations.ja.stringUnit.value).toBe(
            'こんにちは',
        );
    }, 20000);

    it('xcs.export exports filtered content to xcstrings', async () => {
        const sourceFile = resolve(FIXTURES_DIR, 'list-sample.xcstrings');
        const tempDir = uniqueTempDir('mcp-export');
        createdDirs.push(tempDir);
        const outpath = join(tempDir, 'Exported.xcstrings');
        await ensureDir(dirname(outpath));

        const session = await connectMcpClient();
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'xcs.export',
            arguments: {
                path: sourceFile,
                outpath,
                output: 'xcstrings',
                keyFilter: {
                    pattern: 'good*',
                    mode: 'glob',
                },
                languages: ['en'],
                mergePolicy: 'force',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.outpath).toBe(outpath);
        expect(await pathExists(outpath)).toBe(true);

        const content = JSON.parse(await readFile(outpath, 'utf-8'));
        expect(Object.keys(content.strings)).toHaveLength(2);
        expect(Object.keys(content.strings)).toEqual(
            expect.arrayContaining(['goodMorning', 'goodbyeWorld']),
        );
        expect(content.strings.goodMorning.localizations.en).toBeDefined();
        expect(content.strings.goodMorning.localizations.ja).toBeUndefined();
    }, 20000);
});
