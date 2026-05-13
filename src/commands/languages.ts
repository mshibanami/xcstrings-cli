import { CommandModule } from 'yargs';
import logger from '../utils/logger.js';
import { languages } from '../services/languages.js';
import { loadConfig } from '../utils/config.js';

export function createLanguagesCommand(): CommandModule {
    return {
        command: 'languages',
        describe: 'List supported languages from xcodeproj or xcstrings',
        handler: async (argv) => {
            const config = await loadConfig(argv.config as string | undefined);
            const result = await languages(argv.path as string, config);
            logger.info(result.join(' '));
        },
    } satisfies CommandModule;
}
export {
    getLanguagesFromXcodeproj,
    getLanguagesFromXCStrings,
    languages,
} from '../services/languages.js';
