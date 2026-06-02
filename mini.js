const toolConfig = {
  forecast: {
    title: "一般預測",
    fields: [{ key: "demand", label: "需求 / 實際值", hints: ["demand", "actual", "sales", "value", "需求", "實際"] }],
    sample: "period,demand\n1,120\n2,132\n3,128\n4,141\n5,150\n6,146\n7,158",
  },
  smoothing: {
    title: "指數平滑",
    fields: [{ key: "demand", label: "需求 / 實際值", hints: ["demand", "actual", "sales", "value", "需求", "實際"] }],
    sample: "period,demand\n1,120\n2,132\n3,128\n4,141\n5,150\n6,146\n7,158",
  },
  bass: {
    title: "Bass Model",
    fields: [
      { key: "period", label: "期數", hints: ["period", "time", "t", "期"] },
      { key: "market", label: "市場規模", hints: ["market", "m", "市場"] },
      { key: "p", label: "p 創新係數", hints: ["p", "innovation"] },
      { key: "q", label: "q 模仿係數", hints: ["q", "imitation"] },
    ],
    sample: "period,market,p,q\n1,1000,0.03,0.38\n2,1000,0.03,0.38\n3,1000,0.03,0.38\n4,1000,0.03,0.38\n5,1000,0.03,0.38",
  },
  error: {
    title: "誤差 index",
    fields: [
      { key: "actual", label: "實際值", hints: ["actual", "demand", "sales", "value", "實際", "需求"] },
      { key: "forecast", label: "預測值", hints: ["forecast", "predicted", "prediction", "預測"] },
    ],
    sample: "period,actual,forecast\n1,100,90\n2,120,100\n3,80,85\n4,110,100\n5,130,125",
  },
};

let activeTool = "forecast";
let rows = [];
let lastOutput = [];

const els = {
  panel: document.querySelector("#toolPanel"),
  title: document.querySelector("#toolTitle"),
  data: document.querySelector("#quickData"),
  file: document.querySelector("#quickFile"),
  mapping: document.querySelector("#quickMapping"),
  output: document.querySelector("#quickOutput"),
  copyResult: document.querySelector("#copyResult"),
  downloadResult: document.querySelector("#downloadResult"),
  message: document.querySelector("#miniMessage"),
  alphaField: document.querySelector("#alphaField"),
  alpha: document.querySelector("#alphaInput"),
};

document.querySelector("#restoreApp").addEventListener("click", () => window.examLazyTool?.restore());
document.querySelector("#collapsePanel").addEventListener("click", collapsePanel);
document.querySelector("#sampleData").addEventListener("click", loadSample);
document.querySelector("#runQuickTool").addEventListener("click", runTool);
els.copyResult.addEventListener("click", copyResult);
els.downloadResult.addEventListener("click", downloadResult);
els.data.addEventListener("input", () => {
  rows = parseDelimitedText(els.data.value);
  renderMapping();
  renderTable([]);
  setMessage(rows.length ? `已讀取 ${rows.length} 筆資料` : "");
});
els.file.addEventListener("change", handleUpload);

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
});

function selectTool(tool) {
  activeTool = tool;
  window.examLazyTool?.expandMini();
  els.panel.hidden = false;
  els.title.textContent = toolConfig[tool].title;
  updateAlphaField();
  document.querySelectorAll(".mode-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tool === tool));
  if (!els.data.value.trim()) loadSample();
  renderMapping();
  renderTable([]);
}

function updateAlphaField() {
  const shouldShow = activeTool === "smoothing";
  els.alphaField.hidden = !shouldShow;
  els.alphaField.style.display = shouldShow ? "grid" : "none";
  if (!shouldShow) els.alpha.value = "0.3";
}

function collapsePanel() {
  els.panel.hidden = true;
  window.examLazyTool?.collapseMini();
}

function loadSample() {
  els.data.value = toolConfig[activeTool].sample;
  rows = parseDelimitedText(els.data.value);
  renderMapping();
  renderTable([]);
  setMessage(`已讀取 ${rows.length} 筆範例資料`);
}

async function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["xlsx", "xls"].includes(ext)) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeRow);
      els.data.value = rowsToCsv(rows);
    } else {
      els.data.value = await file.text();
      rows = parseDelimitedText(els.data.value);
    }
    renderMapping();
    renderTable([]);
    setMessage(`已讀取 ${file.name}，共 ${rows.length} 筆`);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    event.target.value = "";
  }
}

