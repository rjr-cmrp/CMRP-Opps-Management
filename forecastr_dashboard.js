// --- API Configuration ---
function getApiUrl(endpoint) {
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || '';
    return `${baseUrl}${endpoint}`;
}

// --- Global Variables ---
let forecastDataCache = null;
let projectDetailsCache = [];
let currentSort = { key: 'name', dir: 1 };
let forecastChartInstance = null;
let currentOpStatusFilter = 'all';
let showQuarters = { Q1: true, Q2: true, Q3: true, Q4: true };

function isQuarterLabel(label) {
  if (!label) return null;
  const match = String(label).toUpperCase().match(/(?:^|\W)(Q[1-4])(?:$|\W)/);
  return match ? match[1] : null;
}
function getQuarterFromMonthLabel(label) {
  if (!label) return null;
  let month = label.split(' ')[0].toLowerCase();
  const monthMap = {
    jan: 'january', feb: 'february', mar: 'march',
    apr: 'april', may: 'may', jun: 'june',
    jul: 'july', aug: 'august', sep: 'september',
    oct: 'october', nov: 'november', dec: 'december'
  };
  if (month.length === 3 && monthMap[month]) month = monthMap[month];
  if (["january","february","march"].includes(month)) return "Q1";
  if (["april","may","june"].includes(month)) return "Q2";
  if (["july","august","september"].includes(month)) return "Q3";
  if (["october","november","december"].includes(month)) return "Q4";
  return null;
}
function filterOutQuarters(labels, counts, amounts) {
  const filtered = labels.map((label, i) => {
    const q = getQuarterFromMonthLabel(label);
    return { label, count: counts[i], amount: amounts[i], q };
  }).filter(item => !item.q || showQuarters[item.q]);
  return {
    labels: filtered.map(f => f.label),
    counts: filtered.map(f => f.count),
    amounts: filtered.map(f => f.amount)
  };
}
function updateQuarterButtonStates() {
  ['Q1','Q2','Q3','Q4'].forEach(q => {
    const btn = document.getElementById(`toggle${q}Btn`);
    if (btn) btn.style.opacity = showQuarters[q] ? '1' : '0.5';
  });
}
function addQuarterFilterButtons() {
  const container = document.querySelector('.main-container');
  if (!container) return;
  let btnGroup = document.getElementById('quarterBtnGroup');
  if (!btnGroup) {
    btnGroup = document.createElement('div');
    btnGroup.id = 'quarterBtnGroup';
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';
    btnGroup.style.marginBottom = '12px';
    ['Q1','Q2','Q3','Q4'].forEach(q => {
      const btn = document.createElement('button');
      btn.id = `toggle${q}Btn`;
      btn.className = 'filter-button px-3 py-1 rounded text-xs';
      btn.textContent = q;
      btn.style.fontWeight = 'bold';
      btn.style.opacity = showQuarters[q] ? '1' : '0.5';
      btn.onclick = function() {
        showQuarters[q] = !showQuarters[q];
        updateQuarterButtonStates();
        fetchForecastData(currentOpStatusFilter).then(data => {
          if (data) renderForecastDashboard(data, currentOpStatusFilter);
        });
        fetchForecastWeekSummary().then(data => {
          if (data && typeof renderForecastWeeklyChart === 'function') {
            renderForecastWeeklyChart(data.weekSummary);
          }
        });
      };
      btnGroup.appendChild(btn);
    });
    const firstChart = document.querySelector('.chart-section-container');
    if (firstChart) firstChart.parentNode.insertBefore(btnGroup, firstChart);
    else container.prepend(btnGroup);
  } else {
    updateQuarterButtonStates();
  }
}
async function fetchForecastData(statusFilter = 'all') {
    let apiUrl = '/api/forecast-dashboard';
    if (statusFilter !== 'all') {
        apiUrl += `?status=${encodeURIComponent(statusFilter)}`;
    }
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (!data.forecastMonthlySummary) data.forecastMonthlySummary = [];
        return data;
    } catch (error) {
        console.error(`Failed to fetch forecast data for ${statusFilter}:`, error);
        return null;
    }
}
async function fetchForecastWeekSummary() {
    try {
        const res = await fetch('/api/forecast-dashboard-weeks');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error("Failed to fetch forecast week summary:", error);
        return null;
    }
}
function formatCurrency(num) {
    const number = Number(num);
    if (isNaN(number)) return '₱0.00';
    return '₱' + number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function abbreviateMonthLabel(label) {
  if (!label) return label;
  const monthMap = {
    'January': 'Jan', 'February': 'Feb', 'March': 'Mar',
    'April': 'Apr', 'May': 'May', 'June': 'Jun',
    'July': 'Jul', 'August': 'Aug', 'September': 'Sep',
    'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
  };
  const parts = label.split(' ');
  return monthMap[parts[0]] || parts[0];
}
function renderForecastDashboard(data, statusFilter = 'all') {
    if (!data) {
         const tableBody = document.getElementById('forecastBreakdownTableBody');
         if(tableBody) { tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Could not load forecast data.</td></tr>'; }
         ['forecast-total-count', 'forecast-total-amount', 'forecast-next-month-count', 'forecast-next-month-amount'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = 'Error'; });
         return;
    }
    const filterText = statusFilter === 'all' ? 'All' : statusFilter;
    const chartTitleEl = document.getElementById('chart-title');
    const tableTitleEl = document.getElementById('table-title');
    if(chartTitleEl) chartTitleEl.textContent = `Monthly Forecast (Amount vs Count) - ${filterText}`;
    if(tableTitleEl) tableTitleEl.textContent = `Monthly Forecast Breakdown - ${filterText}`;
    const totalCountEl = document.getElementById('forecast-total-count');
    const totalAmountEl = document.getElementById('forecast-total-amount');
    const nextMonthCountEl = document.getElementById('forecast-next-month-count');
    const nextMonthAmountEl = document.getElementById('forecast-next-month-amount');
    const totalForecastCount = data?.totalForecastCount ?? 0;
    const totalForecastAmount = data?.totalForecastAmount ?? 0;
    const nextMonthForecastCount = data?.nextMonthForecastCount ?? 0;
    const nextMonthForecastAmount = data?.nextMonthForecastAmount ?? 0;
    if(totalCountEl) totalCountEl.textContent = totalForecastCount;
    if(totalAmountEl) totalAmountEl.textContent = formatCurrency(totalForecastAmount);
    if(nextMonthCountEl) nextMonthCountEl.textContent = nextMonthForecastCount;
    if(nextMonthAmountEl) nextMonthAmountEl.textContent = formatCurrency(nextMonthForecastAmount);
    let monthlySummary = data.forecastMonthlySummary || [];
    let labels = monthlySummary.map(m => abbreviateMonthLabel(m.monthYear || 'Unknown'));
    let counts = monthlySummary.map(m => m.count || 0);
    let amounts = monthlySummary.map(m => m.totalAmount || 0);
    const filtered = filterOutQuarters(labels, counts, amounts);
    labels = filtered.labels;
    counts = filtered.counts;
    amounts = filtered.amounts;
    const maxAmount = Math.max(...amounts, 0);
    const yAxisMax = Math.ceil(maxAmount / 1_000_000) * 1_000_000 || 1_000_000;
    const forecastChartCanvas = document.getElementById('forecastMonthlyChart');
    const forecastMonthlyLegend = document.getElementById('forecastMonthlyLegend');
    if (forecastMonthlyLegend) {
        const forecastColor = getComputedStyle(document.documentElement).getPropertyValue('--color-forecast').trim();
        const forecastBgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-forecast-bg').trim();
        forecastMonthlyLegend.innerHTML = `
          <span style="display:inline-block;margin:0 16px;"><span style="display:inline-block;width:18px;height:12px;background:${forecastBgColor};border:1px solid ${forecastColor};margin-right:6px;vertical-align:middle;"></span>Forecast Amount</span>
          <span style="display:inline-block;margin:0 16px;"><span style="display:inline-block;width:18px;height:3px;background:#6b7280;margin-right:6px;vertical-align:middle;"></span>Forecast Count</span>
        `;
    }
    if (forecastChartCanvas) {
        const rootStyle = getComputedStyle(document.documentElement);
        const gridColor = rootStyle.getPropertyValue('--chart-grid-color').trim() || '#e5e7eb';
        const tickColor = rootStyle.getPropertyValue('--chart-tick-color').trim() || '#6b7280';
        const titleColor = rootStyle.getPropertyValue('--chart-title-color').trim() || '#111827';
        const legendColor = rootStyle.getPropertyValue('--chart-legend-color').trim() || '#374151';
        const tooltipBgColor = rootStyle.getPropertyValue('--chart-tooltip-bg').trim() || '#ffffff';
        const tooltipTextColor = rootStyle.getPropertyValue('--chart-tooltip-text').trim() || '#111827';
        const forecastColor = rootStyle.getPropertyValue('--color-forecast').trim() || '#8b5cf6';
        const forecastBgColor = rootStyle.getPropertyValue('--color-forecast-bg').trim() || 'rgba(139, 92, 246, 0.7)';
        const forecastDarkColor = rootStyle.getPropertyValue('--color-forecast-dark').trim() || '#7c3aed';
        const countLineColor = tickColor;

        const chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Forecast Amount',
                        data: amounts,
                        backgroundColor: forecastBgColor,
                        borderColor: forecastColor,
                        borderWidth: 1,
                        yAxisID: 'yAmount',
                        type: 'bar',
                        order: 2,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Forecast Count',
                        data: counts,
                        borderColor: '#6b7280',
                        backgroundColor: 'rgba(59,130,246,0.15)',
                        borderWidth: 2,
                        fill: true,
                        yAxisID: 'yCount',
                        type: 'line',
                        order: 1,
                        tension: 0.1,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#6b7280',
                        pointBorderColor: '#6b7280'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400, easing: 'easeOutQuart' },
                layout: { padding: { bottom: 20 } },
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                hover: { mode: 'index', intersect: false, animationDuration: 400 },
                plugins: {
                    legend: {
                        display: false,
                        labels: { color: legendColor }
                    },
                    title: {
                        display: false,
                        color: titleColor
                    },
                    tooltip: {
                        enabled: true,
                        animation: { duration: 400 },
                        backgroundColor: tooltipBgColor,
                        titleColor: tooltipTextColor,
                        bodyColor: tooltipTextColor,
                        borderColor: '#8b5cf6',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.dataset.label === 'Forecast Amount') {
                                    label += formatCurrency(context.parsed.y);
                                } else {
                                    label += context.parsed.y;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: tickColor,
                            maxRotation: 0,
                            minRotation: 0,
                            font: {
                                size: 14
                            }
                        },
                        grid: { color: gridColor }
                    },
                    yAmount: {
                        position: 'left',
                        beginAtZero: true,
                        max: yAxisMax,
                        ticks: {
                            color: forecastColor,
                            callback: function(value) {
                                if (value >= 1e6) return '₱' + (value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1) + 'M';
                                if (value >= 1e3) return '₱' + (value / 1e3).toFixed(value % 1e3 === 0 ? 0 : 1) + 'k';
                                return '₱' + value;
                            }
                        },
                        grid: { color: gridColor }
                    },
                    yCount: {
                        position: 'right',
                        beginAtZero: true,
                        ticks: {
                            color: tickColor,
                            stepSize: 1,
                            precision: 0
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: gridColor
                        }
                    }
                }
            }
        };
        if (forecastChartInstance) forecastChartInstance.destroy();
        forecastChartInstance = new Chart(forecastChartCanvas.getContext('2d'), chartConfig);

        // Store yCount scale config from monthly chart for weekly chart to use
        if (forecastChartInstance && forecastChartInstance.scales && forecastChartInstance.scales.yCount) {
            const yCountScale = forecastChartInstance.scales.yCount;
            window.monthlyYCountConfig = {
                ticks: yCountScale.ticks.map(tick => tick.value),
                min: yCountScale.min,
                max: yCountScale.max,
                titleText: 'Count',
                titleColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-title-color').trim(),
                titleFont: '12px sans-serif'
            };
            if (yCountScale.options.title && yCountScale.options.title.display) {
                window.monthlyYCountConfig.titleText = yCountScale.options.title.text || 'Count';
                window.monthlyYCountConfig.titleColor = yCountScale.options.title.color || getComputedStyle(document.documentElement).getPropertyValue('--chart-title-color').trim();
                if (yCountScale.options.title.font) {
                    window.monthlyYCountConfig.titleFont = `${yCountScale.options.title.font.size || 12}px ${yCountScale.options.title.font.family || 'sans-serif'}`;
                }
            }
            // If weekly chart data is already loaded, re-render it with new Y-axis config
            if (window.lastWeekSummaryArr && typeof renderForecastWeeklyChart === 'function') {
                renderForecastWeeklyChart(window.lastWeekSummaryArr);
            }
        }
    }
    const tableBody = document.getElementById('forecastBreakdownTableBody');
    if(tableBody) {
        tableBody.innerHTML = '';
        if (monthlySummary.length > 0) {
            monthlySummary.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.monthYear || 'Unknown'}</td>
                    <td class="text-right">${item.count || 0}</td>
                    <td class="text-right">${formatCurrency(item.totalAmount || 0)}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = `No monthly forecast data available for ${filterText}.`;
            cell.className = 'text-center py-4';
            row.appendChild(cell);
            tableBody.appendChild(row);
        }
    }
    projectDetailsCache = (data.projectDetails || []).map(p => ({ ...p }));
    renderProjectForecastTable(projectDetailsCache);
    setupEditForecastDateHandlers();
}
function renderProjectForecastTable(projects) {
    const projectTableBody = document.getElementById('projectForecastTableBody');
    if (!projectTableBody) return;
    projectTableBody.innerHTML = '';
    if (!projects || projects.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'No project forecast details available.';
        cell.className = 'text-center py-4';
        row.appendChild(cell);
        projectTableBody.appendChild(row);
        return;
    }
    const sortedProjects = [...projects].sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];
        let comparison = 0;
        if (currentSort.key === 'amount') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
            comparison = valA - valB;
        } else if (currentSort.key === 'forecastWeek') {
            valA = parseInt(String(valA ?? '0').replace('W', ''), 10) || 0;
            valB = parseInt(String(valB ?? '0').replace('W', ''), 10) || 0;
            comparison = valA - valB;
        } else if (currentSort.key === 'forecastMonth') {
            const dateA = new Date(valA + " 1");
            const dateB = new Date(valB + " 1");
            if (!isNaN(dateA) && !isNaN(dateB)) {
                comparison = dateA - dateB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
        } else {
            const strA = String(valA ?? '').toLowerCase();
            const strB = String(valB ?? '').toLowerCase();
            if (strA < strB) comparison = -1;
            else if (strA > strB) comparison = 1;
            else comparison = 0;
        }
        return comparison * currentSort.dir;
    });
    sortedProjects.forEach(project => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${project.name || ''}</td>
            <td class="text-right">${formatCurrency(project.amount || 0)}</td>
            <td class="text-right">${project.forecastMonth || ''}</td>
            <td class="text-center">${project.forecastWeek ? (typeof project.forecastWeek === 'number' ? `W${project.forecastWeek}`: project.forecastWeek) : ''}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-primary edit-forecast-date-btn" data-project-uid="${project.uid || ''}" data-project-name="${project.name || ''}" data-forecast-date="${project.forecast_date || ''}">
                    Edit Date
                </button>
            </td>
        `;
        projectTableBody.appendChild(row);
    });
}
function setupProjectTableSorters() {
    const projectTable = document.getElementById('projectForecastTable');
    if (!projectTable) return;
    const headerRow = projectTable.querySelector('thead tr');
    if (!headerRow) return;
    const oldHeaders = Array.from(headerRow.querySelectorAll('th.sortable-header'));
    oldHeaders.forEach((header, idx) => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
    });
    const headers = projectTable.querySelectorAll('th.sortable-header');
    headers.forEach(header => {
        const sortKey = header.dataset.sortKey;
        if (!sortKey) return;
        header.addEventListener('click', () => {
            if (currentSort.key === sortKey) {
                currentSort.dir *= -1;
            } else {
                currentSort.key = sortKey;
                currentSort.dir = 1;
            }
            headers.forEach(h => {
                const indicator = h.querySelector('.sort-indicator');
                if (indicator) indicator.textContent = '';
            });
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) indicator.textContent = currentSort.dir === 1 ? ' ▲' : ' ▼';
            renderProjectForecastTable(projectDetailsCache);
        });
    });
    const initialSortHeader = projectTable.querySelector(`th[data-sort-key="${currentSort.key}"]`);
    if (initialSortHeader) {
        const initialIndicator = initialSortHeader.querySelector('.sort-indicator');
        if (initialIndicator) {
            initialIndicator.textContent = currentSort.dir === 1 ? ' ▲' : ' ▼';
        }
    }
}
// --- THEME TOGGLE ---
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        const isDark = document.documentElement.classList.toggle('dark');
        const logo = document.getElementById('cmrpLogo');
        if (logo) {
            logo.src = isDark ? 'Logo/CMRP Logo Light.svg' : 'Logo/CMRP Logo Dark.svg';
        }
        fetchForecastData(currentOpStatusFilter).then(data => {
            if (data) renderForecastDashboard(data, currentOpStatusFilter);
        });
    });
}

// --- OP STATUS FILTER BUTTONS ---
function setupOpStatusFilterButtons() {
    const btns = document.querySelectorAll('.op-status-filter-btn');
    // Remove all event listeners by replacing each button with a clone
    btns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    // Query again after replacement
    const updatedBtns = document.querySelectorAll('.op-status-filter-btn');
    updatedBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            updatedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const status = btn.dataset.filterValue || 'all'; // Changed from btn.dataset.status
            currentOpStatusFilter = status;
            fetchForecastData(currentOpStatusFilter).then(data => {
                if (data) renderForecastDashboard(data, currentOpStatusFilter);
            });
            fetchForecastWeekSummary().then(data => {
                if (data && typeof renderForecastWeeklyChart === 'function') {
                    renderForecastWeeklyChart(data.weekSummary);
                }
            });
        });
    });
    // Set the correct button as active on load
    let foundActive = false;
    updatedBtns.forEach(btn => {
        if ((btn.dataset.filterValue || 'all') === currentOpStatusFilter) { // Changed from btn.dataset.status
            btn.classList.add('active');
            foundActive = true;
        } else {
            btn.classList.remove('active');
        }
    });
    if (!foundActive && updatedBtns.length > 0) {
        updatedBtns[0].classList.add('active'); // Default to 'All' if no specific filter is active
        currentOpStatusFilter = updatedBtns[0].dataset.filterValue || 'all'; // Ensure currentOpStatusFilter is also updated
    }
}

// --- CHART/DETAILS TOGGLE BUTTONS ---
function setupChartTableToggles() {
    // Chart Toggles
    const showMonthlyBtn = document.getElementById('showMonthlyBtn');
    const showWeeklyBtn = document.getElementById('showWeeklyBtn');
    const monthlyChartSection = document.getElementById('monthlyChartSection');
    const weeklyChartSection = document.getElementById('weeklyChartSection');

    if (showMonthlyBtn && showWeeklyBtn && monthlyChartSection && weeklyChartSection) {
        showWeeklyBtn.addEventListener('click', function() {
            weeklyChartSection.style.display = '';
            monthlyChartSection.style.display = 'none';
            showWeeklyBtn.classList.add('active');
            showMonthlyBtn.classList.remove('active');
            // Ensure correct chart is rendered if it was not already loaded
            if (typeof renderForecastWeeklyChart === 'function' && (!window.lastWeekSummaryArr || window.lastWeekSummaryArr.length === 0)) {
                 fetchForecastWeekSummary().then(data => {
                    if (data && data.weekSummary) renderForecastWeeklyChart(data.weekSummary);
                });
            }
        });

        showMonthlyBtn.addEventListener('click', function() {
            monthlyChartSection.style.display = '';
            weeklyChartSection.style.display = 'none';
            showMonthlyBtn.classList.add('active');
            showWeeklyBtn.classList.remove('active');
        });
    }

    // Table Toggles
    const showMonthlyBreakdownBtn = document.getElementById('showMonthlyBreakdownBtn');
    const showProjectDetailsBtn = document.getElementById('showProjectDetailsBtn');
    const monthlyBreakdownTableContainer = document.getElementById('monthlyBreakdownTableContainer');
    const projectDetailsTableContainer = document.getElementById('projectDetailsTableContainer');

    if (showMonthlyBreakdownBtn && showProjectDetailsBtn && monthlyBreakdownTableContainer && projectDetailsTableContainer) {
        showProjectDetailsBtn.addEventListener('click', function() {
            projectDetailsTableContainer.style.display = '';
            monthlyBreakdownTableContainer.style.display = 'none';
            showProjectDetailsBtn.classList.add('active');
            showMonthlyBreakdownBtn.classList.remove('active');
        });

        showMonthlyBreakdownBtn.addEventListener('click', function() {
            monthlyBreakdownTableContainer.style.display = '';
            projectDetailsTableContainer.style.display = 'none';
            showMonthlyBreakdownBtn.classList.add('active');
            showProjectDetailsBtn.classList.remove('active');
        });
    }
}

// Hide User Management nav button for non-admins
function updateUserMgmtNavVisibility() {
    const userMgmtBtn = document.getElementById('userMgmtNavBtn');
    if (!userMgmtBtn) return;
    const token = localStorage.getItem('authToken');
    if (!token) {
        userMgmtBtn.style.display = 'none';
        return;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const accountType = payload.accountType || payload.account_type || null;
        userMgmtBtn.style.display = (accountType === 'Admin') ? '' : 'none';
    } catch {
        userMgmtBtn.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', updateUserMgmtNavVisibility);
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        updateUserMgmtNavVisibility();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    if (initialTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    const logo = document.getElementById('cmrpLogo');
    if (logo) {
        logo.src = (initialTheme === 'dark') ? 'Logo/CMRP Logo Light.svg' : 'Logo/CMRP Logo Dark.svg';
    }
    addQuarterFilterButtons();
    setupProjectTableSorters();
    setupOpStatusFilterButtons(); // Ensure this is called after DOM is ready and after any dynamic rendering
    setupChartTableToggles();
    fetchForecastData(currentOpStatusFilter).then(data => {
        if (data) renderForecastDashboard(data, currentOpStatusFilter);
        // Fetch weekly summary after monthly dashboard is processed
        fetchForecastWeekSummary().then(weekData => {
            if (weekData && weekData.weekSummary && typeof renderForecastWeeklyChart === 'function') {
                renderForecastWeeklyChart(weekData.weekSummary);
            }
        });
    });
});
// --- Weekly Chart Logic ---
function renderForecastWeeklyChart(weekSummaryArr) {
  if (!window.monthlyYCountConfig) {
    window.lastWeekSummaryArr = weekSummaryArr; // Store data for later if config not ready
    return;
  }
  window.lastWeekSummaryArr = weekSummaryArr;
  const yAxisLeftCanvas = document.getElementById('forecastWeeklyYAxisLeft');
  const yAxisLeftCtx = yAxisLeftCanvas.getContext('2d');
  const yAxisRightCanvas = document.getElementById('forecastWeeklyYAxisRight');
  const yAxisRightCtx = yAxisRightCanvas.getContext('2d');
  const chartCanvas = document.getElementById('forecastWeeklyChart');
  const ctx = chartCanvas.getContext('2d');
  if (!weekSummaryArr || weekSummaryArr.length === 0) {
    yAxisLeftCtx.clearRect(0, 0, yAxisLeftCanvas.width / (window.devicePixelRatio || 1), yAxisLeftCanvas.height / (window.devicePixelRatio || 1));
    yAxisRightCtx.clearRect(0, 0, yAxisRightCanvas.width / (window.devicePixelRatio || 1), yAxisRightCanvas.height / (window.devicePixelRatio || 1));
    ctx.clearRect(0, 0, chartCanvas.width / (window.devicePixelRatio || 1), chartCanvas.height / (window.devicePixelRatio || 1));
    ctx.save();
    ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#dc2626';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No weekly forecast data available.', (chartCanvas.width / (window.devicePixelRatio || 1)) / 2, (chartCanvas.height / (window.devicePixelRatio || 1)) / 2);
    ctx.restore();
    return;
  }
  let labels = weekSummaryArr.map(w => shortMonthWeekLabel(w.monthWeek));
  let counts = weekSummaryArr.map(w => w.count);
  let amounts = weekSummaryArr.map(w => w.totalAmount);
  // Filter out quarters if needed
  const filtered = filterOutQuarters(labels, counts, amounts);
  labels = filtered.labels;
  counts = filtered.counts;
  amounts = filtered.amounts;
  const weekCount = labels.length;
  const pxPerWeek = 80;
  const visibleWeeks = 12;
  
  // Get device pixel ratio for crisp rendering on high DPI displays
  const dpr = window.devicePixelRatio || 1;
  
  // Set canvas dimensions with device pixel ratio scaling
  chartCanvas.width = (weekCount * pxPerWeek) * dpr;
  chartCanvas.height = 400 * dpr;
  chartCanvas.style.width = (weekCount * pxPerWeek) + 'px';
  chartCanvas.style.height = '400px';
  
  yAxisLeftCanvas.width = 80 * dpr;
  yAxisLeftCanvas.height = 400 * dpr;
  yAxisLeftCanvas.style.width = '80px';
  yAxisLeftCanvas.style.height = '400px';
  
  yAxisRightCanvas.width = 80 * dpr;
  yAxisRightCanvas.height = 400 * dpr;
  yAxisRightCanvas.style.width = '80px';
  yAxisRightCanvas.style.height = '400px';
  
  // Scale the drawing context to match device pixel ratio
  yAxisLeftCtx.scale(dpr, dpr);
  yAxisRightCtx.scale(dpr, dpr);
  ctx.scale(dpr, dpr);
  const chartWrapper = chartCanvas.parentElement;
  if (chartWrapper) {
    chartWrapper.style.width = (weekCount * pxPerWeek) + 'px';
    chartWrapper.style.maxWidth = '100%';
    chartWrapper.style.overflowX = 'auto';
    chartWrapper.style.overflowY = 'hidden';
    chartWrapper.style.minWidth = (visibleWeeks * pxPerWeek) + 'px';
    chartWrapper.style.height = '400px';
    chartWrapper.style.maxHeight = '400px';
  }
  // --- Chart.js chart (hide y-axes) ---
  let yAmountMax = Math.ceil(Math.max(...amounts, 0) / 1_000_000) * 1_000_000;
  if (yAmountMax === 0 && amounts.some(a => a > 0)) yAmountMax = 1_000_000;
  else if (yAmountMax === 0) yAmountMax = 1_000_000;

  let yAmountStep = 1_000_000; // Default step for amount
  // Adjust yAmountStep based on yAmountMax if needed, e.g., yAmountStep = yAmountMax / 5;

  let yCountMax = window.monthlyYCountConfig.max;
  let yCountStep = 1;
  const monthlyTicks = window.monthlyYCountConfig.ticks;
  if (monthlyTicks && monthlyTicks.length > 1) {
    yCountStep = monthlyTicks[1] - monthlyTicks[0]; 
  } else if (monthlyTicks && monthlyTicks.length === 1 && monthlyTicks[0] > 0) {
    yCountStep = monthlyTicks[0];
  } else {
    yCountStep = 1;
  }
  yCountStep = Math.max(1, yCountStep); // Ensure step is at least 1

  const maxWeeklyCount = Math.max(...counts, 0);
  if (maxWeeklyCount > yCountMax) {
      yCountMax = Math.ceil(maxWeeklyCount / yCountStep) * yCountStep;
  }
  if (yCountMax === 0 && maxWeeklyCount > 0) {
      yCountMax = Math.ceil(maxWeeklyCount / yCountStep) * yCountStep;
      if (yCountMax === 0) yCountMax = yCountStep; // Ensure max is at least one step if there are counts
  }
  if (yCountMax === 0 && counts.every(c => c === 0) && window.monthlyYCountConfig.max > 0){
      // If all weekly counts are 0, but monthly chart had a scale, respect it.
      yCountMax = window.monthlyYCountConfig.max;
  } else if (yCountMax === 0 && maxWeeklyCount === 0) {
      yCountMax = yCountStep; // Default to one step if all counts are zero
  }


  // Register a Chart.js plugin specifically for custom font rendering
  Chart.register({
    id: 'customXAxisLabels',
    afterDraw: function(chart) {
      if (chart.canvas.id === 'forecastWeeklyChart') {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        
        if (xScale && labels && labels.length > 0) {
          ctx.save();
          ctx.font = 'normal 16px system-ui, -apple-system, "Segoe UI", sans-serif';
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--chart-tick-color').trim() || '#6b7280';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          
          // Draw custom labels
          labels.forEach((label, index) => {
            const x = xScale.getPixelForTick(index);
            const y = chart.chartArea.bottom + 12; // Position below chart
            
            // Draw the label with our custom font
            ctx.fillText(label, x, y);
          });
          
          ctx.restore();
          console.log('Custom x-axis labels drawn with 16px font');
        }
      }
    }
  });

  // Set Chart.js global font defaults before creating chart
  if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.font = Chart.defaults.font || {};
    Chart.defaults.font.size = 16;
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    Chart.defaults.font.weight = 'bold';
  }

  if (window.forecastWeeklyChartInstance) window.forecastWeeklyChartInstance.destroy();
  window.forecastWeeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Forecast Amount',
          data: amounts,
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-forecast-bg').trim(),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-forecast').trim(),
          borderWidth: 1,
          yAxisID: 'yAmount',
          type: 'bar',
          order: 2,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          label: 'Forecast Count',
          data: counts,
          borderColor: '#6b7280',
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          yAxisID: 'yCount',
          type: 'line',
          order: 1,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { bottom: 40 } },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      hover: { mode: 'index', intersect: false, animationDuration: 400 },
      animation: { duration: 400, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          animation: { duration: 400 },
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-bg').trim(),
          titleColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-text').trim(),
          bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-text').trim(),
          borderColor: '#8b5cf6',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: function(ctx) {
              let label = ctx.dataset.label || '';
              if (label) label += ': ';
              if (ctx.dataset.label === 'Forecast Amount') {
                label += formatCurrency(ctx.parsed.y);
              } else {
                label += ctx.parsed.y;
              }
              return label;
            }
          }
        }
      },
      afterRender: function(chart) {
        // Multiple approaches to force font size
        console.log('Weekly chart afterRender - attempting font fixes');
        
        // Method 1: Update chart options
        if (chart.options && chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
          chart.options.scales.x.ticks.font = {
            size: 16,
            family: 'system-ui',
            weight: 'normal'
          };
        }
        
        // Method 2: Direct DOM manipulation
        const canvas = chart.canvas;
        if (canvas) {
          const labels = canvas.parentElement.querySelectorAll('text');
          labels.forEach(label => {
            label.style.fontSize = '16px';
            label.style.fontFamily = 'system-ui';
          });
        }
        
        // Method 3: Update context font
        const ctx = chart.ctx;
        if (ctx) {
          ctx.font = '16px system-ui';
        }
      },
      scales: {
        x: {
          title: { display: false },
          ticks: {
            maxRotation: 0, 
            minRotation: 0, 
            autoSkip: false,
            color: 'transparent', // Hide original labels
            font: {
              size: 1, // Make original labels invisible
              family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
            },
            callback: function() {
              return ''; // Return empty string to hide labels
            }
          },
          grid: {
            color: function(context) {
              const label = context.tick && context.tick.label ? context.tick.label : '';
              return /W1$/.test(label) ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.07)';
            },
            lineWidth: function(context) {
              const label = context.tick && context.tick.label ? context.tick.label : '';
              return /W1$/.test(label) ? 1.5 : 1;
            }
          },
          offset: true
        },
        yAmount: {
          display: false,
          beginAtZero: true,
          suggestedMax: yAmountMax,
          max: yAmountMax,
          offset: true,
          ticks: {
            stepSize: yAmountStep,
            max: yAmountMax
          }
        },
        yCount: {
          display: false, 
          beginAtZero: true,
          min: window.monthlyYCountConfig.min,
          max: yCountMax, 
          ticks: {
            stepSize: yCountStep,
            precision: 0
          },
          offset: true 
        }
      }
    }});

  // Force font size update after chart creation (workaround for Chart.js font rendering issues)
  setTimeout(() => {
    if (window.forecastWeeklyChartInstance && window.forecastWeeklyChartInstance.options) {
      window.forecastWeeklyChartInstance.options.scales.x.ticks.font = {
        size: 16
      };
      window.forecastWeeklyChartInstance.update('none');
      
      // Additional force update after a longer delay
      setTimeout(() => {
        if (window.forecastWeeklyChartInstance) {
          window.forecastWeeklyChartInstance.update('resize');
          
          // Direct canvas context manipulation as last resort
          const canvas = document.getElementById('forecastWeeklyChart');
          if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
              context.font = '16px system-ui, -apple-system, "Segoe UI", sans-serif';
            }
          }
        }
      }, 500);
    }
  }, 100);
  // --- Draw y-axis ticks and title on left canvas (Amount) ---
  const chart = window.forecastWeeklyChartInstance;
  const yAmount = chart.scales['yAmount'];
  yAxisLeftCtx.clearRect(0, 0, yAxisLeftCanvas.width / (window.devicePixelRatio || 1), yAxisLeftCanvas.height / (window.devicePixelRatio || 1));
  yAxisLeftCtx.save();
  yAxisLeftCtx.font = '14px system-ui, -apple-system, "Segoe UI", sans-serif';
  yAxisLeftCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-forecast').trim();
  yAxisLeftCtx.textAlign = 'right';
  yAxisLeftCtx.textBaseline = 'middle';
  if (yAmount && chart.chartArea) {
    const ticks = yAmount.ticks;
    const chartArea = chart.chartArea;
    const yMin = yAmount.min;
    const yMax = yAmount.max;
    function getAlignedY(value) {
      const frac = (value - yMin) / (yMax - yMin);
      return chartArea.bottom - frac * (chartArea.bottom - chartArea.top);
    }
    const labelX = 45;
    ticks.forEach(tick => {
      const y = getAlignedY(tick.value);
      yAxisLeftCtx.fillText(abbreviateNumber(tick.value), labelX, y);
    });
  }
  yAxisLeftCtx.restore();
  // --- Draw y-axis ticks and title on right canvas (Count) ---
  const weeklyYCountScale = window.forecastWeeklyChartInstance.scales['yCount'];
  yAxisRightCtx.clearRect(0, 0, yAxisRightCanvas.width / (window.devicePixelRatio || 1), yAxisRightCanvas.height / (window.devicePixelRatio || 1));
  yAxisRightCtx.save();

  const countTickColor = (window.monthlyYCountConfig && window.monthlyYCountConfig.titleColor) || getComputedStyle(document.documentElement).getPropertyValue('--chart-tick-color').trim();
  yAxisRightCtx.fillStyle = countTickColor;
  yAxisRightCtx.font = '14px system-ui, -apple-system, "Segoe UI", sans-serif';
  yAxisRightCtx.textAlign = 'left'; 
  yAxisRightCtx.textBaseline = 'middle';

  if (weeklyYCountScale && window.forecastWeeklyChartInstance.chartArea && window.monthlyYCountConfig && window.monthlyYCountConfig.ticks) {
    const tickValuesToDraw = window.monthlyYCountConfig.ticks;
    const chartArea = window.forecastWeeklyChartInstance.chartArea;

    if (tickValuesToDraw.length > 0) {
        tickValuesToDraw.forEach(value => {
            const y = weeklyYCountScale.getPixelForValue(value);
            if (y >= chartArea.top && y <= chartArea.bottom + 5) { 
                 yAxisRightCtx.fillText(value, 10, y); 
            }
        });
    }

    if (tickValuesToDraw.length > 0 || window.monthlyYCountConfig.max > 0) { // Show title if there are ticks or if monthly chart had a count scale
        const titleText = window.monthlyYCountConfig.titleText || 'Count';
        const titleColor = window.monthlyYCountConfig.titleColor || getComputedStyle(document.documentElement).getPropertyValue('--chart-title-color').trim();
        const titleFont = 'bold 14px system-ui, -apple-system, "Segoe UI", sans-serif';

        const topPixel = weeklyYCountScale.getPixelForValue(weeklyYCountScale.max);
        const bottomPixel = weeklyYCountScale.getPixelForValue(weeklyYCountScale.min);
        const centerY = (topPixel + bottomPixel) / 2;

        yAxisRightCtx.save();
        yAxisRightCtx.font = titleFont;
        yAxisRightCtx.textAlign = 'center';
        yAxisRightCtx.textBaseline = 'bottom'; 
        yAxisRightCtx.fillStyle = titleColor;
        yAxisRightCtx.translate((yAxisRightCanvas.width / (window.devicePixelRatio || 1)) - 15, centerY);
        yAxisRightCtx.rotate(Math.PI / 2); 
        yAxisRightCtx.fillText(titleText, 0, 0);
        yAxisRightCtx.restore();
    }
  }
  yAxisRightCtx.restore();
  // --- Render fixed legend above chart ---
  const legendDiv = document.getElementById('forecastWeeklyLegend');
  if (legendDiv) {
    legendDiv.innerHTML = `
      <span style="display:inline-block;margin:0 16px;"><span style="display:inline-block;width:18px;height:12px;background:rgba(139,92,246,0.7);border:1px solid #8b5cf6;margin-right:6px;vertical-align:middle;"></span>Forecast Amount</span>
      <span style="display:inline-block;margin:0 16px;"><span style="display:inline-block;width:18px;height:3px;background:#6b7280;margin-right:6px;vertical-align:middle;"></span>Forecast Count</span>
    `;
  }
}

function shortMonthWeekLabel(monthWeek) {
  // e.g. "February 2025 - Week 2" => "Feb W2"
  if (!monthWeek) return '';
  const match = monthWeek.match(/^([A-Za-z]+) (\d{4}) - Week (\d)$/);
  if (!match) return monthWeek;
  const [_, month, year, week] = match;
  return `${month.substr(0,3)} W${week}`;
}

function abbreviateNumber(value) {
  value = Number(value);
  if (value >= 1e6) return '₱' + (value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1) + 'M';
  if (value >= 1e3) return '₱' + (value / 1e3).toFixed(value % 1e3 === 0 ? 0 : 1) + 'k';
  return '₱' + value;
}

// --- LOGOUT BUTTON HANDLER ---
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove any previous event listeners by replacing the node
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
        newBtn.addEventListener('click', function() {
            localStorage.removeItem('authToken');
            localStorage.setItem('authEvent', JSON.stringify({ type: 'logout', ts: Date.now() }));
            window.location.href = 'index.html';
        });
    }
}
document.addEventListener('DOMContentLoaded', setupLogoutButton);
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        setupLogoutButton();
    }
});

// --- CHANGE PASSWORD BUTTON HANDLER ---
function setupChangePasswordButton() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        // Remove any previous event listeners by replacing the node
        const newBtn = changePasswordBtn.cloneNode(true);
        changePasswordBtn.parentNode.replaceChild(newBtn, changePasswordBtn);
        newBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }
}
document.addEventListener('DOMContentLoaded', setupChangePasswordButton);
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        setupChangePasswordButton();
    }
});

// --- EDIT FORECAST DATE MODAL FUNCTIONALITY ---
function setupEditForecastDateHandlers() {
    // Remove existing event listeners to prevent duplicates
    const existingButtons = document.querySelectorAll('.edit-forecast-date-btn');
    existingButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    // Add event listeners to edit buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('edit-forecast-date-btn')) {
            const projectUid = e.target.getAttribute('data-project-uid');
            const projectName = e.target.getAttribute('data-project-name');
            const currentForecastDate = e.target.getAttribute('data-forecast-date');
            
            openEditForecastDateModal(projectUid, projectName, currentForecastDate);
        }
    });
}

function openEditForecastDateModal(projectUid, projectName, currentForecastDate) {
    const modal = document.getElementById('editForecastDateModal');
    const overlay = document.getElementById('editForecastDateModalOverlay');
    const modalTitle = document.getElementById('editForecastDateModalLabel');
    const dateInput = document.getElementById('forecast-date-input');
    const feedback = document.getElementById('edit-forecast-date-feedback');
    
    if (!modal || !overlay || !modalTitle || !dateInput) {
        console.error('Edit forecast date modal elements not found');
        return;
    }

    // Set modal title and populate form
    modalTitle.textContent = `Edit Forecast Date - ${projectName}`;
    dateInput.value = currentForecastDate || '';
    feedback.style.display = 'none';
    
    // Store project UID for saving
    modal.setAttribute('data-current-project-uid', projectUid);
    
    // Show modal
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    dateInput.focus();
}

function closeEditForecastDateModal() {
    const modal = document.getElementById('editForecastDateModal');
    const overlay = document.getElementById('editForecastDateModalOverlay');
    
    if (modal && overlay) {
        modal.classList.add('hidden');
        overlay.classList.add('hidden');
    }
}

async function saveForecastDate() {
    const modal = document.getElementById('editForecastDateModal');
    const dateInput = document.getElementById('forecast-date-input');
    const feedback = document.getElementById('edit-forecast-date-feedback');
    const saveBtn = document.getElementById('save-forecast-date-btn');
    
    if (!modal || !dateInput || !feedback || !saveBtn) return;
    
    const projectUid = modal.getAttribute('data-current-project-uid');
    const newForecastDate = dateInput.value;
    
    if (!projectUid) {
        feedback.textContent = 'Error: No project selected';
        feedback.style.display = 'block';
        return;
    }
    
    if (!newForecastDate) {
        feedback.textContent = 'Please select a forecast date';
        feedback.style.display = 'block';
        return;
    }
    
    // Disable save button during request
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/update-forecast-date', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                projectUid: projectUid,
                forecastDate: newForecastDate
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Close modal
            closeEditForecastDateModal();
            
            // Refresh the dashboard data
            await refreshForecastDashboard();
            
            // Show success message (you could add a toast notification here)
            console.log('Forecast date updated successfully');
        } else {
            feedback.textContent = result.message || 'Error updating forecast date';
            feedback.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating forecast date:', error);
        feedback.textContent = 'Network error. Please try again.';
        feedback.style.display = 'block';
    } finally {
        // Re-enable save button
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function refreshForecastDashboard() {
    try {
        // Refresh forecast data
        const data = await fetchForecastData(currentOpStatusFilter);
        if (data) {
            renderForecastDashboard(data, currentOpStatusFilter);
        }
        
        // Refresh weekly chart data
        const weekData = await fetchForecastWeekSummary();
        if (weekData && weekData.weekSummary && typeof renderForecastWeeklyChart === 'function') {
            renderForecastWeeklyChart(weekData.weekSummary);
        }
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    }
}

// --- MODAL EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.getElementById('closeEditForecastDateModalBtn');
    const cancelBtn = document.getElementById('cancelEditForecastDateModalBtn');
    const saveBtn = document.getElementById('save-forecast-date-btn');
    const overlay = document.getElementById('editForecastDateModalOverlay');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditForecastDateModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditForecastDateModal);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveForecastDate);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeEditForecastDateModal);
    }
    
    // Handle ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('editForecastDateModal');
            if (modal && !modal.classList.contains('hidden')) {
                closeEditForecastDateModal();
            }
        }
    });
});