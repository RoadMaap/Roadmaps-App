# ==============================================================================
# ULTIMATE MULTI LIVE ENGINE (v5.0.0) - ENTERPRISE ZERO-CRASH EDITION
# Features: Dynamic Slippage, Smart FOK/IOC, Guaranteed News Close, Safe Exec
# ==============================================================================

import os
import sys
import math
import traceback
import time as os_time
import threading
from datetime import datetime, timedelta
import pandas as pd
import MetaTrader5 as mt5

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from trading.risk_manager import *
    from trading.margin_calculator import MarginManager
    from core.target_lock import TargetLockManager
    from core.error_handler import ErrorManager, StrategyValidator, ui_log
    from core.mt5_runtime import MT5TaskExecutor, mt5_call, mt5_order_send, serialized_mt5
except ImportError as e:
    print(f"❌ Critical Core Engine Import Error: {e}")
    sys.exit(1)

# ==============================================================================
# 0. NEWS EMBARGO CHECKER (Global Security Guard)
# ==============================================================================
def is_news_embargo_active(symbol, config, news_filter):
    if not config.get('nf_enabled', False) or not news_filter or getattr(news_filter, 'news_data', None) is None:
        return False
        
    current_utc = datetime.utcnow()
    before_mins = config.get('nf_before', 30)
    after_mins = config.get('nf_after', 30)
    
    active_curs = []
    if config.get('nf_eur', True): active_curs.append('EUR')
    if config.get('nf_usd', True): active_curs.append('USD')
    
    sym_upper = symbol.upper()
    
    for news in news_filter.news_data:
        news_cur = news['currency'].upper()
        if news_cur not in active_curs:
            continue
            
        is_affected = False
        if news_cur in sym_upper:
            is_affected = True
        # التعمیم اخبار دلار به طلا، بیت‌کوین و شاخص‌های آمریکا
        elif news_cur == 'USD' and any(x in sym_upper for x in ['US', 'XAU', 'BTC', 'NAS', 'SPX', 'NDX']):
            is_affected = True
            
        if not is_affected:
            continue
            
        start_embargo = news['time'] - timedelta(minutes=before_mins)
        end_embargo = news['time'] + timedelta(minutes=after_mins)
        
        if start_embargo <= current_utc <= end_embargo:
            return True
    return False

