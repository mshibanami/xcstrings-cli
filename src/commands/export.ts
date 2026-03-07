import { CommandModule } from 'yargs';
import {
    addFilterOptions,
    checkFilterOptions,
    extractFilterOptions,
    buildMatcher,
} from '../utils/filters.js';
import { readXCStrings, writeXCStrings, XCStrings } from './_shared.js';
import { extname, dirname, basename, join } from 'node:path';
import {
    mkdir,
    writeFile,
    readFile,
    stat,
    rm,
    readdir,
} from 'node:fs/promises';

export type OutputFormat = 'auto' | 'xcstrings' | 'strings';
export type MergePolicy = 'error' | 'force' | 'output-first' | 'existing-first';

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

function resolveXCStringsOutputPath(path: string): string {
    const extension = extname(path).toLowerCase();

    if (!extension) {
        return `${path}.xcstrings`;
    }

    if (extension === '.strings') {
        return path.slice(0, -extension.length) + '.xcstrings';
    }

    return path;
}

async function removeStringsOutputs(outDir: string, outFile: string) {
    try {
        const entries = await readdir(outDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.endsWith('.lproj')) {
                continue;
            }

            await rm(join(outDir, entry.name, outFile), {
                recursive: true,
                force: true,
            });
        }
    } catch {
        // Ignore missing or unreadable directories.
    }
}

export function createExportCommand(): CommandModule {
    return {
        command: 'export <outpath>',
        describe:
            'Export xcstrings to a filtered xcstrings or traditional strings format',
        builder: (yargs) =>
            addFilterOptions(yargs)
                .positional('outpath', {
                    type: 'string',
                    demandOption: true,
                    describe: 'Output path for the exported strings',
                })
                .option('output', {
                    alias: 'o',
                    type: 'string',
                    choices: ['auto', 'xcstrings', 'strings'],
                    default: 'auto',
                    describe:
                        'Output format. If auto, inferred from outpath extension if possible.',
                })
                .option('merge-policy', {
                    alias: 'm',
                    type: 'string',
                    choices: [
                        'error',
                        'force',
                        'output-first',
                        'existing-first',
                    ],
                    default: 'error',
                    describe: 'How to handle existing translation files',
                })
                .option('languages', {
                    type: 'string',
                    array: true,
                    alias: 'l',
                    describe: 'Include only these languages',
                })
                .check((argv: any) => {
                    return checkFilterOptions(argv);
                }),
        handler: async (argv) => {
            const outpath = argv.outpath as string;
            let outputFormat = argv.output as OutputFormat;

            if (outputFormat === 'auto') {
                if (outpath.toLowerCase().endsWith('.xcstrings')) {
                    outputFormat = 'xcstrings';
                } else if (outpath.toLowerCase().endsWith('.strings')) {
                    outputFormat = 'strings';
                } else {
                    outputFormat = 'xcstrings';
                }
            } else if (
                outputFormat === 'strings' &&
                outpath.toLowerCase().endsWith('.xcstrings')
            ) {
                throw new Error(
                    'Output format mismatch: specified --output strings but the outpath has .xcstrings extension.',
                );
            }

            const { keyFilter, textFilter } = extractFilterOptions(argv);

            await doExport({
                sourcePath: argv.path as string,
                outpath,
                outputFormat,
                mergePolicy: (argv.mergePolicy ||
                    argv.m ||
                    'error') as MergePolicy,
                keyFilter,
                textFilter,
                languages: argv.languages as string[] | undefined,
            });
        },
    } satisfies CommandModule;
}

