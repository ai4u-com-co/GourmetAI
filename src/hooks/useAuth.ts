import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { APP_ID, supabase } from '../services/supabase';
import { subscribeCredits } from '../services/credits';

/** loading: comprobando · signed_out: sin sesión · no_access: entró con Google pero sin membresía · ready: puede usar la app */
export type AccessState = 'loading' | 'signed_out' | 'no_access' | 'ready';

interface Membership {
  role: 'user' | 'admin';
  credits: number;
}

const readMembership = async (): Promise<Membership | null> => {
  const { data, error } = await supabase
    .schema('core')
    .from('app_memberships')
    .select('role,credits,is_active')
    .eq('app_id', APP_ID)
    .maybeSingle();
  if (error) throw error;
  return data && data.is_active ? { role: data.role, credits: data.credits } : null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AccessState>('loading');
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);
  const readyFor = useRef<string | null>(null); // persona con acceso ya confirmado
  const currentId = useRef<string | null>(null); // persona con la sesión activa ahora mismo

  // Carga la membresía; si no hay y la app está abierta, se une sola (join_app falla en apps cerradas: es esperado).
  const resolveAccess = useCallback(async (s: Session | null) => {
    const id = ++runId.current;
    currentId.current = s?.user.id ?? null;
    setSession(s);
    if (!s) {
      readyFor.current = null;
      setMembership(null);
      setState('signed_out');
      return;
    }
    // El SDK repite eventos de sesión (refresco de token, volver a la pestaña): para la MISMA persona ya verificada
    // no se vuelve a mostrar «cargando», porque eso desmontaría el estudio y se perdería lo que se está haciendo.
    if (readyFor.current === s.user.id) return;
    readyFor.current = null;
    setState('loading');
    try {
      let m = await readMembership();
      if (!m) {
        await supabase.schema('core').rpc('join_app', { p_app: APP_ID });
        m = await readMembership();
      }
      if (id !== runId.current) return; // llegó una resolución más nueva
      setMembership(m);
      setError(null);
      readyFor.current = m ? s.user.id : null;
      setState(m ? 'ready' : 'no_access');
    } catch {
      if (id !== runId.current) return;
      setError('No se pudo verificar tu acceso. Revisa tu conexión e inténtalo de nuevo.');
      setState('signed_out');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolveAccess(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Nunca esperar llamadas a Supabase dentro del callback (puede bloquear el SDK): se difiere.
      setTimeout(() => resolveAccess(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [resolveAccess]);

  // El saldo cambia cuando /api/generate responde, pero solo si la respuesta es de la cuenta que está activa ahora:
  // una generación que termina después de cambiar de cuenta no puede mostrar su saldo en la nueva.
  useEffect(
    () =>
      subscribeCredits((remaining, ownerId) => {
        if (ownerId !== currentId.current) return;
        setMembership((m) => (m ? { ...m, credits: remaining } : m));
      }),
    []
  );

  const signIn = useCallback(async () => {
    setError(null);
    // La dirección de retorno debe estar en el allowlist de Redirect URLs del proyecto `apps`.
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
    });
    if (e) setError('No se pudo abrir Google. Inténtalo de nuevo.');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    state,
    error,
    email: session?.user?.email ?? null,
    userId: session?.user?.id ?? null,
    credits: membership?.credits ?? 0,
    isAdmin: membership?.role === 'admin',
    signIn,
    signOut,
  };
}
