/**
 * Buffer manager
 *
 * Manages multiple named buffers (documents) in memory and persists them
 * to storage. Communicates with the editor only through callback options —
 * does not import CM6 directly.
 *
 * See: https://vimhelp.org/windows.txt.html#buffers
 */

function displayName(name) {
  return name === '' ? '[No Name]' : name;
}

export function createBufferManager(opts) {
  var buffers = opts.loadBuffers();
  var session = opts.loadSession();
  var currentBuf = session.current;
  var alternateBuf = session.alternate || null;

  // Ensure current buffer exists
  if (!buffers[currentBuf]) {
    buffers[currentBuf] = { content: '', cursor: { line: 0, ch: 0 } };
  }

  // Load current buffer into editor
  loadBuffer(currentBuf);
  opts.updateBufferDisplay(displayName(currentBuf));

  function loadBuffer(name) {
    var buf = buffers[name] || { content: '', cursor: { line: 0, ch: 0 } };
    opts.setDoc(buf.content);
    opts.setCursor(buf.cursor.line, buf.cursor.ch);
  }

  function snapshotCurrent() {
    buffers[currentBuf] = {
      content: opts.getDoc(),
      cursor: opts.getCursor(),
    };
  }

  function persistState() {
    opts.saveBuffers(buffers);
    opts.saveSession({ current: currentBuf, alternate: alternateBuf });
  }

  function lineCount(content) {
    if (!content) return 1;
    return content.split('\n').length;
  }

  return {
    currentName: function () {
      return currentBuf;
    },

    alternateName: function () {
      return alternateBuf;
    },

    getBuffers: function () {
      return buffers;
    },

    switchBuffer: function (name) {
      snapshotCurrent();
      alternateBuf = currentBuf;
      currentBuf = name;

      if (!buffers[name]) {
        buffers[name] = { content: '', cursor: { line: 0, ch: 0 } };
      }

      loadBuffer(name);
      persistState();
      opts.updateBufferDisplay(displayName(name));
      opts.flash('"' + displayName(name) + '" written');
    },

    switchAlternate: function () {
      if (alternateBuf === null || alternateBuf === undefined) {
        opts.flash('E23: No alternate file');
        return;
      }
      // switchBuffer handles snapshotting and alternate setting
      var target = alternateBuf;
      snapshotCurrent();
      var oldCurrent = currentBuf;
      alternateBuf = oldCurrent;
      currentBuf = target;

      if (!buffers[target]) {
        buffers[target] = { content: '', cursor: { line: 0, ch: 0 } };
      }

      loadBuffer(target);
      persistState();
      opts.updateBufferDisplay(displayName(target));
      opts.flash('"' + displayName(target) + '" written');
    },

    saveCurrentBuffer: function () {
      snapshotCurrent();
      persistState();
    },

    writeBuffer: function (name) {
      snapshotCurrent();

      if (currentBuf === '') {
        // Rename unnamed buffer
        var data = buffers[''];
        delete buffers[''];
        buffers[name] = data;
        currentBuf = name;
      } else {
        // Saveas: copy content to new name and switch
        buffers[name] = {
          content: buffers[currentBuf].content,
          cursor: buffers[currentBuf].cursor,
        };
        alternateBuf = currentBuf;
        currentBuf = name;
      }

      persistState();
      opts.updateBufferDisplay(displayName(name));
      opts.flash('"' + displayName(name) + '" written');
    },

    saveas: function (name) {
      snapshotCurrent();
      buffers[name] = {
        content: buffers[currentBuf].content,
        cursor: { ...buffers[currentBuf].cursor },
      };
      alternateBuf = currentBuf;
      currentBuf = name;
      persistState();
      opts.updateBufferDisplay(displayName(name));
      opts.flash('"' + displayName(name) + '" written');
    },

    renameBuffer: function (name) {
      snapshotCurrent();
      var data = buffers[currentBuf];
      delete buffers[currentBuf];
      buffers[name] = data;
      currentBuf = name;
      persistState();
      opts.updateBufferDisplay(displayName(name));
      opts.flash('"' + displayName(name) + '" renamed');
    },

    deleteBuffer: function (name) {
      var target = name !== undefined && name !== null ? name : currentBuf;
      var isDeletingCurrent = target === currentBuf;

      // Refuse to delete the last buffer
      var bufferNames = Object.keys(buffers);
      if (bufferNames.length <= 1) {
        opts.flash('E84: No modified buffers');
        return;
      }

      delete buffers[target];

      // Clear alternate if it was the deleted buffer
      if (alternateBuf === target) {
        alternateBuf = null;
      }

      if (isDeletingCurrent) {
        // Switch to alternate or first remaining
        var switchTo = alternateBuf;
        if (switchTo === null || !buffers[switchTo]) {
          var remaining = Object.keys(buffers);
          switchTo = remaining[0];
        }
        alternateBuf = null;
        currentBuf = switchTo;
        loadBuffer(switchTo);
        opts.updateBufferDisplay(displayName(switchTo));
      }

      persistState();
      opts.flash('"' + displayName(target) + '" deleted');
    },

    listBuffers: function () {
      snapshotCurrent();
      var names = Object.keys(buffers);
      var lines = [];

      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var num = i + 1;
        var flags = '';
        if (name === currentBuf) flags += '%a';
        else if (name === alternateBuf) flags += '#';
        else flags += ' ';

        var buf = buffers[name];
        var lc = lineCount(buf.content);
        var dn = displayName(name);
        var quoted = name === '' ? dn : '"' + dn + '"';

        lines.push('  ' + num + ' ' + flags + '   ' + quoted + '  line ' + lc);
      }

      return lines.join('\n');
    },

    reset: function (newBuffers) {
      if (newBuffers) {
        buffers = JSON.parse(JSON.stringify(newBuffers));
        var names = Object.keys(buffers);
        currentBuf = names.length > 0 ? names[0] : '';
      } else {
        buffers = { '': { content: '', cursor: { line: 0, ch: 0 } } };
        currentBuf = '';
      }
      alternateBuf = null;

      if (!buffers[currentBuf]) {
        buffers[currentBuf] = { content: '', cursor: { line: 0, ch: 0 } };
      }

      loadBuffer(currentBuf);
      persistState();
      opts.updateBufferDisplay(displayName(currentBuf));
    },
  };
}
