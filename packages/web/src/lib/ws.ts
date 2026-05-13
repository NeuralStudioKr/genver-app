type Listener = (data: unknown) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    this.reconnectAttempts = 0;
    this.createConnection();
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
  }

  private createConnection() {
    if (!this.token) return;

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const type = parsed.type;
          if (type && this.listeners.has(type)) {
            this.listeners.get(type)!.forEach((fn) => fn(parsed));
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.createConnection(), delay);
  }

  addListener(event: string, fn: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  removeListener(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
  }

  send(type: string, payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}

export const wsClient = new WebSocketClient();
