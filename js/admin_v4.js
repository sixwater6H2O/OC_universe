/* --- GLOBAL ERROR CATCHER --- */
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error("【运行时错误】\n信息: " + msg + "\n行号: " + lineNo);
    return false;
};

/* --- V3.6 Rich Text Editor Toolbar Logic --- */
const RICH_TOOLBAR_HTML = `
<div class="rich-toolbar">
    <button type="button" class="tool-btn" data-action="bold" title="加粗"><i class="ri-bold"></i></button>
    <button type="button" class="tool-btn" data-action="italic" title="斜体"><i class="ri-italic"></i></button>
    <button type="button" class="tool-btn" data-action="strike" title="删除线"><i class="ri-strikethrough"></i></button>
    <button type="button" class="tool-btn" data-action="underline" title="下划线"><i class="ri-underline"></i></button>
    <span class="tool-divider"></span>
    <button type="button" class="tool-btn" data-action="h2" title="大标题"><i class="ri-h-1"></i></button>
    <button type="button" class="tool-btn" data-action="h3" title="小标题"><i class="ri-h-2"></i></button>
    <span class="tool-divider"></span>
    <button type="button" class="tool-btn" data-action="align-left" title="居左"><i class="ri-align-left"></i></button>
    <button type="button" class="tool-btn" data-action="align-center" title="居中"><i class="ri-align-center"></i></button>
    <button type="button" class="tool-btn" data-action="align-right" title="居右"><i class="ri-align-right"></i></button>
    <span class="tool-divider"></span>
    <button type="button" class="tool-btn" data-action="spoiler" title="黑块防剧透"><i class="ri-eye-off-line"></i></button>
    <span class="tool-divider"></span>
    <button type="button" class="tool-btn" style="color: #ef4444;" data-action="color" data-val="red" title="红色字"><i class="ri-palette-line"></i></button>
    <button type="button" class="tool-btn" style="color: #0f172a;" data-action="color" data-val="black" title="黑色字"><i class="ri-palette-line"></i></button>
    <button type="button" class="tool-btn" style="color: #e2e8f0;" data-action="color" data-val="white" title="白色字"><i class="ri-palette-line"></i></button>
    <div class="color-picker-wrapper" title="自定义颜色">
        <input type="color" class="custom-color-picker" value="#000000">
    </div>
    <span class="tool-divider"></span>
    <button type="button" class="tool-btn" data-action="image" title="插入图片"><i class="ri-image-add-line"></i></button>
    <button type="button" class="tool-btn" data-action="audio" title="插入音频"><i class="ri-music-2-line"></i></button>
    <button type="button" class="tool-btn" data-action="video" title="插入视频"><i class="ri-video-add-line"></i></button>
</div>
`;

/**
 * Enhanced injectText to support Browser Undo (Ctrl+Z) natively
 */
function injectText(textarea, prefix, suffix = '') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = textarea.value;
    const selectedText = originalText.substring(start, end);
    const replacement = prefix + selectedText + suffix;

    textarea.focus();
    // Use execCommand for true native undo stack integration
    const success = document.execCommand('insertText', false, replacement);

    // Fallback if execCommand fails (very rare in modern browsers for textareas)
    if (!success) {
        textarea.setRangeText(replacement, start, end, 'select');
        textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }

    // Re-adjust selection to be inside the tags if no text was selected
    if (start === end) {
        const newCursorPos = start + prefix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
}

function bindToolbarEvents(toolbar, textarea) {
    toolbar.querySelectorAll('.tool-btn').forEach(function (btn) {
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var action = btn.getAttribute('data-action');
            var val = btn.getAttribute('data-val');

            switch (action) {
                case 'bold': injectText(textarea, '**', '**'); break;
                case 'italic': injectText(textarea, '*', '*'); break;
                case 'strike': injectText(textarea, '~~', '~~'); break;
                case 'underline': injectText(textarea, '<u>', '</u>'); break;
                case 'h2': injectText(textarea, '\n## ', '\n'); break;
                case 'h3': injectText(textarea, '\n### ', '\n'); break;
                case 'align-left': injectText(textarea, '<div style="text-align: left;">\n', '\n</div>'); break;
                case 'align-center': injectText(textarea, '<div style="text-align: center;">\n', '\n</div>'); break;
                case 'align-right': injectText(textarea, '<div style="text-align: right;">\n', '\n</div>'); break;
                case 'spoiler': injectText(textarea, '||', '||'); break;
                case 'color':
                    injectText(textarea, '<span style="color: ' + val + ';">', '</span>');
                    break;
                case 'image':
                    openMediaModal('image', textarea);
                    break;
                case 'audio':
                    openMediaModal('audio', textarea);
                    break;
                case 'video':
                    openMediaModal('video', textarea);
                    break;
            }
        });
    });

    var colorPicker = toolbar.querySelector('.custom-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', function (e) {
            injectText(textarea, '<span style="color: ' + e.target.value + ';">', '</span>');
        });
    }
}

