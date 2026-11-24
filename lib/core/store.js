/** JSON persistence on top of the harness atomic-write primitive. */
import { readFile } from 'node:fs/promises';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
/**
 * One JSON document owned by the plugin.
 *
 * Writes are atomic and private (0600 file, 0700 directories), so a crash never
 * leaves half a config and no other OS user can read bot credentials.
 */
export class JsonDocument {
    #path;
    #fallback;
    /**
     * @param path - absolute path of the document.
     * @param fallback - value used when the file is missing or unusable.
     */
    constructor(path, fallback) {
        this.#path = path;
        this.#fallback = fallback;
    }
    /** Absolute path of the document, for diagnostics. */
    get path() {
        return this.#path;
    }
    /**
     * Read the document, falling back when it is missing or not valid JSON.
     * @returns the stored value, or the fallback.
     */
    async read() {
        try {
            const text = await readFile(this.#path, 'utf8');
            return JSON.parse(text);
        }
        catch {
            return this.#fallback();
        }
    }
    /**
     * Replace the document atomically.
     * @param value - the complete new value.
     */
    async write(value) {
        await writeFileAtomic(this.#path, JSON.stringify(value, null, 2), { mode: 0o600, dirMode: 0o700 });
    }
}
//# sourceMappingURL=store.js.map