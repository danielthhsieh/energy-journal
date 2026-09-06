// Google Apps Script - 能量日誌表單提交處理（覆蓋模式 + 預填充 + CORS 支持）

const SHEET_ID = "1D3Hc6B4_lh3Xe2pU8oimymfDyZHLC86iVBAa95eEDNg";
const SHEET_NAME = "能量日誌";

// F4：後端版本。所有 JSON 回應都帶 version，前端與 curl ?ping=1 可據此確認部署已生效。
// 每次改後端且需要部署時 +1。
const BACKEND_VERSION = 4;

// F0：跳過標記欄位（K 欄）。一列資料共 11 欄：A 日期 … J 反思，K 跳過
const COL_SKIP = 11;
const ROW_WIDTH = 11;
const SKIP_HEADER = "跳過";

// F0：確保 K1 標題存在。K1 為空才寫，不覆蓋既有內容。
function ensureSkipHeader(sheet) {
  const cell = sheet.getRange(1, COL_SKIP);
  const v = cell.getValue();
  if (v === "" || v === null) {
    cell.setValue(SKIP_HEADER);
    Logger.log("F0：已建立 K1 標題「" + SKIP_HEADER + "」");
    return true;
  }
  if (v !== SKIP_HEADER) {
    Logger.log("⚠️ F0：K1 已有其他內容「" + v + "」，未覆蓋");
  }
  return false;
}

// F0：一次性設定。在 Apps Script 編輯器手動執行一次即可。
function setupF0() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const created = ensureSkipHeader(sheet);
  Logger.log(created ? "✓ setupF0 完成：K1 = 跳過" : "✓ setupF0：K1 已存在，無需變更（值：" + sheet.getRange(1, COL_SKIP).getValue() + "）");
}

// 處理 CORS preflight 請求（OPTIONS）
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===== F1：區間讀取 =====
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
// 只回傳「有資料」的列：B/C/D 任一為數字，或 K 為 TRUE。預填的空列（活動全 FALSE、無文字）不回傳。
const RANGE_MAX_DAYS = 60;

function doGetRange(fromStr, toStr) {
  const from = new Date(fromStr + "T00:00:00+08:00");
  const to = new Date(toStr + "T00:00:00+08:00");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return jsonOut({ success: false, error: "日期格式錯誤或 from 晚於 to" });
  }
  const spanDays = Math.round((to - from) / 86400000) + 1;
  if (spanDays > RANGE_MAX_DAYS) {
    return jsonOut({ success: false, error: "區間上限 " + RANGE_MAX_DAYS + " 天" });
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const rows = [];

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, ROW_WIDTH).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const cellDate = r[0];
      if (!(cellDate instanceof Date)) continue;
      const ds = Utilities.formatDate(cellDate, "Asia/Taipei", "yyyy-MM-dd");
      if (ds < fromStr || ds > toStr) continue;

      const isSkip = r[COL_SKIP - 1] === true;
      const hasScore = [r[1], r[2], r[3]].some(v => typeof v === "number");
      if (!isSkip && !hasScore) continue;   // 預填空列

      rows.push({
        date: ds,
        壓力分數: typeof r[1] === "number" ? r[1] : null,
        思路清晰度: typeof r[2] === "number" ? r[2] : null,
        睡前電量: typeof r[3] === "number" ? r[3] : null,
        散步: r[4] === true,
        冥想: r[5] === true,
        重訓: r[6] === true,
        跑步: r[7] === true,
        輕量感恩: r[8] || "",
        反思: r[9] || "",
        跳過: isSkip
      });
    }
  }

  Logger.log("F1 區間 " + fromStr + "～" + toStr + "：" + rows.length + " 筆有資料");
  return jsonOut({ success: true, from: fromStr, to: toStr, rows: rows });
}

