import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { defaultNotebookData, NotebookData, SessionType, TradeEntry, TradeSession } from '../shared/types';

type TradeFormState = {
  asset: string;
  side: 'Long' | 'Short';
  date: string;
  entryTime: string;
  exitTime: string;
  pnl: string;
  quantity: string;
  fees: string;
  confluences: string[];
  comments: string;
};

type TrendPeriod = 'daily' | 'weekly' | 'monthly';

type EquityPoint = {
  label: string;
  date: string;
  balance: number;
  pnl: number;
};

type TrendPoint = {
  label: string;
  period: string;
  pnl: number;
};

type SessionAnalytics = {
  totalPnL: number;
  wins: number;
  losses: number;
  winrate: number;
  avgWinner: number | null;
  avgLoser: number | null;
  avgWinLossRatio: number | null;
  bestTrade: TradeEntry | null;
  worstTrade: TradeEntry | null;
  accountHigh: number;
  accountLow: number;
  peakAccountBalance: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  equityCurve: EquityPoint[];
  dailyPnl: Record<string, number>;
  weeklyPnl: Record<string, number>;
  monthlyPnl: Record<string, number>;
};

const emptyTradeForm: TradeFormState = {
  asset: '',
  side: 'Long',
  date: '',
  entryTime: '',
  exitTime: '',
  pnl: '',
  quantity: '1',
  fees: '0',
  confluences: [],
  comments: ''
};

function createSession(type: SessionType): TradeSession {
  return {
    id: crypto.randomUUID(),
    name: `${type} Session ${new Date().toLocaleDateString()}`,
    type,
    startingBalance: 10000,
    createdAt: new Date().toISOString(),
    trades: []
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function computeStats(session: TradeSession) {
  const totalPnL = session.trades.reduce((sum, trade) => sum + trade.pnl - trade.fees, 0);
  const wins = session.trades.filter((trade) => trade.pnl - trade.fees > 0).length;
  const losses = session.trades.filter((trade) => trade.pnl - trade.fees < 0).length;
  const winrate = wins + losses === 0 ? 0 : (wins / (wins + losses)) * 100;

  return { totalPnL, wins, losses, winrate };
}

function netPnl(trade: TradeEntry) {
  return trade.pnl - trade.fees;
}

function parseTradeDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + offset);
  return weekStart;
}

function getPeriodKey(date: string, period: TrendPeriod) {
  const parsed = parseTradeDate(date);
  if (period === 'monthly') {
    return date.slice(0, 7);
  }
  if (period === 'weekly') {
    return formatDateKey(getWeekStart(parsed));
  }
  return date;
}

function getOrderedTrades(session: TradeSession) {
  if (session.type === 'Backtest') {
    return session.trades;
  }

  return [...session.trades].sort((left, right) => {
    const leftStamp = new Date(`${left.date}T${left.exitTime || left.entryTime || '00:00'}`).getTime();
    const rightStamp = new Date(`${right.date}T${right.exitTime || right.entryTime || '00:00'}`).getTime();
    return leftStamp - rightStamp;
  });
}