# ==============================================================================
# 1. MT5 Interface (Core Broker Connection Layer)
# ==============================================================================
class MT5Interface:
    def __init__(self, mt5_path=None, max_retries=15, retry_delay_seconds=5):
        self.mt5_path = mt5_path
        self.tasks = MT5TaskExecutor()
        self._connect_with_retry(max_retries, retry_delay_seconds)

    def submit_background(self, operation_key, operation):
        future = self.tasks.submit(operation_key, operation)
        if future is None:
            return False

        def report_failure(completed):
            try:
                error = completed.exception()
            except Exception as exc:
                error = exc
            if error:
                ui_log('error', f"Background MT5 task {operation_key} failed: {error}")

        future.add_done_callback(report_failure)
        return True

    def _connect_with_retry(self, max_retries, retry_delay):
        ui_log('warning', "🔌 [SYSTEM] Initiating MT5 Terminal Connection Protocol...")
        for attempt in range(1, max_retries + 1):
            init_success = mt5_call(mt5.initialize, path=self.mt5_path) if self.mt5_path else mt5_call(mt5.initialize)
            if init_success:
                term = mt5_call(mt5.terminal_info)
                if term is not None and term.connected:
                    acc = mt5_call(mt5.account_info)
                    if acc is not None:
                        ui_log('success', f"✅ [SUCCESS] MT5 Connected & Synced! Account: {acc.login}")
                        return 
            if attempt < max_retries:
                os_time.sleep(retry_delay)
        raise ConnectionError("🛑 [FATAL] Could not establish stable MT5 connection.")

    @serialized_mt5
    def is_connected(self):
        term = mt5_call(mt5.terminal_info)
        return term is not None and term.connected

    @serialized_mt5
    def get_account_info(self): return mt5_call(mt5.account_info)

    @serialized_mt5
    def get_symbol_info(self, symbol): return mt5_call(mt5.symbol_info, symbol)
    
    def get_real_contract_size(self, symbol):
        info = self.get_symbol_info(symbol)
        return info.trade_contract_size if info else 1.0 

    def get_dynamic_deviation(self, symbol):
        """
        محاسبه هوشمند اسلیپیج مجاز بر اساس نوع نماد برای جلوگیری از ارور Requote (10004)
        """
        sym_upper = symbol.upper()
        if any(x in sym_upper for x in ['XAU', 'US30', 'BTC', 'NAS', 'SPX', 'NDX']):
            return 150  # 15 pips (150 points) for highly volatile assets
        elif any(x in sym_upper for x in ['JPY', 'GBP']):
            return 50   # 5 pips
        return 20       # 2 pips default for standard forex like EURUSD

    def normalize_price(self, symbol, price):
        info = self.get_symbol_info(symbol)
        if not info or info.trade_tick_size == 0: return price
        return round(round(price / info.trade_tick_size) * info.trade_tick_size, info.digits)

    def normalize_volume(self, symbol, volume):
        info = self.get_symbol_info(symbol)
        if not info or info.volume_step == 0: return volume
        vol = round(volume / info.volume_step + 1e-9) * info.volume_step
        return min(max(round(vol, 2), info.volume_min), info.volume_max)

    @serialized_mt5
    def get_candles(self, symbol, timeframe, count):
        rates = mt5_call(mt5.copy_rates_from_pos, symbol, timeframe, 0, count)
        if rates is None or len(rates) == 0: return None
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df.set_index('time', inplace=True)
        if 'tick_volume' in df.columns: df.rename(columns={'tick_volume': 'volume'}, inplace=True)
        elif 'real_volume' in df.columns: df.rename(columns={'real_volume': 'volume'}, inplace=True)
        if 'volume' not in df.columns: df['volume'] = 0
        return df

    @serialized_mt5
    def get_symbol_tick(self, symbol): return mt5_call(mt5.symbol_info_tick, symbol)

    @serialized_mt5
    def get_open_positions(self, symbol=None):
        return mt5_call(mt5.positions_get, symbol=symbol) if symbol else mt5_call(mt5.positions_get)

    @serialized_mt5
    def get_smart_filling_mode(self, symbol):
        """
        جلوگیری از ارور 10030: استفاده از پرچم‌های باینری برای کشف Filling Mode مجاز بروکر
        1 = FOK, 2 = IOC
        """
        info = self.get_symbol_info(symbol)
        if info is None: return mt5.ORDER_FILLING_FOK
        flags = info.filling_mode
        if flags & 1: return mt5.ORDER_FILLING_FOK # FOK Allowed
        elif flags & 2: return mt5.ORDER_FILLING_IOC # IOC Allowed
        else: return mt5.ORDER_FILLING_RETURN

    @serialized_mt5
    def send_market_order(self, symbol, trade_type, volume, sl, tp, magic, comment):
        tick = self.get_symbol_tick(symbol)
        if not tick: return False
        
        price = tick.ask if trade_type == 'buy' else tick.bid
        mt5_type = mt5.ORDER_TYPE_BUY if trade_type == 'buy' else mt5.ORDER_TYPE_SELL
        smart_filling = self.get_smart_filling_mode(symbol)
        dynamic_dev = self.get_dynamic_deviation(symbol)
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL, "symbol": symbol, 
            "volume": float(self.normalize_volume(symbol, volume)),
            "type": mt5_type, "price": price, 
            "sl": float(self.normalize_price(symbol, sl)), 
            "tp": float(self.normalize_price(symbol, tp)),
            "deviation": dynamic_dev, "magic": magic, "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC, "type_filling": smart_filling  
        }
        
        res = mt5_order_send(request, f"MARKET_{trade_type.upper()}")
        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
            return True
        else:
            ErrorManager.handle_mt5_error(res.retcode if res else 0, symbol, f"MARKET_{trade_type.upper()}")
            return False

    @serialized_mt5
    def modify_position(self, ticket, symbol, new_sl, new_tp):
        request = {
            "action": mt5.TRADE_ACTION_SLTP, "position": ticket, "symbol": symbol,
            "sl": float(self.normalize_price(symbol, new_sl)), 
            "tp": float(self.normalize_price(symbol, new_tp))
        }
        res = mt5_order_send(request, "MODIFY_SL_TP")
        if not res or res.retcode != mt5.TRADE_RETCODE_DONE:
            ErrorManager.handle_mt5_error(res.retcode if res else 0, symbol, "MODIFY_SL_TP")
            return False
        return True

    @serialized_mt5
    def close_partial(self, ticket, symbol, volume, type_op, price):
        dynamic_dev = self.get_dynamic_deviation(symbol)
        smart_filling = self.get_smart_filling_mode(symbol) 
        request = {
            "action": mt5.TRADE_ACTION_DEAL, "position": ticket, "symbol": symbol,
            "volume": float(self.normalize_volume(symbol, volume)), "type": type_op, "price": price,
            "deviation": dynamic_dev, "comment": f"PARTIAL_{ticket}",
            "type_filling": smart_filling 
        }
        res = mt5_order_send(request, "PARTIAL_CLOSE")
        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
            ui_log('warning', f"✂️ Partial Closed Position #{ticket} ({symbol})")
            return True
        ErrorManager.handle_mt5_error(res.retcode if res else 0, symbol, "PARTIAL_CLOSE")
        return False

    @serialized_mt5
    def close_full(self, ticket, symbol, volume, type_op, price, comment):
        dynamic_dev = self.get_dynamic_deviation(symbol)
        smart_filling = self.get_smart_filling_mode(symbol)
        request = {
            "action": mt5.TRADE_ACTION_DEAL, "position": ticket, "symbol": symbol,
            "volume": float(volume), "type": type_op, "price": price,
            "deviation": dynamic_dev, "comment": comment,
            "type_filling": smart_filling 
        }
        res = mt5_order_send(request, "FULL_CLOSE")
        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
            ui_log('success', f"🔒 Closed Position #{ticket} ({symbol}) | Reason: {comment}")
            return True
        ErrorManager.handle_mt5_error(res.retcode if res else 0, symbol, "FULL_CLOSE")
        return False


