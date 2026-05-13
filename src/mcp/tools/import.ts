import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { runImportCommand } from '../../services/import.js';
import type { ImportMergePolicy } from '../../services/import.js';
import type { McpSessionContext } from '../runtime.js';
import {
    resolveToolCatalogPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';
import { filterSpecInputSchema, toFilterSpec } from './shared.js';

export function registerImportTool(
    server: McpServer,
    session: McpSessionContext,
): void {
    server.registerTool(
        'xcs.import',
        {
            title: 'Import Strings',
            description:
                'Import keys from .xcstrings or .strings files into a target .xcstrings file.',
            inputSchema: {
                sources: z.array(z.string()).nonempty(),
                target: z.string().optional(),
                language: z.string().optional(),
                languages: z.array(z.string()).optional(),
                mergePolicy: z
                    .enum(['source-first', 'destination-first', 'error'])
                    .optional(),
                keyFilter: filterSpecInputSchema,
                textFilter: filterSpecInputSchema,
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async (args) => {
            try {
                const resolvedTarget = await resolveToolCatalogPath(
                    args.target,
                    session,
                );
                const result = await runImportCommand({
                    sources: args.sources,
                    resolvedTargetPath: resolvedTarget,
                    language: args.language,
                    languages: args.languages,
                    mergePolicy: args.mergePolicy as
                        | ImportMergePolicy
                        | undefined,
                    config: session.resolvedConfig,
                    keyFilter: toFilterSpec(args.keyFilter),
                    textFilter: toFilterSpec(args.textFilter),
                    onWarning: session.onWarning,
                });

                return toToolTextResult(
                    `Successfully imported keys to ${result.targetPath}`,
                    {
                        targetPath: result.targetPath,
                    },
                );
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
