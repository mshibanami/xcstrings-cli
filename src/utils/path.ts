import { select } from '@inquirer/prompts';
import { Config } from './config.js';

export function findAliasPath(entries: (string | { alias: string; path: string })[] | undefined, alias: string): string | null {
    if (!entries || entries.length === 0) return null;
    for (const entry of entries) {
        if (typeof entry !== 'string' && entry.alias === alias) {
            return entry.path;
        }
    }
    return null;
}

export async function resolveXCStringsPath(
    requestedPath: string,
    config: Config | null,
    defaultPath: string,
): Promise<string> {
    const entries = config?.xcstringsPaths;

    const hasAliasEntries = entries?.some((entry) => typeof entry !== 'string') ?? false;

    const aliasFromPrefix = requestedPath.startsWith('alias:')
        ? requestedPath.slice('alias:'.length)
        : null;

    if (aliasFromPrefix) {
        const resolved = findAliasPath(entries, aliasFromPrefix);
        if (!resolved) {
            throw new Error(`Unknown alias: ${aliasFromPrefix}`);
        }
        return resolved;
    }

    const resolvedFromBareAlias = findAliasPath(entries, requestedPath);
    if (resolvedFromBareAlias) {
        return resolvedFromBareAlias;
    }

    const looksLikeAlias = !requestedPath.includes('/') && !requestedPath.endsWith('.xcstrings');
    if (hasAliasEntries && looksLikeAlias) {
        throw new Error(`Unknown alias: ${requestedPath}`);
    }

    if (requestedPath === defaultPath && entries && entries.length > 0) {
        if (entries.length === 1) {
            const entry = entries[0];
            return typeof entry === 'string' ? entry : entry.path;
        }

        const choices = entries.map((entry) => {
            if (typeof entry === 'string') {
                return { name: entry, value: entry };
            } else {
                return { name: `${entry.alias} (${entry.path})`, value: entry.path };
            }
        });

        const selectedPath = await select({
            message: 'Select xcstrings file:',
            choices: choices,
        });
        return selectedPath;
    }

    return requestedPath;
}