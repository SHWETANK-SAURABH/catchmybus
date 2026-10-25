"""Latest-bus-position cache behind an interface, so Redis could replace it later."""
import threading
from abc import ABC, abstractmethod


class ICache(ABC):
    """Key/value store for the most recent position of each bus."""

    @abstractmethod
    def set_position(self, bus_id: int, data: dict) -> None: ...

    @abstractmethod
    def get_position(self, bus_id: int) -> dict | None: ...

    @abstractmethod
    def all_positions(self) -> list[dict]: ...

    @abstractmethod
    def remove(self, bus_id: int) -> None: ...

    @abstractmethod
    def clear(self) -> None: ...


class InMemoryCache(ICache):
    """Process-local implementation (a dict guarded by a lock)."""

    def __init__(self):
        self._data: dict[int, dict] = {}
        self._lock = threading.Lock()

    def set_position(self, bus_id: int, data: dict) -> None:
        with self._lock:
            self._data[bus_id] = dict(data)

    def get_position(self, bus_id: int) -> dict | None:
        with self._lock:
            d = self._data.get(bus_id)
            return dict(d) if d else None

    def all_positions(self) -> list[dict]:
        with self._lock:
            return [dict(v) for v in self._data.values()]

    def remove(self, bus_id: int) -> None:
        with self._lock:
            self._data.pop(bus_id, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


# Single shared instance used by the simulator and the tracking API.
cache: ICache = InMemoryCache()
