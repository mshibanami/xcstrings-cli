import { XcodeProject } from '@bacons/xcode';
import { resolve } from 'node:path';
import { loadConfig } from '../utils/config';
import { readXCStrings } from './_shared';

export function getLanguagesFromXcodeproj(xcodeprojPath: string): string[] {
    const pbxprojPath = resolve(xcodeprojPath, 'project.pbxproj');
    const project = XcodeProject.open(pbxprojPath);
    const rootObject = project.rootObject;
    return rootObject.props.knownRegions ?? [];
}

export async function getLanguagesFromXCStrings(xcstringsPath: string): Promise<string[]> {
    const xcstrings = await readXCStrings(xcstringsPath);
    const languages = new Set<string>();

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
    const config = await loadConfig(configPath);
    if (config?.xcodeprojPaths && config.xcodeprojPaths.length > 0) {
        const allLanguages = new Set<string>();
        for (const xcodeprojPath of config.xcodeprojPaths) {
            const langs = getLanguagesFromXcodeproj(xcodeprojPath);
            langs.forEach((lang) => allLanguages.add(lang));
        }
        return Array.from(allLanguages).sort();
    }
    return await getLanguagesFromXCStrings(xcstringsPath);
}
