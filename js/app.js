// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    const app = new OCAssistantApp();
    app.init();
});

class OCAssistantApp {
    constructor() {
        this.data = null;
        this.network = null; // vis-network instance
        this.currentNovelCat = null; // for novel filtering

        this.domElements = {
            navLinks: document.querySelectorAll('.nav-links a'),
            sections: document.querySelectorAll('.view-section'),
            siteTitle: document.getElementById('nav-site-title'),

            // World View
            worldTitle: document.getElementById('world-title'),
            worldSubtitle: document.getElementById('world-subtitle'),
            worldDesc: document.getElementById('world-desc'),
            worldCover: document.getElementById('world-cover'),
            worldModules: document.getElementById('world-modules-container'),

            // Containers
            charContainer: document.getElementById('character-container'),
            timelineContainer: document.getElementById('timeline-container'),
            novelContainer: document.getElementById('novel-container'),
            novelSidebar: document.getElementById('novel-category-list'),

            // Modals
            charModal: document.getElementById('char-modal'),
            readerModal: document.getElementById('reader-modal'),
            entryModal: document.getElementById('entry-modal'),

            // Mobile
            mobileBtn: document.getElementById('mobile-menu-btn'),
            sidebar: document.querySelector('.sidebar')
        };
    }

    async init() {
        try {
            const response = await fetch('data.json');
            if (response.ok) {
                this.data = await response.json();
                console.log('Loaded data from data.json (Production Mode)');
            } else {
                throw new Error('data.json not found or not ready');
            }
        } catch (e) {
            console.log('Falling back to local UniverseData (Local/Draft Mode)');
            this.data = UniverseData.get();
        }

        this.initTheme();
        this.initSiteSettings();
        this.renderAll();
        this.bindEvents();
        this.initFrontendThemeSwitcher();
    }

    /* --- Themes --- */
    initTheme() {
        // Priority: data.json (Backend default) > hardcoded default
        const layout = this.data.siteSettings?.themeLayout || 'kamen-rubik';
        const color = this.data.siteSettings?.themeColor || 'rubik';

        document.documentElement.setAttribute('data-theme-layout', layout);
        document.documentElement.setAttribute('data-theme', color);
        // Also apply to body for backward compatibility with some CSS selectors if needed
        document.body.setAttribute('data-theme', color);

        // Dynamic CSS Loading for Layout Themes
        const themeLink = document.getElementById('theme-style');
        if (themeLink) {
            themeLink.href = `themes/theme-${layout}.css`;
        }
    }

    applyTheme(theme) {
        // Deprecated: use initTheme based on data instead
        document.documentElement.setAttribute('data-theme', theme);
    }

    initSiteSettings() {
        if (!this.data.siteSettings) return;

        if (this.data.siteSettings.title) {
            document.title = this.data.siteSettings.title;
            // The nav title is also updated in renderAll based on worldview, we can align it here
            this.domElements.siteTitle.textContent = this.data.siteSettings.title;
        }

        if (this.data.siteSettings.favicon) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = this.data.siteSettings.favicon;
        }

