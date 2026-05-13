import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { doExport } from '../../services/export.js';
import type { ExportMergePolicy, OutputFormat } from '../../services/export.js';
import { ArgumentError } from '../../utils/errors.js';
import type { McpRuntimeContext } from '../runtime.js';
import {
    resolveXCStringsInputPath,
    toToolErrorResult,
    toToolTextResult,
} from '../runtime.js';
import { filterSpecInputSchema, toFilterSpec } from './shared.js';

function resolveOutputFormat(
    outputFormat: OutputFormat,
    outpath: string,
): 'xcstrings' | 'strings' {
    if (outputFormat !== 'auto') {
        if (
            outputFormat === 'strings' &&
            outpath.toLowerCase().endsWith('.xcstrings')
        ) {
            throw new ArgumentError(
                'Output format mismatch: output is strings but outpath has .xcstrings extension.',
            );
        }
        return outputFormat;
    }

    if (outpath.toLowerCase().endsWith('.strings')) {
        return 'strings';
    }

    return 'xcstrings';
}

export function registerExportTool(
    server: McpServer,
    runtime: McpRuntimeContext,
): void {
    server.registerTool(
        'xcs.export',
        {
            title: 'Export Strings',
            description:
                'Export xcstrings to filtered xcstrings or .strings files.',
            inputSchema: {
                path: z.string().optional(),
                configPath: z.string().optional(),
                outpath: z.string(),
                output: z.enum(['auto', 'xcstrings', 'strings']).optional(),
                mergePolicy: z
                    .enum(['error', 'force', 'output-first', 'existing-first'])
                    .optional(),
                languages: z.array(z.string()).optional(),
                keyFilter: filterSpecInputSchema,
                textFilter: filterSpecInputSchema,
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
                const sourcePath = await resolveXCStringsInputPath(
                    args.path,
                    args.configPath,
                    runtime,
                );
                const outputFormat = resolveOutputFormat(
                    (args.output as OutputFormat | undefined) ?? 'auto',
                    args.outpath,
                );
                const mergePolicy =
                    (args.mergePolicy as ExportMergePolicy | undefined) ??
                    'error';

                await doExport({
                    sourcePath,
                    outpath: args.outpath,
                    outputFormat,
                    mergePolicy,
                    languages: args.languages,
                    keyFilter: toFilterSpec(args.keyFilter),
                    textFilter: toFilterSpec(args.textFilter),
                });

                return toToolTextResult(`Exported to ${args.outpath}`, {
                    sourcePath,
                    outpath: args.outpath,
                    outputFormat,
                    mergePolicy,
                });
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
