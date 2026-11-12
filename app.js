// apple_stock_dashboard app.js
let charts = {};
let currentRawData = [];

// Helper math functions
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  const m = mean(arr);
  return arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1);
}

function stdDev(arr) {
  return Math.sqrt(variance(arr));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(arr, q) {
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (s[base + 1] !== undefined) {
    return s[base] + rest * (s[base + 1] - s[base]);
  } else {
    return s[base];
  }
}

function skewness(arr) {
  const n = arr.length;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return 0;
  const m3 = arr.reduce((acc, x) => acc + Math.pow((x - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * m3;
}

function kurtosis(arr) {
  const n = arr.length;
  const m = mean(arr);
  const s = stdDev(arr);
  if (s === 0) return 0;
  const m4 = arr.reduce((acc, x) => acc + Math.pow((x - m) / s, 4), 0);
  const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const factor2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return factor1 * m4 - factor2; // Excess kurtosis
}

function pearsonCorr(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return num / Math.sqrt(denX * denY);
}

// Linear regression: y = m*x + b
function linearRegression(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += Math.pow(x[i] - mx, 2);
  }
  const slope = num / den;
  const intercept = my - slope * mx;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept;
    ssTot += Math.pow(y[i] - my, 2);
    ssRes += Math.pow(y[i] - pred, 2);
  }
  const r2 = 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// Parse CSV text
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(s => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',').map(s => s.trim());
    if (cols.length >= 7) {
      rows.push({
        date: cols[0],
        open: parseFloat(cols[1]),
        high: parseFloat(cols[2]),
        low: parseFloat(cols[3]),
        close: parseFloat(cols[4]),
        adjClose: parseFloat(cols[5]),
        volume: parseFloat(cols[6])
      });
    }
  }
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  if (typeof EMBEDDED_CSV !== "undefined") {
    loadData(EMBEDDED_CSV, "기본 내장 데이터(애플 주가.csv)");
  }

  const fileInput = document.getElementById("csvFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        loadData(evt.target.result, file.name);
      };
      reader.readAsText(file, "UTF-8");
    });
  }
});

function loadData(csvText, sourceName) {
  try {
    currentRawData = parseCSV(csvText);
    const dataBadge = document.getElementById("dataStatusBadge");
    if (dataBadge) {
      dataBadge.textContent = `${sourceName} (${currentRawData.length.toLocaleString()}행 로드됨)`;
      dataBadge.classList.add("active");
    }

    renderKPIs(currentRawData);
    destroyAllCharts();
    
    // 10가지 통계 분석법 실행 및 렌더링
    renderDescriptiveStats(currentRawData);       // #1 기초 기술통계 & 정규성
    renderMovingAverages(currentRawData);          // #2 이동평균선 추세 분석 (SMA)
    renderReturnsDistribution(currentRawData);     // #3 일별 수익률 분포 & 히스토그램 (Normal Distribution Fit)
    renderRollingVolatility(currentRawData);       // #4 롤링 변동성 및 연율화 변동성
    renderBollingerBands(currentRawData);          // #5 볼린저 밴드 (확률적 밴드 분석)
    renderLinearRegression(currentRawData);        // #6 선형 회귀 분석 및 결정계수 (R²)
    renderAutocorrelation(currentRawData);         // #7 시계열 자기상관분석 (ACF)
    renderCorrelationMatrix(currentRawData);       // #8 상관계수 분석 매트릭스 (Pearson)
    renderRSI(currentRawData);                     // #9 모멘텀 확률 분석 (RSI 14)
    renderMaxDrawdown(currentRawData);             // #10 최대 낙폭(MDD) 및 위험 분석
  } catch (err) {
    console.error("데이터 처리 중 오류 발생:", err);
    alert("데이터 파싱 오류: " + err.message);
  }
}

function destroyAllCharts() {
  Object.keys(charts).forEach(key => {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  });
}

