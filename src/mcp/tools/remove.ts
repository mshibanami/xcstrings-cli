import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { remove } from '../../services/remove.js';
import { ArgumentError } from '../../utils/errors.js';
import type { McpRuntimeContext } from '../runtime.js';
import {
    resolveXCStringsInputPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';

export function registerRemoveTool(
    server: McpServer,
    runtime: McpRuntimeContext,
): void {
    server.registerTool(
        'xcs.remove',
        {
            title: 'Remove Strings',
            description:
                'Remove strings by key or languages from an xcstrings file.',
            inputSchema: {
                path: z.string().optional(),
                configPath: z.string().optional(),
                key: z.string().optional(),
                languages: z.array(z.string()).optional(),
                dryRun: z.boolean().optional(),
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async (args) => {
            try {
                if (
                    !args.key &&
                    (!args.languages || args.languages.length === 0)
                ) {
                    throw new ArgumentError(
                        'Either "key" or "languages" must be provided.',
                    );
                }

                const resolvedPath = await resolveXCStringsInputPath(
                    args.path,
                    args.configPath,
                    runtime,
                );
                const dryRun = args.dryRun === true;
                const result = await remove(
                    resolvedPath,
                    args.key,
                    args.languages,
                    dryRun,
                );
                const removedCount = Object.values(result).reduce(
                    (sum, langs) => sum + langs.length,
                    0,
                );

                return toToolTextResult(
                    dryRun
                        ? `Dry run completed. ${removedCount} localization(s) would be removed.`
                        : `Removed ${removedCount} localization(s).`,
                    {
                        path: resolvedPath,
                        dryRun,
                        removedCount,
                        removed: result,
                    },
                );
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
