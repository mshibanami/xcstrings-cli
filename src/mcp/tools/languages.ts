import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { languages } from '../../services/languages.js';
import type { McpRuntimeContext } from '../runtime.js';
import {
    resolveXCStringsInputPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';

export function registerLanguagesTool(
    server: McpServer,
    runtime: McpRuntimeContext,
): void {
    server.registerTool(
        'xcs.languages.list',
        {
            title: 'List Languages',
            description:
                'List supported languages from xcodeproj or xcstrings.',
            inputSchema: {
                path: z.string().optional(),
                configPath: z.string().optional(),
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
                const resolvedPath = await resolveXCStringsInputPath(
                    args.path,
                    args.configPath,
                    runtime,
                );
                const configPath = args.configPath ?? runtime.configPath;
                const result = await languages(resolvedPath, configPath);
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
