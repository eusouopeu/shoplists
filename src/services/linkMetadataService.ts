import type { StoreType } from '../db/types';

export interface LinkMetadata {
  nome: string | null;
  imagemUrl: string | null;
  preco: number | null;
}

const EMPTY_METADATA: LinkMetadata = { nome: null, imagemUrl: null, preco: null };

/** Busca nome/imagem/preço de um link de produto.
 *
 * Mercado Livre expõe título, imagem e preço via API pública sem
 * autenticação (endpoint /items/{id}). Para as demais lojas (Shopee,
 * Amazon, outras) tentamos extrair as meta tags Open Graph — mas rodando no
 * navegador isso só funciona se o site alvo enviar cabeçalhos CORS
 * permissivos, o que a maioria das lojas não faz; nesse caso o preço
 * permanece como entrada manual do usuário. */
export async function fetchLinkMetadata(url: string, loja: StoreType): Promise<LinkMetadata> {
  try {
    if (loja === 'mercadoLivre') {
      return await fetchMercadoLivre(url);
    }
    return await fetchOpenGraph(url);
  } catch {
    return EMPTY_METADATA;
  }
}

async function fetchMercadoLivre(url: string): Promise<LinkMetadata> {
  let resolvedUrl = url;
  if (url.includes('/sec/') || url.includes('/social/')) {
    const resp = await fetch(url, { redirect: 'follow' });
    resolvedUrl = resp.url || url;
  }

  const match = /(ML[A-Z]-?\d+)/i.exec(resolvedUrl);
  if (!match) return fetchOpenGraph(resolvedUrl);

  const itemId = match[1].toUpperCase().replace('-', '');
  const apiResp = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
  if (!apiResp.ok) return fetchOpenGraph(resolvedUrl);

  const data = await apiResp.json();
  return {
    nome: typeof data.title === 'string' ? data.title : null,
    imagemUrl: typeof data.thumbnail === 'string' ? data.thumbnail.replace('http://', 'https://') : null,
    preco: typeof data.price === 'number' ? data.price : null,
  };
}

async function fetchOpenGraph(url: string): Promise<LinkMetadata> {
  const resp = await fetch(url);
  if (!resp.ok) return EMPTY_METADATA;

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const og = (property: string) =>
    doc.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ?? null;

  return {
    nome: og('og:title') ?? doc.querySelector('title')?.textContent ?? null,
    imagemUrl: og('og:image'),
    preco: null,
  };
}
