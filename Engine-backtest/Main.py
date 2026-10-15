import os
import sys
import traceback
from datetime import time
import MetaTrader5 as mt5

# ==============================================================================
# 1. SYSTEM PATH INJECTION 
# ==============================================================================
# Get the absolute path of the root directory to allow cross-folder imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# ==============================================================================
# 2. LOCAL MODULE IMPORTS (Safe & Protected)
# ==============================================================================
try:
    # --- Local Engines ---
    from Single_Backtester_engine import *
    from Multi_Backtester_engine import *
    from Market_Scanner_engine import MT5MarketScanner
    
    # --- Shared Modules ---
    from Shared_Modules.Margin_usage import MarginManager
    from Shared_Modules.Risk_management_Class import *
    from Shared_Modules.Strategies_Class import SP2L_Strategy , GAP4

except ImportError as e:
    print(f"❌ Critical Import Error: {e}")
    print("⚠️ Please ensure the correct architecture is in place:")
    print("   - Backtest_Engine/Single_Backtester_engine.py")
    print("   - Backtest_Engine/Multi_Backtester_engine.py")
    print("   - Shared_Modules/Risk_management_Class.py")
    print("   - Shared_Modules/Strategies_Class.py")
    print("   - Shared_Modules/Margin_usage.py")
    sys.exit(1)

# ==============================================================================
# MULTI ASSET RUNNERS
# ==============================================================================

def run_multi_Backtest_Engine_Alpari():
    print("--- 🚀 Launching Multi Portfolio Backtest --- Alpari Broker")
    
    # Squeeze Breakout strategy parameters
    sqz_params_common = {
        'BB_PERIOD': 21, 'BB_STD': 1.9, 'KC_PERIOD': 23, 'KC_ATR_MULT': 2.0,
        'EMA_PERIOD': 55, 'ATR_PERIOD': 16, 'SL_ATR_MULT': 2.0, 'RISK_REWARD_RATIO': 2.0
    }
    
    multi_asset_config = {
        'initial_capital': 50000,
        'start_date': "2023-01-01",
        'lookback_period': 500,
        'print_trade_log': True,
        # 'STRICT_LOOKAHEAD_PROTECTION': True, # Enable this if your multi engine supports this option

        'assets': [
            # --- US30 ---
            # {
            #     'strategy_id': 'KC_on_US30', 
            #     'symbol': 'US30',
            #     'csv_file_path': 'CSVs/US30_M51.csv',
            #     'TIMEFRAME_SECONDS': 300,  
            #     'point_value': 1.0,
            #     'contract_size': 1,
            #     'spread_divisor': 100.0,
            #     'commission_per_lot': 2.3,
                
            #     # Modular risk management
            #     'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=200)],
                
            #     'candle_type': 'STANDARD',
            #     'allowed_days': [0, 1, 2, 3, 4],
            #     'killzones': [
            #         (time(3, 00), time(4, 00)),
            #         (time(17, 00), time(18, 00)),
            #         (time(19, 00), time(21, 00)),
            #         (time(22, 00), time(23, 00))
            #     ],
            #     'strategy': SqueezeBreakoutStrategy(sqz_params_common),
            # },
            # # --- NAS100 ---
            # {
            #     'strategy_id': 'KC_on_NAS100', 
            #     'symbol': 'NAS100',
            #     'csv_file_path': 'CSVs/NAS100_M5.csv', # verify the filename is correct (NDX100 or NAS100)
            #     'TIMEFRAME_SECONDS': 300,  
            #     'point_value': 1.0,
            #     'contract_size': 1,
            #     'spread_divisor': 100.0,
            #     'commission_per_lot': 1.30,
            #     'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=100)],
            #     'candle_type': 'STANDARD',
            #     'allowed_days': [0, 1, 2, 3, 4],
            #     'killzones': [
            #         (time(4, 00), time(11, 00)),
            #         (time(12, 00), time(13, 00)),
            #         (time(16, 00), time(18, 00)),
            #         (time(20, 00), time(23, 00))
            #     ],
            #     'strategy': SqueezeBreakoutStrategy(sqz_params_common),
            # },
            # --- XAUUSD ---
            {
                'strategy_id': 'KC_on_XAUUSD', 
                'symbol': 'XAUUSD',
                'csv_file_path': 'CSVs/XAUUSD_M15.csv',
                'TIMEFRAME_SECONDS': 900,  
                'point_value': 1.0,
                'contract_size': 100,
                'spread_divisor': 100.0,
                'commission_per_lot': 14.0,
                'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=100)],
                'candle_type': 'STANDARD',
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [
                    (time(3, 00), time(11, 00)),
                    (time(14, 00), time(18, 00)),
                    (time(21, 00), time(23, 00))
                ],
                'strategy': SqueezeBreakoutStrategy(sqz_params_common),
            }, 
        ]
    }
    
    try:
        # Calling Multi_Backtester from multi_Backtest_Engine.py
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        traceback.print_exc()
        
