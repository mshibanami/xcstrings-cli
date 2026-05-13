import { CommandModule } from 'yargs';
import { init } from '../services/init.js';

export function createInitCommand(): CommandModule {
    return {
        command: 'init',
        describe: 'Initialize configuration file',
        handler: async () => {
            await init();
        },
    } satisfies CommandModule;
}

export { init };
