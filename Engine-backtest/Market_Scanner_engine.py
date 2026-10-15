# ==============================================================================
# MT5 MARKET SCANNER ENGINE (v3.9.0)
# Automated multi-threaded symbol evaluation and report generation
# ==============================================================================

import os
import sys
import time
from datetime import datetime
import concurrent.futures
import multiprocessing

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from scipy import stats
import pytz
from tqdm import tqdm

# ==============================================================================
# 1. SYSTEM PATH INJECTION
# ==============================================================================
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# ==============================================================================
# 2. LOCAL MODULE IMPORTS
# ==============================================================================
try:
    # Import the newly structured core engine
    from Single_Backtester_engine import Backtester
except ImportError as e:
    print(f"❌ Error importing Single_Backtester_engine: {e}")
    sys.exit(1)

# --- Timeframe settings ---
TIMEFRAME_MAP = {
    mt5.TIMEFRAME_M1:  ("1M", 60),
    mt5.TIMEFRAME_M5:  ("5M", 300),
    mt5.TIMEFRAME_M15: ("15M", 900),
    mt5.TIMEFRAME_M30: ("30M", 1800),
    mt5.TIMEFRAME_H1:  ("H1", 3600),
    mt5.TIMEFRAME_H4:  ("H4", 14400),
    mt5.TIMEFRAME_D1:  ("D1", 86400),
}

# --- Worker function ---
def process_single_symbol_backtest(args):
    """Process a single symbol using the single backtester engine.

    This function runs an exact-match backtest using the main
    `Backtester` engine on a provided CSV file and returns a
    condensed result dict (or None if failed).
    """
    symbol, csv_path, config, strat_class, strat_params = args
    try:
        # 1. Copy base config (to avoid mutating original settings)
        current_config = config.copy()
        
        # 2. Set path to newly downloaded CSV data
        current_config['csv_file_path'] = csv_path
        
        # 3. Disable trade logs for speed (doesn't affect calculations)
        current_config['PRINT_TRADE_LOG'] = False
        
        # Important note: The line below previously set commission to zero.
        # It was removed to make scanner behavior match single-engine exactly.
        # current_config['COMMISSION_PER_LOT'] = 0.0  <-- DELETED
        
        # 4. Initialize engine
        strategy = strat_class(strat_params)
        engine = Backtester(current_config)
        
        try:
            engine.load_data()
            if engine.historical_data is None or engine.historical_data.empty:
                return None
            engine.run(strategy)
        except:
            return None

        if not engine.trades: return None

        # 5. Analyze results
        df = pd.DataFrame(engine.trades)
        
        # Filter by number of trades (optional - remove to match single backtester exactly)
        # if len(df) < 30: return None 

        net_profit = df['dollar_profit'].sum()
        
        # Calculate win rate and other summary stats
        win_rate = (len(df[df['dollar_profit'] > 0]) / len(df)) * 100
        gross_win = df[df['dollar_profit'] > 0]['dollar_profit'].sum()
        gross_loss = abs(df[df['dollar_profit'] <= 0]['dollar_profit'].sum())
        pf = gross_win / gross_loss if gross_loss > 0 else 999.0

        # Calculate drawdown
        df['equity'] = current_config['initial_capital'] + df['dollar_profit'].cumsum()
        df['peak'] = df['equity'].cummax()
        dd_series = (df['peak'] - df['equity']) / df['peak'] * 100
        max_dd = dd_series.max()

        # Calculate stability
        y = df['equity'].values
        x = np.arange(len(y))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        stability_score = r_value ** 2 * 100 

        final_score = (pf * 20) + (stability_score * 0.5) - (max_dd * 2)

        return {
            'Symbol': symbol,
            'Net Profit': round(net_profit, 2),
            'Win Rate': round(win_rate, 2),
            'Trades': len(df),
            'Profit Factor': round(pf, 2),
            'Drawdown %': round(max_dd, 2),
            'Stability': round(stability_score, 1),
            'Score': round(final_score, 1)
        }
    except: return None

