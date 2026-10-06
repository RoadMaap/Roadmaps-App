# ==============================================================================
# AI VISION CHART ANALYZER ENGINE (ENTERPRISE EDITION)
# Features: Image Optimization, Multi-Agent Prompts, JSON Sanitization
# ==============================================================================

import base64
import json
import requests
import re
import os
import io
import traceback
from PIL import Image

# 🛠 1. ایمپورت کتابخانه dotenv
from dotenv import load_dotenv
from runtime_paths import writable_backend_dir

# 🛠 2. لود کردن متغیرهای محیطی از فایل .env
load_dotenv()

# ==============================================================================
# 1. PROMPT VAULT (SYSTEM INSTRUCTIONS)
# ==============================================================================
GEMINI_SYSTEM_PROMPT = """
You are an elite Institutional Algorithmic Trader and Senior Technical Analyst.
Your task is to visually analyze the provided financial chart screenshot.

Analyze the chart using the following methodologies:
1. PRICE ACTION: Identify trend direction, Break of Structure (BOS), Change of Character (ChoCH), Liquidity Sweeps, Support/Resistance zones, and key candlestick setups.
2. INDICATORS & CONFLUENCE: Analyze visible indicators (RSI, MACD, EMAs). If NO indicators are visible, you MUST analyze Smart Money Concepts (SMC) such as Fair Value Gaps (FVG), Order Blocks, Liquidity Sweeps, and Volume/Momentum footprints to confirm the setup. Do not just say "no indicators".
3. MARKET REGIME: Strictly classify as 'TRENDING_BULLISH', 'TRENDING_BEARISH', or 'RANGING'.
4. EXECUTION PLAN: Determine the highest probability trade (BUY, SELL, or WAIT). 
   - You MUST estimate logical Entry Zones, Stop Loss, and Take Profit targets based on the visible Y-Axis price scale.
   - ⚠️ CRITICAL: Even if the price labels are blurry, you MUST ESTIMATE the prices. NEVER leave entry_zone, stop_loss, or take_profit empty or "N/A"!

CRITICAL INSTRUCTION:
You MUST respond ONLY with a valid JSON object. 
WARNING: NEVER use double quotes (") inside your text descriptions for 'price_action_analysis', 'indicators_analysis' or 'risk_note'. Use single quotes (') instead. This is strictly required to prevent JSON parse crashes!
"""

# ==============================================================================
# 2. IMAGE OPTIMIZATION ENGINE
# ==============================================================================
class ImageProcessor:
    MAX_RESOLUTION = (1024, 1024) 

    @staticmethod
    def process_and_encode(base64_str: str) -> str:
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
                
            image_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(image_bytes))
            
            if img.mode in ("RGBA", "P", "LA"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "RGBA":
                    background.paste(img, mask=img.split()[3])
                else:
                    background.paste(img)
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
                
            img.thumbnail(ImageProcessor.MAX_RESOLUTION, Image.Resampling.LANCZOS)
            
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=85, optimize=True)
            return base64.b64encode(buffered.getvalue()).decode('utf-8')
            
        except Exception as e:
            print(f"❌ Image optimization error: {e}")
            return base64_str 

