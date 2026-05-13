import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { dirname, isAbsolute, resolve } from 'node:path';
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

function resolveMcpProjectRoot(options: CreateMcpSessionOptions): string {
    if (options.projectRoot) {
        return resolve(options.projectRoot);
    }
    if (options.configPath) {
        return dirname(resolve(options.configPath));
    }
    if (options.explicitPath && isAbsolute(options.explicitPath)) {
        return dirname(options.explicitPath);
    }
    if (process.cwd() !== '/') {
        return process.cwd();
    }
    if (process.env.PWD && process.env.PWD !== '/') {
        return resolve(process.env.PWD);
    }
    return process.cwd();
}

function resolveProjectPath(path: string, projectRoot: string): string {
    if (isAbsolute(path)) {
        return path;
    }
    return resolve(projectRoot, path);
}

function resolveConfigPaths(
    config: Config | null,
    projectRoot: string,
): Config | null {
    if (!config) {
        return null;
    }

    const resolvedConfig: Config = { ...config };

    if (resolvedConfig.xcstringsPaths) {
        resolvedConfig.xcstringsPaths = resolvedConfig.xcstringsPaths.map(
            (entry) => {
                if (typeof entry === 'string') {
                    return resolveProjectPath(entry, projectRoot);
                }
                return {
                    ...entry,
                    path: resolveProjectPath(entry.path, projectRoot),
                };
            },
        );
    }

    if (resolvedConfig.xcodeprojPaths) {
        resolvedConfig.xcodeprojPaths = resolvedConfig.xcodeprojPaths.map(
            (entry) => resolveProjectPath(entry, projectRoot),
        );
    }

    return resolvedConfig;
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

    const projectRoot = resolveMcpProjectRoot(options);

    const config = await loadConfig(options.configPath, {
        suppressWarnings: true,
        searchFrom: projectRoot,
    });
    const resolvedConfig = resolveConfigPaths(config, projectRoot);

    const defaultCatalogPath = resolve(projectRoot, 'Localizable.xcstrings');

    return {
        projectRoot,
        resolvedConfigPath: options.configPath,
        resolvedConfig,
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
        const resolved = await resolveXCStringsPath(
            argsPath,
            session.resolvedConfig,
            session.defaultCatalogPath,
            { interactive: false },
        );
        return resolveProjectPath(resolved, session.projectRoot);
    }

    if (session.explicitPath !== undefined) {
        const resolved = await resolveXCStringsPath(
            session.explicitPath,
            session.resolvedConfig,
            session.defaultCatalogPath,
            { interactive: false, preferRequestedPath: true },
        );
        return resolveProjectPath(resolved, session.projectRoot);
    }

    const resolved = await resolveXCStringsPath(
        undefined,
        session.resolvedConfig,
        session.defaultCatalogPath,
        { interactive: false },
    );
    return resolveProjectPath(resolved, session.projectRoot);
}

export function resolveToolPath(
    rawPath: string,
    session: McpSessionContext,
): string {
    return resolveProjectPath(rawPath, session.projectRoot);
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
