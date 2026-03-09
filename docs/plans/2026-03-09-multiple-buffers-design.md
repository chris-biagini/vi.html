# Multiple Buffers Design

## Overview

Add vim-like support for editing multiple named buffers stored in localStorage. Flat namespace (no directories). Session persists as if vim never quit.

**Core principle: never lose data, even at the cost of vim fidelity.**

## Storage

Single localStorage key `vi_buffers` holding a JSON object:

```json
{
  "notes.md": { "content": "...", "cursor": { "line": 5, "ch": 0 } },
  "todo.md": { "content": "...", "cursor": { "line": 1, "ch": 0 } },
  "": { "content": "...", "cursor": { "line": 3, "ch": 0 } }
}
```

The `""` key represents `[No Name]`. A separate `vi_session` key stores session state:

```json
{
  "current": "notes.md",
  "alternate": "todo.md"
}
```

No TTL. Buffers persist until explicitly deleted with `:bd`. Auto-save continues on every change (1s debounce), writing to the current buffer's slot.

Old `LS_CONTENT`/`LS_TTL` keys are removed — no backward compatibility needed.

## Buffer Lifecycle

- **Startup**: Load `vi_session` to find current buffer, load its content. If no session exists, start with `[No Name]`.
- **Switch** (`:e`, `:b`, `:b#`, `Ctrl-^`): Auto-persist current buffer (content + cursor), flash a message like `"notes.md" written`, then load target buffer.
- **Naming**: `:w foo.md` on `[No Name]` renames it to `foo.md`. `:w bar.md` on an already-named buffer acts as `:saveas` (copies to new name and switches).
- **`:saveas name`**: Copy current content to new name, switch to it.
- **`:f name`** / **`:file name`**: Rename current buffer (delete old key, create new).
- **`:bd name`**: Delete buffer. If deleting current buffer, switch to alternate or `[No Name]`. Refuse to delete the last buffer.
- **`exrc`**: Stays in its own `vi_exrc` key, separate from buffers.

## Status Bar

Buffer name shown permanently next to mode indicator: `NORMAL  notes.md  --  5:12`. Unnamed shows `[No Name]`.

## Commands

| Command | Behavior |
|---------|----------|
| `:ls` / `:buffers` | Flash buffer list with `%`/`#` indicators and cursor lines (8s) |
| `:e name` | Open existing or create new buffer by name |
| `:w` | Persist current buffer |
| `:w name` | Name (if unnamed) or saveas (if named) current buffer |
| `:saveas name` | Copy current to new name, switch to it |
| `:b name` | Switch to buffer by name |
| `:b#` | Switch to alternate buffer |
| `:bd [name]` | Delete buffer (current if no name) |
| `:f name` / `:file name` | Rename current buffer |
| `Ctrl-^` | Toggle alternate buffer (normal mode) |

## Divergences from Vim

- **No E37 warning on switch**: Switching buffers auto-persists the current buffer instead of warning about unsaved changes. A flash message confirms the save.
- **No TTL**: Buffers persist indefinitely (vim files persist on disk indefinitely too).
- **`:w name` on named buffer**: Acts as `:saveas` rather than writing to a different file while keeping current name. This simplifies the model for localStorage.

## Help Page

Document buffer system, auto-persist-on-switch behavior, and all buffer commands in the existing help pane.
