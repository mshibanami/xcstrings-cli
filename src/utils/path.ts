import { select } from '@inquirer/prompts';
import { Config } from './config.js';
import { InteractiveModeOptions, isInteractiveMode } from './interactive.js';
import { DomainError } from './errors.js';

export function findAliasPath(
    entries: (string | { alias: string; path: string })[] | undefined,
    alias: string,
): string | null {
    if (!entries || entries.length === 0) return null;
    for (const entry of entries) {
        if (typeof entry !== 'string' && entry.alias === alias) {
            return entry.path;
        }
    }
    return null;
}

export interface ResolveXCStringsPathOptions extends InteractiveModeOptions {
    /**
     * When true, do not substitute the requested path with `xcstringsPaths`
     * even if the requested path matches the project-root default. Used by
     * MCP to enforce explicit `--path` priority over config-defined paths.
     */
    preferRequestedPath?: boolean;
}

export async function resolveXCStringsPath(
    requestedPath: string | undefined,
    config: Config | null,
    defaultPath: string,
    options: ResolveXCStringsPathOptions = {},
): Promise<string> {
    const interactive = isInteractiveMode(options);
    const entries = config?.xcstringsPaths;
    const preferRequested = options.preferRequestedPath === true;

    const promptForEntry = async (): Promise<string | null> => {
        if (!entries || entries.length === 0) return null;
        if (entries.length === 1) {
            const entry = entries[0];
            return typeof entry === 'string' ? entry : entry.path;
        }
        if (!interactive) {
            throw new DomainError(
                'NON_INTERACTIVE_REQUIRED_ARGUMENT',
                'Non-interactive mode cannot prompt for xcstrings file selection. Specify --path (or --target for import) explicitly.',
            );
        }
        const choices = entries.map((entry) => {
            if (typeof entry === 'string') {
                return { name: entry, value: entry };
            } else {
                return {
                    name: `${entry.alias} (${entry.path})`,
                    value: entry.path,
                };
            }
        });
        return await select({
            message: 'Select xcstrings file:',
            choices: choices,
        });
    };

    if (!requestedPath) {
        const fromEntries = await promptForEntry();
        if (fromEntries !== null) return fromEntries;
        return defaultPath;
    }

    const hasAliasEntries =
        entries?.some((entry) => typeof entry !== 'string') ?? false;

    const aliasFromPrefix = requestedPath.startsWith('alias:')
        ? requestedPath.slice('alias:'.length)
        : null;

    if (aliasFromPrefix) {
        const resolved = findAliasPath(entries, aliasFromPrefix);
        if (!resolved) {
            throw new DomainError(
                'UNKNOWN_ALIAS',
                `Unknown alias: ${aliasFromPrefix}`,
                { alias: aliasFromPrefix },
            );
        }
        return resolved;
    }

    const resolvedFromBareAlias = findAliasPath(entries, requestedPath);
    if (resolvedFromBareAlias) {
        return resolvedFromBareAlias;
    }

    const looksLikeAlias =
        !requestedPath.includes('/') && !requestedPath.endsWith('.xcstrings');
    if (hasAliasEntries && looksLikeAlias) {
        throw new DomainError(
            'UNKNOWN_ALIAS',
            `Unknown alias: ${requestedPath}`,
            {
                alias: requestedPath,
            },
        );
    }

    if (!preferRequested && requestedPath === defaultPath) {
        const fromEntries = await promptForEntry();
        if (fromEntries !== null) return fromEntries;
    }

    return requestedPath;
}
