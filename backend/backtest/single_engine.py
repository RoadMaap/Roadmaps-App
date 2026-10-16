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

# --- Import Dashboard ---
try:
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
except ImportError:
    print("❌ Library 'plotly' not found. Please install it: pip install plotly")

# ==============================================================================
# SYSTEM PATH INJECTION (Dynamic Routing to Root)
# ==============================================================================
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# ==============================================================================
# LOCAL MODULE IMPORTS
# ==============================================================================
try:
    from trading.margin_calculator import MarginManager
except ImportError:
    from backend.trading.margin_calculator import MarginManager

# ==============================================================================
# Engine Info
# ==============================================================================
__version__ = "3.9.0 (Precision Mode: Synced with Live)"

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
        required_keys = [
            'initial_capital', 'csv_file_path', 'TIMEFRAME_SECONDS',
            'LOOKBACK_PERIOD', 'SPREAD_DIVISOR', 'COMMISSION_PER_LOT',
            'point_value', 'contract_size', 'START_DATE', 'CANDLE_TYPE',
            'MONEY_MANAGEMENT_MODE'
        ]
        for key in required_keys:
            if key not in self.config:
                raise ValueError(f"❌ Config Error: Missing required key '{key}'")
        
        if not isinstance(self.config['MONEY_MANAGEMENT_MODE'], list):
            raise ValueError("❌ Config Error: 'MONEY_MANAGEMENT_MODE' must be a list of rule objects.")
        
        # Ensure tick_size exists for precision mode, default to 0.01 if missing
        if 'tick_size' not in self.config:
            print("⚠️ Warning: 'tick_size' not found in config. Defaulting to 0.01 (Gold/Index standard).")
            self.config['tick_size'] = 0.01

        print("✅ ConfigValidator: Passed.")


