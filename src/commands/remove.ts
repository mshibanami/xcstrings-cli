import { readXCStrings, writeXCStrings } from './_shared';

export async function remove(path: string, key: string): Promise<void> {
    const data = await readXCStrings(path);
    if (data.strings && data.strings[key]) {
        delete data.strings[key];
        await writeXCStrings(path, data);
    }
}
