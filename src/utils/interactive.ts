import { editor } from '@inquirer/prompts';

export async function captureInteractiveStringsInput(): Promise<string> {
    const value = await editor({
        message:
            'Enter strings payload (YAML or JSON). Save and close to submit.',
        default: '',
    });
    return typeof value === 'string' ? value : '';
}

export interface InteractiveModeOptions {
    interactive?: boolean;
}

export function isInteractiveMode(
    options: InteractiveModeOptions = {},
): boolean {
    if (typeof options.interactive === 'boolean') {
        return options.interactive;
    }

    const env = process.env.XCS_NON_INTERACTIVE;
    if (env) {
        const normalized = env.trim().toLowerCase();
        if (
            normalized === '1' ||
            normalized === 'true' ||
            normalized === 'yes'
        ) {
            return false;
        }
        if (
            normalized === '0' ||
            normalized === 'false' ||
            normalized === 'no'
        ) {
            return true;
        }
    }

    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
