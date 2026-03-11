# Repository Safety Report

**Date:** 2026-03-12
**Purpose:** Pre-push safety audit for GitHub + Railway deployment

---

## Summary

| Check | Status |
|-------|--------|
| Root `.gitignore` created | ✅ Done |
| `.env` secrets protected | ✅ Protected by `.gitignore` |
| Build artifacts excluded | ✅ Excluded |
| `node_modules` excluded | ✅ Excluded |
| Nested `.git` in `mobile/` | 🔴 BLOCKER — action required |
| Nested `.git` in `nick_brain/` | 🔴 BLOCKER — action required |
| GitHub-safe | ⚠️ Not yet (nested .git blockers must be resolved first) |
| `nick_brain` Railway-safe | ✅ Yes (build artifacts and secrets excluded) |

---

## 🔴 BLOCKER 1 — Nested `.git` in `mobile/`

**Path:** `mobile/.git`

**Why this blocks a monorepo push:**
When you run `git init` at the repo root and `git add .`, Git detects a `.git` directory inside `mobile/` and automatically treats it as a **gitlink (submodule)** — not a regular folder. This means:
- The contents of `mobile/` will **not** be committed to the new repo
- GitHub will show `mobile` as an empty unresolvable submodule reference
- Railway will not be able to see any of the mobile app code

**Fix (run manually — this is destructive, do it only once):**
```bash
rm -rf mobile/.git
```

**Safe to do?** Yes — `mobile/` is being absorbed into this new monorepo. Its own git history is no longer needed. If you want to preserve the history, export it first:
```bash
# Optional: save the log before removing
git -C mobile log --oneline > tools/mobile-git-history.txt
rm -rf mobile/.git
```

---

## 🔴 BLOCKER 2 — Nested `.git` in `nick_brain/`

**Path:** `nick_brain/.git`

**Same issue as above.** `nick_brain/` has its own git repo. When added to the monorepo root, git will treat it as a submodule and its contents will not be tracked.

**Fix:**
```bash
rm -rf nick_brain/.git
```

**Safe to do?** Yes — same reasoning as above. Optionally save history first:
```bash
git -C nick_brain log --oneline > tools/nick-brain-git-history.txt
rm -rf nick_brain/.git
```

---

## ✅ `.gitignore` Created

A root-level `.gitignore` has been created at `.gitignore`. It covers:

| Pattern | Protects |
|---------|---------|
| `node_modules/` | All npm dependency folders |
| `.env` / `.env.*` | All secret/environment files |
| `!.env.example` | Allows `.env.example` to be committed |
| `dist/` / `build/` | Generic build output |
| `nick_brain/backend-dist/` | Compiled backend JS |
| `nick_brain/engine-dist/` | Compiled engine JS |
| `.expo/` | Expo local device config |
| `.DS_Store` | macOS filesystem noise |
| `*.tsbuildinfo` | TypeScript incremental build cache |
| `*.log` | Log files |
| `*.key`, `*.p12`, `*.mobileprovision` | Mobile signing credentials |

---

## ✅ Secrets Audit — `nick_brain/.env`

`nick_brain/.env` contains real credentials:
- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_KEY` — **service role key** (admin-level, never expose publicly)
- `PORT`

The `.gitignore` pattern `.env` will prevent this file from being committed. `nick_brain/.env.example` (the safe template with placeholder values) is explicitly allowed through with `!.env.example`.

**Action before push:** Verify the `.env` file is not already tracked:
```bash
git ls-files --error-unmatch nick_brain/.env 2>/dev/null && echo "WARNING: .env is tracked" || echo "OK: .env is not tracked"
```

---

## ✅ Build Artifacts — `nick_brain`

Two compiled output folders are excluded from git:
- `nick_brain/backend-dist/` — compiled Express server
- `nick_brain/engine-dist/` — compiled recommendation engine

**Railway implication:** Railway must run `npm run build` during deployment to regenerate these. Verify `nick_brain/package.json` has a `build` script and that Railway is configured to run it.

---

## ℹ️ Note — `Data Brut`, `transcripts`, `sources`, `summaries`

The previous reorganization report flagged these as large dataset folders inside `nick_brain/`. After auditing the actual filesystem, **these folders do not exist** in the current repository state — they were likely cleaned up already or were never present at this path. No action needed.

---

## ℹ️ Note — `nick_brain/getToken.js`

A one-off dev utility script (`nick_brain/getToken.js`) exists at the nick_brain root. It is not production code. It is safe to commit (no secrets inside, as verified by `.env.example` pattern), but consider moving it to `nick_brain/tools/` or deleting it before the production push.

---

## Steps to Complete Before GitHub Push

Run these commands in order from the repo root:

```bash
# Step 1: Remove nested git repos (REQUIRED)
rm -rf mobile/.git
rm -rf nick_brain/.git

# Step 2: Initialize the monorepo
git init
git add .

# Step 3: Verify .env is not staged (safety check)
git status | grep ".env"
# Should show nothing, or only .env.example

# Step 4: First commit
git commit -m "Initial monorepo: mobile + nick_brain production structure"

# Step 5: Push to GitHub
git remote add origin <your-github-url>
git push -u origin main
```

---

## Railway Deployment Readiness

| Service | Ready? | Notes |
|---------|--------|-------|
| `nick_brain` (backend) | ✅ Yes | Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as Railway env vars; ensure `npm run build` runs on deploy |
| `mobile` | N/A | Mobile app is deployed via EAS (Expo), not Railway |