def run_multi_Backtest_Engine_fundednext11():
    print("--- 🚀 Launching Multi Portfolio Backtest --- Fundednext Broker")

    multi_asset_config = {
        'initial_capital': 25000,
        'start_date': "2023-01-01",
        'lookback_period': 500,
        'print_trade_log': True,
        'leverage': 15.0, 
        'margin_limit_pct': 0.66,
        # -------------------------------------------   US30   ----------------------------- 
        'assets': [
            {
                'strategy_id': 'KC_on_US30', 
                'symbol': 'US30',
                'csv_file_path': 'CSVs/US30_M5F2.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 10,
                'spread_divisor': 100.0,
                'commission_per_lot': 0.0,
                'MONEY_MANAGEMENT_MODE': [
                                FixedRiskAmountRule(risk_amount_dollar=40.0) ,
                                # PartialCloseRule(target_rr=3.0,  close_percentage=0.75, strict_mode=True)
                    ],
                'candle_type': 'STANDARD',
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [                    
                    (time(3, 00), time(4, 00)),
                    (time(17, 00), time(18, 00)),
                    (time(19, 00), time(21, 00)),
                    (time(22, 00), time(23, 00))],
                'strategy': SqueezeBreakoutStrategy({        
                    'BB_PERIOD': 21, 
                    'BB_STD': 1.9, 
                    'KC_PERIOD': 23, 
                    'KC_ATR_MULT': 2.0,
                    'EMA_PERIOD': 55, 
                    'ATR_PERIOD': 16, 
                    'SL_ATR_MULT': 2.0, 
                    'RISK_REWARD_RATIO': 2.0
                    }),
            },
            
            # -------------------------------------------   XAUUSD   ----------------------------- 
            
            {   'strategy_id': 'KC_on_XAUUSD', 
                'symbol': 'XAUUSD',
                'csv_file_path': 'CSVs/XAUUSD_M5F2.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,
                'spread_divisor': 100.0,
                'commission_per_lot': 3.0,
                'MONEY_MANAGEMENT_MODE': [
                                FixedRiskAmountRule(risk_amount_dollar=40.0) ,
                                
                                ],
                'candle_type': 'STANDARD',
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [
                    (time(3, 00), time(7, 00)),
                    (time(8, 00), time(18, 00)),
                    (time(20, 00), time(21, 00))],
                'strategy':SqueezeBreakoutStrategy({
                    'BB_PERIOD': 36, 
                    'BB_STD': 2.4, 
                    'KC_PERIOD': 22, 
                    'KC_ATR_MULT': 1.9,
                    'EMA_PERIOD': 45, 
                    'ATR_PERIOD': 15, 
                    'SL_ATR_MULT': 2.1, 
                    'RISK_REWARD_RATIO': 4.1
                })      
            },
            
            # -------------------------------------------   NDX100   ----------------------------- 
            
            {   'strategy_id': 'KC_on_NDX100', 
                'symbol': 'NDX100',
                'csv_file_path': 'CSVs/NDX100_M5_F2.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 10,
                'spread_divisor': 100.0,
                'commission_per_lot': 0.0,
                'MONEY_MANAGEMENT_MODE': [
                                FixedRiskAmountRule(risk_amount_dollar=25.0) ,
                                
                                ],
                'candle_type': 'STANDARD',
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [
                    (time(3, 00), time(14, 00)),
                    (time(15, 00), time(18, 00)),
                    (time(19, 00), time(22, 00))],
                'strategy':SqueezeBreakoutStrategy({
                    'BB_PERIOD': 31, 
                    'BB_STD': 2.6, 
                    'KC_PERIOD': 23, 
                    'KC_ATR_MULT': 2.0,
                    'EMA_PERIOD': 30, 
                    'ATR_PERIOD': 80, 
                    'SL_ATR_MULT': 2.2, 
                    'RISK_REWARD_RATIO': 5.0
                })      
            }
            
            # بقیه ارزها را اینجا اضافه کنید...
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        traceback.print_exc()

def run_multi_Backtest_Engine_fundednext1():
    print("--- 🚀 Launching Multi Portfolio Backtest --- Fundednext Broker")
    
    sqz_params = {
        'BB_PERIOD': 21, 'BB_STD': 1.9, 'KC_PERIOD': 23, 'KC_ATR_MULT': 2.0,
        'EMA_PERIOD': 55, 'ATR_PERIOD': 16, 'SL_ATR_MULT': 2.0, 'RISK_REWARD_RATIO': 2.0
    }

    multi_asset_config = {
        'initial_capital': 200000,
        'start_date': "2023-01-01",
        'lookback_period': 500,
        'print_trade_log': True,
        'assets': [
            {
                'strategy_id': 'KC_on_US30', 
                'symbol': 'US30',
                'csv_file_path': 'CSVs/US30_M51.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 1,
                'spread_divisor': 100.0,
                'commission_per_lot': 0.0,
                'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=200.0)],
                'candle_type': 'STANDARD',
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [(time(3, 00), time(23, 00))],
                'strategy': SqueezeBreakoutStrategy(sqz_params),
            },
            # بقیه ارزها را اینجا اضافه کنید...
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        traceback.print_exc()

def run_multi_Backtest_Engine_fundednext():
    print("--- 🚀 Launching Multi Portfolio Backtest (GAP4) --- Fundednext Broker")

    multi_asset_config = {
        'initial_capital': 50000,
        'start_date': "2020-01-01",
        'lookback_period': 1000,  # به خاطر GAP4 که 1000 تا نیاز داره اینو بالا بردیم
        'print_trade_log': True,
        'leverage': 500.0, 
        'margin_limit_pct': 0.99,
        
        'assets': [
            # ====================================================================
            # 1. US30 - GAP4 (V7.3 Perfect Sync)
            # ====================================================================
            {
                'strategy_id': 'GAP4_on_US30', 
                'symbol': 'US30',
                'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/US30_M5F.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 10,
                'spread_divisor': 100.0,
                'commission_per_lot': 0.0,
                
                # مدیریت سرمایه ثابت بر اساس کد خودت
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.10)],
                'candle_type': 'STANDARD',
                
                # 👈 ✂️ فیلترهای زمانی از اینجا (لایه موتور) حذف شدند!
                
                # مغز استراتژی و تایرهای بهینه‌سازی شده
                'strategy': GAP4({        
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    
                    # ✅ فیلترهای زمانی دقیقاً به اینجا (مغز استراتژی) منتقل شدند:
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [                    
                        (time(0, 00), time(4, 00)), 
                        (time(11, 00), time(23, 55))
                    ],
                    
                    'SL_TIERS': [
                        {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 160, 'max': 200,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 200, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                }),
            },
            
            # ====================================================================
            # 2. XAUUSD (Gold) - GAP4 (V7.3 Perfect Sync)
            # ====================================================================
            {   
                'strategy_id': 'GAP4_on_XAUUSD', 
                'symbol': 'XAUUSD',
                'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/XAUUSD_M5F.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,
                'spread_divisor': 100.0,
                'commission_per_lot': 14.0,
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.10)],
                'candle_type': 'STANDARD',
                
                # 👈 ✂️ فیلترهای زمانی از اینجا (لایه موتور) حذف شدند!
                
                'strategy': GAP4({
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    
                    # ✅ فیلترهای زمانی دقیقاً به اینجا (مغز استراتژی) منتقل شدند:
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [
                        (time(1, 00), time(11, 00)),
                        (time(14, 00), time(23, 55))
                    ],
                    
                    'SL_TIERS': [
                        {'min': 0,    'max': 5,    'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 5,    'max': 10,   'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 10,   'max': 13.5, 'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 13.5, 'max': 16.0, 'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 16.0, 'max': 30.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 30.0, 'max': 40.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 40.0, 'max': 50.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 50.0, 'max': 60.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 60.0, 'max': 75.0, 'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 75.0, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                })      
            }
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        import traceback
        traceback.print_exc()

def run_multi_Backtest_Engine_Litefinance():
    print("--- 🚀 Launching Multi Portfolio Backtest (GAP4) --- LiteFinance Broker")

    multi_asset_config = {
        'initial_capital': 10000,
        # تاریخ استارت را روی 2020-01-01 گذاشتم تا اگر دیتای طلا زودتر شروع می‌شود، از دست نرود.
        # موتور به طور هوشمند دیتای YM را از زمان موجود بودنش (مثلاً 2023) وارد بازی می‌کند.
        'start_date': "2020-01-01",
        'lookback_period': 1000,  # مخصوص GAP4
        'print_trade_log': True,
        'leverage': 500.0, 
        'margin_limit_pct': 0.99,
        
        'assets': [
            # ====================================================================
            # 1. YM (Dow Jones) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'GAP4_on_YM_LF', 
                'symbol': 'YM',
                'csv_file_path': 'CSVs/YM_M51.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 10,
                'spread_divisor': 100.0,
                'commission_per_lot': 3.5,  # کمیسیون 3.5 برای YM در لایت فایننس
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)],
                'candle_type': 'STANDARD',
                
                'strategy': GAP4({        
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [                    
                        (time(0, 00), time(2, 00)),
                        (time(11, 00), time(14, 00)),
                        (time(16, 00), time(23, 55))
                    ],
                    
                    'SL_TIERS': [
                        {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 160, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                }),
            },
            
            # ====================================================================
            # 2. XAUUSD (Gold) - LiteFinance
            # ====================================================================
            {   
                'strategy_id': 'GAP4_on_XAUUSD_LF', 
                'symbol': 'XAUUSD_o',
                'csv_file_path': 'CSVs/XAUUSD_oo.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,
                'spread_divisor': 100.0,
                'commission_per_lot': 5.0,  # کمیسیون 5.0 برای طلا در لایت فایننس
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)],
                'candle_type': 'STANDARD',
                
                'strategy': GAP4({
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [
                        (time(2, 00), time(4, 00)),
                        (time(6, 00), time(12, 00)),
                        (time(13, 00), time(23, 55))
                    ],
                    
                    'SL_TIERS': [
                        {'min': 0,    'max': 5,    'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 5,    'max': 10,   'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 10,   'max': 13.5, 'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 13.5, 'max': 16.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 16.0, 'max': 30.0, 'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 30.0, 'max': 40.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 40.0, 'max': 50.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 50.0, 'max': 60.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 60.0, 'max': 75.0, 'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 75.0, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                })      
            }
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        import traceback
        traceback.print_exc()


def run_multi_Backtest_ALBROOKS_LF():
    print("--- 🚀 Launching Multi Portfolio Backtest (ALBROOKS SMC) ---")

    multi_asset_config = {
        'initial_capital': 1000,           # سرمایه اولیه طبق کانفیگ سینگل
        'start_date': "2020-01-01",
        'lookback_period': 300,            # لوک‌بک 300 (از کانفیگ سینگل شما)
        'print_trade_log': True,
        'leverage': 500.0, 
        'margin_limit_pct': 0.99,
        
        'assets': [
            # ====================================================================
            # 1. YM (Dow Jones) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'ALBROOKS_on_YM', 
                'symbol': 'YM',
                'csv_file_path': 'CSVs/YM_M51.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 1,               # کانتراکت 1 برای YM
                'spread_divisor': 100.0,
                'commission_per_lot': 3.5,
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
                'candle_type': 'STANDARD',
                
                # ⏰ فیلترهای زمانی مختص YM (حروف کوچک برای موتور مولتی)
                'allowed_days': [0, 1, 2, 3, 4],  
                'killzones': [
                    (time(3, 00), time(5, 00)),
                    (time(11, 00), time(23, 00))
                ],
                
                # 🧠 پارامترهای استراتژی مختص YM
                'strategy': SMCBrooksMonsterStrategy({
                    'RISK_REWARD_RATIO': 2.0,
                    'SL_PIPS': 1000.0,
                    'LIQ_LENGTH': 5,
                    'FVG_WINDOW': 3,
                    'BROOKS_STRENGTH': 0.60
                })
            },
            
            # ====================================================================
            # 2. XAUUSD_oo (Gold) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'ALBROOKS_on_XAUUSD', 
                'symbol': 'XAUUSD_oo',
                'csv_file_path': 'CSVs/XAUUSD_oo.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,             # کانتراکت 100 برای طلا
                'spread_divisor': 100.0,
                'commission_per_lot': 5.0,
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)], # حجم 0.01
                'candle_type': 'STANDARD',
                
                # ⏰ فیلترهای زمانی مختص طلا (روز سه‌شنبه یعنی 2 حذف شده است)
                'allowed_days': [0, 1, 3, 4],     
                'killzones': [
                    (time(4, 00), time(19, 00))
                ],
                
                # 🧠 پارامترهای استراتژی مختص طلا
                'strategy': SMCBrooksMonsterStrategy({
                    'RISK_REWARD_RATIO': 2.0,
                    'SL_PIPS': 120.0,
                    'LIQ_LENGTH': 3,
                    'FVG_WINDOW': 3,
                    'BROOKS_STRENGTH': 0.70
                })
            }
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        import traceback
        traceback.print_exc()

def run_multi_Backtest_Combined_LF():
    print("--- 🚀 Launching Ultimate Multi Portfolio Backtest (GAP4 + ALBROOKS) --- LiteFinance")

    multi_asset_config = {
        'initial_capital': 10000,          
        'start_date': "2020-01-01",
        'lookback_period': 1000,           
        'print_trade_log': True,
        'leverage': 500.0, 
        'margin_limit_pct': 0.99,
        
        'assets': [
            # ====================================================================
            # 1. GAP4 - YM (Dow Jones) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'GAP4_on_YM_LF', 
                'symbol': 'YM',
                'csv_file_path': 'CSVs/YM_M51.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 10,
                'spread_divisor': 100.0,
                'commission_per_lot': 3.5, 
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)],
                'candle_type': 'STANDARD',
                
                # 🚨 درهای موتور 24 ساعته باز است تا GAP4 کور نشود و مموری آپدیت بماند 🚨
                'allowed_days': [0, 1, 2, 3, 4, 5, 6],
                # 'killzones' حذف شد تا موتور هیچ کندلی را سانسور نکند!
                
                'strategy': GAP4({        
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    # GAP4 خودش در اینجا زمان را فیلتر می‌کند
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [                    
                        (time(0, 00), time(2, 00)),
                        (time(11, 00), time(14, 00)),
                        (time(16, 00), time(23, 55))
                    ],
                    'SL_TIERS': [
                        {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 160, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                }),
            },
            
            # ====================================================================
            # 2. GAP4 - XAUUSD (Gold) - LiteFinance
            # ====================================================================
            {   
                'strategy_id': 'GAP4_on_XAUUSD_LF', 
                'symbol': 'XAUUSD_oo',
                'csv_file_path': 'CSVs/XAUUSD_oo.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,
                'spread_divisor': 100.0,
                'commission_per_lot': 5.0, 
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)],
                'candle_type': 'STANDARD',
                
                # 🚨 درهای موتور 24 ساعته باز است 🚨
                'allowed_days': [0, 1, 2, 3, 4, 5, 6],

                'strategy': GAP4({
                    'FVG_COUNT': 4,
                    'MIN_LOOKBACK': 1000,
                    'ALLOWED_DAYS': [0, 1, 2, 3, 4],
                    'KILLZONES': [
                        (time(2, 00), time(4, 00)),
                        (time(6, 00), time(12, 00)),
                        (time(13, 00), time(23, 55))
                    ],
                    'SL_TIERS': [
                        {'min': 0,    'max': 5,    'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 5,    'max': 10,   'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 10,   'max': 13.5, 'action': 'real',   'rr': 1.0, 'reverse': True}, 
                        {'min': 13.5, 'max': 16.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 16.0, 'max': 30.0, 'action': 'real',   'rr': 1.0, 'reverse': False}, 
                        {'min': 30.0, 'max': 40.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 40.0, 'max': 50.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 50.0, 'max': 60.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
                        {'min': 60.0, 'max': 75.0, 'action': 'real',   'rr': 1.0, 'reverse': True},
                        {'min': 75.0, 'max': 9999, 'action': 'shadow', 'rr': 0},
                    ]
                })      
            },

            # ====================================================================
            # 3. ALBROOKS SMC - YM (Dow Jones) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'ALBROOKS_on_YM_LF', 
                'symbol': 'YM',
                'csv_file_path': 'CSVs/YM_M51.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 1,               
                'spread_divisor': 100.0,
                'commission_per_lot': 3.5,
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
                'candle_type': 'STANDARD',
                
                # ⏰ برای استراتژی کلاسیک، فیلترها روی لایه موتور تنظیم می‌شوند 
                'allowed_days': [0, 1, 2, 3, 4],  
                'killzones': [
                    (time(3, 00), time(5, 00)),
                    (time(11, 00), time(23, 00))
                ],
                
                'strategy': SMCBrooksMonsterStrategy({
                    'RISK_REWARD_RATIO': 2.0,
                    'SL_PIPS': 1000.0,
                    'LIQ_LENGTH': 5,
                    'FVG_WINDOW': 3,
                    'BROOKS_STRENGTH': 0.60
                })
            },
            
            # ====================================================================
            # 4. ALBROOKS SMC - XAUUSD_oo (Gold) - LiteFinance
            # ====================================================================
            {
                'strategy_id': 'ALBROOKS_on_XAUUSD_LF', 
                'symbol': 'XAUUSD_oo',
                'csv_file_path': 'CSVs/XAUUSD_oo.csv',
                'TIMEFRAME_SECONDS': 300,  
                'point_value': 1.0,
                'contract_size': 100,             
                'spread_divisor': 100.0,
                'commission_per_lot': 5.0,
                
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.01)], 
                'candle_type': 'STANDARD',
                
                # ⏰ برای طلا در البروکس
                'allowed_days': [0, 1, 3, 4],     
                'killzones': [
                    (time(4, 00), time(19, 00))
                ],
                
                'strategy': SMCBrooksMonsterStrategy({
                    'RISK_REWARD_RATIO': 2.0,
                    'SL_PIPS': 120.0,
                    'LIQ_LENGTH': 3,
                    'FVG_WINDOW': 3,
                    'BROOKS_STRENGTH': 0.70
                })
            }
        ]
    }
    
    try:
        backtester = Multi_Backtester(multi_asset_config)
        backtester.run()
        backtester.report()
    except Exception as e:
        print(f"\n❌ Execution Error: {e}")
        import traceback
        traceback.print_exc()    
# ==============================================================================
# SINGLE ASSET RUNNERS
# ==============================================================================

def run_kc_backtest_US30():
    print("--- Setting up Squeeze Breakout (KC) Strategy Backtest ---")
    general_config = {
        'initial_capital': 25000,
        'csv_file_path': 'CSVs/US30_M5F2.csv',
        'TIMEFRAME_SECONDS': 300,
        'LOOKBACK_PERIOD': 500,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 10,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2020-01-01",
        
        # برای انجین تکی v3 هم از همین کلاس ریسک استفاده می‌کنیم
        'MONEY_MANAGEMENT_MODE': [  FixedRiskAmountRule(risk_amount_dollar=80.0)
        ],  

        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0 ,1 ,2, 3, 4], 
        'KILLZONES': [
                    (time(3, 00), time(4, 00)),
                    (time(17, 00), time(18, 00)),
                    (time(19, 00), time(21, 00)),
                    (time(22, 00), time(23, 00))
                    # (time(3, 00), time(23, 00))
        ]
    }
    
    kc_strategy_params = { 
        'BB_PERIOD': 21, 'BB_STD': 1.9, 'KC_PERIOD': 23, 'KC_ATR_MULT': 2.0, 
        'EMA_PERIOD': 55, 'ATR_PERIOD': 16, 'SL_ATR_MULT': 2.0, 'RISK_REWARD_RATIO': 2.0 
    }
    
    try:
        # فراخوانی Backtester از فایل backtester_v3.py
        strategy_to_test = SqueezeBreakoutStrategy(kc_strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_kc_backtest_XAUUSD():
    print("--- Setting up Squeeze Breakout (KC) Strategy Backtest ---")
    general_config = {
        'initial_capital': 50000,
        'csv_file_path': 'CSVs/XAUUSD_M5_ALPARI.csv',
        'TIMEFRAME_SECONDS': 300,
        'LOOKBACK_PERIOD':300 , 
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 100,
        'COMMISSION_PER_LOT': 14.0,
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [ FixedRiskAmountRule(risk_amount_dollar=100.0) ,
                                #   StepBreakevenHandler(steps=[(3.5 , 0.5)], buffer_pips=2.0),
                                  PartialCloseRule(target_rr=3.3, close_percentage=0.5)
                                  

        ],
        'CANDLE_TYPE': 'STANDARD', # 'HEIKIN_ASHI' or 'STANDARD'
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0 ,1 , 3, 4], # 2 pak beshe 
        'KILLZONES': [
                    # (time(3, 00), time(7, 00)),
                    # (time(8, 00), time(18, 00)),
                    # (time(20, 00), time(21, 00))
                    (time(3, 00), time(7, 00)),
                    (time(9, 00), time(19, 00)),
                    (time(20, 00), time(22, 00)),
                    # (time(3, 00), time(23, 00))
        ]
    }
    
    
    strategy_params = {'BB_PERIOD': 36, 
                          'BB_STD': 2.4, 
                          'KC_PERIOD': 22, #23
                          'KC_ATR_MULT': 1.9, #2.0
                          'EMA_PERIOD': 45, #55 ,36
                          'ATR_PERIOD': 15, #31
                          'SL_ATR_MULT': 2.1, #2.0
                          'RISK_REWARD_RATIO': 5.1, }
    try:
        strategy_to_test = SqueezeBreakoutStrategy(strategy_params); backtester = Backtester(general_config)
        backtester.load_data(); backtester.run(strategy_to_test); backtester.report()
    except (ValueError, IOError, LookaheadBiasError) as e: print(f"\n❌ A configuration or data error occurred: {e}")
    except Exception as e: print(f"\n❌ An unexpected error occurred: {e}")

def run_adx_backtest():
    print("--- Setting up ADX Mean Reversion Strategy Backtest ---")
    general_config = { 
        'initial_capital': 50000, 
        'csv_file_path': 'CSVs/EURUSD_M30.csv', 
        'TIMEFRAME_SECONDS': 1800,
        'LOOKBACK_PERIOD': 500, 
        'SPREAD_DIVISOR': 100000.0, 
        'point_value': 1.0, 
        'contract_size': 100000, 
        'COMMISSION_PER_LOT': 3.0, 
        'START_DATE': "2023-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=100.0)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        'ALLOWED_DAYS': [0, 1, 2, 3, 4], 
        'KILLZONES': [(time(3, 00), time(23, 00))] 
    }
    
    adx_strategy_params = { 
        'BB_PERIOD': 13, 'BB_STD_DEV': 2.6, 'ADX_PERIOD': 70, 'ADX_THRESHOLD': 30, 
        'ATR_PERIOD': 60, 'ATR_MULTIPLIER': 0.7, 'RISK_REWARD_RATIO': 40.0 
    }
    
    try:
        strategy_to_test = ADXStrategy(adx_strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_ds_backtest():
    print("--- Setting up Supply & Demand (DS) Strategy Backtest ---")
    general_config = { 
        'initial_capital': 50000, 
        'csv_file_path': 'CSVs/US30_M5.csv', 
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 200, 
        'SPREAD_DIVISOR': 100.0, 
        'point_value': 1.0, 
        'contract_size': 1, 
        'COMMISSION_PER_LOT': 2.0, 
        'START_DATE': "2023-01-01", 
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=100.0)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        'ALLOWED_DAYS': [0, 1, 2, 3, 4], 
        'KILLZONES': [(time(3, 00), time(23, 00))]
    }
    
    sd_strategy_params = {
        'ZONE_AVG_BODY_PERIOD': 20, 'ZONE_STRENGTH_MULT': 1.6, 
        'TREND_EMA_PERIOD': 55, 'SL_ATR_PADDING': 0.9, 
        'ATR_PERIOD': 23, 'RISK_REWARD_RATIO': 2.0
    }
    
    try:
        strategy_to_test = SupplyDemandStrategy(sd_strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_MACD_RSI_backtest():

    print("--- Setting up MACD_RSI Strategy Backtest ---")
    
    general_config = { 
        'initial_capital': 10000,           # سرمایه اولیه (مثلاً ۱۰ هزار دلار)
        'csv_file_path': 'CSVs/US30_M5A_MERGER.csv', # ⚠️ مسیر فایل CSV خود را اینجا بگذارید
        'TIMEFRAME_SECONDS': 300,           # تایم‌فریم (۳۰۰ ثانیه = ۵ دقیقه)
        'LOOKBACK_PERIOD': 300,             # تعداد کندل مورد نیاز برای شروع
        'SPREAD_DIVISOR': 1.0,              # تقسیم‌کننده اسپرد (معمولاً ۱ یا ۱۰)
        'point_value': 1.0,                 # ارزش هر پوینت
        'contract_size': 1,                 # سایز قرارداد (برای طلا معمولاً ۱۰۰ یا ۱ است)
        'COMMISSION_PER_LOT': 3.0,          # کمیسیون به ازای هر لات
        'START_DATE': "2023-01-01",         # تاریخ شروع بک‌تست
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)], # ریسک ۲ درصد در هر معامله
        'CANDLE_TYPE': 'STANDARD',          # نوع کندل
        'PRINT_TRADE_LOG': True,            # نمایش لاگ معاملات
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],    # روزهای مجاز ترید (دوشنبه تا جمعه)
        'KILLZONES': [(time(3, 00), time(23, 00))] 
    }
    

    strategy_params = {
        # تنظیمات RSI
        'RSI_PERIOD': 14,
        'RSI_OVERSOLD': 30,      # حد اشباع فروش (برای ورود)
        'RSI_OVERBOUGHT': 70,    # حد اشباع خرید (برای خروج اضطراری)
        'RSI_LOOKBACK': 5,       # نگاه به ۵ کندل قبل (طبق استراتژی اصلی)
        
        # تنظیمات MACD
        'MACD_FAST': 12,
        'MACD_SLOW': 26,
        'MACD_SIGNAL': 9,
        
        # تنظیمات ATR برای استاپ لاس و تیک پروفیت
        'SL_ATR_MULT': 2,      # استاپ لاس = 1.5 برابر ATR
        'TP_ATR_MULT': 2      # تیک پروفیت = 2.0 برابر ATR
    }
    
    try:
        # 3. ساخت نمونه استراتژی
        strategy_to_test = MACD_RSI_Strategy(strategy_params)
        
        # 4. راه‌اندازی انجین بک‌تست
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()   
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
# ____________________________________________________________________________
def run_us30_inside_bar_backtest():
    print("--- Setting up US30 Inside Bar Strategy Backtest ---")
    
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'CSVs/US30_M5F.csv',  # مسیر فایل دیتای خودت را چک کن
        'TIMEFRAME_SECONDS': 300,
        'LOOKBACK_PERIOD': 50,  
        
        # 🔴 اصلاح مهم: برای رفع ضررهای الکی ناشی از اسپرد در US30
        'SPREAD_DIVISOR': 100.0, 
        
        'point_value': 1.0,
        'contract_size': 10, # سایز قرارداد داوجونز معمولا 1 یا 10 است
        'COMMISSION_PER_LOT': 0.0, 
        'START_DATE': "2023-01-01",
        
        # ربات خودش استاپ داینامیک دارد، ما فقط به او می‌گوییم روی هر استاپ چقدر پول ریسک کند
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)],
        
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        
        # 🔴 فیلتر سشن نیویورک (بر اساس ساعت استاندارد): 
        # از ساعت 9:30 صبح تا 16:00 عصر به وقت نیویورک
        # حتماً این اعداد را با تایم‌زون بروکر خودت مچ کن!
        'KILLZONES': [
            (time(3, 00), time(23, 00))
        ]
    }
    
    strategy_params = {
        'RISK_REWARD_RATIO': 4.0,
        'ATR_PERIOD': 48,
        'SL_BUFFER_MULT': 0.5
    }
    
    try:
        strategy_to_test = US30_InsideBar_Strategy(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

def run_us30_liquidity_sweep():
    print("--- Setting up US30 Liquidity Sweep Strategy Backtest ---")
    
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'CSVs/US30_M5F.csv',  
        'TIMEFRAME_SECONDS': 300,
        'LOOKBACK_PERIOD': 50,  
        'SPREAD_DIVISOR': 100.0, 
        'point_value': 1.0,
        'contract_size': 10, 
        'COMMISSION_PER_LOT': 0.0, 
        'START_DATE': "2023-01-01",
        
        # ریسک 50 دلاری در هر معامله
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)],
        
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [(time(3, 00), time(23, 00))] # یا محدود به نیویورک
    }
    
    # تنظیمات استراتژی (استاپ پیپی اینجا تنظیم می‌شود)
    strategy_params = {
        'LOOKBACK': 20,              
        'WICK_MULTIPLIER': 3.0,      
        'SL_PIPS': 100.0,        # 🔴 استاپ ثابت روی 100 پوینت داوجونز
        'PIP_SCALE': 1.0,            
        'RISK_REWARD_RATIO': 2.0 # ریوارد دو برابر ضرر
    }
    
    try:
        strategy_to_test = US30_Liquidity_Sweep_Strategy(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()


def run_GAP4_backtest():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/YM_M51.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 500, 
        
        'SPREAD_DIVISOR': 100.0,               
        'point_value': 1.0, 
        'contract_size': 10, 
        
        'COMMISSION_PER_LOT': 3.5, 
        'START_DATE': "2023-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(00, 00), time(3, 00)), 
            # (time(9, 00), time(23, 59)),
            
            #Litefinanc time
                (time(0, 00), time(2, 00)),
                (time(11, 00), time(14, 00)),
                (time(16, 00), time(23, 55))
            
            # 👈 الان با خیال راحت هر ساعتی که دوست داری را اینجا تست کن
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 160, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()
        
def run_GAP4_XAUUSD_LF():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/XAUUSD_oo.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        'SPREAD_DIVISOR': 100.0,               
        'point_value': 1.0, 
        'contract_size': 100, 
        
        'COMMISSION_PER_LOT': 5.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(00, 00), time(3, 00)), 
            # (time(9, 00), time(23, 59)),
            
            #Litefinanc time
                # (time(0, 00), time(2, 00)),
                # (time(11, 00), time(14, 00)),
                # (time(16, 00), time(23, 55))
                (time(2, 00), time(4, 00)),
                (time(6, 00), time(12, 00)),
                (time(13, 00), time(23, 55))
            
            # 👈 الان با خیال راحت هر ساعتی که دوست داری را اینجا تست کن
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            {'min': 0,   'max': 5,   'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 5,  'max': 10,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 10, 'max': 13.5,  'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 13.5, 'max': 16.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 16.0, 'max': 30.0,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 30.0, 'max': 40.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 40.0, 'max': 50.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 50.0, 'max': 60.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 60.0, 'max': 75.0,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 75.0, 'max': 9999, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_GAP4_XAUUSD_FUNDED():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/XAUUSD_M5F_BASE.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        'SPREAD_DIVISOR': 100.0,               
        'point_value': 1.0, 
        'contract_size': 100, 
        
        'COMMISSION_PER_LOT': 0.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(0, 00), time(8, 00)),
            # (time(9, 00), time(12, 00)),
            # (time(15, 00), time(21, 00)),
            # (time(22, 00), time(23, 55)),
            
            #-- TEST TIME --
            (time(1, 00), time(11, 00)),
            (time(14, 00), time(23, 55)),
            
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            # {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': False},
            # {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': True},
            # {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': True}, 
            # {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': True},
            # {'min': 160, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': True},
            # {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': False},
            # {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': True},
            # {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
            
            #-- TEST PIPs --
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            {'min': 0,   'max': 5,   'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 5,  'max': 10,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 10, 'max': 13.5,  'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 13.5, 'max': 16.0,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 16.0, 'max': 30.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 30.0, 'max': 40.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 40.0, 'max': 50.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 50.0, 'max': 60.0,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 60.0, 'max': 75.0,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 75.0, 'max': 9999, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()    

def run_GAP4_WTI_FUNDED():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/USOUSD_M5F.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        'SPREAD_DIVISOR': 1000.0,               
        'point_value': 1.0, 
        'contract_size': 100, 
        
        'COMMISSION_PER_LOT': 5.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=1.0)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(00, 00), time(3, 00)), 
            (time(00, 00), time(23, 55)),
            
            #Litefinanc time
                # (time(0, 00), time(2, 00)),
                # (time(11, 00), time(14, 00)),
                # (time(16, 00), time(23, 55))
            
            # 👈 الان با خیال راحت هر ساعتی که دوست داری را اینجا تست کن
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            {'min': 0.0,   'max': 0.50,   'action': 'shadow', 'rr': 0},
            {'min': 0.50, 'max': 1.0, 'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 1.00, 'max': 1.35, 'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 1.35, 'max': 1.60, 'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 1.60, 'max': 2.00, 'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 2.00, 'max': 3.00, 'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 3.00, 'max': 4.0, 'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 4.0, 'max': 99.9, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_GAP4_US30_FUNDED():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/US30_M5FF.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        'SPREAD_DIVISOR': 100.0,               
        'point_value': 1.0, 
        'contract_size': 10, 
        
        'COMMISSION_PER_LOT': 0.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(00, 00), time(3, 00)), 
            # (time(9, 00), time(23, 59)),
            
            (time(00, 00), time(4, 00)), 
            (time(11, 00), time(23, 55))
            
            
            #Litefinanc time
                # (time(0, 00), time(2, 00)),
                # (time(11, 00), time(14, 00)),
                # (time(16, 00), time(23, 55))
            
            # 👈 الان با خیال راحت هر ساعتی که دوست داری را اینجا تست کن
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': False}, 
            {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 160, 'max': 200,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 200, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_smc_brooks_backtest():
    print("--- 🚀 Setting up SMC + Al Brooks Strategy Backtest ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی بک‌تست
    # ==========================================
    general_config = {
        'initial_capital': 10000,
        
        # ⚠️ مسیر فایل دیتای خود را دقیق مشخص کنید (مثلاً US30 یا XAUUSD)
        'csv_file_path': 'CSVs/US30_M5F2.csv',  
        'TIMEFRAME_SECONDS': 300,  # 5 دقیقه
        
        # 🚨 بسیار مهم: چون EMA 200 داریم، حداقل باید 200 الی 300 کندل لک‌بک داشته باشیم
        'LOOKBACK_PERIOD': 300,  
        
        'SPREAD_DIVISOR': 100.0, 
        'point_value': 1.0,
        'contract_size': 10,       # سایز قرارداد داوجونز (برای طلا 100 بگذارید)
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2023-01-01",
        
        # ریسک ثابت 50 دلار در هر معامله
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)],
        
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4], # دوشنبه تا جمعه
        
        # فیلتر سشن (مثلاً سشن نیویورک یا کل روز)
        'KILLZONES': [
            (time(3, 00), time(23, 00))
        ]
    }
    
    # ==========================================
    # 2. پارامترهای استراتژی SMC + Brooks
    # ==========================================
    strategy_params = {
        'LIQ_LENGTH': 10,            
        'FVG_WINDOW': 2,             
        'BROOKS_STRENGTH': 0.55,     
        'MIN_RR_RATIO': 0.10,         
        'ATR_PERIOD': 100,            
        'EMA_PERIOD': 200,
        'MAX_RISK_ATR_MULT': 3.0     
    }
    
    try:
        # فراخوانی استراتژی جدید
        strategy_to_test = SMCBrooksStrategy(strategy_params)
        
        # اجرای موتور بک‌تست
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

