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
  role?: "user" | "admin";
}

export interface AuthResponse {
  token?: string;
  access?: string;
  refresh?: string;
  message?: string;
  user?: AuthUser;
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

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
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
  await fetch(`${BASE_URL}/users/logout/`, {
    method: "POST",
    headers: authHeaders(),
  });

  localStorage.removeItem("token");
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
    headers: { "Content-Type": "application/json" },
  });

  return handleResponse<AuthResponse>(res);
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
  const res = await fetch(`${BASE_URL}/users/change-password/`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ old_password, new_password, confirm_password }),
  });

  return handleResponse<AuthResponse>(res);
}

export async function listUsers(): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/list/`, {
    headers: authHeaders(),
  });

  return handleResponse<AuthResponse>(res);
}

export async function getUserDetail(id: number): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/${id}/`, {
    headers: authHeaders(),
  });

  return handleResponse<AuthResponse>(res);
}

export async function updateUser(
  id: number,
  payload: Partial<RegisterPayload>
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/users/${id}/update/`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<AuthResponse>(res);
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/users/${id}/delete/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Delete failed.");
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem("token");
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}