function setupRichTextToolbars(selector = '#w-desc, #edit-t-desc, #edit-me-content, #edit-n-content') {
    const textareas = document.querySelectorAll(selector);
    textareas.forEach(ta => {
        if (ta.classList.contains('textarea-with-toolbar')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'toolbar-textarea-wrapper';
        ta.parentNode.insertBefore(wrapper, ta);
        wrapper.innerHTML = RICH_TOOLBAR_HTML;

        const toolbar = wrapper.firstElementChild;
        wrapper.appendChild(ta);

        ta.classList.add('textarea-with-toolbar');
        bindToolbarEvents(toolbar, ta);
    });
}

/**
 * Universal Media Modal handling (Images, Audio, Video)
 */
function openMediaModal(type, targetTextarea) {
    const modal = document.getElementById('modal-insert-media');
    const titleEl = document.getElementById('media-modal-title');
    const typeInput = document.getElementById('media-modal-type');
    const inputLocal = document.getElementById('media-local-input');
    const inputUrl = document.getElementById('media-url-input');

    // Reset fields
    inputLocal.value = '';
    inputUrl.value = '';
    typeInput.value = type;

    // Set UI hints
    let acceptFormat = '*/*';
    if (type === 'image') {
        titleEl.textContent = '插入图片';
        acceptFormat = 'image/*';
    } else if (type === 'audio') {
        titleEl.textContent = '插入音频';
        acceptFormat = 'audio/*';
    } else if (type === 'video') {
        titleEl.textContent = '插入视频';
        acceptFormat = 'video/*';
    }
    inputLocal.setAttribute('accept', acceptFormat);

    // Setup Tabs
    const tabBtnLocal = document.getElementById('tab-btn-local');
    const tabBtnUrl = document.getElementById('tab-btn-url');
    const tabLocal = document.getElementById('media-tab-local');
    const tabUrl = document.getElementById('media-tab-url');

    tabBtnLocal.onclick = () => {
        tabBtnLocal.classList.add('active');
        tabBtnUrl.classList.remove('active');
        tabLocal.style.display = 'block';
        tabUrl.style.display = 'none';
        inputUrl.value = ''; // clear url
    };
    tabBtnUrl.onclick = () => {
        tabBtnUrl.classList.add('active');
        tabBtnLocal.classList.remove('active');
        tabUrl.style.display = 'block';
        tabLocal.style.display = 'none';
        inputLocal.value = ''; // clear local
    };

    // Default to local tab
    tabBtnLocal.click();

    // Show Modal
    modal.classList.add('open');

    // Handle Insert Action (needs to capture the targetTextarea locally to the closure)
    const btnInsert = document.getElementById('btn-insert-media');

    // Clean up old events to prevent multiple inserts
    const newBtnInsert = btnInsert.cloneNode(true);
    btnInsert.parentNode.replaceChild(newBtnInsert, btnInsert);

    newBtnInsert.addEventListener('click', async () => {
        let finalUrl = '';

        if (tabBtnLocal.classList.contains('active')) {
            // Process Local File
            const files = inputLocal.files;
            if (files && files.length > 0) {
                const file = files[0];
                // USE SERVERLESS STORAGE (IndexedDB Blobs)
                try {
                    const ext = file.name.split('.').pop();
                    const newName = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                    await StorageService.saveAsset(newName, file);
                    const localUrl = URL.createObjectURL(file);
                    finalUrl = `img/${newName}`; // We store the logic path

                    // For immediate preview in the editor without re-resolving:
                    // We can return the localUrl for injection, but the JSON data will keep the finalUrl.
                    // Actually, let's just use localUrl for injection for instant feedback.
                    injectText(targetTextarea, type === 'image' ? `<img src="${localUrl}" alt="图片" data-path="${finalUrl}">` : `<${type} src="${localUrl}">`, '');
                    finalUrl = ''; // Mark as handled
                } catch (err) {
                    console.error("Binary asset storage failed:", err);
                    alert("保存本地资源失败: " + err.message);
                    return;
                }
            } else {
                alert("请先选择一个文件");
                return;
            }
        } else {
            // Process URL
            finalUrl = inputUrl.value.trim();
            if (!finalUrl) {
                alert("请输入有效的 URL");
                return;
            }
        }

        // Action the insertion based on type
        if (finalUrl) {
            if (type === 'image') {
                injectText(targetTextarea, `<img src="${finalUrl}" alt="图片">\n<figcaption>图片说明</figcaption>\n`, '');
            } else if (type === 'audio') {
                injectText(targetTextarea, `\n<audio controls><source src="${finalUrl}"></audio>\n`, '');
            } else if (type === 'video') {
                injectText(targetTextarea, `\n<video controls><source src="${finalUrl}"></video>\n<figcaption>视频说明</figcaption>\n`, '');
            }
        }

        modal.classList.remove('open');
    });
}

class AdminPanel {
    constructor() {
        this.data = null;
        // State for editing
        this.currentEditId = null;
        this.tempRelations = []; // Temp state for relationships
        this.currentModId = null;
        this.currentEntryId = null;
    }

    async init() {
        console.log("【管理员系统启动】JS 文件加载成功，正在连接数据库...");
        window.OC_ADMIN_DEBUG_VERSION = "3.6.4-CLEAN";

        try {
            console.log('AdminPanel: Loading data...');
            this.data = await StorageService.load();
            console.log("数据库读取完成。当前标题为: " + (this.data.siteSettings?.title || "未设置"));

            // Pre-resolve internal assets (Don't let this block the entire UI if possible, but keep it for preview)
            try {
                console.log('AdminPanel: Resolving assets...');
                await this.resolveAssets();
                console.log('AdminPanel: Assets resolved');
            } catch (e) {
                console.warn('AdminPanel: Asset resolution failed, carrying on...', e);
            }

            console.log('AdminPanel: Binding events...');
            this.bindNav();
            this.bindSettingsForm();
            this.bindWorldForm();
            this.bindDataActions();

            // Setup mobile sidebar toggle
            const mobileBtn = document.getElementById('admin-mobile-menu-btn');
            if (mobileBtn) {
                mobileBtn.addEventListener('click', () => {
                    const sidebar = document.querySelector('.admin-sidebar');
                    if (sidebar) sidebar.classList.toggle('open');
                });
            }

            // Setup Global Save Button
            const globalSaveBtn = document.getElementById('btn-global-save');
            if (globalSaveBtn) {
                globalSaveBtn.addEventListener('click', async () => {
                    await this.saveData();
                    alert("所有更改已保存至本浏览器缓存！");
                });
            }

            // Initial Renders
            console.log('AdminPanel: Rendering sections...');
            this.renderSettingsForm();
            this.renderWorldForm();
            this.renderModuleList();
            this.renderCharList();
            this.renderTimelineList();
            this.renderCategoryList();
            this.renderNovelList();

            // Bind Modal logic for specific sections
            this.bindCharModals();
            this.bindTimelineModals();
            this.bindNovelModals();
            this.bindGlobalModalsClose();
            this.bindEntryModal();

            // Setup Toolbar
            setupRichTextToolbars();

            // Check local folder auth on startup
            this.checkFolderAuth();

            console.log('AdminPanel: Initialization complete!');
        } catch (err) {
            console.error('AdminPanel: Critical initialization error:', err);
            alert('后台管理界面初始化失败，请检查浏览器控制台 (F12) 的错误流。');
        }
    }

    async resolveAssets() {
        this.resolvedCache = new Map();
        const resolve = async (url) => {
            if (typeof url === 'string' && url.startsWith('img/')) {
                const res = await StorageService.resolveImageUrl(url);
                this.resolvedCache.set(url, res);
                return res;
            }
            return url;
        };

        if (this.data.worldView) {
            await resolve(this.data.worldView.coverImage);
        }

        if (this.data.characters) {
            for (let char of this.data.characters) {
                if (Array.isArray(char.avatar)) {
                    for (let img of char.avatar) {
                        await resolve(img);
                    }
                } else if (char.avatar) {
                    // Try to catch stringified array case to resolve correctly initially
                    if (typeof char.avatar === 'string' && char.avatar.startsWith('[')) {
                        try {
                            const arr = JSON.parse(char.avatar);
                            for (let img of arr) await resolve(img);
                        } catch (e) { }
                    } else {
                        await resolve(char.avatar);
                    }
                }
            }
        }
    }

    getResolved(url) {
        if (!url) return '';
        return this.resolvedCache?.get(url) || url;
    }

    // Unified Root Directory Authorization (No longer needed, but kept for structural compatibility)
    async checkFolderAuth() {
        const modal = document.getElementById('modal-init-auth');
        if (modal) {
            modal.classList.remove('open');
            modal.style.display = 'none';
        }
    }

    /* --- Navigation --- */
    bindNav() {
        document.querySelectorAll('.admin-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.admin-nav a').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                const target = link.getAttribute('data-target');
                document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(target).classList.add('active');

                // Force close sidebar on mobile after clicking
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.admin-sidebar');
                    if (sidebar) sidebar.classList.remove('open');
                }
            });
        });
    }

    /* --- Utilities --- */
    async saveData() {
        try {
            await StorageService.save(this.data);
            console.log("Successfully saved to IndexedDB");
        } catch (err) {
            console.error("Failed to save to local storage:", err);
            alert("保存至浏览器缓存失败: " + err.message);
        }
    }

    generateId(prefix) {
        return prefix + '_' + Math.random().toString(36).substr(2, 9);
    }

    bindGlobalModalsClose() {
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-content')) return;
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('open');
                } else {
                    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
                }
            });
        });
    }

    /* --- Global Settings Configuration --- */
    renderSettingsForm() {
        if (!this.data.siteSettings) this.data.siteSettings = {};
        document.getElementById('site-title').value = this.data.siteSettings.title || '';
        document.getElementById('site-favicon').value = this.data.siteSettings.favicon || '';
        document.getElementById('nav-world-label').value = this.data.siteSettings.navWorld || '';
        document.getElementById('nav-char-label').value = this.data.siteSettings.navChar || '';
        document.getElementById('nav-time-label').value = this.data.siteSettings.navTime || '';
        document.getElementById('nav-novel-label').value = this.data.siteSettings.navNovel || '';

        // Themes
        const layout = this.data.siteSettings.themeLayout || 'default';
        const color = this.data.siteSettings.themeColor || 'dark';
        const presetVal = `${layout}_${color}`;
        const presetSelect = document.getElementById('site-theme-preset');
        if (presetSelect) {
            presetSelect.value = presetVal;
            // If the combination doesn't exactly match an option, fallback to default
            if (!presetSelect.value) presetSelect.value = 'default_dark';
        }
    }

    bindSettingsForm() {
        const syncTheme = () => {
            if (!this.data.siteSettings) this.data.siteSettings = {};
            const presetSelect = document.getElementById('site-theme-preset');
            if (!presetSelect) return "未找到下拉框";

            const presetVal = presetSelect.value;
            if (!presetVal) return "下拉值为空";

            const [layout, color] = presetVal.split('_');
            this.data.siteSettings.themeLayout = layout;
            this.data.siteSettings.themeColor = color;
            return `版式: ${layout}, 色彩: ${color}`;
        };

        const btnSaveGlobal = document.getElementById('btn-save-settings');
        if (btnSaveGlobal) {
            console.log("Admin: Binding btn-save-settings...");
            btnSaveGlobal.onclick = null; // Clear any old inline onclicks
            btnSaveGlobal.addEventListener('click', (e) => {
                try {
                    console.log("Admin: btn-save-settings clicked!");
                    if (!this.data.siteSettings) this.data.siteSettings = {};
                    this.data.siteSettings.title = document.getElementById('site-title').value;
                    this.data.siteSettings.favicon = document.getElementById('site-favicon').value;
                    this.data.siteSettings.navWorld = document.getElementById('nav-world-label').value;
                    this.data.siteSettings.navChar = document.getElementById('nav-char-label').value;
                    this.data.siteSettings.navTime = document.getElementById('nav-time-label').value;
                    this.data.siteSettings.navNovel = document.getElementById('nav-novel-label').value;

                    // 强制同步最新主题
                    const themeStatus = syncTheme();
                    this.saveData();
                    alert(`全局站点配置保存成功！\n请回到前台刷新预览 (主题已设为 ${themeStatus})。`);
                } catch (err) {
                    alert("保存设置时发生异常，请检查控制台。");
                    console.error(err);
                }
            });
        } else {
            alert("抱歉！后台系统未能在页面中找到 ID 为 'btn-save-settings' 的保存按钮，请检查 HTML 结构。");
        }

        // 自动保存主题下拉框 (防止用户选中后忘记点击保存导致导出失败)
        const presetSelect = document.getElementById('site-theme-preset');
        if (presetSelect) {
            presetSelect.addEventListener('change', () => {
                const themeStatus = syncTheme();
                this.saveData();
                console.log(`[OC_DEBUG] Auto-saved theme: ${themeStatus}`);
            });
        }

        // Favicon SVG Upload
        document.getElementById('site-favicon-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.svg')) {
                alert("抱歉，网页图标仅支持上传 SVG 格式文件。");
                return;
            }

            try {
                const newName = `favicon_${Date.now()}_${Math.floor(Math.random() * 1000)}.svg`;
                await StorageService.saveAsset(newName, file);
                document.getElementById('site-favicon').value = `img/${newName}`;
                alert("SVG 图标已成功上传，点击上方保存按钮生效全局配置。");
            } catch (err) {
                console.error(err);
                alert("上传失败：" + err.message);
            }
        });
    }

    /* --- World View Configuration --- */
    renderWorldForm() {
        document.getElementById('w-title').value = this.data.worldView.title || '';
        document.getElementById('w-subtitle').value = this.data.worldView.subtitle || '';
        document.getElementById('w-cover').value = this.data.worldView.coverImage || '';
        document.getElementById('w-desc').value = this.data.worldView.description || '';
    }

    bindWorldForm() {
        document.getElementById('btn-save-world').addEventListener('click', () => {
            this.data.worldView.title = document.getElementById('w-title').value;
            this.data.worldView.subtitle = document.getElementById('w-subtitle').value;
            this.data.worldView.coverImage = document.getElementById('w-cover').value;
            this.data.worldView.description = document.getElementById('w-desc').value;
            this.saveData();
            alert("基本世界观保存成功！");
        });

        document.getElementById('btn-add-module').addEventListener('click', () => {
            const modName = prompt("请输入新模块的名称 (例如：种族设定)");
            if (modName && modName.trim()) {
                if (!this.data.worldView.modules) this.data.worldView.modules = [];
                this.data.worldView.modules.push({ id: this.generateId('mod'), name: modName.trim(), entries: [] });
                this.saveData();
                this.renderModuleList();
            }
        });

        // World Cover Image Upload
        document.getElementById('edit-w-cover-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const ext = file.name.split('.').pop();
                const newName = `world_cover_${Date.now()}.${ext}`;
                await StorageService.saveAsset(newName, file);

                const imgUrl = `img/${newName}`;
                document.getElementById('w-cover').value = imgUrl;
                alert("世界观封面预览已成功加载！别忘了点击保存设置生效。");
            } catch (err) {
                console.error("Local Image Save Failed: ", err);
                alert("保存失败: " + err.message);
            }
            e.target.value = '';
        });
    }

    /* --- world Modules --- */
    renderModuleList() {
        const container = document.getElementById('module-container');
        container.innerHTML = '';
        const modules = this.data.worldView.modules || [];

        modules.forEach((mod, modIndex) => {
            const modDiv = document.createElement('div');
            modDiv.className = 'form-group grid-full module-item';
            modDiv.dataset.id = mod.id;
            modDiv.style.background = '#f8fafc';
            modDiv.style.padding = '15px';
            modDiv.style.borderRadius = '8px';
            modDiv.style.border = '1px solid #e2e8f0';

            let entriesHtml = (mod.entries || []).map(entry => `
                <div class="entry-item" data-id="${entry.id}" style="background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; margin-top:8px; cursor:grab;">
                    <div style="display:flex; align-items:center; flex:1; min-width:0; width:100%;">
                        <i class="ri-draggable" style="color:#cbd5e1; font-size:1.2rem; margin-right:8px;"></i>
                        <div style="min-width:0; width:100%;">
                            <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${entry.title}</strong>
                            <div style="font-size:0.85em; color:#64748b; margin-top:4px; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${entry.content}
                            </div>
                        </div>
                    </div>
                    <div style="flex-shrink:0; margin-left:10px;">
                        <button class="btn btn-outline btn-sm btn-edit-entry" data-mod="${mod.id}" data-entry="${entry.id}">编辑</button>
                        <button class="btn btn-danger btn-sm btn-del-entry" data-mod="${mod.id}" data-entry="${entry.id}">删除</button>
                    </div>
                </div>
            `).join('');

            modDiv.innerHTML = `
                <div class="mod-handle" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:grab;">
                    <h3 style="margin:0; font-size:1.1rem; color:#0f172a;"><i class="ri-draggable" style="color:#cbd5e1; font-size:1.2rem; margin-right:8px;"></i><i class="ri-folder-2-line"></i> ${mod.name}</h3>
                    <div>
                        <button class="btn btn-outline btn-sm btn-add-entry" data-mod="${mod.id}"><i class="ri-file-add-line"></i> 添加条目</button>
                        <button class="btn btn-danger btn-sm btn-del-mod" data-mod="${mod.id}"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </div >
                <div class="entries-container" data-mod="${mod.id}">${entriesHtml}</div>
            `;
            container.appendChild(modDiv);
        });

        if (typeof Sortable !== 'undefined') {
            Sortable.create(container, {
                animation: 150,
                handle: '.mod-handle',
                onEnd: () => {
                    const sortedIds = Array.from(container.querySelectorAll('.module-item')).map(el => el.dataset.id);
                    const orderMap = new Map(sortedIds.map((id, index) => [id, index]));
                    this.data.worldView.modules.sort((a, b) => (orderMap.get(String(a.id)) || 0) - (orderMap.get(String(b.id)) || 0));
                    this.saveData();
                }
            });

            container.querySelectorAll('.entries-container').forEach(entryContainer => {
                Sortable.create(entryContainer, {
                    animation: 150,
                    onEnd: (evt) => {
                        const modId = entryContainer.dataset.mod;
                        const mod = this.data.worldView.modules.find(m => m.id === modId);
                        if (mod && mod.entries) {
                            const sortedIds = Array.from(entryContainer.querySelectorAll('.entry-item')).map(el => el.dataset.id);
                            const orderMap = new Map(sortedIds.map((id, index) => [id, index]));
                            mod.entries.sort((a, b) => (orderMap.get(String(a.id)) || 0) - (orderMap.get(String(b.id)) || 0));
                            this.saveData();
                        }
                    }
                });
            });
        }

        // Use event delegation on container to handle dynamic buttons robustly
        container.onclick = (e) => {
            const btnAdd = e.target.closest('.btn-add-entry');
            if (btnAdd) this.openEditEntryModal(btnAdd.dataset.mod, null);

            const btnEdit = e.target.closest('.btn-edit-entry');
            if (btnEdit) this.openEditEntryModal(btnEdit.dataset.mod, btnEdit.dataset.entry);

            const btnDelEntry = e.target.closest('.btn-del-entry');
            if (btnDelEntry) {
                if (confirm('删除此条目？')) {
                    const mod = this.data.worldView.modules.find(m => m.id === btnDelEntry.dataset.mod);
                    mod.entries = mod.entries.filter(x => x.id !== btnDelEntry.dataset.entry);
                    this.saveData();
                    this.renderModuleList();
                }
            }

            const btnDelMod = e.target.closest('.btn-del-mod');
            if (btnDelMod) {
                if (confirm('连同其下的条目一起删除此模块？')) {
                    this.data.worldView.modules = this.data.worldView.modules.filter(m => m.id !== btnDelMod.dataset.mod);
                    this.saveData();
                    this.renderModuleList();
                }
            }
        };
    }

    bindEntryModal() {
        document.getElementById('btn-save-entry').addEventListener('click', () => {
            const modId = document.getElementById('edit-me-modId').value;
            const entryId = document.getElementById('edit-me-entryId').value || this.generateId('entry');
            const mod = this.data.worldView.modules.find(m => m.id === modId);

            // Get checked chars
            const linkedCharIds = [];
            document.querySelectorAll('.char-entry-checkbox:checked').forEach(cb => {
                linkedCharIds.push(cb.value);
            });

            const entryObj = {
                id: entryId,
                title: document.getElementById('edit-me-title').value,
                content: document.getElementById('edit-me-content').value,
                linkedCharIds: linkedCharIds
            };

            const existingIndex = mod.entries ? mod.entries.findIndex(e => e.id === entryId) : -1;
            if (!mod.entries) mod.entries = [];

            if (existingIndex > -1) {
                mod.entries[existingIndex] = entryObj;
            } else {
                mod.entries.push(entryObj);
            }

            this.saveData();
            this.renderModuleList();
            document.getElementById('modal-edit-entry').classList.remove('open');
        });
    }

    openEditEntryModal(modId, entryId = null) {
        this.currentModId = modId;
        this.currentEntryId = entryId;
        const mod = this.data.worldView.modules.find(m => m.id === modId);

        let targetEntry = null;
        if (entryId) targetEntry = mod.entries.find(e => e.id === entryId);

        document.getElementById('edit-me-modId').value = modId;
        document.getElementById('edit-me-entryId').value = entryId || '';
        document.getElementById('edit-me-title').value = targetEntry ? targetEntry.title : '';
        document.getElementById('edit-me-content').value = targetEntry ? targetEntry.content : '';

        // Render character checkboxes
        const charContainer = document.getElementById('edit-me-chars');
        charContainer.innerHTML = '';
        const linked = targetEntry ? (targetEntry.linkedCharIds || []) : [];

        if (this.data.characters && this.data.characters.length === 0) {
            charContainer.innerHTML = '<span class="text-muted">暂无角色可关联，请先添加角色。</span>';
        } else if (this.data.characters) {
            this.data.characters.forEach(char => {
                const checked = linked.includes(char.id) ? 'checked' : '';
                charContainer.innerHTML += `
        <label style="display:flex; align-items:center; gap:4px; font-size:0.9em; cursor: pointer; padding: 4px;">
        <input type="checkbox" class="char-entry-checkbox" value="${char.id}" ${checked}> ${char.name}
        </label>
                `;
            });
        }

        document.getElementById('modal-edit-entry').classList.add('open');
    }

    /* --- Character Management --- */
    renderCharList() {
        const list = document.getElementById('char-list');
        list.innerHTML = '';
        this.data.characters.forEach(char => {
            let displayAvatar = Array.isArray(char.avatar) && char.avatar.length > 0 ? char.avatar[0] : (char.avatar || '');
            if (typeof displayAvatar === 'string' && displayAvatar.startsWith('[')) {
                try {
                    const parsed = JSON.parse(displayAvatar);
                    displayAvatar = parsed.length > 0 ? parsed[0] : '';
                } catch (e) { }
            }
            displayAvatar = this.getResolved(displayAvatar);

            const li = document.createElement('li');
            li.dataset.id = char.id; // Added for Sortable
            li.innerHTML = `
        <div class="item-info" style="cursor: grab;">
                    <i class="ri-draggable" style="color:#cbd5e1; font-size:1.2rem; margin-right:10px;"></i>
                    <img src="${displayAvatar}" class="item-avatar" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${char.id}'">
                    <div>
                        <div class="item-title">${char.name}</div>
                        <div class="item-subtitle">${char.identity}</div>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-outline btn-sm btn-icon-sm char-edit" data-id="${char.id}"><i class="ri-edit-line"></i> 编辑</button>
                    <button class="btn btn-danger btn-sm btn-icon-sm char-delete" data-id="${char.id}"><i class="ri-delete-bin-line"></i></button>
                </div>
            `;
            list.appendChild(li);
        });

        // Initialize Sortable
        if (typeof Sortable !== 'undefined') {
            Sortable.create(list, {
                animation: 150,
                handle: '.item-info', // use the info area as drag handle
                onEnd: (evt) => {
                    const sortedIds = Array.from(list.children).map(li => li.dataset.id);
                    const orderMap = new Map(sortedIds.map((id, index) => [id, index]));
                    this.data.characters.sort((a, b) => {
                        return (orderMap.get(String(a.id)) || 0) - (orderMap.get(String(b.id)) || 0);
                    });
                    this.saveData();
                    // Optional: Call render again if needed, but Dom is already sorted
                }
            });
        }

        list.querySelectorAll('.char-edit').forEach(btn => btn.addEventListener('click', (e) => this.openEditCharModal(e.target.closest('button').dataset.id)));
        list.querySelectorAll('.char-delete').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm('确定要删除这个角色吗？相关的关联关系可能会丢失。')) {
                const id = e.target.closest('button').dataset.id;
                this.data.characters = this.data.characters.filter(c => c.id !== id);
                // Also clean up relationships from other chars pointing to this one
                this.data.characters.forEach(c => {
                    if (c.relationships) c.relationships = c.relationships.filter(r => r.targetId !== id);
                });
                this.saveData();
                this.renderCharList();
            }
        }));

        // Initialize Sortable
        if (typeof Sortable !== 'undefined') {
            Sortable.create(list, {
                animation: 150,
                handle: '.item-info', // use the info area as drag handle
                onEnd: (evt) => {
                    const sortedIds = Array.from(list.children).map(li => li.dataset.id);
                    const orderMap = new Map(sortedIds.map((id, index) => [id, index]));
                    this.data.characters.sort((a, b) => {
                        return (orderMap.get(String(a.id)) || 0) - (orderMap.get(String(b.id)) || 0);
                    });
                    this.saveData();
                    // Optional: Call render again if needed, but Dom is already sorted
                }
            });
        }
    }

    buildRelationInputs() {
        const container = document.getElementById('relation-list-container');
        container.innerHTML = '';
        this.tempRelations.forEach((rel, index) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.gap = '10px';

            // Build options for target characters
            let charOptions = '<option value="">选择目标角色</option>';
            this.data.characters.forEach(c => {
                if (c.id !== document.getElementById('edit-c-id').value) {
                    charOptions += `<option value="${c.id}" ${rel.targetId === c.id ? 'selected' : ''}> ${c.name}</option>`;
                }
            });

            div.innerHTML = `
    <select class="form-control rel-target" data-idx="${index}" style="flex:1;"> ${charOptions}</select>
    <input type="text" class="form-control rel-label" data-idx="${index}" placeholder="关系标签(如:战友,仇敌)" value="${rel.label}" style="flex:1;">
        <button class="btn btn-danger btn-sm btn-del-rel" data-idx="${index}"><i class="ri-close-line"></i></button>
        `;
            container.appendChild(div);
        });

        container.querySelectorAll('.rel-target').forEach(el => el.addEventListener('change', (e) => {
            this.tempRelations[e.target.dataset.idx].targetId = e.target.value;
        }));
        container.querySelectorAll('.rel-label').forEach(el => el.addEventListener('change', (e) => {
            this.tempRelations[e.target.dataset.idx].label = e.target.value;
        }));
        container.querySelectorAll('.btn-del-rel').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.target.closest('button').dataset.idx;
            this.tempRelations.splice(idx, 1);
            this.buildRelationInputs();
        }));
    }

    buildSectionInputs() {
        const container = document.getElementById('section-list-container');
        container.innerHTML = '';
        this.tempSections.forEach((sec, index) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '5px';
            div.style.padding = '10px';
            div.style.background = '#fff';
            div.style.border = '1px solid #cbd5e1';
            div.style.borderRadius = '6px';

            div.className = 'section-item';
            div.innerHTML = `
        <div style="display:flex; gap:10px; align-items:center;">
            <i class="ri-draggable sec-handle" style="color:#cbd5e1; font-size:1.2rem; cursor:grab;"></i>
            <input type="text" class="form-control sec-title" data-idx="${index}" placeholder="段落小标题 (如: 背景故事, 外貌特征)" value="${sec.title}" style="flex:1;">
                <button class="btn btn-danger btn-sm btn-del-sec" data-idx="${index}"><i class="ri-delete-bin-line"></i></button>
        </div>
        <textarea class="form-control sec-content" data-idx="${index}" rows="3" placeholder="正文内容...">${sec.content}</textarea>
        `;
            container.appendChild(div);
        });

        container.querySelectorAll('.sec-title').forEach(el => el.addEventListener('change', (e) => {
            this.tempSections[e.target.dataset.idx].title = e.target.value;
        }));
        container.querySelectorAll('.sec-content').forEach(el => el.addEventListener('change', (e) => {
            this.tempSections[e.target.dataset.idx].content = e.target.value;
        }));
        container.querySelectorAll('.btn-del-sec').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.target.closest('button').dataset.idx;
            this.tempSections.splice(idx, 1);
            this.buildSectionInputs();
        }));

        // Setup toolbars for these newly created dynamic section textareas
        setupRichTextToolbars('.sec-content');

        // Initialize Sortable for sections
        if (typeof Sortable !== 'undefined') {
            Sortable.create(container, {
                animation: 150,
                handle: '.sec-handle',
                onEnd: () => {
                    const newSections = [];
                    container.querySelectorAll('.section-item').forEach((node, index) => {
                        const titleInput = node.querySelector('.sec-title');
                        const contentInput = node.querySelector('.sec-content');
                        newSections.push({
                            title: titleInput.value,
                            content: contentInput.value
                        });
                        // Update DOM indices so delete/change events keep working
                        titleInput.dataset.idx = index;
                        contentInput.dataset.idx = index;
                        node.querySelector('.btn-del-sec').dataset.idx = index;
                    });
                    this.tempSections = newSections;
                }
            });
        }
    }

    async renderAvatarPreview() {
        const container = document.getElementById('avatar-preview-container');
        container.innerHTML = '';

        for (let i = 0; i < this.tempAvatars.length; i++) {
            const url = this.tempAvatars[i];
            const displayUrl = await StorageService.resolveImageUrl(url);

            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.width = '60px';
            div.style.height = '60px';
            div.style.borderRadius = '4px';
            div.style.overflow = 'hidden';
            div.style.border = '1px solid #cbd5e1';
            div.style.cursor = 'move';
            div.className = 'avatar-preview-item';
            div.dataset.url = url;

            div.innerHTML = `
                <img src="${displayUrl}" style="width:100%; height:100%; object-fit:cover;">
                <button type="button" class="btn btn-danger btn-sm" style="position:absolute; top:2px; right:2px; padding:2px; min-width:auto; line-height:1;" onclick="
                    const p = this.closest('.avatar-preview-item');
                    const idx = Array.from(p.parentNode.children).indexOf(p);
                    window.adminTempAvatarsRemove(idx);
                "><i class="ri-close-line" style="font-size:12px;"></i></button>
            `;
            container.appendChild(div);
        }

        // Make sortable
        Sortable.create(container, {
            animation: 150,
            onEnd: () => {
                this.tempAvatars = Array.from(container.querySelectorAll('.avatar-preview-item')).map(el => el.dataset.url);
                document.getElementById('edit-c-avatar').value = JSON.stringify(this.tempAvatars);
            }
        });
    }

    bindCharModals() {
        // Global helper for delete button in renderAvatarPreview
        window.adminTempAvatarsRemove = (idx) => {
            if (confirm("移除这张图片绑定？(本地物理文件不会被删除)")) {
                this.tempAvatars.splice(idx, 1);
                document.getElementById('edit-c-avatar').value = JSON.stringify(this.tempAvatars);
                this.renderAvatarPreview();
            }
        };

        const fileInput = document.getElementById('edit-c-avatar-file');
        const textInput = document.getElementById('edit-c-avatar');

        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const ext = file.name.split('.').pop() || 'png';
                    const newName = `char_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

                    // Save to IndexedDB
                    await StorageService.saveAsset(newName, file);
                    this.tempAvatars.push(`img/${newName}`);
                }
                textInput.value = JSON.stringify(this.tempAvatars);
                this.renderAvatarPreview();
            } catch (err) {
                console.error(err);
                alert("图片保存失败: " + err.message);
            }
            e.target.value = ''; // Reset
        });

        textInput.addEventListener('change', (e) => {
            try {
                this.tempAvatars = JSON.parse(e.target.value);
            } catch (err) {
                // assume comma separated or single url
                this.tempAvatars = e.target.value ? e.target.value.replace(/'/g, '"').split(',').map(s => s.trim()).filter(Boolean) : [];
                // fix single quotes case like "['url1', 'url2']"
                if (e.target.value.startsWith('[')) {
                    try { this.tempAvatars = JSON.parse(e.target.value.replace(/'/g, '"')); } catch (e) { }
                }
            }
            this.renderAvatarPreview();
        });

        document.getElementById('btn-add-char').addEventListener('click', () => this.openEditCharModal());

        document.getElementById('btn-add-relation').addEventListener('click', () => {
            this.tempRelations.push({ targetId: '', label: '' });
            this.buildRelationInputs();
        });

        document.getElementById('btn-add-section').addEventListener('click', () => {
            this.tempSections.push({ title: '', content: '' });
            this.buildSectionInputs();
        });

        document.getElementById('btn-save-char').addEventListener('click', () => {
            const id = document.getElementById('edit-c-id').value || this.generateId('char');

            const rawInfo = document.getElementById('edit-c-info').value;
            let infoArray = [];
            if (rawInfo.trim() !== '') {
                infoArray = rawInfo.split(',').map(pair => {
                    const [label, value] = pair.split(':');
                    return { label: (label || '').trim(), value: (value || '').trim() };
                });
            }

            // Cleanup empty relations before saving
            const validRels = this.tempRelations.filter(r => r.targetId !== '' && r.label.trim() !== '');
            const validSecs = this.tempSections.filter(s => s.title.trim() !== '' || s.content.trim() !== '');

            const rawTags = document.getElementById('edit-c-tags').value;
            let tagsArray = [];
            if (rawTags.trim() !== '') {
                tagsArray = rawTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            }

            const avatarVal = document.getElementById('edit-c-avatar').value;
            let parsedAvatar = avatarVal;
            try {
                parsedAvatar = JSON.parse(avatarVal);
            } catch (e) { }

            const charObj = {
                id: id,
                name: document.getElementById('edit-c-name').value,
                englishName: document.getElementById('edit-c-en').value,
                identity: document.getElementById('edit-c-identity').value,
                tags: tagsArray,
                avatar: parsedAvatar,
                info: infoArray,
                customSections: validSecs,
                relationships: validRels
            };

            const existingIndex = this.data.characters.findIndex(c => c.id === id);
            if (existingIndex > -1) {
                this.data.characters[existingIndex] = charObj;
            } else {
                this.data.characters.push(charObj);
            }

            this.saveData();
            this.renderCharList();
            document.getElementById('modal-edit-char').classList.remove('open');
        });
    }

    openEditCharModal(id = null) {
        if (id) {
            const char = this.data.characters.find(c => c.id === id);
            document.getElementById('edit-c-id').value = char.id;
            document.getElementById('edit-c-name').value = char.name || '';
            document.getElementById('edit-c-en').value = char.englishName || '';
            document.getElementById('edit-c-identity').value = char.identity || '';
            document.getElementById('edit-c-tags').value = char.tags ? char.tags.join(',') : '';

            let rawAvatar = char.avatar || '';
            if (Array.isArray(rawAvatar)) {
                this.tempAvatars = rawAvatar;
            } else {
                try {
                    this.tempAvatars = JSON.parse(rawAvatar);
                    if (!Array.isArray(this.tempAvatars)) this.tempAvatars = [rawAvatar].filter(Boolean);
                } catch (e) {
                    if (typeof rawAvatar === 'string') {
                        this.tempAvatars = rawAvatar ? rawAvatar.replace(/'/g, '"').split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (rawAvatar.startsWith('[')) {
                            try { this.tempAvatars = JSON.parse(rawAvatar.replace(/'/g, '"')); } catch (err) { }
                        }
                    } else {
                        this.tempAvatars = [rawAvatar].filter(Boolean);
                    }
                }
            }
            if (!Array.isArray(this.tempAvatars)) this.tempAvatars = [this.tempAvatars].filter(Boolean);

            // Sanitize elements that might be corrupted double-stringified arrays from previous bugs
            this.tempAvatars = this.tempAvatars.map(url => {
                if (typeof url === 'string' && url.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(url.replace(/'/g, '"'));
                        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
                    } catch (e) { }
                }
                return url;
            });

            document.getElementById('edit-c-avatar').value = JSON.stringify(this.tempAvatars);
            this.renderAvatarPreview();


            const infoStr = (char.info || []).map(i => `${i.label}:${i.value}`).join(', ');
            document.getElementById('edit-c-info').value = infoStr;

            // Clone to avoid mutating directly before save
            this.tempRelations = JSON.parse(JSON.stringify(char.relationships || []));

            // Migrate bio to customSections if needed
            if (char.customSections && char.customSections.length > 0) {
                this.tempSections = JSON.parse(JSON.stringify(char.customSections));
            } else if (char.bio && char.bio.trim() !== '') {
                this.tempSections = [{ title: '背景故事', content: char.bio }];
            } else {
                this.tempSections = [];
            }
            this.buildSectionInputs();
        } else {
            document.getElementById('edit-c-id').value = '';
            document.getElementById('edit-c-name').value = '';
            document.getElementById('edit-c-en').value = '';
            document.getElementById('edit-c-identity').value = '';
            document.getElementById('edit-c-tags').value = '';
            document.getElementById('edit-c-avatar').value = '[]';
            this.tempAvatars = [];
            this.renderAvatarPreview();
            document.getElementById('edit-c-info').value = '';
            this.tempRelations = [];
            this.tempSections = [];
            this.buildSectionInputs();
        }

        this.buildRelationInputs();
        document.getElementById('modal-edit-char').classList.add('open');
    }

    /* --- Timeline Management --- */
    renderTimelineList() {
        const list = document.getElementById('timeline-list');
        list.innerHTML = '';
        this.data.storyline.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
            <div class="item-info">
                <div>
                    <div class="item-title">
                        ${item.title}
                        <span class="text-muted" style="font-size:0.8em; margin-left: 10px;">${item.date}</span>
                        <span class="badge" style="margin-left:5px; font-size:0.7em; background:rgba(14,165,233,0.1); color:#0ea5e9;">${item.era || '未分类'}</span>
                    </div>
                    <div class="item-subtitle" style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${item.description}</div>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn btn-outline btn-sm btn-icon-sm t-edit" data-id="${item.id}"><i class="ri-edit-line"></i> 编辑</button>
                <button class="btn btn-danger btn-sm btn-icon-sm t-delete" data-id="${item.id}"><i class="ri-delete-bin-line"></i></button>
            </div>
            `;
            list.appendChild(li);
        });

        list.querySelectorAll('.t-edit').forEach(btn => btn.addEventListener('click', (e) => this.openEditTimelineModal(e.target.closest('button').dataset.id)));
        list.querySelectorAll('.t-delete').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm('删除此节点？')) {
                const id = e.target.closest('button').dataset.id;
                this.data.storyline = this.data.storyline.filter(x => x.id !== id);
                this.saveData();
                this.renderTimelineList();
            }
        }));
    }

    bindTimelineModals() {
        document.getElementById('btn-add-timeline').addEventListener('click', () => this.openEditTimelineModal());

        document.getElementById('btn-save-timeline').addEventListener('click', () => {
            const id = document.getElementById('edit-t-id').value || this.generateId('story');
            const obj = {
                id: id,
                era: document.getElementById('edit-t-era').value || '默认纪元',
                date: document.getElementById('edit-t-date').value,
                title: document.getElementById('edit-t-title').value,
                description: document.getElementById('edit-t-desc').value
            };

            const index = this.data.storyline.findIndex(x => x.id === id);
            if (index > -1) this.data.storyline[index] = obj;
            else this.data.storyline.push(obj);

            this.saveData();
            this.renderTimelineList();
            document.getElementById('modal-edit-timeline').classList.remove('open');
        });
    }

    openEditTimelineModal(id = null) {
        // Build datalist options dynamically
        const eraList = [...new Set(this.data.storyline.map(item => item.era).filter(e => e && e.trim() !== ''))];
        const datalist = document.getElementById('era-options');
        if (datalist) {
            datalist.innerHTML = eraList.map(era => `<option value="${era}">`).join('');
        }

        if (id) {
            const item = this.data.storyline.find(x => x.id === id);
            document.getElementById('edit-t-id').value = item.id;
            document.getElementById('edit-t-era').value = item.era || '';
            document.getElementById('edit-t-date').value = item.date || '';
            document.getElementById('edit-t-title').value = item.title || '';
            document.getElementById('edit-t-desc').value = item.description || '';
        } else {
            document.getElementById('edit-t-id').value = '';
            document.getElementById('edit-t-era').value = '';
            document.getElementById('edit-t-date').value = '';
            document.getElementById('edit-t-title').value = '';
            document.getElementById('edit-t-desc').value = '';
        }
        document.getElementById('modal-edit-timeline').classList.add('open');
    }

    /* --- Novels Management --- */
    renderNovelList() {
        const list = document.getElementById('novel-list');
        list.innerHTML = '';
        this.data.novels.forEach(item => {
            const cat = (this.data.novelCategories || []).find(c => c.id === item.categoryId);
            const catName = cat ? cat.name : '未分类';

            const li = document.createElement('li');
            li.dataset.id = item.id;
            li.innerHTML = `
            <div class="item-info" style="cursor: grab;">
                <div>
                    <div class="item-title"><i class="ri-draggable" style="color:#cbd5e1; margin-right:8px;"></i><i class="ri-file-text-line"></i> ${item.title} <span class="badge" style="margin-left:5px; font-size:0.7em; background:#0f172a; color:#f8fafc;">${catName}</span></div>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn btn-outline btn-sm btn-icon-sm n-edit" data-id="${item.id}"><i class="ri-edit-line"></i> 编辑</button>
                <button class="btn btn-danger btn-sm btn-icon-sm n-delete" data-id="${item.id}"><i class="ri-delete-bin-line"></i></button>
            </div>
            `;
            list.appendChild(li);
        });

        // Initialize Sortable for Novels
        if (typeof Sortable !== 'undefined') {
            Sortable.create(list, {
                animation: 150,
                handle: '.item-info',
                onEnd: () => {
                    const sortedIds = Array.from(list.children).map(li => li.dataset.id);
                    const orderMap = new Map(sortedIds.map((id, index) => [id, index]));
                    this.data.novels.sort((a, b) => (orderMap.get(String(a.id)) || 0) - (orderMap.get(String(b.id)) || 0));
                    this.saveData();
                }
            });
        }

        list.querySelectorAll('.n-edit').forEach(btn => btn.addEventListener('click', (e) => this.openEditNovelModal(e.target.closest('button').dataset.id)));
        list.querySelectorAll('.n-delete').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm('删除此文献？')) {
                const id = e.target.closest('button').dataset.id;
                this.data.novels = this.data.novels.filter(x => x.id !== id);
                this.saveData();
                this.renderNovelList();
            }
        }));
    }

    renderCategorySelect() {
        const sel = document.getElementById('edit-n-category');
        sel.innerHTML = '';
        const cats = this.data.novelCategories || [];
        cats.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        sel.innerHTML += `<option value="ADD_NEW" style="color:var(--blue-primary); font-weight:bold;">+ 管理小说分类...</option>`;
    }

    renderCategoryList() {
        const list = document.getElementById('category-list');
        list.innerHTML = '';
        const cats = this.data.novelCategories || [];
        cats.forEach(c => {
            list.innerHTML += `
                <li style="display:flex; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #e2e8f0;">
                    <span>${c.name}</span>
                    <button class="btn btn-danger btn-sm btn-icon-sm btn-del-cat" data-id="${c.id}"><i class="ri-close-line"></i></button>
                </li>
            `;
        });

        list.querySelectorAll('.btn-del-cat').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            this.data.novelCategories = this.data.novelCategories.filter(x => x.id !== id);
            this.saveData();
            this.renderCategoryList();
            this.renderCategorySelect();
            this.renderNovelList(); // titles might change
        }));
    }

    bindNovelModals() {
        document.getElementById('btn-add-novel').addEventListener('click', () => this.openEditNovelModal());

        document.getElementById('edit-n-category').addEventListener('change', (e) => {
            if (e.target.value === 'ADD_NEW') {
                document.getElementById('modal-edit-categories').classList.add('open');
                e.target.value = this.data.novelCategories && this.data.novelCategories.length > 0 ? this.data.novelCategories[0].id : '';
            }
        });

        document.getElementById('btn-add-cat').addEventListener('click', () => {
            const val = document.getElementById('new-cat-name').value.trim();
            if (val) {
                if (!this.data.novelCategories) this.data.novelCategories = [];
                this.data.novelCategories.push({ id: this.generateId('cat'), name: val });
                document.getElementById('new-cat-name').value = '';
                this.saveData();
                this.renderCategoryList();
                this.renderCategorySelect();
            }
        });

        document.getElementById('btn-save-novel').addEventListener('click', () => {
            const id = document.getElementById('edit-n-id').value || this.generateId('novel');
            const obj = {
                id: id,
                categoryId: document.getElementById('edit-n-category').value,
                title: document.getElementById('edit-n-title').value,
                content: document.getElementById('edit-n-content').value
            };

            const index = this.data.novels.findIndex(x => x.id === id);
            if (index > -1) this.data.novels[index] = obj;
            else this.data.novels.push(obj);

            this.saveData();
            this.renderNovelList();
            document.getElementById('modal-edit-novel').classList.remove('open');
        });
    }

    openEditNovelModal(id = null) {
        this.renderCategorySelect();

        if (id) {
            const item = this.data.novels.find(x => x.id === id);
            document.getElementById('edit-n-id').value = item.id;
            document.getElementById('edit-n-category').value = item.categoryId || '';
            document.getElementById('edit-n-title').value = item.title || '';
            document.getElementById('edit-n-content').value = item.content || '';
        } else {
            document.getElementById('edit-n-id').value = '';
            const cats = this.data.novelCategories || [];
            document.getElementById('edit-n-category').value = cats.length > 0 ? cats[0].id : '';
            document.getElementById('edit-n-title').value = '';
            document.getElementById('edit-n-content').value = '';
        }
        document.getElementById('modal-edit-novel').classList.add('open');
    }

    /* --- Data Actions --- */
    bindDataActions() {
        // 导出单纯的 JSON 数据
        document.getElementById('btn-export-data').addEventListener('click', () => {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oc_universe_data_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            alert("数据源已导出！");
        });

        // 打包导出整个项目 (ZIP)
        const btnExportFull = document.getElementById('btn-export-full');
        if (btnExportFull) {
            btnExportFull.addEventListener('click', async () => {
                try {
                    btnExportFull.disabled = true;
                    btnExportFull.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> 正在打包...';
                    await ExportService.exportZIP(this.data);
                } finally {
                    btnExportFull.disabled = false;
                    btnExportFull.innerHTML = '导出 OC Universe';
                }
            });
        }

        // 导入数据
        document.getElementById('file-import-data').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = event.target.result;
                    const parsed = JSON.parse(content);
                    if (parsed && parsed.worldView && parsed.characters) {
                        await StorageService.save(parsed);
                        alert("数据导入成功！页面将刷新以应用更改。");
                        location.reload();
                    } else {
                        throw new Error("JSON 结构不完整");
                    }
                } catch (err) {
                    alert("数据导入失败: " + err.message);
                }
            };
            reader.readAsText(file);
        });

        // 重置数据
        const btnReset = document.getElementById('btn-reset-data');
        if (btnReset) {
            btnReset.addEventListener('click', async () => {
                if (confirm("【安全独立重置】：此操作仅会清空本 OC 项目专属的本地数据库 (IndexedDB)，绝不会影响您浏览器中其他网站（如B站、微博等）的 Cookie 或登录状态！\n\n确定要清空当前所有编辑记录并重新加载默认数据吗？")) {
                    await StorageService.clearAll();
                    alert("本地缓存已清空。页面将刷新以加载默认数据。");
                    location.reload();
                }
            });
        }
    }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    const admin = new AdminPanel();
    admin.init();
});
