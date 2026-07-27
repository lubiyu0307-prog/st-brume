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
    const VERSION = '3.10.1';

    const DEFAULTS = Object.freeze({
        enabled: true,      // 套用主題
        immersive: true,    // 沉浸模式：收起工具列，改用角色頭部
        texture: true,      // 巧克力屑底紋（沒有背景圖時）
        compact: false,     // 緊湊行距
        diag: false,        // 空回診斷（預設關；唯讀觀察，不改請求／回應）
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
            }
        } catch (_) { }
        // 背景是使用者隨時可換的，補一個輕量輪詢（每 3 秒，僅讀取樣式）
        setInterval(() => {
            detectBackground(); tradifyMenus(); fixExtensionsPopupLayout();
            markDaySeparators(); markWaiting();
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
            checkboxRow('foret_enabled', '套用黑森林主題', settings.enabled) +
            checkboxRow('foret_immersive', '沉浸模式（收起工具列，改用角色頭部）', settings.immersive, '工具圖示列改由頭部的滑桿鈕點開，功能不減') +
            checkboxRow('foret_texture', '巧克力屑底紋', settings.texture, '設有背景圖時自動讓位') +
            checkboxRow('foret_compact', '緊湊行距', settings.compact) +
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
