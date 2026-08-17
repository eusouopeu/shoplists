package com.eusouopeu.shoplist;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Extrai nome/imagem/preço de uma página de produto carregando-a de verdade
 * num WebView invisível (JS executa, SPA renderiza) e lendo o DOM depois —
 * em vez de um fetch cru do HTML, que a Shopee e outras lojas bloqueiam ou
 * devolvem vazio por trás de proteção anti-bot/CORS (ver linkMetadataService.ts).
 * Só funciona no app nativo (Capacitor Android); no PWA web isso não é
 * possível por causa da mesma política de origem que já limita o fetch.
 */
@CapacitorPlugin(name = "LinkRenderer")
public class LinkRendererPlugin extends Plugin {

    private static final long RENDER_SETTLE_DELAY_MS = 1600;
    private static final long TIMEOUT_MS = 12000;

    // User-Agent de um Chrome Android comum, sem o marcador "; wv" que o
    // WebView embutido usa por padrão — esse marcador é frequentemente
    // usado por sites para detectar/bloquear navegadores embutidos em apps.
    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
            + "Chrome/128.0.0.0 Mobile Safari/537.36";

    private static final String EXTRACT_SCRIPT =
        "(function(){"
            + "function metaContent(p){"
            + "var el=document.querySelector('meta[property=\"'+p+'\"]')||document.querySelector('meta[name=\"'+p+'\"]');"
            + "return el?el.getAttribute('content'):null;"
            + "}"
            + "var nome=metaContent('og:title')||document.title||null;"
            + "var imagemUrl=metaContent('og:image');"
            + "var preco=null;"
            + "try{"
            + "var scripts=document.querySelectorAll('script[type=\"application/ld+json\"]');"
            + "for(var i=0;i<scripts.length&&preco==null;i++){"
            + "var data=JSON.parse(scripts[i].textContent);"
            + "var arr=Array.isArray(data)?data:[data];"
            + "for(var j=0;j<arr.length;j++){"
            + "var node=arr[j];"
            + "if(node&&node.offers){"
            + "var offers=Array.isArray(node.offers)?node.offers[0]:node.offers;"
            + "if(offers&&offers.price){preco=parseFloat(offers.price);break;}"
            + "}"
            + "}"
            + "}"
            + "}catch(e){}"
            + "if(preco==null){"
            + "var m=(document.body.innerText||'').match(/R\\$\\s?([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2})/);"
            + "if(m){preco=parseFloat(m[1].replace(/\\./g,'').replace(',', '.'));}"
            + "}"
            + "return {nome:nome,imagemUrl:imagemUrl,preco:preco};"
            + "})()";

    @PluginMethod
    public void renderAndExtract(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Parâmetro 'url' obrigatório");
            return;
        }
        getActivity().runOnUiThread(() -> startRender(call, url));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startRender(PluginCall call, String url) {
        WebView webView = new WebView(getContext());
        boolean[] resolved = { false };
        Handler handler = new Handler(Looper.getMainLooper());
        Runnable[] timeoutRunnable = new Runnable[1];

        Runnable cleanup = () -> {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) parent.removeView(webView);
            webView.stopLoading();
            webView.destroy();
        };

        timeoutRunnable[0] = () -> {
            if (resolved[0]) return;
            resolved[0] = true;
            cleanup.run();
            call.reject("Tempo esgotado ao carregar a página");
        };
        handler.postDelayed(timeoutRunnable[0], TIMEOUT_MS);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(USER_AGENT);

        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String finishedUrl) {
                    super.onPageFinished(view, finishedUrl);
                    // Espaço para o JS da SPA terminar de montar o conteúdo do
                    // produto — carregar a página não basta, o React/Vue da
                    // loja ainda precisa rodar depois do load.
                    handler.postDelayed(
                        () -> {
                            if (resolved[0]) return;
                            view.evaluateJavascript(
                                EXTRACT_SCRIPT,
                                (value) -> {
                                    if (resolved[0]) return;
                                    resolved[0] = true;
                                    handler.removeCallbacks(timeoutRunnable[0]);
                                    resolveFromJs(call, value);
                                    cleanup.run();
                                }
                            );
                        },
                        RENDER_SETTLE_DELAY_MS
                    );
                }
            }
        );

        // Precisa estar anexado à árvore de views (mesmo que 1x1px e
        // invisível) para o WebView renderizar/rodar timers como um
        // navegador de verdade em vez de ficar suspenso em segundo plano.
        ViewGroup root = (ViewGroup) getActivity().getWindow().getDecorView();
        root.addView(webView, new ViewGroup.LayoutParams(1, 1));

        webView.loadUrl(url);
    }

    private void resolveFromJs(PluginCall call, String jsResult) {
        JSObject result = new JSObject();
        try {
            JSONObject json = new JSONObject(jsResult);
            result.put("nome", json.isNull("nome") ? null : json.getString("nome"));
            result.put("imagemUrl", json.isNull("imagemUrl") ? null : json.getString("imagemUrl"));
            result.put("preco", json.isNull("preco") ? null : json.getDouble("preco"));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Falha ao interpretar o resultado da página", e);
        }
    }
}
