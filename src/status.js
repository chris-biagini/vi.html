// ── Status bar ──────────────────────────────────────────
var modeEl = null,
  posEl = null,
  flashEl = null,
  bufferEl = null;

export function initStatusBar() {
  modeEl = document.getElementById('status-mode');
  posEl = document.getElementById('status-pos');
  flashEl = document.getElementById('status-flash');
  bufferEl = document.getElementById('status-buffer');
}

export function updateStatusPos(line, ch) {
  posEl.textContent = line + 1 + ':' + (ch + 1);
}

export function updateBufferName(name) {
  bufferEl.textContent = name;
}

export function flash(msg, duration) {
  duration = duration || 3000;
  flashEl.textContent = msg;
  flashEl.classList.remove('fade');
  // Use a module-level timer variable
  clearTimeout(flash._timer);
  flash._timer = setTimeout(function () {
    flashEl.classList.add('fade');
    setTimeout(function () {
      flashEl.textContent = '';
      flashEl.classList.remove('fade');
    }, 400);
  }, duration);
}
flash._timer = null;

export function setStatusIndicator(label) {
  var el = document.getElementById('status-indicator');
  if (!el) {
    // Create indicator element next to mode element if it doesn't exist
    el = document.createElement('span');
    el.id = 'status-indicator';
    el.style.cssText =
      'color: var(--accent); margin-left: 8px; font-weight: bold;';
    modeEl.parentNode.insertBefore(el, modeEl.nextSibling);
  }
  el.textContent = label ? '[' + label + ']' : '';
}

export function updateMode(modeObj) {
  if (!modeObj) return;
  var mode = modeObj.mode || 'normal';
  var sub = modeObj.subMode || '';
  var display = mode.toUpperCase();
  if (sub) display += ' ' + sub.toUpperCase();
  modeEl.textContent = display;
  modeEl.className = mode;
}
