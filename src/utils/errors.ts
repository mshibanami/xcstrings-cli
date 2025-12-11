/**
 * Error thrown when command-line argument validation fails.
 * When this error is caught by the fail handler, help should be displayed.
 */
export class ArgumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ArgumentError';
    }
}
