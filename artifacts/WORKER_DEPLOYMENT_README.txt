PhotoChord - Worker-Based Deployment Artifacts
==============================================

Prepared: 2026-11-07 06:06 UTC
Source Commit: 672d423a5f7c91d41c122c2a876f1260342a09a7
Deployment Method: Cloudflare API Multipart Worker PUT

WORKER DEPLOYMENT ARTIFACTS (for Cloudflare API)
------------------------------------------------

Primary Artifacts:

1. worker-upload-payload.json (333 KB)
   Path: /workspace/artifacts/worker-upload-payload.json
   SHA256: 83593f6848002fd31b6dd750ecaf5acfedeaa6282e8082cecaa448c43516d866
   
   Complete deployment payload containing:
   - Worker script (worker.js) as base64 ESM module
   - 3 data modules (asset-0.bin, asset-1.bin, asset-2.bin) as base64 buffers
   - Metadata: main_module, compatibility_date, observability settings
   - Total embedded size: 255,162 bytes (249.2 KB)

2. worker.js (2.5 KB)
   Path: /workspace/artifacts/worker.js
   SHA256: b607d2a54b13d170cf39985b47632e3437bdb098b27c3a57a048925ac0e0cd8d
   
   Standalone Worker script for reference/inspection
   - Imports 3 data modules as ArrayBuffers
   - Serves exact paths with proper MIME types
   - SPA routing fallback for navigation
   - No external fetches, no eval, no secrets

3. worker-deployment-manifest.json (3.4 KB)
   Path: /workspace/artifacts/worker-deployment-manifest.json
   SHA256: dccbc418c5d7891c81c6af72836a0058b0a90085d04c0784220b6064e52eb77a
   
   Deployment metadata and configuration reference


MODULE DETAILS
--------------

worker.js (ESM, 2,528 bytes)
  Main Worker script with routing logic

asset-0.bin (Buffer, 443 bytes)
  Original: index.html
  MIME: text/html
  Cache: no-cache
  Routes: /, /index.html
  Purpose: SPA HTML shell and navigation fallback

asset-1.bin (Buffer, 240,809 bytes)
  Original: assets/index-DCmNTNtN.js
  MIME: application/javascript
  Cache: public, max-age=31536000, immutable
  Routes: /assets/index-DCmNTNtN.js
  Purpose: Bundled React application

asset-2.bin (Buffer, 11,382 bytes)
  Original: assets/index-DtvVsUGo.css
  MIME: text/css
  Cache: public, max-age=31536000, immutable
  Routes: /assets/index-DtvVsUGo.css
  Purpose: Application styles


WORKER BEHAVIOR
----------------

Routing:
- Exact path matching for known assets
- SPA fallback to index.html for navigation paths
- Excludes /api/*, /assets/*, file-like paths (*.ext) from fallback
- 404 for unknown assets
- 405 for non-GET/HEAD methods

Headers:
- Content-Type with proper MIME types
- X-Content-Type-Options: nosniff
- Cache-Control: no-cache for HTML, immutable for hashed assets
- Content-Length for HEAD requests

Security:
- No external fetches
- No eval or dynamic code execution
- No embedded secrets or credentials
- All content served from imported modules


CONFIGURATION
-------------

Worker Name: photochord
Compatibility Date: 2026-11-07
Main Module: worker.js
Observability: enabled (head_sampling_rate: 1)
Bindings: none
Assets Property: NO (uses Data modules instead)


API UPLOAD METHOD
-----------------

Use Cloudflare Workers API multipart PUT:
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{worker_name}

Headers:
- Authorization: Bearer {api_token}
- Content-Type: application/json

Body: Contents of worker-upload-payload.json

The payload contains:
- metadata.main_module = "worker.js"
- metadata.compatibility_date = "2026-11-07"
- metadata.observability.enabled = true
- modules[0] = worker.js (ESM, base64)
- modules[1-3] = asset-*.bin (buffer, base64)

Official References:
- https://developers.cloudflare.com/workers/wrangler/bundling/
- https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/


COMPARISON WITH STANDARD DEPLOYMENT
------------------------------------

Standard Assets-Based (photochord-dist.zip):
  - Uses wrangler.jsonc assets property
  - Requires asset session JWT headers
  - Simpler configuration
  - Recommended for production

Worker Data Modules (worker-upload-payload.json):
  - Uses authenticated multipart Worker PUT
  - No asset session required
  - More control over routing logic
  - Suitable for temporary/API-based deployments


DEPLOYMENT VERIFICATION
------------------------

After deployment, test:
1. Root: https://photochord.{subdomain}.workers.dev/
2. Direct: https://photochord.{subdomain}.workers.dev/index.html
3. Asset: https://photochord.{subdomain}.workers.dev/assets/index-DCmNTNtN.js
4. SPA routing: https://photochord.{subdomain}.workers.dev/any/path (should return HTML)
5. 404: https://photochord.{subdomain}.workers.dev/missing.png
6. HEAD method: curl -I {url}
7. Method check: curl -X POST {url} (should return 405)


LIMITATIONS
-----------

This deployment method is suitable for:
- Small static sites (<5 MB total)
- Temporary UI deployments
- API-based deployment workflows
- Authenticated multipart upload

Not suitable for:
- Large media files
- Complex routing rules
- Frequent updates (use CI/CD with wrangler)
- Sites requiring _headers/_redirects


BUILD VERIFICATION
------------------

Source Commit: 672d423a5f7c91d41c122c2a876f1260342a09a7
TypeScript Check: PASSED
Tests: 8/8 PASSED
Production Build: SUCCESS
Total Module Size: 249.2 KB

No secrets, no source code, no node_modules included.


ALTERNATIVE ARTIFACTS AVAILABLE
--------------------------------

Also prepared (standard deployment method):

- photochord-dist.zip (79 KB)
  Standard dist/ archive for wrangler assets deployment

- photochord-deploy-manifest.json (2.3 KB)
  Standard deployment metadata

Choose deployment method based on Cloudflare API capabilities and requirements.
