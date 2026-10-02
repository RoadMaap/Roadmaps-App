import base64
import hashlib
import http.server
import json
import os
import secrets
import shutil
import socketserver
import subprocess
import threading
import tempfile
import time
import urllib.parse
from pathlib import Path
import requests
from requests.exceptions import RequestException, JSONDecodeError


def _load_env_file():
    """Load local project .env values when present without requiring third-party packages."""
    env_path = Path(__file__).resolve().parents[2] / '.env'
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file()

# All inline and block comments are strictly written in professional English.

# Ensure no leading slash before http and keep trailing slashes intact
BACKEND_BASE_URL = os.getenv("ROADMAPS_BACKEND_URL", "https://roadmaps.ir/").rstrip('/')
PKCE_START_URL = f"{BACKEND_BASE_URL}/api/v1/users/auth/pkce/start/"
PKCE_TOKEN_URL = f"{BACKEND_BASE_URL}/api/v1/users/auth/pkce/token/"

# Local loopback callback port for the desktop PKCE browser redirect flow.
# Supports both project-specific and generic env variables for compatibility.
LOCAL_AUTH_PORT = int(os.getenv("ROADMAPS_LOCAL_AUTH_PORT") or os.getenv("LOCAL_AUTH_PORT") or "8765")


def _open_private_browser(login_url):
    """Launch a browser with a fresh, isolated profile for this login attempt."""
    candidates = [
        (shutil.which('msedge'), ['--inprivate']),
        (shutil.which('chrome'), ['--incognito']),
        (shutil.which('firefox'), ['-private-window']),
    ]

    for program_files in (os.environ.get('PROGRAMFILES'), os.environ.get('PROGRAMFILES(X86)')):
        if not program_files:
            continue
        candidates.extend([
            (str(Path(program_files) / 'Microsoft/Edge/Application/msedge.exe'), ['--inprivate']),
            (str(Path(program_files) / 'Google/Chrome/Application/chrome.exe'), ['--incognito']),
            (str(Path(program_files) / 'Mozilla Firefox/firefox.exe'), ['-private-window']),
        ])

    local_app_data = os.environ.get('LOCALAPPDATA')
    if local_app_data:
        candidates.extend([
            (str(Path(local_app_data) / 'Microsoft/Edge/Application/msedge.exe'), ['--inprivate']),
            (str(Path(local_app_data) / 'Google/Chrome/Application/chrome.exe'), ['--incognito']),
            (str(Path(local_app_data) / 'Mozilla Firefox/firefox.exe'), ['-private-window']),
        ])

    profile_dir = tempfile.TemporaryDirectory(prefix='roadmaps-auth-')
    for executable, private_args in candidates:
        if executable and Path(executable).is_file():
            if private_args == ['--inprivate']:
                profile_args = [f'--user-data-dir={profile_dir.name}', *private_args]
            elif private_args == ['--incognito']:
                profile_args = [f'--user-data-dir={profile_dir.name}', *private_args]
            elif private_args == ['-private-window']:
                profile_args = ['-profile', profile_dir.name, '-no-remote', *private_args]
            try:
                process = subprocess.Popen([executable, *profile_args, login_url], close_fds=True)
                return process, profile_dir
            except OSError:
                profile_dir.cleanup()
                raise

    profile_dir.cleanup()
    raise RuntimeError('No supported browser was found for private login. Install Edge, Chrome, or Firefox.')


