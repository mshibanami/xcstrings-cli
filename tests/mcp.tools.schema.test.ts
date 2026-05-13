import { afterEach, describe, expect, it } from 'vitest';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';

const createdSessions: McpClientSession[] = [];

afterEach(async () => {
    for (const session of createdSessions.splice(0)) {
        await closeMcpClient(session);
    }
});

describe('mcp tools: input schema (Phase 2)', () => {
    it('no tool exposes a configPath input property', async () => {
        const session = await connectMcpClient();
        createdSessions.push(session);

        const { tools } = await session.client.listTools();
        expect(tools.length).toBeGreaterThan(0);

        for (const tool of tools) {
            const properties =
                (tool.inputSchema?.properties as
                    | Record<string, unknown>
                    | undefined) ?? {};
            expect(
                Object.keys(properties),
                `tool "${tool.name}" must not declare configPath`,
            ).not.toContain('configPath');
        }
    }, 20000);
});
