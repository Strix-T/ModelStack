import { contextBridge, ipcRenderer } from "electron";

/** Mirrors QuestionnaireAnswers — types are enforced in main. */
export type CatalogInfo = {
  refreshing: boolean;
  generatedAt: string | null;
  error: string | null;
};

export type RecommendPayload = {
  answers: {
    primaryUseCases: string[];
    inputTypes: string[];
    priority: string;
    localPreference: string;
    allowsSlowSmart: boolean;
  };
  offlineOnly?: boolean;
};

contextBridge.exposeInMainWorld("modelstack", {
  scan: () => ipcRenderer.invoke("modelstack:scan"),

  recommend: (payload: RecommendPayload) => ipcRenderer.invoke("modelstack:recommend", payload),

  refreshCache: () => ipcRenderer.invoke("modelstack:refresh-cache"),

  getCatalogInfo: (): Promise<CatalogInfo> => ipcRenderer.invoke("modelstack:get-catalog-info"),

  onCatalogStatus: (callback: (data: CatalogInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: CatalogInfo): void => {
      callback(data);
    };
    ipcRenderer.on("modelstack:catalog-status", listener);
    return () => {
      ipcRenderer.removeListener("modelstack:catalog-status", listener);
    };
  },

  markdownForResult: (result: unknown) => ipcRenderer.invoke("modelstack:markdown-for-result", result),

  saveMarkdown: (payload: { content: string; defaultFileName?: string }) =>
    ipcRenderer.invoke("modelstack:save-markdown", payload),

  copyText: (text: string) => ipcRenderer.invoke("modelstack:copy-text", text),

  openExternal: (url: string) => ipcRenderer.invoke("modelstack:open-external", url),

  getTheme: () => ipcRenderer.invoke("modelstack:get-theme"),

  onProgress: (callback: (data: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown): void => {
      callback(data);
    };
    ipcRenderer.on("modelstack:progress", listener);
    return () => {
      ipcRenderer.removeListener("modelstack:progress", listener);
    };
  },

  onNativeThemeChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { shouldUseDarkColors: boolean }): void => {
      callback(data);
    };
    ipcRenderer.on("modelstack:native-theme-changed", listener);
    return () => {
      ipcRenderer.removeListener("modelstack:native-theme-changed", listener);
    };
  },
});
