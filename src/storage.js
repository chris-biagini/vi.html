// ── Constants ───────────────────────────────────────────
var LS_CONTENT  = 'vihtml_content';
var LS_TTL      = 'vihtml_content_ttl';
var LS_SETTINGS = 'vihtml_settings';
var LS_PERSIST  = 'vihtml_persist';
var TTL_MS      = 7 * 24 * 60 * 60 * 1000;

// ── localStorage helpers ────────────────────────────────
export function lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }
export function lsRemove(k) { try { localStorage.removeItem(k); } catch(e) {} }

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

export function saveSettings(settingsObj) {
  lsSet(LS_SETTINGS, JSON.stringify(settingsObj));
}

export function loadSettings() {
  var raw = lsGet(LS_SETTINGS);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

export function loadPersistFlag() {
  var val = lsGet(LS_PERSIST);
  return val !== '0';
}

export function savePersistFlag(persist) {
  lsSet(LS_PERSIST, persist ? '1' : '0');
}

export function clearContent() {
  lsRemove(LS_CONTENT);
  lsRemove(LS_TTL);
}

export function refreshTTL() {
  lsSet(LS_TTL, String(Date.now() + TTL_MS));
}
