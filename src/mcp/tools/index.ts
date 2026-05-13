import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpSessionContext } from '../runtime.js';
import { registerAddTool } from './add.js';
import { registerExportTool } from './export.js';
import { registerInitApplyTool } from './init-apply.js';
import { registerInitPreviewTool } from './init-preview.js';
import { registerImportTool } from './import.js';
import { registerLanguagesTool } from './languages.js';
import { registerRemoveTool } from './remove.js';
import { registerStringsTool } from './strings.js';

export function registerAllMcpTools(
    server: McpServer,
    session: McpSessionContext,
): void {
    registerLanguagesTool(server, session);
    registerStringsTool(server, session);
    registerInitPreviewTool(server, session);
    registerAddTool(server, session);
    registerRemoveTool(server, session);
    registerImportTool(server, session);
    registerExportTool(server, session);
    registerInitApplyTool(server, session);
}
