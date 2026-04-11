import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RecommendationProgress } from "@modelstack/app/recommendationPipeline.js";
import {
  getSystemProfile,
  recommendationResultToMarkdown,
  runRecommendationPipeline,
  runRefreshCachePipeline,
} from "@modelstack/app/recommendationPipeline.js";
import type { QuestionnaireAnswers } from "@modelstack/core/questionnaire/normalizeAnswers.js";
import { normalizeAnswers } from "@modelstack/core/questionnaire/normalizeAnswers.js";
import { readCacheSnapshot } from "@modelstack/core/shared/io.js";
import type { RecommendationResult, SystemProfile } from "@modelstack/core/shared/types.js";
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import log from "electron-log";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

autoUpdater.logger = log;
autoUpdater.autoDownload = true;

let mainWindow: BrowserWindow | null = null;

type CatalogUiState = {
  refreshing: boolean;
  generatedAt: string | null;
  error: string | null;
};

let lastCatalogUi: CatalogUiState = {
  refreshing: false,
  generatedAt: null,
  error: null,
};

let lastRefreshResult: Awaited<ReturnType<typeof runRefreshCachePipeline>> | null = null;

/** Serialized catalog syncs (launch + manual) so recommend waits for the latest refresh. */
let catalogSyncTail: Promise<void> = Promise.resolve();

function broadcastCatalogStatus(): void {
  mainWindow?.webContents.send("modelstack:catalog-status", lastCatalogUi);
}

async function executeCatalogRefresh(): Promise<void> {
  const previousSnap = await readCacheSnapshot();
  lastCatalogUi = {
    refreshing: true,
    generatedAt: previousSnap?.generatedAt ?? lastCatalogUi.generatedAt,
    error: null,
  };
  broadcastCatalogStatus();

  try {
    lastRefreshResult = await runRefreshCachePipeline();
    lastCatalogUi = {
      refreshing: false,
      generatedAt: lastRefreshResult.generatedAt,
      error: null,
    };
  } catch (err) {
    log.warn("Catalog refresh failed", err);
    const snap = await readCacheSnapshot();
    lastCatalogUi = {
      refreshing: false,
      generatedAt: snap?.generatedAt ?? lastCatalogUi.generatedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  broadcastCatalogStatus();
}

function queueCatalogRefresh(): Promise<void> {
  const job = catalogSyncTail.then(() => executeCatalogRefresh());
  catalogSyncTail = job.then(() => {}).catch(() => {});
  return job;
}

function isDev(): boolean {
  return !app.isPackaged || process.env.ELECTRON_DEV === "1";
}

function sendProgress(payload: RecommendationProgress): void {
  mainWindow?.webContents.send("modelstack:progress", payload);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 720,
    minHeight: 600,
    show: false,
    title: "ModelStack",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev() && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Check for Updates…",
          click: () => {
            if (isDev()) {
              void dialog.showMessageBox({
                type: "info",
                message: "Updates are disabled in development builds.",
              });
              return;
            }
            void autoUpdater.checkForUpdates();
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupIpc(): void {
  ipcMain.handle("modelstack:scan", async (): Promise<SystemProfile> => {
    return getSystemProfile();
  });

  ipcMain.handle("modelstack:get-catalog-info", async (): Promise<CatalogUiState> => {
    return { ...lastCatalogUi };
  });

  ipcMain.handle(
    "modelstack:recommend",
    async (
      _event,
      payload: {
        answers: QuestionnaireAnswers;
        offlineOnly?: boolean;
        fast?: boolean;
      },
    ): Promise<RecommendationResult> => {
      await catalogSyncTail;
      const intent = normalizeAnswers(payload.answers);
      return runRecommendationPipeline({
        intent,
        offlineOnly: payload.offlineOnly,
        fast: payload.fast,
        onProgress: sendProgress,
      });
    },
  );

  ipcMain.handle("modelstack:refresh-cache", async () => {
    await queueCatalogRefresh();
    if (lastCatalogUi.error) {
      throw new Error(lastCatalogUi.error);
    }
    if (!lastRefreshResult) {
      throw new Error("Catalog refresh did not produce a snapshot.");
    }
    return lastRefreshResult;
  });

  ipcMain.handle("modelstack:markdown-for-result", async (_event, result: RecommendationResult) => {
    return recommendationResultToMarkdown(result);
  });

  ipcMain.handle(
    "modelstack:save-markdown",
    async (_event, payload: { content: string; defaultFileName?: string }) => {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
        title: "Save report",
        defaultPath: payload.defaultFileName ?? "modelstack-report.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (canceled || !filePath) {
        return { ok: false as const };
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, payload.content, "utf8");
      return { ok: true as const, filePath };
    },
  );

  ipcMain.handle("modelstack:copy-text", async (_event, text: string) => {
    clipboard.writeText(text);
    return { ok: true as const };
  });

  ipcMain.handle("modelstack:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle("modelstack:get-theme", () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  }));
}

function setupAutoUpdater(): void {
  if (isDev()) {
    return;
  }

  autoUpdater.on("update-available", () => {
    log.info("Update available");
  });

  autoUpdater.on("update-downloaded", () => {
    void dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: "A new version was downloaded. Restart ModelStack to install it.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  void autoUpdater.checkForUpdates().catch((err) => log.warn("checkForUpdates", err));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  void app.whenReady().then(() => {
    nativeTheme.on("updated", () => {
      mainWindow?.webContents.send("modelstack:native-theme-changed", {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      });
    });

    buildMenu();
    setupIpc();
    void queueCatalogRefresh();
    createWindow();
    setupAutoUpdater();
  });
}
