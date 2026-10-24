package br.gui.painelsala;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Painel da Sala — wrapper Android TV.
 * WebView em tela cheia que carrega o site publicado. O painel (PS.voltarNativo) decide o que o botão Voltar faz.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://guilhermeromio-netto-prog.github.io/painel-sala/";
    static final String HOST_HOME = "guilhermeromio-netto-prog.github.io";
    static final String OFFLINE = "file:///android_asset/offline.html";
    static final int REQ_ARQUIVO = 7;

    private WebView web;
    private FrameLayout raiz;
    private View telaCheia;
    private WebChromeClient.CustomViewCallback telaCheiaCb;
    private ValueCallback<Uri[]> escolhedor;
    private final Handler h = new Handler();
    private boolean offlineMostrando = false;
    private boolean voltaLonga = false;

    private final Runnable tentarDeNovo = new Runnable() {
        @Override public void run() {
            if (offlineMostrando) {
                if (temRede()) { offlineMostrando = false; web.loadUrl(HOME); }
                else h.postDelayed(this, 8000);
            }
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(0xFF0A0A0A);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0A0A);
        raiz.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(raiz);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          /* localStorage persiste entre execuções */
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(true);            /* só para offline.html dos assets */
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " PainelSalaApp/1.0");
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                boolean ok = permitido(r.getUrl());
                if (ok) { offlineMostrando = false; }
                return !ok;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) mostrarOffline();
            }
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                recreate();                    /* evita travar se o processo do WebView morrer */
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) { v.requestFocus(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback cb) {   /* vídeo em tela cheia (YouTube) */
                if (telaCheia != null) { cb.onCustomViewHidden(); return; }
                telaCheia = view; telaCheiaCb = cb;
                raiz.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() { sairTelaCheia(); }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (escolhedor != null) escolhedor.onReceiveValue(null);
                escolhedor = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "Escolher arquivo"), REQ_ARQUIVO);
                } catch (ActivityNotFoundException e) {
                    escolhedor = null; cb.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Nenhum gerenciador de arquivos nesta TV. Use o link de configuração.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest r) { r.deny(); }
            @Override public boolean onConsoleMessage(ConsoleMessage m) { return false; }
        });

        if (temRede()) web.loadUrl(HOME); else mostrarOffline();
    }

    /** Navegação do topo: https em qualquer site (atalhos editáveis, ex. YouTube); outros esquemas ficam bloqueados. */
    private boolean permitido(Uri u) {
        String esq = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        if (esq.equals("https")) return true;
        if (esq.equals("file") && OFFLINE.equals(u.toString())) return true;
        if (esq.equals("http")) {                 /* tenta a versão https do mesmo endereço */
            final String https = u.buildUpon().scheme("https").build().toString();
            h.post(new Runnable() { @Override public void run() { web.loadUrl(https); } });
            return false;
        }
        Toast.makeText(this, "Link não suportado: " + esq, Toast.LENGTH_SHORT).show();
        return false;
    }

    private boolean noPainel() {
        String u = web.getUrl();
        if (u == null) return false;
        try { return HOST_HOME.equalsIgnoreCase(Uri.parse(u).getHost()); } catch (Exception e) { return false; }
    }

    private boolean temRede() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Exception e) { return true; }
    }

    private void mostrarOffline() {
        if (offlineMostrando) return;
        offlineMostrando = true;
        web.loadUrl(OFFLINE);
        h.removeCallbacks(tentarDeNovo);
        h.postDelayed(tentarDeNovo, 8000);
    }

    private void sairTelaCheia() {
        if (telaCheia == null) return;
        raiz.removeView(telaCheia);
        telaCheia = null;
        web.setVisibility(View.VISIBLE);
        if (telaCheiaCb != null) telaCheiaCb.onCustomViewHidden();
        telaCheiaCb = null;
        web.requestFocus();
    }

    /** Voltar: vídeo em tela cheia -> fecha; painel -> PS.voltarNativo() ('sair' fecha o app); outro site -> histórico, senão painel. */
    private void aoVoltar() {
        if (telaCheia != null) { sairTelaCheia(); return; }
        if (offlineMostrando) { finish(); return; }
        if (noPainel()) {
            web.evaluateJavascript("(function(){try{return String(PS.voltarNativo());}catch(e){return 'sair';}})()", new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    if (v != null && v.contains("sair")) finish();
                }
            });
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            web.loadUrl(HOME);
        }
    }

    @Override public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) { e.startTracking(); return true; }
        return super.onKeyDown(code, e);
    }
    @Override public boolean onKeyLongPress(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) {      /* Voltar longo: volta direto ao painel, de qualquer site */
            voltaLonga = true;
            if (telaCheia != null) sairTelaCheia();
            offlineMostrando = false;
            web.loadUrl(HOME);
            return true;
        }
        return super.onKeyLongPress(code, e);
    }
    @Override public boolean onKeyUp(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) {
            if (voltaLonga) { voltaLonga = false; return true; }
            if (!e.isCanceled()) aoVoltar();
            return true;
        }
        return super.onKeyUp(code, e);
    }
    @Override public void onBackPressed() { aoVoltar(); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_ARQUIVO && escolhedor != null) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[] { data.getData() };
            escolhedor.onReceiveValue(r);
            escolhedor = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override public void onWindowFocusChanged(boolean f) {
        super.onWindowFocusChanged(f);
        if (f) imersivo();
    }
    private void imersivo() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override protected void onResume() { super.onResume(); web.onResume(); web.requestFocus(); imersivo(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { h.removeCallbacksAndMessages(null); web.destroy(); super.onDestroy(); }
}
