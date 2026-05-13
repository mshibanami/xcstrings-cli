export type ErrorCode =
    | 'INVALID_ARGUMENT'
    | 'INVALID_INPUT'
    | 'MISSING_SOURCE_LANGUAGE'
    | 'NO_SOURCE_FILES'
    | 'NON_INTERACTIVE_REQUIRED_ARGUMENT'
    | 'UNKNOWN_ALIAS'
    | 'MERGE_CONFLICT';

export class AppError extends Error {
    readonly code: ErrorCode;
    readonly details?: Record<string, unknown>;
    readonly showHelp: boolean;

    constructor(
        code: ErrorCode,
        message: string,
        options?: { details?: Record<string, unknown>; showHelp?: boolean },
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = options?.details;
        this.showHelp = options?.showHelp ?? false;
    }
}

/**
 * Error thrown when command-line argument validation fails.
 * When this error is caught by the fail handler, help should be displayed.
 */
export class ArgumentError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super('INVALID_ARGUMENT', message, { details, showHelp: true });
        this.name = 'ArgumentError';
    }
}

export class DomainError extends AppError {
    constructor(
        code: Exclude<ErrorCode, 'INVALID_ARGUMENT'>,
        message: string,
        details?: Record<string, unknown>,
    ) {
        super(code, message, { details, showHelp: false });
        this.name = 'DomainError';
    }
}

export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}
