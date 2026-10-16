import sys
import pickle
import tempfile
from datetime import datetime, timezone
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(PROJECT_ROOT / 'backend') not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT / 'backend'))

from backend.backtest.engine import SecurityGuard, Multi_Backtester
from backend.backtest.reporter import BacktestReporter
from backend.backtest import reporter as reporter_module
from backend.backtest import data_fetcher as data_fetcher_module
from backend.trading.risk_manager import FixedLotRule


def build_sample_data():
    times = pd.date_range('2023-01-01', periods=120, freq='5min')
    base = 100.0
    values = []
    for i, ts in enumerate(times):
        drift = 0.0005 * i
        open_price = base + (i % 5) * 0.15
        close_price = open_price + (0.0006 if i % 2 == 0 else -0.0004)
        high_price = max(open_price, close_price) + 0.08
        low_price = min(open_price, close_price) - 0.08
        values.append({
            'time': ts,
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'spread': 0.02,
            'volume': 10.0,
        })
    return pd.DataFrame(values).set_index('time')


def test_backtest_output():
    data = build_sample_data()
    fallback_strategy = type('FallbackStrategy', (), {
        'prepare_indicators': lambda self, frame, candle_type='STANDARD': frame,
        'check_entry_signal': lambda self, slice_: ('buy', slice_.iloc[-1]['close'], slice_.iloc[-1]['close'] * 0.99, slice_.iloc[-1]['close'] * 1.01) if slice_.iloc[-1]['close'] > slice_.iloc[-5]['close'] else (None, None, None, None),
    })()
    with tempfile.TemporaryDirectory() as temporary_dir:
        csv_path = Path(temporary_dir) / 'synthetic_xauusd.csv'
        source = data.reset_index()
        source['date'] = source['time'].dt.strftime('%Y-%m-%d')
        source['clock'] = source['time'].dt.strftime('%H:%M:%S')
        source = source.rename(columns={
            'open': '<OPEN>',
            'high': '<HIGH>',
            'low': '<LOW>',
            'close': '<CLOSE>',
            'volume': '<TICKVOL>',
            'spread': '<SPREAD>',
        })
        source = source.rename(columns={'date': '<DATE>', 'clock': '<TIME>'})
        source[['<DATE>', '<TIME>', '<OPEN>', '<HIGH>', '<LOW>', '<CLOSE>', '<TICKVOL>', '<SPREAD>']].to_csv(csv_path, sep='\t', index=False)

        config = {
            'initial_capital': 10000.0,
            'STRICT_LOOKAHEAD_PROTECTION': True,
            'lookback_period': 30,
            'margin_limit_pct': 1.0,
            'leverage': 100.0,
            'assets': [{
                'symbol': 'XAUUSD',
                'strategy_id': 'xauusd_test',
                'csv_file_path': str(csv_path),
                'tick_size': 0.01,
                'contract_size': 100.0,
                'timeframe': 'M5',
                'lookback_period': 30,
                'spread_divisor': 100.0,
                'commission_per_lot': 0.0,
                'COMMISSION_PER_LOT': 0.0,
                'point_value': 1.0,
                'allowed_days': [0, 1, 2, 3, 4],
                'killzones': [],
                'MONEY_MANAGEMENT_MODE': [FixedLotRule(0.1)],
                'strategy': fallback_strategy,
            }],
            'start_date': '2023-01-01',
        }
        security = SecurityGuard(config)
        assert security.get_safe_history_slice(data.iloc[:5]).shape[0] == 5

        engine = Multi_Backtester(config)
        engine.run()
        report = BacktestReporter(engine).build_report()
        assert 'summary' in report
        assert 'trades' in report
        assert report['summary']['initial_capital'] > 0
        assert report['summary']['candles_processed'] > 0


def test_spread_does_not_block_initial_signal():
    data = build_sample_data().copy()
    data['spread'] = 10.0
    positions_by_divisor = {}

    for spread_divisor in (100.0, 1000.0):
        with tempfile.TemporaryDirectory() as temporary_dir:
            csv_path = Path(temporary_dir) / 'spread_test.csv'
            source = data.reset_index()
            source['date'] = source['time'].dt.strftime('%Y-%m-%d')
            source['clock'] = source['time'].dt.strftime('%H:%M:%S')
            source = source.rename(columns={
                'open': '<OPEN>',
                'high': '<HIGH>',
                'low': '<LOW>',
                'close': '<CLOSE>',
                'volume': '<TICKVOL>',
                'spread': '<SPREAD>',
                'date': '<DATE>',
                'clock': '<TIME>',
            })
            source[['<DATE>', '<TIME>', '<OPEN>', '<HIGH>', '<LOW>', '<CLOSE>', '<TICKVOL>', '<SPREAD>']].to_csv(csv_path, sep='\t', index=False)
            strategy = type('AlwaysSignalStrategy', (), {
                'prepare_indicators': lambda self, frame, candle_type='STANDARD': frame,
                'check_entry_signal': lambda self, history: ('buy', float(history.iloc[-2]['close']), float(history.iloc[-2]['close']) - 10.0, float(history.iloc[-2]['close']) + 10.0),
            })()
            config = {
                'initial_capital': 10000.0,
                'STRICT_LOOKAHEAD_PROTECTION': False,
                'lookback_period': 10,
                'margin_limit_pct': 1.0,
                'leverage': 100.0,
                'assets': [{
                    'symbol': 'XAUUSD',
                    'strategy_id': 'spread_test',
                    'csv_file_path': str(csv_path),
                    'tick_size': 0.01,
                    'contract_size': 100.0,
                    'spread_divisor': spread_divisor,
                    'point_value': 1.0,
                    'allowed_days': list(range(7)),
                    'killzones': [],
                    'MONEY_MANAGEMENT_MODE': [FixedLotRule(0.1)],
                    'strategy': strategy,
                }],
            }
            engine = Multi_Backtester(config)
            engine.run()
            positions_by_divisor[spread_divisor] = len(engine.positions)

    assert positions_by_divisor == {100.0: 1, 1000.0: 1}


