import * as z from 'zod/v4';
import type { FilterSpec } from '../../utils/filters.js';

export const filterSpecInputSchema = z
    .object({
        pattern: z.string(),
        mode: z.enum(['glob', 'regex', 'substring']),
    })
    .optional();

export function toFilterSpec(
    filter:
        | { pattern: string; mode: 'glob' | 'regex' | 'substring' }
        | undefined,
): FilterSpec | undefined {
    if (!filter) {
        return undefined;
    }
    return {
        pattern: filter.pattern,
        mode: filter.mode,
    };
}
