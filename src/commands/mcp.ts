import { CommandModule } from 'yargs';
import { startMcpServer } from '../mcp/server.js';
import type { McpWarningMode } from '../mcp/runtime.js';

const MCP_WARNING_MODES = ['silent', 'stderr'] as const;

export function createMcpCommand(): CommandModule {
    return {
        command: 'mcp',
        describe: 'Start MCP server over stdio',
        builder: (yargs) =>
            yargs
                .option('project-root', {
                    type: 'string',
                    describe:
                        'Project root directory for context and config resolution',
                })
                .option('warnings', {
                    type: 'string',
                    choices: MCP_WARNING_MODES,
                    default: 'silent',
                    describe:
                        'Where to write server warnings during MCP mode (silent | stderr)',
                }),
        handler: async (argv) => {
            process.env.XCS_NON_INTERACTIVE = '1';
            process.env.XCS_SUPPRESS_CONFIG_WARNINGS = '1';

            await startMcpServer({
                explicitPath: argv.path as string | undefined,
                configPath: argv.config as string | undefined,
                projectRoot: argv.projectRoot as string | undefined,
                warningMode: argv.warnings as McpWarningMode,
            });
        },
    } satisfies CommandModule;
}
