// Aviso mínimo entre la generación de imágenes y el saldo que se muestra en la cabecera.
// El saldo es de la cuenta que PIDIÓ la imagen (`ownerId`): si mientras tanto cambió la sesión, no se muestra en la nueva.
type Listener = (remaining: number, ownerId: string) => void;
const listeners = new Set<Listener>();

export const publishCredits = (remaining: number, ownerId: string) => listeners.forEach((l) => l(remaining, ownerId));

export const subscribeCredits = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