# ==============================================================================
# 2. DataLoader
# ==============================================================================
class DataLoader:
    def __init__(self, config):
        self.config = config

    def load_and_prepare(self):
        try:
            print("⏳ DataLoader: Loading CSV...")
            df = pd.read_csv(self.config['csv_file_path'], sep='\t')
            df.columns = df.columns.str.lower().str.replace('<', '').str.replace('>', '')
            df['time_dt'] = pd.to_datetime(df['date'] + ' ' + df['time'])
            df.set_index('time_dt', inplace=True)
            df.index.name = 'time'

            if 'tickvol' in df.columns: df.rename(columns={'tickvol': 'volume'}, inplace=True)
            elif 'vol' in df.columns: df.rename(columns={'vol': 'volume'}, inplace=True)
            if 'volume' not in df.columns: df['volume'] = 0

            if 'spread' in df.columns:
                df['spread'] = df['spread'] / self.config.get('SPREAD_DIVISOR', 1.0)
            else:
                df['spread'] = 0.0

            final_cols = ['open', 'high', 'low', 'close', 'spread', 'volume']
            df = df[[c for c in final_cols if c in df.columns]]

            if 'START_DATE' in self.config:
                df = df[df.index >= pd.to_datetime(self.config['START_DATE'])]

            if self.config.get('CANDLE_TYPE') == 'HEIKIN_ASHI':
                print("⏳ DataLoader: Calculating True Heikin Ashi...")
                ha = pd.DataFrame(index=df.index)
                ha['HA_Close'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4.0
                
                # Calculate Heikin-Ashi open values recursively.
                ha_open = np.zeros(len(df))
                ha_open[0] = (df['open'].iloc[0] + df['close'].iloc[0]) / 2.0
                
                ha_close_vals = ha['HA_Close'].values
                for i in range(1, len(df)):
                    ha_open[i] = (ha_open[i-1] + ha_close_vals[i-1]) / 2.0
                    
                ha['HA_Open'] = ha_open
                # ---------------------------------------------
                
                ha['HA_High'] = df[['high']].join(ha[['HA_Open', 'HA_Close']]).max(axis=1)
                ha['HA_Low'] = df[['low']].join(ha[['HA_Open', 'HA_Close']]).min(axis=1)
                df = pd.concat([df, ha], axis=1)

            print("✅ DataLoader: Data ready.")
            return df

        except Exception as e:
            raise IOError(f"❌ DataLoader Error: {e}")


# ==============================================================================
# 3. SecurityGuard
# ==============================================================================
class SecurityGuard:
    def __init__(self, config):
        self.config = config

    def get_safe_history_slice(self, history_slice):
        if not self.config.get('STRICT_LOOKAHEAD_PROTECTION', True):
            return history_slice

        safe_slice = history_slice.copy()
        if safe_slice.empty: return safe_slice

        last_idx = safe_slice.index[-1]
        current_open = safe_slice.at[last_idx, 'open']

        safe_slice.at[last_idx, 'high'] = current_open
        safe_slice.at[last_idx, 'low'] = current_open
        safe_slice.at[last_idx, 'close'] = current_open
        safe_slice.at[last_idx, 'volume'] = 0

        if 'HA_Close' in safe_slice.columns:
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
            msg = f"\n🚨 CRITICAL SECURITY ALERT [{strategy_id}]: Entry Price ({entry_price}) matches Future CLOSE exactly! Backtest result is invalid."
            if self.config.get('STRICT_LOOKAHEAD_PROTECTION', True):
                raise LookaheadBiasError(msg)
            else:
                print(msg)

    def audit_indicators(self, original_df, df_with_indicators):
        print("🕵️  SecurityGuard: Auditing indicators...")
        original_cols = set(original_df.columns)
        new_cols = set(df_with_indicators.columns)
        indicator_cols = list(new_cols - original_cols)
        if not indicator_cols: return

        future_df = pd.DataFrame(index=original_df.index)
        future_df['future_return'] = original_df['close'].pct_change().shift(-1)
        valid_indicators = [c for c in indicator_cols if pd.api.types.is_numeric_dtype(df_with_indicators[c])]
        if not valid_indicators: return

        audit_df = df_with_indicators[valid_indicators].join(future_df).dropna()
        if audit_df.empty: return

        threshold = self.config.get('LOOKAHEAD_AUDIT_THRESHOLD', 0.99)
        suspicious_found = False
        for col in valid_indicators:
            corr = abs(audit_df[col].corr(audit_df['future_return']))
            if corr > threshold:
                print(f"⚠️ Warning: Indicator '{col}' correlates {corr:.4f} with FUTURE returns. (Lookahead Bias detected)")
                suspicious_found = True

        if suspicious_found:
            print("❌ SecurityGuard: Audit found suspicious indicators!")
        else:
            print("✅ SecurityGuard: Audit passed. No lookahead indicators found.")


# ==============================================================================
# 4. SignalEngine
# ==============================================================================
class SignalEngine:
    def __init__(self, backtester):
        self.bt = backtester
        self.security = backtester.security_guard

    def process_signal(self, current_candle, history_slice):
            # Apply the initial position, lockout, and trading-window checks.
            if self.bt.position: return
            if current_candle.name < self.bt.lockout_until: return
            
            current_time = current_candle.name.time()
            current_day = current_candle.name.dayofweek
            if 'ALLOWED_DAYS' in self.bt.config and current_day not in self.bt.config['ALLOWED_DAYS']: return
            
            is_in_killzone = True
            if 'KILLZONES' in self.bt.config:
                is_in_killzone = False
                for start, end in self.bt.config['KILLZONES']:
                    if start <= end:
                        if start <= current_time < end: is_in_killzone = True; break
                    else:
                        if current_time >= start or current_time < end: is_in_killzone = True; break
            if not is_in_killzone: return   

            # Request the strategy signal.
            safe_slice = self.security.get_safe_history_slice(history_slice)
            trade_type, entry, sl, tp = self.bt.strategy.check_entry_signal(safe_slice)

            if trade_type:
                self.security.audit_signal_integrity("Strategy", entry, history_slice.iloc[-1])
                
                signal_candle = history_slice.iloc[-2]
                current_spread = signal_candle.get('spread', 0.0)
                if pd.isna(current_spread): current_spread = 0.0

                # ==================================================================
                # Apply the reference precision synchronization.
                # ==================================================================
                
                # Round prices to the tick size before calculating position volume.
                entry = self.bt.round_tick(entry)
                sl = self.bt.round_tick(sl)
                tp = self.bt.round_tick(tp)

                # Calculate raw volume from the normalized prices.
                raw_lot = self._calculate_position_size(trade_type, entry, sl, tp, history_slice, current_candle)
                
                # Normalize the final volume using the reference epsilon correction.
                lot_size = self.bt.normalize_volume(raw_lot)
                
                if lot_size > 0:
                    self.bt.open_position(trade_type, entry, sl, tp, lot_size, current_candle, current_spread)

    def _calculate_position_size(self, trade_type, entry, sl, tp, history_slice, current_candle):
        context = {
            'equity': self.bt.current_equity,
            'trade_type': trade_type, 'entry_price': entry, 'stop_loss': sl, 'take_profit': tp,
            'history_slice': history_slice, 'current_candle': current_candle,
            'config': self.bt.config,
            'trades': self.bt.trades,
            'full_data': self.bt.historical_data
        }

        lot_size = 0.0
        risk_rules = self.bt.risk_rules

        if not risk_rules: return 0.0

        for rule in risk_rules:
            if hasattr(rule, 'calculate_risk_details'):
                res = rule.calculate_risk_details(context)
                if res:
                    if isinstance(res, list): res = res[0]
                    if 'lot_size' in res: lot_size = res['lot_size']
                    if 'stop_loss' in res: context['stop_loss'] = res['stop_loss']
                    if 'take_profit' in res: context['take_profit'] = res['take_profit']

        # Normalize volume to the broker's 0.01 lot step.
        lot_size = self.bt.normalize_volume(lot_size)
        return lot_size


# ==============================================================================
# 5. PositionManager (Precision Mode: Ask Simulation)
# ==============================================================================
class PositionManager:
    def __init__(self, backtester):
        self.bt = backtester

    def manage(self, current_candle, history_slice):
        if not self.bt.position: return
        pos = self.bt.position

        # Draw SL/TP lines (Optional)
        if hasattr(self.bt, 'historical_data'):
            self.bt.historical_data.loc[current_candle.name, 'sl_line'] = pos['sl']
            self.bt.historical_data.loc[current_candle.name, 'tp_line'] = pos['tp']

        # ------------------------------------------------------------------
        # Dynamic Risk Management (Trailing, Partial, etc.)
        # ------------------------------------------------------------------
        risk_rules = getattr(self.bt, 'risk_rules', [])
        if not risk_rules: risk_rules = []

        for rule in risk_rules:
            # 1. Update SL
            if hasattr(rule, 'update_sl'):
                context = {
                    'position': pos, 'current_candle': current_candle,
                    'history_slice': history_slice, 'config': self.bt.config
                }
                new_sl = rule.update_sl(context)
                if new_sl:
                    # Round updated SL as well
                    pos['sl'] = self.bt.round_tick(new_sl)

            # 2. Partial Close
            if hasattr(rule, 'check_partial_exit'):
                context = {
                    'position': pos, 'current_candle': current_candle,
                    'history_slice': history_slice, 'config': self.bt.config
                }
                lot_to_close = rule.check_partial_exit(context)
                
                if lot_to_close:
                    lot_to_close = self.bt.normalize_volume(lot_to_close) # Normalize partial vol
                    current_lot = pos['lot_size']
                    remaining_lot = round(current_lot - lot_to_close, 2)
                    
                    if (lot_to_close >= 0.01) and (remaining_lot >= 0.01) and (lot_to_close < current_lot):
                        self.bt.execute_partial_close(pos, lot_to_close, current_candle)

        # ------------------------------------------------------------------
        # Full Exit (Precision Mode: Simulating Ask Spread)
        # ------------------------------------------------------------------
        exit_price, exit_reason = self.bt.strategy.check_exit_conditions(current_candle, history_slice, pos)
        
        # Calculate Spread Value
        spread_val = 0.0
        if 'spread' in current_candle:
             spread_val = current_candle['spread'] * self.bt.config['point_value']

        if not exit_price:
            if pos['type'] == 'buy':
                # BUY closes at BID (Low/High are Bid prices)
                if current_candle['low'] <= pos['sl']: 
                    exit_price, exit_reason = pos['sl'], 'Stop Loss'
                elif current_candle['high'] >= pos['tp']: 
                    exit_price, exit_reason = pos['tp'], 'Take Profit'
            else:
                # Sell positions close at the ask price, including spread.
                ask_high = current_candle['high'] + spread_val
                ask_low = current_candle['low'] + spread_val # For TP accuracy

                if ask_high >= pos['sl']:
                    exit_price, exit_reason = pos['sl'], 'Stop Loss (Spread)'
                elif ask_low <= pos['tp']:
                    exit_price, exit_reason = pos['tp'], 'Take Profit'

        if exit_price:
            self.bt.close_position(exit_price, exit_reason, current_candle)


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
            if plot_trades and hasattr(self.bt, 'historical_data') and not self.bt.historical_data.empty:
                self._plot_trade_chart_mpl()
            return

        results_df = pd.DataFrame(self.bt.trades)
        results_df['entry_time'] = pd.to_datetime(results_df['entry_time'])
        results_df['exit_time'] = pd.to_datetime(results_df['exit_time'])
        results_df['dollar_profit'] = pd.to_numeric(results_df['dollar_profit'])
        results_df['commission'] = pd.to_numeric(results_df.get('commission', 0))

        initial_cap = self.bt.config['initial_capital']
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


        if self.bt.config.get('PRINT_TRADE_LOG', False):
            pd.set_option('display.max_columns', None); pd.set_option('display.width', 1000)
            
            # Add stop-loss and take-profit fields to the displayed columns.
            log_cols = ['entry_time', 'exit_time', 'type', 'lot_size', 'entry_price', 'exit_price', 'sl', 'tp', 'commission', 'dollar_profit', 'exit_reason']
            
            display_cols = [c for c in log_cols if c in results_df.columns]
            log_df = results_df[display_cols].copy()
            
            # Format stop-loss and take-profit values for display.
            for col in ['entry_price', 'exit_price', 'sl', 'tp', 'dollar_profit']:
                if col in log_df.columns: 
                    log_df[col] = log_df[col].apply(lambda x: f"{x:,.2f}")
            
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
            self._plot_trade_chart_mpl()
            self._plot_advanced_dashboard(
                results_df, initial_cap, total_pnl, total_pct, count_main, count_partial,
                win_rate, profit_factor, max_dd_pct, max_dd_dollar, 
                max_daily_dd_pct, max_daily_dd_dollar, avg_win, avg_loss, total_commission
            )

    def _plot_trade_chart_mpl(self):
        try:
            if not hasattr(self.bt, 'historical_data') or self.bt.historical_data.empty: return
            from types import SimpleNamespace
            from .reporter import BacktestReporter

            strategy_id = 'single_backtest'
            asset = {
                'strategy_id': strategy_id,
                'symbol': self.bt.config.get('symbol', 'Symbol'),
                'timeframe': self.bt.config.get('timeframe', ''),
                'candle_type': self.bt.config.get('CANDLE_TYPE', 'STANDARD'),
                'strategy': self.bt.strategy,
            }
            trades = [{**trade, 'strategy_id': strategy_id} for trade in self.bt.trades]
            chart_engine = SimpleNamespace(
                config={'assets': [asset]},
                pure_data={strategy_id: self.bt.historical_data},
                trades=trades,
            )
            BacktestReporter(chart_engine).render_chart_images(strategy_id)
        except Exception as e:
            import traceback
            print("\n❌ ================= MATPLOTLIB CRASH REPORT =================")
            traceback.print_exc()
            print("==============================================================\n")

    def _get_config_table_data(self):
        cfg = self.bt.config
        data = []
        mm_str = ""
        if 'MONEY_MANAGEMENT_MODE' in cfg:
            for rule in cfg['MONEY_MANAGEMENT_MODE']:
                name = rule.__class__.__name__.replace("Rule", "").replace("Handler", "")
                params = str(rule.__dict__).replace("{", "(").replace("}", ")").replace("'", "")
                mm_str += f"• {name}{params}<br>"
        data.append(["Money Management", mm_str])
        data.append(["Candle Type", cfg.get('CANDLE_TYPE', 'STANDARD')])
        days_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
        allowed = cfg.get('ALLOWED_DAYS', [])
        allowed_str = ", ".join([days_map.get(d, str(d)) for d in allowed])
        data.append(["Allowed Days", allowed_str])
        kz = cfg.get('KILLZONES', [])
        kz_str = "<br>".join([f"{s.strftime('%H:%M')}-{e.strftime('%H:%M')}" for s, e in kz])
        data.append(["Killzones", kz_str if kz_str else "None"])
        strat = self.bt.strategy
        if strat and hasattr(strat, 'params'):
             s_params = str(strat.params).replace("{", "").replace("}", "").replace("'", "").replace(",", "<br>")
             data.append(["Strategy Params", s_params])
        return data

    def _plot_advanced_dashboard(self, results_df, initial_cap, total_pnl, total_pct, 
                                 count_main, count_partial, win_rate, profit_factor, 
                                 max_dd_pct, max_dd_dollar, max_daily_dd_pct, max_daily_dd_dollar, 
                                 avg_win, avg_loss, total_commission):
        try:
            print("\n⏳ Generating Advanced Dashboard (Plotly)...")
            
            stats_header = ['Metric', 'Value']
            stats_values = [
                ['Initial Capital', 'Final Equity', 'Net Profit', 
                 'Total Trades', 'Partial Events', 'Total Commission', 
                 'Win Rate', 'Profit Factor', 
                 'Avg Win', 'Avg Loss', 
                 'Max Drawdown', 'Max Daily Drawdown'],
                [f"${initial_cap:,.2f}", f"${results_df['equity'].iloc[-1]:,.2f}", 
                 f"${total_pnl:,.2f} ({total_pct:.2f}%)", f"{count_main}", f"{count_partial}", 
                 f"${total_commission:,.2f}", f"{win_rate:.2f}%", f"{profit_factor:.2f}", 
                 f"${avg_win:,.2f}", f"${avg_loss:,.2f}", 
                 f"{max_dd_pct:.2f}% (${max_dd_dollar:,.0f})", 
                 f"{max_daily_dd_pct:.2f}% (${max_daily_dd_dollar:,.0f})"]
            ]
            
            config_data = self._get_config_table_data()
            config_header = ['Parameter', 'Setting']
            config_values = [[row[0] for row in config_data], [row[1] for row in config_data]]

            results_df['entry_day'] = results_df['entry_time'].dt.day_name()
            day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            pnl_by_day = results_df.groupby('entry_day')['dollar_profit'].sum().reindex(day_order).fillna(0)
            
            results_df['hour'] = results_df['entry_time'].dt.hour
            pnl_by_hour = results_df.groupby('hour')['dollar_profit'].sum().reindex(range(24)).fillna(0)
            
            results_df['month'] = results_df['exit_time'].dt.to_period('M')
            monthly_pnl = results_df.groupby('month')['dollar_profit'].sum()
            monthly_index = monthly_pnl.index.astype(str)

            log_cols = ['entry_time', 'exit_time', 'type', 'lot_size', 'entry_price', 'exit_price', 'commission', 'dollar_profit', 'exit_reason']
            df_log = results_df[log_cols].copy()
            for col in ['entry_price', 'exit_price', 'dollar_profit', 'commission']:
                df_log[col] = df_log[col].apply(lambda x: f"{x:,.2f}")
            df_log['entry_time'] = df_log['entry_time'].dt.strftime('%Y-%m-%d %H:%M')
            df_log['exit_time'] = df_log['exit_time'].dt.strftime('%Y-%m-%d %H:%M')
            
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
                    [{"colspan": 2}, None],
                    [{"colspan": 2, "type": "table"}, None],
                    [{"colspan": 2, "type": "table"}, None],
                ],
                subplot_titles=("Summary Statistics", "Configuration", "Equity Curve", "Drawdown (%)", "PnL by Entry Day", "PnL by Hour", "Monthly PnL", "Trade Log (First 10)", "Trade Log (Last 10)"),
                vertical_spacing=0.06,
                row_heights=[0.15, 0.20, 0.12, 0.10, 0.12, 0.12, 0.12, 0.12]
            )

            fig.add_trace(go.Table(header=dict(values=stats_header, fill_color='#2a2e39', font=dict(color='white', size=12)), cells=dict(values=stats_values, fill_color='#1e222d', font=dict(color='white', size=12), height=30)), row=1, col=1)
            fig.add_trace(go.Table(columnwidth=[1, 4], header=dict(values=config_header, fill_color='#2a2e39', font=dict(color='white', size=12)), cells=dict(values=config_values, fill_color='#1e222d', font=dict(color='#cfd8dc', size=11), align='left', height=30)), row=2, col=1)
            fig.add_trace(go.Scatter(x=results_df['exit_time'], y=results_df['equity'], mode='lines', name='Equity', line=dict(color='#2962FF', width=2)), row=3, col=1)
            fig.add_trace(go.Scatter(x=results_df['exit_time'], y=results_df['drawdown_pct'], fill='tozeroy', name='Drawdown', line=dict(color='#FF5252')), row=4, col=1)
            colors_day = ['#00E676' if x >= 0 else '#FF5252' for x in pnl_by_day.values]
            fig.add_trace(go.Bar(x=pnl_by_day.index, y=pnl_by_day.values, marker_color=colors_day, name='Daily'), row=5, col=1)
            colors_hour = ['#00E676' if x >= 0 else '#FF5252' for x in pnl_by_hour.values]
            fig.add_trace(go.Bar(x=pnl_by_hour.index, y=pnl_by_hour.values, marker_color=colors_hour, name='Hourly'), row=5, col=2)
            colors_month = ['#00E676' if x >= 0 else '#FF5252' for x in monthly_pnl.values]
            fig.add_trace(go.Bar(x=monthly_index, y=monthly_pnl.values, marker_color=colors_month, name='Monthly PnL'), row=6, col=1)
            fig.add_trace(go.Table(header=dict(values=df_log.columns, fill_color='#2a2e39', font=dict(color='white')), cells=dict(values=[final_log_head[c] for c in final_log_head.columns], fill_color='#1e222d', font=dict(color='#cfd8dc'))), row=7, col=1)
            if not final_log_tail.empty:
                fig.add_trace(go.Table(header=dict(values=df_log.columns, fill_color='#2a2e39', font=dict(color='white')), cells=dict(values=[final_log_tail[c] for c in final_log_tail.columns], fill_color='#1e222d', font=dict(color='#cfd8dc'))), row=8, col=1)

            title_html = (
                "<span style='font-size: 28px;'><b>ROADMAP</b></span><br>"
                "<span style='font-size: 14px; color: #808080;'>Engine V3.9 - Single Asset Strategy</span>"
            )

            fig.update_layout(title_text=title_html, title_x=0.5, template="plotly_dark", height=4000, showlegend=False, paper_bgcolor='#131722', plot_bgcolor='#131722', font=dict(family="Arial, sans-serif"))

            filename = "RoadMap_Single_Dashboard.html"
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
# 7. Backtester: Main Manager
# ==============================================================================
class Backtester:
    def __init__(self, config):
        self.config = config
        self.version = "3.9 (Precision Mode)"       
        self.risk_rules = self.config.get('MONEY_MANAGEMENT_MODE', [])
        
        self.validator = ConfigValidator(config)
        self.loader = DataLoader(config)
        self.security_guard = SecurityGuard(config)
        self.signal_engine = SignalEngine(self)
        self.position_manager = PositionManager(self)
        self.reporter = Reporter(self)
        
        self.trades = []
        self.position = None
        self.historical_data = None
        self.current_equity = config['initial_capital']
        self.peak_equity = config['initial_capital']
        self.lockout_until = pd.Timestamp(0)
        self.strategy = None

        self.validator.validate()

    def round_tick(self, price):
        """Rounds price to the nearest valid tick size (broker standard)"""
        tick_size = self.config.get('tick_size', 0.01)
        if tick_size == 0: return price
        return round(round(price / tick_size) * tick_size, 6)

    def normalize_volume(self, volume):
            """
            Normalizes the volume to the nearest valid step size (e.g., 0.01) and ensures a minimum volume of 0.01
            """
            
            step = 0.01
            min_vol = 0.01
            
            vol = round(volume / step + 1e-9) * step
            
            vol = round(vol, 2)
            
            return max(vol, min_vol)

    def load_data(self):
        self.historical_data = self.loader.load_and_prepare()

    def open_position(self, type, entry, sl, tp, lot, candle, spread):
        self.position = {
            'type': type, 
            'entry_price': entry, 
            'sl': sl, 
            'initial_sl': sl, 
            'tp': tp,
            'lot_size': lot, 
            'entry_time': candle.name, 
            'entry_spread': spread
        }
        if hasattr(self.strategy, 'on_entry'): self.strategy.on_entry()
        
        self.historical_data.loc[candle.name, 'entry_price_marker'] = entry
        if type == 'buy': self.historical_data.loc[candle.name, 'buy_signal_marker'] = candle['low'] * 0.999
        else: self.historical_data.loc[candle.name, 'sell_signal_marker'] = candle['high'] * 1.001

    def execute_partial_close(self, position, lot_to_close, candle):
        exit_price = candle['close']
        
        diff = (exit_price - position['entry_price']) if position['type'] == 'buy' else (position['entry_price'] - exit_price)
        
        gross = diff * self.config['contract_size'] * lot_to_close
        cost = position['entry_spread'] * self.config['point_value'] * self.config['contract_size'] * lot_to_close
        
        comm = self.config.get('COMMISSION_PER_LOT', 0.0) * lot_to_close 
        
        net = gross - cost - comm
        
        self.current_equity += net
        self.peak_equity = max(self.peak_equity, self.current_equity)
        
        partial_trade = {
            'type': position['type'],
            'entry_time': position['entry_time'],
            'entry_price': position['entry_price'],
            'sl': position['sl'], 'tp': position['tp'],
            'exit_time': candle.name,
            'exit_price': exit_price,
            'lot_size': lot_to_close,
            'dollar_profit': net,
            'exit_reason': 'Partial Close',
            'spread_cost': cost,
            'commission': comm 
        }
        self.trades.append(partial_trade)
        
        position['lot_size'] = round(position['lot_size'] - lot_to_close, 2)
        position['partial_closed'] = True

    def close_position(self, exit_price, reason, candle):
        pos = self.position
        diff = (exit_price - pos['entry_price']) if pos['type'] == 'buy' else (pos['entry_price'] - exit_price)
        
        gross = diff * self.config['contract_size'] * pos['lot_size']
        cost = pos['entry_spread'] * self.config['point_value'] * self.config['contract_size'] * pos['lot_size']
        
        comm = self.config.get('COMMISSION_PER_LOT', 0.0) * pos['lot_size']
        
        net = gross - cost - comm
        
        self.current_equity += net
        self.peak_equity = max(self.peak_equity, self.current_equity)
        
        self.trades.append({
            **pos, 
            'exit_price': exit_price, 
            'exit_time': candle.name, 
            'dollar_profit': net, 
            'exit_reason': reason, 
            'spread_cost': cost,
            'commission': comm 
        })
        self.lockout_until = candle.name + timedelta(seconds=self.config['TIMEFRAME_SECONDS'])
        
        if hasattr(self.strategy, 'on_exit'): self.strategy.on_exit()
        
        self.historical_data.loc[candle.name, 'exit_price_marker'] = exit_price
        self.position = None

    def run(self, strategy):
        print(f"--- 🚀 Starting Engine {self.version} ---")
        self.strategy = strategy
        df_orig = self.historical_data.copy()
        
        print("⏳ Preparing indicators...")
        self.historical_data = strategy.prepare_indicators(self.historical_data.copy(), self.config.get('CANDLE_TYPE', 'STANDARD'))
        
        essential = ['open', 'high', 'low', 'close']
        if hasattr(strategy, 'get_essential_indicator_columns'): essential += strategy.get_essential_indicator_columns()
        self.historical_data.dropna(subset=essential, inplace=True)
        
        self.security_guard.audit_indicators(df_orig, self.historical_data)
        
        for rule in self.risk_rules:
            if hasattr(rule, 'prepare_indicators'):
                self.historical_data = rule.prepare_indicators(self.historical_data)

        for col in ['buy_signal_marker', 'sell_signal_marker', 'entry_price_marker', 'sl_line', 'tp_line', 'exit_price_marker']:
            self.historical_data[col] = np.nan

        lookback = self.config['LOOKBACK_PERIOD']
        print("\n⏳ Starting main loop...")
        
        for i in range(lookback, len(self.historical_data)):
            current_candle = self.historical_data.iloc[i]
            history_slice = self.historical_data.iloc[i - lookback : i+1]
            
            self.signal_engine.process_signal(current_candle, history_slice)
            self.position_manager.manage(current_candle, history_slice)
            
        print("🏁 Loop finished.")

    def report(self):
        self.reporter.generate_report()