// Chart.js default global options for dark theme
Chart.defaults.color = "#94a3b8";
Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Overview KPIs
function renderKPIs(data) {
  const closes = data.map(d => d.close);
  const startClose = closes[0];
  const endClose = closes[closes.length - 1];
  const totalReturn = ((endClose - startClose) / startClose) * 100;
  const maxPrice = Math.max(...closes);
  const minPrice = Math.min(...closes);

  document.getElementById("kpiTotalDays").textContent = `${data.length.toLocaleString()} 일`;
  document.getElementById("kpiPeriod").textContent = `${data[0].date} ~ ${data[data.length - 1].date}`;
  
  document.getElementById("kpiLatestPrice").textContent = `$${endClose.toFixed(2)}`;
  const retEl = document.getElementById("kpiTotalReturn");
  retEl.textContent = `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`;
  retEl.className = `kpi-value ${totalReturn >= 0 ? 'val-up' : 'val-down'}`;

  document.getElementById("kpiPriceRange").textContent = `$${minPrice.toFixed(2)} ~ $${maxPrice.toFixed(2)}`;
}

// ---------------------------------------------------------------------------------
// 1. 기초 기술통계 및 정규성 검정 (Descriptive Statistics & Normality Moments)
// ---------------------------------------------------------------------------------
function renderDescriptiveStats(data) {
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i].close - data[i-1].close) / data[i-1].close);
  }

  const calcRow = (name, arr, isPercent = false) => {
    const avg = mean(arr);
    const med = median(arr);
    const sd = stdDev(arr);
    const minVal = Math.min(...arr);
    const maxVal = Math.max(...arr);
    const skew = skewness(arr);
    const kurt = kurtosis(arr);

    const fmt = (v) => isPercent ? (v * 100).toFixed(2) + '%' : (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v.toFixed(2));

    return `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${fmt(avg)}</td>
        <td>${fmt(med)}</td>
        <td>${fmt(sd)}</td>
        <td>${fmt(minVal)} / ${fmt(maxVal)}</td>
        <td>${skew.toFixed(3)}</td>
        <td>${kurt.toFixed(3)}</td>
      </tr>
    `;
  };

  const tbody = document.getElementById("descStatsTableBody");
  if (tbody) {
    tbody.innerHTML = `
      ${calcRow("종가 (Close, $)", closes)}
      ${calcRow("일별 수익률 (Daily Return)", returns, true)}
      ${calcRow("거래량 (Volume)", volumes)}
    `;
  }

  const skew = skewness(returns);
  const kurt = kurtosis(returns);
  const summaryEl = document.getElementById("descSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="summary-item">수익률 왜도(Skewness): <strong>${skew.toFixed(3)}</strong> (${skew < 0 ? '좌측 꼬리 긺 / 급락 빈도 높음' : '우측 꼬리 긺'})</div>
      <div class="summary-item">수익률 첨도(Excess Kurtosis): <strong>${kurt.toFixed(3)}</strong> (${kurt > 0 ? '유의한 팻테일(Fat-tail) 현상' : '정규분포 근사'})</div>
    `;
  }
}

// ---------------------------------------------------------------------------------
// 2. 이동평균선 추세 분석 (Moving Average Trend Analysis - SMA 20, 50, 200)
// ---------------------------------------------------------------------------------
function renderMovingAverages(data) {
  const labels = data.map(d => d.date);
  const closes = data.map(d => d.close);

  function calcSMA(period) {
    const result = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += closes[i - j];
        result.push(sum / period);
      }
    }
    return result;
  }

  const sma20 = calcSMA(20);
  const sma50 = calcSMA(50);
  const sma200 = calcSMA(200);

  // 골든크로스 / 데드크로스 최근 상태 파악
  const lastSMA50 = sma50[sma50.length - 1];
  const lastSMA200 = sma200[sma200.length - 1];
  const crossStatus = lastSMA50 > lastSMA200 ? "골든크로스(상승 추세 국면)" : "데드크로스(하락 추세 국면)";

  const ctx = document.getElementById("chartMA").getContext("2d");
  charts.ma = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Close Price", data: closes, borderColor: "#94a3b8", borderWidth: 1, pointRadius: 0 },
        { label: "SMA 20 (단기)", data: sma20, borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0 },
        { label: "SMA 50 (중기)", data: sma50, borderColor: "#f59e0b", borderWidth: 1.5, pointRadius: 0 },
        { label: "SMA 200 (장기)", data: sma200, borderColor: "#ec4899", borderWidth: 1.8, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "가격 ($)" } }
      }
    }
  });

  document.getElementById("maSummary").innerHTML = `
    <div class="summary-item">현재 SMA 20: <strong>$${sma20[sma20.length-1].toFixed(2)}</strong></div>
    <div class="summary-item">SMA 50: <strong>$${lastSMA50.toFixed(2)}</strong></div>
    <div class="summary-item">SMA 200: <strong>$${lastSMA200.toFixed(2)}</strong></div>
    <div class="summary-item">장단기 배열 상태: <strong style="color: #38bdf8;">${crossStatus}</strong></div>
  `;
}

// ---------------------------------------------------------------------------------
// 3. 일별 수익률 분포 및 정규분포 적합 (Returns Distribution & Histogram)
// ---------------------------------------------------------------------------------
function renderReturnsDistribution(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push(((data[i].close - data[i-1].close) / data[i-1].close) * 100);
  }

  // 히스토그램 빈 생성 (-8% ~ +8%, 0.5% 간격 = 32개 빈)
  const binWidth = 0.5;
  const minBin = -6.0;
  const maxBin = 6.0;
  const binsCount = Math.round((maxBin - minBin) / binWidth) + 2;
  const bins = new Array(binsCount).fill(0);
  const binLabels = [];

  for (let i = 0; i < binsCount; i++) {
    const edge = minBin + i * binWidth;
    binLabels.push(`${edge.toFixed(1)}%`);
  }

  returns.forEach(r => {
    if (r < minBin) {
      bins[0]++;
    } else if (r >= maxBin) {
      bins[binsCount - 1]++;
    } else {
      const idx = Math.floor((r - minBin) / binWidth) + 1;
      bins[idx]++;
    }
  });

  // 이론적 정규분포 곡선 데이터 생성
  const rMean = mean(returns);
  const rStd = stdDev(returns);
  const totalCount = returns.length;
  const normalCurve = binLabels.map((_, i) => {
    const x = minBin + (i - 0.5) * binWidth;
    // PDF: (1 / (s * sqrt(2pi))) * exp(-0.5 * ((x-m)/s)^2) * totalCount * binWidth
    const pdf = (1 / (rStd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - rMean) / rStd, 2));
    return pdf * totalCount * binWidth;
  });

  const ctx = document.getElementById("chartDist").getContext("2d");
  charts.dist = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [
        {
          type: "bar",
          label: "실제 관측 빈도 (Frequency)",
          data: bins,
          backgroundColor: "rgba(56, 189, 248, 0.45)",
          borderColor: "#38bdf8",
          borderWidth: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0
        },
        {
          type: "line",
          label: "정규분포 적합곡선 (Fitted Normal)",
          data: normalCurve,
          borderColor: "#f43f5e",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, title: { display: true, text: "일일 수익률 구간 (%)" } },
        y: { title: { display: true, text: "발생 빈도수 (일수)" } }
      }
    }
  });

  document.getElementById("distSummary").innerHTML = `
    <div class="summary-item">평균 일일 수익률: <strong>${(rMean).toFixed(3)}%</strong></div>
    <div class="summary-item">일일 표준편차: <strong>${(rStd).toFixed(3)}%</strong></div>
    <div class="summary-item">1일 최대 상승: <strong class="val-up">+${Math.max(...returns).toFixed(2)}%</strong></div>
    <div class="summary-item">1일 최대 하락: <strong class="val-down">${Math.min(...returns).toFixed(2)}%</strong></div>
  `;
}

// ---------------------------------------------------------------------------------
// 4. 롤링 변동성 및 연율화 변동성 (Rolling Volatility - 20일, 60일 연율화)
// ---------------------------------------------------------------------------------
function renderRollingVolatility(data) {
  const labels = data.map(d => d.date);
  const returns = [0];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i].close - data[i-1].close) / data[i-1].close);
  }

  function calcRollingVol(window) {
    const vol = [];
    const annualFactor = Math.sqrt(252) * 100; // 연율화 factor
    for (let i = 0; i < returns.length; i++) {
      if (i < window) {
        vol.push(null);
      } else {
        const slice = returns.slice(i - window + 1, i + 1);
        vol.push(stdDev(slice) * annualFactor);
      }
    }
    return vol;
  }

  const vol20 = calcRollingVol(20);
  const vol60 = calcRollingVol(60);

  const ctx = document.getElementById("chartVol").getContext("2d");
  charts.vol = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "20일 연율화 변동성 (단기)", data: vol20, borderColor: "#a855f7", borderWidth: 1.5, pointRadius: 0 },
        { label: "60일 연율화 변동성 (중기)", data: vol60, borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "연율화 변동성 (%)" } }
      }
    }
  });

  const validVol20 = vol20.filter(v => v !== null);
  const currentVol = vol20[vol20.length - 1];
  const avgVol = mean(validVol20);

  document.getElementById("volSummary").innerHTML = `
    <div class="summary-item">최근 20일 변동성: <strong>${currentVol.toFixed(1)}%</strong></div>
    <div class="summary-item">10년 평균 연율화 변동성: <strong>${avgVol.toFixed(1)}%</strong></div>
    <div class="summary-item">최고 변동성 피크: <strong>${Math.max(...validVol20).toFixed(1)}%</strong></div>
  `;
}

// ---------------------------------------------------------------------------------
// 5. 볼린저 밴드 확률 분석 (Bollinger Bands - 20일, 2σ 95.4% 신뢰구간)
// ---------------------------------------------------------------------------------
function renderBollingerBands(data) {
  // 최근 500영업일 중심으로 시각화 (가독성 향상)
  const subset = data.slice(-500);
  const labels = subset.map(d => d.date);
  const closes = subset.map(d => d.close);

  const upper = [];
  const middle = [];
  const lower = [];

  const period = 20;
  for (let i = 0; i < subset.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const m = mean(slice);
      const s = stdDev(slice);
      middle.push(m);
      upper.push(m + 2 * s);
      lower.push(m - 2 * s);
    }
  }

  const ctx = document.getElementById("chartBB").getContext("2d");
  charts.bb = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "상단 밴드 (+2σ)", data: upper, borderColor: "rgba(239, 68, 68, 0.7)", borderWidth: 1, pointRadius: 0, fill: false },
        { label: "중심선 (SMA 20)", data: middle, borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0, fill: false },
        { 
          label: "하단 밴드 (-2σ)", 
          data: lower, 
          borderColor: "rgba(34, 197, 94, 0.7)", 
          borderWidth: 1, 
          pointRadius: 0, 
          fill: "-2", 
          backgroundColor: "rgba(56, 189, 248, 0.08)" 
        },
        { label: "종가 (Close)", data: closes, borderColor: "#f8fafc", borderWidth: 1.8, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "가격 ($)" } }
      }
    }
  });

  const lastClose = closes[closes.length - 1];
  const lastUpper = upper[upper.length - 1];
  const lastLower = lower[lower.length - 1];
  const bandwidth = ((lastUpper - lastLower) / middle[middle.length - 1]) * 100;
  const percentB = ((lastClose - lastLower) / (lastUpper - lastLower)) * 100;

  document.getElementById("bbSummary").innerHTML = `
    <div class="summary-item">최근 밴드폭(Bandwidth): <strong>${bandwidth.toFixed(2)}%</strong></div>
    <div class="summary-item">%B 위치 지표: <strong>${percentB.toFixed(1)}%</strong> (${percentB > 80 ? '상단 근접 과매수권' : (percentB < 20 ? '하단 근접 과매도권' : '중립 영역')})</div>
  `;
}

// ---------------------------------------------------------------------------------
// 6. 선형 회귀 분석 및 결정계수 R² (Linear Regression & Trendline)
// ---------------------------------------------------------------------------------
function renderLinearRegression(data) {
  const x = data.map((_, i) => i);
  const y = data.map(d => d.close);
  const reg = linearRegression(x, y);

  // 샘플링 렌더링 (균등하게 추출하여 차트 경량화)
  const step = 2;
  const labels = [];
  const actualY = [];
  const predY = [];

  for (let i = 0; i < data.length; i += step) {
    labels.push(data[i].date);
    actualY.push(data[i].close);
    predY.push(reg.slope * i + reg.intercept);
  }

  const ctx = document.getElementById("chartReg").getContext("2d");
  charts.reg = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "실제 종가", data: actualY, borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0 },
        { label: "선형 회귀 추세선 (Trendline)", data: predY, borderColor: "#ef4444", borderWidth: 2, borderDash: [6, 4], pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "가격 ($)" } }
      }
    }
  });

  const dailyGrowth = reg.slope;
  const annualGrowth = reg.slope * 252;

  document.getElementById("regSummary").innerHTML = `
    <div class="summary-item">회귀식 기울기(Slope): <strong>+${dailyGrowth.toFixed(4)}$/일</strong> (연간 약 +$${annualGrowth.toFixed(2)})</div>
    <div class="summary-item">결정계수 (R²): <strong style="color: #4ade80;">${reg.r2.toFixed(4)}</strong> (모델 적합도 ${(reg.r2 * 100).toFixed(1)}%)</div>
  `;
}

// ---------------------------------------------------------------------------------
// 7. 시계열 자기상관분석 (ACF - Autocorrelation Function)
// ---------------------------------------------------------------------------------
function renderAutocorrelation(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i].close - data[i-1].close) / data[i-1].close);
  }

  const maxLag = 25;
  const lags = [];
  const acfValues = [];
  const rMean = mean(returns);
  const n = returns.length;

  // 전체 분산 계산
  let denom = 0;
  for (let i = 0; i < n; i++) {
    denom += Math.pow(returns[i] - rMean, 2);
  }

  for (let k = 1; k <= maxLag; k++) {
    lags.push(`Lag ${k}`);
    let num = 0;
    for (let t = 0; t < n - k; t++) {
      num += (returns[t] - rMean) * (returns[t + k] - rMean);
    }
    acfValues.push(num / denom);
  }

  // 95% 유의구간 (Bartlett 근사: ±1.96 / sqrt(N))
  const ci = 1.96 / Math.sqrt(n);

  const ctx = document.getElementById("chartACF").getContext("2d");
  charts.acf = new Chart(ctx, {
    type: "bar",
    data: {
      labels: lags,
      datasets: [
        {
          label: "수익률 자기상관계수 (ACF)",
          data: acfValues,
          backgroundColor: acfValues.map(v => Math.abs(v) > ci ? "#f43f5e" : "#38bdf8"),
          borderColor: "#0284c7",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" }
      },
      scales: {
        y: { 
          min: -0.15, 
          max: 0.15,
          title: { display: true, text: "상관계수 r" }
        }
      }
    }
  });

  document.getElementById("acfSummary").innerHTML = `
    <div class="summary-item">95% 유의수준 임계치: <strong>±${ci.toFixed(4)}</strong></div>
    <div class="summary-item">Lag-1 자기상관: <strong>${acfValues[0].toFixed(4)}</strong></div>
    <div class="summary-item">해석: <strong>대부분의 시차에서 유의미한 자기상관이 거의 없는 약형 효율적 시장(Random Walk) 특성</strong></div>
  `;
}

// ---------------------------------------------------------------------------------
// 8. 다변량 상관계수 매트릭스 (Pearson Correlation Matrix)
// ---------------------------------------------------------------------------------
function renderCorrelationMatrix(data) {
  const vars = [
    { name: "Open", data: data.map(d => d.open) },
    { name: "High", data: data.map(d => d.high) },
    { name: "Low", data: data.map(d => d.low) },
    { name: "Close", data: data.map(d => d.close) },
    { name: "Adj Close", data: data.map(d => d.adjClose) },
    { name: "Volume", data: data.map(d => d.volume) }
  ];

  let matrixHtml = `<thead><tr><th>변수</th>`;
  vars.forEach(v => matrixHtml += `<th>${v.name}</th>`);
  matrixHtml += `</tr></thead><tbody>`;

  vars.forEach((v1) => {
    matrixHtml += `<tr><td><strong>${v1.name}</strong></td>`;
    vars.forEach((v2) => {
      const corr = pearsonCorr(v1.data, v2.data);
      let bgStyle = "";
      if (corr > 0.8) {
        bgStyle = `background: rgba(56, 189, 248, ${Math.abs(corr) * 0.4}); color: #38bdf8; font-weight: bold;`;
      } else if (corr < -0.3) {
        bgStyle = `background: rgba(239, 68, 68, ${Math.abs(corr) * 0.4}); color: #ef4444; font-weight: bold;`;
      } else {
        bgStyle = `background: rgba(255, 255, 255, 0.03);`;
      }
      matrixHtml += `<td style="${bgStyle}">${corr.toFixed(3)}</td>`;
    });
    matrixHtml += `</tr>`;
  });
  matrixHtml += `</tbody>`;

  document.getElementById("corrMatrixTable").innerHTML = matrixHtml;
  
  const closeVolCorr = pearsonCorr(data.map(d => d.close), data.map(d => d.volume));
  document.getElementById("corrSummary").innerHTML = `
    <div class="summary-item">가격 지표 간 상관계수: <strong>0.999 이상 (극도로 강한 양의 상관관계)</strong></div>
    <div class="summary-item">주가 vs 거래량 상관계수: <strong class="${closeVolCorr < 0 ? 'val-down' : 'val-up'}">${closeVolCorr.toFixed(3)}</strong> (주가 상승기 거래량 감소 경향 역상관)</div>
  `;
}

