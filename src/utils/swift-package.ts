import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export enum SwiftPackageState {
    /**
     * No Package.swift found
     */
    None = 'none',
    /**
     * Fully structured, default path identifiable
     */
    IdentifiedStructure = 'identifiedStructure',
    /**
     * Package.swift exists but structure unknown
     */
    UnknownStructure = 'unknownStructure',
}

export interface SwiftPackageInfo {
    state: SwiftPackageState;
    packageName?: string;
    defaultLocalization?: string;
    suggestedXCStringsPaths?: string[];
}

export async function detectSwiftPackage(
    cwd: string,
): Promise<SwiftPackageInfo> {
    const packageSwiftPath = join(cwd, 'Package.swift');
    try {
        const packageSwiftContent = await readFile(packageSwiftPath, 'utf-8');
        const defaultLocalization =
            extractDefaultLocalization(packageSwiftContent);
        const packageName = extractPackageName(packageSwiftContent);

        let state = SwiftPackageState.UnknownStructure;
        const suggestedXCStringsPaths: string[] = [];

        const sourcesDir = join(cwd, 'Sources');
        try {
            const sourcesEntries = await readdir(sourcesDir, {
                withFileTypes: true,
            });
            const targetDirs = sourcesEntries.filter(
                (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
            );

            let targetName: string | undefined;
            if (
                packageName &&
                targetDirs.some((dir) => dir.name === packageName)
            ) {
                targetName = packageName;
            } else if (targetDirs.length === 1) {
                targetName = targetDirs[0].name;
            }

            if (targetName) {
                state = SwiftPackageState.IdentifiedStructure;
                suggestedXCStringsPaths.push(
                    join(
                        'Sources',
                        targetName,
                        'Resources',
                        'Localizable.xcstrings',
                    ),
                );
                suggestedXCStringsPaths.push(
                    join('Sources', targetName, 'Localizable.xcstrings'),
                );
            }
        } catch {
            // Sources dir not found or other errors
        }

        return {
            state,
            packageName,
            defaultLocalization,
            suggestedXCStringsPaths,
        };
    } catch {
        return { state: SwiftPackageState.None };
    }
}

export function extractDefaultLocalization(
    content: string,
): string | undefined {
    const cleanContent = stripComments(content);
    const match = cleanContent.match(
        /defaultLocalization\s*:\s*["']([^"']+)["']/,
    );
    return match ? match[1] : undefined;
}

function extractPackageName(content: string): string | undefined {
    const cleanContent = stripComments(content);
    const packageMatch = cleanContent.match(
        /Package\s*\(\s*name\s*:\s*["']([^"']+)["']/,
    );
    if (packageMatch) {
        return packageMatch[1];
    }
    // Fallback best effort
    const match = cleanContent.match(/name\s*:\s*["']([^"']+)["']/);
    return match ? match[1] : undefined;
}

function stripComments(content: string): string {
    return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
}
