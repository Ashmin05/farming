/**
 * Auth client for the real FastAPI backend (backend/app/routers/auth.py).
 * Always calls the live backend — unlike src/lib/api, it is not gated by
 * NEXT_PUBLIC_USE_MOCKS, since auth has no mock counterpart.
 */

// The backend's auth routes live at the API root, not under /api/v1 like the
// (not-yet-implemented) data endpoints NEXT_PUBLIC_API_URL points at.
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

const ACCESS_TOKEN_KEY = "fasalsetu_access_token";
const REFRESH_TOKEN_KEY = "fasalsetu_refresh_token";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export class AuthError extends Error {}

// FastAPI returns `detail` as a plain string for our own HTTPExceptions, but
// as an array of {msg, loc, ...} objects for pydantic validation errors (422).
function extractErrorMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join(" ");
  }
  return `Request failed (${status})`;
}

async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new AuthError(extractErrorMessage(payload, res.status));
  }

  return res.json() as Promise<T>;
}

export function storeTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export async function register(
  email: string,
  password: string,
  fullName?: string
): Promise<AuthUser> {
  return authFetch<AuthUser>("/auth/register", {
    email,
    password,
    full_name: fullName ?? null,
  });
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const tokens = await authFetch<AuthTokens>("/auth/login", { email, password });
  storeTokens(tokens);
  return tokens;
}

export async function loginWithGoogle(idToken: string): Promise<AuthTokens> {
  const tokens = await authFetch<AuthTokens>("/auth/google", { id_token: idToken });
  storeTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(): Promise<AuthTokens | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const tokens = await authFetch<AuthTokens>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    storeTokens(tokens);
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  const res = await fetch(`${API_ROOT}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<AuthUser>;
}

export function logout(): void {
  clearTokens();
}
