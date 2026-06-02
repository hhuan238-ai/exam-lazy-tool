# 考試懶人工具

可儲存公式 / 模型，貼上或上傳資料表後批次分析，並可打包成 Windows 桌面應用程式。

## 桌面應用程式

開發模式：

```bash
npm install
npm start
```

打包 Windows app：

```bash
npm run package:win
```

打包後開啟：

```text
release/Exam Lazy Tool-win32-x64/Exam Lazy Tool.exe
```

桌面版支援側邊模式。按「側邊模式」或視窗最小化時，主視窗會收起，螢幕右側會留下小浮窗；點擊小浮窗即可叫回主視窗。

側邊模式內建四個快速工具：

- 一般預測：貼上或上傳資料後指定需求欄位，輸出 Naive Forecast、2-SMA、5-SMA、20-SMA、5-WMA。
- 指數平滑：貼上或上傳資料後指定需求欄位，可使用預設 alpha `0.3` 或輸入新 alpha，輸出 Exponential Smoothing Forecast。
- Bass：貼上或上傳資料後指定 `period`、`market`、`p`、`q` 欄位，輸出 Bass cumulative adoption 與 Bass sales。
- 誤差 index：貼上或上傳資料後指定 actual 與 forecast 欄位，輸出 Forecast Error、MAD、MSE、MAPE。

## 公式範例

公式內的 `[欄位]` 代表目前資料列的值。字串欄位名稱，例如 `"demand"`，通常代表整個欄位，會用在平均、預測誤差、移動平均等模型。

```js
[x] * 0.35 + [y] * 0.45 + [z] * 0.2
IF([score] >= 60, "及格", "補考")
EV("value", "prob")
EVPI("prob", "optionA", "optionB", "optionC")
SMA("demand", 5)
WMA5("demand")
EXPONENTIAL_SMOOTHING("demand", 0.3)
NAIVE_FORECAST("demand")
FORECAST_ERROR("actual", "forecast")
MAD("actual", "forecast")
MSE("actual", "forecast")
MAPE("actual", "forecast")
BASS([period], [market], [p], [q], "sales")
BREAKEVEN([fixedCost], [price], [variableCost])
```

## Excel 風格公式

- `SUM("x")`：加總欄位
- `AVERAGE("x")` / `MEAN("x")`：平均
- `COUNT("x")`：數值筆數
- `MIN("x")` / `MAX("x")`：最小值 / 最大值
- `MEDIAN("x")` / `MODE("x")`：中位數 / 眾數
- `STDEV.P("x")` / `STDEV.S("x")`：母體 / 樣本標準差
- `VAR.P("x")` / `VAR.S("x")`：母體 / 樣本變異數
- `SUMPRODUCT("value", "prob")`：兩欄相乘後加總
- `EV("value", "prob")` / `EXPECTED("value", "prob")`：期望值
- `ROUND(value, digits)`、`ABS(value)`、`SQRT(value)`、`POWER(value, n)`：常用數學函式
- `IF(condition, trueValue, falseValue)`：條件判斷

## 決策與預測模型

- `EVPI("prob", "optionA", "optionB", ...)`：Expected Value of Perfect Information。資料列代表不同 state，`prob` 是機率欄，其餘欄是各方案 payoff。
- `MOVING_AVERAGE("demand", n)` / `SMA("demand", n)`：n 期簡單移動平均，用目前列之前的 n 筆資料做 forecast。
- `SMA2("demand")`、`SMA5("demand")`、`SMA20("demand")`：2-SMA、5-SMA、20-SMA 快捷公式。
- `WMA("demand", "1,2,3,4,5")`：加權移動平均，權重由舊到新。
- `WMA5("demand")`：5-WMA 快捷公式，權重為 `1,2,3,4,5`。
- `EXPONENTIAL_SMOOTHING("demand", 0.3)`：指數平滑，第二個參數是 alpha。
- `NAIVE_FORECAST("demand")`：Naive forecast，使用上一期實際值。
- `FORECAST_ERROR("actual", "forecast")`：目前列的 actual - forecast。
- `MAD("actual", "forecast")`：平均絕對誤差。
- `MSE("actual", "forecast")`：均方誤差。
- `MAPE("actual", "forecast")`：平均絕對百分比誤差，百分比單位。
- `BASS([period], [market], [p], [q])`：Bass model 累積採用量。
- `BASS([period], [market], [p], [q], "sales")`：Bass model 當期採用量。
- `BREAKEVEN([fixedCost], [price], [variableCost])`：損益兩平銷售量。

## 變數對應

公式可以先用固定變數名稱，例如 `[x] + [y]`。如果題目資料表的欄位叫 `g` 和 `h`，載入資料後到「欄位對應」把 `x` 對到 `g`、`y` 對到 `h`，不用重寫公式。

## 資料格式

支援貼上 CSV、TSV、分號分隔資料，也支援上傳 `.csv`、`.tsv`、`.txt`、`.xlsx`、`.xls`。

模型存在瀏覽器 / app 的 localStorage，不會上傳到伺服器。
