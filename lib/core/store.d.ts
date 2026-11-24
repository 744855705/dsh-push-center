/**
 * One JSON document owned by the plugin.
 *
 * Writes are atomic and private (0600 file, 0700 directories), so a crash never
 * leaves half a config and no other OS user can read bot credentials.
 */
export declare class JsonDocument<T> {
    #private;
    /**
     * @param path - absolute path of the document.
     * @param fallback - value used when the file is missing or unusable.
     */
    constructor(path: string, fallback: () => T);
    /** Absolute path of the document, for diagnostics. */
    get path(): string;
    /**
     * Read the document, falling back when it is missing or not valid JSON.
     * @returns the stored value, or the fallback.
     */
    read(): Promise<T>;
    /**
     * Replace the document atomically.
     * @param value - the complete new value.
     */
    write(value: T): Promise<void>;
}
