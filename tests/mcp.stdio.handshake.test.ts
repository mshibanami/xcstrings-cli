import { afterEach, describe, expect, it } from 'vitest';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';

const createdConnections: McpClientSession[] = [];

afterEach(async () => {
    for (const session of createdConnections.splice(0)) {
        await closeMcpClient(session);
    }
});

describe('mcp stdio handshake', () => {
    it('connects and lists tools', async () => {
        const session = await connectMcpClient();
        createdConnections.push(session);
        const { client } = session;
        const result = await client.listTools();
        const toolNames = result.tools.map((tool) => tool.name);

        expect(toolNames.length).toBeGreaterThan(0);
        expect(toolNames).toContain('languages_list');
    }, 20000);
});
