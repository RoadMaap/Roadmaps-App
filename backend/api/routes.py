import eel
import os
import sys
import subprocess

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
    "profile": None
}

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
            profile["name"] = " ".join(
                part for part in (profile["first_name"], profile["last_name"]) if part
            ) or profile["username"] or profile["email"]

            ACTIVE_SESSION["access_token"] = user_data.get("access")
            ACTIVE_SESSION["refresh_token"] = user_data.get("refresh")
            ACTIVE_SESSION["user_authenticated"] = True
            ACTIVE_SESSION["profile"] = profile

            print(f"✅ Web Auth Success! User: {ACTIVE_SESSION['profile']['username']}")

            return {
                "success": True,
                "message": auth_result.get("message", "Authentication successful."),
                "profile": ACTIVE_SESSION["profile"]
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
@eel.expose
def get_initial_data():
    """Retrieves initial settings and strategy configurations for the frontend dashboard."""
    data = jm.load_settings()
    data['strategies'] = jm.get_strategies_for_frontend()
    return data

@eel.expose
def save_user_config(data):
    """Saves user-modified configurations back to local JSON storage."""
    return jm.save_settings_to_file(data)


# --- 5. STRATEGY MANAGER ENDPOINTS ---
@eel.expose
@SystemShield.rate_limit(max_calls=2, period_seconds=2.0) # 🛡️ Prevent rapid-fire uploads and system freezing
def load_custom_strategy(file_path):
    """Loads a custom Python strategy file with built-in path sanitization."""
    # 🛡️ Path Sanitization (Protection against Path Traversal attacks)
    if not SystemShield.sanitize_path(file_path):
        return {'success': False, 'message': 'Security Block: Invalid file path detected.'}
    return jm.load_custom_strategy(file_path)

@eel.expose
def remove_strategy(strategy_name):
    """Removes a strategy configuration from local storage."""
    return jm.remove_strategy(strategy_name)

@eel.expose
def update_strategy_config(strategy_name, config_type, new_data):
    """Updates high-level configuration for a specific trading strategy."""
    return jm.update_strategy_config(strategy_name, config_type, new_data)

@eel.expose
def update_strategy_param(strategy_name, param_key, new_value):
    """Updates a single parameter within a strategy's configuration."""
    return jm.update_strategy_param(strategy_name, param_key, new_value)

@eel.expose
def clear_active_strategy():
    """Clears the currently active strategy session."""
    return jm.clear_active_strategy()


# --- 6. NATIVE OS DIALOGS ---
def _open_file_dialog_subprocess(title, filetypes):
    """Spawns an isolated Tkinter process to display native file selection dialogs safely."""
    dialog_code = f"import tkinter, os, sys; from tkinter import filedialog; root=tkinter.Tk(); root.withdraw(); root.wm_attributes('-topmost', 1); path=filedialog.askopenfilename(title='{title}', filetypes={filetypes}); root.destroy(); print(path) if path else None"
    try:
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        proc = subprocess.run([sys.executable, "-c", dialog_code], capture_output=True, text=True, startupinfo=si)
        return proc.stdout.strip() or None
    except: 
        return None

@eel.expose
def choose_mt5_path():
    """Opens a dialog allowing the user to locate their MetaTrader 5 executable."""
    path = _open_file_dialog_subprocess('Select terminal64.exe', "[('Exe', '*.exe')]")
    if path:
        jm.save_settings_to_file({'mt5_path': path})
        return path
    return None

@eel.expose
def open_strategy_file_dialog():
    """Opens a dialog allowing the user to select a Python strategy file."""
    return _open_file_dialog_subprocess('Select Strategy Python File', "[('Python', '*.py')]")


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