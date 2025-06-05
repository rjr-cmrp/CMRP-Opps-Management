// executive_dashboard.js - Executive Dashboard Implementation

// --- API URL Helper ---
function getApiUrl(endpoint) {
    if (typeof window !== 'undefined' && window.APP_CONFIG) {
        return window.APP_CONFIG.API_BASE_URL + endpoint;
    }
    // Fallback for development
    return (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://cmrp-opps-backend.onrender.com') + endpoint;
}

// --- Global Variables ---
let dashboardDataCache = null;
let pipelineChartInstance = null;
let statusChartInstance = null;
let historicalChartInstance = null;
let currentComparisonMode = 'weekly'; // 'weekly', 'monthly', or null
let isLoginMode = true;

// --- Input Validation Helpers ---
function validateEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 100;
}

function validateName(name) {
    return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;
}

function validateRoles(roles) {
    return Array.isArray(roles) && roles.length > 0 && roles.every(r => typeof r === 'string' && r.length > 0);
}

// --- Authentication Functions ---
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function isValidToken(token) {
    return typeof token === 'string' && token.length > 0;
}

function showMainContent(show) {
    const main = document.querySelector('.main-content');
    if (main) main.style.display = show ? '' : 'none';
}

function showAuthModal() {
    const authModalOverlay = document.getElementById('authModalOverlay');
    const authModal = document.getElementById('authModal');
    if (authModalOverlay) authModalOverlay.style.display = 'block';
    if (authModal) authModal.style.display = 'block';
}

function hideAuthModal() {
    const authModalOverlay = document.getElementById('authModalOverlay');
    const authModal = document.getElementById('authModal');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const authForm = document.getElementById('authForm');
    
    if (authModalOverlay) authModalOverlay.style.display = 'none';
    if (authModal) authModal.style.display = 'none';
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';
    if (authForm) authForm.reset();
}

function setAuthMode(login) {
    isLoginMode = login;
    const authModalTitle = document.getElementById('authModalTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const registerFields = document.getElementById('registerFields');
    const switchAuthMode = document.getElementById('switchAuthMode');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const authForm = document.getElementById('authForm');
    
    if (authModalTitle) authModalTitle.textContent = login ? 'Login' : 'Register';
    if (authSubmitBtn) authSubmitBtn.textContent = login ? 'Login' : 'Register';
    if (registerFields) registerFields.style.display = login ? 'none' : 'block';
    if (switchAuthMode) switchAuthMode.textContent = login ? "Don't have an account? Register" : "Already have an account? Login";
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';
    if (authForm) authForm.reset();
}

function requireAuth() {
    const token = localStorage.getItem('authToken');
    if (!isValidToken(token)) {
        localStorage.removeItem('authToken');
        showMainContent(false);
        setAuthMode(true);
        showAuthModal();
    } else {
        showMainContent(true);
        hideAuthModal();
    }
}

// --- Data Fetching ---
async function fetchDashboardData() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Not authenticated');
        
        const res = await fetch(getApiUrl('/api/opportunities'), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!res.ok) throw new Error('Failed to fetch data: ' + res.status);
        
        const data = await res.json();
        dashboardDataCache = data;
        console.log('[DEBUG] Executive dashboard data fetched:', data);
        
        renderExecutiveDashboard(data);
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            const main = document.querySelector('.main-content');
            if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">No dashboard data available.</div>';
        }
        
    } catch (err) {
        console.error('[DEBUG] Executive dashboard data fetch error:', err);
        const main = document.querySelector('.main-content');
        if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">Failed to load executive dashboard data.<br>' + err.message + '</div>';
    }
}

