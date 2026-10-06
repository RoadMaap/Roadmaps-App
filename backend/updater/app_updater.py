import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import urllib.request
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit
import certifi
import eel
import requests
from runtime_paths import resource_path, writable_app_data_dir

APP_VERSION = "0.0.0"
DEFAULT_DOWNLOAD_URL = "https://github.com/RoadMaap/Roadmaps-App-Updates/releases/latest/download/RoadmapsApp_Setup.exe"
RELEASE_API_URL = os.environ.get(
    "ROADMAPS_APP_RELEASE_API_URL",
    "https://roadmaps.ir/api/v1/roadmapsapp/releases/latest/"
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_STORAGE_DIR = writable_app_data_dir() / ".roadmaps_app"
RELEASES_DIR = APP_STORAGE_DIR / "releases"
BACKUP_DIR = APP_STORAGE_DIR / "backups"
UPDATES_DIR = writable_app_data_dir() / "updates"
CURRENT_VERSION_FILE = APP_STORAGE_DIR / "current_version.txt"
UPDATE_LOG_FILE = APP_STORAGE_DIR / "update_log.json"
PACKAGED_VERSION_FILE = resource_path('backend', 'build_assets', 'current_version.txt')


def _parse_version(value):
    match = re.fullmatch(r'v?(\d+(?:\.\d+){0,3})', str(value or '').strip(), flags=re.IGNORECASE)
    if not match:
        return None

    parts = tuple(int(component) for component in match.group(1).split('.'))
    # Compare numeric components as tuples, so 1.0.10 sorts after 1.0.2.
    return parts + (0,) * (4 - len(parts))


def _is_newer_version(current, latest):
    current_version = _parse_version(current)
    latest_version = _parse_version(latest)
    return (
        current_version is not None
        and latest_version is not None
        and latest_version > current_version
    )


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'y', 'on', 'required', 'forced'}
    if type(value) is int and value in (0, 1):
        return value == 1
    # Only explicit true-shaped values are accepted; arbitrary objects must not become truthy.
    return False


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
        if PACKAGED_VERSION_FILE.exists():
            try:
                return PACKAGED_VERSION_FILE.read_text(encoding='utf-8').strip() or APP_VERSION
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
            response = requests.get(
                RELEASE_API_URL,
                headers={'User-Agent': 'RoadMaps-App-Updater/1.0'},
                timeout=(5, 20),
                verify=certifi.where(),
            )
            response.raise_for_status()
            payload = response.json()
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
                payload.get('force_update', payload.get('force', payload.get('required', False))),
            )
        )
        parsed_current_version = _parse_version(current_version)
        parsed_min_supported_version = _parse_version(min_supported_version) if min_supported_version else None
        below_minimum_version = (
            parsed_current_version is not None
            and parsed_min_supported_version is not None
            and parsed_current_version < parsed_min_supported_version
        )
        print(
            '[Updater] Minimum-version check: '
            f'current={current_version!r} ({parsed_current_version}), '
            f'minimum={min_supported_version!r} ({parsed_min_supported_version}), '
            f'api_force={api_force_update}, below_minimum={below_minimum_version}'
        )
        has_update = (
            _is_newer_version(current_version, latest_version)
            or api_force_update
            or below_minimum_version
        )
        is_force_update = api_force_update or below_minimum_version
        download_url = payload.get('download_url', '') or DEFAULT_DOWNLOAD_URL
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
            'sha256': payload.get('file_hash') or payload.get('sha256', ''),
            'error': None,
        }

    @staticmethod
    def _download_file(url, out_path):
        parsed_url = urlsplit(url)
        is_loopback_http = (
            parsed_url.scheme == 'http'
            and parsed_url.hostname in {'localhost', '127.0.0.1', '::1'}
            and not getattr(sys, 'frozen', False)
        )
        if parsed_url.scheme != 'https' and not is_loopback_http:
            raise ValueError('Release downloads must use HTTPS.')

        request = urllib.request.Request(url, headers={'User-Agent': 'RoadMaps-App-Updater/1.0'})
        with urllib.request.urlopen(request, timeout=180) as response, open(out_path, 'wb') as handle:
            final_url = urlsplit(response.geturl())
            final_is_loopback_http = (
                final_url.scheme == 'http'
                and final_url.hostname in {'localhost', '127.0.0.1', '::1'}
                and not getattr(sys, 'frozen', False)
            )
            if final_url.scheme != 'https' and not final_is_loopback_http:
                raise ValueError('Release download redirects must use HTTPS.')

            content_length = response.headers.get('Content-Length')
            total_bytes = int(content_length) if content_length else 0
            if total_bytes > 2 * 1024 * 1024 * 1024:
                raise ValueError('Release artifact exceeds the 2 GiB download limit.')
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
                if downloaded_bytes > 2 * 1024 * 1024 * 1024:
                    raise ValueError('Release artifact exceeds the 2 GiB download limit.')
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
    def _install_update_and_exit(setup_path, latest_version):
        if not getattr(sys, 'frozen', False):
            raise RuntimeError('Installer execution is only available in packaged builds.')

        version_value = str(latest_version).strip()
        if not re.fullmatch(r'v?\d+(?:\.\d+){0,3}', version_value, flags=re.IGNORECASE):
            raise ValueError('Release version contains unsupported characters.')

        staged_setup = Path(setup_path).resolve()
        if not staged_setup.is_file():
            raise FileNotFoundError(f'Staged update installer not found: {staged_setup}')

        try:
            import core.engine_controller as engine_controller
        except Exception as exc:
            raise RuntimeError(f'Could not load the trading engine for shutdown: {exc}') from exc

        engine_controller.stop_robot()
        trade_thread = getattr(engine_controller, 'trade_thread', None)
        if trade_thread is not None and trade_thread.is_alive():
            trade_thread.join(timeout=10.0)
            if trade_thread.is_alive():
                raise RuntimeError('Trading engine did not stop within 10 seconds; update was not started.')

        try:
            import MetaTrader5 as mt5
            mt5.shutdown()
        except Exception:
            pass

        creation_flags = (
            getattr(subprocess, 'DETACHED_PROCESS', 0)
            | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
        )
        subprocess.Popen(
            [
                str(staged_setup),
                '/VERYSILENT',
                '/SUPPRESSMSGBOXES',
                '/FORCECLOSEAPPLICATIONS',
            ],
            cwd=str(staged_setup.parent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            creationflags=creation_flags,
        )

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

        if not re.fullmatch(r'[a-fA-F0-9]{64}', str(expected_hash or '')):
            return {
                'success': False,
                'message': 'Release is missing a valid SHA-256 checksum.',
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
            }

        APP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        UPDATES_DIR.mkdir(parents=True, exist_ok=True)

        if not re.fullmatch(r'v?\d+(?:\.\d+){0,3}', str(latest_version), flags=re.IGNORECASE):
            return {
                'success': False,
                'message': 'Release version contains unsupported characters.',
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
            }

        temp_fd, temp_path = tempfile.mkstemp(prefix='roadmapsapp-update-', suffix='.exe', dir=UPDATES_DIR)
        os.close(temp_fd)

        try:
            AppUpdater._download_file(download_url, temp_path)
            actual_hash = AppUpdater._compute_sha256(temp_path)
            if actual_hash.lower() != expected_hash.lower():
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

            target_setup_path = UPDATES_DIR / f'RoadmapsApp_Setup-{latest_version}.exe'
            if target_setup_path.exists():
                target_setup_path.unlink()
            shutil.move(temp_path, target_setup_path)

            if not getattr(sys, 'frozen', False):
                return {
                    'success': True,
                    'message': 'Update installer downloaded and verified; installer execution requires a packaged build.',
                    'has_update': True,
                    'is_force_update': status.get('is_force_update', False),
                    'update_type': status.get('update_type', 'optional'),
                    'version': latest_version,
                    'install_path': str(target_setup_path),
                }

            AppUpdater._install_update_and_exit(str(target_setup_path), latest_version)

            return {
                'success': True,
                'message': f'Update to version {latest_version} installed successfully. Restarting...',
                'has_update': True,
                'is_force_update': status.get('is_force_update', False),
                'update_type': status.get('update_type', 'optional'),
                'version': latest_version,
                'install_path': str(target_setup_path),
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
        if status.get('error'):
            return {
                'status': 'check_failed',
                'message': f'Update check failed: {status["error"]}',
                **status,
            }
        return {'status': 'up_to_date', 'message': 'App is up to date.', **status}