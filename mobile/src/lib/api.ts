type ApiOptions = RequestInit & {
  headers?: Record<string, string>;
};

const FALLBACK_API = 'https://api.amjt2.com.br';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API;

export function getApiBase() {
  return API_BASE;
}

export async function apiFetch(path: string, options: ApiOptions = {}, token?: string | null) {
  const headers: Record<string, string> = {
    ...(options.headers || {})
  };
  const body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  return response;
}