def run_GAP4_NDX_FUNDED():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/NDX100_M5.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        'SPREAD_DIVISOR': 100.0,               
        'point_value': 1.0, 
        'contract_size': 10, 
        
        'COMMISSION_PER_LOT': 0.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
        
        # ✂️ فیلترهای زمانی از اینجا کاملاً حذف شدند تا ربات کور نشود!
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        # الان ربات 24 ساعته دیتا را ردیابی می‌کند، اما فقط در این زمان‌ها معامله واقعی می‌گیرد.
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
            #Fundedtime
            # (time(00, 00), time(3, 00)), 
            # (time(9, 00), time(23, 59)),
            
            # (time(00, 00), time(4, 00)), 
            # (time(11, 00), time(23, 55))
            
            
            #Litefinanc time
                # (time(0, 00), time(5, 00)),
                # (time(8, 00), time(23, 55)),
                # (time(0, 00), time(20, 00)),
                (time(0, 00), time(23, 55))
            
            # 👈 الان با خیال راحت هر ساعتی که دوست داری را اینجا تست کن
        ],
        
        # 🧠 بازه‌های هوشمندی که خودت بهینه‌سازی (optimize) کردی:
        'SL_TIERS': [
            # {'min': 0,   'max': 50,   'action': 'shadow', 'rr': 0},
            {'min': 0,   'max': 50,   'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 50,  'max': 100,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 100, 'max': 135,  'action': 'real',   'rr': 1.0, 'reverse': True}, 
            {'min': 135, 'max': 160,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 160, 'max': 200,  'action': 'real',   'rr': 1.0, 'reverse': True},
            {'min': 200, 'max': 300,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 300, 'max': 400,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 400, 'max': 450,  'action': 'real',   'rr': 1.0, 'reverse': False},
            {'min': 450, 'max': 9999, 'action': 'shadow', 'rr': 0},
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()
        
def run_GAP4_EURUSD_FUNDED():
    print("--- 🚀 Setting up GAP4 Strategy Backtest (V7.3 - Perfect Sync) ---")
    
    # ==========================================
    # 1. تنظیمات موتور اصلی (بدون محدودیت زمانی)
    # ==========================================
    general_config = { 
        'initial_capital': 10000, 
        'csv_file_path': 'CSVs/EURUSD_M5FF.csv',  
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 1000, 
        
        # 🚨 این خط حیاتی برای جفت‌ارزهای 5 رقمی باید اضافه شود 🚨
        'tick_size': 0.00001,

        'SPREAD_DIVISOR': 100000.0,               
        'point_value': 1.0, 
        'contract_size': 100000, 
        
        'COMMISSION_PER_LOT': 5.0, 
        'START_DATE': "2020-01-01",
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size=0.1)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True, 
    }
    
    # ==========================================
    # 2. تنظیمات مغز استراتژی (GAP4 Engine)
    # ==========================================
    strategy_params = {
        'FVG_COUNT': 4,
        'MIN_LOOKBACK': 1000,
        
        # ✅ فیلترهای زمانی به اینجا منتقل شدند:
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],       
        'KILLZONES': [
                #Litefinance time (EURUSD Session)
                (time(0, 00), time(23, 55))
        ],
        
        # 🧠 بازه‌های هوشمندی (SL_TIERS)
        # 🚨 اصلاح مهم 3: مقیاس اعداد برای جفت ارز 5 رقمی (مثلاً 0.00100 یعنی 10 پیپ)
        'SL_TIERS': [
            {'min': 0.00000, 'max': 0.00050, 'action': 'real',   'rr': 1.0, 'reverse': True},   # 0 تا 5 پیپ
            {'min': 0.00050, 'max': 0.00100, 'action': 'real',   'rr': 1.0, 'reverse': True},  # 5 تا 10 پیپ
            {'min': 0.00100, 'max': 0.00135, 'action': 'real',   'rr': 1.0, 'reverse': True},   # 10 تا 13.5 پیپ
            {'min': 0.00135, 'max': 0.00160, 'action': 'real',   'rr': 1.0, 'reverse': True},  # 13.5 تا 16 پیپ
            {'min': 0.00160, 'max': 0.00200, 'action': 'real',   'rr': 1.0, 'reverse': False},   # 16 تا 20 پیپ
            {'min': 0.00200, 'max': 0.00300, 'action': 'real',   'rr': 1.0, 'reverse': True},  # 20 تا 30 پیپ
            {'min': 0.00300, 'max': 0.00400, 'action': 'real',   'rr': 1.0, 'reverse': True},  # 30 تا 40 پیپ
            {'min': 0.00400, 'max': 0.01000, 'action': 'real',   'rr': 1.0, 'reverse': True},  # 40 تا 45 پیپ
            {'min': 0.01000, 'max': 9.99999, 'action': 'shadow', 'rr': 0},                      # بیشتر از 45 پیپ
        ]
    }
    
    try:
        strategy_to_test = GAP4(strategy_params)
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        traceback.print_exc()

