import { cosmiconfig } from 'cosmiconfig';
import json5 from 'json5';
import yaml from 'js-yaml';
import logger from './logger.js';

const moduleName = 'xcstrings-cli';

const explorer = cosmiconfig(moduleName, {
    searchPlaces: [
        `${moduleName}.json`,
        `${moduleName}.json5`,
        `${moduleName}.yaml`,
        `${moduleName}.yml`,
    ],
    loaders: {
        '.json5': (filepath: string, content: string) => {
            return json5.parse(content);
        },
        '.yaml': (_filepath: string, content: string) => {
            return yaml.load(content);
        },
        '.yml': (_filepath: string, content: string) => {
            return yaml.load(content);
        },
    },
    cache: false,
});

import type { ExportMergePolicy } from '../commands/export.js';
import type { ImportMergePolicy } from '../commands/import.js';

export type MissingLanguagePolicy = 'skip' | 'include';

export interface Config {
    xcstringsPaths?: (string | { alias: string; path: string })[];
    xcodeprojPaths?: string[];
    missingLanguagePolicy?: MissingLanguagePolicy;
    exportMergePolicy?: ExportMergePolicy;
    importMergePolicy?: ImportMergePolicy;
    /** @deprecated Use exportMergePolicy instead */
    mergePolicy?: ExportMergePolicy;
}

export async function loadConfig(
    explicitPath?: string,
): Promise<Config | null> {
    if (explicitPath) {
        const result = await explorer.load(explicitPath);
        return result ? (result.config as Config) : null;
    }

    const result = await explorer.search();
    const config = result ? (result.config as Config) : null;

    if (config?.mergePolicy) {
        logger.warn(
            'WARNING: "mergePolicy" is deprecated. Please use "exportMergePolicy" instead.',
        );
        if (!config.exportMergePolicy) {
            config.exportMergePolicy = config.mergePolicy;
        }
    }

    return config;
}
