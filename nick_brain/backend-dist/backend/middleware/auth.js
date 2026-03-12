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
import { createServerClient, resolveUserId } from "../db/client.js";
/**
 * Authenticate an incoming request.
 *
 * Returns AuthContext on success, or null with a reason string on failure.
 * The reason is safe to log but should NOT be returned verbatim to the client.
 *
 * Requires the user to already have an app-level users row.
 * Use authenticateSignup() for POST /users where that row doesn't exist yet.
 */
export async function authenticate(req) {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, reason: "missing_bearer_token" };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        return { ok: false, reason: "empty_token" };
    }
    // Create a fresh service-role client for this request.
    // This client can verify any user's JWT via auth.getUser().
    let client;
    try {
        client = createServerClient();
    }
    catch (err) {
        return { ok: false, reason: `client_init_failed: ${String(err)}` };
    }
    // Validate the JWT against Supabase auth. This is a server-side call
    // that verifies the token signature and expiry.
    const { data: { user }, error, } = await client.auth.getUser(token);
    if (error || !user) {
        return { ok: false, reason: `token_invalid: ${error?.message ?? "no user"}` };
    }
    // Resolve the app-level user.id from the auth UID
    const userId = await resolveUserId(client, user.id);
    if (!userId) {
        return { ok: false, reason: `user_not_found: auth_uid=${user.id}` };
    }
    return { ok: true, ctx: { client, userId } };
}
/**
 * Authenticate for the POST /users signup flow.
 *
 * Validates the Supabase JWT but does NOT require the user to have an
 * existing app-level users row. Returns the raw Supabase auth UID.
 */
export async function authenticateSignup(req) {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, reason: "missing_bearer_token" };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        return { ok: false, reason: "empty_token" };
    }
    let client;
    try {
        client = createServerClient();
    }
    catch (err) {
        return { ok: false, reason: `client_init_failed: ${String(err)}` };
    }
    const { data: { user }, error, } = await client.auth.getUser(token);
    if (error || !user) {
        return { ok: false, reason: `token_invalid: ${error?.message ?? "no user"}` };
    }
    return { ok: true, ctx: { client, authUid: user.id } };
}
//# sourceMappingURL=auth.js.map