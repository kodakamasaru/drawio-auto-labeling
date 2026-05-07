/* eslint-disable */
/* global Draw, mxEvent */
//
// drawio plugin: when the user drops a sidebar shape while holding the
// configured modifier key, set the new cell's label to either a value
// from the user dictionary or the sidebar entry's display title.
//
// CONFIG is replaced at activation time by the extension host. The
// string-typed default keeps the plugin functional if the placeholder
// is ever loaded unreplaced.
//

(function () {
  var CONFIG = '__CMD_DRAG_LABEL_CONFIG__';
  if (typeof CONFIG === 'string') {
    CONFIG = { modifierKey: 'cmd', dictionary: {} };
  }

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

        if (!isModifierHeld(evt, CONFIG.modifierKey)) {
          return result;
        }

        var rawTitle = readTitle(elt);
        if (!rawTitle) {
          return result;
        }

        var label = mapLabel(rawTitle, CONFIG.dictionary);
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

  function isModifierHeld(evt, key) {
    if (!evt) return false;
    switch (key) {
      case 'ctrl':
        return !!evt.ctrlKey;
      case 'alt':
        return !!evt.altKey;
      case 'shift':
        return !!evt.shiftKey;
      case 'ctrlOrCmd':
        return !!(evt.metaKey || evt.ctrlKey);
      case 'cmd':
      default:
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
  }

  // Returns the label to apply, or null to skip labeling.
  // - Hit with non-empty value -> use mapped value
  // - Hit with empty string    -> skip (explicit suppression)
  // - Miss                     -> use the title verbatim
  function mapLabel(title, dict) {
    if (!dict) return title;
    if (Object.prototype.hasOwnProperty.call(dict, title)) {
      var v = dict[title];
      if (typeof v === 'string') {
        return v.length > 0 ? v : null;
      }
    }
    return title;
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
