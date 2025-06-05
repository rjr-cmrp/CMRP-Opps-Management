// win-loss_dashboard.js - All logic moved from inline <script> in win-loss_dashboard.html

// --- API URL Helper ---
function getApiUrl(endpoint) {
    if (typeof window !== 'undefined' && window.APP_CONFIG) {
        return window.APP_CONFIG.API_BASE_URL + endpoint;
    }
    // Fallback for development
    return (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://cmrp-opps-backend.onrender.com') + endpoint;
}

// --- Global Variables ---
let dashboardDataCache = null; // Cache fetched data (includes ALL opportunities)
let winChartInstance = null;   // Instance for the Wins chart
let lossChartInstance = null;  // Instance for the Losses chart
let currentSolutionFilter = 'all'; // State for the solution filter
let currentAccountMgrFilter = 'all';
let currentClientFilter = 'all';
// let currentQuarterFilter = 'all'; // Replaced by activeQuarters

// Initialize activeQuarters based on current date
function initializeActiveQuarters() {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4
    
    // Initialize all quarters as inactive
    const quarters = { '1': false, '2': false, '3': false, '4': false };
    
    // Activate current quarter and all previous quarters in the current year
    for (let q = 1; q <= currentQuarter; q++) {
        quarters[q] = true;
    }
    
    return quarters;
}

let activeQuarters = initializeActiveQuarters(); // Initialize based on current date
let currentTableStatusFilter = 'OP100'; // Default to OP100 only
// ...existing code for all helper functions, rendering, filters, etc...

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

// --- Robust Date Parsing Helper ---
function robustParseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) return val;
    // Try ISO, yyyy-mm-dd, mm/dd/yyyy, dd-mm-yyyy, etc.
    let d = new Date(val);
    if (!isNaN(d)) return d;
    // Try yyyy-mm-dd
    const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(val);
    if (isoMatch) {
        d = new Date(val.replace(/-/g, '/'));
        if (!isNaN(d)) return d;
    }
    // Try mm/dd/yyyy
    const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val);
    if (usMatch) {
        d = new Date(`${usMatch[3]}-${usMatch[1].padStart(2,'0')}-${usMatch[2].padStart(2,'0')}`);
        if (!isNaN(d)) return d;
    }
    // Try dd-mm-yyyy
    const euMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(val);
    if (euMatch) {
        d = new Date(`${euMatch[3]}-${euMatch[2].padStart(2,'0')}-${euMatch[1].padStart(2,'0')}`);
        if (!isNaN(d)) return d;
    }
    return null;
}

// Patch: Ensure date_awarded is populated from date_awarded_lost if missing
function patchDateAwardedField(data) {
    if (!Array.isArray(data)) return data;
    data.forEach(item => {
        if (!item.date_awarded && item.date_awarded_lost) {
            item.date_awarded = item.date_awarded_lost;
        }
    });
    return data;
}