function renderMapping() {
  const headers = getHeaders(rows);
  const fields = toolConfig[activeTool].fields;
  if (!headers.length) {
    els.mapping.innerHTML = "";
    return;
  }

  els.mapping.innerHTML = fields
    .map((field) => {
      const guess = guessHeader(headers, field.hints);
      const options = headers
        .map((header) => `<option value="${escapeHtml(header)}" ${header === guess ? "selected" : ""}>${escapeHtml(header)}</option>`)
        .join("");
      return `
        <label class="mapping-row">
          <span>${escapeHtml(field.label)}</span>
          <select data-field="${field.key}">${options}</select>
        </label>
      `;
    })
    .join("");
}

function runTool() {
  if (!rows.length) {
    setMessage("請先貼上或上傳資料表", "error");
    return;
  }
  const map = getMap();
  let output = [];

  if (activeTool === "forecast") output = runForecast(map);
  if (activeTool === "smoothing") output = runSmoothing(map);
  if (activeTool === "bass") output = runBass(map);
  if (activeTool === "error") output = runErrorIndex(map);

  lastOutput = output;
  renderTable(output);
  updateResultActions();
  setMessage(`完成 ${output.length} 筆輸出`);
}

function runForecast(map) {
  const values = rows.map((row) => toNumber(row[map.demand]));
  const naive = values.map((_, index) => (index > 0 ? values[index - 1] : ""));

  return rows.map((row, index) => {
    return {
      ...row,
      "Naive Forecast": formatNumber(naive[index]),
      "2-SMA": formatNumber(sma(values, index, 2)),
      "5-SMA": formatNumber(sma(values, index, 5)),
      "20-SMA": formatNumber(sma(values, index, 20)),
      "5-WMA": formatNumber(wma(values, index, [1, 2, 3, 4, 5])),
    };
  });
}

function runErrorIndex(map) {
  const actualValues = rows.map((row) => toNumber(row[map.actual]));
  const forecastValues = rows.map((row) => toNumber(row[map.forecast]));

  return rows.map((row, index) => {
    const actual = actualValues[index];
    const forecast = forecastValues[index];
    const error = Number.isFinite(actual) && Number.isFinite(forecast) ? actual - forecast : "";
    return {
      ...row,
      "Forecast Error": formatNumber(error),
      MAD: formatNumber(metric(actualValues, forecastValues, "mad")),
      MSE: formatNumber(metric(actualValues, forecastValues, "mse")),
      MAPE: formatNumber(metric(actualValues, forecastValues, "mape")),
    };
  });
}

function runSmoothing(map) {
  const alpha = Number(els.alpha.value || 0.3);
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    setMessage("Alpha 必須介於 0 到 1", "error");
    return [];
  }
  const values = rows.map((row) => toNumber(row[map.demand]));
  const forecasts = exponentialSmoothing(values, alpha);
  return rows.map((row, index) => ({
    ...row,
    Alpha: alpha,
    "Exponential Smoothing": formatNumber(forecasts[index]),
    "Forecast Error": formatNumber(Number.isFinite(values[index]) && Number.isFinite(forecasts[index]) ? values[index] - forecasts[index] : ""),
  }));
}

function runBass(map) {
  return rows.map((row) => {
    const period = toNumber(row[map.period]);
    const market = toNumber(row[map.market]);
    const p = toNumber(row[map.p]);
    const q = toNumber(row[map.q]);
    return {
      ...row,
      "Bass Cumulative": formatNumber(bass(period, market, p, q, "cumulative")),
      "Bass Sales": formatNumber(bass(period, market, p, q, "sales")),
    };
  });
}

function getMap() {
  return Object.fromEntries(Array.from(els.mapping.querySelectorAll("select")).map((select) => [select.dataset.field, select.value]));
}

function sma(values, rowIndex, window) {
  const slice = previousValues(values, rowIndex, window);
  return average(slice);
}

