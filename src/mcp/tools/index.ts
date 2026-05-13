import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpRuntimeContext } from '../runtime.js';
import { registerAddTool } from './add.js';
import { registerExportTool } from './export.js';
import { registerImportTool } from './import.js';
import { registerLanguagesTool } from './languages.js';
import { registerRemoveTool } from './remove.js';
import { registerStringsTool } from './strings.js';

export function registerAllMcpTools(
    server: McpServer,
    runtime: McpRuntimeContext,
): void {
    registerLanguagesTool(server, runtime);
    registerStringsTool(server, runtime);
    registerAddTool(server, runtime);
    registerRemoveTool(server, runtime);
    registerImportTool(server, runtime);
    registerExportTool(server, runtime);
}
