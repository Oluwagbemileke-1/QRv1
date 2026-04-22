const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: "user" | "admin";
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface UserProfile extends AuthUser {}

export interface AuthResponse {
  token?: string;
  access?: string;
  refresh?: string;
  status?: string;
  message?: string;
  user?: AuthUser;
  data?: {
    user?: AuthUser;
    access?: string;
    refresh?: string;
  };
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: "user" | "admin";
  is_staff?: boolean;
  is_superuser?: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (data && typeof data === "object") {
      const message = Object.values(data)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => value != null)
        .join(" ");

      throw new Error(message || "Something went wrong.");
    }

    throw new Error("Something went wrong.");
  }

  return (data ?? {}) as T;
}

let refreshPromise: Promise<string | null> | null = null;

async function requestTokenRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem("refresh");

  if (!refresh) {
    return null;
  }

  const endpoints = [`${BASE_URL}/token/refresh/`, `${BASE_URL}/users/token/refresh/`];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json().catch(() => null) as { access?: string } | null;
      const access = data?.access || "";

      if (access) {
        localStorage.setItem("token", access);
        return access;
      }
    } catch {
      continue;
    }
  }

  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
  return null;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = requestTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem("token");

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  const freshToken = await refreshAccessToken();
  if (!freshToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  if (!retryHeaders.has("Content-Type") && init.body) {
    retryHeaders.set("Content-Type", "application/json");
  }
  retryHeaders.set("Authorization", `Bearer ${freshToken}`);

  response = await fetch(input, {
    ...init,
    headers: retryHeaders,
  });

  return response;
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = atob(padded);

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferRoleFromClaims(claims: Record<string, unknown> | null): "user" | "admin" {
  if (!claims) {
    return "user";
  }

  const role = claims.role;
  if (role === "admin" || role === "superuser") {
    return "admin";
  }

  if (claims.is_staff === true || claims.is_superuser === true) {
    return "admin";
  }

  return "user";
}

function normalizeUser(data: AuthResponse): AuthUser | null {
  const directUser = data.user;
  const nestedUser = data.data?.user;
  const candidate = directUser || nestedUser;
  const token = getAuthToken(data);
  const claims = decodeJwtPayload(token);

  if (candidate) {
    return {
      ...candidate,
      role:
        candidate.role ||
        (candidate.is_superuser || candidate.is_staff ? "admin" : inferRoleFromClaims(claims)),
    };
  }

  return {
    id: typeof claims?.user_id === "number" ? claims.user_id : 0,
    username:
      data.username ||
      (typeof claims?.username === "string" ? claims.username : "") ||
      data.email ||
      "",
    email:
      data.email ||
      (typeof claims?.email === "string" ? claims.email : "") ||
      "",
    first_name:
      data.first_name ||
      (typeof claims?.first_name === "string" ? claims.first_name : "") ||
      "",
    last_name:
      data.last_name ||
      (typeof claims?.last_name === "string" ? claims.last_name : "") ||
      "",
    role: data.role || (data.is_superuser || data.is_staff ? "admin" : inferRoleFromClaims(claims)),
    is_staff: data.is_staff ?? (claims?.is_staff === true),
    is_superuser: data.is_superuser ?? (claims?.is_superuser === true),
  };
}

export function getAuthToken(data: AuthResponse): string {
  return data.access || data.token || data.data?.access || "";
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: payload.first_name,
      last_name: payload.last_name,
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      password2: payload.confirm_password,
    }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse<AuthResponse>(res);
}

export async function logout(): Promise<void> {
  await authorizedFetch(`${BASE_URL}/users/logout/`, {
    method: "POST",
  });

  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
}

