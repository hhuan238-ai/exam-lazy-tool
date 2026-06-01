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
    });

  return Array.from(variables);
}

function extractBracketVariables(formula) {
  return Array.from(formula.matchAll(/\[([^\]]+)\]/g), (match) => match[1].trim()).filter(Boolean);
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
    sum: (key) => context.sum(key),
    avg: (key) => context.avg(key),
    min: (key) => context.min(key),
    max: (key) => context.max(key),
    sd: (key) => context.sd(key),
    rank: (key, direction = "desc") => context.rank(key, rowIndex, direction),
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

  return {
    sum: (key) => numberList(key).reduce((total, value) => total + value, 0),
    avg: (key) => {
      const values = numberList(key);
      return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
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
      if (!values.length) return 0;
      const mean = values.reduce((total, value) => total + value, 0) / values.length;
      const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    },
    rank: (key, rowIndex, direction) => {
      const current = toNumber(getCellValue(dataset[rowIndex], key, columnMap));
      const values = numberList(key).sort((a, b) => (direction === "asc" ? a - b : b - a));
      return values.findIndex((value) => value === current) + 1;
    },
  };
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
