import urllib.request
import urllib.error
import http.client
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import time
import threading
import json
import sys
from pathlib import Path
from runtime_paths import writable_backend_dir

def ui_log(msg_type, msg):
    print(msg)
    try:
        import eel
        if hasattr(eel, 'update_status'):
            eel.update_status(msg_type, msg)
    except Exception:
        pass

def _news_settings_path():
    if getattr(sys, 'frozen', False):
        return writable_backend_dir() / 'storage' / 'user_settings.json'
    return Path(__file__).resolve().parents[1] / 'storage' / 'user_settings.json'


def get_news_settings():
    settings = {'nf_enabled': False, 'nf_eur': True, 'nf_usd': True}
    try:
        with _news_settings_path().open('r', encoding='utf-8') as settings_file:
            data = json.load(settings_file)
        if isinstance(data, dict):
            settings.update(data)
    except Exception:
        pass

    def read_bool(value, default):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {'true', '1', 'yes', 'on'}:
                return True
            if normalized in {'false', '0', 'no', 'off'}:
                return False
        return default

    settings['nf_enabled'] = read_bool(settings.get('nf_enabled'), False)
    settings['nf_eur'] = read_bool(settings.get('nf_eur'), True)
    settings['nf_usd'] = read_bool(settings.get('nf_usd'), True)
    return settings


def get_active_currencies():
    settings = get_news_settings()
    if not settings['nf_enabled']:
        return []
    return [currency for currency, setting in (('EUR', 'nf_eur'), ('USD', 'nf_usd')) if settings[setting]]

class NewsFilter:
    _instance = None
    FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(NewsFilter, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, cache_minutes=240):
        if self._initialized: return
        self.cache_minutes = cache_minutes
        self.news_data = []
        self.last_fetch_time = 0
        self.next_fetch_time = 0
        self.fetch_failures = 0
        self._initialized = True

    def fetch_news(self):
        current_time = time.time()
        
        if current_time < self.next_fetch_time:
            return self.news_data

        try:
            req = urllib.request.Request(self.FF_URL, headers={'User-Agent': 'Mozilla/5.0'})
            # کاهش Timeout به 7 ثانیه تا در صورت قطعی اینترنت، ربات معطل نشود
            with urllib.request.urlopen(req, timeout=7) as response:
                xml_data = response.read()
                
            root = ET.fromstring(xml_data)
            parsed_news = []
            
            for event in root.findall('event'):
                impact = event.find('impact').text.strip() if event.find('impact') is not None else ''
                if impact != 'High': continue
                    
                currency = event.find('country').text.strip().upper() if event.find('country') is not None else ''
                
                if currency not in ['EUR', 'USD']: continue
                    
                date_str = event.find('date').text.strip() if event.find('date') is not None else ''
                time_str = event.find('time').text.strip() if event.find('time') is not None else ''
                title = event.find('title').text.strip() if event.find('title') is not None else ''
                
                if 'All Day' in time_str or not time_str: continue
                
                try:
                    datetime_str = f"{date_str} {time_str}"
                    event_dt_est = datetime.strptime(datetime_str, '%m-%d-%Y %I:%M%p')
                    event_utc = event_dt_est + timedelta(hours=5)
                    
                    parsed_news.append({
                        'currency': currency,
                        'time': event_utc,
                        'title': title
                    })
                except Exception:
                    pass 

            self.news_data = sorted(parsed_news, key=lambda x: x['time'])
            self.last_fetch_time = current_time
            self.next_fetch_time = current_time + self.cache_minutes * 60
            self.fetch_failures = 0
            ui_log('success', f"🌍 [NEWS DAEMON] Synced {len(self.news_data)} High-Impact (EUR/USD) events.")
            
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as e:
            self.fetch_failures += 1
            retry_seconds = min(60 * (2 ** (self.fetch_failures - 1)), 900)
            self.next_fetch_time = current_time + retry_seconds
            ui_log('warning', f"📡 [NETWORK] Could not reach ForexFactory. Retrying in {retry_seconds}s. Reason: {e}")
        except Exception as e:
            self.fetch_failures += 1
            retry_seconds = min(60 * (2 ** (self.fetch_failures - 1)), 900)
            self.next_fetch_time = current_time + retry_seconds
            ui_log('error', f"⚠️ [NEWS DAEMON ERROR] Feed parsing failed. Retrying in {retry_seconds}s. Reason: {e}")
            
        return self.news_data

    def get_next_news_ui(self):
        if not self.news_data:
            return None
            
        current_utc = datetime.utcnow()
        active_curs = get_active_currencies() 
        if not active_curs:
            return None
        
        for news in self.news_data:
            if news['currency'] not in active_curs:
                continue
                
            if news['time'] + timedelta(minutes=30) > current_utc:
                time_diff = news['time'] - current_utc
                
                if time_diff.total_seconds() < 0:
                    countdown_str = "HAPPENING NOW!"
                else:
                    hours, remainder = divmod(int(time_diff.total_seconds()), 3600)
                    minutes, seconds = divmod(remainder, 60)
                    countdown_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                    
                return {
                    'currency': news['currency'],
                    'title': news['title'],
                    'countdown': countdown_str
                }
                
        return None

class NewsTickerDaemon(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = True 
        self.news_filter = NewsFilter()
        self.news_was_enabled = get_news_settings()['nf_enabled']
        self.last_ui_news = None

    def run(self):
        time.sleep(2) 
        ui_log('success', "🌐 [BACKGROUND SERVICE] UI News Ticker Daemon Started.")
        
        while True:
            try:
                news_enabled = get_news_settings()['nf_enabled']
                if not news_enabled:
                    self.news_filter.news_data = []
                    self.news_filter.next_fetch_time = 0
                    if self.news_was_enabled or self.last_ui_news is not None:
                        import eel
                        if hasattr(eel, 'update_news_ticker'):
                            eel.update_news_ticker(None)
                    self.news_was_enabled = False
                    self.last_ui_news = None
                    time.sleep(1)
                    continue

                self.news_was_enabled = True
                self.news_filter.fetch_news()
                next_news = self.news_filter.get_next_news_ui()
                if next_news != self.last_ui_news:
                    import eel
                    if hasattr(eel, 'update_news_ticker'):
                        eel.update_news_ticker(next_news)
                    self.last_ui_news = next_news
            except Exception:
                pass
            
            time.sleep(1)

def start_news_ticker_service():
    daemon = NewsTickerDaemon()
    daemon.start()
    return daemon