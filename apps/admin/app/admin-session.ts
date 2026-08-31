"use client";

const TOKEN_KEY = "knowledge-pay-admin-token";
const ADMIN_KEY = "knowledge-pay-admin-info";

export type AdminInfo = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

export function getAdminToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function getAdminInfo(): AdminInfo | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(ADMIN_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminInfo;
  } catch {
    return null;
  }
}

export function saveAdminSession(accessToken: string, admin: AdminInfo) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearAdminSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_KEY);
}

export async function adminFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && typeof window !== "undefined") {
    clearAdminSession();
    window.location.href = "/login";
  }

  return response;
}
