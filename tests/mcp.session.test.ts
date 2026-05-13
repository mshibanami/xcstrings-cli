import { describe, expect, test } from 'vitest';
import { resolve } from 'node:path';
import {
    resolveSessionContext,
    resolveToolCatalogPath,
} from '../src/mcp/runtime.js';

const fixtureRoot = resolve(__dirname, 'fixtures/config');
const customConfig = resolve(fixtureRoot, 'custom-config.json');
const monorepoRoot = resolve(fixtureRoot, 'monorepo');
const pkgARoot = resolve(monorepoRoot, 'pkg-a');
const pkgBRoot = resolve(monorepoRoot, 'pkg-b');

describe('MCP Session Context (Phase 2)', () => {
    test('loads explicit config path and keeps it stable on the session', async () => {
        const session = await resolveSessionContext({
            configPath: customConfig,
            warningMode: 'silent',
        });

        expect(session.resolvedConfigPath).toBe(customConfig);
        expect(session.resolvedConfig?.xcstringsPaths).toEqual([
            resolve(fixtureRoot, 'custom/path'),
        ]);
    });

    test('project-root governs cosmiconfig search and project-root default catalog', async () => {
        const session = await resolveSessionContext({
            projectRoot: pkgARoot,
            warningMode: 'silent',
        });

        expect(session.projectRoot).toBe(pkgARoot);
        expect(session.resolvedConfig?.xcstringsPaths).toEqual([
            resolve(pkgARoot, 'pkg-a/Localizable.xcstrings'),
        ]);
        expect(session.defaultCatalogPath).toBe(
            resolve(pkgARoot, 'Localizable.xcstrings'),
        );
    });

    test('different project-root values pick different monorepo configs', async () => {
        const sessionA = await resolveSessionContext({
            projectRoot: pkgARoot,
            warningMode: 'silent',
        });
        const sessionB = await resolveSessionContext({
            projectRoot: pkgBRoot,
            warningMode: 'silent',
        });

        expect(sessionA.resolvedConfig?.xcstringsPaths).toEqual([
            resolve(pkgARoot, 'pkg-a/Localizable.xcstrings'),
        ]);
        expect(sessionB.resolvedConfig?.xcstringsPaths).toEqual([
            resolve(pkgBRoot, 'pkg-b/Strings.xcstrings'),
        ]);
    });

    test('--path (explicitPath) takes priority over config xcstringsPaths', async () => {
        const explicit = '/tmp/explicit/Localizable.xcstrings';
        const session = await resolveSessionContext({
            configPath: customConfig,
            explicitPath: explicit,
            warningMode: 'silent',
        });

        const resolved = await resolveToolCatalogPath(undefined, session);
        expect(resolved).toBe(explicit);
    });

    test('tool argument path overrides --path explicitPath', async () => {
        const explicit = '/tmp/explicit/Localizable.xcstrings';
        const session = await resolveSessionContext({
            configPath: customConfig,
            explicitPath: explicit,
            warningMode: 'silent',
        });

        const resolved = await resolveToolCatalogPath(
            '/tmp/from-tool/A.xcstrings',
            session,
        );
        expect(resolved).toBe('/tmp/from-tool/A.xcstrings');
    });

    test('without explicitPath, config xcstringsPaths (1 entry) is auto-adopted', async () => {
        const session = await resolveSessionContext({
            configPath: customConfig,
            warningMode: 'silent',
        });

        const resolved = await resolveToolCatalogPath(undefined, session);
        expect(resolved).toBe(resolve(fixtureRoot, 'custom/path'));
    });

    test('without explicitPath and without config, falls back to project-root default', async () => {
        const session = await resolveSessionContext({
            projectRoot: '/tmp/no-config-here-xcs-test',
            warningMode: 'silent',
        });

        const resolved = await resolveToolCatalogPath(undefined, session);
        expect(resolved).toBe(
            resolve('/tmp/no-config-here-xcs-test', 'Localizable.xcstrings'),
        );
    });

    test('config resolution is stable: same session returns identical config across calls', async () => {
        const session = await resolveSessionContext({
            configPath: customConfig,
            warningMode: 'silent',
        });

        const first = session.resolvedConfig;
        const second = session.resolvedConfig;
        expect(first).toBe(second);
    });
});