// --- Dashboard Metrics Calculation ---
function calculateMetrics(data) {
    const metrics = {
        totalOpportunities: data.length,
        submittedCount: data.filter(d => d.opp_status === 'SUBMITTED').length,
        submittedAmount: data.filter(d => d.opp_status === 'SUBMITTED').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        op100Count: data.filter(d => d.opp_status === 'OP100').length,
        op100Amount: data.filter(d => d.opp_status === 'OP100').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        op90Count: data.filter(d => d.opp_status === 'OP90').length,
        op90Amount: data.filter(d => d.opp_status === 'OP90').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        op60Count: data.filter(d => d.opp_status === 'OP60').length,
        op60Amount: data.filter(d => d.opp_status === 'OP60').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        op30Count: data.filter(d => d.opp_status === 'OP30').length,
        op30Amount: data.filter(d => d.opp_status === 'OP30').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        lostCount: data.filter(d => d.opp_status === 'LOST').length,
        lostAmount: data.filter(d => d.opp_status === 'LOST').reduce((sum, d) => sum + (parseFloat(d.final_amt) || 0), 0),
        inactiveCount: data.filter(d => d.opp_status === 'INACTIVE').length,
        ongoingCount: data.filter(d => d.opp_status === 'ON-GOING').length,
        pendingCount: data.filter(d => d.opp_status === 'PENDING').length,
        declinedCount: data.filter(d => d.opp_status === 'DECLINED').length,
        revisedCount: data.filter(d => d.opp_status === 'REVISED').length
    };
    
    return metrics;
}

// --- Period Comparison Functions ---
function withDelta(currentValue, previousValue) {
    if (currentComparisonMode === null || previousValue === undefined || previousValue === null) {
        return formatMetricValue(currentValue);
    }
    
    const delta = currentValue - previousValue;
    const deltaStr = delta > 0 ? `(+${formatDeltaValue(delta)})` : delta < 0 ? `(${formatDeltaValue(delta)})` : '(0)';
    const deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
    
    return `${formatMetricValue(currentValue)} <span class="dashboard-delta ${deltaClass}">${deltaStr}</span>`;
}

function formatMetricValue(value) {
    if (typeof value === 'number' && value >= 1000000) {
        return `₱${(value / 1000000).toFixed(1)}M`;
    } else if (typeof value === 'number' && value >= 1000) {
        return `₱${(value / 1000).toFixed(1)}K`;
    } else if (typeof value === 'number') {
        return value.toLocaleString();
    }
    return value;
}

function formatDeltaValue(value) {
    if (Math.abs(value) >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }
    return Math.abs(value).toLocaleString();
}

function getComparisonData() {
    const storageKey = currentComparisonMode === 'weekly' ? 'executiveDashboardLastWeek' : 'executiveDashboardLastMonth';
    const savedData = localStorage.getItem(storageKey);
    
    if (!savedData) return {};
    
    try {
        return JSON.parse(savedData);
    } catch (e) {
        console.error('Error parsing comparison data:', e);
        return {};
    }
}

function saveCurrentSnapshot(metrics) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
    const dayOfMonth = today.getDate(); // 1-31
    
    const snapshot = {
        ...metrics,
        savedDate: today.toISOString()
    };
    
    // Save weekly snapshot on Mondays
    if (dayOfWeek === 1) {
        localStorage.setItem('executiveDashboardLastWeek', JSON.stringify(snapshot));
    }
    
    // Save monthly snapshot on the 1st of each month
    if (dayOfMonth === 1) {
        localStorage.setItem('executiveDashboardLastMonth', JSON.stringify(snapshot));
    }
}

