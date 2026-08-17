import { registerPlugin, Capacitor } from '@capacitor/core';
import type { LinkMetadata } from './linkMetadataService';

interface LinkRendererResult {
  nome: string | null;
  imagemUrl: string | null;
  preco: number | null;
}

interface LinkRendererPlugin {
  renderAndExtract(options: { url: string }): Promise<LinkRendererResult>;
}

const LinkRenderer = registerPlugin<LinkRendererPlugin>('LinkRenderer');

/** Só existe no app nativo Android — carrega a URL num WebView invisível
 * (plugin Kotlin/Java `LinkRendererPlugin`) para ler nome/imagem/preço do
 * DOM já renderizado, contornando o bloqueio de fetch cru que a Shopee e
 * outras lojas aplicam no navegador comum. */
export function nativeRenderingAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function fetchLinkMetadataViaNativeRender(url: string): Promise<LinkMetadata | null> {
  if (!nativeRenderingAvailable()) return null;
  try {
    const result = await LinkRenderer.renderAndExtract({ url });
    return { nome: result.nome, imagemUrl: result.imagemUrl, preco: result.preco };
  } catch (err) {
    console.error('fetchLinkMetadataViaNativeRender falhou', err);
    return null;
  }
}
