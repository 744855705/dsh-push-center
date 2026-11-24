/** The HTTP port the channels use. */
import type { HttpClient } from './core/ports.js';
/**
 * fetch-backed HTTP port with a per-request deadline.
 * @returns the port the channel runtime receives.
 */
export declare function createHttp(): HttpClient;
