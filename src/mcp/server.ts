import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    createMcpRuntimeContext,
    type McpRuntimeContext,
    type McpWarningMode,
} from './runtime.js';
import { registerAllMcpTools } from './tools/index.js';

export interface CreateMcpServerOptions {
    defaultPath: string;
    configPath?: string;
    warningMode?: McpWarningMode;
}

export function createMcpServer(options: CreateMcpServerOptions): {
    server: McpServer;
    runtime: McpRuntimeContext;
} {
    const runtime = createMcpRuntimeContext({
        defaultPath: options.defaultPath,
        configPath: options.configPath,
        warningMode: options.warningMode,
    });
    const serverVersion = process.env.npm_package_version ?? '0.0.0';

    const server = new McpServer({
        name: 'xcstrings-cli',
        version: serverVersion,
    });

    registerAllMcpTools(server, runtime);
    return { server, runtime };
}

export async function startMcpServer(
    options: CreateMcpServerOptions,
): Promise<void> {
    const { server } = createMcpServer(options);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    let closing = false;
    const closeServer = async () => {
        if (closing) {
            return;
        }
        closing = true;
        try {
            await server.close();
        } catch {
            // ignore
        }
    };

    process.once('SIGINT', () => {
        void closeServer().then(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
        void closeServer().then(() => process.exit(0));
    });
}
