import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { previewInitSetup } from '../../services/init-core.js';
import type { McpSessionContext } from '../runtime.js';
import { toToolErrorResult, toToolTextResult } from '../runtime.js';

export function registerInitPreviewTool(
    server: McpServer,
    session: McpSessionContext,
): void {
    server.registerTool(
        'init_preview',
        {
            title: 'Preview Init Configuration',
            description:
                'Discover xcstrings/xcodeproj candidates and return a recommended init plan without writing files.',
            inputSchema: {},
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            try {
                const preview = await previewInitSetup(session.projectRoot);
                const text = [
                    `Project root: ${preview.projectRoot}`,
                    `Discovered ${preview.discovered.xcstringsPaths.length} xcstrings file(s), ${preview.discovered.xcodeprojPaths.length} xcodeproj director${preview.discovered.xcodeprojPaths.length === 1 ? 'y' : 'ies'}.`,
                    `Recommended xcstringsPaths: ${preview.recommended.xcstringsPaths.length}`,
                    preview.configExists
                        ? 'Config file already exists.'
                        : 'Config file does not exist yet.',
                ].join('\n');

                return toToolTextResult(text, {
                    projectRoot: preview.projectRoot,
                    configPath: preview.configPath,
                    configExists: preview.configExists,
                    swiftPackageInfo: preview.swiftPackageInfo,
                    discovered: preview.discovered,
                    recommended: preview.recommended,
                    warnings: preview.warnings,
                });
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
