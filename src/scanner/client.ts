import type { NewTokenEvent, TradeEvent } from './types.js';

const WS_URL = 'wss://pumpportal.fun/api/data';
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

export interface PumpPortalHandlers {
  onNewToken(event: NewTokenEvent): void;
  onTrade(event: TradeEvent): void;
  onOpen(): void;
  onError(error: Error): void;
}

export class PumpPortalClient {
  private socket: WebSocket | null = null;
  private running = false;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly tradeSubscriptions = new Set<string>();

  constructor(
    private readonly apiKey: string | null,
    private readonly handlers: PumpPortalHandlers,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.tradeSubscriptions.clear();
    this.socket?.close();
    this.socket = null;
  }

  subscribeTokenTrades(mints: string[]): void {
    const fresh = mints.filter((mint) => !this.tradeSubscriptions.has(mint));
    fresh.forEach((mint) => this.tradeSubscriptions.add(mint));
    if (fresh.length > 0) this.send({ method: 'subscribeTokenTrade', keys: fresh });
  }

  unsubscribeTokenTrades(mints: string[]): void {
    const known = mints.filter((mint) => this.tradeSubscriptions.has(mint));
    known.forEach((mint) => this.tradeSubscriptions.delete(mint));
    if (known.length > 0) this.send({ method: 'unsubscribeTokenTrade', keys: known });
  }

  private connect(): void {
    const url = this.apiKey
      ? `${WS_URL}?api-key=${encodeURIComponent(this.apiKey)}`
      : WS_URL;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.send({ method: 'subscribeNewToken' });

      if (this.tradeSubscriptions.size > 0) {
        this.send({ method: 'subscribeTokenTrade', keys: [...this.tradeSubscriptions] });
      }

      this.handlers.onOpen();
    };

    socket.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!isPumpPortalEvent(payload)) return;

      if (payload.txType === 'create') {
        this.handlers.onNewToken(payload as NewTokenEvent);
      } else {
        this.handlers.onTrade(payload as TradeEvent);
      }
    };

    socket.onerror = () => {
      this.handlers.onError(new Error('PumpPortal websocket error'));
    };

    socket.onclose = (event) => {
      this.socket = null;
      if (!this.running) return;
      this.scheduleReconnect(event.code);
    };
  }

  private scheduleReconnect(code: number): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempt += 1;
    const delay = Math.min(
      BASE_RECONNECT_MS * 2 ** (this.reconnectAttempt - 1),
      MAX_RECONNECT_MS,
    );

    console.warn(`PumpPortal WS closed (code ${code}); reconnect in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}

function isPumpPortalEvent(
  value: unknown,
): value is { txType: string; mint: string } {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { txType?: unknown; mint?: unknown };
  return typeof candidate.mint === 'string' && typeof candidate.txType === 'string';
}
