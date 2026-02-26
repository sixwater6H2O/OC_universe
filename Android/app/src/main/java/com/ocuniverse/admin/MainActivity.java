package com.ocuniverse.admin;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.widget.ProgressBar;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private NativeBridge nativeBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Fullscreen immersive
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress_bar);

        // Setup WebView
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Create and bind native bridge
        nativeBridge = new NativeBridge(this);
        webView.addJavascriptInterface(nativeBridge, "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Intercept /api/export calls and handle natively
                if (url.contains("/api/export")) {
                    nativeBridge.exportZip();
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject the Android bridge override script after page load
                injectBridgeScript();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }
        });

        // Load admin page from bundled assets
        webView.loadUrl("file:///android_asset/www/admin.html");
    }

    private void injectBridgeScript() {
        // Override saveData to use Android native bridge
        // Override export to use native ZIP
        // Add preview button functionality
        String js = "javascript:(function() {" +
            "if (window._androidBridgeInjected) return;" +
            "window._androidBridgeInjected = true;" +
            "console.log('Android Bridge injected successfully');" +

            // Override the fetch-based save: intercept fetch('/api/save')
            "var originalFetch = window.fetch;" +
            "window.fetch = function(url, options) {" +
            "  if (typeof url === 'string' && url === '/api/save' && options && options.method === 'POST') {" +
            "    return new Promise(function(resolve) {" +
            "      try {" +
            "        AndroidBridge.saveData(options.body);" +
            "        resolve(new Response(JSON.stringify({status:'success',msg:'Saved via Android'}), " +
            "          {status:200, headers:{'Content-Type':'application/json'}}));" +
            "      } catch(e) {" +
            "        resolve(new Response(JSON.stringify({status:'error',msg:e.message}), " +
            "          {status:500, headers:{'Content-Type':'application/json'}}));" +
            "      }" +
            "    });" +
            "  }" +
            "  return originalFetch.apply(this, arguments);" +
            "};" +

            // Override window.location.href for /api/export
            "var btnExport = document.getElementById('btn-export-full');" +
            "if (btnExport) {" +
            "  var oldListeners = btnExport.cloneNode(true);" +
            "  btnExport.parentNode.replaceChild(oldListeners, btnExport);" +
            "  oldListeners.addEventListener('click', function() {" +
            "    AndroidBridge.exportZip();" +
            "  });" +
            "}" +

            // Add a preview button in the data actions section
            "var dataActions = document.querySelector('.data-actions');" +
            "if (dataActions) {" +
            "  var previewBox = document.createElement('div');" +
            "  previewBox.className = 'action-box';" +
            "  previewBox.innerHTML = '<h3><i class=\"ri-eye-line\"></i> 前台预览</h3>" +
            "    <p>在应用内预览前台展示页面，使用当前编辑中的最新数据。</p>" +
            "    <button class=\"btn btn-primary mt-m\" id=\"btn-preview-html\">" +
            "      <i class=\"ri-external-link-line\"></i> 打开前台预览</button>';" +
            "  dataActions.insertBefore(previewBox, dataActions.firstChild);" +
            "  document.getElementById('btn-preview-html').addEventListener('click', function() {" +
            "    var app = document.querySelector('[data-admin-app]') || window._adminApp;" +
            "    var dataStr = localStorage.getItem('oc_universe_data') || '{}';" +
            "    AndroidBridge.previewHtml(dataStr);" +
            "  });" +
            "}" +
            "})()";

        webView.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