def run_pure_pa_5min_backtest():
    print("--- Setting up Pure Price Action 5Min Strategy Backtest ---")
    
    # تنظیمات کلی انجین بک‌تست
    general_config = {
        'initial_capital': 10000,
        # ⚠️ مسیر فایل دیتای ۵ دقیقه خود را اینجا قرار بده (مثلاً EURUSD یا US30)
        'csv_file_path': 'CSVs/US30_M5F2.csv',  
        'TIMEFRAME_SECONDS': 300,
        
        # چون فقط پرایس اکشن است و اندیکاتورهای بلندمدت نداریم، نیازی به لک‌بک بالا نیست
        'LOOKBACK_PERIOD': 50,  
        
        'SPREAD_DIVISOR': 100.0, 
        'point_value': 1.0,
        'contract_size': 10, # سایز قرارداد (برای جفت ارزها معمولا 100,000، برای طلا 100، برای شاخص 1 یا 10)
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2023-01-01",
        
        # مدیریت سرمایه (مثلاً ریسک 50 دلار در هر معامله)
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)],
        
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4], # دوشنبه تا جمعه
        'KILLZONES': [
            # (time(3, 00), time(23, 00))
            # (time(3, 00), time(5 , 00)),
            # (time(9, 00), time(16, 00)),
            # (time(17, 00), time(18, 00)),
            # (time(22, 00), time(23, 00)),
            
            # فعلاً کل روز فعال است، می‌توانی به سشن لندن/نیویورک محدودش کنی
        ]
    }
    
    # پارامترهای اختصاصی استراتژی پرایس اکشن
    pa_strategy_params = {
        'TREND_LOOKBACK': 6,             # بررسی روند در نیم ساعت گذشته (۶ کندل)
        'RISK_REWARD_RATIO': 1.0,        # ریسک به ریوارد ۱ به ۲
        'SL_PIPS': 200.0,                 # حد ضرر به پیپ
        
        # ⚠️ بسیار مهم: مقیاس پیپ را بر اساس نمادی که تست می‌کنی تنظیم کن:
        # جفت ارزهای اصلی (مثل EURUSD): 0.0001
        # جفت ارزهای یِن ژاپن (مثل USDJPY): 0.01
        # طلا (XAUUSD): 0.1
        # شاخص‌ها (مثل US30): 1.0 
        'PIP_SCALE': 1.0,             
        
        'MIN_REJECTION_WICK': 1.0,       # تاییدیه بازگشت: سایه موافق حداقل برابر با بدنه باشد
        'MAX_OPPOSITE_WICK': 0.5         # حداکثر طول سایه مخالف: نصف بدنه
    }
    
    try:
        # ساخت نمونه استراتژی و پاس دادن پارامترها
        strategy_to_test = Pure_PriceAction_5Min_Strategy(pa_strategy_params)
        
        # راه‌اندازی انجین
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

