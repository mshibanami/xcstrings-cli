import { XcodeProject } from '@bacons/xcode';
import { resolve } from 'node:path';
import { loadConfig } from '../utils/config';
import { readXCStrings } from './_shared';
import { CommandModule } from 'yargs';
import logger from '../utils/logger.js';

export function createLanguagesCommand(): CommandModule {
    return {
        command: 'languages',
        describe: 'List supported languages from xcodeproj or xcstrings',
        handler: async (argv) => {
            const result = await languages(argv.path as string, argv.config as string | undefined);
            logger.info(result.join(' '));
        },
    } satisfies CommandModule;
}

export function getLanguagesFromXcodeproj(xcodeprojPath: string): string[] {
    const pbxprojPath = resolve(xcodeprojPath, 'project.pbxproj');
    const project = XcodeProject.open(pbxprojPath);
    const rootObject = project.rootObject;
    const knownRegions = rootObject.props.knownRegions ?? [];
    return knownRegions.filter((lang: string) => lang !== 'Base').sort();
}

export async function getLanguagesFromXCStrings(xcstringsPath: string): Promise<string[]> {
    const xcstrings = await readXCStrings(xcstringsPath);
    const languages = new Set<string>();

    if (!xcstrings.sourceLanguage) {
        throw new Error('The xcstrings file is missing "sourceLanguage".');
    }

    languages.add(xcstrings.sourceLanguage);

    for (const key of Object.keys(xcstrings.strings)) {
        const unit = xcstrings.strings[key];
        if (unit.localizations) {
            for (const lang of Object.keys(unit.localizations)) {
                languages.add(lang);
            }
        }
    }

    return Array.from(languages).sort();
}

export async function languages(
    xcstringsPath: string,
    configPath?: string
): Promise<string[]> {
    const { sourceLanguage } = await readXCStrings(xcstringsPath);

    if (!sourceLanguage) {
        throw new Error('The xcstrings file is missing "sourceLanguage".');
    }

    const config = await loadConfig(configPath);
    if (config?.xcodeprojPaths && config.xcodeprojPaths.length > 0) {
        const allLanguages = new Set<string>();
        allLanguages.add(sourceLanguage);
        for (const xcodeprojPath of config.xcodeprojPaths) {
            const langs = getLanguagesFromXcodeproj(xcodeprojPath);
            langs.forEach((lang) => allLanguages.add(lang));
        }
        return Array.from(allLanguages).sort();
    }
    const langs = await getLanguagesFromXCStrings(xcstringsPath);
    const allLanguages = new Set<string>(langs);
    allLanguages.add(sourceLanguage);
    return Array.from(allLanguages).sort();
}
