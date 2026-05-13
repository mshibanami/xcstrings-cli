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
            'languages_list': {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            'strings_list': {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            'init_preview': {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            'add': {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            'remove': {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
            'import': {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            'export': {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
            'init_apply': {
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
