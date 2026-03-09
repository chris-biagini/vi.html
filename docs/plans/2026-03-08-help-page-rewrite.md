# Help Page Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the vi.html help page from a flat reference card into a coherent vim+markdown guide with composability-first structure, semantic linebreak focus, and tip callouts.

**Architecture:** Single-file HTML rewrite (`src/template.html` lines 23–663, the `#help-content` div) plus a small CSS addition to `src/style.css` for tip callout styling. No JS changes.

**Tech Stack:** HTML, CSS

---

### Task 1: Add tip/callout CSS styling to style.css

**Files:**
- Modify: `src/style.css` (append after line 440, end of Help Pane section)

**Step 1: Add tip callout styles**

Append to the `/* Help Pane */` section in `src/style.css`:

```css
#help-content .tip {
  margin: 1em 0;
  padding: 10px 14px;
  border-left: 3px solid #c4b89a;
  background: #f9f7f3;
  font-size: 0.92em;
  color: #444;
  line-height: 1.55;
}

#help-content .tip b {
  color: #333;
}

#help-content .tip code {
  background: #eae7e0;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Builds successfully

**Step 3: Commit**

```bash
git add src/style.css
git commit -m "style: add tip callout styling for help page"
```

---

### Task 2: Write help page HTML — Header, Composability, Semantic Line Breaks

**Files:**
- Modify: `src/template.html` (replace all content inside `#help-content` div, lines 24–663)

This task replaces the ENTIRE content of the `#help-content` div with the new structure. Start with sections 1–3; subsequent tasks append the remaining sections.

**Step 1: Replace help-content inner HTML**

Replace everything between `<div id="help-content">` and its closing `</div>` with:

- **Header:** `<h1>vi.html</h1>` + `<p class="subtitle">A markdown editor with vim keybindings</p>`

- **Composability section** (`<h2>Composability</h2>`):
  - Brief explanation: vim commands are built from parts — an operator (what to do) + a motion or text object (to what). Learn the parts and you can construct hundreds of commands.
  - Table of operators: `d` (delete/cut), `c` (change — delete + insert mode), `y` (yank/copy), `gq` (reflow), `>` (indent), `<` (dedent)
  - Table of common motions/text objects: `w` (word), `iw` (inner word), `aw` (a word), `is`/`as` (sentence), `ip`/`ap` (paragraph), `i"`/`i(`/`i{` (inside delimiters), `$` (end of line), `}` (next blank line), `G` (end of file)
  - Example paragraph: `dap` = delete a paragraph, `ciw` = change inner word, `gqap` = reflow paragraph, `>}` = indent to next blank line. Any operator + any motion = a valid command.

- **Semantic Line Breaks section** (`<h2>Semantic Line Breaks</h2>`):
  - What: one sentence per line. Lines join in rendered output; the structure is for the writer, not the reader.
  - Link to [sembr.org](https://sembr.org/)
  - Why vim fits: vim's line-oriented commands become sentence-oriented. `dd` deletes a sentence. `yy` copies one. `{` and `}` jump between paragraphs. `gqap` reflows a paragraph while preserving the one-sentence-per-line structure.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/template.html
git commit -m "docs: help page — header, composability, semantic linebreaks"
```

---

### Task 3: Write help page HTML — Getting Around

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Getting Around section**

`<h2>Getting Around</h2>` with intro paragraph: "These motions work in Normal mode. They also work after an operator — `d}` deletes to the next blank line, `c$` changes to end of line."

Table with columns Key | Action:
- `h` `j` `k` `l` — Left, down, up, right
- `w` / `b` — Next word / previous word
- `e` — End of current word
- `0` / `$` — Start / end of line
- `^` — First non-blank character
- `(` / `)` — Previous / next sentence
- `{` / `}` — Previous / next blank line (paragraph boundary)
- `gg` / `G` — Top / bottom of document
- `42G` or `:42` — Jump to line 42
- `Ctrl-d` / `Ctrl-u` — Scroll half-screen down / up
- `f`*x* / `F`*x* — Jump to next / previous *x* on this line
- `t`*x* / `T`*x* — Jump to just before next / after previous *x*
- `;` / `,` — Repeat / reverse last f/F/t/T
- `%` — Matching bracket
- `*` / `#` — Next / previous occurrence of word under cursor

Tip callout: "Since markdown separates paragraphs with blank lines, `{` and `}` are your fastest way to move between sections — much quicker than repeated `j` and `k`."

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — getting around"
```

---

### Task 4: Write help page HTML — Entering Insert Mode

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Entering Insert Mode section**

`<h2>Entering Insert Mode</h2>` with brief intro: "Each of these drops you into Insert mode at a different position. Press `Esc` to return to Normal."

Table with columns Key | Action:
- `i` / `a` — Insert before / after cursor
- `I` / `A` — Insert at start / end of line
- `o` / `O` — Open new line below / above
- `R` — Replace mode (overwrite characters in place)

Tip: "Keep your insert mode sessions short and focused. Vim treats everything between entering and leaving insert mode as a single edit — short sessions mean precise undo with `u` and precise repeat with `.`"

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — entering insert mode"
```

