import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import {
    applyInitConfigPlan,
    createInitConfigPlan,
    previewInitSetup,
} from '../../services/init-core.js';
import type { MissingLanguagePolicy } from '../../utils/config.js';
import { ArgumentError } from '../../utils/errors.js';
import type { McpSessionContext } from '../runtime.js';
import { toToolErrorResult, toToolTextResult } from '../runtime.js';

export function registerInitApplyTool(
    server: McpServer,
    session: McpSessionContext,
): void {
    server.registerTool(
        'xcs.init.apply',
        {
            title: 'Apply Init Configuration',
            description:
                'Write xcstrings-cli.yaml from provided or recommended values and optionally create missing xcstrings files.',
            inputSchema: {
                xcstringsPaths: z.array(z.string()).optional(),
                xcodeprojPaths: z.array(z.string()).optional(),
                missingLanguagePolicy: z.enum(['skip', 'include']).optional(),
                createMissingXCStrings: z.boolean().optional(),
                sourceLanguage: z.string().optional(),
                overwrite: z.boolean().optional(),
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
                const preview = await previewInitSetup(session.projectRoot);
                if (preview.configExists && args.overwrite !== true) {
                    throw new ArgumentError(
                        `Config already exists at ${preview.configPath}. Set overwrite=true to replace it.`,
                    );
                }

                const plan = createInitConfigPlan({
                    projectRoot: session.projectRoot,
                    swiftPackageState: preview.swiftPackageInfo.state,
                    xcstringsPaths:
                        args.xcstringsPaths ??
                        preview.recommended.xcstringsPaths,
                    xcodeprojPaths:
                        args.xcodeprojPaths ??
                        preview.recommended.xcodeprojPaths,
                    missingLanguagePolicy: args.missingLanguagePolicy as
                        | MissingLanguagePolicy
                        | undefined,
                });

                const result = await applyInitConfigPlan(plan, {
                    createMissingXCStrings:
                        args.createMissingXCStrings === true,
                    sourceLanguage:
                        args.sourceLanguage ??
                        preview.recommended.sourceLanguage,
                });

                const text = [
                    `Wrote config: ${result.configPath}`,
                    result.configExistsBeforeWrite
                        ? 'Existing config was replaced.'
                        : 'Created new config file.',
                    `xcstringsPaths: ${plan.xcstringsPaths.length}`,
                    result.createdXCStringsPaths.length > 0
                        ? `Created ${result.createdXCStringsPaths.length} missing xcstrings file(s).`
                        : 'No new xcstrings files were created.',
                ].join('\n');

                return toToolTextResult(text, {
                    projectRoot: session.projectRoot,
                    configPath: result.configPath,
                    configExistsBeforeWrite: result.configExistsBeforeWrite,
                    createdXCStringsPaths: result.createdXCStringsPaths,
                    plan: {
                        missingLanguagePolicy: plan.missingLanguagePolicy,
                        xcstringsPaths: plan.xcstringsPaths,
                        xcodeprojPaths: plan.xcodeprojPaths,
                        includeXcodeprojPaths: plan.includeXcodeprojPaths,
                    },
                });
            } catch (error) {
                return toToolErrorResult(error);
            }
        },
    );
}
