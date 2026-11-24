/**
 * Platform capabilities the notification routing depends on.
 *
 * Kept in the domain layer because both the router and the system channel need
 * the same answer: the rule must exist once.
 */
/**
 * Whether the host can raise a real OS notification here.
 *
 * macOS runs `osascript`, but the notification is attributed to Script Editor,
 * which macOS 15 offers no grantable entry for — the command succeeds and
 * nothing appears. The page is the only working path there.
 * @param platform - `process.platform` of the host.
 * @returns true when the OS command path is usable.
 */
export declare function hostNotifierAvailable(platform: string): boolean;