---

### Task 5: Write help page HTML — Changing and Deleting Text

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Changing and Deleting Text section**

`<h2>Changing and Deleting Text</h2>` with intro: "The `c` (change) operator deletes text and drops you into Insert mode. The `d` (delete) operator removes text and stays in Normal. Both work with any motion or text object."

Table with columns Key | Action:
- `ciw` — Change inner word (whole word, regardless of cursor position)
- `cw` — Change from cursor to end of word
- `cc` — Change entire line
- `C` — Change from cursor to end of line
- `ci"` — Change inside quotes (also works with `'`, `` ` ``, `(`, `[`, `{`)
- `dd` — Delete entire line
- `D` — Delete from cursor to end of line
- `diw` — Delete inner word
- `dap` — Delete a paragraph (including trailing blank line)
- `di(` — Delete inside parentheses
- `x` — Delete character under cursor

Tip (`ciw` vs `cw`): "`cw` changes from the cursor to the end of the word. `ciw` changes the entire word regardless of where your cursor is. The `i` means 'inner' — the text object without surrounding whitespace. There's also `aw` ('a word') which includes the trailing space."

Tip (delete = cut): "When you `dd` a line, you haven't destroyed it — you've cut it. `p` will paste it back. `ddp` swaps the current line with the one below. `ddkP` moves a line up."

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — changing and deleting text"
```

---

### Task 6: Write help page HTML — Copying and Pasting

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Copying and Pasting section**

`<h2>Copying and Pasting</h2>` with intro: "Vim calls copying 'yanking.' The `y` operator works with any motion or text object, just like `d` and `c`."

Table with columns Key | Action:
- `yy` — Yank (copy) entire line
- `y`*motion* — Yank over motion (e.g. `yap` = yank a paragraph)
- `p` — Paste after cursor (or below, for whole lines)
- `P` — Paste before cursor (or above)

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — copying and pasting"
```

---

### Task 7: Write help page HTML — Text Objects

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Text Objects section**

`<h2>Text Objects</h2>` with intro: "Text objects select structured chunks of text. Prefix with `i` for 'inner' (contents only) or `a` for 'around' (includes delimiters or trailing whitespace). Use them with any operator."

Table with columns Object | Meaning | Example:
- `w` — Word — `diw` = delete inner word
- `W` — WORD (whitespace-delimited) — `daW` = delete around WORD
- `s` — Sentence — `cis` = change inner sentence
- `p` — Paragraph — `gqap` = reflow around paragraph
- `"` `'` `` ` `` — Quoted string — `ci"` = change inside quotes
- `(` `[` `{` — Bracket pair — `di(` = delete inside parens

Tip: "With semantic line breaks, sentence text objects (`is`, `as`) and line operations (`dd`, `yy`) overlap — both target a single sentence. Use whichever feels more natural."

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — text objects"
```

---

### Task 8: Write help page HTML — Working with Prose

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Working with Prose section**

`<h2>Working with Prose</h2>` with intro: "The `gq` operator hard-wraps text to a specified width. Set your preferred width with `:set tw=72`. If `textwidth` is 0, `gq` wraps at 79 columns (matching vim's default)."

Table with columns Key | Action:
- `gqq` — Reflow current line
- `gqap` — Reflow current paragraph
- `gq}` — Reflow from cursor to next blank line
- `gqj` — Reflow current line and next
- Visual + `gq` — Reflow selected lines

Paragraph: "With `textwidth` set, lines also wrap automatically as you type in Insert mode. Lines are broken at word boundaries and indentation is preserved."

Tip: "`gqap` is the command you'll use most. Write freely, then reflow the paragraph when you're done. For semantic line breaks, `gq` respects blank-line paragraph boundaries — it won't merge separate paragraphs."

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — working with prose"
```

---

### Task 9: Write help page HTML — Finding and Replacing

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add Finding and Replacing section**

`<h2>Finding and Replacing</h2>`

Search table:
- `/`*pattern* — Search forward
- `?`*pattern* — Search backward
- `n` / `N` — Next / previous match
- `*` / `#` — Search for word under cursor (forward / backward)
- `:noh` — Clear search highlighting

Substitution table (or combined):
- `:s/old/new/` — Replace first match on current line
- `:s/old/new/g` — Replace all on current line
- `:%s/old/new/g` — Replace all in file
- `:%s/old/new/gc` — Replace all in file, confirm each

Tip: "Search `/^#` then press `n` to jump between markdown headings. Search `/^##` for subheadings only."

**Step 2: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — finding and replacing"
```

---

### Task 10: Write help page HTML — Dot Command, Undo/Redo, Counts, Marks, Visual Mode

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add The Dot Command section**

`<h2>The Dot Command</h2>` with intro: "The most powerful key in vim. `.` repeats your last change — whatever you just did, do it again."

Paragraph explaining the `n.n.n.` pattern: search with `/`, make a change (e.g., `ciw` + new text + Esc), then `n` to next match, `.` to repeat. The dot repeats the entire edit including what you typed in insert mode.

**Step 2: Add Undo and Redo section**

`<h2>Undo and Redo</h2>`

Table:
- `u` — Undo
- `Ctrl-r` — Redo

Tip: "An 'edit' is everything between entering and leaving Insert mode. Short insert sessions = precise undo."

**Step 3: Add Counts section**

`<h2>Counts</h2>`

Paragraph: "Most commands accept a numeric prefix: `5j` moves down 5 lines, `3dd` deletes 3 lines, `2dw` deletes 2 words."

**Step 4: Add Marks section**

`<h2>Marks</h2>` with intro: "Bookmarks within your document."

Table:
- `m`*a* — Set mark *a* (any lowercase letter)
- `'`*a* — Jump to the line of mark *a*
- `` ` ``*a* — Jump to the exact position of mark *a*

Tip: "Set a mark before jumping away: `ma`, do your work elsewhere, then `'a` to come back."

**Step 5: Add Visual Mode section**

`<h2>Visual Mode</h2>` with intro: "Select text, then act on the selection."

Table:
- `v` — Character-wise visual mode
- `V` — Line-wise visual mode

Paragraph: "Once in Visual mode, use any motion to extend the selection, then apply an operator: `d` to delete, `c` to change, `y` to yank, `gq` to reflow, `>` to indent."

**Step 6: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — dot, undo, counts, marks, visual mode"
```

---

### Task 11: Write help page HTML — vi.html Reference section

**Files:**
- Modify: `src/template.html` (append inside `#help-content`)

**Step 1: Add hr separator and vi.html Reference heading**

`<hr />` followed by `<h2>vi.html Commands</h2>`

Commands table:
- `:w` — Save to browser storage
- `:e` — Reload content from last save
- `:editor` — Switch to Editor tab
- `:pre[view]` — Switch to Preview tab
- `:help` — Show this help
- `:tog[gle]` — Toggle between Editor and Preview
- `:persist` — Enable auto-save (default)
- `:nopersist` — Disable auto-save
- `:clear` — Wipe saved content from storage
- `:settings` — Show all current settings
- `:s/old/new/g` — Substitute (supports regex)
- `:noh` — Clear search highlighting
- `:exrc` — Edit startup commands
- `:wq` — Save and quit (in exrc: save and apply)
- `:q!` — Quit without saving (in exrc: discard changes)

**Step 2: Add Options section**

`<h2>vi.html Options</h2>` with intro about `:set option`, `:set nooption`, `:exrc` for persistence.

Table with columns Option | Short | Type | Default | Description:
- textwidth / tw / number / 0 (off) / Auto-wrap lines at this column in Insert mode
- number / nu / bool / on / Show line numbers
- relativenumber / rnu / bool / off / Relative line numbers
- tabstop / ts / number / 4 / Tab display width
- shiftwidth / sw / number / 4 / Indent width for >> / <<
- expandtab / et / bool / on / Insert spaces instead of tabs
- wrap / — / bool / on / Soft-wrap long lines

**Step 3: Add Keyboard Shortcuts section**

`<h2>vi.html Keyboard Shortcuts</h2>`

Table with columns Key | Context | Action:
- `\p` / Normal mode / Toggle between Editor and Preview
- `\` / Preview or Help / Return to Editor

**Step 4: Add Abbreviations section**

`<h2>Abbreviations</h2>` with intro about text expansions in insert mode, trigger on non-keyword character, persist via `:exrc`.

Table:
- `:ab[breviate] {lhs} {rhs}` — Define abbreviation
- `:ab[breviate]` — List all abbreviations
- `:ab[breviate] {lhs}` — Show abbreviation for lhs
- `:una[bbreviate] {lhs}` — Remove abbreviation
- `:abc[lear]` — Remove all abbreviations

Example paragraph and link to vimhelp.org.

**Step 5: Add exrc section**

`<h2>exrc (Startup Commands)</h2>` — what it is, how to use (:exrc, :wq, :q!), comment syntax, example pre block, link to vimhelp.org.

**Step 6: Add Persistence section**

`<h2>Persistence</h2>` — bullet list: content auto-save with 7-day TTL, settings ephemeral (use exrc), disable with :nopersist, clear with :clear.

**Step 7: Add Preview & SmartyPants section**

`<h2>Preview &amp; SmartyPants</h2>` — GFM support paragraph, SmartyPants typography table.

**Step 8: Verify build, commit**

```bash
git add src/template.html
git commit -m "docs: help page — vi.html reference section"
```

---

### Task 12: Build and verify

**Files:**
- Verify: `vi.html` (build output)

**Step 1: Run full build**

Run: `npm run build`
Expected: Builds successfully, produces `vi.html`

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Fix any issues found, commit fixes**
