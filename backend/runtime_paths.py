import os
import shutil
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
APP_ROOT_DIR = BACKEND_DIR.parent


def resource_path(*parts):
    """Resolve read-only bundled assets in source and PyInstaller modes."""
    base_dir = Path(getattr(sys, '_MEIPASS', APP_ROOT_DIR))
    return base_dir.joinpath(*parts)


def writable_app_data_dir():
    """Return persistent writable state storage for packaged and source runs."""
    if getattr(sys, 'frozen', False):
        local_app_data_value = os.environ.get('LOCALAPPDATA', '').strip()
        local_app_data = Path(local_app_data_value) if local_app_data_value else Path.home() / 'AppData' / 'Local'
        return local_app_data / 'Roadmaps App'
    return APP_ROOT_DIR


def writable_backend_dir():
    """Return the persistent backend data directory in package and source runs."""
    if getattr(sys, 'frozen', False):
        return writable_app_data_dir() / 'backend'
    return BACKEND_DIR


def copy_seed_if_missing(seed_path, destination_path):
    """Copy a bundled default only when the destination is atomically absent."""
    seed_path = Path(seed_path)
    destination_path = Path(destination_path)
    destination_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with destination_path.open('xb') as destination:
            with seed_path.open('rb') as source:
                shutil.copyfileobj(source, destination)
    except FileExistsError:
        return False
    except Exception:
        try:
            destination_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    return True