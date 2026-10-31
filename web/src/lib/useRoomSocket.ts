import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';

export interface RoomEvent {
  type: string;
  payload: unknown;
}

/**
 * Subscribes to real-time events for a Travel Room over STOMP/WebSocket.
 * The session cookie authenticates the handshake; the server checks room membership on subscribe.
 */
export function useRoomSocket(roomId: string | undefined, onEvent: (e: RoomEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!roomId) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const client = new Client({
      brokerURL: `${proto}://${window.location.host}/ws`,
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/rooms/${roomId}`, (msg) => {
          try {
            handler.current(JSON.parse(msg.body) as RoomEvent);
          } catch {
            // ignore malformed frames
          }
        });
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    return () => {
      void client.deactivate();
      setConnected(false);
    };
  }, [roomId]);

  return connected;
}
