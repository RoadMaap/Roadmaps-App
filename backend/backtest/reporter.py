from __future__ import annotations

import math
import base64
import io
import re
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import mplfinance as mpf
except ImportError:
    mpf = None

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except ImportError:
    matplotlib = None
    plt = None

try:
    from runtime_paths import writable_backend_dir
except ImportError:
    from backend.runtime_paths import writable_backend_dir

try:
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
except Exception:
    go = None
    make_subplots = None


def sanitize_mplfinance_addplots(addplots, plot_df, warnings):
    sanitized = []
    for index, item in enumerate(addplots or []):
        if not isinstance(item, dict) or 'data' not in item:
            warnings.append(f'Skipped addplot {index}: expected an mplfinance addplot dictionary with data.')
            continue

        raw_data = item.get('data')
        if isinstance(raw_data, pd.Series):
            series = raw_data.copy()
        else:
            try:
                series = pd.Series(np.asarray(raw_data).reshape(-1))
            except (TypeError, ValueError):
                warnings.append(f'Skipped addplot {index}: data could not be converted to a series.')
                continue

        if len(series) != len(plot_df):
            if isinstance(raw_data, pd.Series) and isinstance(raw_data.index, pd.DatetimeIndex):
                series = raw_data.reindex(plot_df.index)
            else:
                warnings.append(f'Skipped addplot {index}: data length does not match the plot window.')
                continue

        series = series.replace([np.inf, -np.inf], np.nan)
        if series.empty or series.dropna().empty:
            warnings.append(f'Skipped addplot {index}: data contains no finite values in the plot window.')
            continue

        item = dict(item)
        item['data'] = series
        sanitized.append(item)
    return sanitized


