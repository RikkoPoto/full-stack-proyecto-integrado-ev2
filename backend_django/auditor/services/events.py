import json
import queue
import threading
from typing import Dict, Set


class EventBroker:
    # Gestiona colas en memoria por cada verificacion activa para despachar Server-Sent Events
    def __init__(self):
        self._lock = threading.Lock()
        self._subscribers: Dict[str, Set[queue.Queue]] = {}

    def subscribe(self, scan_id: str) -> queue.Queue:
        q = queue.Queue(maxsize=250)
        with self._lock:
            if scan_id not in self._subscribers:
                self._subscribers[scan_id] = set()
            self._subscribers[scan_id].add(q)
        return q

    def unsubscribe(self, scan_id: str, q: queue.Queue) -> None:
        with self._lock:
            if scan_id in self._subscribers:
                self._subscribers[scan_id].discard(q)
                if not self._subscribers[scan_id]:
                    del self._subscribers[scan_id]

    def publish(self, scan_id: str, event_type: str, data: dict) -> None:
        with self._lock:
            queues = list(self._subscribers.get(scan_id, []))
        for q in queues:
            try:
                q.put_nowait((event_type, data))
            except queue.Full:
                pass


broker = EventBroker()


def format_sse(event_type: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n"