// --- DOMContentLoaded logic and event handlers ---
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code for initializing elements, theme, listeners, data fetch, etc...

    // --- Auth Modal Logic ---
    const authModalOverlay = document.getElementById('authModalOverlay');
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authName = document.getElementById('authName');
    const registerFields = document.getElementById('registerFields');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const switchAuthMode = document.getElementById('switchAuthMode');
    let isLoginMode = true;
    function showAuthModal() {
        authModalOverlay.style.display = 'block';
        authModal.style.display = 'block';
    }
    function hideAuthModal() {
        authModalOverlay.style.display = 'none';
        authModal.style.display = 'none';
        authError.style.display = 'none';
        authSuccess.style.display = 'none';
        authForm.reset();
    }
    function setAuthMode(login) {
        isLoginMode = login;
        document.getElementById('authModalTitle').textContent = login ? 'Login' : 'Register';
        authSubmitBtn.textContent = login ? 'Login' : 'Register';
        registerFields.style.display = login ? 'none' : 'block';
        switchAuthMode.textContent = login ? "Don't have an account? Register" : "Already have an account? Login";
        authError.style.display = 'none';
        authSuccess.style.display = 'none';
        authForm.reset();
    }
    if (switchAuthMode) switchAuthMode.onclick = () => setAuthMode(!isLoginMode);
    if (authModalOverlay) authModalOverlay.onclick = hideAuthModal;

    function isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }
    function showMainContent(show) {
        var main = document.querySelector('.main-content');
        if (main) main.style.display = show ? '' : 'none';
    }

    // --- Robust Auth Check on Page Load ---
    function isValidToken(token) {
        // Basic check: token exists and is a non-empty string (add more checks if needed)
        return typeof token === 'string' && token.length > 0;
    }
    function requireAuth() {
        const token = localStorage.getItem('authToken');
        if (!isValidToken(token)) {
            localStorage.removeItem('authToken'); // Clean up any invalid token
            showMainContent(false);
            setAuthMode(true);
            showAuthModal();
        } else {
            showMainContent(true);
            hideAuthModal();
        }
    }
    // Call on page load
    requireAuth();

    // --- THEME & LOGO (copied logic from index.html) ---
    const themeToggle = document.getElementById('themeToggle');
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
        // Always sun icon
        if (themeToggle) {
            const icon = themeToggle.querySelector('.material-icons');
            if (icon) icon.textContent = 'light_mode';
        }
    }
    function toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    }
    // Set initial theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(initialTheme);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    // --- NAV BUTTON HIGHLIGHT ---
    const navLinks = document.querySelectorAll('#mainNav a');
    navLinks.forEach(link => {
        if (window.location.pathname.endsWith(link.getAttribute('href'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    // --- USER MGMT NAV BUTTON VISIBILITY (Admin only, copied from index.html) ---
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
    updateUserMgmtNavVisibility();
    window.addEventListener('storage', updateUserMgmtNavVisibility);

    // --- LOGOUT BUTTON (copied from index.html: direct event listener) ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('authToken');
            window.location.href = 'index.html';
        });
    }

    // --- Chart and Table Filter Logic (separate chart/table filters, with sorting) ---
    let currentSolutionFilter = 'all';
    let currentAccountMgrFilter = 'all';
    let currentClientFilter = 'all';
    let currentQuarterFilter = 'all'; // Added for quarter filtering
    let currentTableStatusFilter = 'OP100'; // Default to OP100 only
    let currentSort = { col: null, dir: 1 };
    const tableHeaders = [
        { key: 'project_name', numeric: false },
        { key: 'client', numeric: false },
        { key: 'account_mgr', numeric: false },
        { key: 'date_awarded', numeric: false },
        { key: 'final_amt', numeric: true },
        { key: 'margin', numeric: true }
    ];

    // Chart data: filtered by dropdowns
    function getFilteredChartData(opportunities) {
        let filtered = opportunities;
        if (currentSolutionFilter !== 'all') {
            filtered = filtered.filter(opp => opp['solutions'] === currentSolutionFilter);
        }
        if (currentAccountMgrFilter !== 'all') {
            filtered = filtered.filter(opp => opp['account_mgr'] === currentAccountMgrFilter);
        }
        if (currentClientFilter !== 'all') {
            filtered = filtered.filter(opp => opp['client'] === currentClientFilter);
        }

        // Filter by activeQuarters
        const anyQuarterActive = Object.values(activeQuarters).some(isActive => isActive);
        if (anyQuarterActive) {
            filtered = filtered.filter(opp => {
                const date = robustParseDate(opp.date_awarded_lost || opp.date_awarded);
                if (!date) return false;
                const month = date.getMonth(); // 0-11
                if (activeQuarters['1'] && month >= 0 && month <= 2) return true;
                if (activeQuarters['2'] && month >= 3 && month <= 5) return true;
                if (activeQuarters['3'] && month >= 6 && month <= 8) return true;
                if (activeQuarters['4'] && month >= 9 && month <= 11) return true;
                return false;
            });
        } else {
            // If no quarters are active, show no data (or handle as per preference, e.g., show all)
            // For now, returning an empty array effectively shows no data for charts.
            return []; 
        }
        return filtered;
    }

    // Table data: filtered by all filters (status, solution, account mgr, client, quarters)
    function getFilteredTableData(opportunities) {
        if (!Array.isArray(opportunities)) return [];
        
        let filtered = opportunities;

        // Apply status filter (OP100/LOST)
        if (currentTableStatusFilter === 'OP100') {
            filtered = filtered.filter(opp => (opp['opp_status']||'').toUpperCase() === 'OP100');
        } else if (currentTableStatusFilter === 'LOST') {
            filtered = filtered.filter(opp => (opp['opp_status']||'').toUpperCase() === 'LOST');
        }

        // Apply solution filter
        if (currentSolutionFilter !== 'all') {
            filtered = filtered.filter(opp => opp['solutions'] === currentSolutionFilter);
        }

        // Apply account manager filter
        if (currentAccountMgrFilter !== 'all') {
            filtered = filtered.filter(opp => opp['account_mgr'] === currentAccountMgrFilter);
        }

        // Apply client filter
        if (currentClientFilter !== 'all') {
            filtered = filtered.filter(opp => opp['client'] === currentClientFilter);
        }

        // Apply quarter filter
        const anyQuarterActive = Object.values(activeQuarters).some(isActive => isActive);
        if (anyQuarterActive) {
            filtered = filtered.filter(opp => {
                const date = robustParseDate(opp.date_awarded_lost || opp.date_awarded);
                if (!date) return false;
                const month = date.getMonth(); // 0-11
                if (activeQuarters['1'] && month >= 0 && month <= 2) return true;
                if (activeQuarters['2'] && month >= 3 && month <= 5) return true;
                if (activeQuarters['3'] && month >= 6 && month <= 8) return true;
                if (activeQuarters['4'] && month >= 9 && month <= 11) return true;
                return false;
            });
        }

        return filtered;
    }

    // --- DASHBOARD RENDERING ---
    function renderDashboard(data) {
        // Patch date_awarded for all records (API may use date_awarded_lost)
        patchDateAwardedField(data);
        // 1. Update dashboard cards and charts using chart filters
        const chartData = getFilteredChartData(data);
        let op100Count = 0, op100Amount = 0, lossCount = 0, lossAmount = 0;
        chartData.forEach(item => {
            if (item.opp_status === 'OP100') {
                op100Count++;
                op100Amount += Number(item.final_amt) || 0;
            } else if (item.opp_status === 'LOST') {
                lossCount++;
                lossAmount += Number(item.final_amt) || 0;
            }
        });
        document.getElementById('op100-total-count').textContent = op100Count;
        document.getElementById('op100-total-amount').textContent = '₱' + op100Amount.toLocaleString();
        document.getElementById('loss-total-count').textContent = lossCount;
        document.getElementById('loss-total-amount').textContent = '₱' + lossAmount.toLocaleString();
        renderWinLossCharts(data);
        // 2. Render table using table filter only
        renderOpportunitiesTable(data);
    }

    // --- DASHBOARD DATA FETCH (with debug) ---
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
            console.log('[DEBUG] Dashboard data fetched:', data);
            renderDashboard(data);
            if (!data || (Array.isArray(data) && data.length === 0)) {
                const main = document.querySelector('.main-content');
                if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">No dashboard data available.</div>';
            }
            populateDropdowns(data);
            setupTableFilterButtons();
            setupQuarterFilterButtons(); // Added call
        } catch (err) {
            console.error('[DEBUG] Dashboard data fetch error:', err);
            const main = document.querySelector('.main-content');
            if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">Failed to load dashboard data.<br>' + err.message + '</div>';
        }
    }
    // Call fetchDashboardData after successful login
    function afterLoginSuccess() {
        showMainContent(true);
        hideAuthModal();
        fetchDashboardData();
    }
    // Patch login/register success to call afterLoginSuccess
    if (authForm) authForm.onsubmit = async function(e) {
        e.preventDefault();
        authError.style.display = 'none';
        authSuccess.style.display = 'none';
        authSubmitBtn.disabled = true;
        const email = authEmail.value.trim();
        const password = authPassword.value;
        if (isLoginMode) {
            if (!validateEmail(email)) { authError.textContent = 'Invalid email.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            if (!validatePassword(password)) { authError.textContent = 'Password must be 8-100 characters.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            try {
                const res = await fetch(getApiUrl('/api/login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');
                localStorage.setItem('authToken', data.token);
                afterLoginSuccess();
            } catch (err) {
                authError.textContent = err.message;
                authError.style.display = 'block';
            } finally {
                authSubmitBtn.disabled = false;
            }
        } else {
            const name = authName.value.trim();
            const roles = Array.from(document.querySelectorAll('input[name=role]:checked')).map(cb => cb.value);
            if (!validateEmail(email)) { authError.textContent = 'Invalid email.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            if (!validatePassword(password)) { authError.textContent = 'Password must be 8-100 characters.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            if (!validateName(name)) { authError.textContent = 'Name must be 2-100 characters.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            if (!validateRoles(roles)) { authError.textContent = 'Select at least one role.'; authError.style.display = 'block'; authSubmitBtn.disabled = false; return; }
            try {
                const res = await fetch(getApiUrl('/api/register'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name, roles })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Registration failed');
                authSuccess.textContent = 'Registration successful! You may now log in.';
                authSuccess.style.display = 'block';
                setTimeout(() => setAuthMode(true), 1200);
            } catch (err) {
                authError.textContent = err.message;
                authError.style.display = 'block';
            } finally {
                authSubmitBtn.disabled = false;
            }
        }
    };
    // Also fetch data if already authenticated on load
    if (isAuthenticated()) fetchDashboardData();
    // --- Sync login/logout state across tabs/pages ---
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken') {
            const token = localStorage.getItem('authToken');
            if (token) {
                showMainContent(true);
                hideAuthModal();
                fetchDashboardData();
            } else {
                showMainContent(false);
                setAuthMode(true);
                showAuthModal();
            }
        }
    });

    // Remove any direct logoutBtn.onclick assignment to avoid conflict with delegated event
    // (This is a no-op, but ensures no direct assignment remains)
    // const logoutBtn = document.getElementById('logoutBtn');
    // if (logoutBtn) logoutBtn.onclick = null;

    // --- CHART RENDERING (robust, with fallback) ---
    function renderWinLossCharts(data) {
        if (!Array.isArray(data)) {
            console.error('[DEBUG] Invalid data format for charts:', data);
            return;
        }

        // Process monthly data
        const allMonthsLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let chartLabels = [];
        let monthIndices = []; // 0-11, stores indices of months to display

        // Build labels based on active quarters
        if (activeQuarters['1']) { chartLabels.push('Jan','Feb','Mar'); monthIndices.push(0,1,2); }
        if (activeQuarters['2']) { chartLabels.push('Apr','May','Jun'); monthIndices.push(3,4,5); }
        if (activeQuarters['3']) { chartLabels.push('Jul','Aug','Sep'); monthIndices.push(6,7,8); }
        if (activeQuarters['4']) { chartLabels.push('Oct','Nov','Dec'); monthIndices.push(9,10,11); }
        
        // If no quarters selected, default to all months
        if (chartLabels.length === 0) {
            chartLabels = allMonthsLabels;
            monthIndices = Array.from({length: 12}, (_, i) => i);
        }

        // Initialize arrays for monthly data
        let winMonthlyAmount = Array(12).fill(0);
        let winMonthlyCount = Array(12).fill(0);
        let lossMonthlyAmount = Array(12).fill(0);
        let lossMonthlyCount = Array(12).fill(0);

        // Process data
        data.forEach(item => {
            const date = robustParseDate(item.date_awarded || item.date_awarded_lost);
            if (date && !isNaN(date)) {
                const month = date.getMonth();
                if (monthIndices.includes(month)) {
                    if (item.opp_status === 'OP100') {
                        winMonthlyAmount[month] += Number(item.final_amt) || 0;
                        winMonthlyCount[month] += 1;
                    } else if (item.opp_status === 'LOST') {
                        lossMonthlyAmount[month] += Number(item.final_amt) || 0;
                        lossMonthlyCount[month] += 1;
                    }
                }
            }
        });

        // Filter data for selected quarters
        const winChartAmounts = monthIndices.map(idx => winMonthlyAmount[idx]);
        const winChartCounts = monthIndices.map(idx => winMonthlyCount[idx]);
        const lossChartAmounts = monthIndices.map(idx => lossMonthlyAmount[idx]);
        const lossChartCounts = monthIndices.map(idx => lossMonthlyCount[idx]);

        // Get computed styles for chart colors
        const rootStyle = getComputedStyle(document.documentElement);
        const colorWin = rootStyle.getPropertyValue('--color-win').trim() || '#16a34a';
        const colorWinBg = rootStyle.getPropertyValue('--color-win-bg').trim() || 'rgba(22, 163, 74, 0.2)';
        const colorWinDark = rootStyle.getPropertyValue('--color-win-dark').trim() || '#15803d';
        const colorLoss = rootStyle.getPropertyValue('--color-loss').trim() || '#dc2626';
        const colorLossBg = rootStyle.getPropertyValue('--color-loss-bg').trim() || 'rgba(220, 38, 38, 0.2)';
        const colorLossDark = rootStyle.getPropertyValue('--color-loss-dark').trim() || '#b91c1c';
        const gridColor = rootStyle.getPropertyValue('--chart-grid-color').trim() || '#e5e7eb';
        const tickColor = rootStyle.getPropertyValue('--chart-tick-color').trim() || '#6b7280';
        const titleColor = rootStyle.getPropertyValue('--chart-title-color').trim() || '#111827';
        const legendColor = rootStyle.getPropertyValue('--chart-legend-color').trim() || '#374151';
        const tooltipBgColor = rootStyle.getPropertyValue('--chart-tooltip-bg').trim() || '#ffffff';
        const tooltipTextColor = rootStyle.getPropertyValue('--chart-tooltip-text').trim() || '#111827';

        // Set chart container heights
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            container.style.height = '500px';
        });

        const winCanvas = document.getElementById('winMonthlyChart');
        const lossCanvas = document.getElementById('lossMonthlyChart');

        if (winCanvas && lossCanvas) {
            // Helper function to get a nice round maximum value
            function getNiceMaxValue(maxValue) {
                // If value is 0, return a default scale
                if (maxValue === 0) return 10;
                
                // Find the magnitude (10^n) just above the max value
                const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
                const normalized = maxValue / magnitude;  // Between 1 and 10
                
                // Choose a nice round number just above the normalized value
                let niceNormalized;
                if (normalized <= 1.5) niceNormalized = 1.5;
                else if (normalized <= 2) niceNormalized = 2;
                else if (normalized <= 2.5) niceNormalized = 2.5;
                else if (normalized <= 3) niceNormalized = 3;
                else if (normalized <= 4) niceNormalized = 4;
                else if (normalized <= 5) niceNormalized = 5;
                else if (normalized <= 6) niceNormalized = 6;
                else if (normalized <= 8) niceNormalized = 8;
                else niceNormalized = 10;
                
                return niceNormalized * magnitude;
            }

            // Get the maximum amount from both win and loss data to set consistent scale
            const maxWinAmount = Math.max(...winChartAmounts);
            const maxLossAmount = Math.max(...lossChartAmounts);
            const maxAmount = Math.max(maxWinAmount, maxLossAmount);
            const niceMaxAmount = getNiceMaxValue(maxAmount);
            
            // Get the maximum count and make it a nice round number
            const maxWinCount = Math.max(...winChartCounts);
            const maxLossCount = Math.max(...lossChartCounts);
            const maxCount = Math.max(maxWinCount, maxLossCount);
            const niceMaxCount = getNiceMaxValue(maxCount);

            // Common options with synchronized scales
            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: legendColor,
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBgColor,
                        titleColor: tooltipTextColor,
                        bodyColor: tooltipTextColor,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.yAxisID === 'y') {
                                    return `Amount: ${abbreviateAmount(context.raw)}`;
                                }
                                return `Count: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    },
                    y: {
                        position: 'left',
                        grid: { color: gridColor },
                        min: 0,
                        max: niceMaxAmount,
                        ticks: {
                            color: tickColor,
                            callback: function(value) {
                                return abbreviateAmount(value);
                            }
                        }
                    },
                    y1: {
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                            color: gridColor
                        },
                        min: 0,
                        max: niceMaxCount,
                        ticks: {
                            color: tickColor,
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            };

            // Helper function to abbreviate amounts
            function abbreviateAmount(value) {
                const absValue = Math.abs(value);
                if (absValue >= 1e6) {
                    return '₱' + (value / 1e6).toFixed(1) + 'M';
                }
                if (absValue >= 1e3) {
                    return '₱' + (value / 1e3).toFixed(1) + 'K';
                }
                return '₱' + value.toFixed(2);
            }

            // Win Chart Configuration
            const winConfig = {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [
                        {
                            label: 'Win Amount',
                            data: winChartAmounts,
                            backgroundColor: colorWinBg,
                            borderColor: colorWin,
                            borderWidth: 1,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Win Count',
                            data: winChartCounts,
                            type: 'line',
                            borderColor: colorWinDark,
                            borderWidth: 2,
                            pointBackgroundColor: colorWinDark,
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: commonOptions
            };

            // Loss Chart Configuration
            const lossConfig = {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [
                        {
                            label: 'Loss Amount',
                            data: lossChartAmounts,
                            backgroundColor: colorLossBg,
                            borderColor: colorLoss,
                            borderWidth: 1,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Loss Count',
                            data: lossChartCounts,
                            type: 'line',
                            borderColor: colorLossDark,
                            borderWidth: 2,
                            pointBackgroundColor: colorLossDark,
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: commonOptions
            };

            // Create the charts
            if (window.winChart) window.winChart.destroy();
            if (window.lossChart) window.lossChart.destroy();

            window.winChart = new Chart(winCanvas, winConfig);
            window.lossChart = new Chart(lossCanvas, lossConfig);
        }
    }

    // --- TABLE SORTING (fix: use correct keys and types) ---
    document.querySelectorAll('#opportunitiesTable th').forEach((th, idx) => {
        th.style.cursor = 'pointer';
        th.onclick = function() {
            const key = tableHeaders[idx].key;
            if (!key) return;
            if (currentSort.col === key) currentSort.dir *= -1;
            else { currentSort.col = key; currentSort.dir = 1; }
            renderOpportunitiesTable(dashboardDataCache);
            // Visual indicator
            document.querySelectorAll('#opportunitiesTable th').forEach((h, i) => {
                h.classList.toggle('sorted', i === idx);
                h.setAttribute('data-sort-dir', (i === idx) ? (currentSort.dir === 1 ? 'asc' : 'desc') : '');
            });
        };
    });

    // --- Table filter logic (match earlier design) ---
    function formatCurrency(num) {
        const number = Number(num);
        if (isNaN(number)) return '₱0.00';
        return '₱' + number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatMargin(value) {
        if (typeof value === 'string' && value.includes('%')) {
            return value;
        }
        const num = parseFloat(value);
        if (isNaN(num)) {
            return value || '';
        }
        if (num !== 0 && Math.abs(num) < 1) {
            return Math.round(num * 100) + '%';
        }
        return Math.round(num) + '%';
    }

    function formatDateAwardedMDY(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d)) return dateString;
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function renderOpportunitiesTable(opportunities) {
        const tableBody = document.getElementById('opportunitiesTableBody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        let filtered = getFilteredTableData(opportunities);
        
        // --- Table Sorting ---
        if (currentSort.col) {
            filtered = filtered.slice().sort((a, b) => {
                let v1, v2;
                switch (currentSort.col) {
                    case 'project_name':
                        v1 = (a['opp_name'] || a['project_name'] || '').toLowerCase();
                        v2 = (b['opp_name'] || b['project_name'] || '').toLowerCase();
                        break;
                    case 'client':
                        v1 = (a['client'] || '').toLowerCase();
                        v2 = (b['client'] || '').toLowerCase();
                        break;
                    case 'account_mgr':
                        v1 = (a['account_mgr'] || '').toLowerCase();
                        v2 = (b['account_mgr'] || '').toLowerCase();
                        break;
                    case 'date_awarded':
                        v1 = a['date_awarded_lost'] ? new Date(a['date_awarded_lost']) : new Date(0);
                        v2 = b['date_awarded_lost'] ? new Date(b['date_awarded_lost']) : new Date(0);
                        break;
                    case 'final_amt':
                        v1 = Number(a['final_amt']) || 0;
                        v2 = Number(b['final_amt']) || 0;
                        break;
                    case 'margin':
                        v1 = parseFloat(a['margin_percentage'] || a['margin'] || 0) || 0;
                        v2 = parseFloat(b['margin_percentage'] || b['margin'] || 0) || 0;
                        break;
                    default:
                        v1 = (a[currentSort.col] || '').toString().toLowerCase();
                        v2 = (b[currentSort.col] || '').toString().toLowerCase();
                }
                if (v1 < v2) return -1 * currentSort.dir;
                if (v1 > v2) return 1 * currentSort.dir;
                return 0;
            });
        }
        filtered.forEach((opp) => {
            const tr = document.createElement('tr');
            const projectName = opp['opp_name'] || opp['project_name'] || '';
            const client = opp['client'] || '';
            const acctMgr = opp['account_mgr'] || '';
            let dateAwarded = '';
            if (opp['date_awarded_lost']) {
                dateAwarded = formatDateAwardedMDY(opp['date_awarded_lost']);
            }
            const finalAmtValue = opp['final_amt'] || '';
            const marginValue = opp['margin_percentage'] || opp['margin'] || '';

            // Add status-based classes
            const status = (opp['opp_status'] || '').toUpperCase();
            if (status === 'OP100') {
                tr.classList.add('bg-op100');
            } else if (status === 'LOST') {
                tr.classList.add('bg-lost');
            }

            tr.innerHTML = `
                <td class="project-name-cell px-3 py-2 whitespace-normal text-sm">${projectName}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">${client}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">${acctMgr}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">${dateAwarded}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-right">${formatCurrency(finalAmtValue)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-right">${formatMargin(marginValue)}</td>
            `;

            tableBody.appendChild(tr);
        });
    }

    // --- Dropdown population for chart filters ---
    function populateDropdowns(data) {
        // Solution
        const solutionDropdown = document.getElementById('solutionFilter');
        if (solutionDropdown) {
            const solutions = Array.from(new Set(data.map(opp => opp['solutions']).filter(Boolean)));
            solutionDropdown.innerHTML = '<option value="all">All</option>';
            solutions.forEach(sol => {
                const opt = document.createElement('option');
                opt.value = sol;
                opt.textContent = sol;
                solutionDropdown.appendChild(opt);
            });
            solutionDropdown.value = currentSolutionFilter;
            solutionDropdown.onchange = function() {
                currentSolutionFilter = this.value;
                renderDashboard(dashboardDataCache);
            };
        }
        // Account Manager
        const mgrDropdown = document.getElementById('accountMgrFilter');
        if (mgrDropdown) {
            const mgrs = Array.from(new Set(data.map(opp => opp['account_mgr']).filter(Boolean)));
            mgrDropdown.innerHTML = '<option value="all">All</option>';
            mgrs.forEach(mgr => {
                const opt = document.createElement('option');
                opt.value = mgr;
                opt.textContent = mgr;
                mgrDropdown.appendChild(opt);
            });
            mgrDropdown.value = currentAccountMgrFilter;
            mgrDropdown.onchange = function() {
                currentAccountMgrFilter = this.value;
                renderDashboard(dashboardDataCache);
            };
        }
        // Client
        const clientDropdown = document.getElementById('clientFilter');
        if (clientDropdown) {
            const clients = Array.from(new Set(data.map(opp => opp['client']).filter(Boolean)));
            clientDropdown.innerHTML = '<option value="all">All</option>';
            clients.forEach(client => {
                const opt = document.createElement('option');
                opt.value = client;
                opt.textContent = client;
                clientDropdown.appendChild(opt);
            });
            clientDropdown.value = currentClientFilter;
            clientDropdown.onchange = function() {
                currentClientFilter = this.value;
                renderDashboard(dashboardDataCache);
            };
        }
    }

    // --- Table filter buttons (OP100/LOST/All) ---
    function setTableFilterActive(activeId) {
        ['filterOP100Btn','filterLOSTBtn'/*,'filterAllBtn'*/].forEach(id => { // Removed filterAllBtn
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', id === activeId);
        });
    }
    function setupTableFilterButtons() {
        const op100Btn = document.getElementById('filterOP100Btn');
        const lostBtn = document.getElementById('filterLOSTBtn');
        // const allBtn = document.getElementById('filterAllBtn'); // Removed allBtn

        if (op100Btn) op100Btn.onclick = function() {
            currentTableStatusFilter = 'OP100';
            setTableFilterActive('filterOP100Btn');
            renderOpportunitiesTable(dashboardDataCache);
        };
        if (lostBtn) lostBtn.onclick = function() {
            currentTableStatusFilter = 'LOST';
            setTableFilterActive('filterLOSTBtn');
            renderOpportunitiesTable(dashboardDataCache);
        };
        // if (allBtn) allBtn.onclick = function() { // Removed allBtn logic
        //     currentTableStatusFilter = 'all';
        //     setTableFilterActive('filterAllBtn');
        //     renderOpportunitiesTable(dashboardDataCache);
        // };
        // Set initial state (OP100 is default)
        setTableFilterActive('filterOP100Btn');
    }

    // --- Quarter Filter Buttons --- 
    function updateQuarterButtonStates() {
        document.querySelectorAll('#quarterFilterButtons .quarter-filter-btn').forEach(btn => {
            const quarter = btn.dataset.quarter;
            if (activeQuarters[quarter]) {
                btn.style.opacity = '1';
                btn.classList.add('active'); // Use active class for styling if desired, or just opacity
            } else {
                btn.style.opacity = '0.5';
                btn.classList.remove('active');
            }
        });
    }

    function setupQuarterFilterButtons() {
        const quarterButtons = document.querySelectorAll('#quarterFilterButtons .quarter-filter-btn');
        
        // Set initial states based on activeQuarters
        quarterButtons.forEach(button => {
            const quarter = button.dataset.quarter;
            // Set initial opacity based on activeQuarters
            button.style.opacity = activeQuarters[quarter] ? '1' : '0.5';
            button.classList.toggle('active', activeQuarters[quarter]);
            
            button.addEventListener('click', function() {
                const quarter = this.dataset.quarter;
                activeQuarters[quarter] = !activeQuarters[quarter]; // Toggle the state
                updateQuarterButtonStates();
                renderDashboard(dashboardDataCache); // Re-render dashboard with new quarter filter
            });
        });
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }
    // Hide Change Password button if not authenticated
    function updateChangePasswordBtnVisibility() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            if (changePasswordBtn) changePasswordBtn.style.display = 'none';
        } else {
            if (changePasswordBtn) changePasswordBtn.style.display = '';
        }
    }
    updateChangePasswordBtnVisibility();
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'authEvent') {
            updateChangePasswordBtnVisibility();
        }
    });
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
// ...existing code...

