# Drawio Cmd-Drag Label

Hold **Cmd** while dragging a shape from the drawio sidebar in VSCode to auto-label the placed cell with the shape's display name (e.g. `Secrets Manager`, `Amazon EC2`).

## Why

[`hediet.vscode-drawio`](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) ships AWS / GCP / Azure / etc. shape libraries where each entry has a human-readable title shown on hover. By default that title is **not** applied as the cell label when you drop the shape. This extension adds a one-key shortcut: hold Cmd, the title becomes the label.

## Requirements

- macOS (the trigger is `Cmd` / `metaKey`)
- VSCode 1.80+
- [`hediet.vscode-drawio`](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) (declared as `extensionDependencies`, so VSCode installs it automatically)

## How it works

On activation, this extension appends its bundled plugin path to your **Global** `hediet.vscode-drawio.plugins` setting. On deactivation, the entry is removed.

The bundled plugin (`plugins/cmd-drag-label.js`) monkey-patches `Sidebar.prototype.createDragSource`. When the drop handler fires, it checks `evt.metaKey`; if held, it reads the sidebar entry's `title` attribute (e.g. `Secrets Manager`) and applies it to the newly dropped cell via `graph.cellLabelChanged`.

The first time `hediet.vscode-drawio` loads the plugin it shows a fingerprint approval prompt — click **Allow**.

## Behavior

| Situation                                  | Result                              |
| ------------------------------------------ | ----------------------------------- |
| Drag without Cmd                           | No label (original drawio behavior) |
| Drag with Cmd, sidebar entry has a title   | Label set to the title              |
| Drag with Cmd, sidebar entry has no title  | No label (same as Cmd not held)     |
| Drop produces a non-vertex cell            | Skipped                             |
| Drop produces a vertex with a preset value | Existing label preserved            |

A single drop is wrapped in one `beginUpdate` / `endUpdate`, so undo reverts both placement and label in one step.

## Develop

```bash
npm install
npm run compile
```

Press **F5** in VSCode to launch an Extension Development Host, then open any `.drawio` file in the dev window.

## Package & install

```bash
npx vsce package
code --install-extension vscode-drawio-cmd-drag-label-<version>.vsix
```

## License

MIT
