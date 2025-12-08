import { cosmiconfig } from 'cosmiconfig';
import json5 from 'json5';

const moduleName = 'xcstrings-cli';

const explorer = cosmiconfig(moduleName, {
    searchPlaces: [
        `${moduleName}.json`,
        `${moduleName}.json5`,
    ],
    loaders: {
        '.json5': async (filepath: string, content: string) => {
            return json5.parse(content);
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
