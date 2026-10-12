import MetaTrader5 as mt5
from core.mt5_runtime import mt5_call

class MarginManager:
    """
    Handles margin calculations and intelligent risk scaling for MT5.
    Ensures safe lot sizing based on broker-specific leverage and free margin.
    """
    
    def __init__(self, config: dict):
        # لوریج پیش‌فرض بروکر
        self.base_leverage = config.get("leverage", 100.0)
        # درصدی که از UI می‌آید (مثلاً 0.50 برای 50 درصد)
        self.margin_limit_pct = config.get("margin_limit_pct", 1.0)
        self.max_allowed_margin = 0.0 
        print(f"⚖️ MarginManager Init: Base Leverage 1:{self.base_leverage}, Limit: {self.margin_limit_pct * 100}%")

    def update_account_limits(self, balance: float):
        """Updates the maximum allowed margin based on the current account balance."""
        self.max_allowed_margin = balance * self.margin_limit_pct

    def update_configuration(self, config: dict):
        self.margin_limit_pct = config.get('margin_limit_pct', self.margin_limit_pct)
        self.max_allowed_margin = 0.0

    def calculate_margin(self, symbol: str, lot: float, price: float, contract_size: float = None, custom_leverage=None) -> float:
        """Calculates exact margin, factoring in user's custom strategy leverage if provided."""
        if price <= 0 or lot <= 0: 
            return 0.0
        
        margin = mt5_call(mt5.order_calc_margin, mt5.ORDER_TYPE_BUY, symbol, lot, price)
        
        if margin is None:
            if contract_size:
                active_leverage = float(custom_leverage) if (custom_leverage and str(custom_leverage).strip()) else self.base_leverage
                return (lot * contract_size * price) / active_leverage
            return 0.0
            
        # 🚨 شبیه‌سازی لوریج کاستوم: اگر کاربر لوریج کمتری تنظیم کرده باشد، مارجین بیشتری اشغال می‌شود
        if custom_leverage and str(custom_leverage).strip():
            active_leverage = float(custom_leverage)
            if active_leverage > 0:
                # نسبت لوریج واقعی به لوریج درخواستی
                margin = margin * (self.base_leverage / active_leverage)
            
        return margin

    def get_safe_lot_size(self, current_used_margin: float, symbol: str, desired_lot: float, price: float, contract_size: float, custom_leverage=None) -> tuple:
        """Intelligently scales down the lot size if it breaches the user's margin limits."""
        remaining_margin = self.max_allowed_margin - current_used_margin
        
        if remaining_margin <= 0:
            print(f"⚠️ Margin Blocked: No free margin left (Remaining: {remaining_margin:.2f})")
            return 0.0, 0.0
            
        required_margin = self.calculate_margin(symbol, desired_lot, price, contract_size, custom_leverage)
        
        if 0 < required_margin <= remaining_margin:
            return desired_lot, required_margin
            
        # Smart Scaling: Scale down the lot size mathematically!
        ratio = remaining_margin / required_margin
        safe_lot = desired_lot * ratio
        
        if safe_lot < desired_lot:
            print(f"📉 Margin Adjustment: {symbol} lot strictly reduced from {desired_lot:.2f} to {safe_lot:.4f}")
            
        safe_margin = self.calculate_margin(symbol, safe_lot, price, contract_size, custom_leverage)
        
        return safe_lot, safe_margin