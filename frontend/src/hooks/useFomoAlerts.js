import { useEffect, useRef, useState } from "react";
import { getAlerts } from "../services/fomoApi.js";

const MAX_ALERTS = 40;
const WS_URL = "wss://api.fomoapi.io/ws/alerts";

export function useFomoAlerts({ enabled = true, apiKey = "" } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    getAlerts({ limit: 20 })
      .then((initialAlerts) => {
        if (active) {
          setAlerts(initialAlerts);
        }
      })
      .catch(() => {});

    const wsUrl = apiKey ? `${WS_URL}?key=${encodeURIComponent(apiKey)}` : WS_URL;
    const socket = new WebSocket(wsUrl);
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
  }, [enabled, apiKey]);

  return { alerts, connected, delaySeconds };
}