function jsonOut(obj) {
  obj.version = BACKEND_VERSION;   // F4
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== GET 請求：讀取當天資料（預填充用）=====
function doGet(e) {
  try {
    // F4：部署健康檢查
    if (e.parameter.ping) {
      return jsonOut({ success: true, time: new Date().toISOString() });
    }

    // F1：有 from 與 to 走區間讀取；否則沿用單日邏輯
    if (e.parameter.from && e.parameter.to) {
      return doGetRange(String(e.parameter.from), String(e.parameter.to));
    }

    // 獲取查詢日期（如果沒提供，預設為今天）
    const dateParam = e.parameter.date || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    const lastRow = sheet.getLastRow();
    
    // 搜尋該日期的記錄
    if (lastRow > 1) {
      const dateRange = sheet.getRange(2, 1, lastRow - 1, 1);
      const dateValues = dateRange.getValues();
      
      for (let i = 0; i < dateValues.length; i++) {
        const cellDate = dateValues[i][0];
        if (cellDate instanceof Date) {
          const cellDateString = Utilities.formatDate(cellDate, "Asia/Taipei", "yyyy-MM-dd");
          if (cellDateString === dateParam) {
            // 找到該日期的記錄，讀取全列資料
            const recordRow = i + 2;
            const recordData = sheet.getRange(recordRow, 1, 1, ROW_WIDTH).getValues()[0];
            const isSkip = recordData[COL_SKIP - 1] === true;   // F0
            
            // 檢查是否至少有一個欄位有值（B到J欄，即 recordData[1] 到 recordData[9]）；跳過標記本身也算有值
            const hasValue = isSkip || recordData.slice(1, 10).some(cell => {
              if (cell === null || cell === undefined || cell === '') return false;
              if (typeof cell === 'boolean') return true; // 布林值（活動按鈕）算有值
              if (typeof cell === 'number') return cell !== 0; // 數字非零算有值
              if (typeof cell === 'string') return cell.trim().length > 0; // 字串非空算有值
              return false;
            });
            
            if (hasValue) {
              // 有實際資料
              const response = {
                success: true,
                found: true,
                date: dateParam,
                data: {
                  壓力分數: recordData[1] || null,
                  思路清晰度: recordData[2] || null,
                  睡前電量: recordData[3] || null,
                  散步: recordData[4] === true,
                  冥想: recordData[5] === true,
                  重訓: recordData[6] === true,
                  跑步: recordData[7] === true,
                  輕量感恩: recordData[8] || "",
                  反思: recordData[9] || "",
                  跳過: isSkip                       // F0
                }
              };
              
              Logger.log("找到 " + dateParam + " 的有效記錄於第 " + recordRow + " 行");
              
              return jsonOut(response);
            } else {
              // 日期存在但全部欄位都是空值
              Logger.log("找到 " + dateParam + " 的日期但沒有實際資料");
              return jsonOut({ 
                  success: true, 
                  found: false, 
                  date: dateParam,
                  message: "日期存在但沒有填寫資料" 
                });
            }
          }
        }
      }
    }
    
    // 沒找到該日期的記錄
    Logger.log("未找到 " + dateParam + " 的記錄");
    return jsonOut({ 
        success: true, 
        found: false, 
        date: dateParam,
        message: "今天還沒有記錄" 
      });
      
  } catch (error) {
    Logger.log("❌ doGet 錯誤: " + error.toString());
    return jsonOut({ 
        success: false, 
        error: error.toString() 
      });
  }
}

// ===== POST 請求：提交表單資料（覆蓋模式）=====
function doPost(e) {
  try {
    // 解析請求數據
    const data = JSON.parse(e.postData.contents);
    
    // F0：跳過模式。分數三欄寫成空白（不是 0），活動與文字照送來的值寫入
    const skip = data.跳過 === true;

    // 驗證必要欄位（跳過模式不需要分數）
    if (!data.date || (!skip && (data.壓力分數 === undefined || data.思路清晰度 === undefined || data.睡前電量 === undefined))) {
      return jsonOut({ success: false, error: "缺少必要欄位" });
    }
    
    // 打開 Google Sheet
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    ensureSkipHeader(sheet);   // F0：K1 標題保護
    
    // 日期格式化
    const submitDate = new Date(data.date);
    const submitDateString = Utilities.formatDate(submitDate, "Asia/Taipei", "yyyy-MM-dd");
    
    // 準備新數據
    // 一般送出：跳過欄寫 FALSE（清掉先前的記號）；跳過送出：分數寫空白、跳過欄寫 TRUE
    const newData = [
      submitDate,
      skip ? "" : data.壓力分數,
      skip ? "" : data.思路清晰度,
      skip ? "" : data.睡前電量,
      data.散步 === true,
      data.冥想 === true,
      data.重訓 === true,
      data.跑步 === true,
      data.輕量感恩 || "",
      data.反思 || "",
      skip
    ];
    
    // 查詢是否已存在該日期的記錄
    const lastRow = sheet.getLastRow();
    let existingRow = -1;
    
    if (lastRow > 1) {
      const dateRange = sheet.getRange(2, 1, lastRow - 1, 1);
      const dateValues = dateRange.getValues();
      
      for (let i = 0; i < dateValues.length; i++) {
        const cellDate = dateValues[i][0];
        if (cellDate instanceof Date) {
          const cellDateString = Utilities.formatDate(cellDate, "Asia/Taipei", "yyyy-MM-dd");
          if (cellDateString === submitDateString) {
            existingRow = i + 2;
            break;
          }
        }
      }
    }
    
    // 執行更新或新增
    let targetRow;
    let action;
    
    if (existingRow > 0) {
      targetRow = existingRow;
      action = "updated";
      sheet.getRange(targetRow, 1, 1, newData.length).setValues([newData]);
      Logger.log("更新第 " + targetRow + " 行的記錄");
    } else {
      targetRow = lastRow + 1;
      action = "created";
      sheet.getRange(targetRow, 1, 1, newData.length).setValues([newData]);
      Logger.log("在第 " + targetRow + " 行新增記錄");
    }
    
    // 返回成功回應
    return jsonOut({ 
        success: true, 
        message: skip ? "✓ 已留記號" : (action === "updated" ? "✓ 已更新今日記錄" : "✓ 已新增記錄"),
        date: submitDateString,
        row: targetRow,
        action: action,
        skip: skip
      });
      
  } catch (error) {
    // 記錄錯誤
    Logger.log("❌ doPost 錯誤: " + error.toString());
    Logger.log("Stack: " + error.stack);
    
    // 返回錯誤回應
    return jsonOut({ 
        success: false, 
        error: error.toString() 
      });
  }
}

// ===== 測試函數 =====
function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    Logger.log("✓ Sheet 已開啟: " + sheet.getName());
    Logger.log("✓ 最後一列: " + sheet.getLastRow());
    Logger.log("✓ 時區: Asia/Taipei");
    Logger.log("✓ Google Apps Script 連線測試成功");
  } catch(err) {
    Logger.log("❌ 連線失敗: " + err.toString());
  }
}

// F0：模擬一次跳過送出（會實際寫入今天的列，測試後可再用一般送出覆蓋）
function testSkipToday() {
  const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  const payload = { date: today, 跳過: true, 散步: false, 冥想: false, 重訓: false, 跑步: false, 輕量感恩: "", 反思: "" };
  const res = doPost({ postData: { contents: JSON.stringify(payload) } });
  Logger.log("testSkipToday: " + res.getContent());
  Logger.log("readback: " + doGet({ parameter: { date: today } }).getContent());
}

// F1：測試區間讀取（最近 28 天）
function testReadRange() {
  const to = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  const from = Utilities.formatDate(new Date(Date.now() - 27 * 86400000), "Asia/Taipei", "yyyy-MM-dd");
  const res = doGet({ parameter: { from: from, to: to } });
  Logger.log("testReadRange " + from + "～" + to + ": " + res.getContent().slice(0, 600));
}

function testReadToday() {
  const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  Logger.log("測試讀取今天的資料: " + today);
  
  const response = doGet({
    parameter: {
      date: today
    }
  });
  
  Logger.log("Response: " + response.getContent());
}
