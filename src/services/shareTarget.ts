/** Extrai a primeira URL http(s) de um texto compartilhado (o share sheet
 * às vezes manda "Confira: https://..." em vez da URL pura). */
export function extractUrl(text: string): string | null {
  const match = /https?:\/\/\S+/.exec(text);
  return match?.[0] ?? null;
}

/** Lê a URL de produto compartilhada com o PWA instalado via Web Share
 * Target (manifest `share_target`, equivalente ao receive_sharing_intent
 * do app Flutter) e limpa a query string em seguida. */
export function consumeSharedUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const candidates = [params.get('url'), params.get('text'), params.get('title')];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = extractUrl(candidate) ?? (isUrl(candidate) ? candidate : null);
    if (url) {
      window.history.replaceState(null, '', window.location.pathname);
      return url;
    }
  }
  return null;
}

function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
