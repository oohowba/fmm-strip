const CONFIG = Object.freeze({
  spreadsheetId: '1EfRUJuvIS5lBbIxQjaGAjwo-vCQWK33uzWBlwMsjkTs',
  uploadCode: 'CHANGE_THIS_UPLOAD_CODE',
  recordsSheet: '全部實驗紀錄',
  draftsSheet: '雲端草稿',
  auditSheet: '雲端異動紀錄',
  headerRow: 4,
  allowedParentOrigin: 'https://oohowba.github.io'
});

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><title>Open Mask 雲端紀錄</title>' +
    '<p style="font:18px sans-serif">Open Mask 雲端紀錄服務已啟動。</p>'
  );
}

function doPost(e) {
  let response;
  try {
    const payload = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
    verifyRequest_(payload);
    response = payload.action === 'draft' ? saveDraft_(payload) : saveRecord_(payload);
  } catch (error) {
    response = { ok: false, message: error && error.message ? error.message : '雲端寫入失敗' };
  }
  return postMessageResponse_(response);
}

function setupProject() {
  if (CONFIG.uploadCode === 'CHANGE_THIS_UPLOAD_CODE') {
    throw new Error('請先把 CONFIG.uploadCode 改成只有內部助理知道的上傳碼。');
  }
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ensureDraftSheet_(spreadsheet);
  ensureAuditSheet_(spreadsheet);
  const records = spreadsheet.getSheetByName(CONFIG.recordsSheet);
  if (!records) throw new Error('找不到工作表：' + CONFIG.recordsSheet);
  return '設定完成：' + spreadsheet.getName();
}

function verifyRequest_(payload) {
  if (!payload || !payload.requestId) throw new Error('缺少請求編號');
  if (CONFIG.uploadCode === 'CHANGE_THIS_UPLOAD_CODE') throw new Error('後端尚未設定上傳碼');
  if (String(payload.uploadCode || '') !== CONFIG.uploadCode) throw new Error('雲端上傳碼錯誤');
  if (!payload.record || !payload.record.experimentId) throw new Error('請先填寫實驗編號');
  if (!['draft', 'submit'].includes(payload.action)) throw new Error('不支援的寫入動作');
}

function saveDraft_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ensureDraftSheet_(spreadsheet);
    const experimentId = cleanCell_(payload.record.experimentId);
    const row = findExperimentRow_(sheet, experimentId, 2);
    const values = [[
      experimentId,
      '草稿',
      new Date(),
      cleanCell_(payload.record.operator),
      cleanCell_(payload.record.route),
      JSON.stringify(payload.record)
    ]];
    if (row) sheet.getRange(row, 1, 1, values[0].length).setValues(values);
    else sheet.appendRow(values[0]);
    return {
      ok: true,
      requestId: payload.requestId,
      action: 'draft',
      experimentId: experimentId,
      savedAt: new Date().toISOString(),
      message: '草稿已存入雲端'
    };
  } finally {
    lock.releaseLock();
  }
}

function saveRecord_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(CONFIG.recordsSheet);
    if (!sheet) throw new Error('找不到工作表：' + CONFIG.recordsSheet);

    const headers = sheet.getRange(CONFIG.headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const incoming = {};
    (payload.headers || []).forEach((header, index) => incoming[String(header)] = (payload.values || [])[index]);
    const experimentId = cleanCell_(payload.record.experimentId);
    incoming['實驗編號'] = experimentId;
    incoming['雲端儲存時間'] = new Date();
    incoming['紀錄狀態'] = '已完成';

    const values = headers.map(header => normalizeCell_(header, Object.prototype.hasOwnProperty.call(incoming, header) ? incoming[header] : ''));
    let row = findExperimentRow_(sheet, experimentId, CONFIG.headerRow + 1);
    let mode = 'updated';
    if (!row) {
      row = firstAvailableRow_(sheet, CONFIG.headerRow + 1);
      mode = 'created';
    }
    sheet.getRange(row, 1, 1, values.length).setValues([values]);

    const audit = ensureAuditSheet_(spreadsheet);
    audit.appendRow([new Date(), experimentId, cleanCell_(payload.record.operator), cleanCell_(payload.record.route), mode, JSON.stringify(payload.record)]);
    removeDraft_(spreadsheet, experimentId);
    SpreadsheetApp.flush();

    return {
      ok: true,
      requestId: payload.requestId,
      action: 'submit',
      experimentId: experimentId,
      row: row,
      mode: mode,
      savedAt: new Date().toISOString(),
      message: mode === 'created' ? '實驗紀錄已新增至雲端' : '實驗紀錄已更新至雲端'
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureDraftSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.draftsSheet);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.draftsSheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['實驗編號', '狀態', '最後更新', '操作者', '方案', 'JSON資料']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureAuditSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.auditSheet);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.auditSheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['異動時間', '實驗編號', '操作者', '方案', '動作', 'JSON資料']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findExperimentRow_(sheet, experimentId, startRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return 0;
  const ids = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues();
  const target = String(experimentId).trim();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]).trim() === target) return startRow + index;
  }
  return 0;
}

function firstAvailableRow_(sheet, startRow) {
  const lastRow = Math.max(sheet.getLastRow(), startRow);
  const ids = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (!String(ids[index][0]).trim()) return startRow + index;
  }
  return lastRow + 1;
}

function removeDraft_(spreadsheet, experimentId) {
  const sheet = spreadsheet.getSheetByName(CONFIG.draftsSheet);
  if (!sheet) return;
  const row = findExperimentRow_(sheet, experimentId, 2);
  if (row) sheet.deleteRow(row);
}

function cleanCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || value instanceof Date) return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalizeCell_(header, value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' || value instanceof Date) return value;
  const text = String(value).trim();
  const numericHeader = /(pH|_min|_C|_kHz|_W_L|_mL_L|_g_L|_mg|消耗率|_cm2|_mg_cm2|藥液量_mL)$/;
  if (numericHeader.test(String(header)) && text !== '') {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return numeric;
  }
  return cleanCell_(text);
}

function postMessageResponse_(response) {
  const json = JSON.stringify(response).replace(/</g, '\\u003c');
  const origin = JSON.stringify(CONFIG.allowedParentOrigin);
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>' +
    'window.parent.postMessage(' + json + ',' + origin + ');' +
    '</script><p>' + (response.ok ? '儲存完成' : '儲存失敗') + '</p>'
  );
}
