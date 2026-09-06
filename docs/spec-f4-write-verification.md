# F4 規格：寫入結果可驗證

> 上游：[prd-directions-2026-09.md](prd-directions-2026-09.md) 第 4 節 F4
> 前置：F0～F2 已上線
> 狀態：規格 v1，待確認決策後開發

---

## 1. 目的

消除能量日誌自己的「安靜地壞掉」。目前有三條路徑，出錯時畫面都是正常的：

| # | 路徑 | 現況 | 後果 |
|---|---|---|---|
| S1 | 送出（POST） | `mode: 'no-cors'`，讀不到回應，一律顯示成功 | 寫入失敗時使用者以為記了，那一天永遠是空的 |
| S2 | 載入（GET）失敗 | 顯示「⚠️ 載入失敗」，但表單仍可送出 | 若該日已有資料，一次送出會用預設值（5／5／5、活動全關）**覆蓋掉真實紀錄** |
| S3 | 後端部署版本 | `/exec` 跑舊版時，新功能靜靜不存在 | 今天實際發生兩次：F1 區間端點與 F0 跳過欄位都曾「部署了但沒生效」 |

S2 的風險最高，因為它會**毀掉已有的資料**，而不只是少一筆。

## 2. 實測依據（2026-09-06，從 https://danielthhsieh.github.io 打線上後端）

| 送法 | 結果 |
|---|---|
| `POST` + `Content-Type: text/plain;charset=utf-8` | **成功讀到 JSON**。`type: cors`、經一次 302 轉址到 `script.googleusercontent.com`、最終回應帶 `Access-Control-Allow-Origin: *`。暖機狀態 1.25 秒。 |
| `POST` + `Content-Type: application/json` | `TypeError: Failed to fetch`。觸發 preflight，Apps Script 的 OPTIONS 只回 `Allow: HEAD, GET, POST`，沒有 CORS 標頭。 |
| `POST` + `mode: 'no-cors'`（現行） | 回應 `type: opaque`，什麼都讀不到。 |

結論：**把 Content-Type 改成 text/plain 就能讀回應，後端一行都不用改**。`e.postData.contents` 仍是同一段 JSON 字串，`JSON.parse` 照舊。

## 3. 判準對照

F4 是基礎設施，不新增任何呈現。但錯誤訊息本身是文案，仍受判準約束：

| 判準 | 邊界 |
|---|---|
| 訊號不是義務 | 錯誤訊息說「發生什麼」與「可以怎麼做」，不說「你應該」。 |
| 文案 | 禁用：忘、漏、缺、欠、還沒。錯誤是系統的事，不是使用者的事。 |
| 不轟炸 | 一次失敗一則訊息，重試由使用者發起，不自動重送。 |

## 4. 設計決策

| # | 決策 | 選擇 | 理由 |
|---|---|---|---|
| D1 | POST 模式 | `mode: 'cors'`、`Content-Type: text/plain;charset=utf-8`、`redirect: 'follow'`（預設） | 第 2 節實測。後端不改。 |
| D2 | 成功的定義 | **三個條件同時成立**：`response.ok`、`json.success === true`、`json.date === 送出的日期`。 | 第三條防「寫到別天」。後端 `doPost` 本來就回 `date`。 |
| D3 | 逾時 | `AbortController` **20 秒**。逾時視為失敗，訊息說明「可能沒有寫進去」。 | Apps Script 冷啟動可到數秒；暖機 1.2 秒。20 秒足夠寬。 |
| D4 | 載入失敗時 | **兩顆送出按鈕 disabled**，載入指示改為「載入失敗 · 重試」可點。重試成功後才恢復。 | 直接封掉 S2 的資料覆蓋路徑。代價是離線時完全不能記，見開放問題 1。 |
| D5 | 部署版本可驗證 | 後端加 `BACKEND_VERSION` 常數，所有 JSON 回應帶 `version`；新增 `GET ?ping=1` 只回 `{success, version, time}`。前端若收到的 `version` 缺少或小於預期，`console.warn`，**不進 UI**。 | 封掉 S3。以後我或 Daniel 用一行 curl 就能確認部署生效。這是唯一需要改後端的部分，但前端要容忍舊後端沒有 `version`。 |
| D6 | 失敗後的狀態 | 不顯示成功 modal、不切換跳過狀態、不重拉週回顧、不回到今天。表單內容保留，按鈕恢復可按。 | 使用者按一次重試就好，覆蓋同一天是 idempotent。 |
| D7 | 回應不是 JSON | `JSON.parse` 失敗（例如 Google 回了 HTML 錯誤頁）視為失敗，訊息「回應格式不對」。 | 今天 curl 測試就看過 Google 的 HTML 錯誤頁。 |
| D8 | 成功後不再 GET 確認 | 不做 | 回應已含 `date`、`row`、`action`，夠了。多一次 GET 只增加等待。 |
| D9 | 離線偵測 | `navigator.onLine === false` 時直接顯示錯誤，不發請求。 | 省 20 秒等待。 |

## 5. 文案

| 情境 | 錯誤區塊文字 |
|---|---|
| 網路錯誤 / 離線 | 連不上，這筆沒有送出去。網路恢復後再按一次就好。 |
| 逾時 | 二十秒沒有收到回應，這筆可能沒有寫進去。再按一次會覆蓋同一天，不會重複。 |
| 後端回 `success:false` | 後端沒有接受這筆：{error}。 |
| 日期不符 | 回應的日期跟送出的不一樣，這筆先不算成功。重新整理後再試一次。 |
| 回應不是 JSON | 收到的回應格式不對，這筆先不算成功。 |
| 載入失敗 | 載入失敗 · 重試 |

