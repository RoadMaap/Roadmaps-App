# ==============================================================================
# ULTIMATE MULTI-ASSET BACKTEST ENGINE
# Version: 3.9 (Absolute Precision, Isolated Compute & Dynamic Lookback)
# ==============================================================================

import os
import sys
import pandas as pd
import numpy as np
from datetime import time, datetime, timedelta
import traceback
import webbrowser

try:
    import pandas_ta as ta
except ImportError:
    ta = None

try:
    import mplfinance as mpf
except ImportError:
    mpf = None

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

try:
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    import plotly.colors as pc
except ImportError:
    print("❌ Library 'plotly' not found. Please install it: pip install plotly")

# ==============================================================================
# 1. SYSTEM PATH INJECTION (Dynamic Routing to Root)
# ==============================================================================
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# ==============================================================================
# 2. LOCAL MODULE IMPORTS
# ==============================================================================
try:
    from trading.margin_calculator import MarginManager
    from core.error_handler import StrategyValidator
except ImportError:
    from backend.trading.margin_calculator import MarginManager
    from backend.core.error_handler import StrategyValidator

class LookaheadBiasError(Exception):
    pass
# ==============================================================================
# 1. ConfigValidator
# ==============================================================================
class ConfigValidator:
    def __init__(self, config):
        self.config = config

    def validate(self):
        print("🕵️  ConfigValidator: Checking parameters...")
        if 'initial_capital' not in self.config: raise ValueError("Config Error: 'initial_capital' is missing.")
        if not self.config.get('assets'): raise ValueError("Config Error: A non-empty list of 'assets' must be provided.")
        
        strategy_ids = []
        for asset in self.config['assets']:
            if 'strategy_id' not in asset: raise ValueError(f"Config Error: Asset missing 'strategy_id'.")
            if asset['strategy_id'] in strategy_ids: raise ValueError(f"Config Error: Duplicate strategy_id '{asset['strategy_id']}'.")
            strategy_ids.append(asset['strategy_id'])
            
            if 'tick_size' not in asset:
                asset['tick_size'] = 0.01
            
            if 'MONEY_MANAGEMENT_MODE' not in asset:
                print(f"⚠️ Warning: Asset '{asset['symbol']}' has no risk config.")
        
        print("✅ ConfigValidator: Passed.")

# ==============================================================================
# 2. DataLoader
# ==============================================================================
class DataLoader:
    def __init__(self, config):
        self.config = config

    def load_and_merge(self):
        print("⏳ DataLoader: Loading and merging data...")
        loaded_data = {}
        
        for asset_info in self.config['assets']:
            path = asset_info['csv_file_path']
            if path in loaded_data: continue
            try:
                df = pd.read_csv(path, sep='\t')
                df.columns = df.columns.str.lower().str.replace('<', '').str.replace('>', '')
                df['time_dt'] = pd.to_datetime(df['date'] + ' ' + df['time'])
                df.set_index('time_dt', inplace=True); df.index.name = 'time'
                
                if 'tickvol' in df.columns: df.rename(columns={'tickvol': 'volume'}, inplace=True)
                elif 'vol' in df.columns: df.rename(columns={'vol': 'volume'}, inplace=True)
                if 'volume' not in df.columns: df['volume'] = 0
                
                if 'spread' in df.columns: 
                    df['spread'] /= asset_info.get('spread_divisor', 1.0)
                else:
                    df['spread'] = 0.0
                
                loaded_data[path] = df[['open', 'high', 'low', 'close', 'spread', 'volume']]
            except Exception as e: raise IOError(f"❌ Error loading '{path}': {e}")
        
        prefixed_dfs = []
        for asset_info in self.config['assets']:
            symbol, path = asset_info['symbol'], asset_info['csv_file_path']
            prefixed_dfs.append(loaded_data[path].add_prefix(f"{symbol}_"))
        
        merged_df = pd.concat(prefixed_dfs, axis=1, join='outer').sort_index()
        merged_df = merged_df.loc[:, ~merged_df.columns.duplicated()]
        
        if 'start_date' in self.config: 
            merged_df = merged_df[merged_df.index >= pd.to_datetime(self.config['start_date'])]
            
        print("✅ DataLoader: Data merged successfully.")
        return merged_df