# ==============================================================================
# 2. Live Signal Engine (Universal Core Focus)
# ==============================================================================
class LiveSignalEngine:
    def __init__(self, mt5_interface, config, margin_manager, news_filter):
        self.mt5 = mt5_interface
        self.config = config
        self.margin_manager = margin_manager 
        self.news_filter = news_filter
        
        self.last_candle_times = {s['strategy_id']: None for s in config['strategy_instances']}
        self.lockout_until = {s['strategy_id']: pd.Timestamp(0) for s in config['strategy_instances']}
        self.recovery_retry_after = {s['strategy_id']: pd.Timestamp(0) for s in config['strategy_instances']}
        self.active_recovery_trades = {s['strategy_id']: None for s in config['strategy_instances']}
        self.known_open_positions = {s['strategy_id']: False for s in config['strategy_instances']}
        
        self.warmup_strategies()

    def update_configuration(self, config):
        strategy_ids = {item['strategy_id'] for item in config['strategy_instances']}
        self.last_candle_times = {key: self.last_candle_times.get(key) for key in strategy_ids}
        self.lockout_until = {
            key: self.lockout_until.get(key, pd.Timestamp(0)) for key in strategy_ids
        }
        self.recovery_retry_after = {
            key: self.recovery_retry_after.get(key, pd.Timestamp(0)) for key in strategy_ids
        }
        self.active_recovery_trades = {
            key: self.active_recovery_trades.get(key) for key in strategy_ids
        }
        self.known_open_positions = {
            key: self.known_open_positions.get(key, False) for key in strategy_ids
        }
        self.config = config

    def _mask_current_candle(self, df):
        if not self.config.get('STRICT_LOOKAHEAD_PROTECTION', True):
            return df

        safe_df = df.copy()
        if safe_df.empty or 'open' not in safe_df.columns:
            return safe_df

        last_idx = safe_df.index[-1]
        current_open = safe_df.at[last_idx, 'open']
        for column in ('high', 'low', 'close'):
            if column in safe_df.columns:
                safe_df.at[last_idx, column] = current_open
        if 'volume' in safe_df.columns:
            safe_df.at[last_idx, 'volume'] = 0

        ha_columns = {'HA_Open', 'HA_High', 'HA_Low', 'HA_Close'}
        if ha_columns.issubset(safe_df.columns):
            current_ha_open = safe_df.at[last_idx, 'HA_Open']
            safe_df.at[last_idx, 'HA_High'] = current_ha_open
            safe_df.at[last_idx, 'HA_Low'] = current_ha_open
            safe_df.at[last_idx, 'HA_Close'] = current_ha_open

        return safe_df

    def warmup_strategies(self):
        # 🚨 FIX: اگر وارم‌آپ در تنظیمات خاموش بود، کلاً رد شو!
        if not self.config.get('warmup_enabled', True):
            ui_log('warning', "⏭️ Warm-up Phase Skipped by User Configuration.")
            return

        ui_log('warning', "\n🔥 [WARM-UP PHASE] Syncing 'Sacred Rhythm' (100% Backtest Mirror)...")
        
        for s_config in self.config['strategy_instances']:
            strat_id = s_config['strategy_id']
            symbol = s_config['symbol']
            strat = s_config['strategy']
            
            if hasattr(strat, '_reset_state'):
                ErrorManager.safe_execute(strat_id, '_reset_state', strat._reset_state)
            
            lookback = s_config.get('LOOKBACK_PERIOD', 500)
            df = self.mt5.get_candles(symbol, s_config['TIMEFRAME_MT5'], lookback)
            
            if df is None or len(df) < 5: continue
                
            if hasattr(strat, 'prepare_indicators'):
                processed_df = ErrorManager.safe_execute(strat_id, 'prepare_indicators', strat.prepare_indicators, df.copy(), s_config.get('candle_type', 'STANDARD'))
                if processed_df is None: continue
                df = processed_df

            ui_log('warning', f"⏳ Fast-forwarding {len(df)} candles for {strat_id}...")
            
            virtual_real_position = None 
            last_real_trade_log = None 
            
            for i in range(5, len(df) + 1):
                history_slice = df.iloc[:i]
                current_candle = history_slice.iloc[-1]
                
                if virtual_real_position is not None:
                    v_type = virtual_real_position['type']
                    v_sl = virtual_real_position['sl']
                    v_tp = virtual_real_position['tp']
                    
                    is_closed = False
                    exit_reason = ""
                    
                    raw_spread = current_candle.get('spread', 0.0)
                    spread_div = s_config.get('spread_divisor', 1.0)
                    point_val = s_config.get('point_value', 1.0)
                    spread_val = (raw_spread / spread_div) * point_val
                    
                    curr_o = current_candle['open']
                    curr_h = current_candle['high']
                    curr_l = current_candle['low']
                    
                    if v_type == 'buy':
                        if curr_o < v_sl: is_closed = True; exit_reason = "SL (Gap Slippage)"
                        elif curr_o > v_tp: is_closed = True; exit_reason = "TP (Positive Gap)"
                        elif curr_l <= v_sl: is_closed = True; exit_reason = "SL"
                        elif curr_h >= v_tp: is_closed = True; exit_reason = "TP"
                    elif v_type == 'sell':
                        ask_open = curr_o + spread_val
                        ask_high = curr_h + spread_val
                        ask_low = curr_l + spread_val
                        
                        if ask_open > v_sl: is_closed = True; exit_reason = "SL (Gap Slippage)"
                        elif ask_open < v_tp: is_closed = True; exit_reason = "TP (Positive Gap)"
                        elif ask_high >= v_sl: is_closed = True; exit_reason = "SL (Spread)"
                        elif ask_low <= v_tp: is_closed = True; exit_reason = "TP"
                            
                    if is_closed:
                        virtual_real_position['exit_time'] = current_candle.name
                        virtual_real_position['exit_reason'] = exit_reason
                        last_real_trade_log = virtual_real_position.copy()
                        virtual_real_position = None 
                        
                        if hasattr(strat, 'on_exit'):
                            ErrorManager.safe_execute(strat_id, 'on_exit', strat.on_exit)
                    continue 
                
                trade_type, ep, sl, tp = None, None, None, None
                if hasattr(strat, 'check_entry_signal'):
                    safe_history_slice = self._mask_current_candle(history_slice)
                    res = ErrorManager.safe_execute(
                        strat_id, 'check_entry_signal', strat.check_entry_signal, safe_history_slice
                    )
                    trade_type, ep, sl, tp = StrategyValidator.normalize_entry_signal(res)
                
                if trade_type:
                    virtual_real_position = {'type': trade_type, 'entry_price': ep, 'sl': sl, 'tp': tp, 'entry_time': current_candle.name}
                    
            if virtual_real_position is not None:
                vr = virtual_real_position
                ui_log('success', f"   💎 [OPEN REAL] {strat_id} : {vr['type'].upper()} | Opened: {vr['entry_time']} 🔴(STILL RUNNING!)")
                self.active_recovery_trades[strat_id] = vr
                self.known_open_positions[strat_id] = True 
            else:
                self.known_open_positions[strat_id] = False
                
        ui_log('success', "🚀 Warm-up Complete! Engine is LIVE and PERFECTLY SYNCED.\n")

    def process_entries(self):
        for s_config in self.config['strategy_instances']:
            try:
                self._process_single_strategy_entry(s_config)
            except Exception as e:
                ErrorManager.catch_strategy_error(s_config.get('strategy_id', 'Unknown'), "process_entries", e)

    def _process_single_strategy_entry(self, s_config):
        if s_config.get('retired', False):
            return
        strat_id = s_config['strategy_id']
        symbol = s_config['symbol']
        magic = s_config['magic_number']
        strat = s_config['strategy']

        # 🚨 NEWS EMBARGO BLOCKER
        if is_news_embargo_active(symbol, self.config, self.news_filter):
            return # Skip signal generation completely during red news!

        open_positions = self.mt5.get_open_positions()
        has_open_position = any(p.magic == magic for p in open_positions) if open_positions else False

        if self.known_open_positions.get(strat_id, False) and not has_open_position:
            ui_log('warning', f"🔔 [LIVE DETECT] Broker closed position for {strat_id}. Injecting on_exit() rhythm hook.")
            if hasattr(strat, 'on_exit'):
                ErrorManager.safe_execute(strat_id, 'on_exit', strat.on_exit)
        
        self.known_open_positions[strat_id] = has_open_position

        last_candle_df = self.mt5.get_candles(symbol, s_config['TIMEFRAME_MT5'], 1)
        if last_candle_df is None: return
        current_candle_time = last_candle_df.index[0]
        is_new_candle_tick = (current_candle_time != self.last_candle_times.get(strat_id))

        if self.active_recovery_trades[strat_id] is not None:
            if has_open_position:
                ui_log('success', f"✅ [RECOVERY SUCCESS] Position is LIVE! Unlocking Rhythm.")
                self.active_recovery_trades[strat_id] = None
                if is_new_candle_tick: self.last_candle_times[strat_id] = current_candle_time
                return

            if pd.Timestamp.now() < self.recovery_retry_after.get(strat_id, pd.Timestamp(0)):
                return

            recovery_trade = self.active_recovery_trades[strat_id]
            t_type = recovery_trade['type']
            g_entry = recovery_trade['entry_price']
            g_sl = recovery_trade['sl']
            g_tp = recovery_trade['tp']

            pending_orders = mt5_call(mt5.orders_get, symbol=symbol)
            has_pending, pending_ticket = False, None
            if pending_orders:
                for p in pending_orders:
                    if p.magic == magic:
                        has_pending, pending_ticket = True, p.ticket
                        break

            tick = self.mt5.get_symbol_tick(symbol)
            if not tick: return

            is_invalid = False
            if t_type == 'buy' and tick.bid >= g_tp: is_invalid = True
            if t_type == 'sell' and tick.ask <= g_tp: is_invalid = True

            if is_invalid:
                if has_pending:
                    request = {"action": mt5.TRADE_ACTION_REMOVE, "order": pending_ticket}
                    self.mt5.submit_background(
                        ('cancel-recovery', pending_ticket),
                        lambda: mt5_order_send(request, "CANCEL_RECOVERY"),
                    )
                    self.active_recovery_trades[strat_id] = None
                    if hasattr(strat, 'on_exit'): ErrorManager.safe_execute(strat_id, 'on_exit', strat.on_exit)
                else:
                    self.active_recovery_trades[strat_id] = None
                    if hasattr(strat, 'on_exit'): ErrorManager.safe_execute(strat_id, 'on_exit', strat.on_exit)
            else:
                if not has_pending:
                    execute_market = False
                    if (t_type == 'buy' and tick.ask <= g_entry) or (t_type == 'sell' and tick.bid >= g_entry):
                        execute_market = True

                    df_recovery = self.mt5.get_candles(symbol, s_config['TIMEFRAME_MT5'], s_config.get('LOOKBACK_PERIOD', 100))
                    if df_recovery is not None:
                        if hasattr(strat, 'prepare_indicators'):
                            rec_res = ErrorManager.safe_execute(strat_id, 'prepare_indicators', strat.prepare_indicators, df_recovery, s_config.get('candle_type', 'STANDARD'))
                            if rec_res is not None: df_recovery = rec_res
                            
                        if execute_market:
                            self._execute_order(t_type, g_entry, g_sl, g_tp, s_config, df_recovery, current_candle_time, is_recovery=True)
                        else:
                            self._execute_limit_order(t_type, g_entry, g_sl, g_tp, s_config, df_recovery, is_recovery=True)

            if self.active_recovery_trades[strat_id] is not None:
                if self.mt5.tasks.is_pending(('entry', magic)) or self.mt5.tasks.is_pending(('limit-entry', magic)):
                    if is_new_candle_tick: self.last_candle_times[strat_id] = current_candle_time
                    return
                if is_new_candle_tick: self.last_candle_times[strat_id] = current_candle_time
                return

        if has_open_position:
            if is_new_candle_tick: self.last_candle_times[strat_id] = current_candle_time
            return 

        if not is_new_candle_tick: return
        self.last_candle_times[strat_id] = current_candle_time

        df = self.mt5.get_candles(symbol, s_config['TIMEFRAME_MT5'], s_config['LOOKBACK_PERIOD'])
        if df is None: return

        if hasattr(strat, 'prepare_indicators'):
            proc_df = ErrorManager.safe_execute(strat_id, 'prepare_indicators', strat.prepare_indicators, df.copy(), s_config.get('candle_type', 'STANDARD'))
            if proc_df is None: return
            df = proc_df
        
        for rule in s_config.get('MONEY_MANAGEMENT_MODE', []):
            if hasattr(rule, 'prepare_indicators'):
                mm_df = ErrorManager.safe_execute(strat_id, f'MM_{type(rule).__name__}', rule.prepare_indicators, df)
                if mm_df is not None: df = mm_df

        trade_type, entry_anchor, sl_anchor, tp_anchor = None, None, None, None
        if hasattr(strat, 'check_entry_signal'):
            safe_df = self._mask_current_candle(df)
            res = ErrorManager.safe_execute(strat_id, 'check_entry_signal', strat.check_entry_signal, safe_df)
            trade_type, entry_anchor, sl_anchor, tp_anchor = StrategyValidator.normalize_entry_signal(res)

        if trade_type:
            allowed_days = s_config.get('allowed_days', [0, 1, 2, 3, 4, 5, 6])
            if current_candle_time.dayofweek not in allowed_days: return

            killzones = s_config.get('killzones', [])
            if killzones and isinstance(killzones, list) and killzones[0] != "":
                time_str = current_candle_time.strftime('%H:%M')
                if not any(start_t <= time_str <= end_t for zone in killzones for start_t, end_t in [zone.split('-')] if '-' in zone):
                    return

            if pd.Timestamp.now() < self.lockout_until[strat_id]: return
            self._execute_order(trade_type, entry_anchor, sl_anchor, tp_anchor, s_config, df, current_candle_time, is_recovery=False)

    def _execute_order(self, trade_type, entry_anchor, sl_anchor, tp_anchor, s_config, df, current_candle_time, is_recovery=False):
        symbol = s_config['symbol']
        acc_info = self.mt5.get_account_info()
        if acc_info is None: return False
        
        self.margin_manager.update_account_limits(acc_info.balance)
        calc_entry = self.mt5.normalize_price(symbol, entry_anchor)
        final_sl = self.mt5.normalize_price(symbol, sl_anchor)
        final_tp = self.mt5.normalize_price(symbol, tp_anchor)
        s_config['contract_size'] = self.mt5.get_real_contract_size(symbol)

        raw_lot = self._calculate_risk_modular(trade_type, calc_entry, final_sl, final_tp, s_config, df)
        desired_lot = self.mt5.normalize_volume(symbol, raw_lot)

        if desired_lot > 0:
            custom_leverage = s_config.get('leverage', '') 
            safe_raw_lot, trade_margin = self.margin_manager.get_safe_lot_size(
                acc_info.margin, symbol, desired_lot, calc_entry, s_config['contract_size'], custom_leverage
            )
            final_lot = self.mt5.normalize_volume(symbol, safe_raw_lot)

            if final_lot > 0:
                tag = "🔥 [DISCOUNT RECOVERY]" if is_recovery else "💎 Signal Confirmed"
                strat_short = str(s_config['strategy_id'])[:6]
                order_comment = f"{symbol}-Ghost" if is_recovery else f"{symbol}-{strat_short}"
                
                order = dict(symbol=symbol, trade_type=trade_type, volume=final_lot, sl=final_sl, tp=final_tp,
                             magic=s_config['magic_number'], comment=order_comment)

                def execute_entry():
                    if self.mt5.send_market_order(**order):
                        active_lev = custom_leverage if str(custom_leverage).strip() else self.margin_manager.base_leverage
                        ui_log('success', f"✅ FILLED: {trade_type.upper()} {symbol} | Vol: {final_lot} | Leverage Applied: 1:{active_lev}")
                        lock_seconds = s_config.get('TIMEFRAME_SECONDS', 300)
                        self.lockout_until[s_config['strategy_id']] = pd.Timestamp.now() + pd.Timedelta(seconds=lock_seconds)
                        if is_recovery:
                            self.active_recovery_trades[s_config['strategy_id']] = None
                    elif is_recovery:
                        self.recovery_retry_after[s_config['strategy_id']] = pd.Timestamp.now() + pd.Timedelta(seconds=5)

                return self.mt5.submit_background(('entry', s_config['magic_number']), execute_entry)
        return False

    def _execute_limit_order(self, trade_type, entry_anchor, sl_anchor, tp_anchor, s_config, df, is_recovery=False):
        symbol = s_config['symbol']
        acc_info = self.mt5.get_account_info()
        if acc_info is None: return False
        
        self.margin_manager.update_account_limits(acc_info.balance)
        calc_entry = self.mt5.normalize_price(symbol, entry_anchor)
        final_sl = self.mt5.normalize_price(symbol, sl_anchor)
        final_tp = self.mt5.normalize_price(symbol, tp_anchor)
        s_config['contract_size'] = self.mt5.get_real_contract_size(symbol)

        raw_lot = self._calculate_risk_modular(trade_type, calc_entry, final_sl, final_tp, s_config, df)
        desired_lot = self.mt5.normalize_volume(symbol, raw_lot)

        if desired_lot > 0:
            custom_leverage = s_config.get('leverage', '') 
            safe_raw_lot, _ = self.margin_manager.get_safe_lot_size(
                acc_info.margin, symbol, desired_lot, calc_entry, s_config['contract_size'], custom_leverage
            )
            final_lot = self.mt5.normalize_volume(symbol, safe_raw_lot)

            if final_lot > 0:
                active_lev = custom_leverage if str(custom_leverage).strip() else self.margin_manager.base_leverage
                
                mt5_type = mt5.ORDER_TYPE_BUY_LIMIT if trade_type == 'buy' else mt5.ORDER_TYPE_SELL_LIMIT
                smart_filling = self.mt5.get_smart_filling_mode(symbol)
                
                request = {
                    "action": mt5.TRADE_ACTION_PENDING, "symbol": symbol, "volume": float(final_lot),
                    "type": mt5_type, "price": float(calc_entry), "sl": float(final_sl),
                    "tp": float(final_tp), "magic": s_config['magic_number'],
                    "comment": f"{symbol}-Limit", "type_time": mt5.ORDER_TIME_GTC, "type_filling": smart_filling
                }
                def place_limit_order():
                    result = mt5_order_send(request, f"LIMIT_{s_config['strategy_id']}")
                    accepted_codes = {mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED}
                    if result and result.retcode in accepted_codes:
                        ui_log('success', f"🎣 [MT5 LIMIT ACCEPTED] Waiting: {calc_entry} | Vol: {final_lot} | Leverage: 1:{active_lev} | Ticket: {getattr(result, 'order', 0)}")
                        return True

                    retcode = getattr(result, 'retcode', 'NO RESPONSE (see local validation error above)')
                    comment = getattr(result, 'comment', 'MT5 did not return an order result')
                    ui_log('error', f"❌ [MT5 LIMIT REJECTED] {symbol} | Retcode: {retcode} | Reason: {comment}")
                    if is_recovery:
                        self.recovery_retry_after[s_config['strategy_id']] = pd.Timestamp.now() + pd.Timedelta(seconds=5)
                    return False

                self.mt5.submit_background(
                    ('limit-entry', s_config['magic_number']),
                    place_limit_order,
                )
                return True
        return False

    def _calculate_risk_modular(self, trade_type, entry, sl, tp, s_config, df):
        acc = self.mt5.get_account_info()
        context = {
            'equity': acc.equity, 'balance': acc.balance, 'trade_type': trade_type,
            'entry_price': entry, 'stop_loss': sl, 'take_profit': tp,
            'current_candle': df.iloc[-1], 'config': s_config
        }
        lot = 0.0
        risk_rules = s_config.get('MONEY_MANAGEMENT_MODE', [])
        if not isinstance(risk_rules, list): risk_rules = [risk_rules]
        for rule in risk_rules:
            if hasattr(rule, 'calculate_risk_details'):
                res = ErrorManager.safe_execute(s_config['strategy_id'], 'calculate_risk_details', rule.calculate_risk_details, context)
                if res:
                    if isinstance(res, list): lot = res[0].get('lot_size', lot)
                    elif isinstance(res, dict): lot = res.get('lot_size', lot)
        return lot