// --- Dashboard Rendering ---
function renderExecutiveDashboard(data) {
    const currentMetrics = calculateMetrics(data);
    const comparisonData = getComparisonData();
    
    // Save snapshot for future comparisons
    saveCurrentSnapshot(currentMetrics);
    
    // Update dashboard cards
    setDashboardValue('totalOpportunities', withDelta(currentMetrics.totalOpportunities, comparisonData.totalOpportunities));
    setDashboardValue('submittedCount', withDelta(currentMetrics.submittedCount, comparisonData.submittedCount));
    setDashboardValue('submittedAmount', withDelta(currentMetrics.submittedAmount, comparisonData.submittedAmount));
    setDashboardValue('op100Count', withDelta(currentMetrics.op100Count, comparisonData.op100Count));
    setDashboardValue('op100Amount', withDelta(currentMetrics.op100Amount, comparisonData.op100Amount));
    setDashboardValue('op90Count', withDelta(currentMetrics.op90Count, comparisonData.op90Count));
    setDashboardValue('op90Amount', withDelta(currentMetrics.op90Amount, comparisonData.op90Amount));
    setDashboardValue('op60Count', withDelta(currentMetrics.op60Count, comparisonData.op60Count));
    setDashboardValue('op60Amount', withDelta(currentMetrics.op60Amount, comparisonData.op60Amount));
    setDashboardValue('op30Count', withDelta(currentMetrics.op30Count, comparisonData.op30Count));
    setDashboardValue('op30Amount', withDelta(currentMetrics.op30Amount, comparisonData.op30Amount));
    setDashboardValue('lostCount', withDelta(currentMetrics.lostCount, comparisonData.lostCount));
    setDashboardValue('lostAmount', withDelta(currentMetrics.lostAmount, comparisonData.lostAmount));
    setDashboardValue('inactiveCount', withDelta(currentMetrics.inactiveCount, comparisonData.inactiveCount));
    setDashboardValue('ongoingCount', withDelta(currentMetrics.ongoingCount, comparisonData.ongoingCount));
    setDashboardValue('pendingCount', withDelta(currentMetrics.pendingCount, comparisonData.pendingCount));
    setDashboardValue('declinedCount', withDelta(currentMetrics.declinedCount, comparisonData.declinedCount));
    setDashboardValue('revisedCount', withDelta(currentMetrics.revisedCount, comparisonData.revisedCount));
    
    // Render charts
    renderPipelineChart(currentMetrics);
    renderStatusChart(currentMetrics);
    renderHistoricalChart(data);
    
    // Render tables
    renderSummaryTable(currentMetrics, comparisonData);
    renderDetailedTable(data);
}

function setDashboardValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = value;
    }
}

