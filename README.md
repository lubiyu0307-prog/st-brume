# st-brume — Brume UI for SillyTavern

把 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 換上
[Brume](https://github.com/lubiyu0307-prog/brume) 的設計語言：極夜低飽和色票、
玻璃介面、LINE 式聊天泡泡、極光／星空／霧氣背景動畫、粉圓體。

## 特色

- **三主題**：極光（黑夜星空＋流動極光簾幕）／水族館（深夜水槽＋上升氣泡）／夜霧（墨藍純色）
- **LINE 式聊天泡泡**：角色靠左玻璃泡泡、你靠右主色泡泡、圓頭貼
- **玻璃介面**：頂欄、抽屜、彈窗、輸入列、「最近的聊天」面板全部霧面玻璃化
- **世界書手機整修**：條目變玻璃卡片，「插入位置／深度／順序／觸發 %」在窄螢幕改排
  2×2 網格、輸入框統一大小，不再擠成一團
- **角色卡相容**：MVU／regex 渲染的自訂狀態欄照卡片原設計呈現（訊息內文不用
  `!important`，卡片樣式永遠優先）；含區塊級版面的訊息自動放寬滿版，不被泡泡擠壓
- **六種主色**：預設／薰衣草／櫻粉／極夜藍／蜜金／霧綠
- **手機窄版**：桌面上把聊天欄收成一支置中的「小手機」
- **省電開關**：背景動畫與玻璃模糊可獨立關閉（手機發熱時關模糊最有感）
- **粉圓體**（jf open 粉圓，CDN 載入；載不到自動退回系統圓體）

所有設定在 SillyTavern「擴充功能」頁的 **Brume UI** 區塊，即改即生效；
停用擴充即完整還原 SillyTavern 原樣。

## 安裝

SillyTavern →「擴充功能」→「Install extension」→ 貼上本 repo 網址：

```
https://github.com/lubiyu0307-prog/st-brume
```

或手動安裝：把本 repo 整個資料夾放到
`SillyTavern/data/<你的使用者>/extensions/st-brume/`，重新整理頁面。

## 搭配的介面主題檔（themes/）

`themes/` 內附三個官方格式的介面主題檔（Brume 極光／水族館／夜霧）。
到「使用者設定 → 介面主題」按匯入、選擇對應主題，可讓 SillyTavern 底層的
主題顏色（引用文字、斜體、邊框等）也原生對齊 Brume 配色——與本擴充搭配最穩，
單獨使用也可以（只有顏色，沒有背景動畫與泡泡版面）。

> 注意：與其他「主題類擴充」（如 Moonlit Echoes Theme）同時啟用時，兩邊的
> 樣式會互相覆蓋、外觀不可預期。建議擇一使用。

## 相容性

以 SillyTavern 1.12+ 為目標（設定經 `SillyTavern.getContext()` 儲存；
更舊版本退回 localStorage，樣式功能不受影響）。純外觀層——不碰訊息處理、
regex、變數、世界書邏輯。

## 授權

[MIT](./LICENSE)。粉圓體為 [justfont open 粉圓](https://github.com/justfont/open-huninn-font)（OFL 授權）。
