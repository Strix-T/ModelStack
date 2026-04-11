declare global {
  interface Window {
    modelstack: {
      scan: () => Promise<unknown>;
      recommend: (payload: {
        answers: {
          primaryUseCases: string[];
          inputTypes: string[];
          priority: string;
          localPreference: string;
          allowsSlowSmart: boolean;
        };
        offlineOnly?: boolean;
      }) => Promise<unknown>;
      refreshCache: () => Promise<unknown>;
      getCatalogInfo: () => Promise<{
        refreshing: boolean;
        generatedAt: string | null;
        error: string | null;
      }>;
      onCatalogStatus: (callback: (data: { refreshing: boolean; generatedAt: string | null; error: string | null }) => void) => () => void;
      markdownForResult: (result: unknown) => Promise<string>;
      saveMarkdown: (payload: { content: string; defaultFileName?: string }) => Promise<{ ok: boolean; filePath?: string }>;
      copyText: (text: string) => Promise<{ ok: boolean }>;
      openExternal: (url: string) => Promise<void>;
      getTheme: () => Promise<{ shouldUseDarkColors: boolean }>;
      onProgress: (callback: (data: unknown) => void) => () => void;
      onNativeThemeChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void) => () => void;
    };
  }
}

export {};
