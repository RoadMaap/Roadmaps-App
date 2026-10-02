import hashlib
import json
import os
import shutil
import tempfile
import time
import urllib.request
import threading
import subprocess
import sys
from pathlib import Path
import eel

APP_VERSION = "0.0.0"
RELEASE_API_URL = os.environ.get(
    "ROADMAPS_APP_RELEASE_API_URL",
    "https://roadmaps.ir/api/v1/roadmapsapp/releases/latest/"
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_ROOT_DIR = BACKEND_DIR.parent
APP_STORAGE_DIR = APP_ROOT_DIR / ".roadmaps_app"
RELEASES_DIR = APP_STORAGE_DIR / "releases"
BACKUP_DIR = APP_STORAGE_DIR / "backups"
CURRENT_VERSION_FILE = APP_STORAGE_DIR / "current_version.txt"
UPDATE_LOG_FILE = APP_STORAGE_DIR / "update_log.json"


def _parse_version(value):
    if not value:
        return (0, 0, 0)
    cleaned = str(value).strip().lower()
    cleaned = cleaned.replace('v', '')
    parts = []
    for chunk in cleaned.split('.'):
        digits = ''.join(ch for ch in chunk if ch.isdigit())
        if digits:
            parts.append(int(digits))
    if not parts:
        return (0, 0, 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _is_newer_version(current, latest):
    return _parse_version(latest) > _parse_version(current)


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'y', 'on', 'required', 'forced'}
    return bool(value)


class AppUpdater:
    @staticmethod
    def get_current_version():
        env_version = os.environ.get('ROADMAPS_APP_CURRENT_VERSION', '').strip()
        if env_version:
            return env_version

        if CURRENT_VERSION_FILE.exists():
            try:
                return CURRENT_VERSION_FILE.read_text(encoding='utf-8').strip() or APP_VERSION
            except Exception:
                return APP_VERSION
        return APP_VERSION

    @staticmethod
    def set_current_version(version):
        APP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        CURRENT_VERSION_FILE.write_text(str(version).strip(), encoding='utf-8')

    @staticmethod
    def set_test_current_version(version):
        normalized = str(version or '').strip()
        if not normalized:
            return {'success': False, 'message': 'Version is required for testing.'}

        AppUpdater.set_current_version(normalized)
        return {
            'success': True,
            'version': normalized,
            'current_version': AppUpdater.get_current_version(),
            'message': f'Test version set to {normalized}.',
        }

    @staticmethod
    def _read_update_log():
        try:
            if UPDATE_LOG_FILE.exists():
                with UPDATE_LOG_FILE.open('r', encoding='utf-8') as handle:
                    return json.load(handle)
        except Exception:
            pass
        return []

    @staticmethod
    def _write_update_log(entry):
        APP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        history = AppUpdater._read_update_log()
        history.append(entry)
        with UPDATE_LOG_FILE.open('w', encoding='utf-8') as handle:
            json.dump(history, handle, indent=2)

    @staticmethod
    def check_for_update():
        current_version = AppUpdater.get_current_version()
        try:
            request = urllib.request.Request(RELEASE_API_URL, headers={'User-Agent': 'RoadMaps-App-Updater/1.0'})
            with urllib.request.urlopen(request, timeout=15) as response:
                payload = json.loads(response.read().decode('utf-8'))
            if not isinstance(payload, dict):
                raise ValueError('Release API response must be a JSON object.')
        except Exception as exc:
            return {
                'has_update': False,
                'current_version': current_version,
                'latest_version': current_version,
                'is_force_update': False,
                'download_url': '',
                'changelog': '',
                'sha256': '',
                'error': str(exc),
            }

        release = payload.get('data')
        if isinstance(release, dict):
            payload = release

        latest_version = payload.get('version', current_version)
        min_supported_version = payload.get('min_supported_version', '') or ''
        api_force_update = _as_bool(
            payload.get(
                'is_force_update',
                payload.get('force_update', payload.get('required', False)),
            )
        )
        below_minimum_version = bool(min_supported_version) and (
            _parse_version(current_version) < _parse_version(min_supported_version)
        )
        has_update = (
            _is_newer_version(current_version, latest_version)
            or api_force_update
            or below_minimum_version
        )
        is_force_update = api_force_update or below_minimum_version
        download_url = payload.get('download_url', '') or ''
        if isinstance(download_url, str) and download_url.startswith('/'):
            download_url = f'https://roadmaps.ir{download_url}'
        return {
            'has_update': has_update,
            'current_version': current_version,
            'latest_version': latest_version,
            'min_supported_version': min_supported_version,
            'is_force_update': is_force_update,
            'update_type': 'forced' if is_force_update else 'optional',
            'download_url': download_url,
            'changelog': payload.get('changelog', ''),
            'sha256': payload.get('file_hash', ''),
            'error': None,
        }

    @staticmethod
    def _download_file(url, out_path):
        request = urllib.request.Request(url, headers={'User-Agent': 'RoadMaps-App-Updater/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response, open(out_path, 'wb') as handle:
            content_length = response.headers.get('Content-Length')
            total_bytes = int(content_length) if content_length else 0
            downloaded_bytes = 0
            block_size = 8192

            def report_progress(percent):
                try:
                    eel.update_download_progress(percent)
                except Exception:
                    pass

            report_progress(0)
            while True:
                chunk = response.read(block_size)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded_bytes += len(chunk)
                if total_bytes:
                    report_progress(min(100, int(downloaded_bytes * 100 / total_bytes)))

            report_progress(100)

    @staticmethod
    def _compute_sha256(file_path):
        digest = hashlib.sha256()
        with open(file_path, 'rb') as handle:
            for chunk in iter(lambda: handle.read(65536), b''):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _apply_update_and_restart(new_exe_path):
        """
        اجرای پروسه جایگزینی فایل اجرایی ویندوز به صورت کاملا نامرئی.
        """
        # مکث کوتاه برای اطمینان از رسیدن پیام success به فرانت‌اند
        time.sleep(1.5)
        
        # اگر برنامه کامپایل شده و در حال اجرا به عنوان یک فایل exe است
        if getattr(sys, 'frozen', False):
            current_exe = os.path.abspath(sys.executable)
            current_pid = os.getpid()
            
            bat_path = os.path.join(tempfile.gettempdir(), "roadmaps_updater.bat")
            
            # اسکریپت جایگزینی: بستن نرم‌افزار -> کپی فایل جدید -> اجرای نسخه جدید -> حذف خود اسکریپت
            bat_content = f"""@echo off
:: Kill the current application to release the file lock
taskkill /F /PID {current_pid} > NUL 2>&1
timeout /t 2 /nobreak > NUL

:: Overwrite the old executable with the newly downloaded one
copy /Y "{new_exe_path}" "{current_exe}"

:: Launch the updated application
start "" "{current_exe}"

:: Self-destruct this batch file
del "%~f0"
"""
            with open(bat_path, "w", encoding="utf-8") as f:
                f.write(bat_content)
            
            # اجرای اسکریپت bat به صورت کاملا پنهان (بدون باز شدن پنجره سیاه CMD)
            CREATE_NO_WINDOW = 0x08000000
            subprocess.Popen(bat_path, creationflags=CREATE_NO_WINDOW, shell=True)
            
        else:
            # اگر در محیط توسعه (Development) و در حال اجرای پایتون هستیم
            print(f"\n✅ Update downloaded successfully to: {new_exe_path}")
            print("⚠️ Running in Development Mode. Auto-restart is bypassed. Restart the script manually.")
            os._exit(0)

    @staticmethod
    def download_and_install_update():
        status = AppUpdater.check_for_update()
        if not status.get('has_update'):
            return {
                'success': False,
                'message': 'No update available.',
                'has_update': False,
                'is_force_update': False,
                'update_type': 'optional',
            }

        download_url = status.get('download_url')
        expected_hash = status.get('sha256', '')
        latest_version = status.get('latest_version')
        current_version = status.get('current_version')

        if not download_url:
            return {
                'success': False,
                'message': 'No download URL for the latest release.',
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
            }

        APP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        RELEASES_DIR.mkdir(parents=True, exist_ok=True)
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        previous_file = RELEASES_DIR / f'RoadmapsApp-{current_version}.exe'
        if previous_file.exists():
            backup_file = BACKUP_DIR / f'RoadmapsApp-{current_version}.bak.exe'
            shutil.copy2(previous_file, backup_file)

        temp_fd, temp_path = tempfile.mkstemp(prefix='roadmapsapp-update-', suffix='.exe')
        os.close(temp_fd)

        try:
            AppUpdater._download_file(download_url, temp_path)
            actual_hash = AppUpdater._compute_sha256(temp_path)
            if expected_hash and actual_hash.lower() != expected_hash.lower():
                os.remove(temp_path)
                return {
                    'success': False,
                    'message': 'Checksum mismatch. Update cancelled.',
                    'has_update': True,
                    'is_force_update': status.get('is_force_update', False),
                    'update_type': status.get('update_type', 'optional'),
                    'expected_sha256': expected_hash,
                    'actual_sha256': actual_hash,
                }

            target_version_path = RELEASES_DIR / f'RoadmapsApp-{latest_version}.exe'
            if target_version_path.exists():
                target_version_path.unlink()
            shutil.move(temp_path, target_version_path)

            AppUpdater.set_current_version(latest_version)
            AppUpdater._write_update_log({
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'from_version': current_version,
                'to_version': latest_version,
                'download_url': download_url,
                'sha256': actual_hash,
                'forced': bool(status.get('is_force_update', False)),
                'status': 'installed',
            })

            # 🔥 استارت کردن پروسه جایگزینی فایل و ری‌استارت برنامه در یک ترد مجزا
            threading.Thread(target=AppUpdater._apply_update_and_restart, args=(str(target_version_path),), daemon=True).start()

            return {
                'success': True,
                'message': f'Update to version {latest_version} installed successfully. Restarting...',
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
                'version': latest_version,
                'install_path': str(target_version_path),
            }
            
        except Exception as exc:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return {
                'success': False,
                'message': str(exc),
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
            }

    @staticmethod
    def rollback_last_update():
        current_version = AppUpdater.get_current_version()
        backup_candidates = sorted(BACKUP_DIR.glob(f'RoadmapsApp-{current_version}.bak.exe'))
        if not backup_candidates:
            return {'success': False, 'message': 'No backup available for rollback.'}

        backup_file = backup_candidates[-1]
        target_file = RELEASES_DIR / f'RoadmapsApp-{current_version}.exe'
        if target_file.exists():
            target_file.unlink()
        shutil.copy2(backup_file, target_file)
        return {'success': True, 'message': 'Rollback completed.', 'backup_path': str(backup_file)}

    @staticmethod
    def run_startup_check():
        status = AppUpdater.check_for_update()
        if status.get('has_update'):
            return {
                'status': 'update_available',
                'message': f'New version {status["latest_version"]} is available.',
                **status,
            }
        return {'status': 'up_to_date', 'message': 'App is up to date.', **status}