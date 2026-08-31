import { useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

function buildChartData(session: TradeSession) {
  const ordered = getOrderedTrades(session);

  let running = 0;
  return ordered.map((trade, index) => {
    running += trade.pnl - trade.fees;
    return {
      label: `${index + 1}`,
      balance: session.startingBalance + running,
      pnl: running
    };
  });
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
  const stats = useMemo(() => (activeSession ? computeStats(activeSession) : null), [activeSession]);
  const chartData = useMemo(() => (activeSession ? buildChartData(activeSession) : []), [activeSession]);

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
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Trade Notebook</p>
          <h1>Track every session with a sharper workflow.</h1>
          <p>
            Separate backtests and live trades, keep clean stats by session, and review a running balance with a modern
            dark interface.
          </p>
        </div>

        <div className="action-stack">
          <button className="primary-button" type="button" onClick={() => handleCreateSession('Backtest')}>
            New backtest session
          </button>
          <button className="secondary-button" type="button" onClick={() => handleCreateSession('Live')}>
            New live session
          </button>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Sessions</h2>
            <span>{data.sessions.length}</span>
          </div>
          <div className="session-list">
            {data.sessions.length === 0 ? (
              <p className="empty-copy">Create a session to begin logging trades.</p>
            ) : (
              data.sessions.map((session) => {
                const sessionStats = computeStats(session);
                const active = session.id === activeSession?.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`session-card ${active ? 'active' : ''}`}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <div>
                      <strong>{session.name}</strong>
                      <span>{session.type}</span>
                    </div>
                    <div className="session-meta">
                      <span>{session.trades.length} trades</span>
                      <span>{formatCurrency(sessionStats.totalPnL)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Confluence presets</h2>
            <span>{data.settings.confluenceOptions.length}</span>
          </div>
          <div className="preset-row">
            <input
              value={newConfluence}
              onChange={(event) => setNewConfluence(event.target.value)}
              placeholder="Add a preset"
            />
            <button className="secondary-button" type="button" onClick={handleAddConfluenceOption}>
              Add
            </button>
          </div>
          <div className="preset-list">
            {data.settings.confluenceOptions.map((option) => (
              <button key={option} type="button" className="preset-pill" onClick={() => handleRemoveConfluenceOption(option)}>
                {option}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero">
          <div>
            <p className="eyebrow">Session dashboard</p>
            <h2>{activeSession ? activeSession.name : 'No session selected'}</h2>
            <p>
              Log trades, compare sessions, and keep your execution notes aligned with a balanced, high-contrast layout.
            </p>
          </div>
          {activeSession ? (
            <div className="hero-badge">
              <span>{activeSession.type}</span>
              <strong>{formatCurrency(activeSession.startingBalance)}</strong>
              <small>starting balance</small>
            </div>
          ) : null}
        </header>

        {activeSession ? (
          <>
            <section className="stats-grid">
              <article className="stat-card accent">
                <span>Total PnL</span>
                <strong>{formatCurrency(stats?.totalPnL ?? 0)}</strong>
              </article>
              <article className="stat-card">
                <span>Win rate</span>
                <strong>{(stats?.winrate ?? 0).toFixed(1)}%</strong>
              </article>
              <article className="stat-card">
                <span>Wins</span>
                <strong>{stats?.wins ?? 0}</strong>
              </article>
              <article className="stat-card">
                <span>Losses</span>
                <strong>{stats?.losses ?? 0}</strong>
              </article>
            </section>

            <section className="grid two-column">
              <article className="panel form-panel">
                <div className="panel-head">
                  <h2>{editingTradeId ? 'Edit trade' : 'Add trade'}</h2>
                  <span>{activeSession.trades.length}</span>
                </div>

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

                <div className="form-actions">
                  <button className="primary-button" type="button" onClick={handleSaveTrade}>
                    {editingTradeId ? 'Update trade' : 'Save trade'}
                  </button>
                  {editingTradeId ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setEditingTradeId(null);
                        setTradeForm({ ...emptyTradeForm });
                      }}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </article>

              <article className="panel chart-panel">
                <div className="panel-head">
                  <h2>Running balance</h2>
                  <span>{chartData.length} points</span>
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
            </section>

            <section className="panel table-panel">
              <div className="panel-head">
                <h2>Trade log</h2>
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
                          No trades logged yet.
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
                              <button type="button" onClick={() => handleEditTrade(trade)}>
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

            <section className="panel session-controls">
              <div className="panel-head">
                <h2>Session controls</h2>
                <span>Adjust the notebook</span>
              </div>
              <label>
                Session name
                <input
                  value={activeSession.name}
                  onChange={(event) => {
                    const nextSessions = data.sessions.map((session) =>
                      session.id === activeSession.id ? { ...session, name: event.target.value } : session
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
                    const nextSessions = data.sessions.map((session) =>
                      session.id === activeSession.id
                        ? { ...session, startingBalance: Number(event.target.value || 0) }
                        : session
                    );
                    persistSessions(nextSessions, activeSession.id);
                  }}
                />
              </label>
              <button className="danger-button" type="button" onClick={() => handleDeleteSession(activeSession.id)}>
                Delete active session
              </button>
            </section>
          </>
        ) : (
          <section className="panel empty-workspace">
            <h2>No session yet</h2>
            <p>Create a backtest or live session to start logging trades and tracking statistics.</p>
          </section>
        )}
      </main>
    </div>
  );
}