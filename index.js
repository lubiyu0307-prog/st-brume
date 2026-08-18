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
    const VERSION = '3.19.1';

    // 皮膚：顏色與造型都由 style.css 的 data-foret-skin 分流；
    // 這裡只需要清單與「狀態列該染什麼色」——Android 的上下系統列
    // 是吃 <meta name="theme-color"> 的，CSS 管不到，換膚必須跟著換。
    const SKINS = [
        { id: 'foret', label: '黑森林 Forêt-Noire', bar: '#33211C' },
        { id: 'dusty', label: '正午 · 霧藍 Midi',   bar: '#43596B' },
    ];

    const DEFAULTS = Object.freeze({
        enabled: true,      // 套用主題
        immersive: true,    // 沉浸模式：收起工具列，改用角色頭部
        texture: true,      // 巧克力屑底紋（沒有背景圖時）
        compact: false,     // 緊湊行距
        diag: false,        // 空回診斷（預設關；唯讀觀察，不改請求／回應）
        ctxmeter: true,     // 上下文用量：頭部顯示百分比，點開看細項
        copyprose: true,    // 每則訊息加一顆「複製正文」（不含狀態欄）
        quickbar: true,     // 快捷列前面插入主題按鈕（做記憶／再來一段）
        skin: 'foret',      // 皮膚：foret（黑森林）／dusty（正午 · 霧藍）
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

    // Android 的系統狀態列（上）與手勢導航列（下）是拿 theme-color
    // 上色的，CSS 管不到。ST 寫死 <meta name="theme-color" content="#333">
    // （manifest 還是 #202124），Android 玩家就會在上下各看到一條灰帶。
    // 執行期改這個 meta 是即時生效的，連已安裝的 PWA 都會蓋過 manifest；
    // iOS 不吃這個值（狀態列透出網頁背景），所以 iOS 看不到灰帶、
    // 改了也無副作用。停用主題時還原 ST 原本的值。
    let themeColorOrig;   // undefined = 尚未動過；null = 原本沒有這個 meta
    function syncThemeColor() {
        try {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (settings.enabled) {
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', 'theme-color');
                    document.head.appendChild(meta);
                    if (themeColorOrig === undefined) themeColorOrig = null;
                } else if (themeColorOrig === undefined) {
                    themeColorOrig = meta.getAttribute('content');
                }
                // 用頭部的底色：狀態列緊貼頭部，這條接縫最顯眼。
                // 換膚時這裡沒跟著改，Android 就會在上下各留一條
                // 別的皮膚的色帶。
                const sk = SKINS.find(x => x.id === settings.skin) || SKINS[0];
                meta.setAttribute('content', sk.bar);
            } else if (meta && themeColorOrig !== undefined) {
                if (themeColorOrig === null) meta.remove();
                else meta.setAttribute('content', themeColorOrig);
                themeColorOrig = undefined;
            }
        } catch (_) { }
    }

    function apply() {
        const html = document.documentElement;
        syncThemeColor();
        if (!settings.enabled) {
            html.removeAttribute('data-foret');
            html.removeAttribute('data-foret-immersive');
            html.removeAttribute('data-foret-texture');
            html.removeAttribute('data-foret-tools');
            html.removeAttribute('data-foret-compact');
            html.removeAttribute('data-foret-skin');
            return;
        }
        html.setAttribute('data-foret', 'on');
        html.setAttribute('data-foret-immersive', settings.immersive ? 'on' : 'off');
        html.setAttribute('data-foret-texture', settings.texture ? 'on' : 'off');
        html.setAttribute('data-foret-compact', settings.compact ? 'on' : 'off');
        html.setAttribute('data-foret-skin',
            SKINS.some(x => x.id === settings.skin) ? settings.skin : 'foret');
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

    // ── 上下文用量 ─────────────────────────────────────────────
    // 資料全部來自 ST 開放給擴充的 API（st-context.js）：
    //   maxContext／getTokenCountAsync／getCharacterCardFields
    //   ／getWorldInfoPrompt／chat
    // 沒有逆向、沒有讀私有變數。
    // 呈現方式依資料視覺化規範決定，不是照抄別人的畫面：
    //   · 「用了幾成」是單一比例對上限 → 量表（meter），不是圓餅
    //   · 四個抬頭數字 → 統計磚（KPI 列）
    //   · 各項佔用 → 部分對全體 → 一條堆疊長條，段間留 2px 空隙
    //   · 五個分項不用五個分類色：主題色票實測過不了分類色檢驗
    //     （焦糖↔開心果正常視力 ΔE 僅 14.5，低於 15 的硬底線），
    //     改用「強調式」——只有「聊天記錄」用櫻桃色，因為它是唯一
    //     會持續長大、也是使用者唯一能處理的項目（做記憶）；
    //     其餘用明度單調遞減的中性可可階，識別靠文字標籤而非顏色。
    //     五色對底色 #241713 的對比皆 ≥3:1（實測 3.29～7.59）。
    // 五個分項的顏色是「行內樣式」，CSS 換膚碰不到，所以每套皮膚各一組。
    // 兩套都照同一個設計邏輯：只有「聊天記錄」上強調色（它是唯一會持續
    // 長大、也是使用者唯一能處理的項目），其餘是明度單調的中性階，
    // 識別靠文字標籤而非顏色。對比皆實測 ≥3:1（非文字元件的門檻）。
    const CTX_PALETTE = {
        // 黑森林：櫻桃＋可可階，對 #241713 實測 3.29～7.59
        foret: { history: '#C8465A', character: '#C9A489', world: '#A98873',
                 persona: '#8E7060', other: '#816655' },
        // 正午：鏽橘＋板岩階，對砂底 #F2E3BC 實測 3.55～8.15
        //（招牌橘 #E4632A 對砂底只有 2.70，色帶會糊掉，所以用鏽橘）
        dusty: { history: '#B0431A', character: '#5B7A92', world: '#4A6578',
                 persona: '#43596B', other: '#31424F' },
    };
    const CTX_SEG = [
        { key: 'history',   label: '聊天記錄', hint: '會一直長大，可用 /nextmemory 壓成記憶' },
        { key: 'character', label: '角色卡',   hint: '角色描述、性格、場景、對話範例' },
        { key: 'world',     label: '世界書',   hint: '這次被觸發的條目' },
        { key: 'persona',   label: '人設',     hint: '你自己的角色描述' },
        { key: 'other',     label: '其他',     hint: '系統提示、格式指令等' },
    ];
    function segColor(key) {
        const p = CTX_PALETTE[settings.skin] || CTX_PALETTE.foret;
        return p[key] || CTX_PALETTE.foret[key];
    }

    const CTX_TOK = new Map();          // 文字 → token 數，避免重複計算
    async function tok(ctx, text) {
        const s = String(text || '');
        if (!s) return 0;
        if (CTX_TOK.has(s)) return CTX_TOK.get(s);
        let n = 0;
        try {
            n = await ctx.getTokenCountAsync(s);
        } catch (_) {
            n = Math.ceil(s.length / 2);   // 取不到分詞器時的粗估
        }
        if (CTX_TOK.size > 300) CTX_TOK.clear();
        CTX_TOK.set(s, n);
        return n;
    }

    // 最近一次「真的送出去」的提示詞（由 CHAT_COMPLETION_PROMPT_READY 取得）。
    // 存全文是為了實測校準：逐欄位檢查「這段有沒有真的被送出」，
    // 沒被預設檔送出的欄位（最常見：對話範例）就不計入。
    let ctxLastSent = null;     // 總 token
    let ctxSentText = '';       // 送出的全文
    let ctxSentHistTok = 0;     // 其中 user／assistant 訊息的 token（= 真實聊天記錄）
    let ctxSentAtLen = 0;       // 送出當下 ctx.chat 的長度（用來補算之後新增的訊息）

    // 單則訊息的粗估（只拿來算「各則之間的比例」，總量另以真分詞器校準；
    // 中日韓字約一字一 token，其餘四字元一 token）
    function estTok(s) {
        s = String(s || '');
        let cjk = 0;
        for (const ch of s) if (ch.charCodeAt(0) > 0x2E7F) cjk++;
        return cjk + Math.ceil((s.length - cjk) / 4) || 1;
    }

    // 唯讀撈 ST 的項目化帳本（localforage 實例『SillyTavern_Prompts』）。
    // 只在資料庫已存在時才開（避免平白創出空庫）；快取 2.5 秒，
    // 3 秒輪詢不會狂敲 IndexedDB。
    const LEDGER_CACHE = { chatId: null, at: 0, data: null };
    async function readPromptLedger(chatId) {
        const now = Date.now();
        if (LEDGER_CACHE.chatId === chatId && now - LEDGER_CACHE.at < 2500) return LEDGER_CACHE.data;
        let data = null;
        try {
            if (typeof indexedDB === 'undefined') return null;
            if (indexedDB.databases) {
                const dbs = await indexedDB.databases();
                if (!dbs.some(d => d && d.name === 'SillyTavern_Prompts')) {
                    LEDGER_CACHE.chatId = chatId; LEDGER_CACHE.at = now; LEDGER_CACHE.data = null;
                    return null;
                }
            }
            data = await new Promise((resolve) => {
                const open = indexedDB.open('SillyTavern_Prompts');
                open.onerror = () => resolve(null);
                open.onblocked = () => resolve(null);
                open.onsuccess = () => {
                    const db = open.result;
                    try {
                        const names = db.objectStoreNames;
                        const store = names.contains('keyvaluepairs') ? 'keyvaluepairs' : names[0];
                        if (!store) { db.close(); return resolve(null); }
                        const req = db.transaction(store, 'readonly').objectStore(store).get(chatId);
                        req.onsuccess = () => { db.close(); resolve(Array.isArray(req.result) ? req.result : null); };
                        req.onerror = () => { db.close(); resolve(null); };
                    } catch (_) { try { db.close(); } catch (_) { } resolve(null); }
                };
            });
        } catch (_) { data = null; }
        LEDGER_CACHE.chatId = chatId; LEDGER_CACHE.at = now; LEDGER_CACHE.data = data;
        return data;
    }

    async function computeContextUsage() {
        const ctx = getContext();
        if (!ctx) return null;

        // 上限與預留回覆依 API 模式取值（script.js getMaxContextTokens／
        // getMaxResponseTokens 的同一套規則）：聊天補全（main_api ==
        // 'openai'，Claude／Gemini 皆屬之）用 openai_max_context 與
        // openai_max_tokens；其餘用 max_context 與 amount_gen。
        // ctx.maxContext 只回報 max_context，在聊天補全下是錯的值。
        const readNum = id => {
            const el = document.getElementById(id);
            return el ? (Number(el.value) || 0) : 0;
        };
        let max, reserve;
        if (String(ctx.mainApi) === 'openai') {
            max = readNum('openai_max_context');
            reserve = readNum('openai_max_tokens');
        } else {
            max = Number(ctx.maxContext) || 0;
            reserve = readNum('amount_gen');
        }
        if (!max) max = Number(ctx.maxContext) || 0;
        if (!max) return null;

        let fields = {};
        try { if (ctx.getCharacterCardFields) fields = ctx.getCharacterCardFields() || {}; } catch (_) { }
        const subst = (s) => {
            try { return ctx.substituteParams ? String(ctx.substituteParams(s)) : String(s); }
            catch (_) { return String(s); }
        };
        // 逐欄位分開算——實測模式要能個別判斷「這欄有沒有真的被送出」。
        // 巨集要先代換（{{user}}／{{char}}），否則跟送出的全文比對不上。
        const CARD_KEYS = ['description', 'personality', 'scenario', 'mesExamples',
                           'system', 'jailbreak', 'charDepthPrompt'];
        const fieldText = {};
        for (const k of CARD_KEYS.concat('persona')) {
            fieldText[k] = (typeof fields[k] === 'string' && fields[k]) ? subst(fields[k]) : '';
        }
        const measured = !!(ctxLastSent && ctxSentText);
        // 拿欄位開頭 80 字到實際送出的全文裡找——找得到才算數；
        // 沒有實測資料（還沒送出過訊息）時一律先計入
        const wasSent = (text) => {
            if (!measured || !text) return true;
            const probe = text.trim().slice(0, 80);
            return probe ? ctxSentText.includes(probe) : false;
        };

        const msgs = (ctx.chat || []).filter(m => m && !m.is_system);
        const msgText = m => (m.name ? m.name + ': ' : '') + (m.mes || '');
        const chatText = msgs.map(msgText).join('\n');

        // 「幽靈」訊息：被 /hide 收起來的真實對話（記憶書做完記憶會自動
        // 隱藏，預設就是開的）。酒館組提示詞時 chat.filter(!is_system)
        // 會把它們整批排除，所以是真的不送出。
        // 酒館自己的系統通知也是 is_system，靠 name 排除（systemUserName
        // 常數為 'SillyTavern System'），才不會把它們算成幽靈。
        const hidden = (ctx.chat || []).filter(m =>
            m && m.is_system && m.name !== 'SillyTavern System').length;

        let wiText = '';
        try {
            // 掃描器吃的是「字串陣列、新到舊」（script.js 的 chatForWI 格式），
            // 傳原始訊息物件進去，關鍵字條目會永遠掃不中。
            // globalScanData 的欄位形狀照抄 script.js 送的那份。
            const chatForWI = msgs.map(msgText).reverse();
            // isDryRun = true：只問不記，不會觸發 WORLD_INFO_ACTIVATED 事件
            const r = await ctx.getWorldInfoPrompt(chatForWI, Math.max(0, max - reserve), true, {
                personaDescription: fieldText.persona,
                characterDescription: fieldText.description,
                characterPersonality: fieldText.personality,
                characterDepthPrompt: fieldText.charDepthPrompt,
                scenario: fieldText.scenario,
                creatorNotes: '',
                trigger: 'normal',
            });
            wiText = typeof r === 'string' ? r : String((r && r.worldInfoString) || '');
        } catch (_) { }

        // 逐欄位分詞：實測模式下只計「真的有被送出」的欄位
        let character = 0;
        for (const k of CARD_KEYS) {
            if (fieldText[k] && wasSent(fieldText[k])) character += await tok(ctx, fieldText[k]);
        }
        let persona = (fieldText.persona && wasSent(fieldText.persona))
            ? await tok(ctx, fieldText.persona) : 0;
        let [world, historyTotal] = await Promise.all([
            tok(ctx, wiText), tok(ctx, chatText),
        ]);

        // ST 幫每次生成都存了一本項目化帳（「提示詞項目化」彈窗讀的
        // 那份，含各段原文與 token 統計，重開酒館也還在）。拿得到就
        // 直接用它——連預設檔把世界書送兩次這類怪癖都被 ST 自己的
        // 分桶吸收，與內建彈窗零差異。
        // staging 版 context 直接公開 itemizedPrompts；release 版沒有，
        // 但帳本本人存在 localforage『SillyTavern_Prompts』（IndexedDB，
        // key 為聊天 ID）——沒出口就自己去唯讀撈同一本。
        let itemized = null;
        try {
            let arr = Array.isArray(ctx.itemizedPrompts) ? ctx.itemizedPrompts : null;
            if (!arr || !arr.length) {
                const chatId = (typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId) || '';
                if (chatId) arr = await readPromptLedger(String(chatId));
            }
            if (arr && arr.length) {
                const oai = arr.filter(r => r && r.main_api === 'openai');
                // 大量刪訊息／記憶壓縮不會清帳，帳本裡可能殘留「已被
                // 刪掉的訊息」的舊記錄——挑 mesId 最大會挑到幽靈
                //（實測：聊天 11 則卻選中 @29 的三十則時代舊帳）。
                // 對齊彈窗的找法：最新一則 AI 回覆的索引，取那一筆；
                // 找不到才在「索引仍存在」的記錄裡挑最大。
                const raw = ctx.chat || [];
                let lastAi = -1;
                for (let i = raw.length - 1; i >= 0; i--) {
                    const m = raw[i];
                    if (m && !m.is_user && !m.is_system) { lastAi = i; break; }
                }
                itemized = oai.find(r => Number(r.mesId) === lastAi) || null;
                if (!itemized) {
                    const valid = oai.filter(r => Number(r.mesId) < raw.length);
                    if (valid.length) itemized = valid.reduce((a, b) => (Number(a.mesId) >= Number(b.mesId) ? a : b));
                }
            }
        } catch (_) { }

        // 酒館不會把整部聊天記錄送出去——只塞「放得下」的最近訊息，
        // 更舊的自動掉出視窗。這裡模擬同一套截斷：從最新往回收，
        // 收到預算用完為止。單則用粗估算比例，整體再對真分詞器的
        // 總量等比校準，避免對每一則各打一次分詞 API。
        const fixed = character + persona + world;
        const budget = Math.max(0, max - reserve - fixed);
        const weights = msgs.map(m => {
            const t = m && m.extra && Number(m.extra.token_count);
            return (t && t > 0) ? t : estTok(msgText(m));
        });
        const estSum = weights.reduce((a, b) => a + b, 0);
        const scale = estSum > 0 ? historyTotal / estSum : 0;
        let simHistory = 0, kept = 0;
        for (let i = msgs.length - 1; i >= 0; i--) {
            const t = weights[i] * scale;
            if (simHistory + t > budget) break;
            simHistory += t; kept++;
        }
        simHistory = Math.round(simHistory);
        const dropped = msgs.length - kept;

        let history = simHistory;
        let other = 0;
        if (itemized) {
            // 照「提示詞項目化」彈窗（itemized-prompts.js 的 openai 分支）
            // 一模一樣的公式分類，總量與彈窗的「提示詞中的總符元數」一致
            const t = async s => await tok(ctx, String(s || ''));
            const n = v => Number(v) || 0;
            const descT = await t(itemized.charDescription);
            const persT = await t(itemized.charPersonality);
            const scenT = await t(itemized.scenarioText);
            const personaT = await t(itemized.userPersona);
            const worldT = await t(itemized.worldInfoString);
            const beforeA = await t(itemized.beforeScenarioAnchor);
            const afterA = await t(itemized.afterScenarioAnchor);
            const promptAdj = n(itemized.oaiPromptTokens) - (beforeA + afterA) + n(itemized.oaiExamplesTokens);
            const histT = n(itemized.oaiConversationTokens);
            const total = n(itemized.oaiStartTokens) + promptAdj + n(itemized.oaiMainTokens)
                + n(itemized.oaiNsfwTokens) + n(itemized.oaiBiasTokens) + n(itemized.oaiImpersonateTokens)
                + n(itemized.oaiJailbreakTokens) + n(itemized.oaiNudgeTokens)
                + histT + worldT + beforeA + afterA;
            character = descT + persT + scenT + n(itemized.oaiExamplesTokens);
            persona = personaT;
            world = worldT;
            // 聊天記錄直接取帳本數字，與內建彈窗完全一致。不做「補算
            // 之後新增的訊息」——刪訊息／記憶壓縮會讓 mesId 位移，
            // 按編號補算必然重複計算（實測多算過一萬）。代價只是
            // 慢一則回覆，下次送出自動跟上。
            history = histT;
            other = Math.max(0, total - character - persona - world - histT);
        } else if (measured) {
            // 後備：舊版 ST 沒公開 itemizedPrompts 時，用送出事件校準
            let extraTok = 0;
            for (const m of (ctx.chat || []).slice(ctxSentAtLen)) {
                if (m && !m.is_system) extraTok += await tok(ctx, msgText(m));
            }
            history = ctxSentHistTok + extraTok;
            other = Math.max(0, ctxLastSent - (character + persona + world + ctxSentHistTok));
        }
        const overflow = Math.max(0, historyTotal - history);
        const prompt = character + persona + world + history + other;

        return {
            max, reserve, prompt, measured: !!itemized || measured,
            // 資料源標記：一眼分辨走的是哪條計算路徑（除錯與回報用）；
            // 帳本模式附上選中的記錄編號與聊天長度，追「補算範圍」的問題
            source: itemized
                ? `帳本@${itemized.mesId}/${(ctx.chat || []).length}`
                : (measured ? '事件' : '估算'),
            used: Math.min(100, Math.round((prompt + reserve) / max * 100)),
            remaining: Math.max(0, max - prompt - reserve),
            parts: { history, character, world, persona, other },
            messages: msgs.length, kept, dropped, overflow, historyTotal, hidden,
        };
    }

    function fmt(n) { return Number(n).toLocaleString('en-US'); }

    // 面板底部第一行：現在看到的是什麼
    function ctxStatusLine(u) {
        if (u.dropped > 0) {
            return `上下文已滿——最舊的 ${fmt(u.dropped)} 則（約 ${fmt(u.overflow)} tokens）`
                + '已掉出模型視野，他記不得那些內容了。';
        }
        return u.measured
            ? '數字取自酒館的提示詞帳本，與內建「提示詞項目化」一致；未被預設檔送出的欄位（如對話範例）不計入。'
            : '尚未送出過訊息，以角色卡／世界書／聊天記錄估算；送出一次後會自動校準。';
    }

    // 面板底部的提醒：一次只給一條，照嚴重程度挑，沒事就不出聲。
    // 每條都必須是「看得到、改得動」的具體動作，不做泛泛的警告。
    function ctxTip(u) {
        // 2,000,000 是酒館「解鎖上下文長度」的最大值，設在這個數字上
        // 等於沒有上限，百分比與警告都失去意義——這是新手最常中的陷阱
        if (u.max >= 2000000) {
            return '上限是「解鎖」的最大值，百分比會失去意義。建議把「上下文長度」設成模型的真實視窗大小'
                + '（若改了會自動跳回，請關掉酒館助手的「最大化預設上下文長度」）。';
        }
        if (u.dropped > 0) {
            return '想讓他記得那些劇情，用 /nextmemory 把那一段壓成記憶。';
        }
        if (u.used >= 85) {
            return '快滿了：現在用 /nextmemory 把最舊的一段壓成記憶，可以先騰出空間。';
        }
        if (u.max > 0 && u.reserve >= u.max * 0.2) {
            return `「預留回覆」佔了上限的 ${Math.round(u.reserve / u.max * 100)}%——那是先扣下來給角色回話的空間。`
                + '調低「最大回應長度」可以立刻多出位子。';
        }
        if (u.max > 0 && u.parts.world >= u.max * 0.25) {
            return '世界書偏大：可用記憶書的壓縮功能合併舊記憶，或把不必每回出場的條目改成關鍵字觸發。';
        }
        if (u.parts.character >= 8000) {
            return '角色卡偏大，多半是「對話範例」那一欄——聊過幾十則之後，範例的作用本來就會被真實對話取代。';
        }
        return '';
    }

    function renderContextPanel(u) {
        const old = document.getElementById('foret-ctx');
        if (old) old.remove();
        if (!u) return;

        const total = Math.max(1, u.prompt);
        const segs = CTX_SEG.filter(s => u.parts[s.key] > 0);
        // 堆疊長條：段與段之間留 2px 底色空隙（規範的 mark spec）
        const bar = segs.map(s =>
            `<i style="flex:${u.parts[s.key]} 0 0;background:${segColor(s.key)}" title="${s.label}"></i>`).join('');

        const rows = CTX_SEG.map(s => {
            const v = u.parts[s.key];
            const pct = Math.round(v / total * 100);
            return '<div class="fx-row">'
                + `<span class="fx-dot" style="background:${segColor(s.key)}"></span>`
                + `<span class="fx-name">${s.label}</span>`
                + `<span class="fx-track"><i style="width:${pct}%;background:${segColor(s.key)}"></i></span>`
                + `<span class="fx-val">${fmt(v)}</span>`
                + '</div>';
        }).join('');

        const level = u.used >= 90 ? 'hot' : (u.used >= 70 ? 'warm' : 'ok');
        const tip = ctxTip(u);
        const box = document.createElement('div');
        box.id = 'foret-ctx';
        box.innerHTML =
            '<div class="fx-head">'
            + '  <span class="fx-title">上下文用量</span>'
            + `  <span class="fx-sub">${fmt(u.prompt)} / ${fmt(u.max)} tokens</span>`
            + '  <button type="button" class="fx-x" title="關閉">✕</button>'
            + '</div>'
            // 單一比例對上限 → 量表
            + `<div class="fx-meter ${level}"><i style="width:${u.used}%"></i></div>`
            + '<div class="fx-tiles">'
            + `  <div class="fx-tile"><b>${u.used}%</b><span>已用</span></div>`
            + `  <div class="fx-tile"><b>${fmt(u.remaining)}</b><span>剩餘</span></div>`
            + `  <div class="fx-tile"><b>${fmt(u.reserve)}</b><span>預留回覆</span></div>`
            + `  <div class="fx-tile"><b>${u.dropped > 0 ? fmt(u.kept) + '/' + fmt(u.messages) : fmt(u.messages)}</b><span>${u.dropped > 0 ? '窗內／全部訊息' : '訊息則數'}</span></div>`
            + '</div>'
            + `<div class="fx-stack">${bar}</div>`
            + `<div class="fx-rows">${rows}</div>`
            + '<div class="fx-note">'
            + `<span class="fx-status">${ctxStatusLine(u)}</span>`
            + (u.hidden > 0
                ? `<span class="fx-ghost">另有 ${fmt(u.hidden)} 則已收為幽靈，不會送出——那是記憶書整理過的段落，劇情由世界書裡的記憶接手。</span>`
                : '')
            + (tip ? `<span class="fx-tip">${tip}</span>` : '')
            + `<span class="fx-meta">v${VERSION}·${u.source}</span>`
            + '</div>';
        document.body.appendChild(box);
        box.querySelector('.fx-x').addEventListener('click', () => box.remove());
    }

    async function refreshCtxChip() {
        const chip = document.querySelector('#foret-header .fh-ctx');
        if (!chip) return;
        if (!settings.ctxmeter) { chip.style.display = 'none'; return; }
        chip.style.display = '';
        try {
            const u = await computeContextUsage();
            if (!u) { chip.textContent = '—'; return; }
            chip.textContent = u.used + '%';
            chip.dataset.level = u.used >= 90 ? 'hot' : (u.used >= 70 ? 'warm' : 'ok');
        } catch (_) { }
    }

    // ── 等待動畫：滾動的櫻桃 ───────────────────────────────────
    // ST 生成時會先放一則內容是「…」的佔位訊息（script.js 的
    // firstMessageText = '...'），開始串流才換成真正的字。
    // 這裡把那則佔位訊息標記起來，交給 style.css 換成滾動的櫻桃。
    // 必須同時確認「正在生成」——否則角色真的只回一個「…」時，
    // 那顆櫻桃會永遠留在畫面上。生成中的訊號用停止鍵的顯示狀態
    //（script.js 生成時 #mes_stop 設 display:flex，結束設 none）。
    function isGenerating() {
        const stop = document.getElementById('mes_stop');
        if (!stop) return false;
        try {
            const cs = getComputedStyle(stop);
            return cs.display !== 'none' && cs.visibility !== 'hidden';
        } catch (_) { return false; }
    }

    // 浮動等待列：關閉串流時，ST 要等整個回覆收完才建立訊息
    //（Generate() 會 await 完才 addOneMessage），等待期間聊天區
    // 空無一物，沒有東西可以附著。所以另外放一列在輸入框正上方。
    // 它是 #form_sheld 的前一個兄弟節點，不在 #chat 裡——ST 對
    // .mes 的索引完全不受影響。
    function ensureWaitBar(show) {
        let el = document.getElementById('foret-wait');
        if (!show) { if (el) el.remove(); return; }
        if (!el) {
            const form = document.getElementById('form_sheld');
            if (!form || !form.parentNode) return;
            el = document.createElement('div');
            el.id = 'foret-wait';
            el.innerHTML = '<span class="fw-ava"><img alt="" /></span>'
                + '<span class="fw-bub"><span class="fw-ball"></span></span>';
            form.parentNode.insertBefore(el, form);
        }
        // 借頭部那張角色頭貼，等待列才知道是誰在寫
        try {
            const src = (document.querySelector('#foret-header .fh-avatar') || {}).src || '';
            const img = el.querySelector('.fw-ava img');
            if (img && src && img.getAttribute('src') !== src) img.setAttribute('src', src);
            if (img) img.style.visibility = src ? 'visible' : 'hidden';
        } catch (_) { }
    }

    // 等待中的訊息只有一顆櫻桃，永遠在浮動等待列上。
    // 開串流時 ST 會先插一則內容是「…」的佔位訊息——那就是使用者
    // 看到的「空框」。這裡把它收掉：完全沒內容的整則隱藏，只有
    // 思考內容的則保留思考摺疊、把空的內文區藏起來，不留一塊空白。
    const isBlank = (s) => { const t = (s || '').trim(); return t === '' || t === '...' || t === '…'; };

    function markWaiting() {
        const gen = isGenerating();
        const rows = document.querySelectorAll('#chat .mes');

        for (const row of rows) {
            const t = row.querySelector('.mes_text');
            const txt = t ? t.textContent : '';
            // 必須同時確認正在生成——否則角色真的只回一個「…」時，
            // 那則訊息會被永遠藏起來。
            if (gen && isBlank(txt)) {
                const r = row.querySelector('.mes_reasoning');
                const hasReason = r && (r.textContent || '').trim().length > 0;
                const mode = hasReason ? 'reason' : 'bare';
                if (row.getAttribute('data-foret-wait') !== mode) row.setAttribute('data-foret-wait', mode);
            } else if (row.hasAttribute('data-foret-wait')) {
                row.removeAttribute('data-foret-wait');
            }
        }

        // 一開始串流出字就收起等待列，交棒給真正的訊息
        const last = rows[rows.length - 1];
        let streaming = false;
        if (last && last.getAttribute('is_user') !== 'true') {
            const lt = last.querySelector('.mes_text');
            streaming = !isBlank(lt ? lt.textContent : '');
        }
        ensureWaitBar(gen && !streaming);
    }

    // ── 空回診斷 ───────────────────────────────────────────────
    // 為什麼需要：ST 的 onError 只在後端丟出 error 物件時才提示
    //（script.js 的 onError 只看 exception.error.message）。但空回最常見
    // 的情況是 HTTP 200、請求成功、內容卻是空的——被安全過濾擋掉、
    // token 全花在思考上、或模型直接停住。那時 ST 沒有任何錯誤可報，
    // 只會把佔位訊息刪掉，使用者什麼線索都沒有。
    // 這些線索其實都在回應裡（finish_reason／blockReason／safetyRatings
    // ／usage），這裡把它們撈出來顯示。
    // 原則：只讀 response.clone()，絕不改請求或回應；分析在背景進行，
    // 不阻塞串流；自身任何例外都吞掉，絕不影響生成。
    const GEN_URLS = [
        '/api/backends/chat-completions/generate',
        '/api/backends/text-completions/generate',
        '/api/backends/kobold/generate',
        '/api/backends/koboldhorde/generate',
        '/api/novelai/generate',
    ];

    function newAcc() {
        return { len: 0, finish: new Set(), block: new Set(), safety: new Set(), err: new Set(), usage: {} };
    }

    // 從一段回應 JSON 收集線索。涵蓋 OpenAI／Claude／Gemini／Kobold
    // ／NovelAI／text-completions 六種形狀，抓不到的欄位就跳過。
    function collect(d, acc) {
        if (!d || typeof d !== 'object') return;
        const texts = [];
        try {
            if (Array.isArray(d.choices)) {
                for (const c of d.choices) {
                    const mc = c && c.message && c.message.content;
                    if (typeof mc === 'string') texts.push(mc);
                    if (Array.isArray(mc)) for (const p of mc) if (p && typeof p.text === 'string') texts.push(p.text);
                    if (typeof (c && c.text) === 'string') texts.push(c.text);
                    if (typeof (c && c.delta && c.delta.content) === 'string') texts.push(c.delta.content);
                    if (c && c.finish_reason) acc.finish.add(String(c.finish_reason));
                    if (c && c.finish_details && c.finish_details.type) acc.finish.add(String(c.finish_details.type));
                }
            }
            if (Array.isArray(d.content)) for (const p of d.content) if (p && typeof p.text === 'string') texts.push(p.text);
            if (d.delta && typeof d.delta.text === 'string') texts.push(d.delta.text);
            if (d.stop_reason) acc.finish.add(String(d.stop_reason));

            if (Array.isArray(d.candidates)) {
                for (const c of d.candidates) {
                    if (c && c.finishReason) acc.finish.add(String(c.finishReason));
                    const parts = c && c.content && c.content.parts;
                    // thought:true 的段落是思考內容，不算正式輸出
                    if (Array.isArray(parts)) for (const p of parts) {
                        if (p && typeof p.text === 'string' && !p.thought) texts.push(p.text);
                    }
                    if (Array.isArray(c && c.safetyRatings)) {
                        for (const r of c.safetyRatings) {
                            if (r && (r.blocked || ['HIGH', 'MEDIUM'].includes(r.probability))) {
                                acc.safety.add(String(r.category || '').replace('HARM_CATEGORY_', '')
                                    + '：' + (r.blocked ? '已阻擋' : r.probability));
                            }
                        }
                    }
                }
            }
            if (d.promptFeedback && d.promptFeedback.blockReason) acc.block.add(String(d.promptFeedback.blockReason));

            if (Array.isArray(d.results)) {
                for (const r of d.results) {
                    if (r && typeof r.text === 'string') texts.push(r.text);
                    if (r && r.finish_reason) acc.finish.add(String(r.finish_reason));
                }
            }
            if (typeof d.text === 'string') texts.push(d.text);
            if (Array.isArray(d.generations)) for (const g of d.generations) if (g && typeof g.text === 'string') texts.push(g.text);

            const u = d.usage || d.usageMetadata;
            if (u) {
                const pick = (...v) => v.find(x => typeof x === 'number');
                const p = pick(u.prompt_tokens, u.input_tokens, u.promptTokenCount);
                const o = pick(u.completion_tokens, u.output_tokens, u.candidatesTokenCount);
                const t = pick(u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens,
                               u.thoughtsTokenCount);
                if (p !== undefined) acc.usage.prompt = p;
                if (o !== undefined) acc.usage.out = o;
                if (t !== undefined) acc.usage.think = t;
            }

            const e = d.error;
            if (e) {
                acc.err.add(typeof e === 'string' ? e
                    : [e.code, e.type, e.message].filter(Boolean).join(' · ') || JSON.stringify(e).slice(0, 300));
            }
            if (!d.error && typeof d.message === 'string' && d.message && !texts.length && d.message.length < 400) {
                acc.err.add(d.message);
            }
        } catch (_) { }
        for (const t of texts) if (t) acc.len += t.length;
    }

    // 串流是 SSE：逐行取出 data: 後面的 JSON 丟進同一個收集器
    async function readSSE(res, acc) {
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        if (!reader) return;
        const dec = new TextDecoder();
        let buf = '';
        let seen = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            seen += value ? value.length : 0;
            if (seen > 8 * 1024 * 1024) { try { reader.cancel(); } catch (_) { } break; }
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
                const s = line.trim();
                if (!s.startsWith('data:')) continue;
                const payload = s.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try { collect(JSON.parse(payload), acc); } catch (_) { }
            }
        }
    }

    const FINISH_HINT = {
        length: ['長度上限用完', '回覆的 token 上限在還沒寫出內容前就用光了。若有開思考／推理，多半是全花在思考上——調高回覆長度上限，或把思考預算調低。'],
        max_tokens: ['長度上限用完', '回覆的 token 上限用光了。調高回覆長度上限。'],
        MAX_TOKENS: ['長度上限用完', '回覆的 token 上限用光了；有開思考的話通常是被思考吃掉。調高上限或降低思考預算。'],
        content_filter: ['被內容過濾擋下', '供應商的安全過濾攔截了這次回覆。改寫最後一則訊息，或換一個沒有這道過濾的模型。'],
        SAFETY: ['被安全過濾擋下', 'Gemini 的安全評分判定超標。可在該模型的安全設定放寬門檻，或改寫觸發的段落。'],
        RECITATION: ['疑似複述受版權保護的內容', '模型判定輸出過於接近訓練資料原文而中止。改寫提示或提高溫度通常可解。'],
        PROHIBITED_CONTENT: ['內容被供應商禁止', '這次的請求觸及供應商的禁止類別，回覆在產生前就被擋下。'],
        BLOCKLIST: ['命中封鎖字詞清單', '提示或回覆包含供應商封鎖清單裡的字詞。'],
        OTHER: ['供應商未說明原因', '供應商回報中止但沒有給理由，通常仍是安全或系統面的攔截。'],
        tool_calls: ['只呼叫了工具、沒有輸出文字', '模型這回合只發出工具呼叫。若你沒有要用工具，檢查是否誤啟用了函式呼叫。'],
        function_call: ['只呼叫了函式、沒有輸出文字', '模型這回合只發出函式呼叫，沒有產生正文。'],
        stop: ['模型自己停住了', '模型判定「已經講完」但一個字都沒寫。多半是提示詞、前綴或停止序列（stop sequence）設定造成，檢查停止序列是不是太早被觸發。'],
        end_turn: ['模型自己結束了回合', '沒有輸出任何內容就結束。檢查提示詞結構與停止序列。'],
    };

    function buildReport(info) {
        const rows = [];
        const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push([k, String(v)]); };
        add('狀態', info.status === 0 ? '連線失敗（沒有收到回應）' : info.status + ' ' + (info.ok ? 'OK' : (info.statusText || '')));
        const finish = Array.from(info.acc.finish);
        add('結束原因', finish.join('、'));
        add('阻擋原因', Array.from(info.acc.block).join('、'));
        add('安全評分', Array.from(info.acc.safety).join('、'));
        const u = info.acc.usage;
        if (u.prompt !== undefined || u.out !== undefined || u.think !== undefined) {
            const parts = [];
            if (u.prompt !== undefined) parts.push('提示 ' + u.prompt);
            if (u.think !== undefined) parts.push('思考 ' + u.think);
            if (u.out !== undefined) parts.push('輸出 ' + u.out);
            add('token', parts.join(' · '));
        }
        add('錯誤訊息', Array.from(info.acc.err).join(' / '));
        add('端點', info.url);

        // 挑一個最能解釋的原因當標題
        let hint = null;
        for (const b of info.acc.block) if (FINISH_HINT[b]) { hint = FINISH_HINT[b]; break; }
        if (!hint) for (const f of finish) if (FINISH_HINT[f]) { hint = FINISH_HINT[f]; break; }
        if (!hint && info.acc.block.size) hint = ['被供應商阻擋', '阻擋原因：' + Array.from(info.acc.block).join('、')];
        if (!hint && !info.ok) hint = ['請求沒有成功', '後端回了 ' + info.status + '。詳細見下方錯誤訊息。'];
        if (!hint && info.status === 0) hint = ['連不到後端', '請求沒有送達或被中斷，檢查網路與 API 設定。'];
        if (!hint) hint = ['回覆是空的，但供應商沒說原因', '請求成功、也沒有結束原因或錯誤——通常是代理／中轉服務吞掉了內容。可以把下面這份資料複製給我。'];
        return { title: hint[0], desc: hint[1], rows };
    }

    function showDiag(info) {
        try {
            const old = document.getElementById('foret-diag');
            if (old) old.remove();
            const r = buildReport(info);
            const box = document.createElement('div');
            box.id = 'foret-diag';
            const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            box.innerHTML =
                '<div class="fd-head">' +
                '  <span class="fd-dot"></span>' +
                '  <span class="fd-title">' + esc(r.title) + '</span>' +
                '  <button type="button" class="fd-x" title="關閉">✕</button>' +
                '</div>' +
                '<div class="fd-desc">' + esc(r.desc) + '</div>' +
                '<dl class="fd-rows">' +
                r.rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') +
                '</dl>' +
                '<div class="fd-acts"><button type="button" class="fd-copy">複製診斷</button></div>';
            document.body.appendChild(box);
            box.querySelector('.fd-x').addEventListener('click', () => box.remove());
            box.querySelector('.fd-copy').addEventListener('click', (e) => {
                const txt = '【黑森林空回診斷】' + r.title + '\n' + r.desc + '\n'
                    + r.rows.map(([k, v]) => k + '：' + v).join('\n');
                const btn = e.currentTarget;
                const done = () => { btn.textContent = '已複製'; setTimeout(() => { btn.textContent = '複製診斷'; }, 1500); };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(txt).then(done, done);
                } else { done(); }
            });
        } catch (_) { }
    }

    function installDiagnostics() {
        if (typeof window.fetch !== 'function' || window.__foretDiag) return;
        window.__foretDiag = true;
        const orig = window.fetch;
        window.fetch = function (...args) {
            let url = '';
            try { url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || ''; } catch (_) { }
            const watch = settings.diag && GEN_URLS.some(g => String(url).includes(g));
            if (!watch) return orig.apply(this, args);

            return orig.apply(this, args).then((res) => {
                // 分析在背景跑，立刻把原始 response 還給 ST——不阻塞串流
                try {
                    const clone = res.clone();
                    const acc = newAcc();
                    const ct = (res.headers && res.headers.get('content-type')) || '';
                    const finish = () => {
                        if (acc.len > 0 && res.ok) return;   // 有內容就不打擾
                        showDiag({ url: String(url), status: res.status, statusText: res.statusText, ok: res.ok, acc });
                    };
                    if (ct.includes('event-stream')) {
                        readSSE(clone, acc).then(finish, finish);
                    } else {
                        clone.text().then((t) => {
                            try { collect(JSON.parse(t), acc); }
                            catch (_) { if (t && !res.ok) acc.err.add(t.slice(0, 300)); if (t && res.ok) acc.len += t.length; }
                            finish();
                        }, finish);
                    }
                } catch (_) { }
                return res;
            }, (e) => {
                try {
                    const acc = newAcc();
                    acc.err.add((e && e.message) || String(e));
                    showDiag({ url: String(url), status: 0, statusText: '', ok: false, acc });
                } catch (_) { }
                throw e;   // 一定要重新拋出，否則 ST 的錯誤處理會斷掉
            });
        };
    }

    // ── 日期分隔線 ─────────────────────────────────────────────
    // ST 的聊天沒有日期分隔（原始碼確認過）。這裡判斷「這則是當天
    // 第一則」，把日期字串寫進 data-foret-day，交給 style.css 用偽
    // 元素畫成奶油淋醬線——不往 #chat 插入任何節點，ST 對 .mes 的
    // 索引（updateViewMessageIds 等）不受影響。
    const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
                    'july', 'august', 'september', 'october', 'november', 'december'];

    // send_date 的格式來自 ST 的 parseTimestamp（public/scripts/utils.js），
    // 這裡照著同一組樣式解析，解不出來就放棄（不畫分隔線）。
    function parseSendDate(v) {
        if (v === null || v === undefined || v === '') return null;
        if (v instanceof Date) return isNaN(v) ? null : v;
        if (typeof v === 'number' || /^\d+$/.test(String(v))) {
            const d = new Date(Number(v));
            return isNaN(d) ? null : d;
        }
        const s = String(v);
        let m;
        // 2024-07-12@01h31m37s123ms ／ 2024-7-12@01h31m37s ／ 2024-6-5 @14h 56m 50s 682ms
        m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m\s*(\d{1,2})s/);
        if (m) {
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                               Number(m[4]), Number(m[5]), Number(m[6]));
            return isNaN(d) ? null : d;
        }
        // June 19, 2023 2:20pm
        m = s.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (m) {
            const mo = MONTHS.indexOf(m[1].toLowerCase());
            if (mo >= 0) {
                let h = Number(m[4]) % 12;
                if (m[6].toLowerCase() === 'pm') h += 12;
                const d = new Date(Number(m[3]), mo, Number(m[2]), h, Number(m[5]));
                return isNaN(d) ? null : d;
            }
        }
        const d = new Date(s);          // ISO 8601 等瀏覽器認得的格式
        return isNaN(d) ? null : d;
    }

    function dayKey(d) {
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function dayLabel(d) {
        const today = new Date();
        if (dayKey(d) === dayKey(today)) return '今天';
        const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        if (dayKey(d) === dayKey(y)) return '昨天';
        const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
        const sameYear = d.getFullYear() === today.getFullYear();
        return (sameYear ? '' : d.getFullYear() + '年')
            + (d.getMonth() + 1) + '月' + d.getDate() + '日（週' + week + '）';
    }

    // ── 正午：把「圓角來源不明」的外殼就地方化 ───────────────────
    // 彈窗與抽屜的圓角實機上壓不掉：主題對 .popup／.drawer-content
    // 的規則在霧藍下確實解析為 0（已量測），但畫面仍是圓的——代表圓角
    // 來自另一個容器或另一個擴充（酒館助手也在美化 UI，且可能比本主題
    // 晚載入）。CSS 選不到祖先，所以這裡從彈窗往上走幾層，量到誰真的
    // 圓就地補一條行內樣式；行內樣式贏過任何外部 CSS。
    // 只在正午皮膚動手，切回黑森林時把動過的清乾淨。
    const SQUARE_ANCHORS = 'dialog, .popup, .dialogue_popup, .drawer-content';
    function squareShells() {
        const on = settings.enabled && settings.skin === 'dusty';
        if (!on) {
            document.querySelectorAll('[data-fn-sq]').forEach((el) => {
                el.style.removeProperty('border-radius');
                el.removeAttribute('data-fn-sq');
            });
            return;
        }
        document.querySelectorAll(SQUARE_ANCHORS).forEach((el) => {
            let n = el;
            for (let i = 0; n && n !== document.body && i < 5; i++, n = n.parentElement) {
                if (n.hasAttribute('data-fn-sq')) continue;
                let r = 0;
                try { r = parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0; } catch (_) { }
                if (r > 4) {
                    n.style.setProperty('border-radius', '0', 'important');
                    n.setAttribute('data-fn-sq', '');
                }
            }
        });
    }

    // ── 主題快捷 ───────────────────────────────────────────────
    // 掛在酒館快捷列（#qr--bar）的最前面：那排是「單排橫向捲動、
    // 靠左起始」，所以插在頭上的永遠看得到，使用者自己的快速回覆
    // 往後捲，不佔任何新的垂直空間。沒有快捷列的人退到輸入列左側。
    //
    // 每顆都先確認指令真的註冊了才顯示——沒裝記憶書的玩家不會拿到
    // 一顆死鍵。
    const QUICK = [
        {
            id: 'mem', cmd: 'nextmemory', icon: 'fa-book',
            title: '做記憶：把上一段記憶之後到現在壓成新記憶（不必自己標範圍）',
            run: '/nextmemory',
        },
        {
            id: 'more', cmd: 'trigger', icon: 'fa-forward',
            title: '再來一段：讓他生成一則新訊息，劇情繼續推進（不是續寫在同一個泡泡裡）',
            run: '/trigger',
            // /trigger 會清空輸入框（防遞歸），先接住草稿再放回去
            keepDraft: true,
        },
    ];

    function hasCommand(ctx, name) {
        try {
            const reg = ctx && ctx.SlashCommandParser && ctx.SlashCommandParser.commands;
            return !!(reg && reg[name]);
        } catch (_) { return false; }
    }

    async function runQuick(item) {
        const ctx = getContext();
        if (!ctx || typeof ctx.executeSlashCommandsWithOptions !== 'function') return false;
        const ta = document.getElementById('send_textarea');
        const draft = (item.keepDraft && ta) ? ta.value : '';
        try {
            await ctx.executeSlashCommandsWithOptions(item.run);
        } catch (_) { return false; }
        if (draft && ta) {
            // /trigger 的清空是排在 setTimeout 裡的，要等它做完才放回
            setTimeout(() => {
                if (!ta.value) {
                    ta.value = draft;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 600);
        }
        return true;
    }

    function addQuickButtons() {
        if (!settings.quickbar) {
            document.querySelectorAll('.fn-quick').forEach(b => b.remove());
            return;
        }
        // 固定掛在輸入列左側，與 ☰／魔法棒同一排：純圖示、不佔垂直空間。
        // 早期版本會在快捷列還沒生成時先掉進這裡、之後又在快捷列補一份，
        // 同一顆按鈕出現兩次——所以現在只認一個宿主，並清掉任何流落在
        // 別處的殘留。
        const host = document.getElementById('leftSendForm');
        if (!host) return;
        document.querySelectorAll('.fn-quick').forEach((b) => {
            if (b.parentElement !== host) b.remove();
        });

        const ctx = getContext();
        // 反向插入，才能一路 prepend 成 QUICK 宣告的順序
        for (const item of [...QUICK].reverse()) {
            const exists = host.querySelector(`.fn-quick[data-fn-quick="${item.id}"]`);
            if (!hasCommand(ctx, item.cmd)) { if (exists) exists.remove(); continue; }
            if (exists) continue;
            const btn = document.createElement('div');
            btn.className = `fn-quick fa-solid ${item.icon}`;
            btn.dataset.fnQuick = item.id;
            btn.title = item.title;
            host.prepend(btn);
        }
    }

    document.addEventListener('click', async (e) => {
        const btn = e.target && e.target.closest && e.target.closest('.fn-quick');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        if (btn.classList.contains('fn-quick-busy')) return;
        const item = QUICK.find(q => q.id === btn.dataset.fnQuick);
        if (!item) return;
        btn.classList.add('fn-quick-busy');
        const ok = await runQuick(item);
        btn.classList.remove('fn-quick-busy');
        btn.classList.add(ok ? 'fn-quick-ok' : 'fn-quick-bad');
        setTimeout(() => btn.classList.remove('fn-quick-ok', 'fn-quick-bad'), 900);
    }, true);

    // ── 複製正文 ───────────────────────────────────────────────
    // 酒館內建的複製（.mes_copy）給的是 chat[id].mes 原文，狀態欄、
    // 場景卡那些 HTML 會整包跟著出來，想分享劇情時得自己手動清。
    // 這顆按鈕改為從「已渲染的畫面」上取，只留敘述與對話。
    //
    // 判準：角色卡的狀態區塊一律是「有框的容器」——div／table／
    // details，或帶 style／class 的元素；而敘述與對話經 markdown
    // 渲染後是乾淨的 <p>。所以只收頂層的 p 與純文字節點。
    const PROSE_OK = new Set(['P', 'BLOCKQUOTE', 'EM', 'STRONG', 'I', 'B', 'Q', 'SPAN', 'BR', 'A', 'DEL', 'S', 'U', 'SMALL', 'MARK']);

    function extractProse(mesText) {
        const clone = mesText.cloneNode(true);
        // 明確不要的東西（含黑森林自己插的日期分隔與等待動畫）
        clone.querySelectorAll(
            'details, table, pre, code, button, input, select, textarea, ' +
            'progress, meter, hr, img, svg, iframe, audio, video, ' +
            '.fn-daysep, .fn-waitbar, [data-fn-skip]'
        ).forEach(el => el.remove());

        const parts = [];
        for (const node of Array.from(clone.childNodes)) {
            if (node.nodeType === 3) {                       // 文字節點
                const t = node.textContent.trim();
                if (t) parts.push(t);
                continue;
            }
            if (node.nodeType !== 1) continue;
            // 有框的容器 = 狀態欄，跳過
            if (!PROSE_OK.has(node.tagName)) continue;
            if (node.hasAttribute('style') || node.hasAttribute('class')) continue;
            const t = node.textContent.replace(/[ \t]+/g, ' ').trim();
            if (t) parts.push(t);
        }

        let out = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
        // 保底：整則都被包在容器裡（有些卡會這樣寫）時不要交白卷。
        // 先撿裡面所有段落——這樣段落之間還留得住空行；真的連一個
        // <p> 都沒有才退回整則純文字。
        if (!out) {
            const ps = Array.from(clone.querySelectorAll('p'))
                .map(el => el.textContent.replace(/[ \t]+/g, ' ').trim())
                .filter(Boolean);
            out = ps.length
                ? ps.join('\n\n')
                : (clone.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        }
        return out;
    }

    async function copyProse(mes) {
        const mesText = mes && mes.querySelector('.mes_text');
        if (!mesText) return false;
        const text = extractProse(mesText);
        if (!text) return false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (_) { /* iOS 在非使用者手勢或無權限時會擋，往下走後備 */ }
        // 後備：隱藏 textarea + execCommand（與酒館 copyText 同一套）
        try {
            const parent = document.querySelector('dialog[open]:last-of-type') || document.body;
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
            parent.appendChild(ta);
            ta.focus();
            ta.setSelectionRange(0, ta.value.length);
            const ok = document.execCommand('copy');
            parent.removeChild(ta);
            return ok;
        } catch (_) { return false; }
    }

    function addProseCopyButtons() {
        if (!settings.copyprose) {
            document.querySelectorAll('#chat .fn-copy').forEach(b => b.remove());
            return;
        }
        document.querySelectorAll('#chat .mes .mes_buttons').forEach((row) => {
            if (row.querySelector('.fn-copy')) return;
            const btn = document.createElement('div');
            btn.className = 'fn-copy mes_button fa-solid fa-clipboard';
            btn.title = '複製正文（不含狀態欄）';
            btn.setAttribute('data-fn-skip', '');
            // 插在 ⋯ 之前，跟編輯鉛筆同一排
            const hint = row.querySelector('.extraMesButtonsHint');
            if (hint) row.insertBefore(btn, hint);
            else row.prepend(btn);
        });
    }

    // 事件委派掛一次就好——訊息是動態插入的
    document.addEventListener('click', async (e) => {
        const btn = e.target && e.target.closest && e.target.closest('#chat .fn-copy');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        const ok = await copyProse(btn.closest('.mes'));
        // 用打勾短暫回饋，不搶 toastr 的版面
        btn.classList.remove('fa-clipboard', 'fa-check', 'fa-xmark');
        btn.classList.add(ok ? 'fa-check' : 'fa-xmark');
        if (ok) btn.classList.add('fn-copy-ok');
        setTimeout(() => {
            btn.classList.remove('fa-check', 'fa-xmark', 'fn-copy-ok');
            btn.classList.add('fa-clipboard');
        }, 1100);
    }, true);

    function markDaySeparators() {
        const rows = document.querySelectorAll('#chat .mes');
        if (!rows.length) return;
        let chat = null;
        try {
            const ctx = getContext();
            chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
        } catch (_) { }
        if (!chat) return;

        let prevKey = null;
        for (const row of rows) {
            const id = Number(row.getAttribute('mesid'));
            const mes = Number.isFinite(id) ? chat[id] : null;
            const d = mes ? parseSendDate(mes.send_date) : null;
            if (!d) { row.removeAttribute('data-foret-day'); continue; }
            const key = dayKey(d);
            if (key !== prevKey) {
                const label = dayLabel(d);
                if (row.getAttribute('data-foret-day') !== label) {
                    row.setAttribute('data-foret-day', label);
                }
                prevKey = key;
            } else if (row.hasAttribute('data-foret-day')) {
                row.removeAttribute('data-foret-day');
            }
        }
    }

    // ── 擴充管理彈窗：版面矯正（量測式，不猜 class 名）─────────
    // 前幾版失敗的原因：用 CSS 猜 ST 的 class 名稱去縮按鈕、撐容器，
    // 猜錯就完全無效，而且看不出來。這裡改成不依賴任何 class：
    //   1. 沿 DOM 往上把每層容器的行內寬度改回 auto（ST 開窗時會
    //      把舊的像素寬度寫進行內樣式，CSS 蓋不掉具體數值）
    //   2. 逐一檢查每列的子元素：有文字的＝名稱（可縮、刪節號），
    //      沒文字的＝圖示鈕（固定 30px 不可縮）；成組的按鈕容器
    //      再往下一層處理
    //   3. 最後「量」一次：若最後一顆按鈕仍超出列的右緣，就改成
    //      換行（名稱一行、按鈕一行）——保證任何情況都不會被裁
    const BTN = 30;

    function sizeIconButton(el) {
        el.style.setProperty('flex', 'none', 'important');
        el.style.setProperty('width', BTN + 'px', 'important');
        el.style.setProperty('height', BTN + 'px', 'important');
        el.style.setProperty('min-width', BTN + 'px', 'important');
        el.style.setProperty('max-width', BTN + 'px', 'important');
        el.style.setProperty('padding', '0', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('flex-shrink', '0', 'important');
    }

    function fixExtensionRow(row) {
        // ST 用 .displayNone 收納元件——被藏起來的一律不碰，
        // 否則行內 display 會把它們全部翻出來（更新鈕就是這樣中招的）
        if (row.classList.contains('displayNone')) return;
        row.style.setProperty('display', 'flex', 'important');
        row.style.setProperty('flex-direction', 'row', 'important');
        row.style.setProperty('flex-wrap', 'nowrap', 'important');
        row.style.setProperty('align-items', 'center', 'important');
        row.style.setProperty('gap', '5px', 'important');
        row.style.setProperty('overflow', 'visible', 'important');
        row.style.setProperty('width', 'auto', 'important');
        row.style.setProperty('max-width', '100%', 'important');
        row.style.setProperty('box-sizing', 'border-box', 'important');

        let nameEl = null;
        for (const child of Array.from(row.children)) {
            if (child.tagName === 'INPUT') {           // 勾選框
                child.style.setProperty('flex', 'none', 'important');
                child.style.setProperty('margin', '0', 'important');
                continue;
            }
            const hasText = (child.textContent || '').trim().length > 0;
            if (hasText) {                              // 名稱（唯一有文字的）
                if (!nameEl) nameEl = child;
                child.style.setProperty('flex', '1 1 auto', 'important');
                child.style.setProperty('min-width', '0', 'important');
                child.style.setProperty('overflow', 'hidden', 'important');
                child.style.setProperty('text-overflow', 'ellipsis', 'important');
                child.style.setProperty('white-space', 'nowrap', 'important');
                child.style.setProperty('text-align', 'left', 'important');
            } else if (child.children.length >= 2) {    // 成組的按鈕容器
                child.style.setProperty('flex', 'none', 'important');
                if (!child.classList.contains('displayNone')) {
                    child.style.setProperty('display', 'flex', 'important');
                }
                child.style.setProperty('flex-wrap', 'nowrap', 'important');
                child.style.setProperty('gap', '5px', 'important');
                child.style.setProperty('width', 'auto', 'important');
                child.style.setProperty('padding', '0', 'important');
                child.style.setProperty('margin', '0', 'important');
                for (const btn of Array.from(child.children)) sizeIconButton(btn);
            } else {                                    // 單顆圖示鈕
                sizeIconButton(child);
            }
        }

        // 量測：最後一個元素若仍超出列的內緣，改成換行版面。
        // 名稱的 basis 設成「整列寬 − 60px」，剛好讓第一行放得下
        // 勾選框＋圖示＋名稱，而任何一顆按鈕都擠不進去 → 必定換行。
        const last = row.children[row.children.length - 1];
        if (!last) return;
        const rowRect = row.getBoundingClientRect();
        const padR = parseFloat(getComputedStyle(row).paddingRight) || 0;
        if (last.getBoundingClientRect().right > rowRect.right - padR + 1) {
            row.style.setProperty('flex-wrap', 'wrap', 'important');
            row.style.setProperty('row-gap', '7px', 'important');
            if (nameEl) nameEl.style.setProperty('flex', '1 1 calc(100% - 60px)', 'important');
        }
    }

    function fixExtensionsPopupLayout() {
        const rows = document.querySelectorAll('.extension_block');
        if (!rows.length) return;
        // 1) 容器：把行內寫死的舊寬度改回 auto
        const seen = new Set();
        for (const row of rows) {
            let el = row.parentElement;
            let hops = 0;
            while (el && hops < 10 && el.tagName !== 'DIALOG' && el.tagName !== 'BODY'
                   && !el.classList.contains('popup')) {
                if (!seen.has(el)) {
                    seen.add(el);
                    el.style.setProperty('width', 'auto', 'important');
                    el.style.setProperty('max-width', '100%', 'important');
                    el.style.setProperty('min-width', '0', 'important');
                    el.style.setProperty('margin-left', '0', 'important');
                    el.style.setProperty('margin-right', '0', 'important');
                    el.style.setProperty('overflow-x', 'visible', 'important');
                }
                el = el.parentElement;
                hops++;
            }
        }
        // 2) 每一列（容器改完後才量，量到的才是最終寬度）
        for (const row of rows) {
            try { fixExtensionRow(row); } catch (_) { }
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
            // 頭貼外面包一層，奶油扇貝環與櫻桃徽章才有地方掛
            //（img 是取代元素，偽元素不會算圖）
            '<span class="fh-ava"><img class="fh-avatar" alt="" /></span>' +
            '<div class="fh-text"><div class="fh-name"></div><div class="fh-sub"></div></div>' +
            '<div class="fh-ctx" title="上下文用量">—</div>' +
            '<div class="fh-btn fh-tools fa-solid fa-sliders" title="工具列"></div>';
        document.body.appendChild(el);

        el.querySelector('.fh-tools').addEventListener('click', () => {
            const html = document.documentElement;
            if (html.getAttribute('data-foret-tools') === 'on') html.removeAttribute('data-foret-tools');
            else html.setAttribute('data-foret-tools', 'on');
        });
        el.querySelector('.fh-ctx').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (document.getElementById('foret-ctx')) {
                document.getElementById('foret-ctx').remove();
                return;
            }
            try { renderContextPanel(await computeContextUsage()); } catch (_) { }
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
        // 沒有角色時整組收起——奶油環與櫻桃徽章掛在外層，
        // 只藏 img 的話會剩一圈空環浮著
        const ava = el.querySelector('.fh-ava');
        if (avatar) {
            img.src = avatar;
            if (ava) ava.style.visibility = 'visible';
        } else {
            img.removeAttribute('src');
            if (ava) ava.style.visibility = 'hidden';
        }
    }

    function hookEvents() {
        try {
            const ctx = getContext();
            if (ctx && ctx.eventSource && ctx.event_types) {
                const evs = [ctx.event_types.CHAT_CHANGED, ctx.event_types.CHARACTER_EDITED,
                             ctx.event_types.GROUP_UPDATED, ctx.event_types.SETTINGS_UPDATED].filter(Boolean);
                evs.forEach(e => ctx.eventSource.on(e, () => {
                    updateHeader(); detectBackground(); markDaySeparators();
                }));
                // 生成開始／結束是等待動畫最精準的訊號，直接掛事件；
                // 結束時多補一次（ST 先隱藏停止鍵才收尾，稍慢一拍）
                const genEvs = [ctx.event_types.GENERATION_STARTED, ctx.event_types.GENERATION_ENDED,
                                ctx.event_types.GENERATION_STOPPED].filter(Boolean);
                genEvs.forEach(e => ctx.eventSource.on(e, () => {
                    markWaiting();
                    setTimeout(markWaiting, 120);
                    setTimeout(markWaiting, 500);
                }));
                // 量到「真的送出去」的提示詞總量，用來校準估算值
                const ready = ctx.event_types.CHAT_COMPLETION_PROMPT_READY;
                if (ready) {
                    ctx.eventSource.on(ready, async (data) => {
                        try {
                            // 乾跑（dry run）也會發這個事件——酒館算 token 條、
                            // 開聊天時都會乾跑，內容可能與真實送出不同，必須跳過
                            if (data && data.dryRun) return;
                            const arr = data && Array.isArray(data.chat) ? data.chat : null;
                            if (!arr) return;
                            // content 可能是多模態陣列（圖片＋文字），只取文字部分
                            const text = m => {
                                const c = m && m.content;
                                if (typeof c === 'string') return c;
                                if (Array.isArray(c)) return c
                                    .map(p => (p && typeof p.text === 'string') ? p.text : '')
                                    .filter(Boolean).join('\n');
                                return '';
                            };
                            const all = arr.map(text).join('\n');
                            const hist = arr
                                .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
                                .map(text).join('\n');
                            ctxSentText = all;
                            const now = getContext();
                            ctxSentAtLen = (now && now.chat ? now.chat : []).length;
                            ctxLastSent = await tok(ctx, all);
                            ctxSentHistTok = await tok(ctx, hist);
                            setTimeout(refreshCtxChip, 250);
                        } catch (_) { }
                    });
                }
                // 換聊天時必須把事件校準的記憶歸零——那是「上一個聊天」
                // 的實測帳，帶過來會讓全新聊天顯示舊聊天的用量
                if (ctx.event_types.CHAT_CHANGED) {
                    ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => {
                        ctxLastSent = null;
                        ctxSentText = '';
                        ctxSentHistTok = 0;
                        ctxSentAtLen = 0;
                    });
                }
                [ctx.event_types.CHAT_CHANGED, ctx.event_types.MESSAGE_SENT,
                 ctx.event_types.MESSAGE_RECEIVED, ctx.event_types.MESSAGE_DELETED]
                    .filter(Boolean)
                    .forEach(e => ctx.eventSource.on(e, () => setTimeout(refreshCtxChip, 250)));
            }
        } catch (_) { }
        // 背景是使用者隨時可換的，補一個輕量輪詢（每 3 秒，僅讀取樣式）
        setInterval(() => {
            detectBackground(); tradifyMenus(); fixExtensionsPopupLayout();
            markDaySeparators(); markWaiting(); refreshCtxChip(); addProseCopyButtons(); addQuickButtons(); squareShells();
        }, 3000);
        // 選單／彈窗是點擊後才生成內容的——任何點擊後補跑一次
        //（capture 階段掛，stopPropagation 也擋不掉；兩者皆具冪等性）
        document.addEventListener('click', () => setTimeout(() => {
            tradifyMenus();
            fixExtensionsPopupLayout();
        }, 120), true);
        // 彈窗是動態插入的——用 MutationObserver 在它出現的當下就矯正，
        // 不必等輪詢（否則使用者會先看到 0～3 秒的壞版面）
        try {
            // 200ms 防抖：訊息串流時 DOM 會狂插入，不節流會拖慢舊機
            let timer = null;
            const observer = new MutationObserver(() => {
                if (timer) return;
                timer = setTimeout(() => {
                    timer = null;
                    tradifyMenus();
                    fixExtensionsPopupLayout();
                    markDaySeparators();
                    markWaiting();
                    addProseCopyButtons();
        addQuickButtons();
        squareShells();
                    addQuickButtons();
                }, 200);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) { }
        // 停止鍵的顯示狀態就是「正在生成」的權威訊號——直接盯它的
        // 屬性變化，等待動畫才能在按下送出的當下就出現。
        // 關閉串流時聊天區在等待期間毫無變動，光靠上面那個
        // MutationObserver 是等不到的。
        (function attachStopWatch(tries) {
            const stop = document.getElementById('mes_stop');
            if (!stop) {
                if (tries < 40) setTimeout(() => attachStopWatch(tries + 1), 500);
                return;
            }
            try {
                new MutationObserver(() => {
                    markWaiting();
                    setTimeout(markWaiting, 80);
                }).observe(stop, { attributes: true, attributeFilter: ['style', 'class'] });
            } catch (_) { }
        })(0);
        // 轉向／視窗尺寸改變後重新量一次
        window.addEventListener('resize', () => setTimeout(fixExtensionsPopupLayout, 120));
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
            checkboxRow('foret_enabled', '套用主題', settings.enabled) +
            '<label class="flex-container alignItemsCenter" for="foret_skin" style="gap:8px;margin:0" ' +
            'title="顏色、圓角、字體與裝飾整組切換；功能完全相同">' +
            '<span style="flex:1">皮膚</span>' +
            `<select id="foret_skin" class="text_pole" style="width:190px;flex:none">${
                SKINS.map(sk => `<option value="${sk.id}"${sk.id === settings.skin ? ' selected' : ''}>${sk.label}</option>`).join('')
            }</select>` +
            '</label>' +
            checkboxRow('foret_immersive', '沉浸模式（收起工具列，改用角色頭部）', settings.immersive, '工具圖示列改由頭部的滑桿鈕點開，功能不減') +
            checkboxRow('foret_texture', '巧克力屑底紋', settings.texture, '設有背景圖時自動讓位') +
            checkboxRow('foret_compact', '緊湊行距', settings.compact) +
            checkboxRow('foret_ctxmeter', '上下文用量（頭部顯示百分比，點開看細項）', settings.ctxmeter,
                '資料取自 ST 開放的 API：maxContext／getTokenCountAsync／角色卡欄位／世界書') +
            checkboxRow('foret_quickbar', '主題快捷按鈕（快捷列最前面加「做記憶」「再來一段」）', settings.quickbar,
                '偵測不到對應指令時自動隱藏，例如沒裝記憶書就不會出現「做記憶」') +
            checkboxRow('foret_copyprose', '複製正文按鈕（每則訊息加一顆，只複製敘述與對話）', settings.copyprose,
                '酒館內建的複製會連狀態欄的 HTML 一起帶走；這顆只取畫面上的敘述與對話') +
            checkboxRow('foret_diag', '空回診斷（回覆是空的時候說明原因）', settings.diag,
                '只讀取回應副本來顯示 finish_reason／安全阻擋／token 用量，不修改請求或回應') +
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
        bind('foret_diag', 'diag');
        bind('foret_ctxmeter', 'ctxmeter');
        bind('foret_copyprose', 'copyprose');
        bind('foret_quickbar', 'quickbar');
        panel.querySelector('#foret_skin').addEventListener('change', (e) => {
            settings.skin = SKINS.some(x => x.id === e.target.value) ? e.target.value : 'foret';
            apply();
            saveSettings();
            // 換膚後裝飾與按鈕要重掛一次（圓角／顏色由 CSS 走，但
            // 等待動畫與快捷鈕的狀態要立刻反映）
            markWaiting(); addQuickButtons(); addProseCopyButtons(); refreshCtxChip();
            squareShells();
        });
    }

    function init() {
        console.log('[Forêt-Noire] v' + VERSION);
        bustStyleCache();
        settings = loadSettings();
        installDiagnostics();   // 只掛一次；實際是否分析由 settings.diag 決定
        buildHeader();
        hookEvents();
        apply();
        buildPanel();
        setTimeout(refreshCtxChip, 1200);
        addProseCopyButtons();
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
