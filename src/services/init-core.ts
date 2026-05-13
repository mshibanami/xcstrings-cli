import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { isMatch } from 'micromatch';
import type { MissingLanguagePolicy } from '../utils/config.js';
import {
    detectSwiftPackage,
    type SwiftPackageInfo,
    SwiftPackageState,
} from '../utils/swift-package.js';
import { writeXCStrings } from './shared/xcstrings.js';

export const INIT_FILE_NAME = 'xcstrings-cli.yaml';

const IGNORE_DIR_PATTERNS = [
    '.*',
    'node_modules',
    'build',
    'dist',
    'DerivedData',
];

export interface InitDiscoveryResult {
    projectRoot: string;
    swiftPackageInfo: SwiftPackageInfo;
    xcstringsPaths: string[];
    xcodeprojPaths: string[];
    configPath: string;
    configExists: boolean;
}

export interface InitConfigPlanInput {
    projectRoot: string;
    swiftPackageState: SwiftPackageState;
    xcstringsPaths: string[];
    xcodeprojPaths: string[];
    missingLanguagePolicy?: MissingLanguagePolicy;
}

export interface InitConfigPlan {
    projectRoot: string;
    configPath: string;
    missingLanguagePolicy: MissingLanguagePolicy;
    xcstringsPaths: string[];
    xcodeprojPaths: string[];
    includeXcodeprojPaths: boolean;
}

export interface ApplyInitConfigPlanOptions {
    createMissingXCStrings?: boolean;
    sourceLanguage?: string;
}

export interface ApplyInitConfigPlanResult {
    configPath: string;
    configExistsBeforeWrite: boolean;
    createdXCStringsPaths: string[];
    writtenContent: string;
}

export interface InitPreviewResult {
    projectRoot: string;
    configPath: string;
    configExists: boolean;
    swiftPackageInfo: SwiftPackageInfo;
    discovered: {
        xcstringsPaths: string[];
        xcodeprojPaths: string[];
    };
    recommended: {
        missingLanguagePolicy: MissingLanguagePolicy;
        xcstringsPaths: string[];
        xcodeprojPaths: string[];
        includeXcodeprojPaths: boolean;
        sourceLanguage: string;
    };
    warnings: string[];
}

function normalizePathList(paths: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of paths) {
        const value = raw.trim();
        if (!value || seen.has(value)) {
            continue;
        }
        seen.add(value);
        normalized.push(value);
    }
    return normalized;
}

export async function findXCStringsFiles(
    projectRoot: string,
): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string): Promise<void> {
        try {
            const entries = await readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = resolve(currentDir, entry.name);
                if (entry.isDirectory()) {
                    if (!isMatch(entry.name, IGNORE_DIR_PATTERNS)) {
                        await walk(fullPath);
                    }
                } else if (entry.name.endsWith('.xcstrings')) {
                    results.push(fullPath);
                }
            }
        } catch {
            // Ignore permission errors
        }
    }

    await walk(projectRoot);
    return results;
}

export async function findXcodeprojDirs(
    projectRoot: string,
): Promise<string[]> {
    const results: string[] = [];
    try {
        const entries = await readdir(projectRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
                results.push(resolve(projectRoot, entry.name));
            }
        }
    } catch {
        // Ignore permission errors
    }
    return results;
}

export async function discoverInitContext(
    projectRoot: string,
): Promise<InitDiscoveryResult> {
    const swiftPackageInfo = await detectSwiftPackage(projectRoot);
    const xcstringsFiles = await findXCStringsFiles(projectRoot);
    const xcodeprojDirs = await findXcodeprojDirs(projectRoot);

    const toRelative = (path: string): string => {
        const rel = relative(projectRoot, path);
        return rel.startsWith('..') ? path : rel;
    };

    const xcstringsPaths = normalizePathList(xcstringsFiles.map(toRelative));
    const xcodeprojPaths = normalizePathList(xcodeprojDirs.map(toRelative));

    const configPath = resolve(projectRoot, INIT_FILE_NAME);
    let configExists = false;
    try {
        await access(configPath);
        configExists = true;
    } catch {
        // not found
    }

    return {
        projectRoot,
        swiftPackageInfo,
        xcstringsPaths,
        xcodeprojPaths,
        configPath,
        configExists,
    };
}

