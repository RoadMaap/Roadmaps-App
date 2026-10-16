from __future__ import annotations

import threading
import time
from datetime import datetime

from .data_fetcher import ensure_backtest_data_dir, fetch_symbol_history
from .engine import Multi_Backtester
from .reporter import BacktestReporter


class BacktestController:
    def __init__(self):
        self._thread = None
        self._event = threading.Event()
        self._latest_result = None
        self._lock = threading.RLock()

    @property
    def is_running(self):
        return self._thread is not None and self._thread.is_alive()

    def start(self, config, progress_callback=None, status_callback=None, result_callback=None):
        with self._lock:
            if self.is_running:
                return {'success': False, 'message': 'A backtest is already running.'}
            self._event.clear()
            self._thread = threading.Thread(
                target=self._run_backtest,
                args=(config, progress_callback, status_callback, result_callback),
                daemon=True,
            )
            self._thread.start()
            return {'success': True, 'message': 'Backtest started.'}

    def stop(self):
        self._event.set()
        return {'success': True, 'message': 'Stop request sent.'}

    def _run_backtest(self, config, progress_callback=None, status_callback=None, result_callback=None):
        try:
            if status_callback:
                status_callback('warning', 'Preparing backtest data and engine...')
            assets = config.get('assets', [])
            for asset_index, asset in enumerate(assets):
                if self._event.is_set():
                    break
                strategy_id = asset['strategy_id']
                if status_callback:
                    status_callback('warning', f"Drilling {asset['symbol']} {asset['timeframe']} history from MT5...")

                def report_drilling_progress(percent, phase, current_index=asset_index):
                    completed_assets = current_index + float(percent or 0) / 100.0
                    overall_percent = (completed_assets / max(1, len(assets))) * 35.0
                    if progress_callback:
                        progress_callback(overall_percent, phase)

                fetch_symbol_history(
                    asset['symbol'],
                    config.get('start_date', '2023-01-01'),
                    timeframe=asset.get('timeframe', 'M5'),
                    lookback_period=asset.get('lookback_period', config.get('lookback_period', 500)),
                    progress_callback=report_drilling_progress,
                    mt5_path=config.get('mt5_path', ''),
                )
                data_file = ensure_backtest_data_dir() / f"{asset['symbol'].upper()}_{asset['timeframe'].upper()}.csv"
                if not data_file.is_file():
                    raise RuntimeError(f'Backtest history file was not created for strategy {strategy_id}.')
                asset['csv_file_path'] = str(data_file)

            def report_simulation_progress(percent, phase):
                if progress_callback:
                    progress_callback(35.0 + (float(percent or 0) * 0.65), phase)

            engine = Multi_Backtester({
                **config,
                'cancel_event': self._event,
                'progress_callback': report_simulation_progress,
                'status_callback': status_callback,
            })
            engine.run()
            self._latest_result = BacktestReporter(engine).build_report()
            candles_processed = sum(len(frame) for frame in engine.pure_data.values())
            if progress_callback:
                progress_callback(100.0, 'Backtest complete')
            if status_callback:
                summary = self._latest_result.get('summary', {})
                status_callback(
                    'success',
                    f"✅ Backtest Complete: {candles_processed} candles processed | "
                    f"{len(self._latest_result.get('trades', []))} trades executed | "
                    f"Net Profit: ${float(summary.get('net_profit', 0.0)):.2f}",
                )
        except Exception as exc:  # pragma: no cover - runtime safety
            self._latest_result = {'error': str(exc), 'summary': {'final_equity': 0.0}}
            if status_callback:
                status_callback('error', f'Backtest failed: {exc}')
        finally:
            if result_callback:
                result_callback(self._latest_result)

    def get_last_result(self):
        return self._latest_result

    def wait_for_completion(self, timeout=None):
        if self._thread is not None:
            self._thread.join(timeout=timeout)
        return self._latest_result
