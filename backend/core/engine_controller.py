import threading
import time
import os
import sys
import re
import ast

# --- 1. SYSTEM PATH INJECTION ---
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import MetaTrader5 as mt5
import eel
import storage.json_manager as jm
from core.trading_engine import LiveTrader
from trading.config_builder import create_symbol_config 
from core.error_handler import ErrorManager, ui_log
from core.mt5_runtime import mt5_call
from trading.risk_manager import (FixedRiskAmountRule, FixedLotRule, PercentRiskRule, BreakevenHandler, PartialCloseRule)

# --- 2. ENGINE STATES ---
robot_running = False
trade_thread = None
live_trader_instance = None
engine_state_lock = threading.RLock()
configuration_refresh_event = threading.Event()

def get_broker_time_ms(symbols, clock_state):
    monotonic_now = time.monotonic()
    tick_times = []
    for symbol in symbols:
        tick = mt5_call(mt5.symbol_info_tick, symbol)
        if tick:
            tick_time_ms = getattr(tick, 'time_msc', 0) or int(tick.time * 1000)
            if tick_time_ms > 0:
                tick_times.append(tick_time_ms)

    if tick_times:
        latest_tick_ms = max(tick_times)
        if clock_state.get('tick_time_ms') is None:
            clock_state['tick_time_ms'] = latest_tick_ms
            clock_state['monotonic_at'] = monotonic_now

    if clock_state.get('tick_time_ms') is None:
        return None

    estimated_time_ms = clock_state['tick_time_ms'] + int(
        (monotonic_now - clock_state['monotonic_at']) * 1000
    )
    if tick_times and latest_tick_ms > estimated_time_ms:
        clock_state['tick_time_ms'] = latest_tick_ms
        clock_state['monotonic_at'] = monotonic_now
        estimated_time_ms = latest_tick_ms

    return estimated_time_ms

def sanitize_days_list(raw_val):
    try:
        if isinstance(raw_val, str): 
            return [int(n) for n in re.findall(r'\d+', raw_val) if 0 <= int(n) <= 6]
        elif isinstance(raw_val, (list, tuple)): 
            return [int(d) for d in raw_val if str(d).isdigit() and 0 <= int(d) <= 6]
    except: pass
    return [0, 1, 2, 3, 4]

def validate_number(val, cast_type, field_name):
    """
    Security Guard: Ensures the configuration field is neither empty nor invalid.
    """
    if str(val).strip() == '':
        raise ValueError(f"Configuration Error: The field '{field_name}' is empty! Please provide a valid number.")
    try:
        return cast_type(val)
    except ValueError:
        raise ValueError(f"Configuration Error: The value entered for '{field_name}' is invalid. Please enter numerical values only.")

def validate_string(val, field_name):
    """
    Security Guard: Ensures required text fields (like Symbol) are not empty.
    """
    clean_val = str(val).strip()
    if not clean_val:
        raise ValueError(f"Configuration Error: The text field '{field_name}' cannot be empty!")
    return clean_val


