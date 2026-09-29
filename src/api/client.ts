import axios from 'axios';

// The Vite dev server proxies /api -> http://127.0.0.1:8000
export const api = axios.create({
  baseURL: 'https://erpbackend.skysoft.com.mm/api',
  timeout: 30000,
});

export function errorMessage(e: unknown): string {
  const anyE = e as { response?: { data?: { message?: string } }; message?: string };
  return anyE?.response?.data?.message ?? anyE?.message ?? String(e);
}