「這筆先不算成功」是刻意的措辭：不斷言失敗，因為逾時與格式錯誤時後端可能其實寫進去了。

## 6. 前端改動

### 6.1 新增 `postRecord(payload)`

```
async function postRecord(payload) → { ok: boolean, json?, reason: 'offline'|'network'|'timeout'|'rejected'|'date-mismatch'|'bad-json'|null }
```

- 內含 AbortController 20 秒。
- `submitForm()` 與 `submitSkip()` 改為呼叫它，依 `reason` 顯示第 5 節文案。
- 成功分支才做現有的成功動作（modal、skip 狀態、`loadWeeklyReview()`、非今天回到今天）。

### 6.2 `loadRecord(dateStr)` 的失敗分支

- `state.loadFailed = true`；`#submitBtn`、`#skipBtn` disabled。
- `#loadIndicator` 改為可點的「載入失敗 · 重試」，點擊重跑 `loadRecord(state.date)`。
- 成功分支開頭 `state.loadFailed = false`，恢復按鈕。
- `selectDate()` 切換日期時沿用同一套，因為它就是呼叫 `loadRecord`。

### 6.3 版本檢查

```
const EXPECTED_BACKEND_VERSION = 4;
```
在 `loadRecord` 與 `postRecord` 拿到 JSON 後：`if (!json.version || json.version < EXPECTED_BACKEND_VERSION) console.warn(...)`。只有 console，沒有 UI。

## 7. 後端改動（`backend/energy-journal.gs`）

- `const BACKEND_VERSION = 4;`
- `jsonOut()` 統一加上 `version: BACKEND_VERSION`。既有 `doGet` 單日分支與 `doPost` 的 `ContentService.createTextOutput(JSON.stringify(...))` 改走 `jsonOut()`。
- `doGet`：`if (e.parameter.ping) return jsonOut({ success: true, time: new Date().toISOString() })`。
- `doOptions` 保留不動。它沒有作用，但刪掉也沒有好處。

部署驗證指令（部署後 Daniel 或我執行）：

```bash
curl -sL "https://script.google.com/macros/s/AKfycbzHkyqqM0vOus7M0B2IHIFhaktRTenSL7c_2t12OtlYF1RuvY1jn1mugQzsHcBmltwc/exec?ping=1"
```

預期看到 `"version":4`。看不到就是沒部署成功。

## 8. 邊界

- **前端先上、後端後上**：前端只依賴 text/plain 可讀回應，這在現行後端已成立。`version` 缺少只會 console.warn。所以前端可以先 push，不必等後端。
- **後端先上、前端後上**：舊前端 no-cors 不讀回應，多出來的 `version` 欄位無害。
- **重複送出**：`state.submitting` 既有保護不變。
- **逾時後後端其實成功**：使用者重試會覆蓋同一天同內容，無害。
- **file:// 本機測試**：origin 為 `null`，Apps Script 回 `*`，同樣可讀。

## 9. 驗收條件

- [ ] 從線上頁面送出一般記錄：Network 面板看到 `text/plain` POST、302、最終 200 JSON；成功 modal 只在 JSON `success:true` 且 `date` 相符時出現。
- [ ] 以 mock 讓後端回 `{success:false,error:"x"}`：不出 modal、錯誤區塊顯示「後端沒有接受這筆：x」、按鈕恢復、表單內容保留、`state.skip` 不變、未呼叫 `loadWeeklyReview`。
- [ ] mock 回 `date` 不符：顯示日期不符文案，不算成功。
- [ ] mock 回 HTML：顯示格式不對文案。
- [ ] mock 永不回應：20 秒後顯示逾時文案。
- [ ] `navigator.onLine` 為 false：立即顯示離線文案，沒有發出請求。
- [ ] 載入失敗：兩顆按鈕 disabled，指示為「載入失敗 · 重試」；點重試成功後按鈕恢復、資料預填。
- [ ] 切到補登選某天時載入失敗：同上，且回到今天後若載入成功則恢復。
- [ ] 舊後端（無 `version`）：功能正常，console 有一則 warn，UI 無變化。
- [ ] `?ping=1` 回 `version:4`。
- [ ] 全頁搜尋不到「忘、漏、缺、欠、還沒」。

## 10. 範圍外

- 不做離線暫存與自動重送。
- 不做送出時間戳（Sheet 無欄位，見 F2 規格第 8 節）。
- 不改 `doOptions`。

## 11. 待確認決策

- D3 逾時 20 秒。
- D4 載入失敗時**封鎖送出**（嚴格）。替代方案是只警告不封鎖，但那樣 S2 的覆蓋風險還在。
- D5 後端加 `version` 與 `?ping=1`。需要你再部署一次，但不阻擋前端先上。

## 12. 開放問題

1. D4 的代價：訊號極差的地方（例如捷運上）會完全不能記。目前判斷是可接受，因為載入與送出走同一條網路，載入都失敗的話送出大概也不會成功。若之後覺得太嚴，改成「找不到既有資料時才允許送出」也行，但這需要先成功載入才知道有沒有既有資料，邏輯上繞回原點。