// --- Chart Rendering Functions ---
function renderPipelineChart(metrics) {
    const ctx = document.getElementById('pipelineChart');
    if (!ctx) return;
    
    if (pipelineChartInstance) {
        pipelineChartInstance.destroy();
    }
    
    const data = {
        labels: ['OP100', 'OP90', 'OP60', 'OP30', 'Submitted'],
        datasets: [{
            label: 'Count',
            data: [
                metrics.op100Count,
                metrics.op90Count,
                metrics.op60Count,
                metrics.op30Count,
                metrics.submittedCount
            ],
            backgroundColor: [
                '#10b981', // emerald-500
                '#06b6d4', // cyan-500  
                '#3b82f6', // blue-500
                '#f59e0b', // amber-500
                '#ef4444'  // red-500
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    
    const config = {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    titleColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    bodyColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                    borderWidth: 1
                }
            }
        }
    };
    
    pipelineChartInstance = new Chart(ctx, config);
}

function renderStatusChart(metrics) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    if (statusChartInstance) {
        statusChartInstance.destroy();
    }
    
    const data = {
        labels: ['Active Pipeline', 'Lost', 'Inactive', 'On-Going', 'Pending', 'Declined', 'Revised'],
        datasets: [{
            label: 'Count',
            data: [
                metrics.op100Count + metrics.op90Count + metrics.op60Count + metrics.op30Count,
                metrics.lostCount,
                metrics.inactiveCount,
                metrics.ongoingCount,
                metrics.pendingCount,
                metrics.declinedCount,
                metrics.revisedCount
            ],
            backgroundColor: [
                '#10b981', // emerald-500 - active pipeline
                '#ef4444', // red-500 - lost
                '#6b7280', // gray-500 - inactive
                '#3b82f6', // blue-500 - ongoing
                '#f59e0b', // amber-500 - pending
                '#ec4899', // pink-500 - declined
                '#8b5cf6'  // violet-500 - revised
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    
    const config = {
        type: 'pie',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    titleColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    bodyColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                    borderWidth: 1
                }
            }
        }
    };
    
    statusChartInstance = new Chart(ctx, config);
}

function renderHistoricalChart(data) {
    const ctx = document.getElementById('historicalChart');
    if (!ctx) return;
    
    if (historicalChartInstance) {
        historicalChartInstance.destroy();
    }
    
    // Group data by month for historical trends
    const monthlyData = {};
    data.forEach(item => {
        if (item.date_received) {
            const date = new Date(item.date_received);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    totalOpportunities: 0,
                    submittedCount: 0,
                    submittedAmount: 0,
                    pipelineCount: 0,
                    pipelineAmount: 0
                };
            }
            
            monthlyData[monthKey].totalOpportunities++;
            
            if (item.opp_status === 'SUBMITTED') {
                monthlyData[monthKey].submittedCount++;
                monthlyData[monthKey].submittedAmount += parseFloat(item.final_amt) || 0;
            }
            
            if (['OP100', 'OP90', 'OP60', 'OP30'].includes(item.opp_status)) {
                monthlyData[monthKey].pipelineCount++;
                monthlyData[monthKey].pipelineAmount += parseFloat(item.final_amt) || 0;
            }
        }
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    });
    
    const chartData = {
        labels: labels,
        datasets: [
            {
                label: 'Total Opportunities',
                data: sortedMonths.map(month => monthlyData[month].totalOpportunities),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'y'
            },
            {
                label: 'Submitted Count',
                data: sortedMonths.map(month => monthlyData[month].submittedCount),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                yAxisID: 'y'
            },
            {
                label: 'Pipeline Count',
                data: sortedMonths.map(month => monthlyData[month].pipelineCount),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                yAxisID: 'y'
            }
        ]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    titleColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    bodyColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Month',
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
                    },
                    ticks: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
                    },
                    grid: {
                        color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Count',
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
                    },
                    ticks: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
                    },
                    grid: {
                        color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
                    }
                }
            }
        }
    };
    
    historicalChartInstance = new Chart(ctx, config);
}

// --- Table Rendering Functions ---
function renderSummaryTable(currentMetrics, comparisonData) {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    const rows = [
        { metric: 'Total Opportunities', current: currentMetrics.totalOpportunities, previous: comparisonData.totalOpportunities },
        { metric: 'Submitted Count', current: currentMetrics.submittedCount, previous: comparisonData.submittedCount },
        { metric: 'Submitted Amount', current: currentMetrics.submittedAmount, previous: comparisonData.submittedAmount },
        { metric: 'OP100 Count', current: currentMetrics.op100Count, previous: comparisonData.op100Count },
        { metric: 'OP100 Amount', current: currentMetrics.op100Amount, previous: comparisonData.op100Amount },
        { metric: 'OP90 Count', current: currentMetrics.op90Count, previous: comparisonData.op90Count },
        { metric: 'OP90 Amount', current: currentMetrics.op90Amount, previous: comparisonData.op90Amount },
        { metric: 'Lost Count', current: currentMetrics.lostCount, previous: comparisonData.lostCount },
        { metric: 'Lost Amount', current: currentMetrics.lostAmount, previous: comparisonData.lostAmount }
    ];
    
    tbody.innerHTML = rows.map(row => {
        const change = row.previous !== undefined ? row.current - row.previous : null;
        const percentChange = row.previous !== undefined && row.previous !== 0 ? ((change / row.previous) * 100) : null;
        
        const changeDisplay = change !== null ? (change > 0 ? `+${formatDeltaValue(change)}` : formatDeltaValue(change)) : '--';
        const percentDisplay = percentChange !== null ? `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%` : '--';
        const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
        
        return `
            <tr>
                <td class="font-medium">${row.metric}</td>
                <td class="text-right">${formatMetricValue(row.current)}</td>
                <td class="text-right">${row.previous !== undefined ? formatMetricValue(row.previous) : '--'}</td>
                <td class="text-right dashboard-delta ${changeClass}">${changeDisplay}</td>
                <td class="text-right dashboard-delta ${changeClass}">${percentDisplay}</td>
            </tr>
        `;
    }).join('');
}