def run_sp2l_backtest():
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/XAUUSD_M1F.csv',
        'TIMEFRAME_SECONDS': 60,
        'LOOKBACK_PERIOD': 100,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 100,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2024-01-01",
        'tick_size': 0.01,
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar=50.0)],
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [
            (time(3, 0), time(23, 0))
        ]
    }
    
    sp2l_params = {
    'RR_RATIO': 1.0,            # ریسک به ریوارد 
    'USE_SL_THRESHOLD': True,   # یه پیپ خاصی از استاپ فاصله بگیره برای اسپرد چون اسکلپه 
    'MIN_SL_DISTANCE': 0.0,    # چقدر از استاپ فاصله بگیره (پیپ) - برای اسپرد
    'DOJI_BODY_RATIO': 0.30,    # حساسیت دوجی را پایین یا بالا ببرید
    'MAX_DOJI_IN_SPIKE': 0.0,   # 🚨 اسپایکِ واقعی اصلاً نباید دوجی داشته باشد! (صفر درصد)
    'USE_TREND_FILTER': True,
    'TREND_LOOKBACK': 30,       # روند 30 کندل گذشته را چک کند تا در رنج‌ها وارد نشود
    'MAX_DOJI_IN_TREND': 0.35   # اگر بازار کثیف بود معامله نکند
    }
    
    try:
        strategy_to_test = SP2L_Strategy(sp2l_params)
        
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        import traceback
        traceback.print_exc()

