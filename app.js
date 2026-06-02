const storageKey = "examLazyTool.models.v1";

const defaultModels = [
  {
    id: createId(),
    name: "加權總分",
    formula: "round([x] * 0.35 + [y] * 0.45 + [z] * 0.2, 2)",
    selected: true,
  },
  {
    id: createId(),
    name: "是否及格",
    formula: "[加權總分] >= 60 ? '及格' : '補考'",
    selected: true,
  },
];

let models = loadModels();
let rows = [];
let outputRows = [];
let editingId = null;

const els = {
  modelForm: document.querySelector("#modelForm"),
  modelName: document.querySelector("#modelName"),
  modelFormula: document.querySelector("#modelFormula"),
  savedModels: document.querySelector("#savedModels"),
  clearModelForm: document.querySelector("#clearModelForm"),
  pasteArea: document.querySelector("#pasteArea"),
  fileInput: document.querySelector("#fileInput"),
  inputPreview: document.querySelector("#inputPreview"),
  selectedModels: document.querySelector("#selectedModels"),
  mappingFields: document.querySelector("#mappingFields"),
  autoMap: document.querySelector("#autoMap"),
  runAnalysis: document.querySelector("#runAnalysis"),
  outputTable: document.querySelector("#outputTable"),
  downloadCsv: document.querySelector("#downloadCsv"),
  messageArea: document.querySelector("#messageArea"),
  loadSample: document.querySelector("#loadSample"),
  clearData: document.querySelector("#clearData"),
  miniMode: document.querySelector("#miniMode"),
  minimizeApp: document.querySelector("#minimizeApp"),
  storageStatus: document.querySelector("#storageStatus"),
};

document.addEventListener("DOMContentLoaded", () => {
  renderModels();
  renderSelectedModels();
  setSampleData();
  attachEvents();
});

function attachEvents() {
  els.modelForm.addEventListener("submit", saveModelFromForm);
  els.clearModelForm.addEventListener("click", resetModelForm);
  els.fileInput.addEventListener("change", handleFileUpload);
  els.runAnalysis.addEventListener("click", runAnalysis);
  els.downloadCsv.addEventListener("click", downloadCsv);
  els.loadSample.addEventListener("click", setSampleData);
  els.clearData.addEventListener("click", clearData);
  els.autoMap.addEventListener("click", renderMappingFields);
  els.miniMode?.addEventListener("click", () => window.examLazyTool?.miniMode());
  els.minimizeApp?.addEventListener("click", () => window.examLazyTool?.minimize());

  if (!window.examLazyTool) {
    els.miniMode?.setAttribute("hidden", "");
    els.minimizeApp?.setAttribute("hidden", "");
  }

  els.pasteArea.addEventListener("input", () => {
    rows = parseDelimitedText(els.pasteArea.value);
    outputRows = [];
    renderTable(els.inputPreview, rows.slice(0, 8));
    renderTable(els.outputTable, []);
    renderMappingFields();
    updateMessage(rows.length ? `已讀取 ${rows.length} 筆資料` : "");
    els.downloadCsv.disabled = true;
  });

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      els.modelFormula.value = button.dataset.example;
      els.modelFormula.focus();
    });
  });

  document.querySelectorAll("[data-models]").forEach((button) => {
    button.addEventListener("click", () => addTemplateModels(button.dataset.models));
  });
}

function addTemplateModels(template) {
  template
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const [name, formula] = item.split("|");
      if (!name || !formula) return;
      const existing = models.find((model) => normalizeKey(model.name) === normalizeKey(name));
      if (existing) {
        existing.formula = formula;
        existing.selected = true;
      } else {
        models.push({ id: createId(), name, formula, selected: true });
      }
    });

  persistModels();
  renderModels();
  renderSelectedModels();
  renderMappingFields();
  updateMessage("已加入誤差 index 模型", "success");
}

function loadModels() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return Array.isArray(saved) && saved.length ? saved : defaultModels;
  } catch {
    return defaultModels;
  }
}

function persistModels() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(models));
    els.storageStatus.textContent = "本機儲存已更新";
  } catch {
    els.storageStatus.textContent = "本機儲存無法使用";
  }
}

