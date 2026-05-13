import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    resolveSessionContext,
    type McpSessionContext,
    type McpWarningMode,
} from './runtime.js';
import { registerAllMcpTools } from './tools/index.js';

declare const __XCS_VERSION__: string | undefined;
let cachedPackageVersion: string | undefined;

function loadVersionFromPackageJson(): string {
    const thisFilePath = fileURLToPath(import.meta.url);
    const packageJsonPath = resolve(
        dirname(thisFilePath),
        '../../package.json',
    );
    const raw = readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: unknown };

    if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
        throw new Error('package.json version is missing or invalid.');
    }

    return parsed.version;
}

function getPackageVersion(): string {
    if (process.env.npm_package_version) {
        return process.env.npm_package_version;
    }
    if (typeof __XCS_VERSION__ !== 'undefined' && __XCS_VERSION__) {
        return __XCS_VERSION__;
    }

    if (!cachedPackageVersion) {
        cachedPackageVersion = loadVersionFromPackageJson();
    }

    return cachedPackageVersion;
}

export interface CreateMcpServerOptions {
    explicitPath?: string;
    configPath?: string;
    projectRoot?: string;
    warningMode?: McpWarningMode;
}

export async function createMcpServer(
    options: CreateMcpServerOptions,
): Promise<{
    server: McpServer;
    session: McpSessionContext;
}> {
    const session = await resolveSessionContext({
        explicitPath: options.explicitPath,
        configPath: options.configPath,
        projectRoot: options.projectRoot,
        warningMode: options.warningMode,
    });

    const server = new McpServer({
        name: 'xcstrings-cli',
        version: getPackageVersion(),
    });

    registerAllMcpTools(server, session);
    return { server, session };
}

export async function startMcpServer(
    options: CreateMcpServerOptions,
): Promise<void> {
    const { server } = await createMcpServer(options);
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