function buildAnalytics(session: TradeSession): SessionAnalytics {
  const ordered = getOrderedTrades(session);
  const winners = ordered.map(netPnl).filter((value) => value > 0);
  const losers = ordered.map(netPnl).filter((value) => value < 0);
  const totalPnL = ordered.reduce((sum, trade) => sum + netPnl(trade), 0);
  const balances = [session.startingBalance];
  const equityCurve: EquityPoint[] = [];
  const dailyPnl: Record<string, number> = {};
  const weeklyPnl: Record<string, number> = {};
  const monthlyPnl: Record<string, number> = {};
  let running = 0;
  let peak = session.startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  ordered.forEach((trade, index) => {
    const tradePnl = netPnl(trade);
    running += tradePnl;
    const balance = session.startingBalance + running;
    const date = trade.date;
    const week = getPeriodKey(date, 'weekly');
    const month = getPeriodKey(date, 'monthly');
    dailyPnl[date] = (dailyPnl[date] ?? 0) + tradePnl;
    weeklyPnl[week] = (weeklyPnl[week] ?? 0) + tradePnl;
    monthlyPnl[month] = (monthlyPnl[month] ?? 0) + tradePnl;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const drawdownPercent = peak === 0 ? 0 : (drawdown / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
    balances.push(balance);
    equityCurve.push({ label: `${index + 1}`, date, balance, pnl: running });
  });

  const bestTrade = ordered.length ? ordered.reduce((best, trade) => (netPnl(trade) > netPnl(best) ? trade : best)) : null;
  const worstTrade = ordered.length ? ordered.reduce((worst, trade) => (netPnl(trade) < netPnl(worst) ? trade : worst)) : null;
  const avgWinner = winners.length ? winners.reduce((sum, value) => sum + value, 0) / winners.length : null;
  const avgLoser = losers.length ? losers.reduce((sum, value) => sum + value, 0) / losers.length : null;

  return {
    totalPnL,
    wins: winners.length,
    losses: losers.length,
    winrate: winners.length + losers.length ? (winners.length / (winners.length + losers.length)) * 100 : 0,
    avgWinner,
    avgLoser,
    avgWinLossRatio: avgWinner !== null && avgLoser !== null && avgLoser !== 0 ? avgWinner / Math.abs(avgLoser) : null,
    bestTrade,
    worstTrade,
    accountHigh: Math.max(...balances),
    accountLow: Math.min(...balances),
    peakAccountBalance: peak,
    maxDrawdown,
    maxDrawdownPercent,
    equityCurve,
    dailyPnl,
    weeklyPnl,
    monthlyPnl
  };
}

function buildTrendData(analytics: SessionAnalytics, period: TrendPeriod): TrendPoint[] {
  const source = period === 'daily' ? analytics.dailyPnl : period === 'weekly' ? analytics.weeklyPnl : analytics.monthlyPnl;
  return Object.entries(source)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodKey, pnl]) => ({
      label: period === 'monthly' ? periodKey : periodKey.slice(5),
      period: periodKey,
      pnl
    }));
}

