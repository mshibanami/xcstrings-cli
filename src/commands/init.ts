import { writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import chalk from 'chalk';
import { checkbox, confirm } from '@inquirer/prompts';
import { CommandModule } from 'yargs';

const INIT_FILE_NAME = 'xcstrings-cli.yaml';

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
                    // Skip node_modules, .git, etc.
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
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

    console.log(chalk.yellow('🔍 Searching for .xcstrings files...'));
    const xcstringsFiles = await findXCStringsFiles(cwd);

    console.log(chalk.yellow('🔍 Searching for .xcodeproj directories...'));
    const xcodeprojDirs = await findXcodeprojDirs(cwd);

    console.log();

    let selectedXCStrings: string[] = [];
    if (xcstringsFiles.length > 0) {
        console.log(chalk.green(`✓ Found ${xcstringsFiles.length} .xcstrings file(s)`));
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
        console.log(chalk.dim('  No .xcstrings files found in current directory'));
    }

    console.log();

    let selectedXcodeproj: string[] = [];
    if (xcodeprojDirs.length > 0) {
        console.log(chalk.green(`✓ Found ${xcodeprojDirs.length} .xcodeproj director${xcodeprojDirs.length === 1 ? 'y' : 'ies'}`));
        console.log();

        const choices = xcodeprojDirs.map((dir) => ({
            name: chalk.white(relative(cwd, dir) || dir) + chalk.dim(` (${dir})`),
            value: relative(cwd, dir) || dir,
            checked: true,
        }));

        selectedXcodeproj = await checkbox({
            message: chalk.bold('Select .xcodeproj directories for language detection:'),
            choices,
        });
    } else {
        console.log(chalk.dim('  No .xcodeproj directories found'));
    }

    console.log();
    console.log(chalk.dim('─'.repeat(40)));
    console.log();

    console.log(chalk.bold('📋 Configuration Summary:'));
    console.log();

    console.log(chalk.cyan('  xcstringsPaths:'));
    if (selectedXCStrings.length > 0) {
        selectedXCStrings.forEach((p) => console.log(chalk.white(`    • ${p}`)));
    } else {
        console.log(chalk.dim('    (none)'));
    }

    console.log();
    console.log(chalk.cyan('  xcodeprojPaths:'));
    if (selectedXcodeproj.length > 0) {
        selectedXcodeproj.forEach((p) => console.log(chalk.white(`    • ${p}`)));
    } else {
        console.log(chalk.dim('    (none)'));
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

    const xcstringsArray = selectedXCStrings.length > 0
        ? '\n' + selectedXCStrings.map((p) => `  - "${p}"`).join('\n')
        : ' []';

    const xcodeprojArray = selectedXcodeproj.length > 0
        ? '\n' + selectedXcodeproj.map((p) => `  - "${p}"`).join('\n')
        : ' []';

    const config = `# Behavior for handling missing languages when adding strings.
missingLanguagePolicy: "skip"

# Paths to .xcstrings files to manage. Specify relative or absolute paths.
xcstringsPaths:${xcstringsArray}

# Paths to .xcodeproj directories. Used for discovering supported languages.
xcodeprojPaths:${xcodeprojArray}
`;

    await writeFile(INIT_FILE_NAME, config, 'utf-8');

    console.log();
    console.log(chalk.bold.green(`✓ Created ${INIT_FILE_NAME}`));
    console.log(chalk.dim(`   Run ${chalk.cyan('xcstrings --help')} to see available commands.`));
    console.log();
}
