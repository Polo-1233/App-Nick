/**
 * R90 Engine — Runner
 *
 * Entry point. Assembles all engine modules into a single deterministic call.
 *
 * Usage:
 *   import { runEngine } from "./engine-runner.js";
 *   const output = runEngine(context);
 *
 * The runner is pure: it makes no DB calls. The caller is responsible for
 * assembling the EngineContext from the database before calling runEngine().
 */
import type { EngineContext, EngineOutput } from "./types.js";
/**
 * Run the R90 engine against the provided context.
 *
 * @param ctx  Pre-assembled EngineContext. The caller must populate all fields
 *             from the database before calling this function.
 */
export declare function runEngine(ctx: EngineContext): EngineOutput;
/**
 * Safe version of runEngine that never throws.
 * Returns a safe fallback output if the engine fails.
 * Use this in API handlers.
 */
export declare function runEngineSafe(ctx: EngineContext): EngineOutput;
//# sourceMappingURL=engine-runner.d.ts.map