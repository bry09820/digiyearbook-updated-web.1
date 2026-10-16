const store = new Map();
const MAX_ENTRIES = 48;

export function pageCacheKey(parts) {
  return parts.map((part) => String(part ?? '')).join('|');
}

export function readPageCache(key) {
  const hit = store.get(key);
  if (!hit) return null;
  store.delete(key);
  store.set(key, hit);
  return hit.value;
}

export function writePageCache(key, value) {
  if (store.has(key)) store.delete(key);
  store.set(key, { value });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}
