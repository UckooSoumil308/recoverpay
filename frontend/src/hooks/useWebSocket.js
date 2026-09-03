import { useEffect, useRef, useState, useCallback } from 'react';
const WS_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/ws`
  : 'ws://127.0.0.1:8000/ws';

export const useWebSocket = (onMessageReceived) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onMessageRef = useRef(onMessageReceived);
  const connectRef = useRef(null);

  // Keep latest callback reference without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[WebSocket] Connected to RecoverPay real-time backend.');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectRef.current) {
            connectRef.current();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.warn('[WebSocket] Encountered connection error:', error);
        ws.close();
      };
    } catch (err) {
      console.warn('[WebSocket] Could not open connection:', err);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (connectRef.current) {
          connectRef.current();
        }
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
};

export default useWebSocket;
