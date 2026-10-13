const API = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

export async function api(path, options = {}) {
  const token = getToken();
  const businessId = getCurrentBusinessId();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(businessId && { 'X-Current-Business-Id': businessId }),
    ...options.headers,
  };
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export function setCurrentBusinessId(id) {
  if (id != null) localStorage.setItem('currentBusinessId', String(id));
  else localStorage.removeItem('currentBusinessId');
}

export function getCurrentBusinessId() {
  return localStorage.getItem('currentBusinessId');
}