# ==============================================================================
# 3. SecurityGuard
# ==============================================================================
class SecurityGuard:
    def __init__(self, config):
        self.config = config

    def get_safe_history_slice(self, history_slice):
        if not self.config.get('STRICT_LOOKAHEAD_PROTECTION', True): return history_slice

        safe_slice = history_slice.copy()
        if safe_slice.empty: return safe_slice
        
        last_idx = safe_slice.index[-1]
        current_open = safe_slice.at[last_idx, 'open']
        
        safe_slice.at[last_idx, 'high'] = current_open
        safe_slice.at[last_idx, 'low'] = current_open
        safe_slice.at[last_idx, 'close'] = current_open
        safe_slice.at[last_idx, 'volume'] = 0 
        
        if 'HA_Close' in safe_slice.columns and 'HA_Open' in safe_slice.columns:
            current_ha_open = safe_slice.at[last_idx, 'HA_Open']
            safe_slice.at[last_idx, 'HA_High'] = current_ha_open
            safe_slice.at[last_idx, 'HA_Low'] = current_ha_open
            safe_slice.at[last_idx, 'HA_Close'] = current_ha_open

        return safe_slice

    def audit_signal_integrity(self, strategy_id, entry_price, current_real_candle):
        tolerance = 1e-9 
        real_close = current_real_candle['close']
        real_open = current_real_candle['open']
        
        if abs(entry_price - real_close) < tolerance and abs(real_close - real_open) > tolerance:
            msg = f"\n🚨 CRITICAL SECURITY ALERT [{strategy_id}]: Entry Price ({entry_price}) matches Future CLOSE exactly!"
            if self.config.get('STRICT_LOOKAHEAD_PROTECTION', True): raise LookaheadBiasError(msg)
            else: print(msg)

    def audit_indicators(self, original_df, df_with_indicators):
        future_df = pd.DataFrame(index=original_df.index)
        future_df['future_return'] = original_df['close'].pct_change().shift(-1)
        indicator_cols = list(set(df_with_indicators.columns) - set(original_df.columns))
        valid_indicators = [c for c in indicator_cols if pd.api.types.is_numeric_dtype(df_with_indicators[c])]
        
        if not valid_indicators: return

        audit_df = df_with_indicators[valid_indicators].join(future_df).dropna()
        if audit_df.empty: return

        threshold = self.config.get('LOOKAHEAD_AUDIT_THRESHOLD', 0.99)
        for col in valid_indicators:
            corr = abs(audit_df[col].corr(audit_df['future_return']))
            if corr > threshold:
                print(f"⚠️ Warning: Indicator '{col}' correlates {corr:.4f} with FUTURE returns.")

# ==============================================================================
# 4. SignalEngine
# ==============================================================================
class SignalEngine:
    def __init__(self, backtester):
        self.bt = backtester
        self.security = backtester.security_guard

    def process_all_assets(self, current_time_dt):
        current_time = current_time_dt.time()
        current_day = current_time_dt.dayofweek
        
        self.bt.margin_manager.update_account_limits(self.bt.current_equity)

        for asset_config in self.bt.config['assets']:
            strategy_id = asset_config['strategy_id']
            symbol = asset_config['symbol']
            
            if any(p['strategy_id'] == strategy_id for p in self.bt.positions): continue
            if current_time_dt < self.bt.lockout_until.get(strategy_id, pd.Timestamp(0)): continue
            if current_day not in asset_config.get('allowed_days', range(7)): continue
            
            if killzones := asset_config.get('killzones'):
                is_in_killzone = any((s <= current_time < e) if s <= e else (current_time >= s or current_time < e) for s, e in killzones)
                if not is_in_killzone: continue

            pure_df = self.bt.pure_data[strategy_id]
            ptr = self.bt.pointers[strategy_id]
            
            if ptr >= len(pure_df) or pure_df.index[ptr] != current_time_dt: 
                continue
            
            strat_lookback = asset_config.get('lookback_period', self.bt.lookback)
            if ptr < strat_lookback: 
                continue
            
            asset_slice = pure_df.iloc[ptr - strat_lookback : ptr + 1]
            
            safe_slice = self.security.get_safe_history_slice(asset_slice)
            signal = asset_config['strategy'].check_entry_signal(safe_slice)
            trade_type, entry, sl, tp = StrategyValidator.normalize_entry_signal(signal)
            
            if trade_type:
                self.security.audit_signal_integrity(strategy_id, entry, asset_slice.iloc[-1])
                
                tick_sz = asset_config['tick_size']
                contract_sz = asset_config['contract_size']
                
                entry = self.bt.round_tick(entry, tick_sz)
                sl = self.bt.round_tick(sl, tick_sz)
                tp = self.bt.round_tick(tp, tick_sz)
                
                raw_lot = self._calculate_position_size(asset_config, trade_type, entry, sl, tp, asset_slice)
                desired_lot = self.bt.normalize_volume(raw_lot)
                
                if desired_lot > 0:
                    current_used_margin = sum([
                        self.bt.margin_manager.calculate_margin(
                            p['symbol'], p['lot_size'], p['entry_price'], 
                            next(a['contract_size'] for a in self.bt.config['assets'] if a['symbol'] == p['symbol'])
                        ) for p in self.bt.positions
                    ])

                    safe_lot, trade_margin = self.bt.margin_manager.get_safe_lot_size(
                        current_used_margin, symbol, desired_lot, entry, contract_sz
                    )
                    final_lot = self.bt.normalize_volume(safe_lot)

                    if final_lot > 0:
                        self.bt.open_position({
                            'strategy_id': strategy_id, 'symbol': symbol, 'type': trade_type,
                            'entry_price': entry, 'sl': sl, 'tp': tp, 'lot_size': final_lot,
                            'entry_time': current_time_dt, 'entry_spread': asset_slice.iloc[-2].get('spread', 0),
                            'strategy_name': asset_config['strategy'].__class__.__name__,
                            'margin_used': trade_margin
                        })

    def _calculate_position_size(self, asset_config, trade_type, entry, sl, tp, asset_slice):
        current_candle = asset_slice.iloc[-1]
        context = {
            'equity': self.bt.current_equity,
            'trade_type': trade_type, 'entry_price': entry, 'stop_loss': sl, 'take_profit': tp,
            'history_slice': asset_slice, 'current_candle': current_candle,
            'config': asset_config, 'trades': self.bt.trades
        }
        
        lot_size = 0.0
        risk_rules = asset_config.get('MONEY_MANAGEMENT_MODE', [])
        if isinstance(risk_rules, list) and risk_rules:
            for rule in risk_rules:
                if hasattr(rule, 'calculate_risk_details'):
                    res = rule.calculate_risk_details(context)
                    if res:
                        if isinstance(res, list): res = res[0]
                        if 'lot_size' in res: lot_size = res['lot_size']
        
        lot_size = self.bt.normalize_volume(lot_size)
        return lot_size

