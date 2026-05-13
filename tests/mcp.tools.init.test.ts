import { afterEach, describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';

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
        await rm(dir, { recursive: true, force: true });
    }
});

describe('mcp tools: init', () => {
    it('init_preview returns discovered candidates and recommendations', async () => {
        const tempDir = uniqueTempDir('mcp-init-preview');
        createdDirs.push(tempDir);
        await mkdir(join(tempDir, 'src'), { recursive: true });
        await writeFile(
            join(tempDir, 'src', 'Localizable.xcstrings'),
            JSON.stringify({
                sourceLanguage: 'en',
                version: '1.0',
                strings: {},
            }),
            'utf8',
        );
        await mkdir(join(tempDir, 'App.xcodeproj'), { recursive: true });

        const session = await connectMcpClient({
            args: ['--project-root', tempDir],
        });
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'init_preview',
            arguments: {},
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.projectRoot).toBe(tempDir);
        expect(result.structuredContent.configExists).toBe(false);
        expect(result.structuredContent.discovered.xcstringsPaths).toContain(
            'src/Localizable.xcstrings',
        );
        expect(result.structuredContent.discovered.xcodeprojPaths).toContain(
            'App.xcodeproj',
        );
        expect(result.structuredContent.recommended.missingLanguagePolicy).toBe(
            'skip',
        );
    }, 20000);

    it('init_apply writes config and can create missing xcstrings catalogs', async () => {
        const tempDir = uniqueTempDir('mcp-init-apply');
        createdDirs.push(tempDir);
        await mkdir(tempDir, { recursive: true });

        const session = await connectMcpClient({
            args: ['--project-root', tempDir],
        });
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'init_apply',
            arguments: {
                xcstringsPaths: ['Resources/Localizable.xcstrings'],
                xcodeprojPaths: [],
                createMissingXCStrings: true,
                sourceLanguage: 'ja',
            },
        })) as any;

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent.configExistsBeforeWrite).toBe(false);
        expect(result.structuredContent.createdXCStringsPaths).toEqual([
            'Resources/Localizable.xcstrings',
        ]);

        const configPath = join(tempDir, 'xcstrings-cli.yaml');
        expect(await pathExists(configPath)).toBe(true);
        const config = yaml.load(await readFile(configPath, 'utf-8')) as any;
        expect(config.missingLanguagePolicy).toBe('skip');
        expect(config.xcstringsPaths).toEqual([
            'Resources/Localizable.xcstrings',
        ]);
        expect(config.xcodeprojPaths).toEqual([]);

        const catalogPath = join(tempDir, 'Resources', 'Localizable.xcstrings');
        expect(await pathExists(catalogPath)).toBe(true);
        const catalog = JSON.parse(await readFile(catalogPath, 'utf-8'));
        expect(catalog.sourceLanguage).toBe('ja');
    }, 20000);

    it('init_apply requires overwrite=true when config already exists', async () => {
        const tempDir = uniqueTempDir('mcp-init-overwrite-guard');
        createdDirs.push(tempDir);
        await mkdir(tempDir, { recursive: true });
        await writeFile(
            join(tempDir, 'xcstrings-cli.yaml'),
            'missingLanguagePolicy: "skip"\nxcstringsPaths: []\n',
            'utf8',
        );

        const session = await connectMcpClient({
            args: ['--project-root', tempDir],
        });
        createdSessions.push(session);

        const result = (await session.client.callTool({
            name: 'init_apply',
            arguments: {
                xcstringsPaths: ['Localizable.xcstrings'],
            },
        })) as any;

        expect(result.isError).toBe(true);
        const text = result.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text ?? '')
            .join('\n');
        expect(text).toContain('overwrite=true');
    }, 20000);
});
