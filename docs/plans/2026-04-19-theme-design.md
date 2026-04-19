# Theme: the "Her" treatment — design

**Status:** design, pending implementation plan
**Date:** 2026-04-19
**Roadmap item:** Sprint 2 #3 (`docs/plans/2026-04-19-product-polish-roadmap.md:65`)
**Related commitment:** "Verify native CM6 behavior before planning" — the CM6 theming survey is folded in below as §0.

## 0. CM6 theming surface — empirical survey

Before designing, we surveyed what CM6 provides natively. Summary (full survey retained in session history):

- `EditorView.theme(spec, { dark })` returns a scoped extension; selectors use `&` for the editor wrapper, `&dark`/`&light` to condition on the `darkTheme` facet. Multiple themes coexist by CSS order. Swap at runtime via `Compartment.reconfigure`.
- `@codemirror/language` exports `HighlightStyle.define([{ tag, ...css }])` and `syntaxHighlighting(style)`. Per-theme styles are inlined at extension-creation time — **CSS variables cannot reach into `HighlightStyle`**; one style instance per theme is required.
- `@lezer/markdown` emits per-level heading tags (`tags.heading1`–`heading6`), plus `emphasis`, `strong`, `link`, `url`, `monospace` (covers inline code + fenced-block text), `quote`, `list`, `processingInstruction` (list marks, heading `#`, emphasis marks), `contentSeparator` (HR). No dedicated tag for task-list checkboxes.
- CM6 has no first-class OS dark-mode switch. `prefers-color-scheme` is host-side; the host feeds CM6.
- **Current state of vi.html:** no syntax highlighting active in the editor today. `src/style.css:138–178` contains dead CM5-era `.cm-header`/`.cm-em` rules that CM6 does not emit. Palette lives in CSS variables at `src/style.css:1–19` but the values are a dark monospace-green scheme. Preview (`:262–387`) and help (`:389–628`) panes hardcode a light palette (~200 lines) independent of the editor. Two hardcoded hex exceptions inside the JS editor theme: `#4e5a8a` (tilde) at `src/main.js:208`, `#1e3a24` (focused selection) at `src/main.js:180`.

## 1. Scope

In scope:

- Warm cream/espresso **light palette** ("Paper & Clay") across editor, preview, and help panes.
- Matching **dark palette** ("Espresso Mirror") across the same surfaces.
- **Markdown syntax highlighting** in the editor (not currently active).
- **OS-follow** switching via `prefers-color-scheme`, both on initial load and on live OS change.
- Deletion of dead CM5-era token CSS in `src/style.css`.

Out of scope (explicit):

- No manual theme-override Ex command (no `:colorscheme`, no `:set theme=`, no `:set background=`).
- No persistence layer (OS is the source of truth).
- No user-authored themes.
- No additional named schemes beyond the two.
- No task-list checkbox custom parser decoration (noted as an open item in §3).

## 2. Architecture

Three layers wired through one runtime control surface:

1. **CSS custom-property palette.** Two `:root` variable blocks under `html[data-theme='light']` and `html[data-theme='dark']` in `src/style.css`. Every color in editor chrome, preview, and help panes is routed through variables.
2. **Editor chrome theme.** The existing `EditorView.theme({...})` block in `src/main.js:148–213` stays mostly as-is; it already reads `var(--bg)`, `var(--fg)`, etc. Two hardcoded exceptions (`#4e5a8a`, `#1e3a24`) migrate to variables. This extension is static — never reconfigured at runtime.
3. **Syntax highlighting.** A new module `src/vim/highlight.js` exports two `HighlightStyle` instances (one per theme) wrapped in `syntaxHighlighting(...)`. Hardcoded hex values per the palette in §3 (CSS variables cannot reach `HighlightStyle`). A `themeCompartment` in `main.js` holds the active variant and is reconfigured on OS change.
4. **OS-follow switcher.** `matchMedia('(prefers-color-scheme: dark)')` listener in `main.js`: on initial read and on change, (a) set `document.documentElement.dataset.theme`, (b) `themeCompartment.reconfigure(activeHighlight)`.

## 3. Palette specification

Identical variable names across themes; different hex values.

### Light — Paper & Clay (`html[data-theme='light']`)

