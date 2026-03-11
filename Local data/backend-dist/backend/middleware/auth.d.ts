/**
 * R90 Backend — Auth Middleware
 *
 * Extracts the Supabase JWT from the Authorization header,
 * verifies it with the Supabase auth API, then resolves the
 * app-level user ID from the auth UID.
 *
 * This is the ONLY place auth tokens are touched.
 * All handlers receive a pre-resolved userId and AppClient.
 */
import type { IncomingMessage } from "node:http";
import type { AppClient } from "../db/client.js";
export interface AuthContext {
    client: AppClient;
    userId: string;
}
/**
 * Auth context for the signup flow, where the users row may not exist yet.
 * userId here is the raw Supabase auth UID, not the app-level user.id.
 */
export interface SignupAuthContext {
    client: AppClient;
    authUid: string;
}
/**
 * Authenticate an incoming request.
 *
 * Returns AuthContext on success, or null with a reason string on failure.
 * The reason is safe to log but should NOT be returned verbatim to the client.
 *
 * Requires the user to already have an app-level users row.
 * Use authenticateSignup() for POST /users where that row doesn't exist yet.
 */
export declare function authenticate(req: IncomingMessage): Promise<{
    ok: true;
    ctx: AuthContext;
} | {
    ok: false;
    reason: string;
}>;
/**
 * Authenticate for the POST /users signup flow.
 *
 * Validates the Supabase JWT but does NOT require the user to have an
 * existing app-level users row. Returns the raw Supabase auth UID.
 */
export declare function authenticateSignup(req: IncomingMessage): Promise<{
    ok: true;
    ctx: SignupAuthContext;
} | {
    ok: false;
    reason: string;
}>;
