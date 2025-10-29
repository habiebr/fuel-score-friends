# CORS Issue Investigation

## Problem
Some users are experiencing CORS errors when trying to use the nutrition-ai edge function, while others (including our tests) are not.

## Root Cause Analysis

### Current CORS Headers
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Missing Headers
The current configuration is **incomplete**:
- ❌ Missing `Access-Control-Allow-Methods`
- ❌ Missing `Access-Control-Max-Age` (for preflight caching)
- ⚠️ May be missing some headers that browsers send

## Why It's Inconsistent

### Browsers That Work:
- Browsers that don't strictly enforce CORS preflight
- Browsers that cache preflight responses aggressively
- Simple requests (GET without custom headers)

### Browsers That Fail:
- Browsers with strict CORS enforcement (Safari, some Firefox versions)
- Browsers that send additional headers (causing preflight)
- First-time requests (no preflight cache)
- Requests from different domains/subdomains

## The Fix

### Complete CORS Configuration Should Include:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400', // 24 hours
};
```

### Additional Considerations:

1. **Credentials**: If we need cookies/auth:
   - Can't use `'*'` for origin with credentials
   - Need specific origin like `https://app.nutrisync.id`

2. **Response Headers**: May need to expose some headers:
   - `Access-Control-Expose-Headers`

3. **Vary Header**: For proper caching:
   - `Vary: Origin` or `Vary: Access-Control-Request-Headers`

## Recommended Solution

Update the CORS headers to be more complete and compatible with all browsers.