export async function resendVerificationEmail(email: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/resendemail/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/verify-email/${token}/`, {
    method: "GET",
    headers: { Accept: "application/json, text/html" },
  });

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return handleResponse<AuthResponse>(res);
  }

  const text = await res.text();
  const message = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!res.ok) {
    throw new Error(message || "Verification failed.");
  }

  return {
    message,
    status: message.toLowerCase().includes("already") ? "already_verified" : "success",
  };
}

export async function forgotPassword(identifier: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/forgot-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function verifyOtp(identifier: string, otp: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/verify-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, otp }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function resendOtp(identifier: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/resend-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function resetPassword(
  identifier: string,
  new_password: string,
  new_password2: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/reset-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, new_password, new_password2 }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function changePassword(
  old_password: string,
  new_password: string,
  confirm_password: string
): Promise<AuthResponse> {
  const res = await authorizedFetch(`${BASE_URL}/users/change-password/`, {
    method: "PUT",
    body: JSON.stringify({ old_password, new_password, confirm_password }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function listUsers(
  search?: string,
  role?: string
): Promise<{ count: number; next: string | null; previous: string | null; results: UserProfile[] }> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  const query = params.toString();

  const res = await authorizedFetch(`${BASE_URL}/users/list/${query ? `?${query}` : ""}`);

  return handleResponse<{ count: number; next: string | null; previous: string | null; results: UserProfile[] }>(res);
}

export async function getUserDetail(id: number): Promise<AuthResponse> {
  const res = await authorizedFetch(`${BASE_URL}/users/${id}/`);

  return handleResponse<AuthResponse>(res);
}

export async function updateUser(
  id: number,
  payload: Partial<RegisterPayload>
): Promise<AuthResponse> {
  const res = await authorizedFetch(`${BASE_URL}/users/${id}/update/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return handleResponse<AuthResponse>(res);
}

export async function updateMyProfile(payload: Partial<RegisterPayload>): Promise<AuthResponse> {
  const currentUser = getStoredUser();

  if (!currentUser?.id) {
    throw new Error("No signed-in user found.");
  }

  const response = await updateUser(currentUser.id, payload);
  const mergedUser = {
    ...currentUser,
    ...payload,
    phone: payload.phone ?? currentUser.phone,
  };
  localStorage.setItem("user", JSON.stringify(mergedUser));
  return response;
}

export async function deleteUser(id: number): Promise<void> {
  const res = await authorizedFetch(`${BASE_URL}/users/${id}/delete/`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Delete failed.");
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem("token");
}

function buildUserFromClaims(
  claims: Record<string, unknown>,
  existingUser?: Partial<AuthUser> | null
): AuthUser {
  const existingIsAdmin =
    existingUser?.role === "admin" || existingUser?.is_staff === true || existingUser?.is_superuser === true;

  return {
    id:
      existingUser?.id ||
      (typeof claims.user_id === "number" ? claims.user_id : 0),
    username:
      existingUser?.username ||
      (typeof claims.username === "string" ? claims.username : "") ||
      (typeof claims.email === "string" ? claims.email : ""),
    email:
      existingUser?.email ||
      (typeof claims.email === "string" ? claims.email : ""),
    first_name:
      existingUser?.first_name ||
      (typeof claims.first_name === "string" ? claims.first_name : ""),
    last_name:
      existingUser?.last_name ||
      (typeof claims.last_name === "string" ? claims.last_name : ""),
    phone: existingUser?.phone,
    role: existingIsAdmin ? "admin" : inferRoleFromClaims(claims),
    is_staff: existingUser?.is_staff ?? (claims.is_staff === true),
    is_superuser: existingUser?.is_superuser ?? (claims.is_superuser === true),
  };
}

export function getStoredUser(): AuthUser | null {
  const rawUser = localStorage.getItem("user");
  let parsedUser: AuthUser | null = null;

  if (rawUser) {
    try {
      parsedUser = JSON.parse(rawUser) as AuthUser;
    } catch {
      localStorage.removeItem("user");
    }
  }

  const token = getStoredToken();
  const claims = token ? decodeJwtPayload(token) : null;

  if (!claims) {
    return parsedUser;
  }

  const resolvedUser = buildUserFromClaims(claims, parsedUser);

  localStorage.setItem("user", JSON.stringify(resolvedUser));
  return resolvedUser;
}

export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) {
    return "";
  }

  if (user.username) {
    return user.username;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (user.email) {
    return user.email;
  }

  return "";
 }

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

export function persistAuthSession(data: AuthResponse) {
  const token = getAuthToken(data);
  const refresh = data.refresh || data.data?.refresh || "";
  const user = normalizeUser(data);

  if (token) {
    localStorage.setItem("token", token);
  }

  if (refresh) {
    localStorage.setItem("refresh", refresh);
  }

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }

  return { token, refresh, user };
}

export function saveUserIdentityFallback(username: string) {
  const currentUser = getStoredUser();

  if (currentUser?.username) {
    return currentUser;
  }

  const fallbackUser: AuthUser = {
    id: currentUser?.id || 0,
    username,
    email: currentUser?.email || "",
    first_name: currentUser?.first_name || "",
    last_name: currentUser?.last_name || "",
    phone: currentUser?.phone,
    role: currentUser?.role || "user",
    is_staff: currentUser?.is_staff,
    is_superuser: currentUser?.is_superuser,
  };

  localStorage.setItem("user", JSON.stringify(fallbackUser));
  return fallbackUser;
}
