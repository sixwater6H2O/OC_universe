package com.ocuniverse.admin;

import android.os.Bundle;
import android.view.MenuItem;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Shows the index.html frontend preview with the latest saved data injected.
 */
public class PreviewActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(this);
        setContentView(webView);

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle("前台预览");
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectData(view);
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void injectData(WebView webView) {
        // Read saved data from internal storage
        String dataJson = "";
        File dataFile = new File(getFilesDir(), "data.json");
        if (dataFile.exists()) {
            try {
                FileInputStream fis = new FileInputStream(dataFile);
                byte[] bytes = new byte[(int) dataFile.length()];
                fis.read(bytes);
                fis.close();
                dataJson = new String(bytes, StandardCharsets.UTF_8);
            } catch (IOException e) {
                // Use default data from assets
            }
        }

        if (!dataJson.isEmpty()) {
            // Override the fetch('data.json') call by injecting data directly
            String escapedData = dataJson
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "");

            String js = "javascript:(function() {" +
                "var injectedData = JSON.parse('" + escapedData + "');" +
                "if (typeof UniverseData !== 'undefined') {" +
                "  UniverseData.setFromFetch(injectedData);" +
                "  UniverseData.save(injectedData);" +
                "}" +
                "})()";
            webView.evaluateJavascript(js, null);
        }
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
