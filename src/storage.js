// ── Constants ───────────────────────────────────────────
var LS_BUFFERS = 'vi_buffers';
var LS_SESSION = 'vi_session';
var LS_EXRC = 'vihtml_exrc';

var DEFAULT_SESSION = { current: '', alternate: null };

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

// ── Buffer persistence ──────────────────────────────────
export function loadBuffers() {
  var raw = lsGet(LS_BUFFERS);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

export function saveBuffers(buffers) {
  lsSet(LS_BUFFERS, JSON.stringify(buffers));
}

// ── Session persistence ─────────────────────────────────
export function loadSession() {
  var raw = lsGet(LS_SESSION);
  if (!raw) return { ...DEFAULT_SESSION };
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return { ...DEFAULT_SESSION };
  }
}

export function saveSession(session) {
  lsSet(LS_SESSION, JSON.stringify(session));
}

// ── Exrc persistence ────────────────────────────────────
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