function wma(values, rowIndex, weights) {
  const slice = previousValues(values, rowIndex, weights.length);
  if (!slice.length) return "";
  const activeWeights = weights.slice(weights.length - slice.length);
  const totalWeight = activeWeights.reduce((sum, weight) => sum + weight, 0);
  return slice.reduce((sum, value, index) => sum + value * activeWeights[index], 0) / totalWeight;
}

function previousValues(values, rowIndex, window) {
  return values.slice(Math.max(0, rowIndex - window), rowIndex).filter((value) => Number.isFinite(value));
}

function exponentialSmoothing(values, alpha) {
  const forecasts = [];
  let forecast = values.find((value) => Number.isFinite(value)) ?? 0;
  values.forEach((value, index) => {
    forecasts[index] = forecast;
    if (Number.isFinite(value)) forecast = alpha * value + (1 - alpha) * forecast;
  });
  return forecasts;
}

function metric(actualValues, forecastValues, kind) {
  const pairs = actualValues
    .map((actual, index) => ({ actual, forecast: forecastValues[index] }))
    .filter((item) => Number.isFinite(item.actual) && Number.isFinite(item.forecast));
  if (!pairs.length) return "";
  if (kind === "mad") return average(pairs.map((item) => Math.abs(item.actual - item.forecast)));
  if (kind === "mse") return average(pairs.map((item) => (item.actual - item.forecast) ** 2));
  return average(pairs.filter((item) => item.actual !== 0).map((item) => Math.abs((item.actual - item.forecast) / item.actual) * 100));
}

function bass(period, market, p, q, metricName) {
  if (![period, market, p, q].every((value) => Number.isFinite(value)) || p <= 0 || period < 0) return "";
  const cumulative = (time) => {
    if (time <= 0) return 0;
    const growth = Math.exp(-(p + q) * time);
    return (market * (1 - growth)) / (1 + (q / p) * growth);
  };
  return metricName === "sales" ? cumulative(period) - cumulative(period - 1) : cumulative(period);
}

function parseDelimitedText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const delimiter = detectDelimiter(trimmed);
  const matrix = parseRows(trimmed, delimiter).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((header, index) => header.trim() || `欄位${index + 1}`);
  return matrix.slice(1).map((line) => normalizeRow(Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""]))));
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
  return [",", "\t", ";"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), typeof value === "string" ? value.trim() : value]));
}

function rowsToCsv(dataset) {
  const headers = getHeaders(dataset);
  return [headers.join(","), ...dataset.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))].join("\n");
}

function renderTable(dataset) {
  if (!dataset.length) {
    els.output.innerHTML = "";
    lastOutput = [];
    updateResultActions();
    return;
  }
  const headers = getHeaders(dataset);
  els.output.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${dataset
        .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`)
        .join("")}
    </tbody>
  `;
}

async function copyResult() {
  if (!lastOutput.length) return;
  const text = rowsToCsv(lastOutput);
  try {
    await navigator.clipboard.writeText(text);
    setMessage("結果已複製");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    setMessage("結果已複製");
  }
}

function downloadResult() {
  if (!lastOutput.length) return;
  const blob = new Blob([`\uFEFF${rowsToCsv(lastOutput)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quick-${activeTool}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setMessage("CSV 已下載");
}

function updateResultActions() {
  const enabled = lastOutput.length > 0;
  els.copyResult.disabled = !enabled;
  els.downloadResult.disabled = !enabled;
}

function getHeaders(dataset) {
  return Array.from(new Set(dataset.flatMap((row) => Object.keys(row))));
}

function guessHeader(headers, hints) {
  const normalized = headers.map((header) => ({ header, key: normalizeKey(header) }));
  for (const hint of hints) {
    const found = normalized.find((item) => item.key.includes(normalizeKey(hint)));
    if (found) return found.header;
  }
  return headers[0] || "";
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : "";
}

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replaceAll(",", "").trim());
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number.parseFloat(value.toFixed(6)) : value;
}

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll(" ", "");
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function setMessage(text, type = "") {
  els.message.textContent = text;
  els.message.className = `mini-message ${type}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
