import threading
from concurrent.futures import ThreadPoolExecutor
from functools import wraps


MT5_API_LOCK = threading.RLock()


def mt5_call(function, *args, **kwargs):
    """Serialize access to the process-wide MetaTrader5 client connection."""
    with MT5_API_LOCK:
        return function(*args, **kwargs)


def serialized_mt5(method):
    @wraps(method)
    def wrapped(*args, **kwargs):
        with MT5_API_LOCK:
            return method(*args, **kwargs)

    return wrapped


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