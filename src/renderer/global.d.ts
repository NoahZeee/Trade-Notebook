import type { NotebookData } from '../shared/types';

declare global {
  interface Window {
    tradeNotebook: {
      loadData: () => Promise<NotebookData>;
      saveData: (data: NotebookData) => Promise<boolean>;
      exportSession: (format: 'json' | 'csv', filename: string, content: string) => Promise<string | null>;
    };
  }
}

export {};