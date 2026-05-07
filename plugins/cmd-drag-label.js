/* eslint-disable */
/* global Draw, Sidebar, mxEvent */
//
// drawio plugin: when the user drops a sidebar shape while holding Cmd,
// auto-set the new cell's label to the sidebar entry's display title
// (e.g. "Secrets Manager"). When Cmd is not held, or the entry has no
// title, this plugin does nothing.
//
Draw.loadPlugin(function (ui) {
  if (typeof Sidebar === 'undefined' || !Sidebar.prototype) {
    return;
  }

  var origCreateDragSource = Sidebar.prototype.createDragSource;
  if (typeof origCreateDragSource !== 'function') {
    return;
  }

  Sidebar.prototype.createDragSource = function (elt, dropHandler, preview, w, h) {
    var wrappedDropHandler = function (graph, evt, target, x, y) {
      var model = graph.getModel();
      var cellsBefore = collectCellIds(model);
      var result = dropHandler.apply(this, arguments);

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
      t = elt.getAttribute('title');
    }
    if (!t && typeof elt.title === 'string') {
      t = elt.title;
    }
    if (!t) return null;
    t = String(t).trim();
    return t.length > 0 ? t : null;
  }
});
