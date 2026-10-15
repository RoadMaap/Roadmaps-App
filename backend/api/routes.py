import eel
import os
import sys
import subprocess
import json
import tempfile
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

# 🛡️ Integrating the System Shield security module
from security.system_shield import SystemShield

try:
    from security.desktop_auth import start_web_auth_flow
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

PLAN_LEVELS = {"basic": 0, "pro": 1, "advance": 2}


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
def attempt_login():
    """
    Exposes the web authentication flow to the Eel frontend.
    Invoked directly by the React frontend to initiate PKCE login.
    """
    print("🌐 Waiting for Web Authentication...")
    try:
        auth_result = start_web_auth_flow()

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