| Variable | Hex | Role |
|---|---|---|
| `--bg` | `#f4ede0` | Editor & app background (warm parchment) |
| `--bg-elevated` | `#ebe2d2` | Status bar, tab bar, dialog backgrounds |
| `--fg` | `#3d3530` | Primary text (espresso) |
| `--fg-muted` | `#6b5d4f` | Status bar text, labels |
| `--fg-faint` | `#987b5a` | Blockquote body, comments |
| `--accent` | `#c4634d` | Clay-red — h1, links, emphasis, strong; status bar NORMAL mode |
| `--accent-soft` | `#b05d2b` | h2–h6 |
| `--accent-warm` | `#b88a3c` | Status bar INSERT mode (amber) |
| `--accent-vis` | `#6b8094` | Status bar VISUAL mode (muted slate-blue) |
| `--accent-rep` | `#9a3a2a` | Status bar REPLACE mode (deep crimson) |
| `--list-mark` | `#9a7540` | List bullets, ordered-list numerals |
| `--code` | `#7a8f6e` | Inline code & fenced-block text (muted sage) |
| `--tilde` | `#b89968` | End-of-buffer `~` (honey gold) |
| `--rule` | `#c9b898` | Horizontal rules, subtle borders |
| `--sel-bg` | `#e5d8bc` | Selection background |
| `--cursor` | `#3d3530` | Block cursor |
| `--active-line` | `rgba(61,53,48,0.04)` | Current-line highlight |

### Dark — Espresso Mirror (`html[data-theme='dark']`)

| Variable | Hex | Role |
|---|---|---|
| `--bg` | `#2a2320` | Editor & app background |
| `--bg-elevated` | `#352b26` | Status bar, tab bar, dialogs |
| `--fg` | `#e4d8c0` | Primary text |
| `--fg-muted` | `#a89680` | Status bar text |
| `--fg-faint` | `#9f8c74` | Blockquotes, comments |
| `--accent` | `#e08060` | h1, links, emphasis, strong; status bar NORMAL mode |
| `--accent-soft` | `#d27458` | h2–h6 |
| `--accent-warm` | `#d4a35c` | Status bar INSERT mode (warm gold) |
| `--accent-vis` | `#8ca3b8` | Status bar VISUAL mode (slate-blue) |
| `--accent-rep` | `#c45a40` | Status bar REPLACE mode (saturated crimson) |
| `--list-mark` | `#b89968` | Bullets, numerals |
| `--code` | `#9bb08a` | Inline code & fenced blocks |
| `--tilde` | `#7a6347` | End-of-buffer `~` |
| `--rule` | `#4a3f37` | Horizontal rules, borders |
| `--sel-bg` | `#4a3c30` | Selection background |
| `--cursor` | `#e4d8c0` | Block cursor |
| `--active-line` | `rgba(228,216,192,0.04)` | Current-line highlight |

### Syntax highlighting token map

Identical structure both themes; the hex resolves to the light or dark variant above.

| Lezer tag | Color | Treatment |
|---|---|---|
| `heading1` | accent | Bold, base monospace size |
| `heading2` – `heading6` | accent-soft | Bold, base monospace size |
| `emphasis` | accent | Italic |
| `strong` | accent | Bold |
| `link`, `url` | accent | Regular weight |
| `monospace` | code | Inline code + fenced-block body (no background pill) |
| `quote` | fg-faint | Italic |
| `list` (container) | inherit | Body text inside list items unchanged |
| `processingInstruction` | list-mark | List markers, heading `#`, emphasis/strong marks |
| `contentSeparator` | rule | Horizontal rules |

**Design decisions:**

- **Uniform heading size.** All headings render at base monospace size; hierarchy conveyed via color + weight only. Preserves vim's monospace grid (column counts, cursor navigation, `gq`/`gw` reflow visuals). Rendered preview pane conveys true size hierarchy via HTML.
- **No code-span background pill.** Inline code is colored text on plain bg. Keeps horizontal monospace grid exact.

**Open item (to resolve during implementation):** task-list checkboxes (`[ ]` / `[x]`) do not get a dedicated Lezer tag from `@lezer/markdown`. Two acceptable outcomes: (a) they inherit reasonable styling from `processingInstruction` + base text and we ship as-is, or (b) they need a custom parser decoration. If (b), that decoration is **out of scope** for this feature — defer to a follow-up. Implementation plan will verify and pick.

## 4. Runtime behavior

**On page load:**

1. Read `matchMedia('(prefers-color-scheme: dark)').matches`.
2. Set `document.documentElement.dataset.theme = matches ? 'dark' : 'light'`. CSS variables update → full app chrome colors correctly on first paint.
3. Initialize `themeCompartment` with `syntaxHighlighting(matches ? darkHighlight : lightHighlight)`. Editor syntax tokens render correctly on first paint — no flash.

**On OS theme change:**

