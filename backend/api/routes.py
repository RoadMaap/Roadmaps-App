import eel
import os
import sys
import subprocess
import json
import tempfile
from datetime import time as datetime_time
from functools import wraps
from pathlib import Path

# --- 1. SYSTEM PATH INJECTION ---
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# --- 2. ENTERPRISE ARCHITECTURE IMPORTS ---
import core.engine_controller as engine_controller
import storage.json_manager as jm
from updater.app_updater import AppUpdater, APP_VERSION
try:
    from backtest.controller import BacktestController
except ImportError:  # pragma: no cover
    from backend.backtest.controller import BacktestController

# 🛡️ Integrating the System Shield security module
from security.system_shield import SystemShield

try:
    from security.desktop_auth import cancel_web_auth_flow, start_web_auth_flow
except ImportError as e:
    print(f"⚠️ Security module import skipped: {e}")

try:
    from services.ai_vision import GeminiVisionClient
    from services.ai_executor import AITradeExecutor
except ImportError as e:
    print(f"⚠️ AI Services import skipped: {e}")


# --- 3. AUTHENTICATION & SESSION MANAGEMENT ---
# Memory storage for the active user session including profile details
ACTIVE_SESSION = {
    "access_token": None,
    "refresh_token": None,
    "user_authenticated": False,
    "profile": None,
    "plan": "Basic",
}

BACKTEST_CONTROLLER = BacktestController()


def _emit_backtest_status(message_type, message):
    try:
        eel.update_backtest_status(message_type, message)
    except Exception:
        pass


def _emit_backtest_progress(percent, phase='Running'):
    try:
        eel.update_backtest_progress(float(percent or 0), phase or 'Running')
    except Exception:
        pass


def _emit_backtest_results(report):
    try:
        eel.update_backtest_results(report)
    except Exception:
        pass


def _set_active_user_plan(plan_name):
    selected_plan = str(plan_name or 'Basic').strip().title()
    if selected_plan not in {'Basic', 'Pro', 'Advance'}:
        selected_plan = 'Basic'
    ACTIVE_SESSION['plan'] = selected_plan
    return selected_plan

PLAN_LEVELS = {"basic": 1, "pro": 2, "advance": 3}


