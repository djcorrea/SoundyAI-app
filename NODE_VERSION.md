# ⚠️ NODE VERSION CONFIGURATION

## IMPORTANT: This project REQUIRES Node 20.x

**DO NOT:**
- ❌ Use Node 22 (incompatible with native modules)
- ❌ Use Node 18 (security vulnerabilities)
- ❌ Add `NODE_VERSION` environment variable in Railway
- ❌ Add `NIXPACKS_NODE_VERSION` environment variable in Railway
- ❌ Remove `.nvmrc` file
- ❌ Remove `engines` field from package.json
- ❌ Modify `nodeVersion` in railway.json

**DO:**
- ✅ Keep `.nvmrc` with value `20`
- ✅ Keep `engines.node` as `20.x` in all package.json files
- ✅ Keep `build.nodeVersion` as `20` in railway.json
- ✅ Clear build cache when deploying after Node version changes
- ✅ Verify Railway logs show "Using Node.js 20.x"

## Files that enforce Node 20:

1. **`.nvmrc`** (root) - For local development (nvm/volta/fnm)
2. **`package.json`** (root, work/, api/, work/api/) - For npm/yarn/pnpm
3. **`railway.json`** (root) - For Railway/Nixpacks builds

## Railway Service Configuration:

Each Railway service (work-production-*) must NOT have these variables:
- `NODE_VERSION`
- `NIXPACKS_NODE_VERSION`
- `RUNTIME_NODE_VERSION`

If any of these exist, the service will IGNORE `.nvmrc` and `railway.json`,
causing intermittent failures when Node 22 is selected.

## Troubleshooting:

If deploy fails with Node version errors:

1. Check Railway logs for: "Using Node.js XX.x"
2. If shows 22.x: Go to Settings → Variables → Delete NODE_* vars
3. Redeploy with "Clear build cache" option
4. Verify logs now show "Using Node.js 20.x"

## Why Node 20?

- Native modules (ffmpeg, postgres, etc) are compiled for Node 20
- Node 22 changed module ABI (NODE_MODULE_VERSION 127 vs 115)
- Recompiling all dependencies for Node 22 would require extensive testing
- Node 20 LTS is stable and supported until April 2026

## Migration Path (Future):

If migrating to Node 22 in the future:

1. Test ALL dependencies locally with Node 22
2. Update `.nvmrc` to `22`
3. Update all `package.json` engines to `22.x`
4. Update `railway.json` nodeVersion to `22`
5. Clear ALL Railway build caches
6. Deploy services one-by-one (not all at once)
7. Monitor for module compatibility issues

---

**Last updated:** 2025-12-14  
**Maintainer:** DJ Correa  
**Version:** 1.0.0
