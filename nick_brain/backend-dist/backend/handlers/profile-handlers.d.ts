/**
 * R90 Backend — Profile, Environment, and Recommendation Action Handlers
 *
 * POST /users                  → register user after Supabase auth signup (idempotent)
 * POST /profile                → update_user_profile (+ ARP config if arp_time changed)
 * POST /profile/environment    → update_environment
 * POST /actions/recommendation → actioned / dismissed
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext, SignupAuthContext } from "../middleware/auth.js";
/**
 * Register the app-level user record after Supabase auth signup.
 *
 * Must be called once after the user signs up via Supabase Auth.
 * Uses authenticateSignup() — the users row may not exist yet.
 * Idempotent: if the user already exists, returns their existing user_id.
 *
 * Body (optional): { timezone?: string }  — defaults to "Europe/London"
 */
export declare function createUserHandler(req: IncomingMessage, res: ServerResponse, auth: SignupAuthContext): Promise<void>;
export declare function updateProfileHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function updateEnvironmentHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function recommendationActionHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
