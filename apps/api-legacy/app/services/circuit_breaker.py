"""Platform circuit breaker.

Opens after N consecutive failures. Half-opens after a timeout.
Prevents hammering a platform that is down or rate-limiting.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class PlatformCircuitBreaker:
    """Per-platform circuit breaker stored in Redis.

    Opens after `failure_threshold` consecutive failures.
    Half-opens after `recovery_timeout` seconds.
    Closes again on success.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 900,  # 15 minutes
        half_open_max_calls: int = 1,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self._state: dict[str, CircuitState] = {}
        self._failure_count: dict[str, int] = {}
        self._last_failure_time: dict[str, datetime] = {}
        self._half_open_calls: dict[str, int] = {}

    async def is_open(self, platform: str) -> bool:
        """Check if the circuit is open (should reject calls)."""
        state = self._get_state(platform)
        return state == CircuitState.OPEN

    async def record_failure(self, platform: str) -> None:
        """Record a failure for the platform."""
        self._failure_count[platform] = self._failure_count.get(platform, 0) + 1
        self._last_failure_time[platform] = datetime.now(timezone.utc)

        if self._failure_count[platform] >= self.failure_threshold:
            self._state[platform] = CircuitState.OPEN
            logger.warning(
                f"Circuit OPEN for {platform} after {self._failure_count[platform]} failures"
            )

    async def record_success(self, platform: str) -> None:
        """Record a success for the platform (closes the circuit)."""
        self._state[platform] = CircuitState.CLOSED
        self._failure_count[platform] = 0
        self._half_open_calls[platform] = 0
        self._last_failure_time.pop(platform, None)

    async def execute(self, platform: str, func, *args, **kwargs):
        """Execute a function with circuit breaker protection."""
        state = self._get_state(platform)

        if state == CircuitState.OPEN:
            # Check if recovery timeout has elapsed
            last_failure = self._last_failure_time.get(platform)
            if last_failure:
                elapsed = (datetime.now(timezone.utc) - last_failure).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self._state[platform] = CircuitState.HALF_OPEN
                    self._half_open_calls[platform] = 0
                else:
                    raise CircuitOpenError(
                        f"Circuit is OPEN for {platform}. Retry after "
                        f"{int(self.recovery_timeout - elapsed)} seconds."
                    )
            else:
                raise CircuitOpenError(f"Circuit is OPEN for {platform}.")

        if state == CircuitState.HALF_OPEN:
            # Only allow limited calls in half-open state
            calls = self._half_open_calls.get(platform, 0)
            if calls >= self.half_open_max_calls:
                raise CircuitOpenError(
                    f"Circuit is HALF_OPEN for {platform}. Max test calls reached."
                )
            self._half_open_calls[platform] = calls + 1

        try:
            result = await func(*args, **kwargs)
            await self.record_success(platform)
            return result
        except Exception:
            await self.record_failure(platform)
            raise

    def _get_state(self, platform: str) -> CircuitState:
        """Get the current circuit state, transitioning from OPEN to HALF_OPEN if timeout elapsed."""
        state = self._state.get(platform, CircuitState.CLOSED)

        if state == CircuitState.OPEN:
            last_failure = self._last_failure_time.get(platform)
            if last_failure:
                elapsed = (datetime.now(timezone.utc) - last_failure).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self._state[platform] = CircuitState.HALF_OPEN
                    self._half_open_calls[platform] = 0
                    return CircuitState.HALF_OPEN

        return state


class CircuitOpenError(Exception):
    """Raised when a circuit is open and calls are rejected."""
    pass


# Global singleton
circuit_breaker = PlatformCircuitBreaker()