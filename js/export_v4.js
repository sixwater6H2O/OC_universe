/**
 * OC Universe Export Service
 * Collects project resources and dynamic data into a pure ZIP package.
 */
const ExportService = {
    async exportZIP(data) {
        console.log('Starting export process...');
        const zip = new JSZip();

        const coreFilesMap = {
            'index.html': 'index.html',
            'style.css': 'style.css',
            'style_v2.css': 'style_v2.css',
            'js/app_v4.js': 'js/app_v4.js',
            'js/storage_v4.js': 'js/storage_v4.js',
            'img/icon.svg': 'img/icon.svg'
        };

        const themes = [
            'theme-ancient.css',
            'theme-cyberpunk.css',
            'theme-default.css',
            'theme-detective.css',
            'theme-fantasy.css',
            'theme-kamen-rubik.css',
            'theme-minimal.css',
            'theme-stationery.css'
        ];

        let useFileSystemFallback = false;

        // 1. Attempt standard fetch (Works on GitHub Pages, http://localhost)
        try {
            const testResp = await fetch('index.html');
            if (!testResp.ok) throw new Error("Fetch failed");

            // Standard Web Fetch Path
            for (const [source, dest] of Object.entries(coreFilesMap)) {
                try {
                    const resp = await fetch(`${source}?v=${Date.now()}`);
                    if (resp.ok) {
                        let content = await resp.text();
                        // 拦截 storage.js 并注入最新数据内存以支持 file:// 环境
                        if (dest === 'js/storage_v4.js') {
                            content = `window.OC_EXPORTED_DATA = ${JSON.stringify(data, null, 2)};\n\n` + content;
                        }
                        zip.file(dest, content);
                    }
                } catch (e) {
                    console.warn(`Could not fetch ${source}:`, e);
                }
            }

            const themesFolder = zip.folder('themes');
            for (const theme of themes) {
                try {
                    const resp = await fetch(`themes/${theme}?v=${Date.now()}`);
                    if (resp.ok) themesFolder.file(theme, await resp.blob());
                } catch (e) {
                    console.warn(`Failed to package theme ${theme}:`, e);
                }
            }
        } catch (e) {
            console.warn('Fetch API blocked (likely file:// protocol). Falling back to Local File System API.');
            useFileSystemFallback = true;
        }

        // 2. Fallback using File System Access API for local desktop
        if (useFileSystemFallback) {
            if (!window.showDirectoryPicker) {
                alert("打包静态文件遇到安全限制！\n目前您正试图在本地直接双击打开（file://）并导出压缩包，但手机/当前浏览器不支持本地文件夹授权读取。\n请将项目部署至 GitHub Pages 或使用本地服务器运行 admin.html 即可完美导出。");
                // Will still generate ZIP containing JSON and DB Images later
            } else {
                try {
                    alert("【本地环境受限】\n由于直接双击 HTML 会触发浏览器安全限制，无法自动收集 index.html 和样式。\n请在接下来的弹窗中，选中您当前的 OC 项目根文件夹以授权打包系统读取这些静态文件。");
                    const dirHandle = await window.showDirectoryPicker();

                    // Fetch Core Files manually
                    for (const [source, dest] of Object.entries(coreFilesMap)) {
                        try {
                            const pathParts = source.split('/');
                            let currentHandle = dirHandle;
                            for (let i = 0; i < pathParts.length - 1; i++) {
                                currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
                            }
                            const fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1]);
                            const fileData = await fileHandle.getFile();

                            if (dest === 'js/storage_v4.js') {
                                let content = await fileData.text();
                                content = `window.OC_EXPORTED_DATA = ${JSON.stringify(data, null, 2)};\n\n` + content;
                                zip.file(dest, content);
                            } else {
                                zip.file(dest, fileData);
                            }
                        } catch (err) {
                            console.warn(`Fallback: Failed to read ${source}`, err);
                        }
                    }

                    // Fetch Themes manually
                    try {
                        const themesDirHandle = await dirHandle.getDirectoryHandle('themes');
                        const themesFolder = zip.folder('themes');
                        for (const theme of themes) {
                            try {
                                const fileHandle = await themesDirHandle.getFileHandle(theme);
                                const fileData = await fileHandle.getFile();
                                themesFolder.file(theme, fileData);
                            } catch (err) { }
                        }
                    } catch (err) {
                        console.warn('Fallback: themes folder not found or denied', err);
                    }

                } catch (err) {
                    console.error('Directory picker cancelled or failed:', err);
                    alert("已取消授权。导出的压缩包将只包含新编辑的数据和图片，不包含前台网页组件。");
                }
            }
        }

        // 3. Add data.json (The latest state from IndexedDB)
        const dataJson = JSON.stringify(data, null, 2);
        zip.file('js/data.json', dataJson);

        // 4. Add Images from IndexedDB (Assets)
        const imgFolder = zip.folder('img');
        try {
            const db = await StorageService.initDB();
            const tx = db.transaction(StorageService.STORE_ASSETS, 'readonly');
            const store = tx.objectStore(StorageService.STORE_ASSETS);
            const keys = await new Promise((resolve, reject) => {
                const req = store.getAllKeys();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            for (const key of keys) {
                const blob = await StorageService.getAsset(key);
                if (blob) {
                    imgFolder.file(key, blob);
                }
            }
        } catch (e) {
            console.error('Failed to export binary assets:', e);
        }

        // 5. Finalize and Download
        console.log('Generating ZIP file...');
        try {
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `OC_Universe_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Export complete!');
        } catch (e) {
            console.error('ZIP generation failed:', e);
            alert('生成压缩包失败，请检查控制台。');
        }
    }
};
