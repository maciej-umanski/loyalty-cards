async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listCards() {
  return request('/api/cards');
}

export function createCard(data) {
  return request('/api/cards', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCard(id, data) {
  return request(`/api/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCard(id) {
  return request(`/api/cards/${id}`, { method: 'DELETE' });
}
