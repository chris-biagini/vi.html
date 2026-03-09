// ── Constants ───────────────────────────────────────────
var LS_CONTENT = 'vihtml_content';
var LS_TTL = 'vihtml_content_ttl';
var LS_EXRC = 'vihtml_exrc';
var TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── localStorage helpers ────────────────────────────────
export function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (_e) {
    return null;
  }
}
export function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (_e) {
    /* ignore */
  }
}
export function lsRemove(k) {
  try {
    localStorage.removeItem(k);
  } catch (_e) {
    /* ignore */
  }
}

export function saveContent(text, persist) {
  if (!persist) return;
  lsSet(LS_CONTENT, text);
  lsSet(LS_TTL, String(Date.now() + TTL_MS));
}

export function loadContent() {
  var ttl = parseInt(lsGet(LS_TTL) || '0', 10);
  if (Date.now() > ttl) {
    lsRemove(LS_CONTENT);
    lsRemove(LS_TTL);
    return null;
  }
  return lsGet(LS_CONTENT);
}

export function clearContent() {
  lsRemove(LS_CONTENT);
  lsRemove(LS_TTL);
}

export function saveExrc(text) {
  if (!text) {
    lsRemove(LS_EXRC);
  } else {
    lsSet(LS_EXRC, text);
  }
}

export function loadExrc() {
  return lsGet(LS_EXRC) || '';
}

export function refreshTTL() {
  lsSet(LS_TTL, String(Date.now() + TTL_MS));
}
