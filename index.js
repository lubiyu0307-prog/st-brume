/* ═══════════════════════════════════════════════════════════════
   Brume UI — SillyTavern 介面擴充（index.js）
   職責：
   1. 生成夜空背景層（#brume-sky：漸層／星空／霧／極光／水族館）
   2. 在 <html> 上掛 data-brume-* 屬性驅動 style.css
   3. 「擴充功能」頁註冊設定面板（主題／主色／泡泡／夜空／模糊／動態／窄版）
   設定經 SillyTavern 的 extensionSettings 持久化；拿不到 context 時
   （極舊版本）退回 localStorage，樣式照常生效。
   ═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    const MODULE = 'st_brume';
    const LS_KEY = 'st_brume_settings';
    const VERSION = '1.0.5';

    const DEFAULTS = Object.freeze({
        theme: 'aurora',     // aurora | aquarium | night
        accent: 'default',   // 主色 preset key
        bubbles: true,       // LINE 式泡泡
        sky: true,           // Brume 夜空背景（關閉＝還原 ST 背景圖）
        blur: true,          // 玻璃模糊（手機發熱可關）
        motion: true,        // 背景動畫
        narrow: false,       // 手機窄版（聊天欄收成置中窄欄）
    });

    const THEMES = [
        { key: 'aurora', label: '極光（黑夜星空）' },
        { key: 'aquarium', label: '水族館（深夜水槽）' },
        { key: 'night', label: '夜霧（墨藍純色）' },
    ];

    // 與 Brume 本體 src/services/theme.js 同一組主色
    const ACCENTS = [
        { key: 'default', label: '預設（跟著主題）', hex: '' },
        { key: 'lavender', label: '薰衣草', hex: '#B9A8E8' },
        { key: 'sakura', label: '櫻粉', hex: '#E8A8C4' },
        { key: 'skyblue', label: '極夜藍', hex: '#7FB0E8' },
        { key: 'honey', label: '蜜金', hex: '#E8C880' },
        { key: 'mist', label: '霧綠', hex: '#7FD8C0' },
    ];

    function getContext() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                return SillyTavern.getContext();
            }
        } catch (_) { /* 舊版沒有全域 SillyTavern */ }
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

    // ── 主色覆寫：比照 Brume applyAccent——一張 !important 覆寫表，
    //    deep 提亮半階、pale 壓深色底、glass 半透明（color-mix 推導）。
    function applyAccent(hex) {
        const id = 'brume-st-accent';
        let el = document.getElementById(id);
        if (!hex) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent =
            ':root[data-brume-theme]{' +
            `--brume-accent:${hex} !important;` +
            `--brume-accent-deep:color-mix(in srgb, ${hex} 74%, #fff) !important;` +
            `--brume-accent-pale:color-mix(in srgb, ${hex} 20%, #05070C) !important;` +
            `--brume-accent-glass:color-mix(in srgb, ${hex} 58%, transparent) !important;` +
            '}';
    }

    function apply() {
        const html = document.documentElement;
        const theme = THEMES.some(t => t.key === settings.theme) ? settings.theme : 'aurora';
        html.setAttribute('data-brume-theme', theme);
        html.setAttribute('data-brume-sky', settings.sky ? 'on' : 'off');
        html.setAttribute('data-brume-bubbles', settings.bubbles ? 'on' : 'off');
        html.setAttribute('data-brume-blur', settings.blur ? 'on' : 'off');
        html.setAttribute('data-brume-motion', settings.motion ? 'on' : 'off');
        html.setAttribute('data-brume-narrow', settings.narrow ? 'on' : 'off');
        const acc = ACCENTS.find(a => a.key === settings.accent);
        applyAccent(acc ? acc.hex : '');
    }

    // ── 夜空背景層：墊在整個 UI 之下（z-index:-1，見 style.css）──
    function buildSky() {
        if (document.getElementById('brume-sky')) return;
        const el = document.createElement('div');
        el.id = 'brume-sky';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
            '<div class="brume-grad"></div>' +
            '<div class="brume-stars"></div>' +
            '<div class="brume-fog"></div>' +
            '<div class="brume-aurora"><i></i><i></i><i></i></div>' +
            '<div class="brume-aqua"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
        document.body.prepend(el);
    }

    // ── 設定面板（「擴充功能」抽屜）─────────────────────────────
    function optionTags(list, current) {
        return list.map(o =>
            `<option value="${o.key}" ${o.key === current ? 'selected' : ''}>${o.label}</option>`
        ).join('');
    }

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
        if (!container || document.getElementById('brume-ext-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'brume-ext-panel';
        panel.innerHTML =
            '<div class="inline-drawer">' +
            '  <div class="inline-drawer-toggle inline-drawer-header">' +
            `    <b>Brume UI <small style="opacity:.55;font-weight:400">v${VERSION}</small></b>` +
            '    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
            '  </div>' +
            '  <div class="inline-drawer-content">' +
            '    <div class="flex-container flexFlowColumn" style="gap:8px; padding:4px 0;">' +
            '      <label for="brume_theme">主題</label>' +
            `      <select id="brume_theme" class="text_pole">${optionTags(THEMES, settings.theme)}</select>` +
            '      <label for="brume_accent">主色</label>' +
            `      <select id="brume_accent" class="text_pole">${optionTags(ACCENTS, settings.accent)}</select>` +
            checkboxRow('brume_bubbles', 'LINE 式聊天泡泡', settings.bubbles) +
            checkboxRow('brume_sky', 'Brume 夜空背景', settings.sky, '關閉可用回 SillyTavern 自己的背景圖') +
            checkboxRow('brume_motion', '背景動畫（極光／霧／星）', settings.motion, '手機省電可關，畫面保留但靜止') +
            checkboxRow('brume_blur', '玻璃模糊', settings.blur, '手機發熱時建議關閉') +
            checkboxRow('brume_narrow', '手機窄版（聊天欄置中收窄）', settings.narrow) +
            '    </div>' +
            '  </div>' +
            '</div>';
        container.appendChild(panel);

        panel.querySelector('#brume_theme').addEventListener('change', (e) => {
            settings.theme = e.target.value; apply(); saveSettings();
        });
        panel.querySelector('#brume_accent').addEventListener('change', (e) => {
            settings.accent = e.target.value; apply(); saveSettings();
        });
        const bindCheck = (id, key) => {
            panel.querySelector('#' + id).addEventListener('change', (e) => {
                settings[key] = !!e.target.checked; apply(); saveSettings();
            });
        };
        bindCheck('brume_bubbles', 'bubbles');
        bindCheck('brume_sky', 'sky');
        bindCheck('brume_motion', 'motion');
        bindCheck('brume_blur', 'blur');
        bindCheck('brume_narrow', 'narrow');
    }

    // 快取剋星：iOS Safari／PWA 會抱著舊 style.css 不放——
    // 只要 JS 是新版，就把樣式連結換成帶版本參數的網址，強制重抓。
    function bustStyleCache() {
        try {
            document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
                const href = l.getAttribute('href') || '';
                if (href.includes('st-brume') && href.includes('style.css') && !href.includes('v=' + VERSION)) {
                    l.setAttribute('href', href.split('?')[0] + '?v=' + VERSION);
                }
            });
        } catch (_) { }
    }

    function init() {
        console.log('[Brume UI] v' + VERSION);
        bustStyleCache();
        settings = loadSettings();
        buildSky();
        apply();
        buildPanel();
        // 擴充載入順序不定：擴充頁容器可能晚於本擴充生成，補幾次重試
        let tries = 0;
        const retry = setInterval(() => {
            buildPanel();
            if (document.getElementById('brume-ext-panel') || ++tries > 20) clearInterval(retry);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
