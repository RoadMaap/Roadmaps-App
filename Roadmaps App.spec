# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files

datas = [('C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\frontend\\dist', 'frontend/dist'), ('C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\backend\\build_assets\\current_version.txt', 'backend/build_assets'), ('C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\backend\\build_assets\\default_user_settings.json', 'backend/build_assets'), ('C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\backend\\build_assets\\active_strategies.json', 'backend/build_assets')]
datas += collect_data_files('certifi')


a = Analysis(
    ['C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\backend\\Main.py'],
    pathex=['C:\\Users\\alire\\OneDrive\\Desktop\\RoadMaps\\Roadmaps App\\backend'],
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
)
