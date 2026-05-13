import { afterEach, describe, expect, it } from 'vitest';
import {
    closeMcpClient,
    connectMcpClient,
    type McpClientSession,
} from './utils/mcpClientHelper';

const sessions: McpClientSession[] = [];

afterEach(async () => {
    for (const session of sessions.splice(0)) {
        await closeMcpClient(session);
    }
});

describe('mcp tool annotations', () => {
    it('sets expected safety annotations for all tools', async () => {
        const session = await connectMcpClient();
        sessions.push(session);

        const result = await session.client.listTools();
        const toolsByName = new Map(
            result.tools.map((tool) => [tool.name, tool]),
        );

        const expected: Record<
            string,
            {
                readOnlyHint: boolean;
                destructiveHint: boolean;
                idempotentHint: boolean;
                openWorldHint: boolean;
            }
        > = {
            'xcs.languages.list': {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            'xcs.strings.list': {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            'xcs.add': {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            'xcs.remove': {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
            'xcs.import': {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            'xcs.export': {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
        };

        for (const [toolName, expectedAnnotations] of Object.entries(
            expected,
        )) {
            const tool = toolsByName.get(toolName);
            expect(tool, `missing tool: ${toolName}`).toBeDefined();
            expect(tool?.annotations).toMatchObject(expectedAnnotations);
        }
    }, 20000);
});
