import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'node:path';
import { isAppError } from '../utils/errors.js';
import { loadConfig } from '../utils/config.js';
import { resolveXCStringsPath } from '../utils/path.js';

import type { Config } from '../utils/config.js';

export type McpWarningMode = 'silent' | 'stderr';

export interface McpSessionContext {
    projectRoot: string;
    resolvedConfigPath?: string;
    resolvedConfig: Config | null;
    /** User-provided `--path` (high precedence). Distinct from defaultCatalogPath (lowest fallback). */
    explicitPath?: string;
    /** Project-root fallback used when no path is otherwise specified (lowest). */
    defaultCatalogPath: string;
    warningMode: McpWarningMode;
    onWarning: (message: string) => void;
}

export interface CreateMcpSessionOptions {
    /** User-supplied `--path` argument (undefined if not provided). */
    explicitPath?: string;
    configPath?: string;
    projectRoot?: string;
    warningMode?: McpWarningMode;
}

export async function resolveSessionContext(
    options: CreateMcpSessionOptions,
): Promise<McpSessionContext> {
    const warningMode = options.warningMode ?? 'silent';
    const onWarning =
        warningMode === 'stderr'
            ? (message: string) => {
                  process.stderr.write(`[xcs mcp] ${message}\n`);
              }
            : () => {
                  // no-op
              };

    const projectRoot = options.projectRoot
        ? resolve(options.projectRoot)
        : process.cwd();

    const config = await loadConfig(options.configPath, {
        suppressWarnings: true,
        searchFrom: projectRoot,
    });

    const defaultCatalogPath = resolve(projectRoot, 'Localizable.xcstrings');

    return {
        projectRoot,
        resolvedConfigPath: options.configPath,
        resolvedConfig: config,
        explicitPath: options.explicitPath,
        defaultCatalogPath,
        warningMode,
        onWarning,
    };
}

export async function resolveToolCatalogPath(
    argsPath: string | undefined,
    session: McpSessionContext,
): Promise<string> {
    if (argsPath !== undefined) {
        return resolveXCStringsPath(
            argsPath,
            session.resolvedConfig,
            session.defaultCatalogPath,
            { interactive: false },
        );
    }

    if (session.explicitPath !== undefined) {
        return resolveXCStringsPath(
            session.explicitPath,
            session.resolvedConfig,
            session.defaultCatalogPath,
            { interactive: false, preferRequestedPath: true },
        );
    }

    return resolveXCStringsPath(
        undefined,
        session.resolvedConfig,
        session.defaultCatalogPath,
        { interactive: false },
    );
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
