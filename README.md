# Trade Notebook

A polished Electron desktop app for tracking backtest and live trading sessions.

## Run locally

Install dependencies with `npm install`, then launch the desktop app with `npm run dev`.

## Build an executable

The repository includes the built installer at [release/Trade-Notebook-Setup-1.0.0.exe](release/Trade-Notebook-Setup-1.0.0.exe).

If you rebuild it locally, `npm run dist` will create the Windows installer in `C:\TradeNotebookBuild\release`.

The installer you would share from the repo is [release/Trade-Notebook-Setup-1.0.0.exe](release/Trade-Notebook-Setup-1.0.0.exe).

## Current behavior

- Backtest sessions keep trades in entry order so replay logging is preserved exactly as entered.
- Live sessions sort by trade date and time.
- Calendar, weekly totals, and daily/weekly/monthly trend analytics are shown only for Live sessions because Backtest dates are not chronological.
- Backtest sessions label their account high, low, and drawdown as replay metrics based on trade entry order.
- The add-trade form inherits the active session type automatically, so there is no redundant session-type field.
- Trade logs, charts, and controls use a dark theme with readable select styling.

## Features

- Separate backtest and live sessions
- Trade table with PnL, side, dates, entry and exit times, confluences, and notes
- Editable confluence presets
- Session-level stats for total PnL, win rate, wins, losses, average winner/loser, average W/L ratio, best/worst trade, account high/low, and maximum drawdown
- Live-session daily PnL calendar with weekly totals
- Live-session daily, weekly, and monthly PnL trend charts
- Running balance chart based on the starting balance
