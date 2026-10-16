import json
import os
import sys
import copy
import threading
from functools import wraps
from pathlib import Path
from runtime_paths import copy_seed_if_missing, resource_path, writable_backend_dir

# --- 1. SYSTEM PATH INJECTION ---
# Add the backend directory to the import path before loading package modules.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Load the system security module.
from security.system_shield import SystemShield

from core.error_handler import ErrorManager, ui_log
from trading.strategy_loader import StrategyLoader

# --- 2. CONFIGS ---
GLOBAL_SETTINGS_DEFAULTS = {
    "mt5_path": "", "margin_enabled": False, "margin_limit": 50.0, 
    "leverage": "", "filling_mode": "FOK", "risk_mode": "fixed_usd", 
    "risk_value": 100.0, "be_enabled": False, "be_trigger": 1.0, 
    "pc_enabled": False, "pc_volume": 50.0, "pc_trigger": 2.0, 
    "tl_enabled": False, "tl_trigger": 10200.0, "wu_enabled": True, "wu_candles": 500,
    "nf_enabled": False, "nf_eur": True, "nf_usd": True, 
    "nf_before": 30, "nf_after": 30
}

DEFAULT_STRATEGY_CONFIG = {
    "symbol": "XAUUSD", "magic_number": 777888, "timeframe": "M5",
    "lookback": 500, "point_value": 1.0, "adjustment_pips": 0,
    "candle_type": "STANDARD", "contract_size": None,
    "allowed_days": [0, 1, 2, 3, 4], "killzones": [], "TIMEFRAME_SECONDS": 300,
    "leverage": "" 
}

BACKTEST_SETTINGS_DEFAULTS = {
    "initial_capital": 10000.0,
    "start_date": "2023-01-01",
    "lookback_period": 500,
    "lookback_enabled": True,
    "leverage": 100.0,
    "margin_limit_enabled": False,
    "margin_limit_pct": 100.0,
    "strict_lookahead_protection": True,
    "be_enabled": False,
    "be_trigger": 1.0,
    "pc_enabled": False,
    "pc_volume": 50.0,
    "pc_trigger": 2.0,
}

DEFAULT_BACKTEST_STRATEGY_CONFIG = {
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "TIMEFRAME_SECONDS": 300,
    "lookback": 500,
    "spread_divisor": 100.0,
    "commission_per_lot": 0.0,
    "point_value": 1.0,
    "contract_size": 100.0,
    "tick_size": 0.01,
    "candle_type": "STANDARD",
    "risk_mode": "fixed_usd",
    "risk_value": 100.0,
    "allowed_days": [0, 1, 2, 3, 4],
    "killzones": [],
    "leverage": "",
}

# Use the writable storage directory for persistent user data.
if getattr(sys, 'frozen', False):
    STORAGE_DIR = str(writable_backend_dir() / "storage")
    BUNDLED_SETTINGS_FILE = resource_path('backend', 'build_assets', 'default_user_settings.json')
    BUNDLED_STRATEGIES_FILE = resource_path('backend', 'build_assets', 'active_strategies.json')
else:
    STORAGE_DIR = os.path.join(BACKEND_DIR, "storage")
    BUNDLED_SETTINGS_FILE = Path(STORAGE_DIR) / 'user_settings.json'
    BUNDLED_STRATEGIES_FILE = Path(STORAGE_DIR) / 'active_strategies.json'
SETTINGS_FILE = os.path.join(STORAGE_DIR, 'user_settings.json')
STRATEGIES_FILE = os.path.join(STORAGE_DIR, 'active_strategies.json')
BACKTEST_SETTINGS_FILE = os.path.join(STORAGE_DIR, 'backtest_settings.json')
BACKTEST_STRATEGIES_FILE = os.path.join(STORAGE_DIR, 'backtest_strategies.json')

# --- 3. GLOBAL STORE ---
strategies_store = {}
backtest_strategies_store = {}
STORE_LOCK = threading.RLock()


