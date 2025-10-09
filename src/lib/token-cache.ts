// Token cache with TTL
const TOKEN_CACHE_KEY = 'google_fit_token_cache:v1';
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface TokenCache {
  access_token: string;
  expires_at: string;
  ts: number;
}

export function readTokenCache(): TokenCache | null {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    if (Date.now() - parsed.ts > TOKEN_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTokenCache(token: string, expiresAt: string) {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({
      access_token: token,
      expires_at: expiresAt,
      ts: Date.now()
    }));
  } catch (error) {
    console.warn("Failed to write token cache", error);
  }
}

export function clearTokenCache() {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch (error) {
    console.warn("Failed to clear token cache", error);
  }
}

// Debounce helper
let tokenRefreshPromise: Promise<string | null> | null = null;
let tokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedTokenRefresh(refreshFn: () => Promise<string | null>): Promise<string | null> {
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
  }

  tokenRefreshPromise = refreshFn().finally(() => {
    tokenRefreshTimeout = setTimeout(() => {
      tokenRefreshPromise = null;
    }, 1000); // Clear promise after 1 second
  });

  return tokenRefreshPromise;
}
