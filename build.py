from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / 'backend'
FRONTEND_DIR = PROJECT_ROOT / 'frontend'
FRONTEND_DIST = FRONTEND_DIR / 'dist'
APP_ICON = FRONTEND_DIR / 'public' / 'favicon.ico'
ENTRY_POINT = BACKEND_DIR / 'Main.py'
VERSION_SEED = BACKEND_DIR / 'build_assets' / 'current_version.txt'
SETTINGS_SEED = BACKEND_DIR / 'build_assets' / 'default_user_settings.json'
STRATEGIES_SEED = BACKEND_DIR / 'build_assets' / 'active_strategies.json'

HIDDEN_IMPORTS = [
    'MetaTrader5',
    'eel',
    'pandas',
    'numpy',
    'pandas_ta',
    'PIL',
    'requests',
    'certifi',
    'dotenv',
    'urllib3',
    'gevent',
    'bottle',
    'bottle_websocket',
    'geventwebsocket',
]


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print('> ' + subprocess.list2cmdline(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    if not ENTRY_POINT.is_file():
        raise FileNotFoundError(f'Application entry point not found: {ENTRY_POINT}')
    if not APP_ICON.is_file():
        raise FileNotFoundError(f'Application icon not found: {APP_ICON}')
    for seed in (VERSION_SEED, SETTINGS_SEED, STRATEGIES_SEED):
        if not seed.is_file():
            raise FileNotFoundError(f'Packaged seed file not found: {seed}')

    npm = shutil.which('npm.cmd' if sys.platform == 'win32' else 'npm')
    if npm is None:
        raise RuntimeError('npm was not found on PATH. Install Node.js and reopen the terminal.')
    run([npm, 'run', 'build'], cwd=FRONTEND_DIR)
    if not (FRONTEND_DIST / 'index.html').is_file():
        raise FileNotFoundError(f'Vite build did not produce {FRONTEND_DIST / "index.html"}')

    pyinstaller = shutil.which('pyinstaller.exe' if sys.platform == 'win32' else 'pyinstaller')
    if pyinstaller is None:
        raise RuntimeError('PyInstaller is not installed. Install it with: python -m pip install pyinstaller')

    separator = ';' if sys.platform == 'win32' else ':'
    command = [
        pyinstaller,
        '--noconfirm',
        '--clean',
        '--onefile',
        '--windowed',
        '--name',
        'Roadmaps App',
        '--icon',
        str(APP_ICON),
        '--paths',
        str(BACKEND_DIR),
        '--add-data',
        f'{FRONTEND_DIST}{separator}frontend/dist',
        '--add-data',
        f'{VERSION_SEED}{separator}backend/build_assets',
        '--add-data',
        f'{SETTINGS_SEED}{separator}backend/build_assets',
        '--add-data',
        f'{STRATEGIES_SEED}{separator}backend/build_assets',
    ]

    for module in HIDDEN_IMPORTS:
        command.extend(['--hidden-import', module])

    command.extend(['--collect-data', 'certifi'])

    command.append(str(ENTRY_POINT))
    run(command, cwd=PROJECT_ROOT)

    print(f'Build complete: {PROJECT_ROOT / "dist" / "Roadmaps App.exe"}')
    print('Packaged initial version: 0.0.0')
    print('Runtime update state will be stored under %LOCALAPPDATA%\\Roadmaps App.')


if __name__ == '__main__':
    main()
