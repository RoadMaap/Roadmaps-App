import os
import re
import time
import base64
import hashlib
import platform
import subprocess
import threading
import uuid
from pathlib import Path
from functools import wraps
from urllib.parse import unquote

from cryptography.fernet import Fernet, InvalidToken

class SystemShield:
    """
    لایه محافظتی Enterprise برای برنامه لوکال:
    - رمزنگاری داده‌های حساس متصل به سخت‌افزار (HWID Locking)
    - جلوگیری از اسپم (Rate Limiting)
    - پاک‌سازی ورودی‌ها (Input Sanitization)
    """

    _call_history = {}
    _rate_limit_lock = threading.Lock()

    @staticmethod
    def _get_machine_id():
        """Create a stable machine fingerprint without relying on deprecated WMIC commands."""
        try:
            if platform.system() == "Windows":
                candidate_commands = [
                    ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystemProduct).UUID"],
                    ["powershell", "-NoProfile", "-Command", "(Get-WmiObject Win32_ComputerSystemProduct).UUID"],
                    ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_BIOS).SerialNumber"],
                    ["cmd", "/c", "wmic csproduct get uuid"],
                ]

                for command in candidate_commands:
                    try:
                        output = subprocess.check_output(
                            command,
                            stderr=subprocess.DEVNULL,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                        )
                        text = output.decode("utf-8", errors="ignore")
                        lines = [line.strip() for line in text.splitlines() if line.strip()]
                        for line in lines:
                            if line.lower().startswith("uuid") or line.lower().startswith("serialnumber"):
                                continue
                            if len(line) >= 8 and not line.startswith("===="):
                                return line
                    except Exception:
                        continue

                try:
                    import winreg
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as key:
                        value, _ = winreg.QueryValueEx(key, "MachineGuid")
                        if value:
                            return value
                except Exception:
                    pass

            elif platform.system() == "Darwin":
                output = subprocess.check_output(
                    "ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID",
                    shell=True,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                ).decode()
                return output.split('"')[3]
        except Exception:
            pass
        return f"{platform.node()}::{uuid.getnode()}"

    @staticmethod
    def _get_cipher_key():
        """Derive a Fernet key from the local machine identity."""
        hwid = SystemShield._get_machine_id()
        digest = hashlib.sha256(hwid.encode('utf-8')).digest()
        return base64.urlsafe_b64encode(digest)

    @staticmethod
    def encrypt_data(text: str) -> str:
        """Encrypt sensitive text while keeping legacy values untouched."""
        if not text or text.startswith(("ENC::", "ENC2::")):
            return text

        token = Fernet(SystemShield._get_cipher_key()).encrypt(text.encode('utf-8'))
        return f"ENC2::{token.decode('ascii')}"

    @staticmethod
    def decrypt_data(encrypted_text: str) -> str:
        """Decrypt new Fernet values and retain compatibility with legacy XOR values."""
        if not encrypted_text or not encrypted_text.startswith(("ENC::", "ENC2::")):
            return encrypted_text

        try:
            if encrypted_text.startswith("ENC2::"):
                token = encrypted_text[len("ENC2::"):].encode('ascii')
                return Fernet(SystemShield._get_cipher_key()).decrypt(token).decode('utf-8')

            clean_text = encrypted_text[len("ENC::"):]
            decoded = base64.b64decode(clean_text.encode('utf-8')).decode('utf-8')
            legacy_hwid_values = [
                SystemShield._get_machine_id(),
                "UNKNOWN_NATIVE_MACHINE_12345",
            ]
            for legacy_hwid in legacy_hwid_values:
                legacy_key = hashlib.sha256(legacy_hwid.encode('utf-8')).digest()
                candidate = "".join(
                    chr(ord(char) ^ legacy_key[index % len(legacy_key)])
                    for index, char in enumerate(decoded)
                )
                if candidate.isprintable():
                    return candidate
            return ""
        except (InvalidToken, ValueError, UnicodeError, base64.binascii.Error) as error:
            print(f"🛡️ [SECURITY ALERT] Failed to decrypt data. File might be stolen or tampered: {error}")
            return ""

    @staticmethod
    def rate_limit(max_calls: int = 3, period_seconds: float = 2.0):
        """
        دکوراتور ضد-اسپم (Anti-DDoS لوکال).
        از کلیک‌های رگباری کاربر روی دکمه‌هایی مثل "استارت ربات" جلوگیری می‌کند.
        """
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                func_name = func.__name__
                now = time.monotonic()
                with SystemShield._rate_limit_lock:
                    history = SystemShield._call_history.get(func_name, [])
                    history = [timestamp for timestamp in history if now - timestamp < period_seconds]

                    if len(history) >= max_calls:
                        print(f"🛡️ [SECURITY ALERT] Rate limit exceeded for '{func_name}'. Request blocked.")
                        from core.error_handler import ui_log
                        ui_log('error', "⚠️ Please slow down! Too many requests.")
                        return {"success": False, "message": "Too many requests. Please wait."}

                    history.append(now)
                    SystemShield._call_history[func_name] = history
                return func(*args, **kwargs)
            return wrapper
        return decorator

    @staticmethod
    def sanitize_path(file_path: str) -> bool:
        """Validate a user-selected strategy path without breaking native file selection."""
        if not isinstance(file_path, str) or not file_path.strip():
            return False

        decoded_path = unquote(file_path).replace('\x00', '')
        if '\x00' in file_path or '\x00' in decoded_path:
            print("🛡️ [SECURITY ALERT] Null byte in strategy path.")
            return False

        try:
            resolved_path = Path(decoded_path).expanduser().resolve(strict=True)
        except (OSError, RuntimeError, ValueError):
            return False

        if not resolved_path.is_file() or resolved_path.suffix.lower() != '.py':
            print(f"🛡️ [SECURITY ALERT] Invalid strategy file path: {resolved_path}")
            return False

        return True