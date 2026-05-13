import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { languages } from '../../services/languages.js';
import type { McpSessionContext } from '../runtime.js';
import {
    resolveToolCatalogPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';

export function registerLanguagesTool(
    server: McpServer,
    session: McpSessionContext,
): void {
    server.registerTool(
        'xcs.languages.list',
        {
            title: 'List Languages',
            description:
                'List supported languages from xcodeproj or xcstrings.',
            inputSchema: {
                path: z.string().optional(),
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async (args) => {
            try {
                const resolvedPath = await resolveToolCatalogPath(
                    args.path,
                    session,
                );
                const result = await languages(
                    resolvedPath,
                    session.resolvedConfig,
                );
                return toToolTextResult(result.join(' '), {
                    path: resolvedPath,
                    languages: result,
                });
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
