// SOLO SERVIDOR (usa node:crypto). Fuente única: ~/apps-platform/packages/openai-image/openai-image-server.ts
import { createHash } from 'node:crypto';
import type { ResolvedImageOptions } from './openai-image-core.ts';

/** Identificador anónimo y estable de la persona para OpenAI (`safety_identifier`: ≤128 caracteres, sin datos personales). */
export const safetyIdentifier = (appId: string, userId: string): string => createHash('sha256').update(`${appId}:${userId}`).digest('hex');

/** Campos comunes de /images/generations (JSON) y /images/edits (multipart). `background`/`moderation` solo si no son los de por defecto. */
export function openaiImageFields(v: ResolvedImageOptions, who: { appId: string; userId: string }, modelId: string = v.modelId): Record<string, string | number> {
  const f: Record<string, string | number> = {
    model: modelId,
    size: v.size,
    quality: v.quality,
    n: v.n,
    output_format: v.format,
    safety_identifier: safetyIdentifier(who.appId, who.userId),
  };
  if (v.compression !== undefined) f.output_compression = v.compression;
  if (v.background !== 'auto') f.background = v.background;
  if (v.moderation !== 'auto') f.moderation = v.moderation;
  return f;
}

