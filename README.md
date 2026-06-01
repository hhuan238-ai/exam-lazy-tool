# 考試懶人工具

免安裝的靜態網頁應用，可儲存公式或模型，貼上或上傳資料表後批次產生分析欄位。

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

## 網頁檔案開啟

直接用瀏覽器開啟 `index.html`。

## 公式範例

```js
[x] * 0.35 + [y] * 0.45 + [z] * 0.2
[總分] >= 60 ? "及格" : "補考"
round(([分數] - avg("分數")) / sd("分數"), 2)
rank("分數", "desc")
EV("value", "prob")
SUMPRODUCT("value", "prob")
AVERAGE("score")
STDEV.P("score")
IF([score] >= 60, "及格", "補考")
```

## 常用公式

- `SUM("x")`：加總欄位
- `AVERAGE("x")` / `MEAN("x")`：平均
- `COUNT("x")`：數值筆數
- `MIN("x")` / `MAX("x")`：最小值 / 最大值
- `MEDIAN("x")` / `MODE("x")`：中位數 / 眾數
- `STDEV.P("x")` / `STDEV.S("x")`：母體 / 樣本標準差
- `VAR.P("x")` / `VAR.S("x")`：母體 / 樣本變異數
- `SUMPRODUCT("value", "prob")`：兩欄相乘後加總
- `EV("value", "prob")` / `EXPECTED("value", "prob")`：期望值，等同 `SUMPRODUCT`
- `ROUND(value, digits)`、`ABS(value)`、`SQRT(value)`、`POWER(value, n)`：常用數學函式
- `IF(condition, trueValue, falseValue)`：條件判斷

期望值範例資料：

```csv
case,value,prob
A,100,0.2
B,50,0.5
C,-20,0.3
```

公式：

```js
EV("value", "prob")
```

## 變數對應

公式可以先用固定變數名稱，例如 `[x] + [y]`。如果題目資料表的欄位叫 `g` 和 `h`，載入資料後到「欄位對應」把 `x` 對到 `g`、`y` 對到 `h`，不用重寫公式。

## 資料格式

支援貼上 CSV、TSV、分號分隔資料，也支援上傳 `.csv`、`.tsv`、`.txt`、`.xlsx`、`.xls`。

模型會存在瀏覽器的 localStorage，不會上傳到伺服器。