class BacktestReporter:
    def __init__(self, engine):
        self.engine = engine

    @staticmethod
    def _safe_float(value, default=0.0):
        try:
            parsed = float(value)
            return parsed if math.isfinite(parsed) else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _trade_datetime(value):
        if value is None:
            return None
        try:
            return pd.Timestamp(value)
        except (TypeError, ValueError, OverflowError):
            return None

    def _equity_curve(self):
        initial_capital = self._safe_float(self.engine.config.get('initial_capital', 10000.0))
        trades = self._normalized_trades()
        ordered_trades = sorted(
            trades,
            key=lambda trade: self._trade_datetime(trade.get('exit_time')) or pd.Timestamp.min,
        )
        first_time = next(
            (frame.index[0] for frame in self.engine.pure_data.values() if not frame.empty),
            datetime.utcnow(),
        )
        points = [{
            'time': str(first_time),
            'equity': initial_capital,
            'drawdown_pct': 0.0,
            'drawdown_dollar': 0.0,
        }]
        running_equity = initial_capital
        peak_equity = initial_capital
        for trade in ordered_trades:
            running_equity += self._safe_float(trade.get('net_profit'))
            peak_equity = max(peak_equity, running_equity)
            drawdown_dollar = max(peak_equity - running_equity, 0.0)
            points.append({
                'time': str(trade.get('exit_time') or datetime.utcnow()),
                'equity': running_equity,
                'drawdown_pct': (drawdown_dollar / peak_equity * 100.0) if peak_equity > 0 else 0.0,
                'drawdown_dollar': drawdown_dollar,
            })
        last_time = next(
            (frame.index[-1] for frame in self.engine.pure_data.values() if not frame.empty),
            None,
        )
        if last_time is not None and str(last_time) != points[-1]['time']:
            points.append({
                'time': str(last_time),
                'equity': running_equity,
                'drawdown_pct': points[-1]['drawdown_pct'],
                'drawdown_dollar': points[-1]['drawdown_dollar'],
            })
        return points

    def _breakdown(self):
        trades = self._normalized_trades()
        day_pnl = {day: 0.0 for day in range(7)}
        hour_pnl = {hour: 0.0 for hour in range(24)}
        monthly = {}
        by_strategy = {}
        for trade in trades:
            profit = self._safe_float(trade.get('net_profit'))
            entry_time = self._trade_datetime(trade.get('entry_time'))
            exit_time = self._trade_datetime(trade.get('exit_time'))
            if entry_time is not None:
                day_pnl[entry_time.dayofweek] += profit
                hour_pnl[entry_time.hour] += profit
            if exit_time is not None:
                month_key = exit_time.strftime('%Y-%m')
                monthly[month_key] = monthly.get(month_key, 0.0) + profit
            strategy_name = trade.get('strategy', trade.get('strategy_name', trade.get('strategy_id', 'unknown')))
            by_strategy[strategy_name] = by_strategy.get(strategy_name, 0.0) + profit
        return {
            'pnl_by_day': day_pnl,
            'pnl_by_hour': hour_pnl,
            'monthly_pnl': monthly,
            'pnl_by_strategy': by_strategy,
        }

    def _daily_drawdown(self):
        initial_capital = self._safe_float(self.engine.config.get('initial_capital', 10000.0))
        ordered_trades = sorted(
            self._normalized_trades(),
            key=lambda trade: self._trade_datetime(trade.get('exit_time')) or pd.Timestamp.min,
        )
        daily_state = {}
        equity = initial_capital
        for trade in ordered_trades:
            exit_time = self._trade_datetime(trade.get('exit_time'))
            if exit_time is None:
                continue
            key = exit_time.date().isoformat()
            if key not in daily_state:
                daily_state[key] = {'start': equity, 'low': equity}
            equity += self._safe_float(trade.get('net_profit'))
            daily_state[key]['low'] = min(daily_state[key]['low'], equity)
        max_dollar = 0.0
        max_percent = 0.0
        for state in daily_state.values():
            drawdown = max(state['start'] - state['low'], 0.0)
            percent = drawdown / state['start'] * 100.0 if state['start'] > 0 else 0.0
            max_dollar = max(max_dollar, drawdown)
            max_percent = max(max_percent, percent)
        return max_dollar, max_percent

    def _normalized_trades(self):
        normalized = []
        for trade in self.engine.trades:
            item = dict(trade)
            item['net_profit'] = self._safe_float(item.get('net_profit', item.get('dollar_profit')))
            item['strategy'] = item.get('strategy', item.get('strategy_name', item.get('strategy_id', 'unknown')))
            item['lot_size'] = item.get('lot_size', item.get('lot', 0.0))
            normalized.append(item)
        return normalized

    def render_chart_images(self, selected_strategy_id=None):
        if mpf is None or plt is None:
            return [], ['mplfinance or matplotlib is unavailable; candlestick images were not generated.']

        report_warnings = []
        image_records = []
        output_dir = Path(writable_backend_dir()) / 'storage' / 'reports'
        output_dir.mkdir(parents=True, exist_ok=True)

        for asset in self.engine.config.get('assets', []):
            strategy_id = str(asset.get('strategy_id', ''))
            if selected_strategy_id and strategy_id != selected_strategy_id:
                continue
            symbol = str(asset.get('symbol', ''))
            chart_warnings = []
            source_df = self.engine.pure_data.get(strategy_id)
            if source_df is None or source_df.empty:
                chart_warnings.append('No prepared candle data is available for this asset.')
                report_warnings.extend(chart_warnings)
                continue

            plot_df = source_df.tail(1000).copy()
            candle_type = asset.get('candle_type', 'STANDARD')
            if candle_type == 'HEIKIN_ASHI' and 'HA_Open' in plot_df.columns:
                required_ha = ('HA_Open', 'HA_High', 'HA_Low', 'HA_Close')
                if all(column in plot_df.columns for column in required_ha):
                    plot_df['open'] = plot_df['HA_Open']
                    plot_df['high'] = plot_df['HA_High']
                    plot_df['low'] = plot_df['HA_Low']
                    plot_df['close'] = plot_df['HA_Close']
                else:
                    chart_warnings.append('Heikin-Ashi display was skipped because one or more HA columns are missing.')

            plot_df = plot_df.replace([np.inf, -np.inf], np.nan)
            ohlc_columns = ('open', 'high', 'low', 'close')
            missing_ohlc = [column for column in ohlc_columns if column not in plot_df.columns]
            if missing_ohlc:
                chart_warnings.append(f"Chart skipped because OHLC columns are missing: {', '.join(missing_ohlc)}.")
                report_warnings.extend(chart_warnings)
                continue
            plot_df = plot_df.dropna(subset=list(ohlc_columns))
            if plot_df.empty:
                chart_warnings.append('Chart skipped because no complete OHLC candles remain in the plot window.')
                report_warnings.extend(chart_warnings)
                continue

            plot_df['sl_line'] = np.nan
            plot_df['tp_line'] = np.nan
            for trade in self.engine.trades:
                if trade.get('strategy_id') != strategy_id:
                    continue
                entry_time = self._trade_datetime(trade.get('entry_time'))
                exit_time = self._trade_datetime(trade.get('exit_time'))
                if entry_time is None:
                    continue
                if exit_time is None:
                    exit_time = plot_df.index[-1]
                try:
                    mask = (plot_df.index >= entry_time) & (plot_df.index <= exit_time)
                except (TypeError, ValueError):
                    chart_warnings.append(f"Skipped trade overlay with incompatible timestamps for {strategy_id}.")
                    continue
                if mask.any():
                    if trade.get('sl') is not None:
                        plot_df.loc[mask, 'sl_line'] = self._safe_float(trade.get('sl'), np.nan)
                    if trade.get('tp') is not None:
                        plot_df.loc[mask, 'tp_line'] = self._safe_float(trade.get('tp'), np.nan)

            addplots = []
            if not plot_df['sl_line'].dropna().empty:
                addplots.append(mpf.make_addplot(plot_df['sl_line'], color='red', linestyle='--', width=1.5))
            if not plot_df['tp_line'].dropna().empty:
                addplots.append(mpf.make_addplot(plot_df['tp_line'], color='green', linestyle='--', width=1.5))

            marker_specs = (
                ('buy_signal_marker', '^', 'lime', 100),
                ('sell_signal_marker', 'v', 'red', 100),
                ('entry_price_marker', '>', 'blue', 60),
                ('exit_price_marker', '<', 'magenta', 60),
            )
            for marker_column, marker, color, size in marker_specs:
                if marker_column in plot_df.columns and not plot_df[marker_column].dropna().empty:
                    addplots.append(mpf.make_addplot(
                        plot_df[marker_column],
                        type='scatter',
                        marker=marker,
                        color=color,
                        markersize=size,
                    ))

            panel_ratios = None
            strategy = asset.get('strategy')
            if strategy is not None and hasattr(strategy, 'get_plot_addplots'):
                try:
                    result = strategy.get_plot_addplots(plot_df.copy(), addplots, asset)
                    if isinstance(result, tuple):
                        addplots = result[0]
                        panel_ratios = result[1] if len(result) > 1 else None
                    else:
                        addplots = result
                except Exception as exc:
                    chart_warnings.append(f'Strategy plot addplots failed: {exc}')

            addplots = sanitize_mplfinance_addplots(addplots, plot_df, chart_warnings)
            active_panels = {0}
            valid_panels = []
            for addplot in addplots:
                try:
                    panel = int(addplot.get('panel', 0))
                except (TypeError, ValueError):
                    chart_warnings.append('Skipped addplot with an invalid panel number.')
                    continue
                if panel < 0:
                    chart_warnings.append('Skipped addplot with a negative panel number.')
                    continue
                active_panels.add(panel)
                valid_panels.append(addplot)
            addplots = valid_panels

            plot_kwargs = {
                'type': 'candle',
                'style': 'binance',
                'title': f'{strategy_id} on {symbol}',
                'ylabel': 'Price',
                'volume': False,
                'figratio': (12, 8),
                'warn_too_much_data': 2000,
                'returnfig': True,
            }
            if addplots:
                plot_kwargs['addplot'] = addplots
            if active_panels != {0}:
                required_count = len(active_panels)
                supplied_ratios = list(panel_ratios) if isinstance(panel_ratios, (tuple, list)) else []
                if len(supplied_ratios) != required_count:
                    supplied_ratios = [6] + [1] * (required_count - 1)
                plot_kwargs['panel_ratios'] = tuple(supplied_ratios)

            figure = None
            try:
                figure, _ = mpf.plot(plot_df, **plot_kwargs)
                safe_strategy = re.sub(r'[^A-Za-z0-9_.-]+', '_', strategy_id).strip('._') or 'strategy'
                safe_symbol = re.sub(r'[^A-Za-z0-9_.-]+', '_', symbol).strip('._') or 'symbol'
                output_path = output_dir / f'{safe_strategy}_{safe_symbol}.png'
                payload_path = output_dir / f'{safe_strategy}_{safe_symbol}_mpl_payload.pkl'
                if addplots:
                    plot_kwargs['addplot'] = addplots
                buffer = io.BytesIO()
                figure.savefig(buffer, format='png', dpi=180, bbox_inches='tight', facecolor=figure.get_facecolor())
                image_base64 = base64.b64encode(buffer.getvalue()).decode('ascii')
                output_path.write_bytes(buffer.getvalue())
                with payload_path.open('wb') as payload_file:
                    pickle.dump({
                        'plot_df': plot_df,
                        'ap': addplots,
                        'plot_kwargs': plot_kwargs,
                    }, payload_file, protocol=pickle.HIGHEST_PROTOCOL)
                image_records.append({
                    'strategy_id': strategy_id,
                    'symbol': symbol,
                    'timeframe': asset.get('timeframe', ''),
                    'candle_type': candle_type,
                    'trades_count': sum(1 for trade in self.engine.trades if trade.get('strategy_id') == strategy_id),
                    'image_base64': f'data:image/png;base64,{image_base64}',
                    'file_path': str(output_path),
                    'payload_path': str(payload_path),
                    'warnings': chart_warnings,
                })
                report_warnings.extend(chart_warnings)
            except Exception as exc:
                chart_warnings.append(f'mplfinance rendering failed: {exc}')
                report_warnings.extend(chart_warnings)
            finally:
                if figure is not None:
                    plt.close(figure)

        return image_records, report_warnings

    @staticmethod
    def _stability_score(points):
        values = [point['equity'] for point in points]
        if len(values) < 2:
            return 0.0
        x_values = list(range(len(values)))
        x_mean = sum(x_values) / len(x_values)
        y_mean = sum(values) / len(values)
        denominator = sum((value - x_mean) ** 2 for value in x_values)
        if denominator == 0:
            return 0.0
        slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, values)) / denominator
        intercept = y_mean - slope * x_mean
        residual_sum = sum((value - (intercept + slope * x)) ** 2 for x, value in zip(x_values, values))
        total_sum = sum((value - y_mean) ** 2 for value in values)
        if total_sum == 0:
            return 0.0
        return max(0.0, min(100.0, (1.0 - residual_sum / total_sum) * 100.0))

    def build_report(self):
        initial_capital = self._safe_float(self.engine.config.get('initial_capital', 10000.0))
        final_equity = self._safe_float(self.engine.current_equity, initial_capital)
        net_profit = final_equity - initial_capital
        trades = self._normalized_trades()
        main_trades = [trade for trade in trades if 'partial' not in str(trade.get('exit_reason', '')).lower()]
        profits = [self._safe_float(trade.get('net_profit')) for trade in trades]
        wins = [profit for profit in profits if profit > 0]
        losses = [profit for profit in profits if profit < 0]
        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = gross_profit / gross_loss if gross_loss else (999.99 if gross_profit > 0 else 0.0)
        win_count = sum(1 for trade in main_trades if self._safe_float(trade.get('net_profit')) > 0)
        win_rate = win_count / len(main_trades) * 100.0 if main_trades else 0.0
        avg_win = sum(wins) / len(wins) if wins else 0.0
        avg_loss = sum(losses) / len(losses) if losses else 0.0
        equity_curve = self._equity_curve()
        max_drawdown_dollar = max((point['drawdown_dollar'] for point in equity_curve), default=0.0)
        max_drawdown_pct = max((point['drawdown_pct'] for point in equity_curve), default=0.0)
        max_daily_dd_dollar, max_daily_dd_pct = self._daily_drawdown()
        total_commission = sum(self._safe_float(trade.get('commission')) for trade in trades)
        summary = {
            'initial_capital': initial_capital,
            'final_equity': final_equity,
            'net_profit': net_profit,
            'net_profit_pct': (net_profit / initial_capital) * 100.0 if initial_capital else 0.0,
            'total_trades': len(main_trades),
            'total_trade_events': len(trades),
            'partial_closes': len(trades) - len(main_trades),
            'win_rate': win_rate,
            'profit_factor': profit_factor,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'max_drawdown_pct': max_drawdown_pct,
            'max_drawdown_dollar': max_drawdown_dollar,
            'max_daily_dd_pct': max_daily_dd_pct,
            'max_daily_dd_dollar': max_daily_dd_dollar,
            'total_commission': total_commission,
            'stability_score': self._stability_score(equity_curve),
            'candles_processed': int(getattr(
                self.engine,
                'candles_processed',
                sum(len(frame) for frame in getattr(self.engine, 'pure_data', {}).values()),
            )),
        }
        json_trades = []
        for trade in trades:
            json_trades.append({
                **trade,
                'entry_time': str(trade.get('entry_time', '')),
                'exit_time': str(trade.get('exit_time', '')),
                'net_profit': self._safe_float(trade.get('net_profit')),
                'commission': self._safe_float(trade.get('commission')),
            })
        chart_images, chart_warnings = self.render_chart_images()
        return {
            'summary': summary,
            'equity_curve': equity_curve,
            'breakdowns': self._breakdown(),
            'trades': json_trades,
            'chart_images': chart_images,
            'chart_warnings': chart_warnings,
        }

    def export_plotly_html(self, file_path=None):
        if go is None or make_subplots is None:
            return None
        report = self.build_report()
        fig = make_subplots(rows=2, cols=1, shared_xaxes=True, vertical_spacing=0.06, subplot_titles=('Equity Curve', 'Drawdown'))
        equity = [point['equity'] for point in report['equity_curve']]
        timestamps = [point['time'] for point in report['equity_curve']]
        drawdown = [point['drawdown_pct'] for point in report['equity_curve']]
        fig.add_trace(go.Scatter(x=timestamps, y=equity, name='Equity', fill='tozeroy'), row=1, col=1)
        fig.add_trace(go.Scatter(x=timestamps, y=drawdown, name='Drawdown', fill='tozeroy'), row=2, col=1)
        fig.update_layout(template='plotly_dark', title='Backtest Lab Report')
        output_path = file_path or 'report.html'
        fig.write_html(output_path)
        return output_path