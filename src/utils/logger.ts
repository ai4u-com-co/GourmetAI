// Registro de errores del navegador. No se envía a ningún servicio externo: queda en la consola (línea JSON) y en un anillo de
// sessionStorage (últimos 20) que se puede copiar desde la consola con `copy(sessionStorage.gourmet_ai_errors)` si soporte lo pide.
// Nunca se registran fotos, prompts, tokens ni correos.
const KEY = 'gourmet_ai_errors';
const MAX = 20;

export interface LogEntry {
  t: string;
  event: string;
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  path?: string;
}

const remember = (entry: LogEntry) => {
  try {
    const list: LogEntry[] = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    sessionStorage.setItem(KEY, JSON.stringify([...list, entry].slice(-MAX)));
  } catch {
    /* sin sessionStorage: solo consola */
  }
};

export const logError = (event: string, err: unknown, extra: Partial<LogEntry> = {}): void => {
  const e = err as { message?: unknown; code?: unknown; status?: unknown; requestId?: unknown } | null;
  const entry: LogEntry = {
    t: new Date().toISOString(),
    event,
    message: String(e?.message ?? err ?? '').slice(0, 300),
    code: typeof e?.code === 'string' ? e.code : undefined,
    status: typeof e?.status === 'number' ? e.status : undefined,
    requestId: typeof e?.requestId === 'string' ? e.requestId : undefined,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...extra,
  };
  console.error('[gourmetai]', JSON.stringify(entry));
  remember(entry);
};

/** Captura errores que nadie atrapó (por ejemplo, una promesa rechazada dentro de un componente). */
export const installGlobalErrorLogging = (): void => {
  window.addEventListener('error', (ev) => logError('window_error', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => logError('unhandled_rejection', ev.reason));
};