def test_mplfinance_sanitizer_and_chart_report():
    if reporter_module.mpf is None or reporter_module.plt is None:
        raise AssertionError('mplfinance and matplotlib are required for the chart sanitizer regression.')

    data = build_sample_data()
    data['HA_Open'] = data['open']
    data['HA_High'] = data['high']
    data['HA_Low'] = data['low']
    data['HA_Close'] = data['close']

    class PlotStrategy:
        def get_plot_addplots(self, plot_df, addplots, config):
            addplots.append(reporter_module.mpf.make_addplot(pd.Series(float('nan'), index=plot_df.index), panel=0))
            addplots.append(reporter_module.mpf.make_addplot(pd.Series(range(len(plot_df)), index=plot_df.index), panel=1))
            return addplots, (6, 1)

    engine = SimpleNamespace(
        config={'assets': [{
            'strategy_id': 'plot_test',
            'symbol': 'XAUUSD',
            'timeframe': 'M5',
            'candle_type': 'HEIKIN_ASHI',
            'strategy': PlotStrategy(),
        }]},
        pure_data={'plot_test': data},
        trades=[],
        current_equity=10000.0,
    )

    with tempfile.TemporaryDirectory() as temporary_dir:
        with patch.object(reporter_module, 'writable_backend_dir', return_value=Path(temporary_dir)):
            report = BacktestReporter(engine).build_report()
            assert len(report['chart_images']) == 1
            chart = report['chart_images'][0]
            assert chart['image_base64'].startswith('data:image/png;base64,')
            assert Path(chart['file_path']).is_file()
            payload_path = Path(chart['payload_path'])
            assert payload_path.is_file() and payload_path.suffix == '.pkl'
            with payload_path.open('rb') as payload_file:
                payload = pickle.load(payload_file)
            assert isinstance(payload['plot_df'], pd.DataFrame)
            assert isinstance(payload['ap'], list)
            assert payload['plot_kwargs']['type'] == 'candle'
            assert payload['plot_kwargs']['style'] == 'binance'
            assert payload['plot_kwargs']['returnfig'] is True
            assert any('contains no finite values' in warning for warning in chart['warnings'])


def test_mt5_invalid_range_uses_positional_fallback():
    class MockMt5:
        TIMEFRAME_M1 = 1

        def __init__(self):
            self.range_calls = []
            self.position_calls = []

        def terminal_info(self):
            return SimpleNamespace(connected=True)

        def account_info(self):
            return object()

        def symbol_select(self, symbol, enabled):
            return True

        def copy_rates_range(self, symbol, timeframe, date_from, date_to):
            self.range_calls.append((symbol, timeframe, date_from, date_to))
            return None

        def copy_rates_from_pos(self, symbol, timeframe, start_pos, count):
            self.position_calls.append((symbol, timeframe, start_pos, count))
            current_bar_open = int(datetime.now(timezone.utc).timestamp()) // 60 * 60
            return [
                (current_bar_open, 1.0, 2.0, 0.5, 1.5, 10, 0, 2),
                (current_bar_open - 60, 1.0, 2.0, 0.5, 1.5, 10, 0, 2),
            ]

        def last_error(self):
            return -2, 'Terminal: Invalid params'

    mock_mt5 = MockMt5()
    previous_mt5 = data_fetcher_module.mt5
    previous_mt5_call = data_fetcher_module.mt5_call
    previous_data_dir = data_fetcher_module.ensure_backtest_data_dir
    try:
        with tempfile.TemporaryDirectory() as temporary_dir:
            data_fetcher_module.mt5 = mock_mt5
            data_fetcher_module.mt5_call = lambda function, *args, **kwargs: function(*args, **kwargs)
            data_fetcher_module.ensure_backtest_data_dir = lambda: Path(temporary_dir)
            candles = data_fetcher_module.fetch_symbol_history(
                'XAUUSD.',
                '2026-10-15',
                timeframe='M1',
                lookback_period=5,
            )
            assert len(candles) == 1
            assert mock_mt5.range_calls[0][1] == mock_mt5.TIMEFRAME_M1
            assert mock_mt5.range_calls[0][2].tzinfo.zone == 'Etc/UTC'
            assert mock_mt5.range_calls[0][3].tzinfo.zone == 'Etc/UTC'
            assert mock_mt5.position_calls[0][:3] == ('XAUUSD.', mock_mt5.TIMEFRAME_M1, 1)
            assert candles.iloc[-1]['TIME'] < datetime.now(timezone.utc).strftime('%H:%M:%S')
    finally:
        data_fetcher_module.mt5 = previous_mt5
        data_fetcher_module.mt5_call = previous_mt5_call
        data_fetcher_module.ensure_backtest_data_dir = previous_data_dir


test_backtest_output()
test_spread_does_not_block_initial_signal()
test_mplfinance_sanitizer_and_chart_report()
test_mt5_invalid_range_uses_positional_fallback()
print('ok')
