const SITE_URL = 'https://33kfzzkq.eu-central.insforge.app';
const FUNCTIONS_URL = 'https://33kfzzkq.functions.insforge.app';

// Anon key — allows read access without login. Users can override in Settings.
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODcxNTZ9.zsda2D_WeYeSprL99XjGhBPdUZdUOOoNdUqOTcO-_rg';

function getToken(): string {
  return localStorage.getItem('emprexia_api_key') || ANON_KEY;
}

function headers(extra: Record<string,string> = {}): Record<string,string> {
  return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...extra };
}

// Database REST
export async function dbGet(table: string, params: string = '') {
  const r = await fetch(`${SITE_URL}/api/database/records/${table}${params ? '?' + params : ''}`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function dbPost(table: string, data: any[]) {
  const r = await fetch(`${SITE_URL}/api/database/records/${table}`, { method: 'POST', headers: headers({ 'Prefer': 'return=representation' }), body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function dbPatch(table: string, filter: string, data: Record<string,any>) {
  const r = await fetch(`${SITE_URL}/api/database/records/${table}?${filter}`, { method: 'PATCH', headers: headers({ 'Prefer': 'return=representation' }), body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function dbDelete(table: string, filter: string) {
  const r = await fetch(`${SITE_URL}/api/database/records/${table}?${filter}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.ok;
}

// Edge Functions
export async function fnCall(slug: string, method: string = 'GET', body?: any, params: string = '') {
  const opts: RequestInit = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${FUNCTIONS_URL}/${slug}${params ? '?' + params : ''}`, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export { SITE_URL, FUNCTIONS_URL };
