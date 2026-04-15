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
          preferredEngine?: string;
          installComfort?: string;
          formatPreference?: string;
          contextPreference?: string;
          quantizationTolerance?: string;
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
      pickProjectDirectory: () => Promise<{ ok: true; path: string } | { ok: false }>;
      applyStack: (payload: {
        result: unknown;
        bundleLabel?: string;
        projectDir: string;
        assumeYes: boolean;
      }) => Promise<
        | {
            success: true;
            bundle: unknown;
            mode: string;
            projectDir: string;
            notes: string[];
          }
        | { success: false; reason: string; skippedBundleLabels: string[] }
      >;
      onApplyProgress: (
        callback: (data: { kind: "steps"; text: string } | { kind: "pull"; chunk: string }) => void,
      ) => () => void;
    };
  }
}

export {};
