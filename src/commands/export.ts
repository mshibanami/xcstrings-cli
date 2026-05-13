import { CommandModule } from 'yargs';
import {
    addFilterOptions,
    checkFilterOptions,
    extractFilterOptions,
} from '../utils/filters.js';
import { doExport } from '../services/export.js';
import type { OutputFormat, ExportMergePolicy } from '../services/export.js';

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

            const mergePolicy =
                (argv['merge-policy'] as ExportMergePolicy) || 'error';

            await doExport({
                sourcePath: argv.path as string,
                outpath,
                outputFormat,
                mergePolicy,
                keyFilter,
                textFilter,
                languages: argv.languages as string[] | undefined,
            });
        },
    } satisfies CommandModule;
}

export { doExport };
export type { ExportMergePolicy, OutputFormat };
