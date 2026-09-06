// Google Apps Script - 能量日誌表單提交處理（覆蓋模式 + 預填充 + CORS 支持）

const SHEET_ID = "1D3Hc6B4_lh3Xe2pU8oimymfDyZHLC86iVBAa95eEDNg";
const SHEET_NAME = "能量日誌";

// 處理 CORS preflight 請求（OPTIONS）
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===== GET 請求：讀取當天資料（預填充用）=====
function doGet(e) {
  try {
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
            const recordData = sheet.getRange(recordRow, 1, 1, 10).getValues()[0];
            
            // 檢查是否至少有一個欄位有值（B到J欄，即 recordData[1] 到 recordData[9]）
            const hasValue = recordData.slice(1, 10).some(cell => {
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
                  反思: recordData[9] || ""
                }
              };
              
              Logger.log("找到 " + dateParam + " 的有效記錄於第 " + recordRow + " 行");
              
              return ContentService
                .createTextOutput(JSON.stringify(response))
                .setMimeType(ContentService.MimeType.JSON);
            } else {
              // 日期存在但全部欄位都是空值
              Logger.log("找到 " + dateParam + " 的日期但沒有實際資料");
              return ContentService
                .createTextOutput(JSON.stringify({ 
                  success: true, 
                  found: false, 
                  date: dateParam,
                  message: "日期存在但沒有填寫資料" 
                }))
                .setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
    }
    
    // 沒找到該日期的記錄
    Logger.log("未找到 " + dateParam + " 的記錄");
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        found: false, 
        date: dateParam,
        message: "今天還沒有記錄" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("❌ doGet 錯誤: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== POST 請求：提交表單資料（覆蓋模式）=====
function doPost(e) {
  try {
    // 解析請求數據
    const data = JSON.parse(e.postData.contents);
    
    // 驗證必要欄位
    if (!data.date || data.壓力分數 === undefined || data.思路清晰度 === undefined || data.睡前電量 === undefined) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "缺少必要欄位" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 打開 Google Sheet
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    // 日期格式化
    const submitDate = new Date(data.date);
    const submitDateString = Utilities.formatDate(submitDate, "Asia/Taipei", "yyyy-MM-dd");
    
    // 準備新數據
    const newData = [
      submitDate,
      data.壓力分數,
      data.思路清晰度,
      data.睡前電量,
      data.散步 === true,
      data.冥想 === true,
      data.重訓 === true,
      data.跑步 === true,
      data.輕量感恩 || "",
      data.反思 || ""
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
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: action === "updated" ? "✓ 已更新今日記錄" : "✓ 已新增記錄",
        date: submitDateString,
        row: targetRow,
        action: action
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // 記錄錯誤
    Logger.log("❌ doPost 錯誤: " + error.toString());
    Logger.log("Stack: " + error.stack);
    
    // 返回錯誤回應
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
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
