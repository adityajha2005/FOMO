import { useEffect, useRef, useState } from "react";

const MAX_ALERTS = 40;
const WS_URL = "wss://api.fomoapi.io/ws/alerts";

export function useFomoAlerts({ enabled = true } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      if (active) {
        setConnected(true);
      }
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "welcome") {
        setDelaySeconds(message.delaySeconds ?? null);
        return;
      }

      if (message.type !== "alert") {
        return;
      }

      setAlerts((current) => {
        const next = [message, ...current.filter((item) => item.id !== message.id)];
        return next.slice(0, MAX_ALERTS);
      });
    };

    socket.onclose = () => {
      if (active) {
        setConnected(false);
      }
    };

    return () => {
      active = false;
      socket.close();
      socketRef.current = null;
    };
  }, [enabled]);

  return { alerts, connected, delaySeconds };
}