function renderDetailedTable(data) {
    const tbody = document.getElementById('detailedTableBody');
    if (!tbody) return;
    
    // Sort by date_received (newest first)
    const sortedData = [...data].sort((a, b) => new Date(b.date_received) - new Date(a.date_received));
    
    tbody.innerHTML = sortedData.slice(0, 100).map(item => { // Limit to first 100 rows for performance
        const amount = formatMetricValue(parseFloat(item.final_amt) || 0);
        const dateReceived = item.date_received ? new Date(item.date_received).toLocaleDateString() : '--';
        
        return `
            <tr>
                <td class="font-medium">${sanitizeHTML(item.project_name || '--')}</td>
                <td>${sanitizeHTML(item.client || '--')}</td>
                <td>
                    <span class="status-badge status-${(item.opp_status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}">${sanitizeHTML(item.opp_status || '--')}</span>
                </td>
                <td class="text-right">${amount}</td>
                <td>${dateReceived}</td>
                <td>${sanitizeHTML(item.account_mgr || '--')}</td>
            </tr>
        `;
    }).join('');
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Period Comparison Controls ---
function setupPeriodControls() {
    const weeklyBtn = document.getElementById('weeklyView');
    const monthlyBtn = document.getElementById('monthlyView');
    
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', () => {
            currentComparisonMode = 'weekly';
            updatePeriodButtons();
            if (dashboardDataCache) renderExecutiveDashboard(dashboardDataCache);
        });
    }
    
    if (monthlyBtn) {
        monthlyBtn.addEventListener('click', () => {
            currentComparisonMode = 'monthly';
            updatePeriodButtons();
            if (dashboardDataCache) renderExecutiveDashboard(dashboardDataCache);
        });
    }
    
    updatePeriodButtons();
}

function updatePeriodButtons() {
    const weeklyBtn = document.getElementById('weeklyView');
    const monthlyBtn = document.getElementById('monthlyView');
    
    if (weeklyBtn) {
        weeklyBtn.classList.toggle('active', currentComparisonMode === 'weekly');
    }
    if (monthlyBtn) {
        monthlyBtn.classList.toggle('active', currentComparisonMode === 'monthly');
    }
}

// --- Table Toggle Controls ---
function setupTableControls() {
    const summaryBtn = document.getElementById('showSummaryTable');
    const detailedBtn = document.getElementById('showDetailedTable');
    const summaryContainer = document.getElementById('summaryTableContainer');
    const detailedContainer = document.getElementById('detailedTableContainer');
    
    if (summaryBtn) {
        summaryBtn.addEventListener('click', () => {
            summaryBtn.classList.add('active');
            detailedBtn?.classList.remove('active');
            if (summaryContainer) summaryContainer.style.display = 'block';
            if (detailedContainer) detailedContainer.style.display = 'none';
        });
    }
    
    if (detailedBtn) {
        detailedBtn.addEventListener('click', () => {
            detailedBtn.classList.add('active');
            summaryBtn?.classList.remove('active');
            if (detailedContainer) detailedContainer.style.display = 'block';
            if (summaryContainer) summaryContainer.style.display = 'none';
        });
    }
}

// --- Theme Management ---
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

function updateLogoForTheme() {
    const logo = document.getElementById('cmrpLogo');
    const isDark = document.documentElement.classList.contains('dark');
    if (logo) logo.src = isDark ? 'Logo/CMRP Logo Light.svg' : 'Logo/CMRP Logo Dark.svg';
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateLogoForTheme();
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('.material-icons');
        if (icon) icon.textContent = 'light_mode';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    
    // Re-render charts with new theme colors
    if (dashboardDataCache) {
        const metrics = calculateMetrics(dashboardDataCache);
        renderPipelineChart(metrics);
        renderStatusChart(metrics);
        renderHistoricalChart(dashboardDataCache);
    }
}

