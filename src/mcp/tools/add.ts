import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { runAddCommand } from '../../services/add.js';
import { LOCALIZATION_STATES } from '../../services/shared/xcstrings.js';
import type { McpRuntimeContext } from '../runtime.js';
import {
    resolveConfigPath,
    resolveXCStringsInputPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';

export function registerAddTool(
    server: McpServer,
    runtime: McpRuntimeContext,
): void {
    server.registerTool(
        'xcs.add',
        {
            title: 'Add Strings',
            description:
                'Add or update one or more strings in an xcstrings file.',
            inputSchema: {
                path: z.string().optional(),
                configPath: z.string().optional(),
                key: z.string().optional(),
                comment: z.string().optional(),
                language: z.string().optional(),
                state: z.enum(LOCALIZATION_STATES).optional(),
                text: z.string().optional(),
                strings: z.record(z.string(), z.any()).optional(),
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
                const resolvedPath = await resolveXCStringsInputPath(
                    args.path,
                    args.configPath,
                    runtime,
                );
                const configPath = resolveConfigPath(args.configPath, runtime);

                const result = await runAddCommand({
                    path: resolvedPath,
                    key: args.key,
                    comment: args.comment,
                    stringsArg:
                        args.strings === undefined
                            ? undefined
                            : JSON.stringify(args.strings),
                    stringsFormat: 'json',
                    defaultString: args.text,
                    language: args.language,
                    stdinReader: async () => Promise.resolve(''),
                    configPath,
                    state: args.state,
                    interactive: false,
                    onWarning: runtime.onWarning,
                });

                return toToolTextResult(
                    `Added keys:\n${result.keys.map((key) => `- ${key}`).join('\n')}`,
                    {
                        path: resolvedPath,
                        kind: result.kind,
                        keys: result.keys,
                    },
                );
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
