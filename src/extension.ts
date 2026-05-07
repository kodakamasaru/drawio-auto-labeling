import { promises as fsp } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const DRAWIO_CONFIG_SECTION = 'hediet.vscode-drawio';
const DRAWIO_PLUGINS_KEY = 'plugins';
const SECTION = 'drawio-auto-labeling';
const PLUGIN_FILENAME = 'auto-labeling.js';
const LEGACY_PLUGIN_FILENAMES: ReadonlyArray<string> = ['cmd-drag-label.js'];
const CONFIG_PLACEHOLDER = "'__DRAWIO_AUTO_LABELING_CONFIG__'";

const ALLOWED_KEYS = ['cmd', 'ctrl', 'alt', 'shift'] as const;
type ModifierKey = typeof ALLOWED_KEYS[number];

interface DrawioPluginEntry {
  file: string;
}

interface PluginConfig {
  modifierKey: ModifierKey;
  dictionary: Record<string, string>;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storageDir = context.globalStorageUri.fsPath;
  await fsp.mkdir(storageDir, { recursive: true });

  const sourcePluginPath = context.asAbsolutePath(path.join('plugins', PLUGIN_FILENAME));
  const installedPluginPath = path.join(storageDir, PLUGIN_FILENAME);

  try {
    await regeneratePlugin(sourcePluginPath, installedPluginPath);
    await registerPlugin(installedPluginPath);
  } catch (err) {
    void vscode.window.showWarningMessage(
      `drawio-auto-labeling: failed to register plugin: ${formatError(err)}`,
    );
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration(SECTION)) {
        return;
      }
      try {
        await regeneratePlugin(sourcePluginPath, installedPluginPath);
        const choice = await vscode.window.showInformationMessage(
          'Draw.io Auto Labeling settings updated. Reload the window and re-approve the plugin in drawio for the change to take effect.',
          'Reload Window',
        );
        if (choice === 'Reload Window') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } catch (err) {
        void vscode.window.showWarningMessage(
          `drawio-auto-labeling: failed to update plugin: ${formatError(err)}`,
        );
      }
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      void unregisterPlugin(installedPluginPath);
    },
  });
}

export function deactivate(): void {
  // disposal is wired through context.subscriptions in activate()
}

async function regeneratePlugin(sourcePath: string, installedPath: string): Promise<void> {
  const template = await fsp.readFile(sourcePath, 'utf8');
  const config = readConfig();
  const inlined = template.replace(CONFIG_PLACEHOLDER, JSON.stringify(config));
  if (inlined === template) {
    throw new Error(`config placeholder ${CONFIG_PLACEHOLDER} not found in plugin source`);
  }
  await fsp.writeFile(installedPath, inlined, 'utf8');
}

function readConfig(): PluginConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const rawKey = cfg.get<string>('modifierKey', 'cmd');
  const rawDict = cfg.get<unknown>('dictionary', {});
  return {
    modifierKey: normalizeModifierKey(rawKey),
    dictionary: sanitizeDictionary(rawDict),
  };
}

function normalizeModifierKey(value: string): ModifierKey {
  return (ALLOWED_KEYS as readonly string[]).includes(value)
    ? (value as ModifierKey)
    : 'cmd';
}

function sanitizeDictionary(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k === 'string' && typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}

async function registerPlugin(pluginPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(DRAWIO_CONFIG_SECTION);
  const current = readPluginsList(config);
  // Strip any prior registration of our plugin file (current or legacy
  // basename) so we don't leave a dangling entry behind from older
  // installs.
  const obsoleteBasenames = new Set<string>([PLUGIN_FILENAME, ...LEGACY_PLUGIN_FILENAMES]);
  const purged = current.filter((entry) => !obsoleteBasenames.has(path.basename(entry.file)));
  const next: DrawioPluginEntry[] = [...purged, { file: pluginPath }];
  if (sameEntries(current, next)) {
    return;
  }
  await config.update(DRAWIO_PLUGINS_KEY, next, vscode.ConfigurationTarget.Global);
}

async function unregisterPlugin(pluginPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(DRAWIO_CONFIG_SECTION);
  const current = readPluginsList(config);
  const next = current.filter((entry) => entry.file !== pluginPath);
  if (next.length === current.length) {
    return;
  }
  const value = next.length > 0 ? next : undefined;
  await config.update(DRAWIO_PLUGINS_KEY, value, vscode.ConfigurationTarget.Global);
}

function readPluginsList(config: vscode.WorkspaceConfiguration): DrawioPluginEntry[] {
  const raw = config.get<unknown>(DRAWIO_PLUGINS_KEY);
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

function sameEntries(a: DrawioPluginEntry[], b: DrawioPluginEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].file !== b[i].file) return false;
  }
  return true;
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