// --- Event Handlers ---
function setupEventHandlers() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('authToken');
            localStorage.setItem('authEvent', JSON.stringify({ type: 'logout', ts: Date.now() }));
            window.location.href = 'index.html';
        });
    }
    
    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }
    
    // Auth modal controls
    const authModalOverlay = document.getElementById('authModalOverlay');
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const switchAuthMode = document.getElementById('switchAuthMode');
    
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', (e) => {
            if (e.target === authModalOverlay) hideAuthModal();
        });
    }
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    if (switchAuthMode) {
        switchAuthMode.addEventListener('click', () => setAuthMode(!isLoginMode));
    }
    
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authName = document.getElementById('authName');
    
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';
    if (authSubmitBtn) authSubmitBtn.disabled = true;
    
    const email = authEmail?.value.trim();
    const password = authPassword?.value;
    
    if (isLoginMode) {
        if (!validateEmail(email)) {
            if (authError) {
                authError.textContent = 'Invalid email format.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        if (!validatePassword(password)) {
            if (authError) {
                authError.textContent = 'Password must be 8-100 characters.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        try {
            const res = await fetch(getApiUrl('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('authEvent', JSON.stringify({ type: 'login', ts: Date.now() }));
            
            showMainContent(true);
            hideAuthModal();
            updateUserMgmtNavVisibility();
            fetchDashboardData();
            
        } catch (err) {
            if (authError) {
                authError.textContent = err.message;
                authError.style.display = 'block';
            }
        } finally {
            if (authSubmitBtn) authSubmitBtn.disabled = false;
        }
    } else {
        // Registration logic
        const name = authName?.value.trim();
        const roles = Array.from(document.querySelectorAll('input[name=role]:checked')).map(cb => cb.value);
        
        if (!validateEmail(email)) {
            if (authError) {
                authError.textContent = 'Invalid email format.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        if (!validatePassword(password)) {
            if (authError) {
                authError.textContent = 'Password must be 8-100 characters.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        if (!validateName(name)) {
            if (authError) {
                authError.textContent = 'Name must be 2-100 characters.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        if (!validateRoles(roles)) {
            if (authError) {
                authError.textContent = 'Select at least one role.';
                authError.style.display = 'block';
            }
            if (authSubmitBtn) authSubmitBtn.disabled = false;
            return;
        }
        
        try {
            const res = await fetch(getApiUrl('/api/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, roles })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            
            if (authSuccess) {
                authSuccess.textContent = 'Registration successful! You may now log in.';
                authSuccess.style.display = 'block';
            }
            
            setTimeout(() => setAuthMode(true), 1200);
            
        } catch (err) {
            if (authError) {
                authError.textContent = err.message;
                authError.style.display = 'block';
            }
        } finally {
            if (authSubmitBtn) authSubmitBtn.disabled = false;
        }
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Set initial theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(initialTheme);
    
    // Highlight current nav button
    const navLinks = document.querySelectorAll('#mainNav a');
    navLinks.forEach(link => {
        if (window.location.pathname.endsWith(link.getAttribute('href'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Check authentication and initialize
    requireAuth();
    updateUserMgmtNavVisibility();
    setupEventHandlers();
    setupPeriodControls();
    setupTableControls();
    
    // Fetch data if authenticated
    if (isAuthenticated()) {
        fetchDashboardData();
    }
    
    // Listen for auth changes in other tabs
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'authEvent') {
            const token = localStorage.getItem('authToken');
            if (token) {
                showMainContent(true);
                hideAuthModal();
                updateUserMgmtNavVisibility();
                fetchDashboardData();
            } else {
                showMainContent(false);
                setAuthMode(true);
                showAuthModal();
                updateUserMgmtNavVisibility();
            }
        }
    });
});
