import logger from './logger.js';
import { runAddCommand as runAddCommandCore } from '../services/add.js';

export {
    AddResult,
    InteractiveAddOptions,
    ParsedStringsArg,
    StringsFormat,
    parseStringsArg,
    readStdinToString,
    runInteractiveAdd,
} from '../services/add.js';

export async function runAddCommand(
    options: Parameters<typeof runAddCommandCore>[0],
): ReturnType<typeof runAddCommandCore> {
    return runAddCommandCore({
        ...options,
        onWarning: options.onWarning ?? ((message) => logger.warn(message)),
    });
}