def run_SuperTrend_backtest():
    print("--- Setting up SuperTrend Strategy Backtest ---")
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/XAUUSD_M3F.csv',
        'TIMEFRAME_SECONDS': 60,
        'LOOKBACK_PERIOD': 100,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 100,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2024-01-01",
        'tick_size': 0.01,
        'MONEY_MANAGEMENT_MODE': [FixedLotRule(lot_size= 0.1)],
        'CANDLE_TYPE': 'HEIKIN_ASHI',# HEIKIN_ASHI
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [
            (time(3, 0), time(23, 0))
        ]
    }
    st_params = {
        'ATR_PERIOD': 10,
        'ATR_MULTIPLIER': 3.0
    }
    try:
        strategy_to_test = SuperTrend_Strategy(st_params)
        
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        import traceback
        traceback.print_exc()

def run_HalfLeg_backtest():
    print("--- Setting up HalfLeg Strategy Backtest ---")
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/US30_M5_WAR.csv',
        'TIMEFRAME_SECONDS': 300, #5m
        'LOOKBACK_PERIOD': 100,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 1,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2024-01-01",
        'tick_size': 0.01,
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar= 100.0)],
        'CANDLE_TYPE': 'STANDARD',# HEIKIN_ASHI
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [
            (time(3, 0), time(23, 0))
        ]
    }
    params = {

        'deviation_pct': 0.3,
        'atr_len': 14,
        'atr_mult': 3.0,          # The optimized ATR multiplier you discovered!
        'rr_ratio': 3.0,          # Your optimal risk to reward!
        'use_trend_filter': False, # Or False, depending on test phase
        'skip_after_trade': True  # Cooldown activated
    }
    try:
        strategy_to_test = HalfLegStrategy(params)
        
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        import traceback
        traceback.print_exc()


