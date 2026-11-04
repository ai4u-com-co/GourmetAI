import { HistoryItem } from '../types';

// El historial vive en el navegador y es POR CUENTA: otra persona que use el mismo navegador no ve lo de la anterior.
const LEGACY_KEY = 'gourmet_ai_history'; // versión anterior, sin dueño
const MAX_HISTORY_ITEMS = 50;

let owner: string | null = null;

/** Fija de quién es el historial activo (null = nadie con acceso: no se lee ni se escribe nada). */
export const setHistoryOwner = (userId: string | null): void => {
  owner = userId;
};

const keyFor = (userId: string) => `gourmet_ai_history_${userId}`;

const read = (key: string): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return [];
  }
};

/** Guarda una nueva generación en el historial de la cuenta activa */
export const saveToHistory = (generation: Omit<HistoryItem, 'id' | 'timestamp'>): HistoryItem | null => {
  if (!owner) return null;
  try {
    const newGeneration: HistoryItem = { id: Date.now().toString(), timestamp: new Date().toISOString(), ...generation };
    const updated = [newGeneration, ...getHistory()].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(keyFor(owner), JSON.stringify(updated));
    return newGeneration;
  } catch (error) {
    console.error('Error guardando en historial:', error);
    return null;
  }
};

/** Historial de la cuenta activa */
export const getHistory = (): HistoryItem[] => (owner ? read(keyFor(owner)) : []);

/** Elimina un elemento del historial de la cuenta activa */
export const deleteFromHistory = (id: string): boolean => {
  if (!owner) return false;
  try {
    localStorage.setItem(keyFor(owner), JSON.stringify(getHistory().filter((item) => item.id !== id)));
    return true;
  } catch (error) {
    console.error('Error eliminando del historial:', error);
    return false;
  }
};

/** Limpia todo el historial de la cuenta activa */
export const clearHistory = (): void => {
  if (owner) localStorage.removeItem(keyFor(owner));
};

/** ¿Hay un historial anterior (sin dueño) en este navegador? */
export const legacyHistoryCount = (): number => read(LEGACY_KEY).length;

/** Pasa el historial anterior a la cuenta activa (fusiona por id) y lo borra. Solo si la persona lo confirmó. */
export const importLegacyHistory = (): number => {
  if (!owner) return 0;
  const legacy = read(LEGACY_KEY);
  const mine = getHistory();
  const have = new Set(mine.map((i) => i.id));
  const merged = [...mine, ...legacy.filter((i) => !have.has(i.id))]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(keyFor(owner), JSON.stringify(merged));
  localStorage.removeItem(LEGACY_KEY);
  return legacy.length;
};

/** Descarta el historial anterior sin importarlo. */
export const discardLegacyHistory = (): void => {
  localStorage.removeItem(LEGACY_KEY);
};
