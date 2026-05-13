import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { checkbox, confirm, input, select } from '@inquirer/prompts';
import { SwiftPackageState } from '../utils/swift-package.js';
import {
    INIT_FILE_NAME,
    applyInitConfigPlan,
    createInitConfigPlan,
    discoverInitContext,
    ensureXCStringsCatalog,
} from './init-core.js';

export async function init(): Promise<void> {
    const cwd = process.cwd();

    console.log();
    console.log(chalk.bold.cyan('🚀 xcstrings-cli Configuration Setup'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log();

    const discovery = await discoverInitContext(cwd);
    const swiftPackageInfo = discovery.swiftPackageInfo;

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
    const xcstringsFiles = discovery.xcstringsPaths;

    console.log(chalk.yellow('🔍 Searching for .xcodeproj directories...'));
    const xcodeprojDirs = discovery.xcodeprojPaths;

    console.log();

    let selectedXCStrings: string[] = [];
    if (xcstringsFiles.length > 0) {
        console.log(
            chalk.green(`✓ Found ${xcstringsFiles.length} .xcstrings file(s)`),
        );
        console.log();

        const choices = xcstringsFiles.map((file) => ({
            name: chalk.white(file),
            value: file,
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

    const xcstringsChoices = [];
    if (
        swiftPackageInfo.suggestedXCStringsPaths &&
        swiftPackageInfo.suggestedXCStringsPaths.length > 0
    ) {
        for (const path of swiftPackageInfo.suggestedXCStringsPaths) {
            xcstringsChoices.push({
                name: path,
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

                await ensureXCStringsCatalog(
                    cwd,
                    manualPath,
                    defaultLang || 'en',
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
            name: chalk.white(dir),
            value: dir,
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
            message: chalk.bold(
                'Select how to add another .xcodeproj directory:',
            ),
            choices: xcodeprojChoices,
        });

        if (xcodeprojSelection === 'manual') {
            const manualXcodeprojPath = await input({
                message: chalk.bold('Enter the path to .xcodeproj directory:'),
            });

            if (
                manualXcodeprojPath &&
                !selectedXcodeproj.includes(manualXcodeprojPath)
            ) {
                selectedXcodeproj.push(manualXcodeprojPath);
            }
        }
    } else {
        if (swiftPackageInfo.state === SwiftPackageState.None) {
            console.log(chalk.dim('  No .xcodeproj directories found'));
        }

        const manualXcodeprojPath = await input({
            message: chalk.bold(
                'Enter the path to .xcodeproj directory (leave empty to skip):',
            ),
        });

        if (manualXcodeprojPath) {
            selectedXcodeproj.push(manualXcodeprojPath);
        }
    }

    console.log();
    console.log(chalk.dim('─'.repeat(40)));
    console.log();

    console.log(chalk.bold('📋 Configuration Summary:'));
    console.log();

    console.log(chalk.cyan('  xcstringsPaths:'));
    if (selectedXCStrings.length > 0) {
        selectedXCStrings.forEach((path) =>
            console.log(chalk.white(`    • ${path}`)),
        );
    } else {
        console.log(chalk.dim('    (none)'));
    }

    if (selectedXcodeproj.length > 0 || xcodeprojDirs.length > 0) {
        console.log();
        console.log(chalk.cyan('  xcodeprojPaths:'));
        if (selectedXcodeproj.length > 0) {
            selectedXcodeproj.forEach((path) =>
                console.log(chalk.white(`    • ${path}`)),
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

    const plan = createInitConfigPlan({
        projectRoot: cwd,
        swiftPackageState: swiftPackageInfo.state,
        xcstringsPaths: selectedXCStrings,
        xcodeprojPaths: selectedXcodeproj,
        missingLanguagePolicy: 'skip',
    });

    await applyInitConfigPlan(plan);

    console.log();
    console.log(chalk.bold.green(`✓ Created ${INIT_FILE_NAME}`));
    console.log(
        chalk.dim(
            `   Run ${chalk.cyan('xcs --help')} to see available commands.`,
        ),
    );
    console.log();
}