# ==============================================================================
# 5. PositionManager 
# ==============================================================================
class PositionManager:
    def __init__(self, backtester):
        self.bt = backtester

    def manage_all_positions(self, current_time_dt):
        for position in self.bt.positions[:]:
            strategy_id = position['strategy_id']
            asset_config = next((a for a in self.bt.config['assets'] if a['strategy_id'] == strategy_id), None)
            if not asset_config: continue
            
            pure_df = self.bt.pure_data[strategy_id]
            ptr = self.bt.pointers[strategy_id]
            
            if ptr >= len(pure_df) or pure_df.index[ptr] != current_time_dt: 
                continue
            
            strat_lookback = asset_config.get('lookback_period', self.bt.lookback)
            if ptr < strat_lookback: 
                continue
            
            asset_slice = pure_df.iloc[ptr - strat_lookback : ptr + 1]
            current_asset_candle = asset_slice.iloc[-1]
            
            curr_h = current_asset_candle['high']
            curr_l = current_asset_candle['low']

            risk_rules = asset_config.get('MONEY_MANAGEMENT_MODE', [])
            if isinstance(risk_rules, list):
                for rule in risk_rules:
                    if hasattr(rule, 'update_sl'):
                        context = {
                            'position': position, 'current_candle': current_asset_candle,
                            'history_slice': asset_slice, 'config': asset_config
                        }
                        new_sl = rule.update_sl(context)
                        if new_sl:
                            position['sl'] = self.bt.round_tick(new_sl, asset_config.get('tick_size', 0.01))
                    
                    if hasattr(rule, 'check_partial_exit'):
                        context = {
                            'position': position, 'current_candle': current_asset_candle,
                            'history_slice': asset_slice, 'config': asset_config
                        }
                        lot_to_close = rule.check_partial_exit(context)
                        if lot_to_close:
                            lot_to_close = self.bt.normalize_volume(lot_to_close)
                            current_lot = position['lot_size']
                            remaining_lot = round(current_lot - lot_to_close, 2)
                            
                            if (lot_to_close >= 0.01) and (remaining_lot >= 0.01) and (lot_to_close < current_lot):
                                self.bt.execute_partial_close(position, lot_to_close, current_asset_candle, asset_config, current_time_dt)

            # ... code related to partial close and trailing stop ...

            exit_price, exit_reason = None, None
            strategy = asset_config['strategy']
            
            spread_val = 0.0
            if 'spread' in current_asset_candle:
                 spread_val = current_asset_candle['spread'] * asset_config.get('point_value', 1.0)

            if hasattr(strategy, 'check_exit_conditions'):
                exit_price, exit_reason = strategy.check_exit_conditions(current_asset_candle, asset_slice, position)

            # Apply the reference gap-slippage simulation.
            if not exit_price:
                curr_o = current_asset_candle['open'] # get candle open price
                curr_h = current_asset_candle['high']
                curr_l = current_asset_candle['low']
                
                pos_type = position['type']
                p_sl = position['sl']
                p_tp = position['tp']

                if pos_type == 'buy':
                    # 1. Check for severe negative gap (skipping stop loss)
                    if curr_o < p_sl: 
                        exit_price, exit_reason = curr_o, 'Stop Loss (Gap Slippage)'
                    # 2. Check for large positive gap (skipping target)
                    elif curr_o > p_tp: 
                        exit_price, exit_reason = curr_o, 'Take Profit (Positive Gap)'
                    # 3. Normal market case
                    elif curr_l <= p_sl: 
                        exit_price, exit_reason = p_sl, 'Stop Loss'
                    elif curr_h >= p_tp: 
                        exit_price, exit_reason = p_tp, 'Take Profit'

                elif pos_type == 'sell':
                    ask_open = curr_o + spread_val
                    ask_high = curr_h + spread_val
                    ask_low  = curr_l + spread_val

                    # 1. Check for severe positive gap (skipping stop loss)
                    if ask_open > p_sl: 
                        exit_price, exit_reason = ask_open, 'Stop Loss (Gap Slippage)'
                    # 2. Check for large negative gap (skipping target)
                    elif ask_open < p_tp: 
                        exit_price, exit_reason = ask_open, 'Take Profit (Positive Gap)'
                    # 3. Normal market case
                    elif ask_high >= p_sl: 
                        exit_price, exit_reason = p_sl, 'Stop Loss (Spread)'
                    elif ask_low <= p_tp: 
                        exit_price, exit_reason = p_tp, 'Take Profit'

            if exit_price:
                self.bt.close_position(position, exit_price, exit_reason, current_time_dt, asset_config)

