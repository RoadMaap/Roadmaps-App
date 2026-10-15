import threading
from concurrent.futures import ThreadPoolExecutor
from functools import wraps

import MetaTrader5 as mt5

_MT5_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix='mt5-api')
_MT5_THREAD_ID = None


def _run_mt5_call(function, args, kwargs):
    global _MT5_THREAD_ID
    _MT5_THREAD_ID = threading.get_ident()
    return function(*args, **kwargs)


def mt5_call(function, *args, **kwargs):
    """Run all terminal API calls on the same thread as initialize()."""
    if threading.get_ident() == _MT5_THREAD_ID:
        return function(*args, **kwargs)
    return _MT5_EXECUTOR.submit(_run_mt5_call, function, args, kwargs).result()


def mt5_order_send(request, context='order'):
    """Normalize request types and report the terminal-side error for None results."""
    normalized_request = dict(request)
    try:
        for field in ('action', 'type', 'magic', 'type_time', 'type_filling'):
            if field in normalized_request:
                normalized_request[field] = int(normalized_request[field])
        for field in ('price', 'sl', 'tp', 'volume'):
            if field in normalized_request:
                normalized_request[field] = float(normalized_request[field])
    except (TypeError, ValueError, OverflowError) as error:
        from core.error_handler import ui_log
        ui_log('error', f"❌ MT5 request validation failed ({context}): {error}")
        return None

    def send_and_read_error():
        result = mt5.order_send(normalized_request)
        return result, mt5.last_error() if result is None else None

    result, local_error = mt5_call(send_and_read_error)
    if result is None:
        from core.error_handler import ui_log
        ui_log('error', f"❌ MT5 Python API returned None ({context}); last_error: {local_error}")
    return result


def serialized_mt5(method):
    @wraps(method)
    def wrapped(*args, **kwargs):
        return mt5_call(method, *args, **kwargs)

    return wrapped


def shutdown_mt5_dispatcher(wait=True):
    _MT5_EXECUTOR.shutdown(wait=wait, cancel_futures=False)


class MT5TaskExecutor:
    def __init__(self, max_workers=4):
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix='mt5-task')
        self._lock = threading.RLock()
        self._futures = {}

    def submit(self, operation_key, operation):
        with self._lock:
            existing = self._futures.get(operation_key)
            if existing is not None and not existing.done():
                return None

            future = self._executor.submit(operation)
            self._futures[operation_key] = future
            future.add_done_callback(lambda completed: self._remove(operation_key, completed))
            return future

    def is_pending(self, operation_key):
        with self._lock:
            future = self._futures.get(operation_key)
            return future is not None and not future.done()

    def _remove(self, operation_key, completed):
        with self._lock:
            if self._futures.get(operation_key) is completed:
                del self._futures[operation_key]

    def shutdown(self, wait=False):
        self._executor.shutdown(wait=wait, cancel_futures=False)