        if (this.data.siteSettings.navWorld) {
            const el = document.getElementById('nav-world-text');
            if (el) el.textContent = this.data.siteSettings.navWorld;
        }
        if (this.data.siteSettings.navChar) {
            const nav = document.getElementById('nav-char-text');
            const sec = document.getElementById('sec-char-text');
            if (nav) nav.textContent = this.data.siteSettings.navChar;
            if (sec) sec.textContent = this.data.siteSettings.navChar;
        }
        if (this.data.siteSettings.navTime) {
            const nav = document.getElementById('nav-time-text');
            const sec = document.getElementById('sec-time-text');
            if (nav) nav.textContent = this.data.siteSettings.navTime;
            if (sec) sec.textContent = this.data.siteSettings.navTime;
        }
        if (this.data.siteSettings.navNovel) {
            const nav = document.getElementById('nav-novel-text');
            const sec = document.getElementById('sec-novel-text');
            if (nav) nav.textContent = this.data.siteSettings.navNovel;
            if (sec) sec.textContent = this.data.siteSettings.navNovel;
        }
    }

    /* --- Core Renderers --- */
    renderAll() {
        this.domElements.siteTitle.textContent = this.data.worldView.title;

        // World View Base
        this.domElements.worldTitle.textContent = this.data.worldView.title;
        this.domElements.worldSubtitle.textContent = this.data.worldView.subtitle || '';
        this.domElements.worldDesc.innerHTML = this.parseContent(this.data.worldView.description);
        if (this.data.worldView.coverImage) {
            this.domElements.worldCover.style.backgroundImage = `url('${this.data.worldView.coverImage}')`;
        }

        this.renderWorldModules();
        this.renderCharacters();
        this.renderTimeline();
        this.renderNovelCategories();
    }

    renderWorldModules() {
        const container = this.domElements.worldModules;
        container.innerHTML = '';
        if (!this.data.worldView.modules) return;

        this.data.worldView.modules.forEach(mod => {
            if (!mod.entries || mod.entries.length === 0) return;

            const sec = document.createElement('div');
            sec.className = 'world-module-section';
            sec.innerHTML = `<h3 class="world-module-title">${mod.name}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'module-entries-grid';

            mod.entries.forEach(entry => {
                const card = document.createElement('div');
                card.className = 'module-entry-card';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <h4><i class="ri-bookmark-3-line"></i> ${entry.title}</h4>
                    <div style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.9em; color: var(--text-muted);">${this.parseContent(entry.content)}</div>
                `;
                card.addEventListener('click', () => this.openEntryModal(entry, mod.name));
                grid.appendChild(card);
            });

            sec.appendChild(grid);
            container.appendChild(sec);
        });
    }

    renderCharacters() {
        const container = this.domElements.charContainer;
        container.innerHTML = '';

        this.data.characters.forEach(char => {
            let displayAvatar = char.avatar;
            try {
                const parsed = JSON.parse(char.avatar);
                if (Array.isArray(parsed) && parsed.length > 0) displayAvatar = parsed[0];
            } catch (e) {
                if (typeof char.avatar === 'string' && char.avatar.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(char.avatar.replace(/'/g, '"'));
                        if (Array.isArray(parsed) && parsed.length > 0) displayAvatar = parsed[0];
                    } catch (err) { }
                }
            }

            const el = document.createElement('div');
            el.className = 'char-card';
            el.innerHTML = `
                <div class="char-card-img">
                    <img src="${displayAvatar || ''}" alt="${char.name}" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${char.id}'">
                </div>
                <div class="char-card-info">
                    <h3>${char.name}</h3>
                    <span class="en-name">${char.englishName || ''}</span>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        <span class="tag-badge">${char.identity}</span>
                        ${(char.tags || []).map(tag => `<span class="tag-badge" style="background:rgba(14,165,233,0.15); color:var(--blue-primary); border:1px solid rgba(14,165,233,0.3);">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
            el.addEventListener('click', () => this.openCharModal(char));
            container.appendChild(el);
        });
    }

    renderTimeline() {
        const container = this.domElements.timelineContainer;
        container.innerHTML = '';

        // Group by Era and sort within
        const grouped = {};

        // Ensure storyline is sorted by date before grouping
        const sortedStoryline = [...this.data.storyline].sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            const tA = new Date(dateA).getTime();
            const tB = new Date(dateB).getTime();
            if (!isNaN(tA) && !isNaN(tB)) return tA - tB;
            return dateA.localeCompare(dateB);
        });

        sortedStoryline.forEach(item => {
            const era = item.era || '未分类系列';
            if (!grouped[era]) grouped[era] = [];
            grouped[era].push(item);
        });

        // Loop through the eras. If we want eras to be sorted by their oldest event, we sort the keys based on the first item in each group.
        const sortedEras = Object.keys(grouped).sort((eraA, eraB) => {
            const dateA = grouped[eraA][0]?.date || '';
            const dateB = grouped[eraB][0]?.date || '';
            const tA = new Date(dateA).getTime();
            const tB = new Date(dateB).getTime();
            if (!isNaN(tA) && !isNaN(tB)) return tA - tB;
            return dateA.localeCompare(dateB);
        });

        sortedEras.forEach(era => {
            const eraHeader = document.createElement('div');
            eraHeader.className = 'timeline-era-header';
            eraHeader.innerHTML = `<h3><i class="ri-calendar-event-line"></i> ${era}</h3>`;
            container.appendChild(eraHeader);

            grouped[era].forEach(item => {
                const el = document.createElement('div');
                el.className = 'timeline-item';
                el.style.cursor = 'pointer';
                el.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-date">${item.date}</div>
                    <div class="timeline-content" style="transition: transform 0.2s ease;">
                        <h3>${item.title}</h3>
                        <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.9em; color: var(--text-muted);">${this.parseContent(item.description)}</div>
                    </div>
                `;
                el.addEventListener('click', () => this.openTimelineModal(item, era));

                // Add hover effect
                el.addEventListener('mouseenter', () => el.querySelector('.timeline-content').style.transform = 'translateX(5px)');
                el.addEventListener('mouseleave', () => el.querySelector('.timeline-content').style.transform = 'translateX(0)');

                container.appendChild(el);
            });
        });
    }

    renderNovelCategories() {
        const sidebar = this.domElements.novelSidebar;
        sidebar.innerHTML = '';

        let cats = this.data.novelCategories || [];
        // Add "All" option
        const allLi = document.createElement('li');
        allLi.textContent = "全部档案";
        allLi.className = 'active';
        allLi.addEventListener('click', () => {
            this.currentNovelCat = null;
            this.updateNovelCatSelection(allLi);
            this.renderFilteredNovels();
        });
        sidebar.appendChild(allLi);

        cats.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat.name;
            li.dataset.id = cat.id;
            li.addEventListener('click', () => {
                this.currentNovelCat = cat.id;
                this.updateNovelCatSelection(li);
                this.renderFilteredNovels();
            });
            sidebar.appendChild(li);
        });

        this.currentNovelCat = null;
        this.renderFilteredNovels();
    }

    updateNovelCatSelection(activeElement) {
        this.domElements.novelSidebar.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        if (activeElement) activeElement.classList.add('active');
    }

    renderFilteredNovels() {
        const container = this.domElements.novelContainer;
        container.innerHTML = '';

        const list = this.currentNovelCat
            ? this.data.novels.filter(n => n.categoryId === this.currentNovelCat)
            : this.data.novels;

        if (list.length === 0) {
            container.innerHTML = '<p class="text-muted"><i class="ri-ghost-line"></i> 该分类下暂时没有档案记录...</p>';
            return;
        }

        list.forEach(novel => {
            const cat = this.data.novelCategories?.find(c => c.id === novel.categoryId);
            const badgeHtml = cat ? `<span class="badge" style="background:var(--blue-primary); color:var(--bg-color); padding: 2px 6px; border-radius:4px; font-size:0.75rem; margin-right:10px;">${cat.name}</span>` : '';

            const el = document.createElement('div');
            el.className = 'novel-item';
            el.innerHTML = `
                <div class="novel-icon"><i class="ri-article-line"></i></div>
                <div class="novel-info">
                    <h3 style="display:flex; align-items:center;">${badgeHtml}${novel.title}</h3>
                    <p>点击阅读详细记录</p>
                </div>
            `;
            el.addEventListener('click', () => this.openReaderModal(novel));
            container.appendChild(el);
        });
    }

    /* --- Utilities & Interaction --- */
    parseContent(text) {
        if (!text) return '';
        let html = text;
        // 1. Parse Markdown & HTML
        if (typeof marked !== 'undefined') {
            html = marked.parse(text);
        }
        // 2. Parse Spoilers ||text|| -> <span class="spoiler">text</span>
        const regex = /\|\|(.*?)\|\|/g;
        return html.replace(regex, '<span class="spoiler" title="点击显示剧透" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    }

    bindEvents() {
        // Navigation Switching
        this.domElements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');

                this.domElements.navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                this.domElements.sections.forEach(sec => {
                    sec.classList.remove('active');
                    if (sec.id === targetId) sec.classList.add('active');
                });

                // Auto close mobile sidebar
                this.domElements.sidebar.classList.remove('open');
                const bd = document.getElementById('sidebar-backdrop');
                if (bd) bd.classList.remove('active');
            });
        });

        // Mobile Menu Toggle
        const backdrop = document.getElementById('sidebar-backdrop');
        if (this.domElements.mobileBtn) {
            this.domElements.mobileBtn.addEventListener('click', () => {
                this.domElements.sidebar.classList.toggle('open');
                if (backdrop) backdrop.classList.toggle('active');
            });
        }

        // Backdrop click closes sidebar
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                this.domElements.sidebar.classList.remove('open');
                backdrop.classList.remove('active');
            });
        }

        // Minimal Layout Specific Toggler (Desktop/Mobile hybrid)
        const minimalBtn = document.getElementById('minimal-nav-toggle');
        if (minimalBtn) {
            minimalBtn.addEventListener('click', () => {
                this.domElements.sidebar.classList.toggle('open');
                if (backdrop) backdrop.classList.toggle('active');
            });
        }

        // Fantasy Map Navigation (藏宝图导航)
        document.querySelectorAll('.map-waypoint').forEach(wp => {
            wp.addEventListener('click', (e) => {
                e.preventDefault();
                const target = wp.getAttribute('data-target');
                if (!target) return;

                // Switch section (reuse existing sidebar nav logic)
                const sidebarLink = document.querySelector(`.nav-links a[data-target="${target}"]`);
                if (sidebarLink) sidebarLink.click();

                // Sync active state on map waypoints
                document.querySelectorAll('.map-waypoint').forEach(w => w.classList.remove('active'));
                wp.classList.add('active');
            });
        });

        // Keep map waypoints in sync when sidebar nav is clicked
        document.querySelectorAll('.nav-links a[data-target]').forEach(link => {
            link.addEventListener('click', () => {
                const target = link.getAttribute('data-target');
                document.querySelectorAll('.map-waypoint').forEach(w => {
                    w.classList.toggle('active', w.getAttribute('data-target') === target);
                });
            });
        });

        // Modals Close
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.addEventListener('click', () => {
                if (this.domElements.charModal) this.domElements.charModal.classList.remove('open');
                if (this.domElements.readerModal) this.domElements.readerModal.classList.remove('open');
                if (this.domElements.entryModal) this.domElements.entryModal.classList.remove('open');
                const tModal = document.getElementById('timeline-modal');
                if (tModal) tModal.classList.remove('open');
            });
        });

        // Toggle Graph View
        const btnToggleGraph = document.getElementById('btn-toggle-graph');
        if (btnToggleGraph) {
            btnToggleGraph.addEventListener('click', () => {
                const grid = document.getElementById('character-container');
                const graph = document.getElementById('graph-container');
                if (grid.style.display !== 'none') {
                    grid.style.display = 'none';
                    graph.style.display = 'block';
                    btnToggleGraph.innerHTML = '<i class="ri-grid-fill"></i> 卡片视图';
                    this.initNetworkGraph(); // render on demand
                } else {
                    grid.style.display = 'grid';
                    graph.style.display = 'none';
                    btnToggleGraph.innerHTML = '<i class="ri-node-tree"></i> 拓扑关系图';
                }
            });
        }

        // Reader navigation "return to directory"
        document.querySelectorAll('.btn-return-dir').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('novel-reader-view').style.display = 'none';
                document.getElementById('novel-browser-view').style.display = 'block';
                setTimeout(() => {
                    const navHeader = document.querySelector('header');
                    const offset = navHeader ? navHeader.offsetHeight : 0;
                    const novelSection = document.getElementById('novels');
                    if (novelSection) {
                        window.scrollTo({ top: novelSection.offsetTop - offset, behavior: 'smooth' });
                    }
                }, 50);
            });
        });

        // Float nav scroll inside reader
        window.addEventListener('scroll', () => {
            const floatNav = document.getElementById('reader-float-btns');
            if (floatNav && document.getElementById('novel-reader-view').style.display === 'block') {
                if (window.scrollY > 300) floatNav.classList.add('visible');
                else floatNav.classList.remove('visible');
            }
        });
    }

    /* --- Modals --- */
    openCharModal(char) {
        // Parse avatars
        let avatars = [];
        try {
            avatars = JSON.parse(char.avatar);
            if (!Array.isArray(avatars)) avatars = [char.avatar].filter(Boolean);
        } catch (e) {
            avatars = char.avatar ? char.avatar.replace(/'/g, '"').split(',').map(s => s.trim()).filter(Boolean) : [];
            if (char.avatar && char.avatar.startsWith('[')) {
                try { avatars = JSON.parse(char.avatar.replace(/'/g, '"')); } catch (err) { }
            }
        }
        if (!Array.isArray(avatars)) avatars = [avatars].filter(Boolean);

        const imgEl = document.getElementById('modal-char-avatar');
        const prevBtn = document.getElementById('modal-char-prev');
        const nextBtn = document.getElementById('modal-char-next');
        const indContainer = document.getElementById('modal-char-indicators');

        let currentAvatarIndex = 0;
        const updateAvatarDisplay = () => {
            if (avatars.length === 0) {
                imgEl.src = '';
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
                indContainer.innerHTML = '';
            } else {
                imgEl.src = avatars[currentAvatarIndex];
                if (avatars.length > 1) {
                    prevBtn.style.display = 'block';
                    nextBtn.style.display = 'block';
                    indContainer.innerHTML = avatars.map((_, i) => `<div style="width:6px;height:6px;border-radius:50%;background:${i === currentAvatarIndex ? 'var(--blue-primary)' : 'rgba(255,255,255,0.5)'};transition:background 0.3s;"></div>`).join('');
                } else {
                    prevBtn.style.display = 'none';
                    nextBtn.style.display = 'none';
                    indContainer.innerHTML = '';
                }
            }
        };
        updateAvatarDisplay();

        // Bind temporary listeners
        prevBtn.onclick = () => {
            if (avatars.length > 1) {
                currentAvatarIndex = (currentAvatarIndex - 1 + avatars.length) % avatars.length;
                updateAvatarDisplay();
            }
        };
        nextBtn.onclick = () => {
            if (avatars.length > 1) {
                currentAvatarIndex = (currentAvatarIndex + 1) % avatars.length;
                updateAvatarDisplay();
            }
        };

        document.getElementById('modal-char-name').textContent = char.name;
        document.getElementById('modal-char-en').textContent = char.englishName || '';
        document.getElementById('modal-char-identity').textContent = char.identity || '未知';

        const tagsContainer = document.getElementById('modal-char-tags');
        tagsContainer.innerHTML = '';
        if (char.tags && char.tags.length > 0) {
            char.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-badge';
                span.style.background = 'var(--primary-dim)';
                span.style.color = 'var(--primary-color)';
                span.style.border = '1px solid var(--border-color)';
                span.textContent = tag;
                tagsContainer.appendChild(span);
            });
        }

        const customSecContainer = document.getElementById('modal-char-custom-sections');
        customSecContainer.innerHTML = '';

        if (char.customSections && char.customSections.length > 0) {
            char.customSections.forEach(sec => {
                const div = document.createElement('div');
                div.className = 'bio-section mt-l';
                div.innerHTML = `
                    <h3><i class="ri-information-line"></i> ${sec.title || '自定义信息'}</h3>
                    <p class="long-text">${this.parseContent(sec.content) || '空'}</p>
                `;
                customSecContainer.appendChild(div);
            });
        } else {
            // Fallback to legacy bio
            const div = document.createElement('div');
            div.className = 'bio-section mt-l';
            div.innerHTML = `
                <h3><i class="ri-file-list-line"></i> 背景故事</h3>
                <p class="long-text">${this.parseContent(char.bio) || '无数据记录。'}</p>
            `;
            customSecContainer.appendChild(div);
        }

        // Attributes
        const infoGrid = document.getElementById('modal-char-info');
        infoGrid.innerHTML = '';
        if (char.info && char.info.length > 0) {
            char.info.forEach(item => {
                infoGrid.innerHTML += `
                    <div class="info-item">
                        <span class="info-label">${item.label}</span>
                        <span class="info-value">${item.value}</span>
                    </div>
                `;
            });
        }

        // Linked Modules mapping
        const linkSec = document.getElementById('modal-char-links-section');
        const linkContainer = document.getElementById('modal-char-links');
        linkContainer.innerHTML = '';

        let foundLinks = [];
        (this.data.worldView.modules || []).forEach(mod => {
            (mod.entries || []).forEach(entry => {
                if ((entry.linkedCharIds || []).includes(char.id)) {
                    foundLinks.push({ module: mod.name, entry: entry });
                }
            });
        });

        if (foundLinks.length > 0) {
            linkSec.style.display = 'block';
            foundLinks.forEach(link => {
                const btn = document.createElement('div');
                btn.className = 'jump-badge';
                btn.innerHTML = `<i class="ri-bookmark-line" style="margin-right:4px;"></i> ${link.module}: ${link.entry.title}`;
                btn.addEventListener('click', () => {
                    this.domElements.charModal.classList.remove('open');
                    setTimeout(() => {
                        this.openEntryModal(link.entry, link.module);
                    }, 300); // UI transition delay
                });
                linkContainer.appendChild(btn);
            });
        } else {
            linkSec.style.display = 'none';
        }


        this.domElements.charModal.classList.add('open');
    }

    openTimelineModal(item, era) {
        document.getElementById('modal-time-era').textContent = era;
        document.getElementById('modal-time-title').textContent = item.title;
        document.getElementById('modal-time-date').innerHTML = `<i class="ri-time-line"></i> ${item.date}`;
        document.getElementById('modal-time-desc').innerHTML = this.parseContent(item.description) || '无详细描述。';
        document.getElementById('timeline-modal').classList.add('open');
    }

    openReaderModal(novel) {
        const cat = this.data.novelCategories?.find(c => c.id === novel.categoryId);
        document.getElementById('reader-category').textContent = cat ? cat.name : '未分类';
        document.getElementById('reader-title').textContent = novel.title;
        // Parse with Markdown engine and fallback Spoilers
        document.getElementById('reader-content').innerHTML = this.parseContent(novel.content);

        // Navigation
        const list = this.currentNovelCat
            ? this.data.novels.filter(n => n.categoryId === this.currentNovelCat)
            : this.data.novels;
        const index = list.findIndex(n => n.id === novel.id);

        const btnPrev = document.getElementById('btn-prev-chapter');
        if (index > 0) {
            btnPrev.style.display = 'block';
            btnPrev.onclick = () => {
                this.openReaderModal(list[index - 1]);
            };
        } else {
            btnPrev.style.display = 'none';
        }

        const btnNext = document.getElementById('btn-next-chapter');
        if (index < list.length - 1) {
            btnNext.style.display = 'block';
            btnNext.onclick = () => {
                this.openReaderModal(list[index + 1]);
            };
        } else {
            btnNext.style.display = 'none';
        }

        // Toggle view
        document.getElementById('novel-browser-view').style.display = 'none';
        document.getElementById('novel-reader-view').style.display = 'block';
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }

    openEntryModal(entry, modName) {
        document.getElementById('modal-entry-title').textContent = entry.title;
        document.getElementById('modal-entry-module').textContent = modName;
        document.getElementById('modal-entry-content').innerHTML = this.parseContent(entry.content);

        const linksSec = document.getElementById('modal-entry-links-section');
        const linksContainer = document.getElementById('modal-entry-links');
        linksContainer.innerHTML = '';

        if (entry.linkedCharIds && entry.linkedCharIds.length > 0) {
            let hasLinks = false;
            entry.linkedCharIds.forEach(charId => {
                const char = this.data.characters.find(c => String(c.id) === String(charId));
                if (char) {
                    hasLinks = true;
                    const btn = document.createElement('div');
                    btn.className = 'jump-badge';
                    btn.innerHTML = `<img src="${char.avatar}" style="width:24px; height:24px; border-radius:50%; margin-right:8px; object-fit:cover;" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${char.id}'"> <span>${char.name}</span>`;
                    btn.addEventListener('click', () => {
                        this.domElements.entryModal.classList.remove('open');
                        setTimeout(() => {
                            this.openCharModal(char); // Requires char object
                        }, 300); // UI transition delay
                    });
                    linksContainer.appendChild(btn);
                }
            });

            if (hasLinks) {
                linksSec.style.display = 'block';
            } else {
                linksSec.style.display = 'none';
            }
        } else {
            linksSec.style.display = 'none';
        }

        this.domElements.entryModal.classList.add('open');
    }

    /* --- Vis Network Topology --- */
    initNetworkGraph() {
        if (this.network) return; // already init

        const mapContainer = document.getElementById('mynetwork');
        const nodesData = [];
        const edgesData = [];

        this.data.characters.forEach(c => {
            nodesData.push({
                id: c.id,
                label: c.name,
                shape: 'circularImage',
                image: c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`,
                brokenImage: `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`,
                size: 30,
                color: { border: '#0ea5e9', background: '#0f172a' },
                font: { color: '#f8fafc', size: 14 }
            });

            if (c.relationships) {
                c.relationships.forEach(rel => {
                    edgesData.push({
                        from: c.id,
                        to: rel.targetId,
                        label: rel.label,
                        font: { color: '#94a3b8', size: 12, outlineWidth: 0, background: '#0f172a' },
                        color: { color: 'rgba(14,165,233,0.3)', highlight: '#0ea5e9' },
                        arrows: 'to',
                        smooth: { type: "curvedCW", roundness: 0.2 }
                    });
                });
            }
        });

        const data = {
            nodes: new vis.DataSet(nodesData),
            edges: new vis.DataSet(edgesData)
        };

        const options = {
            interaction: { hover: true, tooltipDelay: 200 },
            physics: {
                solver: 'forceAtlas2Based',
                forceAtlas2Based: { gravitationalConstant: -100, centralGravity: 0.005, springLength: 200, springConstant: 0.08 }
            }
        };

        this.network = new vis.Network(mapContainer, data, options);
    }

    /* --- Frontend Theme Switcher --- */
    initFrontendThemeSwitcher() {
        const fabBtn = document.getElementById('theme-fab-btn');
        const popupClose = document.getElementById('theme-popup-close');
        const switcherWrapper = document.getElementById('frontend-theme-switcher');
        const presetList = document.getElementById('theme-preset-list');

        if (!fabBtn || !switcherWrapper || !presetList) return;

        // Toggle popup
        fabBtn.addEventListener('click', () => {
            switcherWrapper.classList.toggle('open');
        });
        popupClose.addEventListener('click', () => {
            switcherWrapper.classList.remove('open');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!switcherWrapper.contains(e.target) && switcherWrapper.classList.contains('open')) {
                switcherWrapper.classList.remove('open');
            }
        });

        const themePresets = [
            { id: 'default-dark', name: '系统默认 (深色)', layout: 'default', color: 'dark', dot: '#1e293b' },
            { id: 'default-light', name: '干净纸张 (浅色)', layout: 'default', color: 'light', dot: '#f8fafc' },
            { id: 'default-cyber', name: '赛博朋克 (霓虹)', layout: 'cyberpunk', color: 'cyber', dot: '#00ffcc' },
            { id: 'kamen-rubik', name: '情感色块 (魔方)', layout: 'kamen-rubik', color: 'rubik', dot: '#e11d48' },
            { id: 'minimal-mint', name: '极简无边 (薄荷)', layout: 'minimal', color: 'mint', dot: '#a7f3d0' },
            { id: 'minimal-peach', name: '极简无边 (蜜桃)', layout: 'minimal', color: 'peach', dot: '#fecdd3' },
            { id: 'minimal-sky', name: '极简无边 (晴空)', layout: 'minimal', color: 'sky', dot: '#bae6fd' },
            { id: 'fantasy-dark', name: '西幻冒险 (暗金)', layout: 'fantasy', color: 'dark', dot: '#b8860b' },
            // { id: 'ancient-green', name: '东方竹简 (水墨)', layout: 'ancient', color: 'green', dot: '#14532d' },
            { id: 'detective-light', name: '刑侦机密 (牛皮)', layout: 'detective', color: 'light', dot: '#e6dfcc' },
            { id: 'stationery-light', name: '手札信笺 (网格)', layout: 'stationery', color: 'light', dot: '#faf9f5' }
        ];

        // Current applied state
        const currentLayout = document.documentElement.getAttribute('data-theme-layout') || 'default';
        const currentColor = document.documentElement.getAttribute('data-theme') || 'dark';

        presetList.innerHTML = '';
        themePresets.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'theme-preset-btn';
            if (preset.layout === currentLayout && preset.color === currentColor) {
                btn.classList.add('active');
            }

            btn.innerHTML = `
                <div class="theme-color-dot" style="background-color: ${preset.dot}"></div>
                <span>${preset.name}</span>
                ${preset.layout === currentLayout && preset.color === currentColor ? '<i class="ri-check-line" style="margin-left:auto;"></i>' : ''}
            `;

            btn.addEventListener('click', () => {
                // Save to current data
                if (!this.data.siteSettings) {
                    this.data.siteSettings = {};
                }
                this.data.siteSettings.themeLayout = preset.layout;
                this.data.siteSettings.themeColor = preset.color;

                // Read and Apply
                this.initTheme();

                // Re-render active states
                presetList.querySelectorAll('.theme-preset-btn').forEach(b => {
                    b.classList.remove('active');
                    const icon = b.querySelector('.ri-check-line');
                    if (icon) icon.remove();
                });
                btn.classList.add('active');
                btn.innerHTML += '<i class="ri-check-line" style="margin-left:auto;"></i>';

                // Short wait before closing to show feedback
                setTimeout(() => {
                    switcherWrapper.classList.remove('open');
                }, 300);
            });

            presetList.appendChild(btn);
        });
    }
}