# ==============================================================================
# 6. Reporter
# ==============================================================================
class Reporter:
    def __init__(self, backtester):
        self.bt = backtester
        self.version = backtester.version

    def generate_report(self, plot_trades=True):
        if not self.bt.trades:
            print("\n⚠️ No trades were executed.")
            return

        results_df = pd.DataFrame(self.bt.trades)
        results_df['entry_time'] = pd.to_datetime(results_df['entry_time'])
        results_df['exit_time'] = pd.to_datetime(results_df['exit_time'])

        initial_cap = self.bt.config['initial_capital']
        results_df['dollar_profit'] = pd.to_numeric(results_df['dollar_profit'])
        results_df['commission'] = pd.to_numeric(results_df.get('commission', 0))
        results_df['spread_cost'] = pd.to_numeric(results_df.get('spread_cost', 0))

        main_trades = results_df[results_df['exit_reason'] != 'Partial Close']
        count_main = len(main_trades)
        count_partial = len(results_df) - count_main

        total_pnl = results_df['dollar_profit'].sum()
        total_commission = results_df['commission'].sum()
        total_pct = (total_pnl / initial_cap) * 100
        
        wins = main_trades[main_trades['dollar_profit'] > 0]
        win_rate = (len(wins) / count_main) * 100 if count_main > 0 else 0
        
        gross_profit = results_df[results_df['dollar_profit'] > 0]['dollar_profit'].sum()
        gross_loss = abs(results_df[results_df['dollar_profit'] <= 0]['dollar_profit'].sum())
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 999.99
        
        all_wins = results_df[results_df['dollar_profit'] > 0]
        all_losses = results_df[results_df['dollar_profit'] <= 0]
        avg_win = all_wins['dollar_profit'].mean() if not all_wins.empty else 0
        avg_loss = all_losses['dollar_profit'].mean() if not all_losses.empty else 0
        
        results_df.sort_values('exit_time', inplace=True)
        results_df['equity'] = initial_cap + results_df['dollar_profit'].cumsum()
        results_df['peak'] = results_df['equity'].cummax()
        results_df['drawdown_dollar'] = results_df['peak'] - results_df['equity']
        results_df['drawdown_pct'] = (results_df['drawdown_dollar'] / results_df['peak']) * 100
        max_dd_pct = results_df['drawdown_pct'].max()
        max_dd_dollar = results_df['drawdown_dollar'].max()

        results_df['date'] = results_df['exit_time'].dt.date
        daily_close_equity = results_df.groupby('date')['equity'].last()
        sod_equity = daily_close_equity.shift(1).fillna(initial_cap)
        daily_low_equity = results_df.groupby('date')['equity'].min()
        
        daily_dd_dollar = (sod_equity - daily_low_equity).clip(lower=0)
        daily_dd_pct = (daily_dd_dollar / sod_equity) * 100
        max_daily_dd_pct = daily_dd_pct.max() if not daily_dd_pct.empty else 0.0
        max_daily_dd_dollar = daily_dd_dollar.max() if not daily_dd_dollar.empty else 0.0

        if self.bt.config.get('print_trade_log', False):
            pd.set_option('display.max_columns', None); pd.set_option('display.width', 1000)
            log_cols = ['strategy_id', 'symbol', 'entry_time', 'exit_time', 'type', 'lot_size', 'entry_price', 'exit_price', 'sl', 'tp', 'commission', 'dollar_profit', 'exit_reason']
            display_cols = [c for c in log_cols if c in results_df.columns]
            log_df = results_df[display_cols].copy()
            for col in ['entry_price', 'exit_price', 'sl', 'tp', 'dollar_profit']:
                if col in log_df.columns: 
                    log_df[col] = log_df[col].apply(lambda x: f"{x:.2f}")
            print("\n--- 📜 TRADE LOG (Last 10) ---")
            print(log_df.tail(10))
            print("--- END LOG ---\n")

        print(f"\n--- 📊 Final Report ({self.version}) ---")
        print(f"Total Profit:      ${total_pnl:,.2f} ({total_pct:.2f}%)")
        print(f"Avg Win / Loss:    ${avg_win:,.2f} / ${avg_loss:,.2f}")
        print(f"Total Trades:      {count_main} (Partials: {count_partial})")
        print(f"Win Rate:          {win_rate:.2f}% | PF: {profit_factor:.2f}")
        print(f"Max Drawdown:      {max_dd_pct:.2f}% (${max_dd_dollar:,.2f})")
        
        if plot_trades:
            self._plot_all_asset_charts()
            self._plot_portfolio_dashboard(
                results_df, initial_cap, total_pnl, total_pct, count_main, count_partial, 
                win_rate, profit_factor, max_dd_pct, max_dd_dollar, 
                max_daily_dd_pct, max_daily_dd_dollar, avg_win, avg_loss, total_commission
            )

    def _plot_all_asset_charts(self):
        from .reporter import BacktestReporter
        BacktestReporter(self.bt).render_chart_images()

    def _plot_single_mpl_chart(self, asset_config):
        from .reporter import BacktestReporter
        BacktestReporter(self.bt).render_chart_images(asset_config.get('strategy_id'))

    def _get_config_table_data(self):
            cfg = self.bt.config
            data = []
            mm_str = ""
            risk_rules = cfg['assets'][0].get('MONEY_MANAGEMENT_MODE', [])
            if risk_rules:
                for rule in risk_rules:
                    name = rule.__class__.__name__.replace("Rule", "").replace("Handler", "")
                    params = str(rule.__dict__).replace("{", "(").replace("}", ")").replace("'", "")
                    mm_str += f"• {name}{params}<br>"
            data.append(["Money Management", mm_str])
            data.append(["Candle Type", cfg['assets'][0].get('candle_type', 'STANDARD')])
            days_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
            allowed = cfg['assets'][0].get('allowed_days', [])
            allowed_str = ", ".join([days_map.get(d, str(d)) for d in allowed])
            data.append(["Allowed Days", allowed_str])
            kz = cfg['assets'][0].get('killzones', [])
            kz_str = "<br>".join([f"{s.strftime('%H:%M')}-{e.strftime('%H:%M')}" for s, e in kz])
            data.append(["Killzones", kz_str if kz_str else "None"])
            return data

    def _plot_portfolio_dashboard(self, results_df, initial_capital, total_pnl, total_pct, 
                                  count_main, count_partial, win_rate, profit_factor, 
                                  max_dd_pct, max_dd_dollar, max_daily_dd_pct, max_daily_dd_dollar, 
                                  avg_win, avg_loss, total_commission):
            try:
                print("\n⏳ Generating Portfolio Dashboard HTML...")
                stats_header = ['Metric', 'Value']
                stats_values = [
                    ['Initial Capital', 'Final Equity', 'Net Profit', 
                     'Total Trades', 'Partial Events', 'Total Commission', 
                     'Win Rate', 'Profit Factor', 
                     'Avg Win', 'Avg Loss', 
                     'Max Drawdown', 'Max Daily Drawdown'],
                    [f"${initial_capital:,.2f}", f"${results_df['equity'].iloc[-1]:,.2f}", 
                     f"${total_pnl:,.2f} ({total_pct:.2f}%)", 
                     f"{count_main}", f"{count_partial}", f"${total_commission:,.2f}", 
                     f"{win_rate:.2f}%", f"{profit_factor:.2f}", 
                     f"${avg_win:,.2f}", f"${avg_loss:,.2f}", 
                     f"{max_dd_pct:.2f}% (${max_dd_dollar:,.0f})", 
                     f"{max_daily_dd_pct:.2f}% (${max_daily_dd_dollar:,.0f})"]
                ]
                config_data = self._get_config_table_data()
                config_header = ['Parameter', 'Setting']
                config_values = [[row[0] for row in config_data], [row[1] for row in config_data]]

                pnl_by_strat_sum = results_df.groupby('strategy_id')['dollar_profit'].sum()
                winning_strats = pnl_by_strat_sum[pnl_by_strat_sum > 0]
                losing_strats = pnl_by_strat_sum[pnl_by_strat_sum <= 0].abs()
                all_strats = pd.concat([winning_strats, losing_strats])
                colors_donut = [pc.sequential.Greens_r[i % len(pc.sequential.Greens_r)] for i in range(len(winning_strats))] + \
                               [pc.sequential.Reds_r[i % len(pc.sequential.Reds_r)] for i in range(len(losing_strats))]

                results_df['entry_day'] = results_df['entry_time'].dt.day_name()
                day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                pnl_by_day = results_df.groupby('entry_day')['dollar_profit'].sum().reindex(day_order).fillna(0)
                results_df['hour'] = results_df['entry_time'].dt.hour
                pnl_by_hour = results_df.groupby('hour')['dollar_profit'].sum().reindex(range(24)).fillna(0)
                results_df['month'] = results_df['exit_time'].dt.to_period('M')
                monthly_pnl = results_df.groupby('month')['dollar_profit'].sum()
                monthly_index = monthly_pnl.index.astype(str)
                
                log_cols = ['strategy_id', 'symbol', 'entry_time', 'exit_time', 'type', 'lot_size', 'entry_price', 'exit_price', 'commission', 'dollar_profit', 'exit_reason']
                df_log = results_df[log_cols].copy()
                df_log['entry_time'] = df_log['entry_time'].dt.strftime('%Y-%m-%d %H:%M')
                df_log['exit_time'] = df_log['exit_time'].dt.strftime('%Y-%m-%d %H:%M')
                for col in ['entry_price', 'exit_price', 'dollar_profit', 'commission']:
                    df_log[col] = df_log[col].apply(lambda x: f"{x:,.2f}")

                if len(df_log) > 20:
                    final_log_head = df_log.head(10); final_log_tail = df_log.tail(10)
                else:
                    final_log_head = df_log; final_log_tail = pd.DataFrame()
                
                fig = make_subplots(
                    rows=8, cols=2,
                    specs=[
                        [{"colspan": 2, "type": "table"}, None],
                        [{"colspan": 2, "type": "table"}, None],
                        [{"colspan": 2}, None],
                        [{"colspan": 2}, None],
                        [{}, {}],
                        [{"type": "domain"}, {}],
                        [{"colspan": 2, "type": "table"}, None],
                        [{"colspan": 2, "type": "table"}, None]
                    ],
                    subplot_titles=("Summary Statistics", "Configuration", "Portfolio Equity Curve", "Drawdown (%)", "PnL by Entry Day", "PnL by Hour", "PnL by Strategy", "Monthly PnL", "Trade Log (First 10)", "Trade Log (Last 10)"),
                    vertical_spacing=0.06,
                    row_heights=[0.15, 0.20, 0.12, 0.10, 0.12, 0.12, 0.12, 0.12]
                )

                fig.add_trace(go.Table(
                    header=dict(values=stats_header, fill_color='#2a2e39', font=dict(color='white', size=12)),
                    cells=dict(values=stats_values, fill_color='#1e222d', font=dict(color='white', size=12), height=30)
                ), row=1, col=1)
                
                fig.add_trace(go.Table(
                    columnwidth=[1, 4],
                    header=dict(values=config_header, fill_color='#2a2e39', font=dict(color='white', size=12)), 
                    cells=dict(values=config_values, fill_color='#1e222d', font=dict(color='#cfd8dc', size=11), align='left', height=30)
                ), row=2, col=1)

                fig.add_trace(go.Scatter(x=results_df['exit_time'], y=results_df['equity'], mode='lines', name='Equity', line=dict(color='#2962FF', width=2)), row=3, col=1)
                fig.add_trace(go.Scatter(x=results_df['exit_time'], y=results_df['drawdown_pct'], fill='tozeroy', name='Drawdown', line=dict(color='#FF5252')), row=4, col=1)
                
                colors_day = ['#00E676' if x >= 0 else '#FF5252' for x in pnl_by_day.values]
                fig.add_trace(go.Bar(x=pnl_by_day.index, y=pnl_by_day.values, marker_color=colors_day, name='Daily'), row=5, col=1)
                
                colors_hour = ['#00E676' if x >= 0 else '#FF5252' for x in pnl_by_hour.values]
                fig.add_trace(go.Bar(x=pnl_by_hour.index, y=pnl_by_hour.values, marker_color=colors_hour, name='Hourly'), row=5, col=2)

                fig.add_trace(go.Pie(labels=all_strats.index, values=all_strats.values, hole=0.6, marker=dict(colors=colors_donut, line=dict(color='#00E676', width=2)), textinfo='label+percent', name='Strat PnL'), row=6, col=1)
                colors_month = ['#00E676' if x >= 0 else '#FF5252' for x in monthly_pnl.values]
                fig.add_trace(go.Bar(x=monthly_index, y=monthly_pnl.values, marker_color=colors_month, name='Monthly PnL'), row=6, col=2)

                fig.add_trace(go.Table(header=dict(values=df_log.columns, fill_color='#2a2e39', font=dict(color='white')), cells=dict(values=[final_log_head[c] for c in final_log_head.columns], fill_color='#1e222d', font=dict(color='#cfd8dc'))), row=7, col=1)
                if not final_log_tail.empty:
                    fig.add_trace(go.Table(header=dict(values=df_log.columns, fill_color='#2a2e39', font=dict(color='white')), cells=dict(values=[final_log_tail[c] for c in final_log_tail.columns], fill_color='#1e222d', font=dict(color='#cfd8dc'))), row=8, col=1)

                title_html = (
                    "<span style='font-size: 26px;'><b>ROADMAP</b></span><br>"
                    "<span style='font-size: 14px; color: #808080;'>Engine V3.9.0 - Mathematical Precision & Complete Isolation</span>"
                )

                fig.update_layout(title_text=title_html, title_x=0.5, template="plotly_dark", height=4000, showlegend=False, paper_bgcolor='#1e222d', plot_bgcolor='#1e222d', font=dict(family="Arial, sans-serif"))

                filename = "RoadMap_Multi_Dashboard.html"
                folder = "Reports"
                if not os.path.exists(folder): os.makedirs(folder)
                full_path = os.path.join(folder, filename)
                fig.write_html(full_path)
                webbrowser.open('file://' + os.path.abspath(full_path))
                print(f"✅ Dashboard saved: {full_path}")

            except Exception as e:
                print(f"❌ Dashboard Error: {e}")
                traceback.print_exc()

