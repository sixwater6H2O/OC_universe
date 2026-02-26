package com.ocuniverse.admin;

import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private NativeBridge nativeBridge;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILE_CHOOSER_RESULT = 1;

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

            // --- CRITICAL: File Upload Support ---
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Load admin page from bundled assets
        webView.loadUrl("file:///android_asset/www/admin.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_RESULT) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    private void injectBridgeScript() {
        // Override saveData to use Android native bridge
        // Override export to use native ZIP
        // Add preview button functionality
        // INJECT UI PATCH for Dark Visibility and Section Switching
        String js = "javascript:(function() {" +
            "if (window._androidBridgeInjected) return;" +
            "window._androidBridgeInjected = true;" +
            "console.log('Android Bridge injected successfully');" +

            // UI PATCH: Inject CSS to fix visibility and force LIGHT THEME (as per web version)
            "var style = document.createElement('style');" +
            "style.innerHTML = '" +
            "  .admin-theme { background-color: #f1f5f9 !important; color: #334155 !important; }" +
            "  .admin-sidebar { background: #ffffff !important; border-right-color: #e2e8f0 !important; }" +
            "  .admin-card { background: #ffffff !important; border-color: #e2e8f0 !important; color: #334155 !important; }" +
            "  .form-control { background: #ffffff !important; border-color: #cbd5e1 !important; color: #333333 !important; }" +
            "  .admin-section { display: none !important; }" +
            "  .admin-section.active { display: block !important; }" +
            "  .rich-toolbar { background: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #475569 !important; }" +
            "  .rich-toolbar .tool-btn { color: #475569 !important; }" +
            "  .rich-toolbar .tool-btn:hover { color: #0ea5e9 !important; }" +
            "  .admin-nav li a { color: #64748b !important; }" +
            "  .admin-nav li a.active { color: #0ea5e9 !important; background: #f8fafc !important; }" +
            "  .section-header h2 { color: #0f172a !important; }" +
            "';" +
            "document.head.appendChild(style);" +

            // Override the fetch-based save: intercept fetch('/api/save')
            "var originalFetch = window.fetch;" +
            "window.fetch = function(url, options) {" +
            "  if (typeof url === 'string' && url === '/api/save' && options && options.method === 'POST') {" +
            "    return new Promise(function(resolve) {" +
            "      try {" +
            "        AndroidBridge.saveData(options.body);" +
            "        resolve(new Response(JSON.stringify({status:\"success\",msg:\"Saved via Android\"}), " +
            "          {status:200, headers:{\"Content-Type\":\"application/json\"}}));" +
            "      } catch(e) {" +
            "        resolve(new Response(JSON.stringify({status:\"error\",msg:e.message}), " +
            "          {status:500, headers:{\"Content-Type\":\"application/json\"}}));" +
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
            "  previewBox.style.borderColor = 'var(--border-color)';" +
            "  previewBox.innerHTML = '<h3><i class=\"ri-eye-line\"></i> 前台预览</h3>" +
            "    <p>在应用内预览前台展示页面，使用当前编辑中的最新数据。</p>" +
            "    <button class=\"btn btn-primary mt-m\" id=\"btn-preview-html\">" +
            "      <i class=\"ri-external-link-line\"></i> 打开前台预览</button>';" +
            "  dataActions.insertBefore(previewBox, dataActions.firstChild);" +
            "  document.getElementById('btn-preview-html').addEventListener('click', function() {" +
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
