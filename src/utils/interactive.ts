import { editor } from '@inquirer/prompts';

export async function captureInteractiveStringsInput(): Promise<string> {
    const value = await editor({
        message: 'Enter strings payload (YAML or JSON). Save and close to submit.',
        default: '',
    });
    return typeof value === 'string' ? value : '';
}
