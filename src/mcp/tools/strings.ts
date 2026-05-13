import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { strings } from '../../services/strings.js';
import type { McpSessionContext } from '../runtime.js';
import {
    resolveToolCatalogPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';
import { filterSpecInputSchema, toFilterSpec } from './shared.js';

export function registerStringsTool(
    server: McpServer,
    session: McpSessionContext,
): void {
    server.registerTool(
        'xcs.strings.list',
        {
            title: 'List Strings',
            description: 'List strings in the xcstrings file.',
            inputSchema: {
                path: z.string().optional(),
                languages: z.array(z.string()).optional(),
                missingLanguages: z.array(z.string()).optional(),
                format: z.string().optional(),
                keyFilter: filterSpecInputSchema,
                textFilter: filterSpecInputSchema,
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
                const output = await strings({
                    path: resolvedPath,
                    languages: args.languages,
                    missingLanguages: args.missingLanguages,
                    keyFilter: toFilterSpec(args.keyFilter),
                    textFilter: toFilterSpec(args.textFilter),
                    format: args.format,
                });

                const lineCount =
                    output.length === 0 ? 0 : output.split('\n').length;
                return toToolTextResult(output, {
                    path: resolvedPath,
                    lineCount,
                    output,
                });
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
