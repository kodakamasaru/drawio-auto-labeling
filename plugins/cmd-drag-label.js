/* eslint-disable */
/* global Draw, mxEvent */
//
// drawio plugin: when the user drops a sidebar shape while holding Cmd,
// auto-set the new cell's label to the sidebar entry's display title.
//

(function () {
  if (typeof Draw === 'undefined' || typeof Draw.loadPlugin !== 'function') {
    return;
  }

  Draw.loadPlugin(function (ui) {
    var sidebar = ui && ui.sidebar;
    if (!sidebar) return;

    var origCreateItem = sidebar.createItem;
    var origCreateDragSource = sidebar.createDragSource;
    if (typeof origCreateDragSource !== 'function') return;

    // Stash the title argument on the entry element so we can recover
    // it later, even when drawio chooses not to set the `title`
    // attribute (showTitle=false for many palettes).
    if (typeof origCreateItem === 'function') {
      sidebar.createItem = function (cells, title, showLabel, showTitle, width, height, allowCellsInserted) {
        var elt = origCreateItem.apply(this, arguments);
        if (elt && title != null) {
          try {
            elt.setAttribute('data-cmd-drag-label', String(title));
          } catch (_e) {
            // ignore
          }
        }
        return elt;
      };
    }

    sidebar.createDragSource = function (elt, dropHandler, preview, w, h) {
      var wrappedDropHandler = function (graph, evt, target, x, y) {
        var model = graph.getModel();
        var cellsBefore = collectCellIds(model);
        var result;
        if (typeof dropHandler === 'function') {
          result = dropHandler.apply(this, arguments);
        }

        if (!isCmdHeld(evt)) {
          return result;
        }

        var label = readTitle(elt);
        if (!label) {
          return result;
        }

        model.beginUpdate();
        try {
          var cells = model.cells || {};
          for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            if (cellsBefore[id]) continue;
            var cell = cells[id];
            if (!cell || !cell.vertex) continue;
            if (cell.value) continue; // do not overwrite existing labels
            graph.cellLabelChanged(cell, label);
          }
        } finally {
          model.endUpdate();
        }

        return result;
      };

      return origCreateDragSource.call(this, elt, wrappedDropHandler, preview, w, h);
    };

    // Re-bind drag sources for entries that were created before this
    // override was installed.
    if (typeof sidebar.refresh === 'function') {
      try {
        sidebar.refresh();
      } catch (_e) {
        // palettes will rebuild on demand
      }
    }
  });

  function collectCellIds(model) {
    var out = {};
    var cells = model.cells || {};
    for (var id in cells) {
      if (Object.prototype.hasOwnProperty.call(cells, id)) {
        out[id] = true;
      }
    }
    return out;
  }

  function isCmdHeld(evt) {
    if (!evt) return false;
    if (evt.metaKey) return true;
    if (typeof mxEvent !== 'undefined' && typeof mxEvent.isMetaDown === 'function') {
      try {
        return !!mxEvent.isMetaDown(evt);
      } catch (_e) {
        return false;
      }
    }
    return false;
  }

  function readTitle(elt) {
    if (!elt) return null;
    var t = null;
    if (typeof elt.getAttribute === 'function') {
      t = elt.getAttribute('data-cmd-drag-label');
      if (!t) t = elt.getAttribute('title');
    }
    if (!t && typeof elt.title === 'string') {
      t = elt.title;
    }
    if (!t) return null;
    t = String(t).trim();
    return t.length > 0 ? t : null;
  }
})();
