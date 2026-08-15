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
Nginx, etc.). É esse `dist/` que o Capacitor empacota como app Android.

## Empacotando como APK (Capacitor)

O projeto Android nativo vive em `android/` (gerado por `npx cap add android`,
não deve ser editado manualmente na maior parte das vezes — regenerar com
`npx cap sync` é mais seguro que mexer direto nos arquivos gerados).

Fluxo de build:

```bash
npm run cap:sync   # builda o frontend (dist/) e sincroniza com android/
cd android
JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home" \
  ./gradlew assembleDebug
```

O APK debug sai em
`android/app/build/outputs/apk/debug/app-debug.apk`. Requer Android SDK
instalado (`ANDROID_HOME`/`local.properties`) e JDK 21 — o plugin Android do
Capacitor exige `sourceCompatibility 21`, então um JDK 17 (comum em `/usr/bin/java`
no macOS) falha o build com `invalid source release: 21`.

Como o Capacitor roda o frontend num WebView nativo (não um navegador com as
mesmas políticas de CORS/Service Worker de um PWA instalado), dois pontos
deste app merecem atenção:

- `src/services/linkMetadataService.ts`: hoje o fetch de metadados de OG tags
  de lojas como Shopee/Amazon falha silenciosamente no navegador por causa de
  CORS (o app cai de volta para preenchimento manual do preço, igual ao
  Flutter original). No Capacitor isso pode ser resolvido trocando o `fetch`
  por `@capacitor/http` (`CapacitorHttp`), que não sofre a mesma restrição.
- O Web Share Target (`public/manifest.webmanifest` → `share_target`, lido em
  `src/services/shareTarget.ts`) é o equivalente ao `receive_sharing_intent`
  do Flutter, mas só funciona em PWA instalado via navegador. No Capacitor
  Android, o recebimento de "compartilhar com o app" precisa ser
  implementado nativamente (intent filter em `android/app/src/main/AndroidManifest.xml`
  + plugin, ex. `@capawesome/capacitor-android-share-target` ou similar) e
  então repassado para essa mesma função de parsing de URL.
- Notificações de garantia (`src/services/notificationService.ts`) usam a
  Notification API web crua; dentro do WebView isso é menos confiável do que
  o plugin `@capacitor/local-notifications`, que seria a próxima melhoria
  natural para esse recurso funcionar bem empacotado.
- `src/services/receiptOcrService.ts` (importar itens a partir de foto de
  nota fiscal) usa `tesseract.js`, que baixa o motor de OCR e o modelo de
  idioma de um CDN na primeira execução — precisa de rede nesse momento,
  mesma limitação do `linkMetadataService`. O reconhecimento de linhas
  (nome + preço) é heurístico por natureza de nota fiscal brasileira; por
  isso a tela sempre mostra os itens para revisão/edição antes de importar.

## Estrutura

```
src/
  db/         # schema Dexie + funções equivalentes a database.dart
  domain/     # labels.ts, storeDetector.ts (equivalentes ao pacote domain/ do Flutter)
  services/   # linkMetadataService.ts, shareTarget.ts, receiptOcrService.ts, reportService.ts
  state/      # useLiveQuery (equivalente aos StreamProviders do Riverpod)
  ui/         # App.tsx (shell + navegação) e telas em ui/screens, componentes em ui/components
```
