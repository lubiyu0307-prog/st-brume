/* ═══════════════════════════════════════════════════════════════
   Forêt-Noire — 黑森林巧克力主題 for SillyTavern（index.js）
   職責：
     1. 在 <html> 掛 data-foret-* 屬性驅動 style.css
     2. 生成角色頭部（沉浸模式）並隨聊天／角色切換更新
     3. 偵測使用者是否設了背景圖，讓蛋糕層自動轉半透明
     4. 「擴充功能」頁註冊設定面板
   純外觀層：不碰訊息處理、regex、變數、世界書邏輯。
   ═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    const MODULE = 'foret_noire';
    const LS_KEY = 'foret_noire_settings';
    const VERSION = '3.5.0';

    const DEFAULTS = Object.freeze({
        enabled: true,      // 套用主題
        immersive: true,    // 沉浸模式：收起工具列，改用角色頭部
        texture: true,      // 巧克力屑底紋（沒有背景圖時）
        compact: false,     // 緊湊行距
    });

    function getContext() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                return SillyTavern.getContext();
            }
        } catch (_) { /* 舊版無全域 SillyTavern */ }
        return null;
    }

    function loadSettings() {
        const ctx = getContext();
        if (ctx && ctx.extensionSettings) {
            ctx.extensionSettings[MODULE] = Object.assign({}, DEFAULTS, ctx.extensionSettings[MODULE]);
            return ctx.extensionSettings[MODULE];
        }
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_) { }
        return Object.assign({}, DEFAULTS, saved);
    }

    let settings = loadSettings();

    function saveSettings() {
        const ctx = getContext();
        if (ctx && ctx.extensionSettings) {
            ctx.extensionSettings[MODULE] = settings;
            if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
        }
        try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (_) { }
    }

    // 快取剋星：iOS Safari／PWA 會抱著舊 style.css 不放
    function bustStyleCache() {
        try {
            document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
                const href = l.getAttribute('href') || '';
                if (href.includes('style.css') && /st-brume|foret/i.test(href) && !href.includes('v=' + VERSION)) {
                    l.setAttribute('href', href.split('?')[0] + '?v=' + VERSION);
                }
            });
        } catch (_) { }
    }

    // 使用者是否設了背景圖——有的話蛋糕層轉半透明，讓照片透出來
    function detectBackground() {
        let hasBg = false;
        try {
            for (const id of ['bg1', 'bg_custom']) {
                const el = document.getElementById(id);
                if (!el) continue;
                const img = getComputedStyle(el).backgroundImage;
                if (img && img !== 'none' && !/^\s*$/.test(img)) { hasBg = true; break; }
            }
        } catch (_) { }
        document.documentElement.setAttribute('data-foret-bg', hasBg ? 'on' : 'off');
    }

    function apply() {
        const html = document.documentElement;
        if (!settings.enabled) {
            html.removeAttribute('data-foret');
            html.removeAttribute('data-foret-immersive');
            html.removeAttribute('data-foret-texture');
            html.removeAttribute('data-foret-tools');
            html.removeAttribute('data-foret-compact');
            return;
        }
        html.setAttribute('data-foret', 'on');
        html.setAttribute('data-foret-immersive', settings.immersive ? 'on' : 'off');
        html.setAttribute('data-foret-texture', settings.texture ? 'on' : 'off');
        html.setAttribute('data-foret-compact', settings.compact ? 'on' : 'off');
        if (!settings.immersive) html.removeAttribute('data-foret-tools');
        detectBackground();
        updateHeader();
    }

    // ── 選單繁體化 ─────────────────────────────────────────────
    // ✨／☰ 選單裡的項目文字來自各擴充自帶的字串，常混簡體；
    // 粉圓體只有繁體字集，簡體字會落到系統字體，字面就花掉了。
    // 這裡做逐字簡→繁替換（只動這兩個選單的文字節點，不碰訊息）。
    const S2T_TABLE =
        '时時 忆憶 词詞 变變 楼樓 层層 馆館 记記 图圖 页頁 网網 视視 频頻 声聲 读讀 写寫 ' +
        '说說 话話 语語 译譯 输輸 应應 简簡 体體 转轉 换換 开開 关關 闭閉 启啟 动動 项項 ' +
        '设設 单單 选選 择擇 编編 辑輯 删刪 复複 制製 备備 载載 导導 状狀 态態 显顯 隐隱 ' +
        '标標 签籤 会會 员員 组組 队隊 请請 发發 讯訊 号號 码碼 认認 证證 错錯 误誤 问問 ' +
        '题題 帮幫 机機 志誌 与與 为為 于於 后後 点點 击擊 线線 连連 触觸 内內 历歷 类類 ' +
        '别別 样樣 风風 颜顏 键鍵 盘盤 数數 据據 库庫 处處 优優 级級 缓緩 头頭 计計 币幣 ' +
        '价價 电電 现現 实實 验驗 测測 试試 运運 结結 继繼 续續 暂暫 终終 脚腳 权權 无無 ' +
        '没沒 见見 观觀 览覽 报報 统統 传傳 递遞 链鏈 检檢 过過 滤濾 顺順 随隨 属屬 参參 ' +
        '响響 预預 览覽 战戰 术術 击擊 张張 缩縮 释釋 义義 议議 论論 评評 审審 阅閱 兰蘭 ' +
        '临臨 监監 盖蓋 尝嘗 释釋 铃鈴 闹鬧 钟鐘 唤喚 醒醒 归歸 档檔 忧憂 虑慮 惊驚 恶惡 ' +
        '压壓 扩擴 补補 丢丟 弃棄 荐薦 让讓 许許 讲講 谢謝 谁誰 调調 贴貼 购購 费費 资資 ' +
        '赛賽 车車 轻輕 边邊 达達 迁遷 邮郵 释釋 锁鎖 错錯 长長 门門 闪閃 间間 阵陣 队隊 ' +
        '风風 饰飾 马馬 驱驅 骂罵 鱼魚 鸟鳥 龙龍 龟龜 齐齊 举舉 乐樂 书書 买買 乱亂 云雲 ' +
        '亚亞 从從 众眾 优優 伤傷 侧側 侦偵 储儲 儿兒 党黨 全全 养養 兽獸 冲衝 决決 况況 ' +
        '净淨 凑湊 击擊 创創 务務 勋勳 势勢 匹匹 区區 医醫 华華 协協 单單 卖賣 占佔 卫衛 ' +
        '厅廳 压壓 厉厲 参參 双雙 叙敘 只隻 叶葉 吗嗎 吧吧 听聽 启啟 呈呈 员員 呗唄 响響 ' +
        '哑啞 唤喚 啸嘯 喷噴 嘱囑 团團 园園 围圍 国國 圆圓 圣聖 场場 坏壞 块塊 坚堅 垫墊 ' +
        '埋埋 塑塑 填填 增增 壁壁 壮壯 声聲 复復 够夠 头頭 夹夾 夺奪 奋奮 奖獎 妆妝 娱娛 ' +
        '嫌嫌 学學 宁寧 宝寶 实實 审審 宽寬 宾賓 寻尋 对對 寿壽 将將 尔爾 尘塵 尝嘗 尽盡 ' +
        '异異 弹彈 归歸 当當 录錄 彻徹 征徵 径徑 忆憶 态態 怀懷 怜憐 总總 恋戀 恳懇 悬懸 ' +
        '惯慣 愿願 战戰 户戶 抢搶 护護 择擇 挂掛 挡擋 挤擠 损損 换換 据據 掷擲 摄攝 摆擺 ' +
        '摊攤 撑撐 斗鬥 断斷 旧舊 时時 显顯 晓曉 暗暗 曲曲 术術 朴樸 机機 杀殺 杂雜 权權 ' +
        '条條 来來 杨楊 构構 枪槍 柜櫃 树樹 样樣 检檢 桥橋 梦夢 检檢 楼樓 概概 榜榜 槽槽 ' +
        '横橫 欢歡 欧歐 歼殲 残殘 段段 毁毀 气氣 汉漢 汇匯 沟溝 没沒 泪淚 泽澤 洁潔 测測 ' +
        '济濟 浅淺 浏瀏 涂塗 润潤 涨漲 渐漸 温溫 湾灣 溃潰 满滿 滚滾 滤濾 漏漏 潜潛 澄澄 ' +
        '灭滅 灯燈 灵靈 烁爍 热熱 焕煥 爱愛 牵牽 状狀 犹猶 独獨 猫貓 献獻 玛瑪 环環 现現 ' +
        '珍珍 琐瑣 瑶瑤 疗療 痒癢 皱皺 盏盞 监監 盘盤 眬矓 着著 睁睜 瞒瞞 矫矯 码碼 硕碩 ' +
        '确確 碍礙 礼禮 祷禱 禅禪 离離 种種 积積 称稱 稳穩 穷窮 窃竊 窗窗 竖豎 笔筆 筛篩 ' +
        '签簽 简簡 类類 粤粵 紧緊 絮絮 纠糾 红紅 纤纖 约約 级級 纪紀 纯純 纳納 纵縱 纷紛 ' +
        '纸紙 纹紋 线線 练練 组組 细細 织織 终終 绍紹 经經 绑綁 绕繞 绘繪 给給 络絡 绝絕 ' +
        '统統 继繼 绩績 绪緒 续續 维維 绵綿 缀綴 缓緩 编編 缘緣 缠纏 缩縮 缴繳 网網 罗羅 ' +
        '罚罰 罢罷 职職 联聯 聋聾 肃肅 肠腸 肤膚 胁脅 脏臟 脑腦 腾騰 舰艦 舱艙 艺藝 节節 ' +
        '芦蘆 苏蘇 苹蘋 范範 荐薦 荡蕩 荣榮 药藥 莱萊 获獲 萝蘿 营營 蓝藍 蔷薔 薄薄 藏藏 ' +
        '虏虜 虑慮 虚虛 虫蟲 蚀蝕 蜡蠟 血血 补補 表表 装裝 里裡 见見 观觀 规規 觅覓 视視 ' +
        '览覽 觉覺 誉譽 计計 订訂 认認 讨討 让讓 训訓 议議 讯訊 记記 讲講 许許 论論 设設 ' +
        '访訪 证證 评評 识識 诉訴 词詞 译譯 试試 诗詩 话話 询詢 该該 详詳 语語 误誤 说說 ' +
        '请請 诸諸 读讀 调調 谈談 谊誼 谋謀 谐諧 谜謎 谢謝 谱譜 贝貝 负負 贡貢 财財 责責 ' +
        '败敗 账賬 货貨 质質 贩販 贪貪 购購 贯貫 费費 贴貼 贵貴 贸貿 赁賃 资資 赋賦 赏賞 ' +
        '赐賜 赖賴 赛賽 赠贈 赢贏 走走 赵趙 趋趨 跃躍 践踐 车車 轨軌 转轉 轮輪 软軟 轰轟 ' +
        '轻輕 载載 较較 辅輔 辆輛 辈輩 辞辭 辩辯 辫辮 边邊 辽遼 达達 迁遷 过過 迈邁 运運 ' +
        '还還 这這 进進 远遠 违違 连連 迟遲 适適 选選 逊遜 递遞 逻邏 遗遺 邓鄧 邮郵 邻鄰 ' +
        '郑鄭 释釋 里裡 鉴鑑 针針 钉釘 钓釣 钟鐘 钢鋼 钥鑰 钦欽 钱錢 铁鐵 铃鈴 铅鉛 银銀 ' +
        '销銷 锁鎖 锅鍋 锋鋒 错錯 锚錨 锦錦 键鍵 锻鍛 镇鎮 镜鏡 长長 门門 闪閃 闭閉 问問 ' +
        '闲閒 间間 闷悶 闹鬧 闻聞 阅閱 阐闡 阔闊 队隊 阳陽 阴陰 阵陣 阶階 际際 陆陸 陈陳 ' +
        '险險 隐隱 难難 雾霧 静靜 韩韓 页頁 顶頂 项項 顺順 须須 顽頑 顾顧 顿頓 预預 领領 ' +
        '频頻 题題 颜顏 额額 风風 飘飄 飞飛 饭飯 饮飲 饰飾 饱飽 馆館 馈饋 驶駛 驻駐 驾駕 ' +
        '验驗 骑騎 髅髏 鬓鬢 魇魘 鸡雞 鸣鳴 鸭鴨 鹅鵝 麦麥 黄黃 龄齡';
    const S2T = {};
    for (const pair of S2T_TABLE.split(/\s+/)) {
        if (pair.length === 2 && pair[0] !== pair[1]) S2T[pair[0]] = pair[1];
    }
    function toTraditional(str) {
        let out = '';
        for (const ch of str) out += S2T[ch] || ch;
        return out;
    }
    function tradifyMenus() {
        for (const id of ['extensionsMenu', 'options']) {
            const root = document.getElementById(id);
            if (!root) continue;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const t = toTraditional(node.nodeValue);
                if (t !== node.nodeValue) node.nodeValue = t;
            }
        }
    }

    // ── 角色頭部 ───────────────────────────────────────────────
    function buildHeader() {
        if (document.getElementById('foret-header')) return;
        const el = document.createElement('div');
        el.id = 'foret-header';
        // 「更多（⋯）」按鈕已移除：它開的與輸入列左下的 ☰ 是同一個
        // 選單，而經 JS 轉發的點擊在 iOS 上始終開不出來——留著只是
        // 一顆死鍵。選單一律從 ☰ 進。
        el.innerHTML =
            '<img class="fh-avatar" alt="" />' +
            '<div class="fh-text"><div class="fh-name"></div><div class="fh-sub"></div></div>' +
            '<div class="fh-btn fh-tools fa-solid fa-sliders" title="工具列"></div>';
        document.body.appendChild(el);

        el.querySelector('.fh-tools').addEventListener('click', () => {
            const html = document.documentElement;
            if (html.getAttribute('data-foret-tools') === 'on') html.removeAttribute('data-foret-tools');
            else html.setAttribute('data-foret-tools', 'on');
        });
    }

    function updateHeader() {
        const el = document.getElementById('foret-header');
        if (!el) return;
        let name = '', avatar = '', sub = '';
        try {
            const ctx = getContext();
            if (ctx) {
                const ch = (ctx.characters || [])[ctx.characterId];
                if (ch) {
                    name = ch.name || '';
                    avatar = '/thumbnail?type=avatar&file=' + encodeURIComponent(ch.avatar || '');
                    const line = (ch.creatorcomment || ch.description || '').split('\n').find(Boolean) || '';
                    sub = line.slice(0, 42);
                } else if (ctx.groupId && Array.isArray(ctx.groups)) {
                    const g = ctx.groups.find(x => String(x.id) === String(ctx.groupId));
                    if (g) { name = g.name || ''; sub = (g.members || []).length + ' 位成員'; }
                }
            }
        } catch (_) { }
        if (!name) { name = 'SillyTavern'; sub = '尚未選擇角色'; }
        el.querySelector('.fh-name').textContent = name;
        el.querySelector('.fh-sub').textContent = sub;
        const img = el.querySelector('.fh-avatar');
        if (avatar) { img.src = avatar; img.style.visibility = 'visible'; }
        else { img.removeAttribute('src'); img.style.visibility = 'hidden'; }
    }

    function hookEvents() {
        try {
            const ctx = getContext();
            if (ctx && ctx.eventSource && ctx.event_types) {
                const evs = [ctx.event_types.CHAT_CHANGED, ctx.event_types.CHARACTER_EDITED,
                             ctx.event_types.GROUP_UPDATED, ctx.event_types.SETTINGS_UPDATED].filter(Boolean);
                evs.forEach(e => ctx.eventSource.on(e, () => { updateHeader(); detectBackground(); }));
            }
        } catch (_) { }
        // 背景是使用者隨時可換的，補一個輕量輪詢（每 3 秒，僅讀取樣式）
        setInterval(() => { detectBackground(); tradifyMenus(); }, 3000);
        // 選單是點擊後才生成內容的——任何點擊後補轉一次繁體
        //（capture 階段掛，stopPropagation 也擋不掉；替換具冪等性）
        document.addEventListener('click', () => setTimeout(tradifyMenus, 80), true);
    }

    // ── 設定面板 ───────────────────────────────────────────────
    function checkboxRow(id, label, checked, hint) {
        return (
            `<label class="checkbox_label" for="${id}" ${hint ? `title="${hint}"` : ''}>` +
            `<input id="${id}" type="checkbox" ${checked ? 'checked' : ''} />` +
            `<span>${label}</span>` +
            '</label>'
        );
    }

    function buildPanel() {
        const container = document.getElementById('extensions_settings2')
            || document.getElementById('extensions_settings');
        if (!container || document.getElementById('foret-ext-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'foret-ext-panel';
        panel.innerHTML =
            '<div class="inline-drawer">' +
            '  <div class="inline-drawer-toggle inline-drawer-header">' +
            `    <b>黑森林 <small style="opacity:.55;font-weight:400">v${VERSION}</small></b>` +
            '    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
            '  </div>' +
            '  <div class="inline-drawer-content">' +
            '    <div class="flex-container flexFlowColumn" style="gap:8px; padding:4px 0;">' +
            checkboxRow('foret_enabled', '套用黑森林主題', settings.enabled) +
            checkboxRow('foret_immersive', '沉浸模式（收起工具列，改用角色頭部）', settings.immersive, '工具圖示列改由頭部的滑桿鈕點開，功能不減') +
            checkboxRow('foret_texture', '巧克力屑底紋', settings.texture, '設有背景圖時自動讓位') +
            checkboxRow('foret_compact', '緊湊行距', settings.compact) +
            '    </div>' +
            '  </div>' +
            '</div>';
        container.appendChild(panel);

        const bind = (id, key) => {
            panel.querySelector('#' + id).addEventListener('change', (e) => {
                settings[key] = !!e.target.checked;
                apply();
                saveSettings();
            });
        };
        bind('foret_enabled', 'enabled');
        bind('foret_immersive', 'immersive');
        bind('foret_texture', 'texture');
        bind('foret_compact', 'compact');
    }

    function init() {
        console.log('[Forêt-Noire] v' + VERSION);
        bustStyleCache();
        settings = loadSettings();
        buildHeader();
        hookEvents();
        apply();
        buildPanel();
        let tries = 0;
        const retry = setInterval(() => {
            buildPanel();
            if (document.getElementById('foret-ext-panel') || ++tries > 20) clearInterval(retry);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