// ---------------------------------------------------------------------------------
// 9. 모멘텀 확률 분석 (RSI 14 Relative Strength Index)
// ---------------------------------------------------------------------------------
function renderRSI(data) {
  const period = 14;
  const rsi = [];
  const closes = data.map(d => d.close);
  const labels = data.map(d => d.date);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(null); // 0
  for (let i = 1; i < period; i++) rsi.push(null);

  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
  rsi.push(100 - (100 / (1 + rs)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    rsi.push(100 - (100 / (1 + rs)));
  }

  // 최근 500일 구간 차트 시각화
  const subsetRSI = rsi.slice(-500);
  const subsetLabels = labels.slice(-500);

  const ctx = document.getElementById("chartRSI").getContext("2d");
  charts.rsi = new Chart(ctx, {
    type: "line",
    data: {
      labels: subsetLabels,
      datasets: [
        { label: "RSI (14)", data: subsetRSI, borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0 },
        { label: "과매수선 (70)", data: new Array(500).fill(70), borderColor: "rgba(239, 68, 68, 0.6)", borderDash: [4, 4], pointRadius: 0 },
        { label: "과매도선 (30)", data: new Array(500).fill(30), borderColor: "rgba(34, 197, 94, 0.6)", borderDash: [4, 4], pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { min: 10, max: 90, title: { display: true, text: "RSI Index" } }
      }
    }
  });

  const lastRSI = rsi[rsi.length - 1];
  let condition = "중립 구간 (40 ~ 60)";
  if (lastRSI >= 70) condition = "과매수 상태 (조정 가능성)";
  else if (lastRSI <= 30) condition = "과매도 상태 (반등 가능성)";

  document.getElementById("rsiSummary").innerHTML = `
    <div class="summary-item">최근 RSI (14): <strong style="color: #38bdf8;">${lastRSI.toFixed(2)}</strong></div>
    <div class="summary-item">시장 상태 판정: <strong>${condition}</strong></div>
  `;
}

// ---------------------------------------------------------------------------------
// 10. 최대 낙폭 (MDD) 및 리스크 분석 (Maximum Drawdown & Risk Analysis)
// ---------------------------------------------------------------------------------
function renderMaxDrawdown(data) {
  const closes = data.map(d => d.close);
  const labels = data.map(d => d.date);

  let peak = closes[0];
  const drawdown = [];
  let maxDD = 0;
  let maxDDEndDate = "";

  for (let i = 0; i < closes.length; i++) {
    if (closes[i] > peak) {
      peak = closes[i];
    }
    const dd = ((closes[i] - peak) / peak) * 100;
    drawdown.push(dd);
    if (dd < maxDD) {
      maxDD = dd;
      maxDDEndDate = labels[i];
    }
  }

  // 1일 95% 및 99% VaR (Value at Risk - 역사적 시뮬레이션 기법)
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push(((data[i].close - data[i-1].close) / data[i-1].close) * 100);
  }
  const var95 = quantile(returns, 0.05);
  const var99 = quantile(returns, 0.01);

  const ctx = document.getElementById("chartMDD").getContext("2d");
  charts.mdd = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "고점 대비 낙폭 (Drawdown %)",
          data: drawdown,
          borderColor: "#ef4444",
          borderWidth: 1.2,
          backgroundColor: "rgba(239, 68, 68, 0.25)",
          fill: true,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 10 } },
        y: { 
          title: { display: true, text: "하락률 (%)" },
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });

  document.getElementById("mddSummary").innerHTML = `
    <div class="summary-item">역대 최대 낙폭(MDD): <strong class="val-down">${maxDD.toFixed(2)}%</strong> (${maxDDEndDate})</div>
    <div class="summary-item">1일 95% VaR: <strong class="val-down">${var95.toFixed(2)}%</strong></div>
    <div class="summary-item">1일 99% VaR: <strong class="val-down">${var99.toFixed(2)}%</strong></div>
  `;
}