# ==============================================================================
# 3. Live Position Manager
# ==============================================================================
class LivePositionManager:
    def __init__(self, mt5_interface, config, news_filter):
        self.mt5 = mt5_interface
        self.config = config
        self.news_filter = news_filter
        self.last_processed_candle_time = {s['strategy_id']: None for s in config['strategy_instances']}
        self._partial_closed_tickets = set()
        self._partial_state_lock = threading.Lock()

    def update_configuration(self, config):
        strategy_ids = {item['strategy_id'] for item in config['strategy_instances']}
        self.last_processed_candle_time = {
            key: None for key in strategy_ids
        }
        self.config = config

    def manage_positions(self):
        all_positions = self.mt5.get_open_positions()
        with self._partial_state_lock:
            open_tickets = {position.ticket for position in (all_positions or [])}
            self._partial_closed_tickets.intersection_update(open_tickets)
        if not all_positions: return

        open_magics = {p.magic for p in all_positions}
        for s_config in self.config['strategy_instances']:
            if s_config['magic_number'] not in open_magics: continue
            
            strat_id = s_config['strategy_id']
            strat_positions = [p for p in all_positions if p.magic == s_config['magic_number']]
            
            df = self._get_fresh_data(s_config)
            if df is None: continue
            
            current_candle_time = df.index[-1]
            is_new_candle = (current_candle_time != self.last_processed_candle_time.get(strat_id))
            
            s_config['contract_size'] = self.mt5.get_real_contract_size(s_config['symbol'])

            for pos in strat_positions:
                self._process_position(pos, s_config, df, is_new_candle)

            if is_new_candle:
                self.last_processed_candle_time[strat_id] = current_candle_time

    def _process_position(self, mt5_pos, s_config, df, is_new_candle):
        strat_id = s_config['strategy_id']
        symbol = s_config['symbol']
        
        # 🚨 NEWS EMBARGO FORCE CLOSE (حفاظت بی‌رحمانه در زمان خبر)
        if is_news_embargo_active(symbol, self.config, self.news_filter):
            ui_log('error', f"🚨 [NEWS EMBARGO] Force Closing {symbol} to protect account!")
            self._execute_full_close_guaranteed(mt5_pos, "NEWS_FORCE_CLOSE")
            return

        pos_dict = {
            'ticket': mt5_pos.ticket, 'type': 'buy' if mt5_pos.type == 0 else 'sell',
            'entry_price': mt5_pos.price_open, 'sl': mt5_pos.sl, 'tp': mt5_pos.tp,
            'lot_size': mt5_pos.volume, 'initial_sl': mt5_pos.sl, 
            'partial_closed': "PARTIAL" in mt5_pos.comment or mt5_pos.ticket in self._partial_closed_tickets
        }
        
        closed_candle = df.iloc[-2] 
        current_candle = df.iloc[-1] 
        strat = s_config['strategy']

        risk_rules = s_config.get('MONEY_MANAGEMENT_MODE', [])
        if not isinstance(risk_rules, list): risk_rules = [risk_rules]

        if is_new_candle:
            context_closed = {'position': pos_dict, 'current_candle': closed_candle, 'history_slice': df.iloc[:-1], 'config': s_config}
            for rule in risk_rules:
                if hasattr(rule, 'check_partial_exit'):
                    vol = ErrorManager.safe_execute(strat_id, 'check_partial_exit', rule.check_partial_exit, context_closed)
                    if vol: self._execute_partial(mt5_pos, vol)
                if hasattr(rule, 'update_sl'):
                    new_sl = ErrorManager.safe_execute(strat_id, 'update_sl', rule.update_sl, context_closed)
                    if new_sl:
                        norm_sl = self.mt5.normalize_price(mt5_pos.symbol, new_sl)
                        if norm_sl != mt5_pos.sl:
                            self.mt5.submit_background(
                                ('modify-position', mt5_pos.ticket),
                                lambda ticket=mt5_pos.ticket, symbol=mt5_pos.symbol, stop=norm_sl, target=mt5_pos.tp:
                                    self.mt5.modify_position(ticket, symbol, stop, target),
                            )

        if hasattr(strat, 'check_exit_conditions'):
            res = ErrorManager.safe_execute(strat_id, 'check_exit_conditions', strat.check_exit_conditions, current_candle, df, pos_dict)
            if res and isinstance(res, tuple) and len(res) == 2: 
                exit_price, reason = res
                if exit_price: self._execute_full_close(mt5_pos, exit_price, reason)

    def _execute_partial(self, mt5_pos, vol):
        def close_partial():
            tick = self.mt5.get_symbol_tick(mt5_pos.symbol)
            if not tick:
                return False
            price = tick.bid if mt5_pos.type == 0 else tick.ask
            success = self.mt5.close_partial(mt5_pos.ticket, mt5_pos.symbol, vol, 1 if mt5_pos.type == 0 else 0, price)
            if success:
                with self._partial_state_lock:
                    self._partial_closed_tickets.add(mt5_pos.ticket)
            return success

        self.mt5.submit_background(('partial-close', mt5_pos.ticket), close_partial)

    def _execute_full_close(self, mt5_pos, price, reason):
        def close_position():
            close_price = price
            if not isinstance(close_price, (int, float)):
                tick = self.mt5.get_symbol_tick(mt5_pos.symbol)
                if not tick:
                    return False
                close_price = tick.bid if mt5_pos.type == 0 else tick.ask
            return self.mt5.close_full(mt5_pos.ticket, mt5_pos.symbol, mt5_pos.volume,
                                       1 if mt5_pos.type == 0 else 0, close_price, reason)

        return self.mt5.submit_background(('full-close', mt5_pos.ticket), close_position)

    def _execute_full_close_guaranteed(self, mt5_pos, reason, max_retries=15):
        """
        مکانیسم سماجت (Guaranteed Execution):
        در زمان انتشار خبر به دلیل نوسانات شدید، ممکن است بروکر درخواست بستن را Reject کند.
        این حلقه تا زمانی که معامله با موفقیت بسته شود، درخواست را تکرار می‌کند.
        """
        def retry_close():
            for attempt in range(1, max_retries + 1):
                open_positions = self.mt5.get_open_positions(mt5_pos.symbol)
                if open_positions is not None and not any(position.ticket == mt5_pos.ticket for position in open_positions):
                    return True
                tick = self.mt5.get_symbol_tick(mt5_pos.symbol)
                if not tick:
                    os_time.sleep(0.5)
                    continue
                price = tick.bid if mt5_pos.type == 0 else tick.ask
                if self.mt5.close_full(mt5_pos.ticket, mt5_pos.symbol, mt5_pos.volume,
                                       1 if mt5_pos.type == 0 else 0, price, reason):
                    return True
                ui_log('warning', f"⚠️ [RETRY {attempt}/{max_retries}] Broker rejected News Force-Close for {mt5_pos.symbol}. Retrying...")
                os_time.sleep(1.0)

            ui_log('error', f"❌ [FATAL ERROR] Could not close position {mt5_pos.ticket} during NEWS EMBARGO after {max_retries} attempts!")
            return False

        return self.mt5.submit_background(('guaranteed-close', mt5_pos.ticket), retry_close)

    def _get_fresh_data(self, s_config):
        df = self.mt5.get_candles(s_config['symbol'], s_config['TIMEFRAME_MT5'], s_config.get('LOOKBACK_PERIOD', 100))
        if df is None or len(df) < 2: return None
        strat = s_config['strategy']
        if hasattr(strat, 'prepare_indicators'):
            proc_df = ErrorManager.safe_execute(s_config['strategy_id'], 'prepare_indicators', strat.prepare_indicators, df, s_config.get('candle_type', 'STANDARD'))
            if proc_df is not None: df = proc_df
        for rule in s_config.get('MONEY_MANAGEMENT_MODE', []):
            if hasattr(rule, 'prepare_indicators'): 
                mm_df = ErrorManager.safe_execute(s_config['strategy_id'], f'MM_{type(rule).__name__}', rule.prepare_indicators, df)
                if mm_df is not None: df = mm_df
        return df