# ==============================================================================
# 3. BULLETPROOF JSON SANITIZER & RESCUE ENGINE
# ==============================================================================
class JSONSanitizer:
    DEFAULT_FALLBACK = {
        "market_state": "ERROR", "confidence_score": 0, "trade_bias": "NEUTRAL",
        "entry_zone": "N/A", "stop_loss": "N/A", "take_profit_1": "N/A", "take_profit_2": "N/A",
        "price_action_analysis": "Failed to parse AI response.",
        "indicators_analysis": "N/A", "risk_note": "System Error"
    }

    @staticmethod
    def extract_json(raw_text: str) -> dict:
        clean_text = raw_text.replace("```json", "").replace("```", "").strip()
        
        try:
            # 1. Search for JSON boundaries
            start_idx = clean_text.find('{')
            if start_idx == -1:
                parsed_data = json.loads(clean_text)
            else:
                # 2. Brace counting algorithm
                brace_count = 0
                end_idx = -1
                in_string = False
                escape = False
                
                for i in range(start_idx, len(clean_text)):
                    char = clean_text[i]
                    if in_string:
                        if escape:
                            escape = False
                        elif char == '\\':
                            escape = True
                        elif char == '"':
                            in_string = False
                    else:
                        if char == '"':
                            in_string = True
                        elif char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end_idx = i
                                break 
                                
                if end_idx != -1:
                    json_str = clean_text[start_idx:end_idx+1]
                    json_str = re.sub(r',\s*\}', '}', json_str)
                    json_str = re.sub(r',\s*\]', ']', json_str)
                    parsed_data = json.loads(json_str)
                else:
                    parsed_data = json.loads(clean_text)
            
            # 🛠 FIX 3: Merge with DEFAULT_FALLBACK to ensure no missing keys crash the UI
            final_data = JSONSanitizer.DEFAULT_FALLBACK.copy()
            final_data.update(parsed_data)
            return final_data

        except Exception as e:
            print(f"⚠️ JSON Parse Blocked: {e}. Activating Regex Rescue Engine...")
            return JSONSanitizer.regex_rescue(clean_text, str(e))

    @staticmethod
    def regex_rescue(raw_text: str, error_msg: str) -> dict:
        fallback = JSONSanitizer.DEFAULT_FALLBACK.copy()
        fallback["price_action_analysis"] = f"JSON Extracted via Rescue Engine. Original Error: {error_msg}"
        
        try:
            string_keys = ['market_state', 'trade_bias', 'entry_zone', 'stop_loss', 'take_profit_1', 'take_profit_2']
            for key in string_keys:
                match = re.search(fr'"{key}"\s*:\s*"([^"]+)"', raw_text)
                if match: fallback[key] = match.group(1).strip()
            
            match_score = re.search(r'"confidence_score"\s*:\s*(\d+)', raw_text)
            if match_score: fallback['confidence_score'] = int(match_score.group(1))
            
            print(f"✅ Regex Rescue Successful! Bias: {fallback['trade_bias']} | SL: {fallback['stop_loss']}")
        except Exception as ex:
            print(f"❌ Regex Rescue Failed: {ex}")
            
        return fallback

