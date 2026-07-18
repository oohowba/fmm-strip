# fmm-strip — Open Mask 鍍層移除藥水研發網站

這是 FMM（Invar 精密金屬遮罩）鍍層移除藥水研發用的網頁（客戶名保密），內容包含：

- 研發實驗指南（三方案 1L 配製單、SOP、六項肉眼判讀表）
- 研發進度時間線與實驗記錄

## 架構（一句話版）

網站就是一個純靜態 HTML 檔（`site/index.html`），零外部依賴——用瀏覽器直接打開就能看。正式版透過 GitHub Pages 發佈：**https://oohowba.github.io/fmm-strip/**（知道網址的人才會找到；已設定不讓搜尋引擎收錄）。

## 怎麼參與編輯

1. Clone 這個 repo。
2. 用你的編輯器或 AI 工具（codex 等）修改 `site/index.html`。**AI 工具會自動讀 `AGENTS.md`，裡面有硬規則，請先看過。**
3. 預覽：直接用瀏覽器打開 `site/index.html`。
4. 開分支 push、發 Pull Request。**請勿直接 push main。**
5. Merge 進 main 後，GitHub Actions 會自動重新發佈網頁（約 1 分鐘），不需要任何手動部署。
