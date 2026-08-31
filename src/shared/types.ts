export type SessionType = 'Backtest' | 'Live';
export type TradeSide = 'Long' | 'Short';

export interface TradeEntry {
  id: string;
  asset: string;
  sessionType: SessionType;
  side: TradeSide;
  date: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  quantity: number;
  fees: number;
  confluences: string[];
  comments: string;
}

export interface TradeSession {
  id: string;
  name: string;
  type: SessionType;
  startingBalance: number;
  createdAt: string;
  trades: TradeEntry[];
}

export interface NotebookSettings {
  confluenceOptions: string[];
}

export interface NotebookData {
  sessions: TradeSession[];
  activeSessionId: string | null;
  settings: NotebookSettings;
}

export const defaultNotebookData: NotebookData = {
  sessions: [],
  activeSessionId: null,
  settings: {
    confluenceOptions: ['HTF trend', 'VWAP reclaim', 'Liquidity sweep', 'Order block', 'FVG']
  }
};