def run_HalfLeg_SMC_backtest():
    print("--- Setting up HalfLeg SMC Strategy Backtest ---")
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/XAUUSD._M30O.csv',
        'TIMEFRAME_SECONDS': 1800, #30m
        'LOOKBACK_PERIOD': 100,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 1,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2024-01-01",
        'tick_size': 0.01,
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar= 100.0)],
        'CANDLE_TYPE': 'STANDARD',# HEIKIN_ASHI
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [
            (time(3, 0), time(23, 0))
        ]
    }
    params = {

    'deviation_pct': 1.0,
    'atr_len': 14,
    'atr_mult': 1.5,          
    'rr_ratio': 3.0,          
    'use_smc_filter': True,   
    'skip_after_trade': False,
    'immediate_entry': True   # برای ورود تهاجمی (بدون منتظر ماندن برای پولبک) این را True کنید!
    }
    try:
        strategy_to_test = HalfLegSMCC(params)
        
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        import traceback
        traceback.print_exc()

def run_Liquidity_Sweep_pro_backtest():
    print("--- Setting up Liquidity_Sweep_pro  Strategy Backtest ---")
    general_config = {
        'initial_capital': 10000,
        'csv_file_path': 'Backtest_ENGINE V3.9/CSVs/US30_M5_WAR.csv',
        'TIMEFRAME_SECONDS': 300, 
        'LOOKBACK_PERIOD': 100,
        'SPREAD_DIVISOR': 100.0,
        'point_value': 1.0,
        'contract_size': 1,
        'COMMISSION_PER_LOT': 0.0,
        'START_DATE': "2020-01-01",
        'tick_size': 0.01,
        'MONEY_MANAGEMENT_MODE': [FixedRiskAmountRule(risk_amount_dollar= 100.0)],
        'CANDLE_TYPE': 'STANDARD',# HEIKIN_ASHI
        'PRINT_TRADE_LOG': True,
        'ALLOWED_DAYS': [0, 1, 2, 3, 4],
        'KILLZONES': [
            (time(3, 0), time(23, 0))
        ]
    }
    params = {

        'USE_HULL_FILTER': False,
        'ATR_LENGTH': 25,
        'PIVOT_LENGTH': 10,
        'RISK_REWARD': 2.0,
        'STOP_ATR_MULTIPLIER': 1.0,
        'HULL_LENGTH': 120
    }
    try:
        strategy_to_test = Liquidity_Sweep_pro(params)
        
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()
        
    except Exception as e:
        import traceback
        traceback.print_exc()

# ==============================================================================
# Market Scaner ASSET RUNNERS
# ==============================================================================