function saveModelFromForm(event) {
  event.preventDefault();
  const name = els.modelName.value.trim();
  const formula = els.modelFormula.value.trim();

  if (!name || !formula) return;

  if (editingId) {
    models = models.map((model) => (model.id === editingId ? { ...model, name, formula } : model));
  } else {
    models.push({ id: createId(), name, formula, selected: true });
  }

  persistModels();
  resetModelForm();
  renderModels();
  renderSelectedModels();
  renderMappingFields();
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `model-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resetModelForm() {
  editingId = null;
  els.modelName.value = "";
  els.modelFormula.value = "";
  els.modelName.focus();
  els.modelForm.querySelector(".primary-btn").textContent = "儲存模型";
}

function renderModels() {
  if (!models.length) {
    els.savedModels.innerHTML = `<div class="message">尚未儲存模型</div>`;
    return;
  }

  els.savedModels.innerHTML = models
    .map(
      (model) => `
        <article class="model-item">
          <div class="model-top">
            <input type="checkbox" data-action="toggle" data-id="${model.id}" ${model.selected ? "checked" : ""} aria-label="選取 ${escapeHtml(model.name)}" />
            <div class="model-name">${escapeHtml(model.name)}</div>
            <button type="button" data-action="edit" data-id="${model.id}">編輯</button>
            <button type="button" data-action="delete" data-id="${model.id}">刪除</button>
          </div>
          <p class="model-formula">${escapeHtml(model.formula)}</p>
        </article>
      `,
    )
    .join("");

  els.savedModels.querySelectorAll("[data-action]").forEach((control) => {
    control.addEventListener("click", handleModelAction);
    control.addEventListener("change", handleModelAction);
  });
}

function handleModelAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  const model = models.find((item) => item.id === id);
  if (!model) return;

  if (action === "toggle") model.selected = event.currentTarget.checked;

  if (action === "edit") {
    editingId = id;
    els.modelName.value = model.name;
    els.modelFormula.value = model.formula;
    els.modelForm.querySelector(".primary-btn").textContent = "更新模型";
    els.modelName.focus();
  }

  if (action === "delete") {
    models = models.filter((item) => item.id !== id);
  }

  persistModels();
  renderModels();
  renderSelectedModels();
  renderMappingFields();
}

function renderSelectedModels() {
  const selected = models.filter((model) => model.selected);
  els.selectedModels.innerHTML = selected.length
    ? selected.map((model) => `<span class="chip">${escapeHtml(model.name)}</span>`).join("")
    : `<span class="chip">未選取模型</span>`;
}

function renderMappingFields() {
  const headers = getHeaders(rows);
  const variables = getFormulaVariables();

  if (!rows.length || !variables.length) {
    els.mappingFields.innerHTML = `<div class="empty-state">選取模型並載入資料後，這裡會出現公式變數對應表。</div>`;
    return;
  }

  els.mappingFields.innerHTML = variables
    .map((variable) => {
      const exact = headers.find((header) => normalizeKey(header) === normalizeKey(variable));
      const options = [
        `<option value="">不對應</option>`,
        ...headers.map(
          (header) =>
            `<option value="${escapeHtml(header)}" ${exact === header ? "selected" : ""}>${escapeHtml(header)}</option>`,
        ),
      ].join("");

      return `
        <label class="mapping-row">
          <span class="mapping-var">[${escapeHtml(variable)}]</span>
          <select data-variable="${escapeHtml(variable)}">${options}</select>
        </label>
      `;
    })
    .join("");
}

function getFormulaVariables() {
  const modelNames = new Set(models.map((model) => model.name));
  const variables = new Set();

  models
    .filter((model) => model.selected)
    .forEach((model) => {
      extractBracketVariables(model.formula).forEach((variable) => {
        if (!modelNames.has(variable)) variables.add(variable);
      });
      extractFieldStringVariables(model.formula).forEach((variable) => {
        if (!modelNames.has(variable)) variables.add(variable);
      });
    });

  return Array.from(variables);
}

function extractBracketVariables(formula) {
  return Array.from(formula.matchAll(/\[([^\]]+)\]/g), (match) => match[1].trim()).filter(Boolean);
}

function extractFieldStringVariables(formula) {
  const variables = [];
  const fieldFunctions = new Set([
    "SUM",
    "AVERAGE",
    "MEAN",
    "COUNT",
    "MEDIAN",
    "MODE",
    "MIN",
    "MAX",
    "SD",
    "STDEVP",
    "STDEVS",
    "STDEV.P",
    "STDEV.S",
    "VARIANCEP",
    "VARIANCES",
    "VAR.P",
    "VAR.S",
    "SUMPRODUCT",
    "EXPECTED",
    "EV",
    "EVPI",
    "RANK",
    "MOVINGAVERAGE",
    "MOVING_AVERAGE",
    "SMA",
    "SMA2",
    "SMA5",
    "SMA20",
    "WMA",
    "WMA5",
    "EXPONENTIALSMOOTHING",
    "EXPONENTIAL_SMOOTHING",
    "NAIVEFORECAST",
    "NAIVE_FORECAST",
    "FORECASTERROR",
    "FORECAST_ERROR",
    "MAD",
    "MSE",
    "MAPE",
    "BASS",
  ]);

  const callPattern = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(([^()]*)\)/g;
  let match;
  while ((match = callPattern.exec(formula)) !== null) {
    const fnName = match[1].replaceAll("_", "").toUpperCase();
    const originalName = match[1].toUpperCase();
    if (!fieldFunctions.has(fnName) && !fieldFunctions.has(originalName)) continue;

    const args = splitFormulaArgs(match[2]);
    getFieldArgIndexes(originalName, args.length).forEach((index) => {
      const value = unquote(args[index]);
      if (value && !isNonFieldString(value)) variables.push(value);
    });
  }

  return variables;
}

function getFieldArgIndexes(fnName, argCount) {
  if (["BASS"].includes(fnName)) return [0, 1, 2, 3].filter((index) => index < argCount);
  if (["WMA"].includes(fnName)) return [0];
  if (["EVPI"].includes(fnName)) return Array.from({ length: argCount }, (_, index) => index);
  if (["SUMPRODUCT", "EXPECTED", "EV", "FORECASTERROR", "FORECAST_ERROR", "MAD", "MSE", "MAPE"].includes(fnName)) {
    return [0, 1].filter((index) => index < argCount);
  }
  return argCount > 0 ? [0] : [];
}

function splitFormulaArgs(argsText) {
  const args = [];
  let current = "";
  let quote = "";
  for (let index = 0; index < argsText.length; index += 1) {
    const char = argsText[index];
    if ((char === "'" || char === '"') && argsText[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (char === "," && !quote) {
      args.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function unquote(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^(['"]).*\1$/.test(trimmed)) return "";
  return trimmed.slice(1, -1).trim();
}

function isNonFieldString(value) {
  return /,/.test(value) || ["asc", "desc", "sales", "cumulative"].includes(value.toLowerCase());
}

function getColumnMap() {
  return Object.fromEntries(
    Array.from(els.mappingFields.querySelectorAll("select[data-variable]")).map((select) => [
      select.dataset.variable,
      select.value,
    ]),
  );
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    if (["xlsx", "xls"].includes(extension)) {
      if (!window.XLSX) throw new Error("XLSX 套件尚未載入");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeRow);
      els.pasteArea.value = rowsToCsv(rows);
    } else {
      const text = await file.text();
      els.pasteArea.value = text;
      rows = parseDelimitedText(text);
    }

    outputRows = [];
    renderTable(els.inputPreview, rows.slice(0, 8));
    renderTable(els.outputTable, []);
    renderMappingFields();
    els.downloadCsv.disabled = true;
    updateMessage(`已讀取 ${file.name}，共 ${rows.length} 筆資料`, "success");
  } catch (error) {
    updateMessage(error.message, "error");
  } finally {
    event.target.value = "";
  }
}

function setSampleData() {
  els.pasteArea.value = [
    "姓名,g,h,作業,出席",
    "王小明,76,88,91,10",
    "陳怡君,59,63,72,8",
    "林柏翰,92,85,89,9",
    "張雅婷,47,58,66,7",
    "許哲宇,81,79,84,10",
  ].join("\n");
  rows = parseDelimitedText(els.pasteArea.value);
  outputRows = [];
  renderTable(els.inputPreview, rows.slice(0, 8));
  renderTable(els.outputTable, []);
  renderMappingFields();
  els.downloadCsv.disabled = true;
  updateMessage(`已讀取 ${rows.length} 筆資料`);
}

function clearData() {
  els.pasteArea.value = "";
  rows = [];
  outputRows = [];
  renderTable(els.inputPreview, []);
  renderTable(els.outputTable, []);
  renderMappingFields();
  els.downloadCsv.disabled = true;
  updateMessage("");
}

function runAnalysis() {
  const selected = models.filter((model) => model.selected);
  if (!rows.length) {
    updateMessage("請先貼上或上傳資料表", "error");
    return;
  }
  if (!selected.length) {
    updateMessage("請至少選取一個模型", "error");
    return;
  }

  const columnMap = getColumnMap();
  const context = createDatasetContext(rows, columnMap);
  const errors = [];

  outputRows = rows.map((sourceRow, rowIndex) => {
    const resultRow = { ...sourceRow };
    selected.forEach((model) => {
      try {
        resultRow[model.name] = evaluateFormula(model.formula, resultRow, rows, context, rowIndex, columnMap);
      } catch (error) {
        resultRow[model.name] = `錯誤：${error.message}`;
        errors.push(`${model.name} 第 ${rowIndex + 1} 列`);
      }
    });
    return resultRow;
  });

  renderTable(els.outputTable, outputRows);
  els.downloadCsv.disabled = false;
  updateMessage(
    errors.length ? `完成，但有 ${errors.length} 個公式錯誤` : `完成 ${outputRows.length} 筆分析`,
    errors.length ? "error" : "success",
  );
}

function evaluateFormula(formula, row, allRows, context, rowIndex, columnMap = {}) {
  const expression = formula.replace(/\[([^\]]+)\]/g, (_, key) => `value(${JSON.stringify(key.trim())})`);
  const helpers = {
    value: (key) => coerce(getCellValue(row, key, columnMap)),
    text: (key) => String(getCellValue(row, key, columnMap) ?? ""),
    num: (key) => toNumber(getCellValue(row, key, columnMap)),
    round: (value, digits = 0) => {
      const factor = 10 ** Number(digits);
      return Math.round(Number(value) * factor) / factor;
    },
    abs: Math.abs,
    sqrt: Math.sqrt,
    power: Math.pow,
    sum: (key) => context.sum(key),
    avg: (key) => context.avg(key),
    mean: (key) => context.avg(key),
    count: (key) => context.count(key),
    median: (key) => context.median(key),
    mode: (key) => context.mode(key),
    min: (key) => context.min(key),
    max: (key) => context.max(key),
    sd: (key) => context.sd(key),
    stdevp: (key) => context.sd(key),
    stdevs: (key) => context.sds(key),
    variancep: (key) => context.variance(key),
    variances: (key) => context.variances(key),
    sumproduct: (valueKey, weightKey) => context.sumproduct(valueKey, weightKey),
    expected: (valueKey, probabilityKey) => context.sumproduct(valueKey, probabilityKey),
    ev: (valueKey, probabilityKey) => context.sumproduct(valueKey, probabilityKey),
    evpi: (probabilityKey, ...payoffKeys) => context.evpi(probabilityKey, payoffKeys),
    movingAverage: (key, window) => context.movingAverage(key, rowIndex, window),
    sma: (key, window) => context.movingAverage(key, rowIndex, window),
    sma2: (key) => context.movingAverage(key, rowIndex, 2),
    sma5: (key) => context.movingAverage(key, rowIndex, 5),
    sma20: (key) => context.movingAverage(key, rowIndex, 20),
    wma: (key, weights) => context.weightedMovingAverage(key, rowIndex, weights),
    wma5: (key) => context.weightedMovingAverage(key, rowIndex, [1, 2, 3, 4, 5]),
    exponentialSmoothing: (key, alpha, initialForecast) =>
      context.exponentialSmoothing(key, rowIndex, alpha, initialForecast),
    naiveForecast: (key) => context.naiveForecast(key, rowIndex),
    forecastError: (actualKey, forecastKey) => context.forecastError(actualKey, forecastKey, rowIndex),
    mad: (actualKey, forecastKey) => context.mad(actualKey, forecastKey),
    mse: (actualKey, forecastKey) => context.mse(actualKey, forecastKey),
    mape: (actualKey, forecastKey) => context.mape(actualKey, forecastKey),
    bass: (period, marketSize, innovation, imitation, metric = "cumulative") =>
      bassModel(period, marketSize, innovation, imitation, metric),
    breakeven: (fixedCost, price, variableCost) => breakevenUnits(fixedCost, price, variableCost),
    eoq: (demand, orderCost, holdingCost) => eoq(demand, orderCost, holdingCost),
    safetyStock: (z, sigma, leadTime) => safetyStock(z, sigma, leadTime),
    reorderPoint: (demand, leadTime, z = 0, sigma = 0) => reorderPoint(demand, leadTime, z, sigma),
    newsvendorCR: (underageCost, overageCost) => newsvendorCriticalRatio(underageCost, overageCost),
    newsvendorQ: (mean, sigma, underageCost, overageCost) => newsvendorQuantity(mean, sigma, underageCost, overageCost),
    normInv: (probability) => normalInverse(probability),
    rank: (key, direction = "desc") => context.rank(key, rowIndex, direction),
    SUM: (key) => context.sum(key),
    AVERAGE: (key) => context.avg(key),
    MEAN: (key) => context.avg(key),
    COUNT: (key) => context.count(key),
    MEDIAN: (key) => context.median(key),
    MODE: (key) => context.mode(key),
    MIN: (key) => context.min(key),
    MAX: (key) => context.max(key),
    ROUND: (value, digits = 0) => {
      const factor = 10 ** Number(digits);
      return Math.round(Number(value) * factor) / factor;
    },
    ABS: Math.abs,
    SQRT: Math.sqrt,
    POWER: Math.pow,
    IF: (condition, yes, no) => (condition ? yes : no),
    SUMPRODUCT: (valueKey, weightKey) => context.sumproduct(valueKey, weightKey),
    EXPECTED: (valueKey, probabilityKey) => context.sumproduct(valueKey, probabilityKey),
    EV: (valueKey, probabilityKey) => context.sumproduct(valueKey, probabilityKey),
    EVPI: (probabilityKey, ...payoffKeys) => context.evpi(probabilityKey, payoffKeys),
    MOVING_AVERAGE: (key, window) => context.movingAverage(key, rowIndex, window),
    SMA: (key, window) => context.movingAverage(key, rowIndex, window),
    SMA2: (key) => context.movingAverage(key, rowIndex, 2),
    SMA5: (key) => context.movingAverage(key, rowIndex, 5),
    SMA20: (key) => context.movingAverage(key, rowIndex, 20),
    WMA: (key, weights) => context.weightedMovingAverage(key, rowIndex, weights),
    WMA5: (key) => context.weightedMovingAverage(key, rowIndex, [1, 2, 3, 4, 5]),
    EXPONENTIAL_SMOOTHING: (key, alpha, initialForecast) =>
      context.exponentialSmoothing(key, rowIndex, alpha, initialForecast),
    NAIVE_FORECAST: (key) => context.naiveForecast(key, rowIndex),
    FORECAST_ERROR: (actualKey, forecastKey) => context.forecastError(actualKey, forecastKey, rowIndex),
    MAD: (actualKey, forecastKey) => context.mad(actualKey, forecastKey),
    MSE: (actualKey, forecastKey) => context.mse(actualKey, forecastKey),
    MAPE: (actualKey, forecastKey) => context.mape(actualKey, forecastKey),
    BASS: (period, marketSize, innovation, imitation, metric = "cumulative") =>
      bassModel(period, marketSize, innovation, imitation, metric),
    BREAKEVEN: (fixedCost, price, variableCost) => breakevenUnits(fixedCost, price, variableCost),
    EOQ: (demand, orderCost, holdingCost) => eoq(demand, orderCost, holdingCost),
    SAFETY_STOCK: (z, sigma, leadTime) => safetyStock(z, sigma, leadTime),
    REORDER_POINT: (demand, leadTime, z = 0, sigma = 0) => reorderPoint(demand, leadTime, z, sigma),
    ROP: (demand, leadTime, z = 0, sigma = 0) => reorderPoint(demand, leadTime, z, sigma),
    NEWSVENDOR_CR: (underageCost, overageCost) => newsvendorCriticalRatio(underageCost, overageCost),
    NEWSVENDOR_Q: (mean, sigma, underageCost, overageCost) => newsvendorQuantity(mean, sigma, underageCost, overageCost),
    NORM_INV: (probability) => normalInverse(probability),
    STDEV: {
      P: (key) => context.sd(key),
      S: (key) => context.sds(key),
    },
    VAR: {
      P: (key) => context.variance(key),
      S: (key) => context.variances(key),
    },
    rowNumber: rowIndex + 1,
    rows: allRows,
    Math,
  };

  const argNames = Object.keys(helpers);
  const argValues = Object.values(helpers);
  const fn = new Function(...argNames, `"use strict"; return (${expression});`);
  return fn(...argValues);
}

function createDatasetContext(dataset, columnMap = {}) {
  const numberList = (key) =>
    dataset.map((row) => toNumber(getCellValue(row, key, columnMap))).filter((value) => Number.isFinite(value));
  const valueAt = (key, rowIndex) => toNumber(getCellValue(dataset[rowIndex], key, columnMap));
  const previousValues = (key, rowIndex, window) => {
    const end = Math.max(0, rowIndex);
    const start = Math.max(0, end - Number(window));
    return dataset
      .slice(start, end)
      .map((row) => toNumber(getCellValue(row, key, columnMap)))
      .filter((value) => Number.isFinite(value));
  };
  const errorList = (actualKey, forecastKey) => {
    return dataset
      .map((row) => {
        const actual = toNumber(getCellValue(row, actualKey, columnMap));
        const forecast = toNumber(getCellValue(row, forecastKey, columnMap));
        return Number.isFinite(actual) && Number.isFinite(forecast) ? { actual, error: actual - forecast } : null;
      })
      .filter(Boolean);
  };
  const meanOf = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0);
  const varianceOf = (values, sample = false) => {
    if (!values.length || (sample && values.length < 2)) return 0;
    const mean = meanOf(values);
    const divisor = sample ? values.length - 1 : values.length;
    return values.reduce((total, value) => total + (value - mean) ** 2, 0) / divisor;
  };

  return {
    sum: (key) => numberList(key).reduce((total, value) => total + value, 0),
    count: (key) => numberList(key).length,
    avg: (key) => {
      const values = numberList(key);
      return meanOf(values);
    },
    median: (key) => {
      const values = numberList(key).sort((a, b) => a - b);
      if (!values.length) return 0;
      const middle = Math.floor(values.length / 2);
      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    },
    mode: (key) => {
      const counts = new Map();
      numberList(key).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      let bestValue = "";
      let bestCount = 0;
      counts.forEach((count, value) => {
        if (count > bestCount) {
          bestValue = value;
          bestCount = count;
        }
      });
      return bestValue;
    },
    min: (key) => {
      const values = numberList(key);
      return values.length ? Math.min(...values) : 0;
    },
    max: (key) => {
      const values = numberList(key);
      return values.length ? Math.max(...values) : 0;
    },
    sd: (key) => {
      const values = numberList(key);
      return Math.sqrt(varianceOf(values));
    },
    sds: (key) => {
      const values = numberList(key);
      return Math.sqrt(varianceOf(values, true));
    },
    variance: (key) => varianceOf(numberList(key)),
    variances: (key) => varianceOf(numberList(key), true),
    sumproduct: (valueKey, weightKey) => {
      return dataset.reduce((total, row) => {
        const value = toNumber(getCellValue(row, valueKey, columnMap));
        const weight = toNumber(getCellValue(row, weightKey, columnMap));
        return Number.isFinite(value) && Number.isFinite(weight) ? total + value * weight : total;
      }, 0);
    },
    evpi: (probabilityKey, payoffKeys) => {
      const keys = payoffKeys.flat().filter(Boolean);
      if (!keys.length) return 0;

      const expectedWithPerfectInfo = dataset.reduce((total, row) => {
        const probability = toNumber(getCellValue(row, probabilityKey, columnMap));
        const bestPayoff = Math.max(
          ...keys.map((key) => toNumber(getCellValue(row, key, columnMap))).filter((value) => Number.isFinite(value)),
        );
        return Number.isFinite(probability) && Number.isFinite(bestPayoff) ? total + probability * bestPayoff : total;
      }, 0);

      const bestExpectedValue = Math.max(
        ...keys.map((key) =>
          dataset.reduce((total, row) => {
            const probability = toNumber(getCellValue(row, probabilityKey, columnMap));
            const payoff = toNumber(getCellValue(row, key, columnMap));
            return Number.isFinite(probability) && Number.isFinite(payoff) ? total + probability * payoff : total;
          }, 0),
        ),
      );

      return expectedWithPerfectInfo - bestExpectedValue;
    },
    movingAverage: (key, rowIndex, window) => {
      const values = previousValues(key, rowIndex, window);
      return meanOf(values);
    },
    weightedMovingAverage: (key, rowIndex, weights) => {
      const parsedWeights = parseWeights(weights);
      const values = previousValues(key, rowIndex, parsedWeights.length);
      if (!values.length) return 0;
      const activeWeights = parsedWeights.slice(parsedWeights.length - values.length);
      const totalWeight = activeWeights.reduce((total, weight) => total + weight, 0);
      if (!totalWeight) return 0;
      return values.reduce((total, value, index) => total + value * activeWeights[index], 0) / totalWeight;
    },
    exponentialSmoothing: (key, rowIndex, alpha, initialForecast) => {
      const smoothing = Number(alpha);
      if (!Number.isFinite(smoothing) || smoothing < 0 || smoothing > 1) return 0;
      const values = dataset.map((row) => toNumber(getCellValue(row, key, columnMap))).filter((value) => Number.isFinite(value));
      if (!values.length) return 0;
      let forecast = Number.isFinite(Number(initialForecast)) ? Number(initialForecast) : values[0];
      for (let index = 1; index <= rowIndex && index < values.length; index += 1) {
        forecast = smoothing * values[index - 1] + (1 - smoothing) * forecast;
      }
      return forecast;
    },
    naiveForecast: (key, rowIndex) => (rowIndex > 0 ? valueAt(key, rowIndex - 1) : 0),
    forecastError: (actualKey, forecastKey, rowIndex) => {
      const actual = valueAt(actualKey, rowIndex);
      const forecast = valueAt(forecastKey, rowIndex);
      return Number.isFinite(actual) && Number.isFinite(forecast) ? actual - forecast : 0;
    },
    mad: (actualKey, forecastKey) => meanOf(errorList(actualKey, forecastKey).map((item) => Math.abs(item.error))),
    mse: (actualKey, forecastKey) => meanOf(errorList(actualKey, forecastKey).map((item) => item.error ** 2)),
    mape: (actualKey, forecastKey) => {
      const percentages = errorList(actualKey, forecastKey)
        .filter((item) => item.actual !== 0)
        .map((item) => Math.abs(item.error / item.actual) * 100);
      return meanOf(percentages);
    },
    rank: (key, rowIndex, direction) => {
      const current = toNumber(getCellValue(dataset[rowIndex], key, columnMap));
      const values = numberList(key).sort((a, b) => (direction === "asc" ? a - b : b - a));
      return values.findIndex((value) => value === current) + 1;
    },
  };
}

function parseWeights(weights) {
  if (Array.isArray(weights)) return weights.map(Number).filter((weight) => Number.isFinite(weight));
  if (typeof weights === "string") {
    return weights
      .split(",")
      .map((weight) => Number(weight.trim()))
      .filter((weight) => Number.isFinite(weight));
  }
  const count = Number(weights);
  if (Number.isInteger(count) && count > 0) return Array.from({ length: count }, (_, index) => index + 1);
  return [];
}

function bassModel(period, marketSize, innovation, imitation, metric = "cumulative") {
  const t = Number(period);
  const m = Number(marketSize);
  const p = Number(innovation);
  const q = Number(imitation);
  if (![t, m, p, q].every((value) => Number.isFinite(value)) || p <= 0 || t < 0) return 0;

  const cumulative = (time) => {
    if (time <= 0) return 0;
    const growth = Math.exp(-(p + q) * time);
    return (m * (1 - growth)) / (1 + (q / p) * growth);
  };

  if (String(metric).toLowerCase().startsWith("sales")) return cumulative(t) - cumulative(t - 1);
  return cumulative(t);
}

function breakevenUnits(fixedCost, price, variableCost) {
  const fixed = Number(fixedCost);
  const unitPrice = Number(price);
  const variable = Number(variableCost);
  const contribution = unitPrice - variable;
  return Number.isFinite(fixed) && Number.isFinite(contribution) && contribution !== 0 ? fixed / contribution : 0;
}

function eoq(demand, orderCost, holdingCost) {
  const d = Number(demand);
  const s = Number(orderCost);
  const h = Number(holdingCost);
  return [d, s, h].every((value) => Number.isFinite(value)) && h > 0 ? Math.sqrt((2 * d * s) / h) : 0;
}

function safetyStock(z, sigma, leadTime) {
  const serviceZ = Number(z);
  const stdDev = Number(sigma);
  const lead = Number(leadTime);
  return [serviceZ, stdDev, lead].every((value) => Number.isFinite(value)) && lead >= 0
    ? serviceZ * stdDev * Math.sqrt(lead)
    : 0;
}

function reorderPoint(demand, leadTime, z = 0, sigma = 0) {
  const d = Number(demand);
  const lead = Number(leadTime);
  return [d, lead].every((value) => Number.isFinite(value)) ? d * lead + safetyStock(z, sigma, lead) : 0;
}

function newsvendorCriticalRatio(underageCost, overageCost) {
  const cu = Number(underageCost);
  const co = Number(overageCost);
  const denominator = cu + co;
  return [cu, co, denominator].every((value) => Number.isFinite(value)) && denominator !== 0 ? cu / denominator : 0;
}

function newsvendorQuantity(mean, sigma, underageCost, overageCost) {
  const mu = Number(mean);
  const stdDev = Number(sigma);
  const criticalRatio = newsvendorCriticalRatio(underageCost, overageCost);
  return [mu, stdDev, criticalRatio].every((value) => Number.isFinite(value))
    ? mu + normalInverse(criticalRatio) * stdDev
    : 0;
}

function normalInverse(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return 0;

  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > high) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function getCellValue(row, key, columnMap = {}) {
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const mappedKey = columnMap[key];
  if (mappedKey && Object.prototype.hasOwnProperty.call(row, mappedKey)) return row[mappedKey];
  return undefined;
}

function parseDelimitedText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const delimiter = detectDelimiter(trimmed);
  const matrix = parseRows(trimmed, delimiter).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (matrix.length < 2) return [];

  const headers = matrix[0].map((header, index) => header.trim() || `欄位${index + 1}`);
  return matrix.slice(1).map((line) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = line[index] ?? "";
    });
    return normalizeRow(row);
  });
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const candidates = [",", "\t", ";"];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key).trim(), typeof value === "string" ? value.trim() : value]),
  );
}

function renderTable(table, dataset) {
  if (!dataset.length) {
    table.innerHTML = "";
    return;
  }

  const headers = getHeaders(dataset);
  const head = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  const body = dataset
    .map(
      (row) => `
        <tr>
          ${headers
            .map((header) => {
              const value = row[header] ?? "";
              const isError = String(value).startsWith("錯誤：");
              return `<td class="${isError ? "error-cell" : ""}">${escapeHtml(formatCell(value))}</td>`;
            })
            .join("")}
        </tr>
      `,
    )
    .join("");

  table.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function rowsToCsv(dataset) {
  if (!dataset.length) return "";
  const headers = getHeaders(dataset);
  return [
    headers.map(csvEscape).join(","),
    ...dataset.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n");
}

function downloadCsv() {
  const csv = rowsToCsv(outputRows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `exam-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getHeaders(dataset) {
  return Array.from(new Set(dataset.flatMap((row) => Object.keys(row))));
}

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll(" ", "");
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function coerce(value) {
  const number = toNumber(value);
  return Number.isFinite(number) && String(value ?? "").trim() !== "" ? number : value;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replaceAll(",", "").trim());
}

function formatCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Number.parseFloat(value.toFixed(6));
  return value;
}

function updateMessage(text, type = "") {
  els.messageArea.textContent = text;
  els.messageArea.className = `message ${type}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