def synchronized_store(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with STORE_LOCK:
            return function(*args, **kwargs)

    return wrapped

def _default_settings():
    """Return a clean, independent copy of the default settings."""
    return copy.deepcopy(GLOBAL_SETTINGS_DEFAULTS)


def _default_backtest_settings():
    return copy.deepcopy(BACKTEST_SETTINGS_DEFAULTS)


def _backtest_config_from_live(live_config=None, saved_config=None):
    config = copy.deepcopy(DEFAULT_BACKTEST_STRATEGY_CONFIG)
    shared_config_keys = (
        'symbol', 'timeframe', 'TIMEFRAME_SECONDS', 'lookback', 'candle_type',
        'allowed_days', 'killzones', 'risk_mode', 'risk_value', 'leverage',
    )
    for key in shared_config_keys:
        if key in (live_config or {}):
            config[key] = copy.deepcopy(live_config[key])
    config.update(saved_config or {})
    return config


def _sync_backtest_strategy(name, live_item):
    saved_item = backtest_strategies_store.get(name, {})
    backtest_strategies_store[name] = {
        'class': live_item.get('class'),
        'file_path': live_item.get('file_path', ''),
        'params': live_item.setdefault('params', {}),
        'config': _backtest_config_from_live(live_item.get('config'), saved_item.get('config')),
    }

# --- 4. STORAGE METHODS ---
@synchronized_store
def _ensure_storage_files():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR, exist_ok=True)
    if not os.path.exists(SETTINGS_FILE):
        if BUNDLED_SETTINGS_FILE.exists():
            copy_seed_if_missing(BUNDLED_SETTINGS_FILE, SETTINGS_FILE)
        else:
            with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(GLOBAL_SETTINGS_DEFAULTS, f, indent=4)
    if not os.path.exists(STRATEGIES_FILE):
        if BUNDLED_STRATEGIES_FILE.exists():
            copy_seed_if_missing(BUNDLED_STRATEGIES_FILE, STRATEGIES_FILE)
        else:
            with open(STRATEGIES_FILE, 'w', encoding='utf-8') as f:
                json.dump({}, f, indent=4)
    if not os.path.exists(BACKTEST_SETTINGS_FILE):
        with open(BACKTEST_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(BACKTEST_SETTINGS_DEFAULTS, f, indent=2)
    if not os.path.exists(BACKTEST_STRATEGIES_FILE):
        with open(BACKTEST_STRATEGIES_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, indent=2)

@synchronized_store
def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        save_settings_to_file(GLOBAL_SETTINGS_DEFAULTS)
        return GLOBAL_SETTINGS_DEFAULTS
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            merged = _default_settings()
            merged.update(data)
            
            # Decrypt sensitive keys when loading settings from disk.
            if 'gemini_api_key' in merged:
                merged['gemini_api_key'] = SystemShield.decrypt_data(merged['gemini_api_key'])
                
            return merged
    except Exception:
        pass
    return _default_settings()

@synchronized_store
def save_settings_to_file(data):
    _ensure_storage_files()
    payload = _default_settings()
    
    # Merge the previous values with the new settings.
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
            payload.update(current_data)
    except: pass

    if isinstance(data, dict):
        payload.update(data)
        
    # Encrypt sensitive keys before writing settings to disk.
    if 'gemini_api_key' in payload and payload['gemini_api_key']:
        payload['gemini_api_key'] = SystemShield.encrypt_data(payload['gemini_api_key'])

    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    return {'success': True, 'path': SETTINGS_FILE}

@synchronized_store
def _write_active_strategies():
    """Persist strategy settings without serializing class objects."""
    _ensure_storage_files()
    data_to_save = {}
    for name, item in strategies_store.items():
        data_to_save[name] = {
            'file_path': item.get('file_path', ''),
            'params': item.get('params', {}),
            'config': item.get('config', {})
        }
        
    try:
        with open(STRATEGIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, indent=4)
        ui_log('success', "💾 Strategies Configuration Saved.")
    except Exception as e:
        ui_log('error', f"❌ Error Saving Strategies: {e}")

@synchronized_store
def load_saved_strategies_disk():
    global strategies_store
    _ensure_storage_files()
    
    ui_log('warning', "🔄 Restoring Saved Strategies...")
    try:
        with open(STRATEGIES_FILE, 'r', encoding='utf-8') as f:
            saved_data = json.load(f)
            
        loader = StrategyLoader()
        
        for name, data in saved_data.items():
            path = data.get("file_path")
            if not path or not os.path.exists(path): 
                continue
                
            try:
                loaded_classes = loader.load_strategies_from_file(path)
                if name in loaded_classes:
                    strategies_store[name] = {
                        "class": loaded_classes[name], 
                        "file_path": path,
                        "params": data.get("params", {}), 
                        "config": data.get("config", {})
                    }
                    ui_log('success', f"✅ Restored Strategy: {name}")
            except Exception as e:
                ErrorManager.catch_strategy_error(name, "Restore From Disk", e)
    except Exception as e:
        ui_log('error', f"❌ Error Loading Strategies JSON: {e}")

    load_saved_backtest_strategies_disk()

@synchronized_store
def get_strategies_for_frontend():
    """Build a frontend-safe payload without Python class objects."""
    frontend_payload = {}
    for name, item in strategies_store.items():
        frontend_payload[name] = {
            'params': item.get('params', {}),
            'config': item.get('config', {}),
        }
    return frontend_payload

@synchronized_store
def get_live_configuration_source():
    return {
        'settings': load_settings(),
        'strategies': {
            name: {
                'class': item['class'],
                'params': copy.deepcopy(item.get('params', {})),
                'config': copy.deepcopy(item.get('config', {})),
            }
            for name, item in strategies_store.items()
        },
    }


@synchronized_store
def load_custom_strategy(file_path, max_strategies=None):
    global strategies_store
    if not file_path or not os.path.exists(file_path):
        return {'success': False, 'message': 'Strategy file not found.'}

    loader = StrategyLoader()
    try:
        ui_log('warning', f"🔄 Loading Python file: {file_path}")
        strategy_classes = loader.load_strategies_from_file(file_path)
        new_strategy_count = sum(name not in strategies_store for name in strategy_classes)
        if max_strategies is not None and len(strategies_store) + new_strategy_count > max_strategies:
            return {'success': False, 'message': 'BASIC_LIMIT_STRATEGIES'}
        discovered_params = loader.extract_params_for_classes(file_path)
        
        newly_added = []
        for strategy_name, cls_obj in strategy_classes.items():
            params = discovered_params.get(strategy_name, {})
            
            # Copy the defaults and assign a distinct magic number to each strategy.
            adv_config = copy.deepcopy(DEFAULT_STRATEGY_CONFIG)
            adv_config['magic_number'] += (len(strategies_store) * 100) + 10
            
            strategies_store[strategy_name] = {
                'class': cls_obj,
                'file_path': file_path,
                'params': params,
                'config': adv_config,
            }
            _sync_backtest_strategy(strategy_name, strategies_store[strategy_name])
            newly_added.append(strategy_name)
            
        ui_log('success', f"✅ Successfully Loaded Strategies: {newly_added}")
        _write_active_strategies()
        _write_backtest_strategies()
        return {'success': True, 'strategies': get_strategies_for_frontend()}
        
    except Exception as e:
        ErrorManager.catch_strategy_error("Loader", "load_custom_strategy", e)
        return {'success': False, 'message': str(e)}

@synchronized_store
def remove_strategy(strategy_name):
    global strategies_store
    if strategy_name in strategies_store:
        del strategies_store[strategy_name]
        backtest_strategies_store.pop(strategy_name, None)
        ui_log('warning', f"🗑️ Removed Strategy: {strategy_name}")
        _write_active_strategies()
        _write_backtest_strategies()
    return get_strategies_for_frontend()

@synchronized_store
def update_strategy_config(strategy_name, config_type, new_data):
    if strategy_name in strategies_store:
        strategies_store[strategy_name][config_type].update(new_data)
        _write_active_strategies()
    return True

@synchronized_store
def update_strategy_param(strategy_name, param_key, new_value):
    if strategy_name in strategies_store:
        strategies_store[strategy_name]['params'][param_key] = new_value
        if strategy_name in backtest_strategies_store:
            backtest_strategies_store[strategy_name]['params'] = strategies_store[strategy_name]['params']
        _write_active_strategies()
        _write_backtest_strategies()
        return True
    return False

@synchronized_store
def clear_active_strategy():
    global strategies_store
    strategies_store = {}
    backtest_strategies_store.clear()
    _write_active_strategies()
    _write_backtest_strategies()
    ui_log('warning', "🗑️ All Strategies Cleared.")
    return get_strategies_for_frontend()


# --- 5. BACKTEST STORAGE METHODS ---
@synchronized_store
def load_backtest_settings():
    _ensure_storage_files()
    try:
        with open(BACKTEST_SETTINGS_FILE, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
        merged = _default_backtest_settings()
        if isinstance(data, dict):
            merged.update(data)
        return merged
    except Exception:
        return _default_backtest_settings()


@synchronized_store
def save_backtest_settings_to_file(data):
    _ensure_storage_files()
    payload = _default_backtest_settings()
    try:
        with open(BACKTEST_SETTINGS_FILE, 'r', encoding='utf-8') as handle:
            payload.update(json.load(handle))
    except Exception:
        pass
    if isinstance(data, dict):
        payload.update(data)
    with open(BACKTEST_SETTINGS_FILE, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)
    return {'success': True, 'path': BACKTEST_SETTINGS_FILE}


@synchronized_store
def _write_backtest_strategies():
    _ensure_storage_files()
    payload = {}
    for name, item in backtest_strategies_store.items():
        payload[name] = {
            'file_path': item.get('file_path', ''),
            'params': item.get('params', {}),
            'config': item.get('config', {}),
        }
    with open(BACKTEST_STRATEGIES_FILE, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)


@synchronized_store
def load_saved_backtest_strategies_disk():
    global backtest_strategies_store
    _ensure_storage_files()
    try:
        with open(BACKTEST_STRATEGIES_FILE, 'r', encoding='utf-8') as handle:
            saved_data = json.load(handle)
        loader = StrategyLoader()
        for name, data in saved_data.items():
            live_item = strategies_store.get(name)
            path = data.get('file_path', '')
            if live_item is None and path and os.path.exists(path):
                classes = loader.load_strategies_from_file(path)
                cls_obj = classes.get(name)
                if cls_obj is not None:
                    params = loader.extract_params_for_classes(path).get(name, data.get('params', {}))
                    live_config = copy.deepcopy(DEFAULT_STRATEGY_CONFIG)
                    live_config.update({key: value for key, value in data.get('config', {}).items() if key in live_config})
                    live_item = {
                        'class': cls_obj,
                        'file_path': path,
                        'params': params,
                        'config': live_config,
                    }
                    strategies_store[name] = live_item
            if live_item is None:
                backtest_strategies_store[name] = {
                    'file_path': path,
                    'params': data.get('params', {}),
                    'config': _backtest_config_from_live(saved_config=data.get('config', {})),
                }
                continue
            live_item['params'] = data.get('params', live_item.get('params', {}))
            _sync_backtest_strategy(name, live_item)
            backtest_strategies_store[name]['config'] = _backtest_config_from_live(
                live_item.get('config'), data.get('config', {})
            )
        for name, live_item in strategies_store.items():
            _sync_backtest_strategy(name, live_item)
    except Exception:
        backtest_strategies_store = {}
    return get_backtest_strategies_for_frontend()


@synchronized_store
def get_backtest_strategies_for_frontend():
    payload = {}
    for name, item in backtest_strategies_store.items():
        payload[name] = {
            'params': item.get('params', {}),
            'config': item.get('config', {}),
        }
    return payload


@synchronized_store
def load_custom_backtest_strategy(file_path):
    result = load_custom_strategy(file_path)
    if result.get('success'):
        return {'success': True, 'strategies': get_backtest_strategies_for_frontend()}
    return result


@synchronized_store
def remove_backtest_strategy(strategy_name):
    if strategy_name in backtest_strategies_store:
        del backtest_strategies_store[strategy_name]
        strategies_store.pop(strategy_name, None)
        _write_active_strategies()
        _write_backtest_strategies()
    return get_backtest_strategies_for_frontend()


@synchronized_store
def update_backtest_strategy_config(strategy_name, config_type, new_data):
    if strategy_name in backtest_strategies_store:
        target = backtest_strategies_store[strategy_name].setdefault(config_type, {})
        if isinstance(target, dict) and isinstance(new_data, dict):
            target.update(new_data)
            _write_backtest_strategies()
            return True
    return False


@synchronized_store
def update_backtest_strategy_param(strategy_name, param_key, new_value):
    if strategy_name in backtest_strategies_store:
        backtest_strategies_store[strategy_name]['params'][param_key] = new_value
        if strategy_name in strategies_store:
            strategies_store[strategy_name]['params'] = backtest_strategies_store[strategy_name]['params']
            _write_active_strategies()
        _write_backtest_strategies()
        return True
    return False


@synchronized_store
def clear_backtest_strategies():
    global backtest_strategies_store
    backtest_strategies_store = {}
    _write_backtest_strategies()
    return get_backtest_strategies_for_frontend()