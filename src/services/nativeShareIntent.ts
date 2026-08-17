import { registerPlugin } from '@capacitor/core';
import { extractUrl, isUrl } from './shareTarget';

interface SharedTextEvent {
  text: string;
}

interface ShareIntentPlugin {
  addListener(
    eventName: 'sharedTextReceived',
    listenerFunc: (event: SharedTextEvent) => void,
  ): Promise<{ remove: () => void }>;
}

const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent');

/** Escuta links compartilhados via "Compartilhar" do Android (ex.: do app
 * da Shopee) quando o Shoplist roda empacotado nativamente — equivalente,
 * para o app nativo, ao Web Share Target (`consumeSharedUrl`) usado pelo
 * PWA instalado no navegador. No PWA web isso é um no-op silencioso (o
 * plugin nativo não existe; a chamada abaixo simplesmente nunca dispara). */
export function listenForNativeSharedUrl(onUrl: (url: string) => void): () => void {
  let removed = false;
  let cleanup: (() => void) | null = null;

  void ShareIntent.addListener('sharedTextReceived', (event) => {
    const url = extractUrl(event.text) ?? (isUrl(event.text) ? event.text : null);
    if (url) onUrl(url);
  }).then((handle) => {
    if (removed) handle.remove();
    else cleanup = handle.remove;
  });

  return () => {
    removed = true;
    cleanup?.();
  };
}
