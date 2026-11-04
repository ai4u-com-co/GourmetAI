# GourmetAI (VisualFeast)

App web instalable (PWA) que mejora fotos de platos con presentación gourmet, crea platos desde una idea, detecta ingredientes y genera recetas con IA.
Software propio de Ai4U. Entra con Google; la IA es **GPT Image 2.5** (imágenes) y `gpt-4o-mini` (ingredientes y recetas) de OpenAI.

## Cómo funciona

- **Login**: Google vía Supabase (PKCE) en el proyecto compartido **`apps`** (`dmracybffqdvcltkarag`), app `gourmetai`. El acceso lo decide la membresía en `core.app_memberships`; `open_signup` está apagado hasta lanzar la app.
- **Créditos**: la clave de OpenAI es de Mariano, así que el control está en el servidor. `api/[action].ts` valida la sesión, cobra con `core.consume_credits` **antes** de llamar a OpenAI y devuelve el cobro (`core.refund_credits`) si falla. Los admin no pagan. El `refund_token` nunca llega al navegador.
  - Imagen: Borrador 1 · Buena 4 · Máxima 15 créditos (×2 en 2K). Receta: 1 crédito. Análisis de ingredientes: sin costo (pero exige acceso).
  - Saldo inicial al unirse: 10 créditos (`core.apps.default_credits`).
- **Instalable**: `manifest.json` + `sw.js` + íconos. El service worker solo guarda la cáscara de la app; **nunca** `/api/*` ni Supabase.
- **Historial**: en el navegador, **por cuenta** (`gourmet_ai_history_<user_id>`). El historial anterior (sin dueño) se ofrece importar a la primera cuenta que entre.

## Variables de entorno

Solo una, en Vercel (Production, **Sensitive**): `OPENAI_API_KEY`. La URL y la clave *publishable* de Supabase son públicas y están en el código. Nunca uses `REACT_APP_*` para secretos (viajan al navegador).

## Desarrollo

```bash
npm install
npm run typecheck && npm run lint
npm test            # 23 pruebas del servidor (Supabase y OpenAI simulados, sin red)
npm run build
```

Para probar `/api/*` en local hace falta `vercel dev` con `OPENAI_API_KEY` en `.env.local` (no se commitea).

## Estructura

```
api/[action].ts        # analyze-image · generate-image · generate-recipe (Vercel Function)
src/services/          # apiClient (llama a /api), promptBuilder, supabase, credits
src/hooks/useAuth.ts   # sesión + membresía + saldo
public/                # manifest.json, sw.js, íconos
tests/api.test.mjs
```

## Instalar en el celular

- **Android / Chrome**: botón «Instalar app» en la cabecera, o menú ⋮ → *Instalar aplicación*.
- **iPhone / Safari**: Compartir → *Añadir a pantalla de inicio*.
