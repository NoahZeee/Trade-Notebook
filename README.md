# Trade Notebook

A polished Electron desktop app for tracking backtest and live trading sessions.

## Run locally

Install dependencies with `npm install`, then launch the desktop app with `npm run dev`.

## Build an executable

Run `npm run dist` to create the Windows installer in `C:\TradeNotebookBuild\release`.

The installer you would share is `C:\TradeNotebookBuild\release\Trade-Notebook-Setup-1.0.0.exe`.

## Current behavior

- Backtest sessions keep trades in entry order so replay logging is preserved exactly as entered.
- Live sessions sort by trade date and time.
- The add-trade form inherits the active session type automatically, so there is no redundant session-type field.
- Trade logs, charts, and controls use a dark theme with readable select styling.

## Features

- Separate backtest and live sessions
- Trade table with PnL, side, dates, entry and exit times, confluences, and notes
- Editable confluence presets
- Session-level stats for total PnL, win rate, wins, and losses
- Running balance chart based on the starting balance