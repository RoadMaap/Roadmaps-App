import os
import sys
import re

backend_dir = os.path.dirname(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import MetaTrader5 as mt5
from core.mt5_runtime import mt5_call, mt5_order_send
from core.trading_engine import MT5Interface
from trading.risk_manager import PercentRiskRule, FixedRiskAmountRule, FixedLotRule
from core.error_handler import ui_log

class AITradeExecutor:
    """
    آداپتور پیشرفته برای تبدیل تحلیل‌های هوش مصنوعی به اردرهای شرطی (Pending Orders) در متاتریدر.
    """
    def __init__(self, mt5_path=""):
        self.mt5 = MT5Interface(mt5_path)

    def _extract_price(self, price_str):
        """
        استخراج هوشمندانه قیمت. 
        اگر هوش مصنوعی یک محدوده (رنج) داد مثل "2340.50 - 2345.00"، اولین عدد را به عنوان نقطه ورود در نظر می‌گیرد.
        """
        if isinstance(price_str, (int, float)):
            return float(price_str)
            
        # حذف کاما (مثلا 4,380.00 -> 4380.00)
        clean_str = str(price_str).replace(',', '')
        
        # استخراج تمام اعداد (شامل اعشاری)
        matches = re.findall(r"[-+]?\d*\.\d+|\d+", clean_str)
        if matches:
            # اولین عدد پیدا شده را برمی‌گرداند
            return float(matches[0])
        return 0.0

    def execute_from_ai(self, symbol: str, ai_result: dict, risk_mode: str, risk_value: float):
        """
        خروجی AI را می‌گیرد، با استفاده از موتور شما ریسک را محاسبه کرده و اردر شرطی در متاتریدر می‌کارد.
        """
        ui_log('warning', f"⚙️ Preparing AI execution for {symbol}...")
        
        if not self.mt5.is_connected():
            return {"success": False, "message": "MT5 Terminal is not connected!"}

        # --- 1. Basic Validation ---
        trade_bias = ai_result.get("trade_bias", "NEUTRAL").lower()
        if trade_bias not in ['buy', 'sell']:
            return {"success": False, "message": f"Invalid Trade Bias ({trade_bias.upper()}). AI is Neutral."}

        # --- 2. Extract Prices Safely ---
        try:
            entry = self._extract_price(ai_result.get("entry_zone", "0"))
            sl = self._extract_price(ai_result.get("stop_loss", "0"))
            # فقط از تارگت اول برای ست کردن در اردر استفاده می‌کنیم
            tp = self._extract_price(ai_result.get("take_profit_1", "0")) 
        except Exception as e:
            return {"success": False, "message": f"Failed to parse prices: {e}"}

        # --- Anti-Hallucination Guardrails ---
        if entry <= 0 or sl <= 0 or tp <= 0:
            return {"success": False, "message": "AI returned zero or negative prices."}
            
        if trade_bias == 'buy' and sl >= entry:
            return {"success": False, "message": "Guardrail Blocked: BUY StopLoss is above Entry."}
        if trade_bias == 'sell' and sl <= entry:
            return {"success": False, "message": "Guardrail Blocked: SELL StopLoss is below Entry."}

        # --- 3. Get Live Context & Account Data ---
        acc = self.mt5.get_account_info()
        if not acc: 
            return {"success": False, "message": "Failed to fetch account balance/equity."}
            
        tick = self.mt5.get_symbol_tick(symbol)
        if not tick:
            return {"success": False, "message": f"Failed to get live tick data for {symbol}."}

        # قیمت فعلی بازار
        live_price = tick.ask if trade_bias == 'buy' else tick.bid

        context = {
            'equity': acc.equity,
            'balance': acc.balance,
            'entry_price': entry, # محاسبه بر اساس قیمت ورود شرطی
            'stop_loss': sl,
            'take_profit': tp,
            'config': {
                'contract_size': self.mt5.get_real_contract_size(symbol),
                'point_value': 1.0, 
                'COMMISSION_PER_LOT': 0.0 # می‌توان بر اساس تنظیمات بروکر تغییر داد
            }
        }

        # --- 4. Risk Calculation (استفاده از کلاس‌های بی‌نقص انجین شما) ---
        lot_size = 0.0
        try:
            if risk_mode == 'percentage':
                rule = PercentRiskRule(risk_percent=risk_value)
            elif risk_mode == 'fixed_usd':
                rule = FixedRiskAmountRule(risk_amount_dollar=risk_value)
            else: # fixed_lot
                rule = FixedLotRule(lot_size=risk_value)
                
            risk_details = rule.calculate_risk_details(context)
            if risk_details and 'lot_size' in risk_details:
                lot_size = risk_details['lot_size']
        except Exception as e:
            return {"success": False, "message": f"Risk Calculation Error: {e}"}

        # نرمال سازی لات سایز بر اساس قوانین بروکر
        lot_size = self.mt5.normalize_volume(symbol, lot_size)
        if lot_size <= 0:
            return {"success": False, "message": "Calculated Lot Size is too small or invalid for this symbol."}

        ui_log('warning', f"⚖️ Risk Engine: Calculated {lot_size} Lots for {symbol} ({trade_bias.upper()}).")

        # --- 5. Smart Order Routing (اردر شرطی لیمیت یا استاپ) ---
        # تشخیص هوشمند اینکه آیا قیمت بالاتر از نقطه ورود است یا پایین‌تر
        if trade_bias == 'buy':
            # اگر قیمت فعلی بالاتر از نقطه ورود است، منتظر پولبک (Buy Limit) هستیم
            mt5_type = mt5.ORDER_TYPE_BUY_LIMIT if entry < live_price else mt5.ORDER_TYPE_BUY_STOP
        else: # sell
            # اگر قیمت فعلی پایین‌تر از نقطه ورود است، منتظر پولبک به بالا (Sell Limit) هستیم
            mt5_type = mt5.ORDER_TYPE_SELL_LIMIT if entry > live_price else mt5.ORDER_TYPE_SELL_STOP
                   
        smart_filling = self.mt5.get_smart_filling_mode(symbol)
        
        # استریم لاگ برای کاربر
        order_type_str = "LIMIT" if "LIMIT" in str(mt5_type) else "STOP"
        ui_log('warning', f"🎣 Placing {trade_bias.upper()} {order_type_str} @ {entry} (SL: {sl}, TP: {tp})...")
        
        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": float(lot_size),
            "type": mt5_type,
            "price": float(self.mt5.normalize_price(symbol, entry)),
            "sl": float(self.mt5.normalize_price(symbol, sl)),
            "tp": float(self.mt5.normalize_price(symbol, tp)), 
            "magic": 999999, # مجیک نامبر برای هوش مصنوعی
            "comment": "AI_Pending_Exec",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": smart_filling
        }
        
        # --- 6. Execution ---
        res = mt5_order_send(request, f"AI_PENDING_{trade_bias.upper()}")
        
        success = (res and res.retcode in {mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED})
        if not success and res:
            from core.error_handler import ErrorManager
            ErrorManager.handle_mt5_error(res.retcode, symbol, f"AI_PENDING_{trade_bias.upper()}")
            return {"success": False, "message": f"Broker Rejected: {res.comment} (Code {res.retcode})"}
        elif not res:
            return {"success": False, "message": "MT5 Terminal failed to process the request. See the local MT5 error in the log."}

        ui_log('success', f"✅ AI PENDING ORDER SECURED: {trade_bias.upper()} {lot_size} Lot on {symbol}!")
        return {"success": True, "message": f"Successfully Executed Pending {trade_bias.upper()} {lot_size} Lot on {symbol}!"}