function buildCalendarWeeks(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const lastDay = new Date(year, monthNumber, 0);
  const start = new Date(firstDay);
  const firstDayOfWeek = start.getDay();
  start.setDate(start.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));
  const end = new Date(lastDay);
  const lastDayOfWeek = end.getDay();
  end.setDate(end.getDate() + (lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek));
  const weeks: Array<Array<{ date: string; day: number; inMonth: boolean }>> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const week = [];
    for (let index = 0; index < 7; index += 1) {
      week.push({
        date: formatDateKey(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === monthNumber - 1
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildCsvExport(session: TradeSession) {
  const rows = [
    ['Asset', 'Side', 'Date', 'Entry time', 'Exit time', 'PnL', 'Fees', 'Quantity', 'Confluences', 'Comments'],
    ...session.trades.map((trade) => [
      trade.asset,
      trade.side,
      trade.date,
      trade.entryTime,
      trade.exitTime,
      String(trade.pnl),
      String(trade.fees),
      String(trade.quantity),
      trade.confluences.join('|'),
      trade.comments
    ])
  ];

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}

async function exportActiveSession(session: TradeSession | null, format: 'json' | 'csv') {
  if (!session) {
    return;
  }

  const content = format === 'json' ? JSON.stringify(session, null, 2) : buildCsvExport(session);
  const filename = `${session.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'trade-session'}.${format}`;
  const savedPath = await window.tradeNotebook.exportSession(format, filename, content);

  if (savedPath) {
    window.alert(`Exported ${session.name} to:\n${savedPath}`);
  }
}

function updateSession(session: TradeSession, tradeId: string | null, form: TradeFormState): TradeSession {
  const nextTrade: TradeEntry = {
    id: tradeId ?? crypto.randomUUID(),
    asset: form.asset.trim(),
    sessionType: session.type,
    side: form.side,
    date: form.date,
    entryTime: form.entryTime,
    exitTime: form.exitTime,
    pnl: Number(form.pnl || 0),
    quantity: Number(form.quantity || 0),
    fees: Number(form.fees || 0),
    confluences: form.confluences,
    comments: form.comments.trim()
  };

  return tradeId
    ? { ...session, trades: session.trades.map((trade) => (trade.id === tradeId ? nextTrade : trade)) }
    : { ...session, trades: [...session.trades, nextTrade] };
}

export default function App() {
  const [data, setData] = useState<NotebookData>(defaultNotebookData);
  const [hydrated, setHydrated] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState<TradeFormState>(emptyTradeForm);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [newConfluence, setNewConfluence] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'session'>('home');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily');
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    let mounted = true;
    window.tradeNotebook.loadData().then((loaded) => {
      if (!mounted) {
        return;
      }

      const next = loaded?.sessions ? loaded : defaultNotebookData;
      setData(next);
      setActiveSessionId(next.activeSessionId ?? next.sessions[0]?.id ?? null);
      setHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void window.tradeNotebook.saveData({ ...data, activeSessionId });
  }, [data, activeSessionId, hydrated]);

  const activeSession = useMemo(
    () => data.sessions.find((session) => session.id === activeSessionId) ?? data.sessions[0] ?? null,
    [activeSessionId, data.sessions]
  );
  const analytics = useMemo(() => (activeSession ? buildAnalytics(activeSession) : null), [activeSession]);
  const chartData = analytics?.equityCurve ?? [];
  const isLiveSession = activeSession?.type === 'Live';
  const trendData = useMemo(
    () => (analytics ? buildTrendData(analytics, trendPeriod) : []),
    [analytics, trendPeriod]
  );
  const calendarWeeks = useMemo(() => buildCalendarWeeks(calendarMonth), [calendarMonth]);

  useEffect(() => {
    if (!activeSession || activeSession.trades.length === 0) {
      return;
    }

    const firstTradeDate = [...activeSession.trades].sort((left, right) => left.date.localeCompare(right.date))[0].date;
    setCalendarMonth(firstTradeDate.slice(0, 7));
  }, [activeSessionId]);

  function handleSelectSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setCurrentView('session');
    setShowTradeModal(false);
  }

  function handleBackToHome() {
    setCurrentView('home');
    setEditingTradeId(null);
    setTradeForm({ ...emptyTradeForm });
  }

  function persistSessions(nextSessions: TradeSession[], nextActiveSessionId: string | null = activeSessionId) {
    setData((current) => ({ ...current, sessions: nextSessions, activeSessionId: nextActiveSessionId }));
  }

  function handleCreateSession(type: SessionType) {
    const session = createSession(type);
    persistSessions([session, ...data.sessions], session.id);
    setTradeForm({ ...emptyTradeForm });
    setEditingTradeId(null);
  }

  function handleDeleteSession(sessionId: string) {
    const nextSessions = data.sessions.filter((session) => session.id !== sessionId);
    const nextActive = activeSessionId === sessionId ? nextSessions[0]?.id ?? null : activeSessionId;
    persistSessions(nextSessions, nextActive);
    setEditingTradeId(null);
    setTradeForm({ ...emptyTradeForm });
  }

  function handleSaveTrade() {
    if (!activeSession || !tradeForm.asset.trim() || !tradeForm.date || !tradeForm.entryTime || !tradeForm.exitTime) {
      return;
    }

    const nextSessions = data.sessions.map((session) =>
      session.id === activeSession.id ? updateSession(session, editingTradeId, tradeForm) : session
    );

    persistSessions(nextSessions, activeSession.id);
    setTradeForm({ ...emptyTradeForm });
    setEditingTradeId(null);
  }

  function handleEditTrade(trade: TradeEntry) {
    setEditingTradeId(trade.id);
    setTradeForm({
      asset: trade.asset,
      side: trade.side,
      date: trade.date,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      pnl: String(trade.pnl),
      quantity: String(trade.quantity),
      fees: String(trade.fees),
      confluences: trade.confluences,
      comments: trade.comments
    });
  }

  function handleDeleteTrade(tradeId: string) {
    if (!activeSession) {
      return;
    }

    const nextSessions = data.sessions.map((session) =>
      session.id === activeSession.id
        ? { ...session, trades: session.trades.filter((trade) => trade.id !== tradeId) }
        : session
    );

    persistSessions(nextSessions, activeSession.id);
    if (editingTradeId === tradeId) {
      setEditingTradeId(null);
      setTradeForm({ ...emptyTradeForm });
    }
  }

  function handleToggleConfluence(option: string) {
    setTradeForm((current) => ({
      ...current,
      confluences: current.confluences.includes(option)
        ? current.confluences.filter((item) => item !== option)
        : [...current.confluences, option]
    }));
  }

  function handleAddConfluenceOption() {
    const option = newConfluence.trim();
    if (!option || data.settings.confluenceOptions.includes(option)) {
      return;
    }

    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        confluenceOptions: [...current.settings.confluenceOptions, option]
      }
    }));
    setNewConfluence('');
  }

  function handleRemoveConfluenceOption(option: string) {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        confluenceOptions: current.settings.confluenceOptions.filter((item) => item !== option)
      }
    }));
    setTradeForm((current) => ({
      ...current,
      confluences: current.confluences.filter((item) => item !== option)
    }));
  }

  if (!hydrated) {
    return <div className="loading-shell">Loading your desktop notebook...</div>;
  }

  return (
    <div className="app-shell">
      {currentView === 'home' ? (
        // ===== HOME / DASHBOARD VIEW =====
        <div className="home-view">
          <header className="home-header">
            <div className="home-header-content">
              <div className="home-brand">
                <p className="eyebrow">Trade Notebook</p>
                <h1>Track every session with a sharper workflow.</h1>
              </div>
              <div className="home-quick-actions">
                <button className="primary-button" onClick={() => handleCreateSession('Backtest')}>
                  + New Backtest
                </button>
                <button className="secondary-button" onClick={() => handleCreateSession('Live')}>
                  + New Live
                </button>
              </div>
            </div>
          </header>

          <main className="home-content">
            <section className="home-section">
              <div className="section-head">
                <h2>Trading Sessions</h2>
                <span className="badge">{data.sessions.length}</span>
              </div>

              {data.sessions.length === 0 ? (
                <div className="empty-state">
                  <p>No sessions yet. Create your first session to begin tracking trades.</p>
                </div>
              ) : (
                <div className="sessions-grid">
                  {data.sessions.map((session) => {
                    const sessionStats = computeStats(session);
                    const netPnL = sessionStats.totalPnL;
                    return (
                      <div
                        key={session.id}
                        className="session-card-large"
                        onClick={() => handleSelectSession(session.id)}
                      >
                        <div className="session-card-header">
                          <div>
                            <h3>{session.name}</h3>
                            <span className={`session-type-badge type-${session.type.toLowerCase()}`}>
                              {session.type}
                            </span>
                          </div>
                          <button
                            className="card-close-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete session "${session.name}"?`)) {
                                handleDeleteSession(session.id);
                              }
                            }}
                            title="Delete session"
                          >
                            ×
                          </button>
                        </div>

                        <div className="session-card-stats">
                          <div className="stat-mini">
                            <span className="label">Total PnL</span>
                            <span className={`value ${netPnL >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(netPnL)}
                            </span>
                          </div>
                          <div className="stat-mini">
                            <span className="label">Win Rate</span>
                            <span className="value">{sessionStats.winrate.toFixed(1)}%</span>
                          </div>
                          <div className="stat-mini">
                            <span className="label">Trades</span>
                            <span className="value">{session.trades.length}</span>
                          </div>
                        </div>

                        <div className="session-card-footer">
                          <span className="starting-balance">
                            Starting: {formatCurrency(session.startingBalance)}
                          </span>
                          <span className="trade-count">
                            {sessionStats.wins}W {sessionStats.losses}L
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="home-section">
              <div className="section-head">
                <h2>Confluence Presets</h2>
                <span className="badge">{data.settings.confluenceOptions.length}</span>
              </div>

              <div className="preset-manager">
                <div className="preset-input-group">
                  <input
                    value={newConfluence}
                    onChange={(event) => setNewConfluence(event.target.value)}
                    placeholder="Add a confluence preset"
                  />
                  <button className="secondary-button" onClick={handleAddConfluenceOption}>
                    Add
                  </button>
                </div>

                <div className="preset-list">
                  {data.settings.confluenceOptions.map((option) => (
                    <button
                      key={option}
                      className="preset-pill"
                      onClick={() => handleRemoveConfluenceOption(option)}
                      title="Click to remove"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      ) : (
        // ===== SESSION DETAIL VIEW =====
        <div className="session-view">
          <header className="session-header">
            <div className="session-header-content">
              <button className="back-button" onClick={handleBackToHome}>
                ← Back
              </button>
              <div>
                <p className="eyebrow">Session Details</p>
                <h2>{activeSession?.name}</h2>
              </div>
            </div>
            {activeSession && (
              <div className="session-header-actions">
                <div className="header-badge">
                  <span>{activeSession.type}</span>
                  <strong>{formatCurrency(activeSession.startingBalance)}</strong>
                </div>
                <button className="primary-button" onClick={() => setShowTradeModal(true)}>
                  + Add Trade
                </button>
                <button className="secondary-button" onClick={() => void exportActiveSession(activeSession, 'json')}>
                  Export JSON
                </button>
                <button className="secondary-button" onClick={() => void exportActiveSession(activeSession, 'csv')}>
                  Export CSV
                </button>
              </div>
            )}
          </header>

          {activeSession ? (
            <main className="session-content">
              <section className="stats-grid">
                <article className="stat-card accent">
                  <span>Total PnL</span>
                  <strong>{formatCurrency(analytics?.totalPnL ?? 0)}</strong>
                </article>
                <article className="stat-card">
                  <span>Win rate</span>
                  <strong>{(analytics?.winrate ?? 0).toFixed(1)}%</strong>
                </article>
                <article className="stat-card">
                  <span>Wins</span>
                  <strong>{analytics?.wins ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <span>Losses</span>
                  <strong>{analytics?.losses ?? 0}</strong>
                </article>
                <article className="stat-card">
                  <span>Average Winner</span>
                  <strong className="positive">
                    {analytics?.avgWinner == null ? '—' : formatCurrency(analytics.avgWinner)}
                  </strong>
                </article>
                <article className="stat-card">
                  <span>Average Loser</span>
                  <strong className="negative">
                    {analytics?.avgLoser == null ? '—' : formatCurrency(analytics.avgLoser)}
                  </strong>
                </article>
                <article className="stat-card">
                  <span>Avg W/L Ratio</span>
                  <strong>{analytics?.avgWinLossRatio == null ? '—' : `${analytics.avgWinLossRatio.toFixed(2)}x`}</strong>
                </article>
                <article className="stat-card">
                  <span>Best Trade</span>
                  <strong className="positive">
                    {analytics?.bestTrade == null ? '—' : formatCurrency(netPnl(analytics.bestTrade))}
                  </strong>
                </article>
                <article className="stat-card">
                  <span>Worst Trade</span>
                  <strong className="negative">
                    {analytics?.worstTrade == null ? '—' : formatCurrency(netPnl(analytics.worstTrade))}
                  </strong>
                </article>
                <article className="stat-card">
                  <span>{isLiveSession ? 'Account High' : 'Replay High'}</span>
                  <strong>{formatCurrency(analytics?.accountHigh ?? activeSession.startingBalance)}</strong>
                </article>
                <article className="stat-card">
                  <span>{isLiveSession ? 'Account Low' : 'Replay Low'}</span>
                  <strong>{formatCurrency(analytics?.accountLow ?? activeSession.startingBalance)}</strong>
                </article>
                <article className="stat-card">
                  <span>{isLiveSession ? 'Max Drawdown' : 'Replay Drawdown'}</span>
                  <strong className="negative">
                    {analytics ? `${formatCurrency(-analytics.maxDrawdown)} (${analytics.maxDrawdownPercent.toFixed(1)}%)` : '—'}
                  </strong>
                </article>
              </section>

              {isLiveSession ? (
                <section className="analytics-grid">
                <article className="panel calendar-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Daily PnL Calendar</h2>
                      <span>Weekly totals appear at the end of each row</span>
                    </div>
                    <div className="calendar-controls">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => {
                          const date = parseTradeDate(`${calendarMonth}-01`);
                          date.setMonth(date.getMonth() - 1);
                          setCalendarMonth(formatDateKey(date).slice(0, 7));
                        }}
                        aria-label="Previous month"
                      >
                        ‹
                      </button>
                      <strong>
                        {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
                          parseTradeDate(`${calendarMonth}-01`)
                        )}
                      </strong>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => {
                          const date = parseTradeDate(`${calendarMonth}-01`);
                          date.setMonth(date.getMonth() + 1);
                          setCalendarMonth(formatDateKey(date).slice(0, 7));
                        }}
                        aria-label="Next month"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className="calendar-weekdays">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Week'].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="calendar-grid">
                    {calendarWeeks.flatMap((week) => [
                      ...week.map((day) => {
                        const dayPnl = analytics?.dailyPnl[day.date] ?? 0;
                        return (
                          <div
                            key={day.date}
                            className={`calendar-day ${day.inMonth ? '' : 'outside-month'} ${
                              dayPnl > 0 ? 'profit-day' : dayPnl < 0 ? 'loss-day' : ''
                            }`}
                          >
                            <span>{day.day}</span>
                            {analytics?.dailyPnl[day.date] !== undefined ? (
                              <strong>{formatCurrency(dayPnl)}</strong>
                            ) : null}
                          </div>
                        );
                      }),
                      <div key={`${week[0].date}-total`} className="calendar-week-total">
                        {formatCurrency(week.reduce((sum, day) => sum + (analytics?.dailyPnl[day.date] ?? 0), 0))}
                      </div>
                    ])}
                  </div>
                </article>

                <article className="panel trend-panel">
                  <div className="panel-head">
                    <div>
                      <h2>PnL Trends</h2>
                      <span>Net PnL after fees</span>
                    </div>
                    <div className="segmented-control" role="group" aria-label="Trend period">
                      {(['daily', 'weekly', 'monthly'] as TrendPeriod[]).map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={trendPeriod === period ? 'active' : ''}
                          onClick={() => setTrendPeriod(period)}
                        >
                          {period[0].toUpperCase() + period.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="trend-chart-wrap">
                    {trendData.length === 0 ? (
                      <div className="chart-empty">Add trades to see period trends.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={trendData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: '#8ea5c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#8ea5c7', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <ReferenceLine y={0} stroke="rgba(255,255,255,0.28)" />
                          <Tooltip
                            formatter={(value) => [formatCurrency(Number(value ?? 0)), 'PnL']}
                            labelFormatter={(label) => `${trendPeriod} period: ${label}`}
                            contentStyle={{
                              background: 'rgba(8, 17, 31, 0.98)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 16,
                              color: '#eff6ff'
                            }}
                          />
                          <Bar dataKey="pnl" fill="#64d2ff" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </article>
                </section>
              ) : null}

              <section className="grid two-column">
                <article className="panel chart-panel">
                  <div className="panel-head">
                    <h2>{isLiveSession ? 'Live Account Curve' : 'Replay Equity Curve'}</h2>
                    <span>{chartData.length} trades</span>
                  </div>
                  <div className="chart-wrap">
                    {chartData.length === 0 ? (
                      <div className="chart-empty">Add trades to see the balance curve.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={chartData}>
                          <defs>
                            <linearGradient id="balanceFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="5%" stopColor="#64d2ff" stopOpacity={0.36} />
                              <stop offset="95%" stopColor="#64d2ff" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: '#8ea5c7', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#8ea5c7', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(8, 17, 31, 0.98)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 16,
                              color: '#eff6ff'
                            }}
                          />
                          <Area type="monotone" dataKey="balance" stroke="transparent" fill="url(#balanceFill)" />
                          <Line type="monotone" dataKey="balance" stroke="#64d2ff" strokeWidth={3} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </article>

                <article className="panel settings-panel">
                  <div className="panel-head">
                    <h2>Session Settings</h2>
                  </div>
                  <label>
                    Session name
                    <input
                      value={activeSession.name}
                      onChange={(event) => {
                        const nextSessions = data.sessions.map((s) =>
                          s.id === activeSession.id ? { ...s, name: event.target.value } : s
                        );
                        persistSessions(nextSessions, activeSession.id);
                      }}
                    />
                  </label>
                  <label>
                    Starting balance
                    <input
                      type="number"
                      step="0.01"
                      value={activeSession.startingBalance}
                      onChange={(event) => {
                        const nextSessions = data.sessions.map((s) =>
                          s.id === activeSession.id ? { ...s, startingBalance: Number(event.target.value || 0) } : s
                        );
                        persistSessions(nextSessions, activeSession.id);
                      }}
                    />
                  </label>
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (window.confirm(`Delete session "${activeSession.name}"? This cannot be undone.`)) {
                        handleDeleteSession(activeSession.id);
                        handleBackToHome();
                      }
                    }}
                  >
                    Delete Session
                  </button>
                </article>
              </section>

              <section className="panel table-panel">
                <div className="panel-head">
                  <h2>Trade Log</h2>
                  <span>{activeSession.trades.length} trades</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Side</th>
                        <th>Date</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>PnL</th>
                        <th>Confluences</th>
                        <th>Comments</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {getOrderedTrades(activeSession).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="empty-table">
                            No trades logged yet. Click "Add Trade" to get started.
                          </td>
                        </tr>
                      ) : (
                        getOrderedTrades(activeSession).map((trade) => (
                          <tr key={trade.id}>
                            <td>{trade.asset}</td>
                            <td>
                              <span className={`side-pill ${trade.side.toLowerCase()}`}>{trade.side}</span>
                            </td>
                            <td>{trade.date}</td>
                            <td>{trade.entryTime}</td>
                            <td>{trade.exitTime}</td>
                            <td className={trade.pnl - trade.fees >= 0 ? 'positive' : 'negative'}>
                              {formatCurrency(trade.pnl - trade.fees)}
                            </td>
                            <td>{trade.confluences.join(', ') || '—'}</td>
                            <td className="comments-cell">{trade.comments || '—'}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleEditTrade(trade);
                                    setShowTradeModal(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button type="button" onClick={() => handleDeleteTrade(trade.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </main>
          ) : null}

          {/* TRADE FORM MODAL */}
          {showTradeModal && activeSession && (
            <div className="modal-overlay" onClick={() => setShowTradeModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingTradeId ? 'Edit Trade' : 'Add Trade'}</h2>
                  <button
                    className="modal-close-btn"
                    onClick={() => {
                      setShowTradeModal(false);
                      setEditingTradeId(null);
                      setTradeForm({ ...emptyTradeForm });
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-grid">
                    <label>
                      Asset
                      <input
                        value={tradeForm.asset}
                        onChange={(event) => setTradeForm((current) => ({ ...current, asset: event.target.value }))}
                        placeholder="ES, NQ, AAPL, EURUSD"
                      />
                    </label>
                    <label>
                      Side
                      <select
                        value={tradeForm.side}
                        onChange={(event) =>
                          setTradeForm((current) => ({ ...current, side: event.target.value as 'Long' | 'Short' }))
                        }
                      >
                        <option value="Long">Long</option>
                        <option value="Short">Short</option>
                      </select>
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={tradeForm.date}
                        onChange={(event) => setTradeForm((current) => ({ ...current, date: event.target.value }))}
                      />
                    </label>
                    <label>
                      Entry time
                      <input
                        type="time"
                        value={tradeForm.entryTime}
                        onChange={(event) => setTradeForm((current) => ({ ...current, entryTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      Exit time
                      <input
                        type="time"
                        value={tradeForm.exitTime}
                        onChange={(event) => setTradeForm((current) => ({ ...current, exitTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      PnL
                      <input
                        type="number"
                        step="0.01"
                        value={tradeForm.pnl}
                        onChange={(event) => setTradeForm((current) => ({ ...current, pnl: event.target.value }))}
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        step="1"
                        value={tradeForm.quantity}
                        onChange={(event) => setTradeForm((current) => ({ ...current, quantity: event.target.value }))}
                      />
                    </label>
                    <label>
                      Fees
                      <input
                        type="number"
                        step="0.01"
                        value={tradeForm.fees}
                        onChange={(event) => setTradeForm((current) => ({ ...current, fees: event.target.value }))}
                      />
                    </label>
                    <label className="full-width">
                      Notes
                      <textarea
                        value={tradeForm.comments}
                        onChange={(event) => setTradeForm((current) => ({ ...current, comments: event.target.value }))}
                        placeholder="Trade thesis, execution notes, mistakes, review comments"
                      />
                    </label>
                  </div>

                  <details className="confluence-picker" open>
                    <summary>Confluences used</summary>
                    <div className="confluence-options">
                      {data.settings.confluenceOptions.length === 0 ? (
                        <p className="empty-copy">Add a confluence preset first.</p>
                      ) : (
                        data.settings.confluenceOptions.map((option) => (
                          <label key={option} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={tradeForm.confluences.includes(option)}
                              onChange={() => handleToggleConfluence(option)}
                            />
                            <span>{option}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </details>
                </div>

                <div className="modal-footer">
                  <button
                    className="primary-button"
                    onClick={() => {
                      handleSaveTrade();
                      setShowTradeModal(false);
                    }}
                  >
                    {editingTradeId ? 'Update Trade' : 'Save Trade'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setShowTradeModal(false);
                      setEditingTradeId(null);
                      setTradeForm({ ...emptyTradeForm });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
