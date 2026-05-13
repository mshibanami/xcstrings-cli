import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { runImportCommand } from '../../services/import.js';
import type { ImportMergePolicy } from '../../services/import.js';
import type { McpRuntimeContext } from '../runtime.js';
import {
    resolveConfigPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';
import { filterSpecInputSchema, toFilterSpec } from './shared.js';

export function registerImportTool(
    server: McpServer,
    runtime: McpRuntimeContext,
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
                configPath: z.string().optional(),
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
                const result = await runImportCommand({
                    sources: args.sources,
                    target: args.target,
                    language: args.language,
                    languages: args.languages,
                    mergePolicy: args.mergePolicy as
                        | ImportMergePolicy
                        | undefined,
                    configPath: resolveConfigPath(args.configPath, runtime),
                    keyFilter: toFilterSpec(args.keyFilter),
                    textFilter: toFilterSpec(args.textFilter),
                    onWarning: runtime.onWarning,
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
