import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { isAppError } from '../utils/errors.js';
import { loadConfig } from '../utils/config.js';
import { resolveXCStringsPath } from '../utils/path.js';

export type McpWarningMode = 'silent' | 'stderr';

export interface McpRuntimeContext {
    defaultPath: string;
    configPath?: string;
    warningMode: McpWarningMode;
    onWarning: (message: string) => void;
}

export interface CreateMcpRuntimeOptions {
    defaultPath: string;
    configPath?: string;
    warningMode?: McpWarningMode;
}

export function createMcpRuntimeContext(
    options: CreateMcpRuntimeOptions,
): McpRuntimeContext {
    const warningMode = options.warningMode ?? 'silent';
    const onWarning =
        warningMode === 'stderr'
            ? (message: string) => {
                  process.stderr.write(`[xcs mcp] ${message}\n`);
              }
            : () => {
                  // no-op
              };

    return {
        defaultPath: options.defaultPath,
        configPath: options.configPath,
        warningMode,
        onWarning,
    };
}

export async function resolveXCStringsInputPath(
    path: string | undefined,
    configPath: string | undefined,
    runtime: McpRuntimeContext,
): Promise<string> {
    const resolvedConfigPath = resolveConfigPath(configPath, runtime);
    const config = await loadConfig(resolvedConfigPath, {
        suppressWarnings: true,
    });
    return resolveXCStringsPath(path, config, runtime.defaultPath, {
        interactive: false,
    });
}

export function resolveConfigPath(
    configPath: string | undefined,
    runtime: McpRuntimeContext,
): string | undefined {
    if (configPath && configPath.length > 0) {
        return configPath;
    }
    return runtime.configPath;
}

export function toToolTextResult(
    text: string,
    structuredContent?: Record<string, unknown>,
): CallToolResult {
    return {
        content: [
            {
                type: 'text',
                text,
            },
        ],
        ...(structuredContent ? { structuredContent } : {}),
    };
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}

export function toToolErrorResult(error: unknown): CallToolResult {
    const message = toErrorMessage(error);

    const errorPayload: Record<string, unknown> = {
        message,
    };

    if (isAppError(error)) {
        errorPayload.code = error.code;
        if (error.details) {
            errorPayload.details = error.details;
        }
    }

    return {
        content: [
            {
                type: 'text',
                text: message,
            },
        ],
        structuredContent: {
            error: errorPayload,
        },
        isError: true,
    };
}