def build_live_config():
    source = jm.get_live_configuration_source()
    user_settings = source['settings']
    mt5_path = user_settings.get("mt5_path")
    is_pro_plan = str(user_settings.get('plan', 'Basic')).strip().lower() in {'pro', 'advance'}
    
    # --- 🛡️ Global Settings Validation Layer ---
    try:
        global_be_enabled = is_pro_plan and user_settings.get('be_enabled', False)
        global_be_trigger = validate_number(user_settings.get('be_trigger', 1.0), float, 'Breakeven Trigger')
        
        global_pc_enabled = is_pro_plan and user_settings.get('pc_enabled', False)
        global_pc_vol = validate_number(user_settings.get('pc_volume', 50.0), float, 'Partial Volume (%)')
        global_pc_trigger = validate_number(user_settings.get('pc_trigger', 2.0), float, 'Partial Trigger')
        
        global_tl_enabled = is_pro_plan and user_settings.get('tl_enabled', False)
        global_tl_trigger = validate_number(user_settings.get('tl_trigger', 10200.0), float, 'Daily Target Lock')
            
        global_wu_enabled = is_pro_plan and user_settings.get('wu_enabled', True)
        global_wu_candles = validate_number(user_settings.get('wu_candles', 500), int, 'Warm-up Candles')
        
        margin_enabled = user_settings.get('margin_enabled', False)
        margin_limit = validate_number(user_settings.get('margin_limit', 50.0), float, 'Max Margin Limit (%)')
        
        nf_enabled = is_pro_plan and user_settings.get('nf_enabled', False)
        nf_eur = user_settings.get('nf_eur', True)
        nf_usd = user_settings.get('nf_usd', True)
        nf_before = validate_number(user_settings.get('nf_before', 30), int, 'News Filter (Mins Before)')
        nf_after = validate_number(user_settings.get('nf_after', 30), int, 'News Filter (Mins After)')

    except ValueError as ve:
        raise ValueError(str(ve)) from ve

    strategy_instances_config = []
    tf_map = { "M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 16385, "H4": 16388, "D1": 16408 }

    for name, data in source['strategies'].items():
        try:
            cls, params, cfg = data["class"], data["params"], data["config"]
            strat_mm_rules = []
            
            # 🛡️ Validating crucial strategy fields
            symbol = validate_string(cfg.get("symbol", ""), f"Symbol in strategy '{name}'")
            magic_number = validate_number(cfg.get("magic_number", 0), int, f"Magic Number in strategy '{name}'")
            
            risk_mode = cfg.get('risk_mode', 'fixed_usd')
            risk_val = validate_number(cfg.get('risk_value', 100.0), float, f"Risk Value in strategy '{name}'")
            
            if risk_mode == 'fixed_usd': strat_mm_rules.append(FixedRiskAmountRule(risk_val))
            elif risk_mode == 'fixed_lot': strat_mm_rules.append(FixedLotRule(risk_val))
            elif risk_mode == 'percentage': strat_mm_rules.append(PercentRiskRule(risk_val))
            
            if global_be_enabled: strat_mm_rules.append(BreakevenHandler(global_be_trigger))
            if global_pc_enabled: strat_mm_rules.append(PartialCloseRule(global_pc_trigger, global_pc_vol/100.0))

            clean_days = sanitize_days_list(cfg.get('allowed_days', [0, 1, 2, 3, 4]))
            
            cfg['allowed_days'] = params['allowed_days'] = params['ALLOWED_DAYS'] = params['Allowed_Days'] = clean_days
            kz = cfg.get("killzones", [])
            if isinstance(kz, str):
                try: kz = ast.literal_eval(kz)
                except Exception: kz = []
            if not isinstance(kz, list): kz = []
            cfg['killzones'] = params['killzones'] = params['KILLZONES'] = kz

            ui_log('success', f"🛠 Instantiating Strategy: {name}...")
            strat_instance = cls(params)
            selected_tf = tf_map.get(cfg.get("timeframe", "M5"), 5)
            final_lookback = global_wu_candles if global_wu_enabled else cfg.get("lookback", 500)
            
            sym_config = create_symbol_config(
                symbol=symbol, strategy_instance=strat_instance, mm_rules=strat_mm_rules,
                timeframe_mt5=selected_tf, magic_number=magic_number, lookback=final_lookback,
                point_value=cfg.get("point_value", 1.0), adjustment_pips=cfg.get("adjustment_pips", 0),
                candle_type=cfg.get("candle_type", "STANDARD"), contract_size=cfg.get("contract_size", None),
                allowed_days=clean_days, killzones=cfg.get("killzones", []), custom_seconds=cfg.get("TIMEFRAME_SECONDS", 300)
            )
            sym_config['leverage'] = cfg.get('leverage', '')
            strategy_instances_config.append(sym_config)
            
        except ValueError as ve:
            # Trap empty risk/symbol fields gracefully
            if "Configuration Error:" in str(ve):
                raise ValueError(str(ve)) from ve
            else:
                ErrorManager.catch_strategy_error(name, "Initialization", ve)
        except Exception as e: 
            ErrorManager.catch_strategy_error(name, "Initialization", e)

    margin_limit_pct = (margin_limit / 100.0) if margin_enabled else 1.0 

    LIVE_CONFIG = { 
        "MT5_PATH": mt5_path, "TARGET_LOCK_ENABLED": global_tl_enabled, "TARGET_EQUITY": global_tl_trigger,
        "margin_limit_pct": margin_limit_pct, "warmup_enabled": global_wu_enabled,
        "nf_enabled": nf_enabled, "nf_eur": nf_eur,
        "nf_usd": nf_usd, "nf_before": nf_before,
        "nf_after": nf_after, "strategy_instances": strategy_instances_config 
    }
    
    return LIVE_CONFIG


def request_configuration_refresh():
    configuration_refresh_event.set()
    return True


# --- 3. MAIN MARKET LOOP ---
def run_trading_engine():
    global live_trader_instance, robot_running

    try:
        LIVE_CONFIG = build_live_config()
    except ValueError as error:
        ui_log('error', str(error))
        robot_running = False
        return

    if not LIVE_CONFIG['strategy_instances']:
        ui_log('error', 'No valid configurations constructed. Engine halted.')
        robot_running = False
        return

    mt5_path = LIVE_CONFIG.get('MT5_PATH')
    try:
        eel.update_status('warning', 'Initializing MT5 Connection Protocol...')
        if mt5_path and not os.path.exists(mt5_path):
            eel.update_status('error', 'MT5 Terminal path not found!')
            robot_running = False
            return
            
        live_trader_instance = LiveTrader(LIVE_CONFIG)
        eel.update_status('success', f"Engine Active with {len(LIVE_CONFIG['strategy_instances'])} Strategies.")
        broker_clock_state = {'tick_time_ms': None, 'monotonic_at': None}
        broker_symbols = list(dict.fromkeys(
            config.get('symbol')
            for config in LIVE_CONFIG['strategy_instances']
            if config.get('symbol')
        ))
        for symbol in broker_symbols:
            if not mt5_call(mt5.symbol_select, symbol, True):
                ui_log('warning', f'Could not enable {symbol} in Market Watch for broker-time updates.')
        
        while robot_running:
            if configuration_refresh_event.is_set():
                configuration_refresh_event.clear()
                try:
                    refreshed_config = build_live_config()
                    if live_trader_instance.refresh_configuration(refreshed_config):
                        ui_log('success', 'Live trading configuration refreshed.')
                    else:
                        configuration_refresh_event.set()
                        ui_log('warning', 'Live config refresh deferred because the broker position query failed.')
                except ValueError as error:
                    ui_log('error', f'Configuration refresh rejected; previous configuration remains active: {error}')

            if live_trader_instance.target_lock.check_and_lock(live_trader_instance.mt5_interface):
                ui_log('success', '🎯 Target Equity Hit! Positions secured and engine halted.')
                robot_running = False
                break
            
            live_trader_instance.position_manager.manage_positions()
            live_trader_instance.prune_retired_strategies()
            live_trader_instance.signal_engine.process_entries()
            
            if mt5_call(mt5.terminal_info):
                acc = mt5_call(mt5.account_info)
                if acc:
                    pos_count = mt5_call(mt5.positions_total)
                    broker_time_ms = get_broker_time_ms(broker_symbols, broker_clock_state)
                    eel.update_dashboard(round(acc.profit, 2), round(acc.equity, 2), pos_count, broker_time_ms)
            time.sleep(1)
            
    except Exception as e:
        import traceback
        err_trace = traceback.format_exc()
        print(f"❌ Engine Crash:\n{err_trace}")
        crash_location = "Unknown Location"
        try: crash_location = [line.strip() for line in err_trace.split('\n') if 'File "' in line][-1]
        except: pass
        eel.update_status('error', f'Fatal Error: {str(e)} | Location: {crash_location}')
    finally:
        with engine_state_lock:
            robot_running = False
        if live_trader_instance is not None:
            live_trader_instance.mt5_interface.tasks.shutdown(wait=True)

# --- 4. ENGINE COMMANDS ---
def start_robot():
    global robot_running, trade_thread
    with engine_state_lock:
        if robot_running:
            return
        if trade_thread is not None and trade_thread.is_alive():
            eel.update_status('warning', 'Engine is still shutting down. Please wait before restarting.')
            return
        if not jm.strategies_store:
            eel.update_status('error', 'No strategies loaded. Engine halted.')
            return
        configuration_refresh_event.clear()
        ui_log('success', "▶️ Starting Engine with All Strategies...")
        robot_running = True
        trade_thread = threading.Thread(target=run_trading_engine, daemon=True)
        trade_thread.start()

def stop_robot(wait=False, timeout=30.0):
    global robot_running
    ui_log('warning', "⏹️ Stopping Engine...")
    with engine_state_lock:
        robot_running = False
    eel.update_status('warning', 'Halting Engine...')
    current_thread = threading.current_thread()
    if wait and trade_thread is not None and trade_thread is not current_thread:
        trade_thread.join(timeout=timeout)
        if trade_thread.is_alive():
            raise TimeoutError('Trading engine did not finish its active broker tasks before shutdown.')