"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SSEEvent {
  id: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface UseSSEReturn {
  events: SSEEvent[];
  connected: boolean;
  lastEvent: SSEEvent | null;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

export function useSSE(endpoint = "/api/dashboard/stream"): UseSSEReturn {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const reconnectAttempt = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventIdRef = useRef(0);

  const connect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${endpoint}`;

    fetch(url, {
      headers: {
        Accept: "text/event-stream",
      },
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        setConnected(true);
        reconnectAttempt.current = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const readChunk = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const chunk of lines) {
              const parsed = parseSSEChunk(chunk);
              if (parsed) {
                const evt: SSEEvent = {
                  id: String(eventIdRef.current++),
                  event: parsed.event || "message",
                  data: parsed.data,
                  timestamp: Date.now(),
                };
                setEvents((prev) => [evt, ...prev].slice(0, 50));
                setLastEvent(evt);

                if (
                  evt.event === "application_completed" ||
                  evt.event === "application_failed"
                ) {
                  // Trigger React Query cache invalidation via custom event
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("invalidate-applications"),
                    );
                  }
                }
              }
            }

            return readChunk();
          });

        return readChunk();
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setConnected(false);

        const delay =
          RECONNECT_DELAYS[
            Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
          ];
        reconnectAttempt.current++;
        setTimeout(connect, delay);
      })
      .finally(() => {
        setConnected(false);
      });
  }, [endpoint]);

  useEffect(() => {
    connect();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [connect]);

  return { events, connected, lastEvent };
}

function parseSSEChunk(
  chunk: string,
): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  let dataStr = "";

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      dataStr = line.slice(6).trim();
    }
  }

  if (!dataStr) return null;

  try {
    return { event, data: JSON.parse(dataStr) as Record<string, unknown> };
  } catch {
    return { event, data: { raw: dataStr } };
  }
}