export async function doExport(opts: {
    sourcePath: string;
    outpath: string;
    outputFormat: 'xcstrings' | 'strings';
    mergePolicy: MergePolicy;
    keyFilter?: any;
    textFilter?: any;
    languages?: string[];
}) {
    if (opts.outputFormat === 'xcstrings') {
        const data = await readXCStrings(opts.sourcePath);
        const matchKey = buildMatcher(opts.keyFilter);
        const matchText = buildMatcher(opts.textFilter);
        const languageSet = opts.languages ? new Set(opts.languages) : null;

        const resolvedPath = resolveXCStringsOutputPath(opts.outpath);

        let outData: XCStrings = {
            sourceLanguage: data.sourceLanguage,
            version: data.version ?? '1.0',
            strings: {},
        };

        const exists = await fileExists(resolvedPath);
        if (exists) {
            if (opts.mergePolicy === 'error') {
                throw new Error(
                    `Output file already exists: ${resolvedPath}. Use --merge-policy to override.`,
                );
            }
            if (opts.mergePolicy === 'force') {
                await rm(resolvedPath, { recursive: true, force: true });
            }
            if (
                opts.mergePolicy === 'existing-first' ||
                opts.mergePolicy === 'output-first'
            ) {
                try {
                    const existingContent = await readFile(
                        resolvedPath,
                        'utf8',
                    );
                    outData = JSON.parse(existingContent);
                    outData.strings = outData.strings ?? {};
                } catch {
                    // Ignore parsing errors, assume empty or unreadable
                }
            }
        }

        for (const [key, unit] of Object.entries(data.strings ?? {})) {
            if (!matchKey(key)) continue;

            const newUnit = JSON.parse(JSON.stringify(unit));
            if (newUnit.localizations) {
                for (const lang of Object.keys(newUnit.localizations)) {
                    if (languageSet && !languageSet.has(lang)) {
                        delete newUnit.localizations[lang];
                        continue;
                    }
                    const val =
                        newUnit.localizations[lang]?.stringUnit?.value ?? '';
                    if (!matchText(val)) {
                        delete newUnit.localizations[lang];
                    }
                }
            }

            if (
                newUnit.localizations &&
                Object.keys(newUnit.localizations).length === 0
            ) {
                continue;
            }

            if (!outData.strings[key]) {
                outData.strings[key] = newUnit;
            } else {
                const existingUnit = outData.strings[key];
                if (opts.mergePolicy === 'output-first') {
                    existingUnit.comment =
                        newUnit.comment ?? existingUnit.comment;
                    existingUnit.extractionState =
                        newUnit.extractionState ?? existingUnit.extractionState;
                    existingUnit.localizations =
                        existingUnit.localizations ?? {};
                    const locs = Object.entries(newUnit.localizations ?? {});
                    if (locs.length > 0) {
                        for (const [l, val] of locs) {
                            existingUnit.localizations[l] = val as any;
                        }
                    }
                } else if (opts.mergePolicy === 'existing-first') {
                    existingUnit.localizations =
                        existingUnit.localizations ?? {};
                    const locs = Object.entries(newUnit.localizations ?? {});
                    if (locs.length > 0) {
                        for (const [l, val] of locs) {
                            if (!existingUnit.localizations[l]) {
                                existingUnit.localizations[l] = val as any;
                            }
                        }
                    }
                }
            }
        }

        await mkdir(dirname(resolvedPath), { recursive: true });
        await writeXCStrings(resolvedPath, outData);
    } else {
        const data = await readXCStrings(opts.sourcePath);
        const matchKey = buildMatcher(opts.keyFilter);
        const matchText = buildMatcher(opts.textFilter);
        const languageSet = opts.languages ? new Set(opts.languages) : null;

        let outDir = dirname(opts.outpath);
        let outFile = basename(opts.outpath);
        if (!outFile.endsWith('.strings')) outFile += '.strings';

        if (opts.mergePolicy === 'force') {
            await removeStringsOutputs(outDir, outFile);
        }

        const stringsPerLang = new Map<string, Map<string, { value: string; comment?: string }>>();

        for (const [key, unit] of Object.entries(data.strings ?? {})) {
            if (!matchKey(key)) continue;

            const locs = unit.localizations ?? {};
            for (const [lang, locObj] of Object.entries(locs)) {
                if (languageSet && !languageSet.has(lang)) continue;

                const val = locObj?.stringUnit?.value ?? '';
                if (!matchText(val)) continue;

                if (!stringsPerLang.has(lang)) {
                    stringsPerLang.set(lang, new Map());
                }
                stringsPerLang.get(lang)!.set(key, { value: val, comment: unit.comment });
            }
        }

        if (opts.mergePolicy === 'error') {
            for (const lang of stringsPerLang.keys()) {
                const langFile = join(outDir, `${lang}.lproj`, outFile);
                if (await fileExists(langFile)) {
                    throw new Error(
                        `Output file already exists: ${langFile}. Use --merge-policy to override.`,
                    );
                }
            }
        }

        for (const [lang, mapOfStrings] of stringsPerLang.entries()) {
            const langDir = join(outDir, `${lang}.lproj`);
            const langFile = join(langDir, outFile);

            const exists = await fileExists(langFile);
            const mergedMap = new Map<string, { value: string; comment?: string }>();

            if (
                exists &&
                (opts.mergePolicy === 'existing-first' ||
                    opts.mergePolicy === 'output-first')
            ) {
                try {
                    const content = await readFile(langFile, 'utf8');
                    const regex =
                        /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        const k = match[1].replace(/\\"/g, '"');
                        const v = match[2].replace(/\\"/g, '"');
                        mergedMap.set(k, { value: v });
                    }
                } catch {
                    // ignore
                }
            }

            for (const [k, obj] of mapOfStrings.entries()) {
                if (mergedMap.has(k) && opts.mergePolicy === 'existing-first') {
                    const existing = mergedMap.get(k)!;
                    mergedMap.set(k, { value: existing.value, comment: obj.comment });
                    continue;
                }
                mergedMap.set(k, obj);
            }

            let newContent = '';
            for (const [k, obj] of mergedMap.entries()) {
                if (newContent.length > 0) {
                    newContent += '\n';
                }
                const commentText = obj.comment ? ` ${obj.comment} ` : ' No comment provided by engineer. ';
                newContent += `/*${commentText}*/\n`;
                const escapedKey = k.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                const escapedVal = obj.value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
                newContent += `"${escapedKey}" = "${escapedVal}";\n`;
            }

            if (newContent.length > 0) {
                await mkdir(langDir, { recursive: true });
                await writeFile(langFile, newContent, 'utf8');
            }
        }
    }
}
