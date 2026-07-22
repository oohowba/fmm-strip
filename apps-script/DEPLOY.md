# Open Mask 雲端紀錄部署

1. 到 https://script.google.com 建立新專案。
2. 將 `Code.gs` 內容貼入專案，並把 `CONFIG.uploadCode` 改成內部使用的上傳碼。
3. 執行一次 `setupProject()`，接受 Google 授權；成功後會建立「雲端草稿」與「雲端異動紀錄」兩個工作表。
4. 按「部署 → 新增部署作業 → 網頁應用程式」。
5. 執行身分選「我」，存取權選「任何人」。資料寫入仍需正確上傳碼。
6. 複製部署後的 `/exec` 網址。
7. 將 `assistant.html` 的 `CLOUD_ENDPOINT` 改為該 `/exec` 網址，再發布網站。

每次修改 `Code.gs` 後，必須建立新版本並更新既有部署，測試網址才會使用新程式。
