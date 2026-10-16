import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import pytz

from core.mt5_runtime import mt5_call
from runtime_paths import writable_backend_dir

try:  # pragma: no cover - optional runtime dependency
    import MetaTrader5 as mt5
except Exception:  # pragma: no cover
    mt5 = None

CHUNK_DAYS = 100
MAX_BARS_PER_REQUEST = 50_000


def ensure_backtest_data_dir():
    target = writable_backend_dir() / 'storage' / 'backtest_data'
    target.mkdir(parents=True, exist_ok=True)
    return target


def _normalize_timeframe_seconds(timeframe):
    mapping = {
        'M1': 60,
        'M5': 300,
        'M15': 900,
        'M30': 1800,
        'H1': 3600,
        'H4': 14400,
        'D1': 86400,
    }
    if isinstance(timeframe, int):
        return timeframe
    return mapping.get(str(timeframe).upper(), 300)


def _normalize_timeframe_mt5(timeframe):
    names = {
        'M1': ('TIMEFRAME_M1', 1),
        'M5': ('TIMEFRAME_M5', 5),
        'M15': ('TIMEFRAME_M15', 15),
        'M30': ('TIMEFRAME_M30', 30),
        'H1': ('TIMEFRAME_H1', 16385),
        'H4': ('TIMEFRAME_H4', 16388),
        'D1': ('TIMEFRAME_D1', 16408),
    }
    if isinstance(timeframe, int):
        for name, seconds in (('M1', 60), ('M5', 300), ('M15', 900), ('M30', 1800), ('H1', 3600), ('H4', 14400), ('D1', 86400)):
            constant_name, fallback_value = names[name]
            constant_value = getattr(mt5, constant_name, fallback_value) if mt5 is not None else fallback_value
            if timeframe == seconds:
                return constant_value
            if timeframe == constant_value:
                return timeframe
        return timeframe
    name = str(timeframe).upper()
    constant_name, fallback_value = names.get(name, names['M5'])
    return getattr(mt5, constant_name, fallback_value) if mt5 is not None else fallback_value


def _terminal_is_connected():
    term = mt5_call(mt5.terminal_info)
    account = mt5_call(mt5.account_info)
    return term is not None and bool(getattr(term, 'connected', False)) and account is not None


def _connect_mt5(mt5_path=''):
    if mt5 is None:
        return False
    try:
        if _terminal_is_connected():
            return True
    except Exception:
        pass

    if mt5_path:
        try:
            if mt5_call(mt5.initialize, path=mt5_path) and _terminal_is_connected():
                return True
        except Exception:
            pass

    try:
        mt5_call(mt5.shutdown)
    except Exception:
        pass

    try:
        initialized = mt5_call(mt5.initialize)
        return bool(initialized and _terminal_is_connected())
    except Exception:
        return False


def _initialize_mt5_if_needed(mt5_path=''):
    return _connect_mt5(mt5_path)


def _select_symbol(symbol):
    if not mt5_call(mt5.symbol_select, symbol, True):
        try:
            error = mt5_call(mt5.last_error)
        except Exception:
            error = 'unavailable'
        raise RuntimeError(f'Could not select MT5 symbol {symbol}: {error}')


def detect_symbol_specs(symbol, mt5_path=''):
    symbol = (symbol or '').strip()
    if not symbol:
        return {'success': False, 'message': 'A symbol is required for MT5 specification detection.'}

    if mt5 is None:
        return {'success': False, 'message': 'MetaTrader5 is not installed.'}

    try:
        if not _initialize_mt5_if_needed(mt5_path):
            error = mt5_call(mt5.last_error)
            return {'success': False, 'message': f'Could not connect to MT5: {error}'}
        _select_symbol(symbol)
        info = mt5_call(mt5.symbol_info, symbol)
        if not info:
            error = mt5_call(mt5.last_error)
            return {'success': False, 'message': f'MT5 returned no specifications for {symbol}: {error}'}

        digits = int(getattr(info, 'digits', 5) or 5)
        trade_contract_size = float(getattr(info, 'trade_contract_size', 100.0) or 100.0)
        trade_tick_size = float(getattr(info, 'trade_tick_size', 0.01) or 0.01)
        point_value = 1.0
        spread_divisor = 100.0 if digits in (2, 3) or symbol.upper().startswith(('XAU', 'XAG', 'US30')) else 100000.0 if digits == 5 else float(10 ** digits)
        return {
            'success': True,
            'contract_size': trade_contract_size,
            'tick_size': trade_tick_size,
            'digits': digits,
            'point_value': point_value,
            'spread_divisor': spread_divisor,
        }
    except Exception as exc:
        return {'success': False, 'message': str(exc)}