def _close_private_browser(process, profile_dir):
    """Stop the isolated browser process and remove its one-time profile."""
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        if os.name == 'nt':
            subprocess.run(
                ['taskkill', '/F', '/T', '/PID', str(process.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    finally:
        profile_dir.cleanup()


class AuthHandler(http.server.SimpleHTTPRequestHandler):
    """Captures the loopback authorization code redirected from browser."""

    def log_message(self, format, *args):
        # Suppress logging in production/dev console
        pass

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == '/auth':
            query_params = urllib.parse.parse_qs(parsed_path.query)
            code = query_params.get('code', [None])[0]
            state = query_params.get('state', [None])[0]

            if code and state:
                self.server.received_code = code
                self.server.received_state = state

                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()

                success_html = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Authentication Successful</title>
                    <style>
                        body {
                            background-color: #09090b;
                            color: #10b981;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            text-align: center;
                        }
                        .container {
                            border: 1px solid rgba(255,255,255,0.1);
                            padding: 32px 48px;
                            border-radius: 16px;
                            background: rgba(18, 18, 21, 0.8);
                        }
                        h1 { font-size: 24px; margin-bottom: 8px; }
                        p { color: #a1a1aa; font-size: 14px; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Login Successful! ✅</h1>
                        <p>Authentication complete. Returning to RoadMap Terminal...</p>
                    </div>
                    <script>setTimeout(() => window.close(), 1500);</script>
                </body>
                </html>
                """
                self.wfile.write(success_html.encode('utf-8'))
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Error: Missing authorization code or state.")

            # Safely shutdown the server in a separate thread to allow response completion
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(404)
            self.end_headers()


class DesktopAuthClient:
    """Handles client-side PKCE generation, system browser lifecycle, and token exchange."""

    def __init__(self):
        self.device_state = None
        
        # Initialize a requests Session with default headers
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        self.timeout = 15

    def _generate_pkce_credentials(self):
        """Generates cryptographically secure code_verifier and code_challenge."""
        code_verifier = secrets.token_urlsafe(64)
        digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
        return code_verifier, code_challenge

    def wait_for_login(self, timeout_seconds=180):
        """Initiates flow, waits for user login, and returns the complete token payload."""
        socketserver.TCPServer.allow_reuse_address = True

        try:
            httpd = socketserver.TCPServer(("localhost", LOCAL_AUTH_PORT), AuthHandler)
        except OSError as exc:
            return False, f"Could not bind to local port: {exc}", None

        assigned_port = httpd.server_address[1]
        httpd.received_code = None
        httpd.received_state = None

        code_verifier, code_challenge = self._generate_pkce_credentials()

        # 1. Request PKCE session start from backend
        pkce_payload = {
            'callback_port': int(assigned_port),
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
        }

        try:
            response = self.session.post(PKCE_START_URL, json=pkce_payload, timeout=self.timeout)
            response.raise_for_status()
            session_data = response.json()
        except RequestException as exc:
            httpd.server_close()
            return False, f"Backend connection failed: {exc}", None
        except JSONDecodeError:
            httpd.server_close()
            return False, "Failed to decode backend JSON response.", None

        login_url = session_data.get('login_url')
        self.device_state = session_data.get('state')

        # Strictly use backend-provided login_url without modification
        if not login_url or not self.device_state:
            httpd.server_close()
            return False, "Failed to retrieve valid login URL or state from backend.", None

        # 2. Open login page in a private browser session to avoid reusing site cookies.
        try:
            browser_process, browser_profile = _open_private_browser(login_url)
        except (OSError, RuntimeError) as exc:
            httpd.server_close()
            return False, f"Failed to launch browser: {exc}", None

        # 3. Spin up local server listener
        server_thread = threading.Thread(target=httpd.serve_forever)
        server_thread.daemon = True
        server_thread.start()

        # 4. Wait for loopback code
        start_time = time.time()
        while getattr(httpd, 'received_code', None) is None:
            if time.time() - start_time > timeout_seconds:
                httpd.shutdown()
                httpd.server_close()
                _close_private_browser(browser_process, browser_profile)
                return False, "Login timed out. Please try again.", None
            time.sleep(0.5)

        auth_code = httpd.received_code
        received_state = httpd.received_state
        
        httpd.shutdown()
        httpd.server_close()
        _close_private_browser(browser_process, browser_profile)

        # 5. Security Check: Validate state parameter to prevent CSRF attacks
        if received_state != self.device_state:
            return False, "Security error: State mismatch. Authentication aborted.", None

        # 6. Exchange code for JWT tokens and user profile
        try:
            exchange_payload = {
                'code': auth_code,
                'code_verifier': code_verifier,
            }
            token_resp = self.session.post(PKCE_TOKEN_URL, json=exchange_payload, timeout=self.timeout)
            token_resp.raise_for_status()
            data = token_resp.json()

            # The PKCE endpoint returns tokens only; fetch the authenticated profile separately.
            tokens = data.get('tokens')
            
            if not tokens or not tokens.get('access'):
                return False, "Tokens missing in exchange payload.", None

            user = data.get('user')
            if not isinstance(user, dict):
                user = tokens.get('user') if isinstance(tokens.get('user'), dict) else {}
            if not user:
                try:
                    profile_response = self.session.get(
                        f"{BACKEND_BASE_URL}/api/v1/users/me/",
                        headers={'Authorization': f"Bearer {tokens['access']}"},
                        timeout=self.timeout,
                    )
                    profile_response.raise_for_status()
                    profile_payload = profile_response.json()
                    if isinstance(profile_payload, dict):
                        wrapped_data = profile_payload.get('data')
                        if isinstance(wrapped_data, dict) and isinstance(wrapped_data.get('user'), dict):
                            user = wrapped_data['user']
                        elif isinstance(wrapped_data, dict):
                            user = wrapped_data
                        elif isinstance(profile_payload.get('user'), dict):
                            user = profile_payload['user']
                        else:
                            user = profile_payload
                except (RequestException, JSONDecodeError) as exc:
                    print(f"⚠️ Could not retrieve authenticated user profile: {exc}")

            if user:
                tokens = {**tokens, 'user': user}

            return True, "Authentication successful.", tokens

        except RequestException as exc:
            return False, f"Token exchange failed: {exc}", None
        except JSONDecodeError:
            return False, "Token exchange failed: Invalid JSON response.", None


def start_web_auth_flow():
    """Entry point to execute desktop authentication flow and return user data."""
    client = DesktopAuthClient()
    success, message, tokens_data = client.wait_for_login(timeout_seconds=180)
    
    return {
        "success": success,
        "message": message,
        "user_data": tokens_data  # Contains access, refresh, email, username, etc.
    }