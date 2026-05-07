import * as path from 'path';
import * as vscode from 'vscode';

const DRAWIO_CONFIG_SECTION = 'hediet.vscode-drawio';
const PLUGINS_KEY = 'plugins';

interface DrawioPluginEntry {
  file: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const pluginPath = context.asAbsolutePath(path.join('plugins', 'cmd-drag-label.js'));

  try {
    await registerPlugin(pluginPath);
  } catch (err) {
    void vscode.window.showWarningMessage(
      `vscode-drawio-cmd-drag-label: failed to register plugin: ${formatError(err)}`,
    );
  }

  context.subscriptions.push({
    dispose: () => {
      void unregisterPlugin(pluginPath);
    },
  });
}

export function deactivate(): void {
  // disposal is wired through context.subscriptions in activate()
}

async function registerPlugin(pluginPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(DRAWIO_CONFIG_SECTION);
  const current = readPluginsList(config);
  if (current.some((entry) => entry.file === pluginPath)) {
    return;
  }
  const next: DrawioPluginEntry[] = [...current, { file: pluginPath }];
  await config.update(PLUGINS_KEY, next, vscode.ConfigurationTarget.Global);
}

async function unregisterPlugin(pluginPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(DRAWIO_CONFIG_SECTION);
  const current = readPluginsList(config);
  const next = current.filter((entry) => entry.file !== pluginPath);
  if (next.length === current.length) {
    return;
  }
  const value = next.length > 0 ? next : undefined;
  await config.update(PLUGINS_KEY, value, vscode.ConfigurationTarget.Global);
}

function readPluginsList(config: vscode.WorkspaceConfiguration): DrawioPluginEntry[] {
  const raw = config.get<unknown>(PLUGINS_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is DrawioPluginEntry => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { file?: unknown }).file === 'string'
    );
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
