import { writeFile, readdir, access } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import chalk from 'chalk';
import { checkbox, confirm, input, select } from '@inquirer/prompts';
import { CommandModule } from 'yargs';
import {
    detectSwiftPackage,
    SwiftPackageState,
} from '../utils/swift-package.js';
import { mkdir } from 'node:fs/promises';
import { isMatch } from 'micromatch';

const INIT_FILE_NAME = 'xcstrings-cli.yaml';

const IGNORE_DIR_PATTERNS = [
    '.*',
    'node_modules',
    'build',
    'dist',
    'DerivedData',
];

export function createInitCommand(): CommandModule {
    return {
        command: 'init',
        describe: 'Initialize configuration file',
        handler: async () => {
            await init();
        },
    } satisfies CommandModule;
}

async function findXCStringsFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string): Promise<void> {
        try {
            const entries = await readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = resolve(currentDir, entry.name);
                if (entry.isDirectory()) {
                    // Skip ignored patterns
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

    await walk(dir);
    return results;
}

async function findXcodeprojDirs(startDir: string): Promise<string[]> {
    const results: string[] = [];
    let currentDir = startDir;
    try {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
                results.push(resolve(currentDir, entry.name));
            }
        }
    } catch {
        // Ignore permission errors
    }
    return results;
}

