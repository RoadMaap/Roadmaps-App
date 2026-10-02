import os
import sys
import threading
import time
import eel
from runtime_paths import resource_path

# ==============================================================================
# 1. SYSTEM PATH INJECTION
# ==============================================================================
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ==============================================================================
# 2. IMPORT ROUTES & SERVICES (Enterprise Architecture)
# ==============================================================================
import api.routes 
from services.news_daemon import start_news_ticker_service
from storage.json_manager import load_saved_strategies_disk
from core.error_handler import ui_log
from security.desktop_auth import start_web_auth_flow

# ==============================================================================
# 3. GRACEFUL SHUTDOWN HANDLER
# ==============================================================================
_shutdown_initiated = False


def on_close(page, sockets):
    """
    Stable shutdown logic: prevents duplicate close events and exits the process cleanly.
    """
    global _shutdown_initiated
    if _shutdown_initiated:
        return
    _shutdown_initiated = True

    def _shutdown_if_no_sockets():
        time.sleep(2.0)

        if len(getattr(eel, '_websockets', [])) == 0:
            ui_log('error', "⚠️ UI Window closed permanently. Initiating Graceful Shutdown...")
            try:
                import core.engine_controller as engine_controller
                if hasattr(engine_controller, 'stop_robot'):
                    engine_controller.stop_robot()
                    print("🛑 Engine stop command sent to controller.")
            except Exception as exc:
                print(f"⚠️ Shutdown engine stop warning: {exc}")

            time.sleep(1.0)

            try:
                import MetaTrader5 as mt5
                mt5.shutdown()
                print("🔌 MT5 Connection Safely Disconnected.")
            except Exception:
                pass

            print("❌ Terminating process...")
            os._exit(0)
        else:
            print("🔄 UI Page Refreshed. Connection Maintained. Engine is safe.")

    threading.Thread(target=_shutdown_if_no_sockets, daemon=True).start()

# ==============================================================================
# 4. APP LAUNCHER
# ==============================================================================
if __name__ == '__main__':
    # آدرس‌دهی پوشه بیلد شده‌ی ریکت (React)
    FRONTEND_DIR = str(resource_path('frontend', 'dist'))
    eel.init(FRONTEND_DIR) 
    
    load_saved_strategies_disk()
    
    MY_PORT = 8989
    START_PAGE = 'index.html' 
    APP_URL = f'http://localhost:{MY_PORT}/{START_PAGE}'
    
    print(f"🚀 Starting RoadMap Enterprise Terminal at {APP_URL}")
    
    try:
        start_news_ticker_service()
    except Exception as e:
        print(f"⚠️ Could not start News Service: {e}")

    try:
        from updater.app_updater import AppUpdater
        startup_status = AppUpdater.run_startup_check()
        print(f"📦 Update status: {startup_status.get('status')} | {startup_status.get('message')}")
    except Exception as exc:
        print(f"⚠️ Update check failed at startup: {exc}")

    # If the app was started with --auth flag, run the desktop web auth flow first
    if '--auth' in sys.argv or '--login' in sys.argv:
        print("🔐 Running desktop web auth flow...")
        ok, msg, token = start_web_auth_flow()
        print(f"Auth result: success={ok}, msg={msg}")
        if token:
            # store token in environment for downstream modules (volatile) and print
            os.environ['ROADMAPS_AUTH_TOKEN'] = token
            print("✅ Received auth token and stored in environment variable ROADMAPS_AUTH_TOKEN")
        else:
            print("⚠️ No token received from auth flow.")

    app_flags = ['--window-size=1200,850', '--disable-infobars', '--disable-extensions']
    
    try:
        # اجرای اولیه در حالت Edge/Chrome App Mode
        eel.start(START_PAGE, mode='edge', port=MY_PORT, size=(1200, 850), close_callback=on_close, cmdline_args=app_flags)
    except Exception as e:
        print(f"⚠️ Primary App Mode Failed: {e}. Attempting Fallback to default browser...")
        try:
            eel.start(START_PAGE, mode='edge', size=(1200, 850), close_callback=on_close)
        except Exception as ex:
            print(f"❌ Fatal Error: Could not launch UI. {ex}")