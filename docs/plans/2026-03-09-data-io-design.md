# Data I/O Design

## Problem

vi.html has no way to get content in or out besides pasting raw text in insert mode. Users need to move content between vi.html and external apps (Word, email composers, other editors).

## Design

Two independent features that cover the primary I/O paths:

### Feature 1: System Clipboard Registers (`"+` / `"*`)

Standard vim clipboard integration. `@replit/codemirror-vim` already implements the `"+` register using `navigator.clipboard` (both `writeText` and `readText`). Works with all normal vim operations: `"+y{motion}`, `"+yy`, `"+p`/`"+P`, visual mode yanks, etc.

**What we need to build:**
- Alias `"*` register to behave identically to `"+` (browser has one clipboard, no X11 PRIMARY/CLIPBOARD distinction)
- Verify existing `"+` behavior works end-to-end in our setup
- Add help documentation

**What we get for free:** All standard vim clipboard workflows (`"+yy` to copy a line, `"+p` to paste from system clipboard, visual select then `"+y`, etc.)

### Feature 2: Copy Styled Text from Preview

A button on the preview pane that copies the document as minimal semantic HTML to the system clipboard.

**Key principle:** The clipboard HTML is a *separate render* from the preview display. Preview can use whatever styling it wants. The clipboard output is bare semantic HTML with no classes, no inline styles, no wrapper divs.

**Allowed tags:** `h1`-`h6`, `p`, `em`, `strong`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `a` (with href), `table`/`thead`/`tbody`/`tr`/`th`/`td`, `br`, `hr`, `img` (with src/alt), `del`, `input` (checkboxes for task lists).

**Clipboard data:** Writes both `text/html` (semantic HTML) and `text/plain` (raw markdown) MIME types via `navigator.clipboard.write()`. Destination apps that understand rich text get clean HTML; plain text destinations get the markdown source.

**SmartyPants:** Applied to clipboard HTML (smart quotes and dashes are content, not style).

**UI:** A "Copy" button in the preview pane header/toolbar area. Flash confirmation in the status bar on success.

**Implementation:**
- `renderClipboardHTML(markdown)` function that runs `marked.parse()` then strips non-semantic attributes (classes, ids, data-* attributes, style attributes) from the output
- Uses `navigator.clipboard.write()` with a `ClipboardItem` containing both MIME types
- Falls back to `navigator.clipboard.writeText()` if `write()` is unavailable

### Future Paths (not building now)

These are noted for architectural awareness but explicitly out of scope:
- File open/save via File System Access API or download/upload
- Drag-and-drop markdown files into editor
- `:read` command to insert file or clipboard contents