1. `matchMedia` change listener fires.
2. Update `dataset.theme` → chrome recolors.
3. `themeCompartment.reconfigure(newHighlight)` → editor tokens recolor.
4. Instant, no easing. No cursor jump, no state loss, no reload.

**Browsers without `prefers-color-scheme`:** `matches` returns `false`; light variant is the default. Acceptable.

**Persistence:** none. OS is the single source of truth.

## 5. Error handling

The feature has no runtime failure modes worth handling. `matchMedia`, `EditorView.theme`, and `syntaxHighlighting` are pure configuration; if they throw the app is fundamentally broken with no recovery path.

The one failure shape is a typo in a palette hex — a visual bug, caught at the screenshot-review stage in §6, not a runtime error. No try/catch, no fallbacks.

## 6. Testing

**Unit (Vitest), `src/vim/highlight.test.js` (new):**

- Both light and dark `HighlightStyle` instances construct without error.
- Each emits rules for every tag in the §3 token map.
- Hex values in each match the palette spec verbatim (regression guard against silent drift).

**Browser (Playwright + `?test` harness):**

1. Serve `vi.html` locally, open `?test`.
2. `__vi.setDoc(...)` a sample doc with h1–h6, emphasis, strong, a link, inline code, a fenced block, a list, a blockquote, a horizontal rule.
3. Screenshot editor region.
4. `emulateMedia({ colorScheme: 'dark' })`.
5. Assert `html[data-theme] === 'dark'`.
6. Screenshot again.
7. Spot-check a known token via `getComputedStyle` (e.g. heading-line child span resolves to dark-accent hex).

Screenshots go to `~/screenshots/` per `CLAUDE.md`. Pixel-perfect diffing is explicitly not used — human review of the pair is the decision surface.

**PR verification gate:** `npm run check` green, `npm run build` green, light+dark screenshots attached.

## 7. Implementation slices

Five ordered slices, each a checkpoint. Every slice leaves the app working.

| # | Scope | Files | Checkpoint |
|---|---|---|---|
| 1 | Palette variables + delete dead CSS | `src/style.css`, `src/main.js` (remove `#4e5a8a`, `#1e3a24`) | App looks like Paper & Clay; `dataset.theme = 'light'` set statically; no functional change; dark unreachable. |
| 2 | Syntax highlighting (light only) | `src/vim/highlight.js` (new), `src/vim/highlight.test.js` (new), `src/main.js` | Editor shows markdown highlighting in Paper & Clay; static `syntaxHighlighting(...)` — no compartment yet. |
| 3 | Dark palette variables | `src/style.css` | Dark variables defined; manual flip to `dataset.theme = 'dark'` renders chrome correctly; revert to `'light'` before commit. |
| 4 | Dark highlight + compartment | `src/vim/highlight.js`, `src/main.js` | `themeCompartment` introduced; both highlight variants exist; reconfigure works when dispatched manually via `__vi.view`. Default still light. |
| 5 | OS-follow switcher + help page update | `src/main.js`, `src/template.html` (help content) | `matchMedia` read + listener wired; OS flip recolors whole app live; help page documents the behavior. |

**Not touched:** `src/storage.js`, `src/vim/exrc.js`, `src/vim/options.js`, `src/vim/commands.js`, any vim module outside the new `highlight.js`.

**Estimated PR size:** ~300 lines net.

## 8. Non-goals

- Manual theme override / `:colorscheme` command. If added later, it's a separate feature with its own design.
- User-authored theme files or imports.
- Checked-in Playwright test suite in CI. §6 describes an interactive browser test; making it a CI-gated suite is a distinct polish item (candidate for a future roadmap backlog entry).
- Custom parser decoration for task-list checkboxes (see §3 open item).

## 9. References

- Roadmap: `docs/plans/2026-04-19-product-polish-roadmap.md:65`
- CM6 theming API: `node_modules/@codemirror/view/dist/index.d.ts:1367–1405`
- `HighlightStyle`: `node_modules/@codemirror/language/dist/index.d.ts:831–935`
- `@lezer/markdown` tag map: `node_modules/@lezer/markdown/dist/index.js:1952–1975`
- `@lezer/highlight` tag catalog: `node_modules/@lezer/highlight/dist/index.d.ts:437–523`
- Current editor theme: `src/main.js:148–213`
- Current palette variables: `src/style.css:1–19`
- Dead CM5-era CSS to delete: `src/style.css:138–178`
- Preview pane CSS: `src/style.css:262–387`
- Help pane CSS: `src/style.css:389–628`
- Editor API pattern: `CLAUDE.md` (editorAPI / compartments)