export async function init(): Promise<void> {
    const cwd = process.cwd();

    console.log();
    console.log(chalk.bold.cyan('🚀 xcstrings-cli Configuration Setup'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log();

    const swiftPackageInfo = await detectSwiftPackage(cwd);
    if (swiftPackageInfo.state !== SwiftPackageState.None) {
        console.log(
            chalk.cyan(
                `📦 Swift Package detected (State: ${swiftPackageInfo.state})`,
            ),
        );
        if (swiftPackageInfo.defaultLocalization) {
            console.log(
                chalk.dim(
                    `   Default localization: ${swiftPackageInfo.defaultLocalization}`,
                ),
            );
        }
        console.log();
    }

    console.log(chalk.yellow('🔍 Searching for .xcstrings files...'));
    const xcstringsFiles = await findXCStringsFiles(cwd);

    console.log(chalk.yellow('🔍 Searching for .xcodeproj directories...'));
    const xcodeprojDirs = await findXcodeprojDirs(cwd);

    console.log();

    let selectedXCStrings: string[] = [];
    if (xcstringsFiles.length > 0) {
        console.log(
            chalk.green(`✓ Found ${xcstringsFiles.length} .xcstrings file(s)`),
        );
        console.log();

        const choices = xcstringsFiles.map((file) => ({
            name: chalk.white(relative(cwd, file)) + chalk.dim(` (${file})`),
            value: relative(cwd, file),
            checked: true,
        }));

        selectedXCStrings = await checkbox({
            message: chalk.bold('Select .xcstrings files to manage:'),
            choices,
        });
    } else {
        console.log(
            chalk.dim('  No .xcstrings files found in current directory'),
        );
    }

    // Allow manual path entry if no files found or user wants to add more
    const xcstringsChoices = [];
    if (
        swiftPackageInfo.suggestedXCStringsPaths &&
        swiftPackageInfo.suggestedXCStringsPaths.length > 0
    ) {
        for (const path of swiftPackageInfo.suggestedXCStringsPaths) {
            xcstringsChoices.push({
                name: `${path}`,
                value: path,
            });
        }
    }
    xcstringsChoices.push({
        name: 'Manual entry',
        value: 'manual',
    });
    xcstringsChoices.push({
        name: 'Do not specify',
        value: 'none',
    });

    const xcstringsSelection = await select({
        message: chalk.bold(
            selectedXCStrings.length > 0
                ? 'Select how to add another .xcstrings file:'
                : 'Select how to specify .xcstrings file path:',
        ),
        choices: xcstringsChoices,
    });

    let manualPath: string | undefined;
    if (xcstringsSelection === 'manual') {
        manualPath = await input({
            message: chalk.bold('Enter the path to .xcstrings file:'),
        });
    } else if (xcstringsSelection !== 'none') {
        manualPath = xcstringsSelection;
    }

    if (manualPath) {
        const fullManualPath = resolve(cwd, manualPath);
        let exists = false;
        try {
            await access(fullManualPath);
            exists = true;
        } catch {
            // Not found
        }

        if (!exists) {
            const shouldCreate = await confirm({
                message: chalk.yellow(
                    `File ${manualPath} does not exist. Do you want to create a new one?`,
                ),
                default: true,
            });

            if (shouldCreate) {
                const defaultLang = await input({
                    message: chalk.bold(
                        'Enter the default language for the new file:',
                    ),
                    default: swiftPackageInfo.defaultLocalization || 'en',
                });

                const dir = dirname(fullManualPath);
                await mkdir(dir, { recursive: true });

                const initialContent = {
                    sourceLanguage: defaultLang || 'en',
                    strings: {},
                    version: '1.0',
                };
                await writeFile(
                    fullManualPath,
                    JSON.stringify(initialContent, null, 2),
                    'utf-8',
                );
                console.log(
                    chalk.green(
                        `✓ Created new .xcstrings file at ${manualPath}`,
                    ),
                );
            }
        }

        if (!selectedXCStrings.includes(manualPath)) {
            selectedXCStrings.push(manualPath);
        }
    }

    console.log();

    let selectedXcodeproj: string[] = [];
    if (xcodeprojDirs.length > 0) {
        console.log(
            chalk.green(
                `✓ Found ${xcodeprojDirs.length} .xcodeproj director${xcodeprojDirs.length === 1 ? 'y' : 'ies'}`,
            ),
        );
        console.log();

        const choices = xcodeprojDirs.map((dir) => ({
            name:
                chalk.white(relative(cwd, dir) || dir) + chalk.dim(` (${dir})`),
            value: relative(cwd, dir) || dir,
            checked: true,
        }));

        selectedXcodeproj = await checkbox({
            message: chalk.bold(
                'Select .xcodeproj directories for language detection:',
            ),
            choices,
        });

        const xcodeprojChoices = [
            { name: 'Manual entry', value: 'manual' },
            { name: 'Do not specify', value: 'none' },
        ];

        const xcodeprojSelection = await select({
            message: chalk.bold('Select how to add another .xcodeproj directory:'),
            choices: xcodeprojChoices,
        });

        if (xcodeprojSelection === 'manual') {
            const manualPath = await input({
                message: chalk.bold('Enter the path to .xcodeproj directory:'),
            });

            if (manualPath && !selectedXcodeproj.includes(manualPath)) {
                selectedXcodeproj.push(manualPath);
            }
        }
    } else {
        if (swiftPackageInfo.state === SwiftPackageState.None) {
            console.log(chalk.dim('  No .xcodeproj directories found'));
        }

        const manualPath = await input({
            message: chalk.bold(
                'Enter the path to .xcodeproj directory (leave empty to skip):',
            ),
        });

        if (manualPath) {
            selectedXcodeproj.push(manualPath);
        }
    }

    console.log();
    console.log(chalk.dim('─'.repeat(40)));
    console.log();

    console.log(chalk.bold('📋 Configuration Summary:'));
    console.log();

    console.log(chalk.cyan('  xcstringsPaths:'));
    if (selectedXCStrings.length > 0) {
        selectedXCStrings.forEach((p) =>
            console.log(chalk.white(`    • ${p}`)),
        );
    } else {
        console.log(chalk.dim('    (none)'));
    }

    if (selectedXcodeproj.length > 0 || xcodeprojDirs.length > 0) {
        console.log();
        console.log(chalk.cyan('  xcodeprojPaths:'));
        if (selectedXcodeproj.length > 0) {
            selectedXcodeproj.forEach((p) =>
                console.log(chalk.white(`    • ${p}`)),
            );
        } else {
            console.log(chalk.dim('    (none)'));
        }
    }

    console.log();

    const shouldWrite = await confirm({
        message: chalk.bold(`Create ${chalk.yellow(INIT_FILE_NAME)}?`),
        default: true,
    });

    if (!shouldWrite) {
        console.log(chalk.dim('  Configuration cancelled.'));
        return;
    }

    const xcstringsArray =
        selectedXCStrings.length > 0
            ? '\n' + selectedXCStrings.map((p) => `  - "${p}"`).join('\n')
            : ' []';

    const xcodeprojArray =
        selectedXcodeproj.length > 0
            ? '\n' + selectedXcodeproj.map((p) => `  - "${p}"`).join('\n')
            : ' []';

    let config = `# Behavior for handling missing languages when adding strings.
missingLanguagePolicy: "skip"

# Paths to .xcstrings files to manage. Specify relative or absolute paths.
xcstringsPaths:${xcstringsArray}
`;
    const isSwiftPackage = swiftPackageInfo.state !== SwiftPackageState.None;
    const shouldExcludeXcodeproj =
        isSwiftPackage && selectedXcodeproj.length === 0;

    if (!shouldExcludeXcodeproj) {
        config += `
# Paths to .xcodeproj directories. Used for discovering supported languages.
xcodeprojPaths:${xcodeprojArray}
`;
    }

    await writeFile(resolve(cwd, INIT_FILE_NAME), config, 'utf-8');

    console.log();
    console.log(chalk.bold.green(`✓ Created ${INIT_FILE_NAME}`));
    console.log(
        chalk.dim(
            `   Run ${chalk.cyan('xcstrings --help')} to see available commands.`,
        ),
    );
    console.log();
}
