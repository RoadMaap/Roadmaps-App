import json
import os
import sys
import copy
from pathlib import Path
from runtime_paths import copy_seed_if_missing, resource_path, writable_backend_dir

# --- 1. SYSTEM PATH INJECTION ---
# 🛠 FIX: این مسیردهی حتماً باید بالاترین قسمت باشد تا پایتون بقیه پوشه‌ها را بشناسد
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# 🛡️ اضافه کردن سیستم امنیتی (حالا پایتون می‌فهمد پوشه security کجاست)
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

# 🛠 پوشه ذخیره سازی جدید (تغییر یافته از Jsons به storage)
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

# --- 3. GLOBAL STORE ---
strategies_store = {}

def _default_settings():
    """برمی‌گرداندن یک کپی مستقل و تمیز از تنظیمات پیش‌فرض"""
    return copy.deepcopy(GLOBAL_SETTINGS_DEFAULTS)

# --- 4. STORAGE METHODS ---
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
            
            # 🛡️ رمزگشایی کلیدهای حساس هنگام خواندن از دیسک
            if 'gemini_api_key' in merged:
                merged['gemini_api_key'] = SystemShield.decrypt_data(merged['gemini_api_key'])
                
            return merged
    except Exception:
        pass
    return _default_settings()

def save_settings_to_file(data):
    _ensure_storage_files()
    payload = _default_settings()
    
    # گرفتن دیتای قبلی برای ترکیب کردن
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
            payload.update(current_data)
    except: pass

    if isinstance(data, dict):
        payload.update(data)
        
    # 🛡️ رمزنگاری کلید حساس قبل از ذخیره در دیسک
    if 'gemini_api_key' in payload and payload['gemini_api_key']:
        payload['gemini_api_key'] = SystemShield.encrypt_data(payload['gemini_api_key'])

    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    return {'success': True, 'path': SETTINGS_FILE}

def _write_active_strategies():
    """ذخیره تنظیمات استراتژی‌ها در دیسک، بدون ذخیره کردن آبجکت کلاس‌ها"""
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

def get_strategies_for_frontend():
    """ایجاد دیتای ایمن و بدون کلاس برای ارسال به رابط کاربری ریکت"""
    frontend_payload = {}
    for name, item in strategies_store.items():
        frontend_payload[name] = {
            'params': item.get('params', {}),
            'config': item.get('config', {}),
        }
    return frontend_payload

def load_custom_strategy(file_path):
    global strategies_store
    if not file_path or not os.path.exists(file_path):
        return {'success': False, 'message': 'Strategy file not found.'}

    loader = StrategyLoader()
    try:
        ui_log('warning', f"🔄 Loading Python file: {file_path}")
        strategy_classes = loader.load_strategies_from_file(file_path)
        discovered_params = loader.extract_params_for_classes(file_path)
        
        newly_added = []
        for strategy_name, cls_obj in strategy_classes.items():
            params = discovered_params.get(strategy_name, {})
            
            # ایجاد یک کپی از تنظیمات پیش‌فرض و تغییر مجیک نامبر برای جلوگیری از تداخل
            adv_config = copy.deepcopy(DEFAULT_STRATEGY_CONFIG)
            adv_config['magic_number'] += (len(strategies_store) * 100) + 10
            
            strategies_store[strategy_name] = {
                'class': cls_obj,
                'file_path': file_path,
                'params': params,
                'config': adv_config,
            }
            newly_added.append(strategy_name)
            
        ui_log('success', f"✅ Successfully Loaded Strategies: {newly_added}")
        _write_active_strategies()
        return {'success': True, 'strategies': get_strategies_for_frontend()}
        
    except Exception as e:
        ErrorManager.catch_strategy_error("Loader", "load_custom_strategy", e)
        return {'success': False, 'message': str(e)}

def remove_strategy(strategy_name):
    global strategies_store
    if strategy_name in strategies_store:
        del strategies_store[strategy_name]
        ui_log('warning', f"🗑️ Removed Strategy: {strategy_name}")
        _write_active_strategies()
    return get_strategies_for_frontend()

def update_strategy_config(strategy_name, config_type, new_data):
    if strategy_name in strategies_store:
        strategies_store[strategy_name][config_type].update(new_data)
        _write_active_strategies()
    return True

def update_strategy_param(strategy_name, param_key, new_value):
    if strategy_name in strategies_store:
        strategies_store[strategy_name]['params'][param_key] = new_value
        _write_active_strategies()
        return True
    return False

def clear_active_strategy():
    global strategies_store
    strategies_store = {}
    _write_active_strategies()
    ui_log('warning', "🗑️ All Strategies Cleared.")
    return get_strategies_for_frontend()