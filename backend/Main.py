import os
import sys
import subprocess
import json
import multiprocessing
import pickle
from pathlib import Path

if hasattr(sys, '_MEIPASS'):
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')


def _run_native_file_dialog_worker(payload_json, result_path):
    from tkinter import Tk, filedialog

    payload = json.loads(payload_json)
    filetypes = [tuple(filetype) for filetype in payload['filetypes']]
    root = Tk()
    root.withdraw()
    root.wm_attributes('-topmost', 1)
    try:
        selected_path = filedialog.askopenfilename(
            title=payload['title'],
            filetypes=filetypes,
        )
    finally:
        root.destroy()

    Path(result_path).write_text(selected_path or '', encoding='utf-8')


def _run_matplotlib_window_worker(payload_path):
    import matplotlib
    matplotlib.use('TkAgg')
    import mplfinance as mpf
    import matplotlib.pyplot as plt

    with Path(payload_path).open('rb') as payload_file:
        payload = pickle.load(payload_file)
    plot_df = payload['plot_df']
    plot_kwargs = dict(payload['plot_kwargs'])
    addplots = payload.get('ap', [])
    if addplots:
        plot_kwargs['addplot'] = addplots
    figure, _ = mpf.plot(plot_df, **plot_kwargs)
    figure.canvas.manager.set_window_title('RoadMaps Backtest Chart')
    plt.show()


if __name__ == '__main__':
    multiprocessing.freeze_support()
    if len(sys.argv) > 1 and sys.argv[1] == '--worker-mode':
        try:
            if len(sys.argv) == 5 and sys.argv[2] == 'native-file-dialog':
                _run_native_file_dialog_worker(sys.argv[3], sys.argv[4])
            elif len(sys.argv) == 4 and sys.argv[2] == 'matplotlib-window':
                _run_matplotlib_window_worker(sys.argv[3])
            else:
                raise SystemExit(2)
        except SystemExit:
            raise
        except Exception:
            raise SystemExit(1)
        raise SystemExit(0)

import socket
import threading
import time
import eel
import eel.edge as eel_edge
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


def _run_edge_without_console(path, options, start_urls):
    if not isinstance(options['cmdline_args'], list):
        raise TypeError("'cmdline_args' option must be of type List[str]")

    if options['app_mode']:
        command = f'start msedge --app={start_urls[0]} ' + ' '.join(options['cmdline_args'])
    else:
        command = 'start msedge --new-window ' + ' '.join(options['cmdline_args']) + f' {start_urls[0]}'

    subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )


if os.name == 'nt':
    eel_edge.run = _run_edge_without_console


def _available_local_port(preferred_port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        try:
            server_socket.bind(('127.0.0.1', preferred_port))
            return preferred_port
        except OSError:
            server_socket.bind(('127.0.0.1', 0))
            return server_socket.getsockname()[1]


def on_close(page, sockets):
    """
    Stable shutdown logic: prevents duplicate close events and exits the process cleanly.
    """
    global _shutdown_initiated
    if _shutdown_initiated:
        return
    _shutdown_initiated = True

    def _shutdown_if_no_sockets():
        global _shutdown_initiated
        time.sleep(2.0)

        if len(getattr(eel, '_websockets', [])) == 0:
            ui_log('error', "⚠️ UI Window closed permanently. Initiating Graceful Shutdown...")
            try:
                import core.engine_controller as engine_controller
                if hasattr(engine_controller, 'stop_robot'):
                    engine_controller.stop_robot(wait=True, timeout=30.0)
                    print("🛑 Engine stop command sent to controller.")
            except Exception as exc:
                print(f"⚠️ Shutdown engine stop warning: {exc}")
                print("⚠️ Keeping the application process and MT5 connection alive for broker-task safety.")
                _shutdown_initiated = False
                return

            try:
                import MetaTrader5 as mt5
                from core.mt5_runtime import mt5_call, shutdown_mt5_dispatcher
                mt5_call(mt5.shutdown)
                shutdown_mt5_dispatcher(wait=True)
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
    
    MY_PORT = _available_local_port(8989)
    START_PAGE = 'index.html' 
    APP_URL = f'http://localhost:{MY_PORT}/{START_PAGE}'
    EEL_WINDOW_ICON = str(resource_path('backend', 'build_assets', 'icons', 'app.ico'))
    
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

    app_flags = [
        '--window-size=1200,850',
        '--disable-infobars',
        '--disable-extensions',
        f'--app-icon="{EEL_WINDOW_ICON}"',
    ]
    
    try:
        # اجرای اولیه در حالت Edge/Chrome App Mode
        eel.start(START_PAGE, mode='edge', port=MY_PORT, size=(1200, 850), close_callback=on_close, cmdline_args=app_flags)
    except Exception as e:
        print(f"⚠️ Primary App Mode Failed: {e}. Attempting Fallback to default browser...")
        try:
            eel.start(START_PAGE, mode='edge', port=MY_PORT, size=(1200, 850), close_callback=on_close, cmdline_args=app_flags)
        except Exception as ex:
            print(f"❌ Fatal Error: Could not launch UI. {ex}")