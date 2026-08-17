package com.eusouopeu.shoplist;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte entre o Intent ACTION_SEND que o Android entrega quando o usuário
 * usa "Compartilhar" (ex.: de dentro do app da Shopee) escolhendo o
 * Shoplist, e o app web (Preact) rodando dentro do WebView. A MainActivity
 * chama {@link #deliver} tanto no cold start (onCreate) quanto quando o app
 * já está em primeiro plano (onNewIntent).
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    private static ShareIntentPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void deliver(String text) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("text", text);
        // retainUntilConsumed=true: se o JS ainda não montou o listener
        // (cold start, WebView ainda carregando o app), o Capacitor guarda
        // o evento e entrega assim que addListener for chamado.
        instance.notifyListeners("sharedTextReceived", data, true);
    }
}
