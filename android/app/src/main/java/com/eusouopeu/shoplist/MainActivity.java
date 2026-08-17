package com.eusouopeu.shoplist;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LinkRendererPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    /** Trata o Intent recebido quando o usuário compartilha um link (ex.:
     * "Compartilhar" no app da Shopee → Shoplist) tanto no cold start
     * quanto com o app já aberto (singleTask). */
    private void handleShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (sharedText == null || sharedText.isEmpty()) return;
        ShareIntentPlugin.deliver(sharedText);
    }
}
