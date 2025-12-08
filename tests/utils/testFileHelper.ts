import { resolve, basename, extname } from 'node:path';
import { copyFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { FIXTURES_DIR, TEMP_DIR } from './resources';

export const createdFiles: string[] = [];

export async function setupTempFile(fileName: string): Promise<string> {
    if (!existsSync(TEMP_DIR)) {
        await mkdir(TEMP_DIR);
    }
    const source = resolve(FIXTURES_DIR, fileName);
    const base = basename(fileName, extname(fileName));
    const unique = `${base}-${Date.now()}-${Math.random().toString(36).slice(2)}${extname(fileName)}`;
    const dest = resolve(TEMP_DIR, unique);
    await copyFile(source, dest);
    createdFiles.push(dest);
    return dest;
}

export async function cleanupTempFiles(): Promise<void> {
    for (const f of createdFiles) {
        try {
            await unlink(f);
        } catch {
            // ignore: best effort cleanup
        }
    }
    createdFiles.length = 0;
}
