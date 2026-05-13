import { CommandModule } from 'yargs';
import logger from '../utils/logger.js';
import { languages } from '../services/languages.js';

export function createLanguagesCommand(): CommandModule {
    return {
        command: 'languages',
        describe: 'List supported languages from xcodeproj or xcstrings',
        handler: async (argv) => {
            const result = await languages(
                argv.path as string,
                argv.config as string | undefined,
            );
            logger.info(result.join(' '));
        },
    } satisfies CommandModule;
}
export {
    getLanguagesFromXcodeproj,
    getLanguagesFromXCStrings,
    languages,
} from '../services/languages.js';