def run_MACD_MarketScan():
    print("--- 🚀 Initializing MACD Strategy Scanner ---")
    

    strategy_params = {
        'RSI_PERIOD': 14,
        'RSI_OVERSOLD': 30,
        'RSI_OVERBOUGHT': 70,
        'RSI_LOOKBACK': 5,
        
        'MACD_FAST': 12,
        'MACD_SLOW': 26,
        'MACD_SIGNAL': 9,
        

        'SL_ATR_MULT': 4.0, 
        'TP_ATR_MULT': 4.0  
    }

    base_config = {
        'initial_capital': 1000,       # سرمایه اولیه برای هر تست
        'csv_file_path': None,         # این را خالی بگذارید (اسکنر خودکار پر می‌کند)
        'TIMEFRAME_SECONDS': 0,        # این هم خودکار پر می‌شود
        'LOOKBACK_PERIOD': 300,        # تعداد کندل مورد نیاز برای محاسبه اولیه اندیکاتورها
        'SPREAD_DIVISOR': 1.0,         # تقسیم اسپرد (معمولاً 1)
        'point_value': 1.0,            # ارزش پوینت (پیش‌فرض 1، انجین محاسبات دقیق را انجام می‌دهد)
        'contract_size': 1,            # سایز قرارداد (پیش‌فرض 1)
        'COMMISSION_PER_LOT': 3.0,     # کمیسیون فرضی (برای واقعی‌تر شدن نتایج)
        'START_DATE': "2023-01-01",    # تاریخ شروع بک‌تست
        'MONEY_MANAGEMENT_MODE': [PercentRiskRule(risk_percent=2.0)], # ریسک 2 درصد
        'CANDLE_TYPE': 'STANDARD',
        'PRINT_TRADE_LOG': False,      # برای سرعت بیشتر در اسکن خاموش باشد
        'ALLOWED_DAYS': [0, 1, 2, 3, 4], # دوشنبه تا جمعه
        # 'tick_size': 0.01            # (اختیاری)
    }

    # 3. تنظیمات اسکن (Scan Config)
    # اینجا مشخص می‌کنید چه نمادهایی و در چه تایم‌فریمی اسکن شوند
    scan_config = {
        # کلمات کلیدی برای پیدا کردن نمادها در متاتریدر
        # مثال: ['Forex', 'XAU'] یا ['Crypto'] یا ['Major']
        # این کلمات باید در مسیر (Path) نماد در متاتریدر باشند.
        'TARGET_GROUPS': ['Forex', 'Metals', 'Major'], 
        
        # تایم‌فریم مورد نظر برای اسکن (حتما از ثابت‌های mt5 استفاده کنید)
        'TARGET_TIMEFRAME': mt5.TIMEFRAME_H1, 
        
        # از چه تاریخی دیتا دانلود شود؟
        'START_DATE': "2023-01-01"
    }

    try:
        # ساخت نمونه اسکنر
        # توجه: کلاس MACD_RSI_Strategy را که قبلا ساختیم اینجا پاس می‌دهیم
        scanner = MT5MarketScanner(
            strategy_class=MACD_RSI_Strategy, 
            strategy_params=strategy_params, 
            base_config=base_config
        )
        
        # اجرای اسکن
        scanner.run_scan(scan_config)
        
    except Exception as e:
        print(f"\n❌ Scanner Error: {e}")
        import traceback
        traceback.print_exc()

def run_ALBROOKS_SMC_YM():

    print("--- Setting up ALBROOKS_SMC Strategy Backtest ---")
    
    general_config = { 
        'initial_capital': 1000,          
        'csv_file_path': 'CSVs/YM_M51.csv', 
        'TIMEFRAME_SECONDS': 300,           # 60 == 1m
        'LOOKBACK_PERIOD': 300,  
        'SPREAD_DIVISOR': 100,
        'point_value': 1.0,        
        'contract_size': 1,               
        'COMMISSION_PER_LOT': 3.5,      
        'START_DATE': "2020-01-01",         
        'MONEY_MANAGEMENT_MODE': 
        [FixedLotRule(lot_size=0.1),
        #  PartialCloseRule(target_rr=1.0, close_volume=0.1,)
         ], 
        'CANDLE_TYPE': 'STANDARD', # HEA    
        'PRINT_TRADE_LOG': True,    # False        
        'ALLOWED_DAYS': [0,1,2,3,4],    
        'KILLZONES': [
            (time(3, 00), time(5, 00)),
            (time(11, 00), time(23, 00)),
           
            #FOR TEST 
            # (time(1, 00), time(2, 00)),
            # (time(3, 00), time(5, 00)),
            # (time(12, 00), time(23, 00)),
            ] 
    }
    

    strategy_params = {

            'RISK_REWARD_RATIO': 2.0,     # نسبت ریوارد به ریسک ثابت
            'SL_PIPS': 1000.0,             # مقدار استاپ لاس به پیپ
            'LIQ_LENGTH': 5,             # طول دوره نقدینگی
            'FVG_WINDOW': 3,              # حداکثر فاصله مجاز کندل سیگنال تا FVG
            'BROOKS_STRENGTH': 0.60     # قدرت کندل بازگشتی (70 درصد بدنه پر)
    }
    
    try:
        # 3. ساخت نمونه استراتژی
        strategy_to_test = SMCBrooksMonsterStrategy(strategy_params)
        
        # 4. راه‌اندازی انجین بک‌تست
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()   
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()

def run_ALBROOKS_SMC_XAU_LF():

    print("--- Setting up ALBROOKS_SMC Strategy Backtest ---")
    
    general_config = { 
        'initial_capital': 1000,          
        'csv_file_path': 'CSVs/XAUUSD_oo.csv', 
        'TIMEFRAME_SECONDS': 300,           # 60 == 1m
        'LOOKBACK_PERIOD': 300,  
        'SPREAD_DIVISOR': 100,
        'point_value': 1.0,        
        'contract_size': 100,               
        'COMMISSION_PER_LOT': 5.0,      
        'START_DATE': "2020-01-01",         
        'MONEY_MANAGEMENT_MODE': 
        [FixedLotRule(lot_size=0.01),
        #  PartialCloseRule(target_rr=1.0, close_volume=0.1,)
         ], 
        'CANDLE_TYPE': 'STANDARD', # HEA    
        'PRINT_TRADE_LOG': True,    # False        
        'ALLOWED_DAYS': [0,1,3,4],    
        'KILLZONES': [
            # (time(3, 00), time(5, 00)),
            # (time(11, 00), time(23, 00)),
           (time(4, 00), time(19, 00)),
            #FOR TEST 
            # (time(4, 00), time(5, 00)),
            # (time(6, 00), time(9, 00)),
            # (time(10, 00), time(19, 00)),
            # (time(10, 00), time(11, 00)),
            # (time(16, 00), time(19, 00)),
            # (time(20, 00), time(22, 00)),
            ] 
    }
    

    strategy_params = {

            'RISK_REWARD_RATIO': 2.0,     # نسبت ریوارد به ریسک ثابت
            'SL_PIPS': 120.0,             # مقدار استاپ لاس به پیپ
            'LIQ_LENGTH': 3,             # طول دوره نقدینگی
            'FVG_WINDOW': 3,              # حداکثر فاصله مجاز کندل سیگنال تا FVG
            'BROOKS_STRENGTH': 0.70     # قدرت کندل بازگشتی (70 درصد بدنه پر)
    }
    
    try:
        # 3. ساخت نمونه استراتژی
        strategy_to_test = SMCBrooksMonsterStrategy(strategy_params)
        
        # 4. راه‌اندازی انجین بک‌تست
        backtester = Backtester(general_config)
        backtester.load_data()
        backtester.run(strategy_to_test)
        backtester.report()   
        
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    
    # -----------------------------------------------------------
    # MULTI ASSET (Select one to run)
    # -----------------------------------------------------------
    #run_multi_Backtest_Engine_Alpari()         #   <---      
 
    #run_multi_Backtest_Engine_fundednext()
    
    # run_multi_Backtest_Engine_Litefinance()
    
    # run_multi_Backtest_ALBROOKS_LF()
    
    # run_multi_Backtest_Combined_LF()
    
    #run_SuperTrend_backtest()
    # -----------------------------------------------------------
    # SINGLE ASSET (Select one to run)
    # -----------------------------------------------------------
    #run_quant_backtest()            # <--- NEW STRATEGY
    #run_kc_backtest_US30()
    #run_kc_backtest_XAUUSD()    # <--- alpari
    # run_adx_backtest()
    # run_ds_backtest()

    #run_GAP4_backtest()

    #run_MACD_RSI_backtest()

    #run_sp2l_backtest()

    #run_HalfLeg_backtest()
    #run_HalfLeg_SMC_backtest()
    
    run_Liquidity_Sweep_pro_backtest()
    # ____________________________________________________________
    
    # run_pure_pa_5min_backtest()
    # run_us30_inside_bar_backtest()
    # run_us30_liquidity_sweep()
    
    #LITE F
    # run_GAP4_backtest()
    # run_GAP4_XAUUSD_LF()
    
    # run_ALBROOKS_SMC_YM()
    # run_ALBROOKS_SMC_XAU_LF()
    
    # 
    # run_GAP4_XAUUSD_FUNDED()
    # run_GAP4_WTI_FUNDED()
    # run_GAP4_US30_FUNDED()
    # run_GAP4_NDX_FUNDED() # NOT BAD
    # run_GAP4_EURUSD_FUNDED()
    
    # run_smc_brooks_backtest()