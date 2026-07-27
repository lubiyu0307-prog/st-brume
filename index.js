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
    const VERSION = '3.1.0';

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

    // ── 角色頭部 ───────────────────────────────────────────────
    function buildHeader() {
        if (document.getElementById('foret-header')) return;
        const el = document.createElement('div');
        el.id = 'foret-header';
        el.innerHTML =
            '<img class="fh-avatar" alt="" />' +
            '<div class="fh-text"><div class="fh-name"></div><div class="fh-sub"></div></div>' +
            '<div class="fh-btn fh-tools fa-solid fa-sliders" title="工具列"></div>' +
            '<div class="fh-btn fh-menu fa-solid fa-ellipsis" title="更多"></div>';
        document.body.appendChild(el);

        el.querySelector('.fh-tools').addEventListener('click', () => {
            const html = document.documentElement;
            if (html.getAttribute('data-foret-tools') === 'on') html.removeAttribute('data-foret-tools');
            else html.setAttribute('data-foret-tools', 'on');
        });
        // 「更多」沿用 ST 原生的訊息選項選單，功能不另做
        el.querySelector('.fh-menu').addEventListener('click', () => {
            const btn = document.getElementById('options_button');
            if (btn) btn.click();
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
        setInterval(detectBackground, 3000);
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
