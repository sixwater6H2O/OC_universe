/**
 * OC Universe Storage Service
 * Handles data persistence using IndexedDB with fallback to js/data.json or hardcoded default
 */
const StorageService = {
    DB_NAME: 'OCUniverseDB',
    STORE_DATA: 'universe_data',
    STORE_ASSETS: 'universe_assets',
    DATA_KEY: 'current_draft',
    _db: null,

    // Hardcoded fallback data in case both IndexedDB and fetch fail
    DEFAULT_DATA: (typeof window !== 'undefined' && window.OC_EXPORTED_DATA) ? window.OC_EXPORTED_DATA : {
        "worldView": {
            "title": "世界观名称",
            "subtitle": "The Subtitle",
            "description": "这是一个自定义的世界观简介。您可以在这里描述该设定的历史背景、核心冲突与特殊现象。\n\n目前的默认数据展示了一个近未来超自然现象的假想设定，请在后台“基础世界观”面板中将其修改为您自己的设定内容。",
            "coverImage": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop",
            "modules": [
                {
                    "id": "mod_1",
                    "name": "势力分类设定",
                    "entries": [
                        {
                            "id": "entry_1",
                            "title": "核心阵营",
                            "content": "描述该势力的基本情况、历史及其在世界中的地位。",
                            "linkedCharIds": [
                                "char_2"
                            ]
                        },
                        {
                            "id": "entry_2",
                            "title": "平民/未知人员",
                            "content": "未受特定组织约束或处于边缘状态的自由人。",
                            "linkedCharIds": [
                                "char_1",
                                "char_3"
                            ]
                        }
                    ]
                }
            ]
        },
        "characters": [
            {
                "id": "char_1",
                "name": "默认角色 A",
                "englishName": "Character A",
                "identity": "组织领袖",
                "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=A&backgroundColor=b6e3f4",
                "info": [
                    {
                        "label": "性别",
                        "value": "男"
                    },
                    {
                        "label": "身高",
                        "value": "178cm"
                    }
                ],
                "bio": "在这个世界中具有重要影响力的角色之一。\n\n||这是一段隐藏的剧透信息。您可以在后台编辑角色时，利用双竖线包裹任意文字来实现此防剧透黑色覆盖块交互。||",
                "relationships": [
                    {
                        "targetId": "char_2",
                        "label": "上下级"
                    },
                    {
                        "targetId": "char_3",
                        "label": "敌对"
                    }
                ]
            },
            {
                "id": "char_2",
                "name": "默认角色 B",
                "englishName": "Character B",
                "identity": "行动干员",
                "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=B&backgroundColor=ffd5dc",
                "info": [
                    {
                        "label": "性别",
                        "value": "女"
                    },
                    {
                        "label": "身高",
                        "value": "165cm"
                    }
                ],
                "bio": "执行一线任务的角色，常与角色A共同出现。",
                "relationships": [
                    {
                        "targetId": "char_1",
                        "label": "信任"
                    }
                ]
            },
            {
                "id": "char_3",
                "name": "默认角色 C",
                "englishName": "Character C",
                "identity": "游荡者",
                "avatar": "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=C",
                "info": [
                    {
                        "label": "性别",
                        "value": "未知"
                    }
                ],
                "bio": "游走在设定边缘的角色，掌握着许多秘密。",
                "relationships": [
                    {
                        "targetId": "char_1",
                        "label": "对立"
                    }
                ]
            }
        ],
        "storyline": [
            {
                "id": "story_1",
                "era": "默认纪元 / 系列 1",
                "date": "20XX年 04月",
                "title": "历史起始事件",
                "description": "这是世界观时间线的第一个节点，标志着主要故事背景的开启。"
            },
            {
                "id": "story_2",
                "era": "默认纪元 / 系列 1",
                "date": "20XX年 09月",
                "title": "中期转折点",
                "description": "可以在这里添加重大变革或战争的爆发。"
            },
            {
                "id": "story_3",
                "era": "新纪元 / 系列 2",
                "date": "20YY年 11月",
                "title": "近期状况",
                "description": "进入了新的时期，角色们面临的环境发生改变。"
            }
        ],
        "novels": [
            {
                "id": "novel_1",
                "categoryId": "cat_main",
                "title": "主要故事文献示例",
                "content": "这是一段用于测试长文本渲染的故事文献。\n\n在“剧情录入”面板中，您可以分词分章地更新所有的相关小说、设定报告或是人物短篇访谈。由于分类导航系统的存在，多类型文献将会有条理地被收纳。"
            },
            {
                "id": "novel_2",
                "categoryId": "cat_side",
                "title": "边缘记录/番外示例",
                "content": "这是一篇被分类到了“支线记录”的文章。您可以通过面板点击不同的分类来测试切换效果。"
            }
        ],
        "novelCategories": [
            {
                "id": "cat_main",
                "name": "主线故事"
            },
            {
                "id": "cat_side",
                "name": "支线记录"
            },
            {
                "id": "cat_if",
                "name": "IF线 (番外)"
            }
        ],
        "siteSettings": {
            "title": "",
            "favicon": "",
            "themeLayout": "default",
            "themeColor": "dark"
        }
    },

    async initDB() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 2);

            // Timeout to prevent hanging in blocked state
            const timeout = setTimeout(() => {
                reject(new Error("IndexedDB opening timed out. There might be an old connection blocking the upgrade."));
            }, 5000);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_DATA)) {
                    db.createObjectStore(this.STORE_DATA);
                }
                if (!db.objectStoreNames.contains(this.STORE_ASSETS)) {
                    db.createObjectStore(this.STORE_ASSETS);
                }
            };

            request.onsuccess = () => {
                clearTimeout(timeout);
                this._db = request.result;
                resolve(this._db);
            };

            request.onerror = () => {
                clearTimeout(timeout);
                reject(request.error);
            };

            request.onblocked = () => {
                console.warn("IndexedDB upgrade blocked. Please close other tabs of this app.");
            };
        });
    },

    /**
     * Load the current world data
     * Priority: IndexedDB Draft -> Fetch js/data.json -> Hardcoded Default
     */
    async load() {
        console.log('StorageService: Loading started...');

        // 1. 优先尝试从 IndexedDB 读取（用户在后台的实时编辑草稿）
        let data = await this._getFromDB(this.STORE_DATA, this.DATA_KEY);

        // 2. 如果没有本地草稿，则尝试寻找打包时注入的静态特征数据 (Static Export)
        if (!data && typeof window !== 'undefined' && window.OC_EXPORTED_DATA) {
            console.log("StorageService: Using injected static export data.");
            data = window.OC_EXPORTED_DATA;
        }

        // 3. 最后退回到 js/data.json 或 硬编码默认值
        if (!data) {
            try {
                console.log("StorageService: All caches empty, fetching data.json...");
                const response = await fetch('js/data.json');
                if (!response.ok) throw new Error("Fetch fallback data.json failed");
                data = await response.json();
            } catch (err) {
                console.warn("StorageService: Local fetch blocked or failed. Using hardcoded DEFAULT_DATA.");
                data = JSON.parse(JSON.stringify(this.DEFAULT_DATA));
            }
        }
        return this.patchData(data);
    },

    async save(data) {
        return this._setToDB(this.STORE_DATA, this.DATA_KEY, data);
    },

    async saveAsset(id, blob) {
        return this._setToDB(this.STORE_ASSETS, id, blob);
    },

    async getAsset(id) {
        return this._getFromDB(this.STORE_ASSETS, id);
    },

    /**
     * Resolves an internal asset path (img/...) to a temporary Object URL
     */
    async resolveImageUrl(path) {
        if (!path || path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;

        if (path.startsWith('img/')) {
            const id = path.replace('img/', '');
            try {
                const blob = await this.getAsset(id);
                if (blob) {
                    return URL.createObjectURL(blob);
                }
            } catch (e) {
                console.warn('StorageService: Failed to resolve asset:', id, e);
            }
        }
        return path;
    },

    async clearAll() {
        try {
            const db = await this.initDB();
            const tx = db.transaction([this.STORE_DATA, this.STORE_ASSETS], 'readwrite');
            tx.objectStore(this.STORE_DATA).clear();
            tx.objectStore(this.STORE_ASSETS).clear();
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve();
            });
        } catch (e) {
            console.error("StorageService: clearAll failed", e);
        }
    },

    /**
     * Data migration patch
     */
    patchData(data) {
        if (!data) return JSON.parse(JSON.stringify(this.DEFAULT_DATA));
        if (!data.worldView) data.worldView = { title: "未命名", description: "" };
        if (!data.worldView.modules) data.worldView.modules = [];
        if (!data.novelCategories) data.novelCategories = [
            { id: "cat_main", name: "主线" }, { id: "cat_side", name: "支线" }
        ];
        if (!data.siteSettings) {
            data.siteSettings = JSON.parse(JSON.stringify(this.DEFAULT_DATA.siteSettings));
        }

        if (data.characters) {
            data.characters.forEach(c => {
                if (!c.relationships) c.relationships = [];
            });
        }

        if (data.storyline) {
            data.storyline.forEach(s => {
                if (!s.era) s.era = "默认纪元";
            });
        }

        if (data.novels) {
            data.novels.forEach(n => {
                if (!n.categoryId) n.categoryId = "cat_main";
            });
        }

        return data;
    },

    // Internal DB helpers
    async _getFromDB(storeName, key) {
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            throw e;
        }
    },

    async _setToDB(storeName, key, value) {
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            throw e;
        }
    }
};
