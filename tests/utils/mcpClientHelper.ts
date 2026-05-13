import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const node = process.execPath;
const cliPath = resolve(process.cwd(), 'dist', 'index.js');

export interface McpClientSession {
    client: Client;
    transport: StdioClientTransport;
}

export async function connectMcpClient(options?: {
    args?: string[];
    envOverrides?: NodeJS.ProcessEnv;
}): Promise<McpClientSession> {
    const transport = new StdioClientTransport({
        command: node,
        args: [
            '--enable-source-maps',
            cliPath,
            'mcp',
            ...(options?.args ?? []),
        ],
        cwd: process.cwd(),
        env: {
            ...process.env,
            XCS_NON_INTERACTIVE: '1',
            ...(options?.envOverrides ?? {}),
        } as Record<string, string>,
        stderr: 'pipe',
    });
    const client = new Client({
        name: 'xcstrings-cli-test-client',
        version: '1.0.0',
    });

    await client.connect(transport);
    return { client, transport };
}

export async function closeMcpClient(session: McpClientSession): Promise<void> {
    try {
        await session.client.close();
    } catch {
        // best effort
    }
    try {
        await session.transport.close();
    } catch {
        // best effort
    }
}
