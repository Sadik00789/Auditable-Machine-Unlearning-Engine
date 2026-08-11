import { useState, useEffect, useRef, useCallback } from 'react';
import { WsConnectionStatus, WsEvent } from '@/types';

const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8080/ws';

export function useWebSocket(url: string = DEFAULT_WS_URL) {
  const [status, setStatus] = useState<WsConnectionStatus>('DISCONNECTED');
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectDelay = 10000;

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      if (reconnectAttemptsRef.current > 0) {
        setStatus('RECONNECTING');
      }

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as WsEvent;
          const timestampedEvent = {
            ...parsedData,
            timestamp: parsedData.timestamp || new Date().toISOString(),
          };

          setLastEvent(timestampedEvent);
          setEvents((prev) => [timestampedEvent, ...prev.slice(0, 99)]); // Keep last 100 events
        } catch (err) {
          console.error('[WebSocket] Failed to parse message JSON:', err);
        }
      };

      socket.onclose = () => {
        setStatus('DISCONNECTED');
        socketRef.current = null;

        // Exponential backoff reconnect logic
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), maxReconnectDelay);
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      socket.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        socket.close();
      };
    } catch (err) {
      setStatus('DISCONNECTED');
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    status,
    events,
    lastEvent,
    clearEvents,
    reconnect: connect,
  };
}
