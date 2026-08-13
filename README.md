# Shoplist (PWA)

Reimplementação como PWA do app Flutter `shoplist`, com as mesmas funcionalidades:
listas de compras (normais e periódicas), itens com categoria/quantidade/garantia,
múltiplos links de produto por item (com detecção de loja e busca de
nome/imagem/preço), preço total agregado, categorias configuráveis e captura de
link compartilhado via Web Share Target.

## Stack

- [Vite](https://vite.dev) + [Preact](https://preactjs.com) + TypeScript
- [Dexie](https://dexie.org) (IndexedDB) como banco local, com `liveQuery` no lugar
  dos `Stream`s do Drift/Riverpod
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) para o service worker
  (Workbox) e o `manifest.webmanifest` (com `share_target`)

## Rodando localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

`npm run build` gera `dist/` com o app, o manifest, os ícones e o service worker
já prontos para deploy em qualquer host estático (Netlify, Vercel, GitHub Pages,
Nginx, etc.). É esse `dist/` que deve ser servido por trás do domínio que o
Tauri vai empacotar.

## Próximo passo: Tauri

Para empacotar como APK independente com o Tauri:

1. `npm create tauri-app` (ou `cargo tauri init`) apontando `frontendDist` para
   `../dist` deste projeto (ou copiando o conteúdo de `dist/` para dentro do
   projeto Tauri).
2. Ativar o target Android (`tauri android init` / `tauri android build`),
   que exige Android Studio + NDK instalados.
3. Como o Tauri roda o frontend num WebView nativo (não um navegador com as
   mesmas políticas de CORS/Service Worker de um PWA instalado), dois pontos
   deste app merecem atenção na migração:
   - `src/services/linkMetadataService.ts`: hoje o fetch de metadados de OG
     tags de lojas como Shopee/Amazon falha silenciosamente no navegador por
     causa de CORS (o app cai de volta para preenchimento manual do preço,
     igual ao Flutter original). No Tauri isso pode ser resolvido trocando o
     `fetch` por `@tauri-apps/plugin-http`, que não sofre a mesma restrição.
   - O Web Share Target (`public/manifest.webmanifest` → `share_target`, lido
     em `src/services/shareTarget.ts`) é o equivalente ao
     `receive_sharing_intent` do Flutter, mas só funciona em PWA instalado via
     navegador. No Tauri Android, o recebimento de "compartilhar com o app"
     precisa ser implementado nativamente (intent filter Android + plugin
     Tauri) e então repassado para essa mesma função de parsing de URL.

## Estrutura

```
src/
  db/         # schema Dexie + funções equivalentes a database.dart
  domain/     # labels.ts, storeDetector.ts (equivalentes ao pacote domain/ do Flutter)
  services/   # linkMetadataService.ts, shareTarget.ts
  state/      # useLiveQuery (equivalente aos StreamProviders do Riverpod)
  ui/         # App.tsx (shell + navegação) e telas em ui/screens, componentes em ui/components
```
