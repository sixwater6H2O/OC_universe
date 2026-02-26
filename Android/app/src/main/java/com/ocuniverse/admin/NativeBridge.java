package com.ocuniverse.admin;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * JavaScript ↔ Android Native Bridge
 * Provides saveData, loadData, exportZip, previewHtml to the WebView JS context.
 */
public class NativeBridge {

    private final Context context;
    private static final String DATA_FILE = "data.json";

    public NativeBridge(Context context) {
        this.context = context;
    }

    /**
     * Save JSON data to app's internal storage.
     * Called from JS: AndroidBridge.saveData(jsonString)
     */
    @JavascriptInterface
    public void saveData(String jsonString) {
        try {
            FileOutputStream fos = context.openFileOutput(DATA_FILE, Context.MODE_PRIVATE);
            fos.write(jsonString.getBytes(StandardCharsets.UTF_8));
            fos.close();
            showToast("数据已保存到本地");
        } catch (IOException e) {
            showToast("保存失败: " + e.getMessage());
        }
    }

    /**
     * Load JSON data from app's internal storage.
     * Returns the JSON string, or empty string if not found.
     * Called from JS: AndroidBridge.loadData()
     */
    @JavascriptInterface
    public String loadData() {
        File file = new File(context.getFilesDir(), DATA_FILE);
        if (!file.exists()) return "";
        try {
            FileInputStream fis = new FileInputStream(file);
            byte[] bytes = new byte[(int) file.length()];
            fis.read(bytes);
            fis.close();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    /**
     * Export a complete website ZIP package and share it.
     * Called from JS: AndroidBridge.exportZip()
     */
    @JavascriptInterface
    public void exportZip() {
        try {
            // Create export directory
            File exportDir = new File(context.getCacheDir(), "exports");
            if (!exportDir.exists()) exportDir.mkdirs();

            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File zipFile = new File(exportDir, "oc_universe_build_" + timestamp + ".zip");

            ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipFile));

            // 1. Add web assets from bundled files
            String[] webFiles = {
                "admin.html", "index.html", "style.css", "style_v2.css",
                "js/app.js", "js/data.js", "js/admin.js",
                "themes/theme-ancient.css", "themes/theme-cyberpunk.css",
                "themes/theme-default.css", "themes/theme-detective.css",
                "themes/theme-fantasy.css", "themes/theme-kamen-rubik.css",
                "themes/theme-minimal.css", "themes/theme-stationery.css"
            };

            for (String filePath : webFiles) {
                try {
                    InputStream is = context.getAssets().open("www/" + filePath);

                    // For data.js, inject current data into defaultOCData
                    if (filePath.equals("js/data.js")) {
                        String content = readStream(is);
                        is.close();

                        // Read current data
                        String currentData = loadData();
                        if (!currentData.isEmpty()) {
                            content = content.replaceFirst(
                                "const defaultOCData = [\\s\\S]*?(?=\\n// 数据状态模块)",
                                "const defaultOCData = " + currentData + ";\n\n"
                            );
                        }
                        addStringToZip(zos, filePath, content);
                    } else {
                        addStreamToZip(zos, filePath, is);
                        is.close();
                    }
                } catch (IOException e) {
                    // Skip missing assets silently
                }
            }

            // 2. Add current data.json from internal storage
            File dataFile = new File(context.getFilesDir(), DATA_FILE);
            if (dataFile.exists()) {
                addStreamToZip(zos, "data.json", new FileInputStream(dataFile));
            }

            // 3. Add img/ assets
            try {
                String[] imgFiles = context.getAssets().list("www/img");
                if (imgFiles != null) {
                    for (String imgFile : imgFiles) {
                        try {
                            InputStream is = context.getAssets().open("www/img/" + imgFile);
                            addStreamToZip(zos, "img/" + imgFile, is);
                            is.close();
                        } catch (IOException e) {
                            // skip
                        }
                    }
                }
            } catch (IOException e) {
                // No img folder in assets
            }

            zos.close();

            // Share the ZIP file
            Uri contentUri = FileProvider.getUriForFile(context,
                context.getPackageName() + ".fileprovider", zipFile);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(Intent.createChooser(shareIntent, "导出发布版 ZIP")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));

            showToast("ZIP 打包完成！请选择保存位置。");

        } catch (IOException e) {
            showToast("导出失败: " + e.getMessage());
        }
    }

    /**
     * Open HTML preview with current data.
     * Called from JS: AndroidBridge.previewHtml(dataJsonString)
     */
    @JavascriptInterface
    public void previewHtml(String dataJsonString) {
        // Save current data first so preview can load it
        if (dataJsonString != null && !dataJsonString.isEmpty()) {
            saveData(dataJsonString);
        }
        Intent intent = new Intent(context, PreviewActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    // --- Helper Methods ---

    private void showToast(final String message) {
        android.os.Handler handler = new android.os.Handler(context.getMainLooper());
        handler.post(() -> Toast.makeText(context, message, Toast.LENGTH_SHORT).show());
    }

    private String readStream(InputStream is) throws IOException {
        byte[] buffer = new byte[is.available()];
        is.read(buffer);
        return new String(buffer, StandardCharsets.UTF_8);
    }

    private void addStreamToZip(ZipOutputStream zos, String entryName, InputStream is) throws IOException {
        zos.putNextEntry(new ZipEntry(entryName));
        byte[] buffer = new byte[4096];
        int len;
        BufferedInputStream bis = new BufferedInputStream(is);
        while ((len = bis.read(buffer)) > 0) {
            zos.write(buffer, 0, len);
        }
        zos.closeEntry();
    }

    private void addStringToZip(ZipOutputStream zos, String entryName, String content) throws IOException {
        zos.putNextEntry(new ZipEntry(entryName));
        zos.write(content.getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
    }
}
