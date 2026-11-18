const TOKEN_KEY = 'sinxron_talim_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Server bilan bog‘lanishda xatolik yuz berdi.');
  }
  return data as T;
}

export async function downloadWithAuth(url: string, fallbackFileName: string) {
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Faylni yuklab olib bo‘lmadi.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fallbackFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Faylni o‘qishda xatolik yuz berdi.'));
    reader.readAsDataURL(file);
  });
}

export function getWebSocketUrl(token: string, lessonId?: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ token });
  if (lessonId) params.set('lessonId', lessonId);
  return `${protocol}//${window.location.host}/ws?${params.toString()}`;
}

export function formatUzDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    const months = [
      'yanvar',
      'fevral',
      'mart',
      'aprel',
      'may',
      'iyun',
      'iyul',
      'avgust',
      'sentabr',
      'oktabr',
      'noyabr',
      'dekabr',
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}, ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

export function formatUzTime(iso: string): string {
  try {
    const date = new Date(iso);
    return `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