def require_plan(required_plan):
    """Rejects Eel calls when the active session does not meet the required tier."""
    required_level = PLAN_LEVELS.get(str(required_plan).strip().lower(), PLAN_LEVELS["basic"])

    def decorator(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            current_plan = str(ACTIVE_SESSION.get("plan") or "Basic").strip().lower()
            current_level = PLAN_LEVELS.get(current_plan, PLAN_LEVELS["basic"])
            if current_level < required_level:
                return {
                    "success": False,
                    "code": "plan_required",
                    "message": f"{required_plan} Plan Required",
                    "required_plan": required_plan,
                    "current_plan": ACTIVE_SESSION.get("plan") or "Basic",
                }
            return function(*args, **kwargs)

        return wrapped

    return decorator

@eel.expose
def cancel_login():
    """Requests cancellation of the active desktop authentication flow."""
    return cancel_web_auth_flow()


@eel.expose
def attempt_login():
    """
    Exposes the web authentication flow to the Eel frontend.
    Invoked directly by the React frontend to initiate PKCE login.
    """
    print("🌐 Waiting for Web Authentication...")
    try:
        auth_result = start_web_auth_flow()

        if auth_result.get("cancelled"):
            return {
                "success": False,
                "cancelled": True,
                "message": auth_result.get("message", "Login cancelled."),
            }

        if auth_result.get("success") and auth_result.get("user_data"):
            user_data = auth_result["user_data"]
            nested_user = user_data.get("user") if isinstance(user_data.get("user"), dict) else {}

            profile = {
                "email": user_data.get("user_email") or nested_user.get("email") or user_data.get("email"),
                "username": user_data.get("username") or nested_user.get("username") or user_data.get("user_name"),
                "first_name": user_data.get("first_name") or nested_user.get("first_name"),
                "last_name": user_data.get("last_name") or nested_user.get("last_name"),
            }
            subscription = user_data.get("subscription") or nested_user.get("subscription") or {}
            plan_value = user_data.get("plan") or nested_user.get("plan")
            if isinstance(plan_value, dict):
                plan_value = plan_value.get("name") or plan_value.get("slug") or plan_value.get("tier")
            plan = (
                plan_value
                or (subscription.get("plan") or subscription.get("name") if isinstance(subscription, dict) else None)
                or "Basic"
            )
            profile["plan"] = str(plan).strip().title()
            profile["name"] = " ".join(
                part for part in (profile["first_name"], profile["last_name"]) if part
            ) or profile["username"] or profile["email"]

            ACTIVE_SESSION["access_token"] = user_data.get("access")
            ACTIVE_SESSION["refresh_token"] = user_data.get("refresh")
            ACTIVE_SESSION["user_authenticated"] = True
            ACTIVE_SESSION["profile"] = profile
            ACTIVE_SESSION["plan"] = profile["plan"]

            print(f"✅ Web Auth Success! User: {ACTIVE_SESSION['profile']['username']}")

            return {
                "success": True,
                "message": auth_result.get("message", "Authentication successful."),
                "profile": ACTIVE_SESSION["profile"],
                "plan": ACTIVE_SESSION["plan"],
            }

        return {
            "success": False,
            "message": auth_result.get("message", "Authentication failed."),
        }
    except Exception as e:
        return {
            'success': False, 
            'message': f'Auth encountered an error: {str(e)}'
        }

@eel.expose
def get_auth_status():
    """Checks if the desktop client currently holds an active authenticated session."""
    return ACTIVE_SESSION


@eel.expose
def get_app_version():
    """Returns the local desktop application version."""
    return {
        'version': AppUpdater.get_current_version() or APP_VERSION,
        'release_api': os.environ.get('ROADMAPS_APP_RELEASE_API_URL', 'https://roadmaps.ir/api/v1/roadmapsapp/releases/latest/')
    }


@eel.expose
def set_test_current_version(version):
    """Dev/test helper: force a lower local version so the updater can be validated."""
    return AppUpdater.set_test_current_version(version)


@eel.expose
def check_for_app_update():
    """Queries the release API and reports whether a newer app version exists."""
    return AppUpdater.check_for_update()


@eel.expose
def download_and_install_update():
    """Downloads, validates, and installs the latest release artifact."""
    return AppUpdater.download_and_install_update()


# --- 4. CONFIG & STATE ENDPOINTS ---
def _signal_live_configuration_refresh():
    if engine_controller.robot_running:
        engine_controller.request_configuration_refresh()


@eel.expose
def get_initial_data():
    """Retrieves initial settings and strategy configurations for the frontend dashboard."""
    data = jm.load_settings()
    data['strategies'] = jm.get_strategies_for_frontend()
    return data

@eel.expose
def save_user_config(data):
    """Saves user-modified configurations back to local JSON storage."""
    if isinstance(data, dict) and 'plan' in data:
        selected_plan = str(data['plan'] or 'Basic').strip().title()
        if selected_plan in {'Basic', 'Pro', 'Advance'}:
            ACTIVE_SESSION['plan'] = selected_plan

    result = jm.save_settings_to_file(data)
    if result.get('success'):
        _signal_live_configuration_refresh()
    return result


@eel.expose
def set_user_plan(plan_name):
    """Switches the active plan immediately for demo and testing scenarios."""
    return {'plan': _set_active_user_plan(plan_name)}


# --- 5. STRATEGY MANAGER ENDPOINTS ---
@eel.expose
@SystemShield.rate_limit(max_calls=2, period_seconds=2.0) # 🛡️ Prevent rapid-fire uploads and system freezing
def load_custom_strategy(file_path):
    """Loads a custom Python strategy file with built-in path sanitization."""
    # 🛡️ Path Sanitization (Protection against Path Traversal attacks)
    if not SystemShield.sanitize_path(file_path):
        return {'success': False, 'message': 'Security Block: Invalid file path detected.'}
    if str(ACTIVE_SESSION.get("plan") or "Basic").strip().lower() == "basic" and len(jm.strategies_store) >= 1:
        return {
            'success': False,
            'message': 'BASIC_LIMIT_STRATEGIES',
        }
    max_strategies = 1 if str(ACTIVE_SESSION.get("plan") or "Basic").strip().lower() == "basic" else None
    result = jm.load_custom_strategy(file_path, max_strategies=max_strategies)
    if result.get('success'):
        _signal_live_configuration_refresh()
    return result

@eel.expose
def remove_strategy(strategy_name):
    """Removes a strategy configuration from local storage."""
    result = jm.remove_strategy(strategy_name)
    _signal_live_configuration_refresh()
    return result

@eel.expose
def update_strategy_config(strategy_name, config_type, new_data):
    """Updates high-level configuration for a specific trading strategy."""
    result = jm.update_strategy_config(strategy_name, config_type, new_data)
    if result:
        _signal_live_configuration_refresh()
    return result

@eel.expose
def update_strategy_param(strategy_name, param_key, new_value):
    """Updates a single parameter within a strategy's configuration."""
    result = jm.update_strategy_param(strategy_name, param_key, new_value)
    if result:
        _signal_live_configuration_refresh()
    return result

@eel.expose
def clear_active_strategy():
    """Clears the currently active strategy session."""
    result = jm.clear_active_strategy()
    _signal_live_configuration_refresh()
    return result


@eel.expose
@require_plan("Advance")
def get_backtest_initial_data():
    return {
        'settings': jm.load_backtest_settings(),
        'strategies': jm.get_backtest_strategies_for_frontend(),
    }


@eel.expose
@require_plan("Advance")
def save_backtest_config(data):
    return jm.save_backtest_settings_to_file(data or {})


@eel.expose
@require_plan("Advance")
def load_custom_backtest_strategy(file_path):
    result = jm.load_custom_backtest_strategy(file_path)
    if result.get('success'):
        _signal_live_configuration_refresh()
    return result

@eel.expose
@require_plan("Advance")
def remove_backtest_strategy(name):
    result = jm.remove_backtest_strategy(name)
    _signal_live_configuration_refresh()
    return result


@eel.expose
@require_plan("Advance")
def update_backtest_strategy_config(name, config_type, new_data):
    return jm.update_backtest_strategy_config(name, config_type, new_data)


@eel.expose
@require_plan("Advance")
def update_backtest_strategy_param(name, key, val):
    result = jm.update_backtest_strategy_param(name, key, val)
    if result:
        _signal_live_configuration_refresh()
    return result


@eel.expose
@require_plan("Advance")
def detect_mt5_symbol_specs(symbol, mt5_path=''):
    from backend.backtest.data_fetcher import detect_symbol_specs
    return detect_symbol_specs(symbol, mt5_path=mt5_path)


def _normalize_backtest_killzones(killzones):
    normalized = []
    for zone in killzones or []:
        if isinstance(zone, str):
            parts = zone.split('-', 1)
            if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
                continue
            start_text, end_text = parts
        elif isinstance(zone, (tuple, list)) and len(zone) == 2:
            start_text, end_text = zone
        else:
            continue

        try:
            start = start_text if isinstance(start_text, datetime_time) else datetime_time.fromisoformat(str(start_text).strip())
            end = end_text if isinstance(end_text, datetime_time) else datetime_time.fromisoformat(str(end_text).strip())
        except ValueError:
            continue
        normalized.append((start, end))
    return normalized


@eel.expose
@require_plan("Advance")
def start_backtest():
    settings = jm.load_backtest_settings() or {}
    strategy_map = jm.get_backtest_strategies_for_frontend() or {}
    from trading.risk_manager import BreakevenHandler, FixedLotRule, FixedRiskAmountRule, PartialCloseRule, PercentRiskRule

    assets = []
    for strategy_name, strategy_data in strategy_map.items():
        stored_strategy = jm.backtest_strategies_store.get(strategy_name, {})
        strategy_class = stored_strategy.get('class') or jm.strategies_store.get(strategy_name, {}).get('class')
        if strategy_class is None:
            _emit_backtest_status('error', f'Strategy class is unavailable: {strategy_name}')
            return {'success': False, 'message': f'Strategy class is unavailable: {strategy_name}'}
        strategy_config = strategy_data.get('config', {})
        strategy_params = strategy_data.get('params', {})
        try:
            strategy_instance = strategy_class(strategy_params)
        except Exception as exc:
            message = f'Strategy {strategy_name} initialization failed: {exc}'
            _emit_backtest_status('error', message)
            return {'success': False, 'message': message}
        risk_mode = strategy_config.get('risk_mode', 'fixed_usd')
        risk_value = float(strategy_config.get('risk_value', 100.0) or 100.0)
        if risk_mode == 'fixed_lot':
            risk_rules = [FixedLotRule(lot_size=risk_value)]
        elif risk_mode == 'percentage':
            risk_rules = [PercentRiskRule(risk_percent=risk_value)]
        else:
            risk_rules = [FixedRiskAmountRule(risk_amount_dollar=risk_value)]
        if settings.get('be_enabled'):
            risk_rules.append(BreakevenHandler(trigger_rr_ratio=float(settings.get('be_trigger', 1.0) or 1.0)))
        if settings.get('pc_enabled'):
            risk_rules.append(PartialCloseRule(
                target_rr=float(settings.get('pc_trigger', 2.0) or 2.0),
                close_percentage=float(settings.get('pc_volume', 50.0) or 50.0) / 100.0,
            ))
        assets.append({
            'strategy_id': strategy_name,
            'strategy_name': strategy_name,
            'symbol': strategy_config.get('symbol', 'XAUUSD'),
            'timeframe': strategy_config.get('timeframe', 'M5'),
            'lookback_period': int(strategy_config.get('lookback', settings.get('lookback_period', 500)) or 0),
            'spread_divisor': float(strategy_config.get('spread_divisor', 100.0) or 100.0),
            'commission_per_lot': float(strategy_config.get('commission_per_lot', 0.0) or 0.0),
            'contract_size': float(strategy_config.get('contract_size', 100.0) or 100.0),
            'tick_size': float(strategy_config.get('tick_size', 0.01) or 0.01),
            'point_value': float(strategy_config.get('point_value', 1.0) or 1.0),
            'risk_mode': strategy_config.get('risk_mode', 'fixed_usd'),
            'risk_value': float(strategy_config.get('risk_value', 100.0) or 100.0),
            'COMMISSION_PER_LOT': float(strategy_config.get('commission_per_lot', 0.0) or 0.0),
            'MONEY_MANAGEMENT_MODE': risk_rules,
            'allowed_days': strategy_config.get('allowed_days', [0, 1, 2, 3, 4]),
            'killzones': _normalize_backtest_killzones(strategy_config.get('killzones', [])),
            'candle_type': strategy_config.get('candle_type', 'STANDARD'),
            'TIMEFRAME_SECONDS': int(strategy_config.get('TIMEFRAME_SECONDS', 300) or 300),
            'strategy': strategy_instance,
        })
    if not assets:
        return {'success': False, 'message': 'Import at least one strategy before running a backtest.'}

    config = {
        'initial_capital': float(settings.get('initial_capital', 10000) or 10000),
        'start_date': settings.get('start_date', '2023-01-01'),
        'end_date': settings.get('end_date', '2024-01-01'),
        'lookback_period': int(settings.get('lookback_period', 500) or 500) if settings.get('lookback_enabled', True) else 0,
        'lookback_enabled': bool(settings.get('lookback_enabled', True)),
        'leverage': float(settings.get('leverage', 100) or 100),
        'margin_limit_pct': (float(settings.get('margin_limit_pct', 100) or 100) / 100.0) if settings.get('margin_limit_enabled') else 1.0,
        'strict_lookahead_protection': bool(settings.get('strict_lookahead_protection', True)),
        'STRICT_LOOKAHEAD_PROTECTION': bool(settings.get('strict_lookahead_protection', True)),
        'be_enabled': bool(settings.get('be_enabled', False)),
        'be_trigger': float(settings.get('be_trigger', 1.0) or 1.0),
        'pc_enabled': bool(settings.get('pc_enabled', False)),
        'pc_volume': float(settings.get('pc_volume', 50) or 50),
        'pc_trigger': float(settings.get('pc_trigger', 2.0) or 2.0),
        'symbol': settings.get('symbol', 'EURUSD'),
        'timeframe': settings.get('timeframe', 'H1'),
        'assets': assets,
        'mt5_path': settings.get('mt5_path', ''),
    }

    if BACKTEST_CONTROLLER.is_running:
        return {'success': False, 'message': 'A backtest is already running.'}

    _emit_backtest_status('warning', 'Preparing backtest data and engine...')
    start_result = BACKTEST_CONTROLLER.start(
        config,
        progress_callback=_emit_backtest_progress,
        status_callback=_emit_backtest_status,
        result_callback=_emit_backtest_results,
    )

    if not start_result.get('success'):
        return start_result

    _emit_backtest_status('warning', 'Backtest run initiated.')
    return start_result


@eel.expose
@require_plan("Advance")
def stop_backtest():
    _emit_backtest_status('warning', 'Stop request sent.')
    return BACKTEST_CONTROLLER.stop()


@eel.expose
@require_plan("Advance")
def get_last_backtest_result():
    report = BACKTEST_CONTROLLER.get_last_result() or {'summary': {'net_profit': 0.0, 'win_rate': 0.0, 'profit_factor': 1.0, 'max_drawdown_pct': 0.0, 'initial_capital': 0.0, 'final_equity': 0.0, 'stability_score': 0.0, 'total_trades': 0}}
    _emit_backtest_results(report)
    return {'success': True, 'result': report}


@eel.expose
@require_plan("Advance")
def export_backtest_html_report():
    report = BACKTEST_CONTROLLER.get_last_result() or {}
    if not report:
        return {'success': False, 'message': 'No backtest report available.'}

    summary = report.get('summary', {})
    html_path = Path(tempfile.gettempdir()) / 'roadmaps_backtest_report.html'
    html_path.write_text(
        """<html><head><meta charset='utf-8'><title>RoadMaps Backtest Report</title></head>
        <body style='font-family:Segoe UI,sans-serif;padding:32px;background:#0c0d12;color:#f5f5f5'>
        <h2>RoadMaps Backtest Report</h2>
        <ul>
            <li>Initial Capital: {initial_capital}</li>
            <li>Final Equity: {final_equity}</li>
            <li>Net Profit: {net_profit}</li>
            <li>Win Rate: {win_rate}%</li>
            <li>Profit Factor: {profit_factor}</li>
            <li>Max Drawdown: {max_drawdown_pct}%</li>
        </ul>
        </body></html>""".format(
            initial_capital=summary.get('initial_capital', 0),
            final_equity=summary.get('final_equity', 0),
            net_profit=summary.get('net_profit', 0),
            win_rate=summary.get('win_rate', 0),
            profit_factor=summary.get('profit_factor', 1),
            max_drawdown_pct=summary.get('max_drawdown_pct', 0),
        ),
        encoding='utf-8',
    )
    return {'success': True, 'path': str(html_path)}


@eel.expose
@require_plan("Advance")
def open_backtest_mpl_window(strategy_id=""):
    report = BACKTEST_CONTROLLER.get_last_result() or {}
    chart = next(
        (item for item in report.get('chart_images', []) if item.get('strategy_id') == strategy_id),
        None,
    )
    if chart is None and report.get('chart_images'):
        chart = report['chart_images'][0]
    if chart is None:
        return {'success': False, 'message': 'No rendered Backtest chart is available.'}

    payload_path = Path(chart.get('payload_path', ''))
    if not payload_path.is_file():
        return {'success': False, 'message': 'The interactive Backtest plot payload is missing.'}

    if getattr(sys, 'frozen', False):
        command = [sys.executable, '--worker-mode', 'matplotlib-window', str(payload_path)]
    else:
        main_script = Path(__file__).resolve().parents[1] / 'Main.py'
        command = [sys.executable, str(main_script), '--worker-mode', 'matplotlib-window', str(payload_path)]

    startup_info = None
    if os.name == 'nt':
        startup_info = subprocess.STARTUPINFO()
        startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    try:
        subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            startupinfo=startup_info,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
    except Exception as exc:
        return {'success': False, 'message': f'Could not open the Matplotlib chart window: {exc}'}
    return {'success': True, 'payload_path': str(payload_path)}


# --- 6. NATIVE OS DIALOGS ---
def _open_file_dialog_subprocess(title, filetypes):
    """Spawns an isolated Tkinter process to display native file selection dialogs safely."""
    result_descriptor, result_filename = tempfile.mkstemp(prefix='roadmaps-dialog-', suffix='.txt')
    os.close(result_descriptor)
    result_path = Path(result_filename)

    payload = json.dumps({'title': title, 'filetypes': filetypes})
    if getattr(sys, 'frozen', False):
        command = [sys.executable, '--worker-mode', 'native-file-dialog', payload, str(result_path)]
    else:
        main_script = Path(__file__).resolve().parents[1] / 'Main.py'
        command = [sys.executable, str(main_script), '--worker-mode', 'native-file-dialog', payload, str(result_path)]

    startup_info = None
    if os.name == 'nt':
        startup_info = subprocess.STARTUPINFO()
        startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    try:
        process = subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            startupinfo=startup_info,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        if process.returncode != 0:
            return None
        return result_path.read_text(encoding='utf-8').strip() or None
    except Exception:
        return None
    finally:
        result_path.unlink(missing_ok=True)

@eel.expose
def choose_mt5_path():
    """Opens a dialog allowing the user to locate their MetaTrader 5 executable."""
    path = _open_file_dialog_subprocess('Select terminal64.exe', [('Exe', '*.exe')])
    if path:
        jm.save_settings_to_file({'mt5_path': path})
        return path
    return None

@eel.expose
def open_strategy_file_dialog():
    """Opens a dialog allowing the user to select a Python strategy file."""
    return _open_file_dialog_subprocess('Select Strategy Python File', [('Python', '*.py')])


# --- 7. ENGINE COMMAND ENDPOINTS ---
@eel.expose
@SystemShield.rate_limit(max_calls=1, period_seconds=3.0) # 🛡️ Allow only 1 click every 3 seconds (Anti-Spam)
def start_robot():
    """Initiates the core trading engine and strategy execution loop."""
    engine_controller.start_robot()

@eel.expose
@SystemShield.rate_limit(max_calls=1, period_seconds=2.0) # 🛡️ Prevent rapid-fire stop commands
def stop_robot():
    """Halt the trading engine gracefully."""
    engine_controller.stop_robot()


# --- 8. AI VISION ENDPOINTS ---
@eel.expose
@SystemShield.rate_limit(max_calls=1, period_seconds=5.0) # 🛡️ Strict rate limiting to prevent API bans
@require_plan("Pro")
def analyze_uploaded_chart(base64_image, lang="en"):
    """Transmits a base64 encoded chart image to the Gemini Vision API for technical analysis."""
    client = GeminiVisionClient()
    return client.analyze_chart(base64_image, lang)

@eel.expose
@SystemShield.rate_limit(max_calls=1, period_seconds=3.0) # 🛡️ Prevent spamming broker servers with duplicate orders
def deploy_ai_trade_to_mt5(symbol, ai_result, risk_mode, risk_value):
    """Executes a trade on MT5 based strictly on the AI's validated analysis response."""
    settings = jm.load_settings()
    executor = AITradeExecutor(mt5_path=settings.get("mt5_path", ""))
    return executor.execute_from_ai(symbol, ai_result, risk_mode, float(risk_value))