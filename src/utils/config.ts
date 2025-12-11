import { cosmiconfig } from 'cosmiconfig';
import json5 from 'json5';
import yaml from 'js-yaml';

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

export type MissingLanguagePolicy = 'skip' | 'include';

export interface Config {
    xcstringsPaths?: (string | { alias: string; path: string })[];
    xcodeprojPaths?: string[];
    missingLanguagePolicy?: MissingLanguagePolicy;
}

export async function loadConfig(explicitPath?: string): Promise<Config | null> {
    if (explicitPath) {
        const result = await explorer.load(explicitPath);
        return result ? (result.config as Config) : null;
    }

    const result = await explorer.search();
    return result ? (result.config as Config) : null;
}