def fetch_symbol_history(symbol, start_date, timeframe='M5', lookback_period=500, progress_callback=None, mt5_path=''):
    """Drill historical candles from MT5 on a safe dispatcher thread and save them as TSV data."""
    symbol = (symbol or '').strip()
    if not symbol:
        raise ValueError('A symbol is required for MT5 history drilling.')

    timeframe_seconds = _normalize_timeframe_seconds(timeframe)
    utc_timezone = pytz.timezone('Etc/UTC')
    now_utc = datetime.now(utc_timezone)
    if isinstance(start_date, str):
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=utc_timezone)
    else:
        start_dt = start_date
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=utc_timezone)
        else:
            start_dt = start_dt.astimezone(utc_timezone)
    warmup_days = max(7, int((lookback_period * timeframe_seconds) / 86400.0) + 5)
    current_bar_open = int(now_utc.timestamp()) // timeframe_seconds * timeframe_seconds
    last_closed_bar_end = datetime.fromtimestamp(current_bar_open - 1, tz=utc_timezone)
    effective_start = start_dt - timedelta(days=warmup_days)
    if effective_start > last_closed_bar_end:
        effective_start = last_closed_bar_end - timedelta(days=max(7, warmup_days))

    if mt5 is None:
        raise RuntimeError('MetaTrader5 is not installed. Backtest data fetching is unavailable.')

    if not _initialize_mt5_if_needed(mt5_path):
        error = mt5_call(mt5.last_error)
        raise RuntimeError(f'Failed to initialize MetaTrader5 for backtest data drilling: {error}')

    _select_symbol(symbol)
    timeframe_mt5 = _normalize_timeframe_mt5(timeframe)

    rows = []
    current_cursor = last_closed_bar_end
    max_loops = 500
    loop_count = 0
    range_error = None
    while current_cursor > effective_start and loop_count < max_loops:
        loop_count += 1
        end_bound = current_cursor
        max_chunk_seconds = min(CHUNK_DAYS * 86400, timeframe_seconds * MAX_BARS_PER_REQUEST)
        chunk_start = end_bound - timedelta(seconds=max_chunk_seconds)
        chunk_start = max(chunk_start, effective_start)
        rate_data = mt5_call(mt5.copy_rates_range, symbol, timeframe_mt5, chunk_start, end_bound)
        used_position_fallback = False
        if rate_data is None or len(rate_data) == 0:
            range_error = mt5_call(mt5.last_error)
            if isinstance(range_error, (tuple, list)) and range_error and range_error[0] == -2:
                position_fetch = getattr(mt5, 'copy_rates_from_pos', None)
                if position_fetch is None:
                    raise RuntimeError(
                        f'MT5 range request rejected parameters for {symbol} at {timeframe} '
                        f'(enum {timeframe_mt5}, {chunk_start!s} to {end_bound!s}): {range_error}; '
                        'copy_rates_from_pos is unavailable.'
                    )
                requested_bars = int((last_closed_bar_end - effective_start).total_seconds() / timeframe_seconds) + 1
                requested_bars = min(max(requested_bars, int(lookback_period) + 100), 2_000_000)
                fallback_rates = []
                start_position = 1
                remaining_bars = requested_bars
                while remaining_bars > 0:
                    batch_size = min(MAX_BARS_PER_REQUEST, remaining_bars)
                    batch = mt5_call(position_fetch, symbol, timeframe_mt5, start_position, batch_size)
                    if batch is None or len(batch) == 0:
                        break
                    fallback_rates.extend(batch)
                    received_bars = len(batch)
                    start_position += received_bars
                    remaining_bars -= received_bars
                    if received_bars < batch_size:
                        break
                rate_data = fallback_rates
                if not rate_data:
                    position_error = mt5_call(mt5.last_error)
                    raise RuntimeError(
                        f'MT5 history requests failed for {symbol} at {timeframe} '
                        f'(enum {timeframe_mt5}, range {chunk_start!s} to {end_bound!s}): '
                        f'copy_rates_range={range_error}; copy_rates_from_pos={position_error}'
                    )
                used_position_fallback = True
            else:
                current_cursor = chunk_start
                continue
        for candle in rate_data:
            row = {
                'DATE': pd.to_datetime(candle[0], unit='s').strftime('%Y-%m-%d'),
                'TIME': pd.to_datetime(candle[0], unit='s').strftime('%H:%M:%S'),
                'OPEN': float(candle[1]),
                'HIGH': float(candle[2]),
                'LOW': float(candle[3]),
                'CLOSE': float(candle[4]),
                'TICKVOL': float(candle[5]),
                'VOL': float(candle[5]),
                'SPREAD': float(candle[7] if len(candle) > 7 else 0.0),
            }
            rows.append(row)
        if progress_callback:
            elapsed = (last_closed_bar_end - current_cursor).total_seconds()
            total = max((last_closed_bar_end - effective_start).total_seconds(), 1.0)
            progress_callback(min(100.0, elapsed / total * 100.0), f'Drilling {symbol} history')
        if used_position_fallback:
            break
        oldest_candle = rate_data[0][0]
        next_cursor = datetime.fromtimestamp(float(oldest_candle), tz=utc_timezone) - timedelta(seconds=1)
        current_cursor = chunk_start if next_cursor >= end_bound else next_cursor

    if not rows:
        error = mt5_call(mt5.last_error)
        raise RuntimeError(
            f'No historical candles were returned for symbol {symbol} at {timeframe} '
            f'(MT5 timeframe enum {timeframe_mt5}, last range error {range_error}): {error}'
        )

    df = pd.DataFrame(rows)
    df['TIMESTAMP_UTC'] = pd.to_datetime(df['DATE'] + ' ' + df['TIME'], utc=True)
    closed_bar_cutoff = pd.Timestamp(last_closed_bar_end).tz_convert('UTC')
    df = df[df['TIMESTAMP_UTC'] <= closed_bar_cutoff]
    df = df.drop(columns=['TIMESTAMP_UTC'])
    if df.empty:
        raise RuntimeError(
            f'MT5 returned no fully closed candles for symbol {symbol} at {timeframe} '
            f'(last completed candle cutoff {last_closed_bar_end.isoformat()}).'
        )
    df = df.drop_duplicates(subset=['DATE', 'TIME']).sort_values(['DATE', 'TIME']).reset_index(drop=True)
    target_dir = ensure_backtest_data_dir()
    filename = f'{symbol.upper()}_{timeframe.upper()}.csv'
    file_path = target_dir / filename
    df.to_csv(file_path, sep='\t', index=False)
    return df