export function createInitConfigPlan(
    input: InitConfigPlanInput,
): InitConfigPlan {
    const xcstringsPaths = normalizePathList(input.xcstringsPaths);
    const xcodeprojPaths = normalizePathList(input.xcodeprojPaths);
    const includeXcodeprojPaths = !(
        input.swiftPackageState !== SwiftPackageState.None &&
        xcodeprojPaths.length === 0
    );

    return {
        projectRoot: input.projectRoot,
        configPath: resolve(input.projectRoot, INIT_FILE_NAME),
        missingLanguagePolicy: input.missingLanguagePolicy ?? 'skip',
        xcstringsPaths,
        xcodeprojPaths,
        includeXcodeprojPaths,
    };
}

function renderYamlArray(paths: string[]): string {
    if (paths.length === 0) {
        return ' []';
    }
    return '\n' + paths.map((path) => `  - ${JSON.stringify(path)}`).join('\n');
}

export function renderInitConfigYaml(plan: InitConfigPlan): string {
    let config = `# Behavior for handling missing languages when adding strings.
missingLanguagePolicy: ${JSON.stringify(plan.missingLanguagePolicy)}

# Paths to .xcstrings files to manage. Specify relative or absolute paths.
xcstringsPaths:${renderYamlArray(plan.xcstringsPaths)}
`;

    if (plan.includeXcodeprojPaths) {
        config += `
# Paths to .xcodeproj directories. Used for discovering supported languages.
xcodeprojPaths:${renderYamlArray(plan.xcodeprojPaths)}
`;
    }

    return config;
}

export async function ensureXCStringsCatalog(
    projectRoot: string,
    relativeOrAbsolutePath: string,
    sourceLanguage: string,
): Promise<boolean> {
    const targetPath = resolve(projectRoot, relativeOrAbsolutePath);
    try {
        await access(targetPath);
        return false;
    } catch {
        // create
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeXCStrings(targetPath, {
        sourceLanguage,
        version: '1.0',
        strings: {},
    });
    return true;
}

export async function applyInitConfigPlan(
    plan: InitConfigPlan,
    options: ApplyInitConfigPlanOptions = {},
): Promise<ApplyInitConfigPlanResult> {
    const sourceLanguage = options.sourceLanguage || 'en';
    const createdXCStringsPaths: string[] = [];

    if (options.createMissingXCStrings) {
        for (const path of plan.xcstringsPaths) {
            const created = await ensureXCStringsCatalog(
                plan.projectRoot,
                path,
                sourceLanguage,
            );
            if (created) {
                createdXCStringsPaths.push(path);
            }
        }
    }

    let configExistsBeforeWrite = false;
    try {
        await access(plan.configPath);
        configExistsBeforeWrite = true;
    } catch {
        // not found
    }

    const writtenContent = renderInitConfigYaml(plan);
    await writeFile(plan.configPath, writtenContent, 'utf-8');

    return {
        configPath: plan.configPath,
        configExistsBeforeWrite,
        createdXCStringsPaths,
        writtenContent,
    };
}

export async function previewInitSetup(
    projectRoot: string,
): Promise<InitPreviewResult> {
    const discovery = await discoverInitContext(projectRoot);
    const recommendedXCStrings =
        discovery.xcstringsPaths.length > 0
            ? discovery.xcstringsPaths
            : normalizePathList(
                  discovery.swiftPackageInfo.suggestedXCStringsPaths ?? [],
              );

    const recommendedXcodeproj = discovery.xcodeprojPaths;
    const sourceLanguage =
        discovery.swiftPackageInfo.defaultLocalization || 'en';
    const plan = createInitConfigPlan({
        projectRoot: discovery.projectRoot,
        swiftPackageState: discovery.swiftPackageInfo.state,
        xcstringsPaths: recommendedXCStrings,
        xcodeprojPaths: recommendedXcodeproj,
        missingLanguagePolicy: 'skip',
    });

    const warnings: string[] = [];
    if (discovery.configExists) {
        warnings.push(
            `${INIT_FILE_NAME} already exists and may be overwritten by apply.`,
        );
    }
    if (recommendedXCStrings.length === 0) {
        warnings.push(
            'No .xcstrings files were discovered. Provide xcstringsPaths when applying.',
        );
    }

    return {
        projectRoot: discovery.projectRoot,
        configPath: discovery.configPath,
        configExists: discovery.configExists,
        swiftPackageInfo: discovery.swiftPackageInfo,
        discovered: {
            xcstringsPaths: discovery.xcstringsPaths,
            xcodeprojPaths: discovery.xcodeprojPaths,
        },
        recommended: {
            missingLanguagePolicy: 'skip',
            xcstringsPaths: plan.xcstringsPaths,
            xcodeprojPaths: plan.xcodeprojPaths,
            includeXcodeprojPaths: plan.includeXcodeprojPaths,
            sourceLanguage,
        },
        warnings,
    };
}