class MT5MarketScanner:
    def __init__(self, strategy_class, strategy_params, base_config):
        self.strategy_class = strategy_class
        self.strategy_params = strategy_params
        self.base_config = base_config
        self.temp_data_folder = "MT5_Auto_Data"
        if not os.path.exists(self.temp_data_folder): os.makedirs(self.temp_data_folder)
        
        self.all_results = [] # store all results for CSV
        self.broker_name = "Unknown"

    def _connect_mt5(self):
        if not mt5.initialize():
            print(f"❌ MT5 Init Failed: {mt5.last_error()}")
            return False
        try:
            self.broker_name = mt5.account_info().company
        except: pass
        return True

    def _get_symbols_by_group(self, group_keyword):
        all_symbols = mt5.symbols_get()
        if all_symbols is None: return []
        filtered = []
        for s in all_symbols:
            if group_keyword.lower() in s.path.lower():
                filtered.append(s.name)
        return filtered

    def _fetch_data_to_csv(self, symbol, timeframe, start_date_config):
            # 1. Select symbol
            if not mt5.symbol_select(symbol, True):
                print(f"   ⚠️ Could not select {symbol}")
                return None
            
            timezone = pytz.timezone("Etc/UTC")
            
            # end date (now)
            date_to = datetime.now(timezone)
            
            # target start date
            try:
                target_date = datetime.strptime(start_date_config, "%Y-%m-%d").replace(tzinfo=timezone)
            except:
                target_date = datetime(2020, 1, 1, tzinfo=timezone)

            all_rates = []
            
            # --- Safe drilling loop ---
            print(f"   ⏳ Drilling {symbol}", end="", flush=True)
            
            # safety guard to avoid infinite loop
            max_loops = 500 
            loop_counter = 0
            
            # speed optimization: 100 days per request
            CHUNK_DAYS = 100 

            while date_to > target_date:
                loop_counter += 1
                if loop_counter > max_loops:
                    print(" [Max Limit Reached]", end="")
                    break

                # request data for previous 100 days
                date_from = date_to - pd.Timedelta(days=CHUNK_DAYS)
                
                rates = mt5.copy_rates_range(symbol, timeframe, date_from, date_to)
                
                if rates is not None and len(rates) > 0:
                    # data found
                    # convert to list and prepend to all_rates
                    rates_list = rates.tolist()
                    all_rates = rates_list + all_rates 
                    
                    # update date_to for next iteration:
                    # move to 1 second before the oldest candle we just received
                    # this prevents repeating/stalling on the same candle
                    oldest_timestamp_in_chunk = rates[0][0]
                    new_date_to = datetime.fromtimestamp(oldest_timestamp_in_chunk, tz=timezone) - pd.Timedelta(seconds=1)
                    
                    # if new_date_to >= date_to (improbable but safe-guard)
                    if new_date_to >= date_to:
                        date_to = date_from # force jump
                    else:
                        date_to = new_date_to
                        
                    print(".", end="", flush=True)
                else:
                    # no data in this range (gap)
                    # force jump back
                    date_to = date_from
                    print("_", end="", flush=True) # indicator for skipping a gap

            print(f" Done ({len(all_rates)} bars)")

            if len(all_rates) < 100:
                print(f"   ❌ No deep history for {symbol}")
                return None

            # convert to DataFrame
            df = pd.DataFrame(all_rates, columns=['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume'])
            df['time'] = pd.to_datetime(df['time'], unit='s')
            
            # drop duplicates and sort
            df.drop_duplicates(subset=['time'], inplace=True)
            df.sort_values(by='time', inplace=True)
            
            # build standard output
            output = pd.DataFrame()
            output['<DATE>'] = df['time'].dt.strftime('%Y.%m.%d')
            output['<TIME>'] = df['time'].dt.strftime('%H:%M:%S')
            output['<OPEN>'] = df['open']
            output['<HIGH>'] = df['high']
            output['<LOW>'] = df['low']
            output['<CLOSE>'] = df['close']
            output['<TICKVOL>'] = df['tick_volume']
            output['<VOL>'] = df['real_volume']
            output['<SPREAD>'] = df['spread']

            safe_name = symbol.replace("/", "").replace(":", "")
            path = os.path.join(self.temp_data_folder, f"{safe_name}.csv")
            output.to_csv(path, sep='\t', index=False)
            
            return path

    def run_scan(self, scan_config):
        if not self._connect_mt5(): return

        target_groups = scan_config['TARGET_GROUPS']
        timeframe = scan_config['TARGET_TIMEFRAME']
        start_date = scan_config['START_DATE']
        
        tf_name, tf_seconds = TIMEFRAME_MAP.get(timeframe, ("Unknown", 300))

        print("\n" + "="*60)
        print(f"🚀 MARKET SCANNER | Broker: {self.broker_name}")
        print(f"Strategy: {self.strategy_class.__name__}")
        print(f"Target: {target_groups} | TF: {tf_name}")
        print("="*60 + "\n")

        for group in target_groups:
            print(f"📂 Scanning Group: {group}...")
            symbols = self._get_symbols_by_group(group)
            
            if not symbols:
                print("   ⚠️ No symbols found.")
                continue

            # 1. Download data
            tasks = []
            print(f"   ⬇️ Downloading data for {len(symbols)} symbols...")
            for sym in tqdm(symbols, leave=False, colour='cyan'):
                path = self._fetch_data_to_csv(sym, timeframe, start_date)
                if path:
                    # build temporary config
                    conf = self.base_config.copy()
                    conf['TIMEFRAME_SECONDS'] = tf_seconds
                    tasks.append((sym, path, conf, self.strategy_class, self.strategy_params))

            # 2. Parallel processing
            if not tasks: continue
            
            print(f"   ⚡ Processing {len(tasks)} symbols on CPU...")
            cpu_count = multiprocessing.cpu_count()
            with concurrent.futures.ProcessPoolExecutor(max_workers=cpu_count) as executor:
                results = list(tqdm(executor.map(process_single_symbol_backtest, tasks), total=len(tasks), leave=False, colour='green'))

            # 3. Collect valid results
            valid_results = [r for r in results if r is not None]
            self.all_results.extend(valid_results)
            print(f"   ✅ Found {len(valid_results)} profitable symbols in {group}.")

        mt5.shutdown()
        self._save_report()

    def _save_report(self):
            if not self.all_results:
                print("\n❌ No profitable strategies found in this scan.")
                return

            df = pd.DataFrame(self.all_results)
            
            # sort by Score
            df = df.sort_values(by='Score', ascending=False)
            
            # --- [New change: save into dedicated folder] ---
            folder_name = "Scan_Results"
            if not os.path.exists(folder_name):
                os.makedirs(folder_name)
                
            # filename (you can add datetime to avoid overwriting previous files)
            # for now keep a fixed name:
            filename = "MarketScan_Results.csv"
            full_path = os.path.join(folder_name, filename)
            
            df.to_csv(full_path, index=False)
            
            print("\n" + "="*60)
            print(f"🏆 SCAN FINISHED!")
            print(f"💾 Results saved to: {full_path}")  # show full path
            print("="*60)
            print("\n🔝 TOP 5 SYMBOLS:")
            print(df.head(5).to_string(index=False))