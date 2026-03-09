import { marked } from 'marked';

// Configure marked
marked.use({ gfm: true, breaks: false });

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

// ── Tab switching ───────────────────────────────────────
export function showTab(name, state, callbacks) {
  var containers = {
    editor: document.getElementById('editor-container'),
    preview: document.getElementById('preview-container'),
    help: document.getElementById('help-container'),
  };
  var tabs = {
    editor: document.getElementById('tab-editor'),
    preview: document.getElementById('tab-preview'),
    help: document.getElementById('tab-help'),
  };

  state.currentTab = name;

  // Hide all, deactivate all
  containers.editor.classList.add('hidden');
  containers.preview.classList.remove('visible');
  containers.help.classList.remove('visible');
  tabs.editor.classList.remove('active');
  tabs.preview.classList.remove('active');
  tabs.help.classList.remove('active');

  // Show selected
  if (name === 'preview') {
    renderPreview(callbacks.getText());
    containers.preview.classList.add('visible');
  } else if (name === 'help') {
    containers.help.classList.add('visible');
    initHelpTocTracking(containers.help);
  } else {
    containers.editor.classList.remove('hidden');
    callbacks.focusEditor();
  }
  tabs[name].classList.add('active');
}

// ── Help TOC scroll tracking ────────────────────────────
var tocCleanup = null;

function initHelpTocTracking(helpContainer) {
  // Clean up previous listener
  if (tocCleanup) tocCleanup();

  var toc = document.getElementById('help-toc');
  if (!toc) return;

  var links = toc.querySelectorAll('a[href^="#"]');
  var sections = [];
  for (var i = 0; i < links.length; i++) {
    var id = links[i].getAttribute('href').slice(1);
    var el = document.getElementById(id);
    if (el) sections.push({ link: links[i], el: el });
  }

  // Handle click — smooth scroll within the help container
  function handleClick(e) {
    var href = e.target.closest('a');
    if (!href) return;
    var id = href.getAttribute('href');
    if (!id || id[0] !== '#') return;
    e.preventDefault();
    var target = document.getElementById(id.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  toc.addEventListener('click', handleClick);

  function updateActive() {
    var scrollTop = helpContainer.scrollTop;
    var active = null;
    for (var j = 0; j < sections.length; j++) {
      if (sections[j].el.offsetTop - 80 <= scrollTop) {
        active = sections[j];
      }
    }
    for (var k = 0; k < sections.length; k++) {
      sections[k].link.classList.toggle('active', sections[k] === active);
    }
    // Scroll the active TOC item into view within the TOC panel
    if (active) {
      var linkRect = active.link.getBoundingClientRect();
      var tocRect = toc.getBoundingClientRect();
      if (linkRect.top < tocRect.top || linkRect.bottom > tocRect.bottom) {
        active.link.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  helpContainer.addEventListener('scroll', updateActive);
  updateActive();

  tocCleanup = function () {
    helpContainer.removeEventListener('scroll', updateActive);
    toc.removeEventListener('click', handleClick);
    tocCleanup = null;
  };
}

// ── SmartyPants ─────────────────────────────────────────
export function smartyPants(html) {
  var inCode = 0;
  return html.replace(
    /(<\/?(code|pre)[^>]*>)|(<[^>]*>)|([^<]+)/gi,
    function (match, codeTag, codeTagName, otherTag, text) {
      if (codeTag) {
        if (codeTag[1] === '/') {
          inCode = Math.max(0, inCode - 1);
        } else {
          inCode++;
        }
        return codeTag;
      }
      if (otherTag) return otherTag;
      if (!text || inCode > 0) return text || '';
      return educateText(text);
    },
  );
}

export function educateText(t) {
  // Unescape HTML entities for quotes
  t = t.replace(/&quot;/g, '"');
  t = t.replace(/&#39;/g, "'");
  // Em dashes and en dashes
  t = t.replace(/---/g, '\u2014');
  t = t.replace(/--/g, '\u2013');
  // Ellipsis
  t = t.replace(/\.\.\./g, '\u2026');
  // Double quotes
  t = t.replace(/(^|[\s([{>\u2014\u2013])"(?=\S)/gm, '$1\u201C');
  t = t.replace(/"/g, '\u201D');
  // Apostrophes in contractions (before general single quotes)
  t = t.replace(/(\w)'(\w)/g, '$1\u2019$2');
  // Single quotes
  t = t.replace(/(^|[\s([{>\u2014\u2013])'(?=\S)/gm, '$1\u2018');
  t = t.replace(/'/g, '\u2019');
  return t;
}

// ── Preview rendering ───────────────────────────────────
// Note: Uses innerHTML to render the user's own markdown content.
// This is the same pattern as the original vi.html — the content
// is user-authored markdown rendered locally, not untrusted input.
export function renderPreview(mdText) {
  var html = marked.parse(mdText);
  html = smartyPants(html);
  var el = document.getElementById('preview-content');
  el.innerHTML = html;
}
