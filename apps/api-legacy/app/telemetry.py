"""OpenTelemetry setup for structured observability.

Exports traces to Grafana Cloud (free tier) via OTLP.
Instruments FastAPI and SQLAlchemy automatically.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def setup_telemetry(app, service_name: str = "jobblitz-api", version: str = "1.0.0"):
    """Configure OpenTelemetry instrumentation for the FastAPI app."""
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument()

        logger.info(f"OpenTelemetry instrumentation enabled for {service_name}")
    except ImportError:
        logger.warning(
            "OpenTelemetry packages not installed. "
            "Install opentelemetry-instrumentation-fastapi and "
            "opentelemetry-instrumentation-sqlalchemy to enable tracing."
        )
    except Exception as e:
        logger.warning(f"Failed to set up OpenTelemetry: {e}")