# ==============================================================================
# 4. Live Trader Main Engine Call
# ==============================================================================
class LiveTrader:
    def __init__(self, config):
        self.config = config
        ui_log('success', f"🚀 Initializing Live Trader V5.0 (Enterprise Zero-Crash Edition)...")
        self.mt5_interface = MT5Interface(config.get("MT5_PATH"))
        
        acc_info = self.mt5_interface.get_account_info()
        if acc_info is not None:
            config['leverage'] = float(acc_info.leverage)
        
        self.margin_manager = MarginManager(config)
        self.target_lock = TargetLockManager(config)  
        
        from services.news_daemon import NewsFilter
        self.news_filter = NewsFilter()
        
        self.signal_engine = LiveSignalEngine(self.mt5_interface, config, self.margin_manager, self.news_filter)
        self.position_manager = LivePositionManager(self.mt5_interface, config, self.news_filter)
        self._retired_strategy_ids = set()
        self._deferred_strategy_configs = {}

    def refresh_configuration(self, config):
        config['MT5_PATH'] = self.config.get('MT5_PATH', config.get('MT5_PATH'))
        current_by_id = {
            item['strategy_id']: item for item in self.config.get('strategy_instances', [])
        }
        current_positions = self.mt5_interface.get_open_positions()
        if current_positions is None:
            return False
        open_magics = {position.magic for position in current_positions}
        incoming_items = config.get('strategy_instances', [])
        incoming_ids = {item['strategy_id'] for item in incoming_items}
        reconciled = []

        for item in incoming_items:
            strategy_id = item['strategy_id']
            existing = current_by_id.get(strategy_id)
            if existing and existing['magic_number'] in open_magics and (
                existing['magic_number'] != item['magic_number'] or existing['symbol'] != item['symbol']
            ):
                self._deferred_strategy_configs[strategy_id] = item
                retained = dict(existing, retired=True)
                reconciled.append(retained)
                self._retired_strategy_ids.add(strategy_id)
                continue

            if item['magic_number'] in open_magics and existing is None:
                self._deferred_strategy_configs[strategy_id] = item
                continue

            if existing is not None:
                item.pop('retired', None)
                self._retired_strategy_ids.discard(strategy_id)
            reconciled.append(item)

        for strategy_id, existing in current_by_id.items():
            if strategy_id in incoming_ids:
                continue
            if existing['magic_number'] in open_magics:
                reconciled.append(dict(existing, retired=True))
                self._retired_strategy_ids.add(strategy_id)
            else:
                self._retired_strategy_ids.discard(strategy_id)

        config['strategy_instances'] = reconciled
        self._apply_configuration(config)
        return True

    def prune_retired_strategies(self):
        if not self._retired_strategy_ids and not self._deferred_strategy_configs:
            return

        open_positions = self.mt5_interface.get_open_positions()
        if open_positions is None:
            return
        open_magics = {position.magic for position in open_positions}
        kept = []
        changed = False
        for item in self.config['strategy_instances']:
            if item['strategy_id'] in self._retired_strategy_ids and item['magic_number'] not in open_magics:
                self._retired_strategy_ids.discard(item['strategy_id'])
                changed = True
                continue
            kept.append(item)

        for strategy_id, item in list(self._deferred_strategy_configs.items()):
            if item['magic_number'] not in open_magics:
                self._deferred_strategy_configs.pop(strategy_id, None)
                kept = [current for current in kept if current['strategy_id'] != strategy_id]
                item.pop('retired', None)
                kept.append(item)
                self._retired_strategy_ids.discard(strategy_id)
                changed = True

        if changed:
            config = dict(self.config, strategy_instances=kept)
            self._apply_configuration(config)

    def _apply_configuration(self, config):
        self.config = config
        self.margin_manager.update_configuration(config)
        self.target_lock.update_configuration(config)
        self.signal_engine.update_configuration(config)
        self.position_manager.update_configuration(config)

    def run(self):
        ui_log('success', "🟢 Universal Bot is Active and Listening to the Market...")
        net_warned = False
        while True:
            try:
                if not self.mt5_interface.is_connected():
                    if not net_warned:
                        ui_log('error', "⚠️ [NETWORK ALERT] Connection to Broker Lost. Waiting...")
                        net_warned = True
                    os_time.sleep(3)
                    continue
                elif net_warned:
                    ui_log('success', "✅ [NETWORK RESTORED] Reconnected to Broker Server.")
                    net_warned = False

                if self.target_lock.check_and_lock(self.mt5_interface):
                    ui_log('success', '🎯 Target Equity Hit! Positions secured and engine halted.')
                    robot_running = False
                    break
                
                self.position_manager.manage_positions()
                self.signal_engine.process_entries()
                
                if mt5_call(mt5.terminal_info):
                    acc = mt5_call(mt5.account_info)
                    if acc:
                        pos_count = mt5_call(mt5.positions_total)
                        # UI Update call would be here normally, handled via Main.py in your app
                        
                os_time.sleep(1)
                
            except KeyboardInterrupt:
                ui_log('warning', "\n🛑 Stopped by User.")
                mt5_call(mt5.shutdown)
                break
            except Exception as e:
                ErrorManager.catch_strategy_error("CORE_ENGINE", "Main_Loop", e)
                os_time.sleep(5)