# ==============================================================================
# 4. GEMINI CLOUD CLIENT
# ==============================================================================
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class GeminiVisionClient:
    def __init__(self):
        self.settings_path = str(writable_backend_dir() / 'storage' / 'user_settings.json')
        
        self.proxies_to_try = [
            None, 
            {"http": "http://127.0.0.1:10809", "https": "http://127.0.0.1:10809"}, 
            {"http": "http://127.0.0.1:10808", "https": "http://127.0.0.1:10808"}, 
            {"http": "http://127.0.0.1:7890",  "https": "http://127.0.0.1:7890"},  
            {"http": "http://127.0.0.1:2080",  "https": "http://127.0.0.1:2080"},  
        ]

    def get_api_key(self) -> str:
        # 🛠 3. ابتدا فایل .env را چک می‌کند
        env_key = os.getenv("GEMINI_API_KEY")
        if env_key and env_key.strip():
            return env_key.strip()

        # 🛠 4. اگر در .env نبود، به سراغ دیتابیس لوکال (تنظیمات داشبورد) می‌رود
        try:
            from security.system_shield import SystemShield
            with open(self.settings_path, 'r') as f:
                data = json.load(f)
                encrypted_key = data.get('gemini_api_key', '')
                if encrypted_key:
                    return SystemShield.decrypt_data(encrypted_key)
        except Exception:
            pass
            
        return ''

    def analyze_chart(self, raw_base64_image: str, lang: str = "en") -> dict:
        api_key = self.get_api_key()
        if not api_key:
            return self._build_error_response("Missing Google Gemini API Key. Please add it in the Dashboard settings.", auth_error=True)

        print("⚙️ [Gemini Client] Optimizing image payload...")
        optimized_b64 = ImageProcessor.process_and_encode(raw_base64_image)
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
        
        dynamic_prompt = GEMINI_SYSTEM_PROMPT
        if lang == "fa":
            dynamic_prompt += "\nCRITICAL LANGUAGE INSTRUCTION: You MUST write the values for 'price_action_analysis', 'indicators_analysis', and 'risk_note' entirely in Persian (Farsi). Do NOT translate the JSON keys or the ENUM values (like BUY, SELL, TRENDING_BULLISH)."
            
        payload = {
            "contents": [{
                "parts": [
                    {"text": dynamic_prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": optimized_b64}}
                ]
            }],
            "generationConfig": {
                "response_mime_type": "application/json", 
                "temperature": 0.1,
                "response_schema": {
                    "type": "OBJECT",
                    "properties": {
                        "market_state": {"type": "STRING"},
                        "confidence_score": {"type": "INTEGER"},
                        "trade_bias": {"type": "STRING"},
                        "entry_zone": {"type": "STRING"},
                        "stop_loss": {"type": "STRING"},
                        "take_profit_1": {"type": "STRING"},
                        "take_profit_2": {"type": "STRING"},
                        "price_action_analysis": {"type": "STRING"},
                        "indicators_analysis": {"type": "STRING"},
                        "risk_note": {"type": "STRING"}
                    },
                    "required": ["market_state", "confidence_score", "trade_bias", "entry_zone", "stop_loss", "take_profit_1", "take_profit_2", "price_action_analysis", "indicators_analysis", "risk_note"]
                }
            }
        }

        for i, proxy in enumerate(self.proxies_to_try):
            proxy_name = "Direct Connection" if proxy is None else proxy['https']
            print(f"🧠 [Gemini Client] Sending chart to Google Cloud... (Attempt {i+1} via {proxy_name})")
            
            try:
                session = requests.Session()
                session.proxies = proxy if proxy else {}
                
                response = session.post(url, json=payload, timeout=45, verify=False)
                response.raise_for_status()
                
                data = response.json()
                raw_text = data['candidates'][0]['content']['parts'][0]['text']
                
                print("✅ [Gemini Client] Response received successfully! Sanitizing output...")
                return JSONSanitizer.extract_json(raw_text)
                
            except requests.exceptions.HTTPError as e:
                error_msg = f"HTTP Error: {response.status_code}"
                try:
                    err_details = response.json().get('error', {}).get('message', '')
                    if "API key not valid" in err_details:
                        return self._build_error_response("Invalid API Key provided.", auth_error=True)
                    else:
                        error_msg += f" - {err_details}"
                except: pass
                
                print(f"❌ Gemini Cloud Error: {error_msg}")
                return self._build_error_response(error_msg)
                
            except requests.exceptions.SSLError as e:
                print(f"⚠️ Proxy Attempt {i+1} Failed: SSL Blocked. Trying next route...")
                continue
                
            except requests.exceptions.ConnectionError as e:
                print(f"⚠️ Proxy Attempt {i+1} Failed: Connection Refused. Trying next route...")
                continue
                
            except Exception as e:
                error_trace = traceback.format_exc()
                print(f"❌ Gemini Pipeline Exception:\n{error_trace}")
                return self._build_error_response(str(e))

        print("❌ [Gemini Client] All connection attempts exhausted. Network heavily restricted.")
        return self._build_error_response("Network Connection Blocked. Turn on TUN Mode in your VPN.")

    def _build_error_response(self, error_msg: str, auth_error: bool = False) -> dict:
        fallback = JSONSanitizer.DEFAULT_FALLBACK.copy()
        fallback["market_state"] = "AUTH_ERROR" if auth_error else "NETWORK_ERROR"
        fallback["price_action_analysis"] = f"Cloud Connection Failed: {error_msg}"
        fallback["risk_note"] = "Check your internet connection, VPN TUN mode, and API Key validity."
        return fallback