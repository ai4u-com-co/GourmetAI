// Las funciones de Vercel importan './_lib/x.js' (lo que Vercel compila); en las pruebas Node lee el .ts directo: este
// resolvedor mapea ./x.js → ./x.ts cuando el .js no existe. Uso: node --import ./tests/ts-js-resolver.mjs --test …
import { register } from 'node:module';
register(new URL('./ts-js-resolver-hooks.mjs', import.meta.url));
