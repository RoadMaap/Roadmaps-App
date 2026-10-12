# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files

PROJECT_ROOT = Path(SPECPATH).resolve()
BACKEND_DIR = PROJECT_ROOT / 'backend'
FRONTEND_DIST = PROJECT_ROOT / 'frontend' / 'dist'
BUILD_ASSETS = BACKEND_DIR / 'build_assets'
APP_ICON = BUILD_ASSETS / 'icons' / 'app.ico'

datas = [
    (str(FRONTEND_DIST), 'frontend/dist'),
    (str(BUILD_ASSETS / 'current_version.txt'), 'backend/build_assets'),
    (str(BUILD_ASSETS / 'default_user_settings.json'), 'backend/build_assets'),
    (str(BUILD_ASSETS / 'active_strategies.json'), 'backend/build_assets'),
    (str(APP_ICON), 'backend/build_assets/icons'),
]
datas += collect_data_files('certifi')


a = Analysis(
    [str(BACKEND_DIR / 'Main.py')],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=['MetaTrader5', 'eel', 'pandas', 'numpy', 'pandas_ta', 'PIL', 'requests', 'certifi', 'dotenv', 'urllib3', 'gevent', 'bottle', 'bottle_websocket', 'geventwebsocket'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Roadmaps App',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[str(APP_ICON)],
)