# ==============================================================================
# 7. Multi_Backtester: Main Manager
# ==============================================================================
class Multi_Backtester:
    def __init__(self, config):
            self.config = config
            self.version = "3.9 (Ultimate Execution Sync)"
            
            self.margin_manager = MarginManager(config)
            self.validator = ConfigValidator(config)
            self.loader = DataLoader(config)
            self.security_guard = SecurityGuard(config) 
            self.signal_engine = SignalEngine(self)
            self.position_engine = PositionManager(self)
            self.reporter = Reporter(self)
            
            self.trades = []
            self.positions = []
            self.historical_data = None
            self.current_equity = config['initial_capital']
            self.peak_equity = config['initial_capital']
            self.lockout_until = {}
            self.lookback = config.get('lookback_period', 200)
            self.progress_callback = config.get('progress_callback')
            self.status_callback = config.get('status_callback')
            self.cancel_event = config.get('cancel_event')

            self.validator.validate()

    def round_tick(self, price, tick_size=0.01):
        if tick_size == 0: return price
        return round(round(price / tick_size) * tick_size, 6)

    def normalize_volume(self, volume):
            step = 0.01
            min_vol = 0.01
            vol = round(volume / step + 1e-9) * step
            vol = round(vol, 2)
            return max(vol, min_vol)

    def open_position(self, pos_data):
        pos_data['initial_sl'] = pos_data['sl'] 
        self.positions.append(pos_data)
        
        asset_config = next((a for a in self.config['assets'] if a['strategy_id'] == pos_data['strategy_id']), None)
        if asset_config and hasattr(asset_config['strategy'], 'on_entry'):
            asset_config['strategy'].on_entry()
            
        idx = pos_data['entry_time']
        strat_id = pos_data['strategy_id']
        pure_df = self.pure_data[strat_id]
        
        if "entry_price_marker" not in pure_df.columns:
             pure_df["entry_price_marker"] = np.nan
             pure_df["buy_signal_marker"] = np.nan
             pure_df["sell_signal_marker"] = np.nan
        
        pure_df.loc[idx, "entry_price_marker"] = pos_data['entry_price']
        
        if pos_data['type'] == 'buy':
             low_price = pure_df.loc[idx, "low"]
             pure_df.loc[idx, "buy_signal_marker"] = low_price * 0.999
        else:
             high_price = pure_df.loc[idx, "high"]
             pure_df.loc[idx, "sell_signal_marker"] = high_price * 1.001

    def execute_partial_close(self, position, lot_to_close, candle, asset_config, exit_time):
        exit_price = candle['close']
        pnl_diff = (exit_price - position['entry_price']) if position['type'] == 'buy' else (position['entry_price'] - exit_price)
        
        gross = pnl_diff * asset_config['contract_size'] * lot_to_close
        cost = position['entry_spread'] * asset_config['point_value'] * asset_config['contract_size'] * lot_to_close
        comm = asset_config.get('commission_per_lot', 0.0) * lot_to_close 

        net = gross - cost - comm
        
        self.current_equity += net
        self.peak_equity = max(self.peak_equity, self.current_equity)
        
        partial_trade = {
            'strategy_id': position['strategy_id'], 'symbol': position['symbol'], 'type': position['type'],
            'entry_time': position['entry_time'], 'exit_time': exit_time,
            'entry_price': position['entry_price'], 'exit_price': exit_price,
            'lot_size': lot_to_close, 'dollar_profit': net, 'exit_reason': 'Partial Close',
            'spread_cost': cost, 'commission': comm 
        }
        self.trades.append(partial_trade)
        
        position['lot_size'] = round(position['lot_size'] - lot_to_close, 2)
        position['partial_closed'] = True
        
        print(f"💰 [{position['symbol']}] Partial Close: {lot_to_close} Lots @ {exit_price:.2f} | Profit: ${net:.2f}")

    def close_position(self, position, exit_price, reason, exit_time, asset_config):
        pnl_diff = (exit_price - position['entry_price']) if position['type'] == 'buy' else (position['entry_price'] - exit_price)
        
        gross = pnl_diff * asset_config['contract_size'] * position['lot_size']
        cost = position['entry_spread'] * asset_config['point_value'] * asset_config['contract_size'] * position['lot_size']
        comm = asset_config.get('commission_per_lot', 0.0) * position['lot_size']
        
        net = gross - cost - comm
        
        self.current_equity += net
        self.peak_equity = max(self.peak_equity, self.current_equity)
        
        self.trades.append({
            **position, 'exit_price': exit_price, 'exit_time': exit_time, 
            'dollar_profit': net, 'exit_reason': reason, 'spread_cost': cost, 'commission': comm
        })
        
        self.lockout_until[position['strategy_id']] = exit_time + timedelta(seconds=asset_config.get('TIMEFRAME_SECONDS', 0))
        self.positions.remove(position)
        
        if hasattr(asset_config['strategy'], 'on_exit'):
            asset_config['strategy'].on_exit()
        
        strat_id = position['strategy_id']
        pure_df = self.pure_data[strat_id]
        if "exit_price_marker" not in pure_df.columns:
             pure_df["exit_price_marker"] = np.nan
        pure_df.loc[exit_time, "exit_price_marker"] = exit_price

    def run(self):
        if self.cancel_event is not None and self.cancel_event.is_set():
            return
        # 1. Load and merge time series data
        self.historical_data = self.loader.load_and_merge()
        if self.status_callback:
            self.status_callback('warning', 'Preparing strategy indicators for isolated assets...')
        
        print("⏳ Building Pure Asset Dataframes & Calculating Isolated Indicators...")
        self.pure_data = {}
        self.pointers = {}
        
        # 2. Independent and 100% isolated indicator calculation (complete single-engine simulation)
        for asset in self.config['assets']:
            if self.cancel_event is not None and self.cancel_event.is_set():
                break
            sym = asset['symbol']
            strat_id = asset['strategy_id']
            strategy = asset['strategy']
            
            # Isolate raw candles only for this symbol
            cols = [c for c in self.historical_data.columns if c.startswith(sym)]
            pure_df = self.historical_data[cols].copy()
            
            # Rename columns to standard names (open, high, ...)
            rename_dict = {c: c.replace(f"{sym}_", "") for c in cols}
            pure_df.rename(columns=rename_dict, inplace=True)
            
            # Remove closed/empty candles before computing each indicator
            pure_df.dropna(subset=['open', 'high', 'low', 'close'], inplace=True)
            
                # Calculate Heikin-Ashi values sequentially from the real OHLC data.
            if asset.get('candle_type') == 'HEIKIN_ASHI':
                ha_close = (pure_df['open'] + pure_df['high'] + pure_df['low'] + pure_df['close']) / 4.0
                pure_df['HA_Close'] = ha_close
                
                # Initialize HA_Open array to pre-allocate memory for performance
                ha_open = np.zeros(len(pure_df))
                ha_open[0] = (pure_df['open'].iloc[0] + pure_df['close'].iloc[0]) / 2.0
                ha_close_vals = ha_close.values
                
                # Sequential calculation matching TradingView's core logic
                for i in range(1, len(pure_df)):
                    if self.cancel_event is not None and self.cancel_event.is_set():
                        break
                    ha_open[i] = (ha_open[i-1] + ha_close_vals[i-1]) / 2.0
                    
                pure_df['HA_Open'] = ha_open
                pure_df['HA_High'] = pure_df[['high', 'HA_Open', 'HA_Close']].max(axis=1)
                pure_df['HA_Low'] = pure_df[['low', 'HA_Open', 'HA_Close']].min(axis=1)

            if self.cancel_event is not None and self.cancel_event.is_set():
                break
            
            # Calculate indicators before removing incomplete essential rows.
            prepared = strategy.prepare_indicators(pure_df, asset.get('candle_type', 'STANDARD'))
            self.security_guard.audit_indicators(pure_df, prepared)
            
            risk_rules = asset.get('MONEY_MANAGEMENT_MODE', [])
            if isinstance(risk_rules, list):
                for rule in risk_rules:
                    if hasattr(rule, 'prepare_indicators'):
                        prepared = rule.prepare_indicators(prepared)
            
            # Remove rows missing essential price or indicator values.
            essential = ['open', 'high', 'low', 'close']
            if hasattr(strategy, 'get_essential_indicator_columns'):
                essential += strategy.get_essential_indicator_columns()
            
            valid_essential = [c for c in essential if c in prepared.columns]
            prepared.dropna(subset=valid_essential, inplace=True)
            
            # Store the prepared data in the strategy-specific repository.
            self.pure_data[strat_id] = prepared
            self.pointers[strat_id] = 0
            
        print("✅ Isolated Indicators Prepared with 100% Accuracy.")
        print("\n⏳ Starting main multi-asset loop (Hyper Speed)...")
        
        total_candles = max(1, len(self.historical_data.index))
        for candle_index, current_time_dt in enumerate(self.historical_data.index):
            if self.cancel_event is not None and self.cancel_event.is_set():
                break
            for strat_id, pure_df in self.pure_data.items():
                ptr = self.pointers[strat_id]
                while ptr < len(pure_df) and pure_df.index[ptr] < current_time_dt:
                    if self.cancel_event is not None and self.cancel_event.is_set():
                        break
                    ptr += 1
                self.pointers[strat_id] = ptr
            if self.cancel_event is not None and self.cancel_event.is_set():
                break
            
            self.signal_engine.process_all_assets(current_time_dt)
            self.position_engine.manage_all_positions(current_time_dt)
            if self.progress_callback:
                percent = min((candle_index + 1) / total_candles * 100.0, 99.0)
                self.progress_callback(percent, 'Running V3.9 simulation')
            
        print("🏁 Loop finished.")

    def report(self):
        self.reporter.generate_report()


try:
    from .single_engine import Backtester
except ImportError:
    from backend.backtest.single_engine import Backtester