# 能量日誌 Energy Journal

一個簡潔優雅的個人晚間反思記錄工具，幫助你追蹤日常心理狀態、活動習慣和感恩時刻。

![Status](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ 功能特色

### 📊 心理狀態追蹤
- **壓力分數** (1-10)：記錄一天的壓力程度
- **思路清晰度** (1-10)：評估思維的清晰度
- **睡前電量** (1-10)：入睡前的精力狀態

### 🏃 活動紀錄
- ✓ 散步
- ✓ 冥想
- ✓ 重訓
- ✓ 跑步

### 💭 反思與感恩
- **感恩日誌**：記錄今天值得感謝的事（100 字以內）
- **反思**：記錄觀察和想法（100 字以內）

### 📈 週回顧（F1）
- 頁面底部選單列切換「日誌／補登／週回顧」三個分頁（跟著內容排在最底部，不固定）；週回顧顯示最近 4 週三個分數的週平均趨勢，Y 軸固定 1 到 10，單色、無互動
- 該週至少 2 天有分數才畫點；最近 4 週不足 2 週有點時只留一行留白文字
- 下方回聲一則 7 到 28 天前的反思或感恩，同一天內不換
- 後端提供 `?from=YYYY-MM-DD&to=YYYY-MM-DD` 區間端點，只回傳有分數或跳過的列（上限 60 天）

### 📅 補登（F2）
- 「補登」分頁列出今天與往前 6 天，點一天即回到日誌分頁填寫該日；不標示哪些天有沒有資料
- 非今天時標題顯示該日期與「回到今天」，送出成功後自動回到今天
- 後端不需改動

### 🔘 跳過標記（F0）
- 「今天不記分數，只留個記號」：分數三欄留空、活動照填，`跳過` 欄寫入 TRUE
- 讓「刻意不記」與「忘了記」在資料上分得開；設計判準見 [docs/prd-directions-2026-09.md](docs/prd-directions-2026-09.md)

### 🎨 設計亮點
- 深色/淺色雙主題切換
- 響應式設計，支持手機和桌面
- 實時字數統計
- 流暢的用戶交互動畫
- 自動檢測並更新同一日期的記錄

---

## 🛠️ 技術棧

- **前端**：HTML5 + CSS3 + Vanilla JavaScript（由 Claude Design 生成）
- **後端**：Google Apps Script
- **數據存儲**：Google Sheets
- **主題字型**：
  - Noto Sans TC（正文）
  - Noto Serif TC（標題）
  - 辰宇落雁體 Thin（花式標題）

---

## 🚀 快速開始

### 前置需求
- Google 帳號
- GitHub 帳號（可選，用於部署）

### 安裝步驟

#### 1. 準備 Google Sheets

1. 建立新的 Google Sheet
2. 創建名為「能量日誌」的工作表
3. 添加以下欄位名稱（第一列）：
   ```
   日期 | 壓力分數 | 思路清晰度 | 睡前電量 | 散步 | 冥想 | 重訓 | 跑步 | 輕量感恩 | 反思 | 跳過
   ```
   （`跳過` 在 K 欄。若忘了加，後端第一次寫入時會自動補上標題，或在 Apps Script 編輯器執行一次 `setupF0()`）
4. 記下 Sheet ID（URL 中的那串長 ID）

#### 2. 設置 Google Apps Script

1. 開啟 [Google Apps Script](https://script.google.com)
2. 新建專案
3. 將 `backend/energy-journal.gs` 的代碼複製貼上
4. 修改常數：
   ```javascript
   const SHEET_ID = "你的 Sheet ID";
   const SHEET_NAME = "能量日誌";
   ```
5. 點「部署」→「新增部署」
   - 類型：**網路應用**
   - 執行身分：**你的帳號**
   - 誰可以存取：**任何人** ✅
6. 複製部署 URL（長這樣）：
   ```
   https://script.google.com/macros/s/[ID]/exec
   ```

#### 3. 更新 HTML 檔案

在 `index.html` 中找到這一行：
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/...';
```

改成你的部署 URL

#### 4. 部署到 GitHub Pages（可選）

```bash
git add index.html
git commit -m "Update Google Apps Script URL"
git push origin main
```

然後訪問 `https://你的GitHub用戶名.github.io/能量日誌/`

---

## 📖 使用方法

### 基本流程
1. **打開表單**：在瀏覽器中開啟 `index.html`
2. **調整滑桿**：設定壓力分數、思路清晰度、睡前電量
3. **選擇活動**：勾選今天進行的活動
4. **輸入文字**：記錄感恩和反思
5. **提交**：點擊「完成今晚的紀錄 ✨」按鈕

### 自動功能
- ✅ 日期自動填充（當天日期）
- ✅ 同日期覆蓋：如果重複提交同一日期，會更新該記錄而不是新增
- ✅ 實時字數顯示：感恩和反思欄自動計數

---

## 📁 檔案結構

```
.
├── index.html                       # 主要前端表單
├── backend/
│   └── energy-journal.gs            # Google Apps Script 後端代碼（部署時複製到 Apps Script 編輯器）
├── docs/
│   ├── prd-directions-2026-09.md    # PRD 方向：問題陳述、設計判準、功能候選、階段規劃
│   ├── spec-f0-skip-marker.md       # F0 規格：跳過標記
│   ├── spec-f1-weekly-review.md     # F1 規格：週回顧
│   └── spec-f2-backfill.md          # F2 規格：補登
└── README.md
```

---

## 🔧 故障排除

### 問題：提交時出現「紀錄失敗」

**原因可能是：**

1. **Google Apps Script 未部署**
   - 檢查「部署」→「管理部署」是否有網路應用部署
   - 確認執行身分和存取權限正確

2. **CORS 錯誤（跨域被阻擋）**
   - 打開瀏覽器開發者工具（F12）→「Console」
   - 查看是否有「CORS policy」的錯誤
   - 確保 Google Apps Script 包含 `doOptions()` 函數

3. **Sheet ID 不正確**
   - 檢查 `energy-journal.gs` 中的 `SHEET_ID` 常數
   - 確保工作表名稱是「能量日誌」

4. **網路連線問題**
   - 刷新頁面重試
   - 檢查網際網路連線

### 問題：字型加載緩慢

檔案大小為 3.5MB（主要是繁體中文 webfont）

**解決方案：**
- 參考 `optimization-plan.md` 的優化方案
- 或在 Claude Design 中重新設計，選擇更輕量的字型

---

## 📊 數據隱私

- 所有資料存儲在你的個人 Google Sheets
- 無第三方服務追蹤
- 完全由你控制
- 只要你的 Google Apps Script 部署設為「任何人」，表單就可以提交；但 Google Sheet 的存取權只有你有

---

## 💡 自訂與擴展

### 添加新欄位

1. 在 Google Sheet 中添加新欄
2. 在 `index.html` 中添加新的 HTML 元素
3. 在 `energy-journal.gs` 的 `newData` 陣列中添加新字段

### 修改主題

編輯 `index.html` 中的 `themes()` 函數，調整顏色變數：
```javascript
themes() {
  return {
    dusk: {
      pageBg: '...',    // 背景
      cardBg: '...',    // 卡片背景
      accent: '...',    // 強調色
      // 更多顏色...
    }
  }
}
```

### 添加新活動按鈕

1. 在 HTML 中複製一個活動按鈕並修改文本
2. 在 JavaScript 中添加對應的 state 和 toggle 邏輯
3. 在 Google Sheet 中添加新欄位

---

## 🐛 已知限制

- 檔案大小：3.5MB（主要是繁體中文字型）
  - 見 `optimization-plan.md` 瞭解優化選項
- 單一工作表：目前只支持一個「能量日誌」工作表
- 時區固定：Asia/Taipei（可在代碼中修改）

---

## 📝 更新日誌

### v1.0 (2024)
- ✅ 基礎功能完成
- ✅ Google Sheets 集成
- ✅ CORS 支持
- ✅ 深色/淺色主題

---

## 🙏 致謝

- UI/UX 設計：Claude Design
- 後端邏輯：Google Apps Script
- 字型：Google Fonts (Noto Sans/Serif TC)、辰宇落雁體

---

## 📄 許可證

MIT License - 自由使用、修改和分發

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

## 📧 聯絡方式

有問題或建議？歡迎提出 GitHub Issue。

---

**祝你每晚都有美好的反思時刻！✨**
