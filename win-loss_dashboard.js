// win-loss_dashboard.js - All logic moved from inline <script> in win-loss_dashboard.html

// --- Global Variables ---
let dashboardDataCache = null; // Cache fetched data (includes ALL opportunities)
let winChartInstance = null;   // Instance for the Wins chart
let lossChartInstance = null;  // Instance for the Losses chart
let currentSolutionFilter = 'all'; // State for the solution filter
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
        return filtered;
    }

    // Table data: filtered only by OP100/LOST/All
    function getFilteredTableData(opportunities) {
        let filtered = opportunities;
        if (currentTableStatusFilter === 'OP100') {
            filtered = filtered.filter(opp => (opp['opp_status']||'').toUpperCase() === 'OP100');
        } else if (currentTableStatusFilter === 'LOST') {
            filtered = filtered.filter(opp => (opp['opp_status']||'').toUpperCase() === 'LOST');
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
        renderWinLossCharts(chartData);
        // 2. Render table using table filter only
        renderOpportunitiesTable(data);
    }

    // --- DASHBOARD DATA FETCH (with debug) ---
    async function fetchDashboardData() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('Not authenticated');
            const res = await fetch('/api/opportunities', {
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
                const res = await fetch('/api/login', {
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
                const res = await fetch('/api/register', {
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
        const winCanvas = document.getElementById('winMonthlyChart');
        const lossCanvas = document.getElementById('lossMonthlyChart');
        // --- Wins Chart ---
        let winDataFound = false;
        let winMonthlyAmount = Array(12).fill(0);
        let winMonthlyCount = Array(12).fill(0);
        data.forEach(item => {
            if (item.opp_status === 'OP100' && item.date_awarded) {
                const date = robustParseDate(item.date_awarded);
                if (date && !isNaN(date)) {
                    const month = date.getMonth();
                    winMonthlyAmount[month] += Number(item.final_amt) || 0;
                    winMonthlyCount[month] += 1;
                    winDataFound = true;
                }
            }
        });
        if (winChartInstance) winChartInstance.destroy();
        if (winCanvas) {
            if (winDataFound) {
                winChartInstance = new Chart(winCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                        datasets: [
                            { label: 'OP100 Amount', data: winMonthlyAmount, backgroundColor: '#10b981', borderColor: '#059669', borderWidth: 1, yAxisID: 'yAmount', type: 'bar', order: 2 },
                            { label: 'OP100 Count', data: winMonthlyCount, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 2, fill: true, tension: 0.1, yAxisID: 'yCount', type: 'line', order: 1, pointRadius: 4, pointHoverRadius: 6 }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            yAmount: { beginAtZero: true, position: 'left', ticks: { callback: v => '₱' + v.toLocaleString() } },
                            yCount: { beginAtZero: true, position: 'right', ticks: { stepSize: 1, precision: 0, callback: v => Number.isInteger(v) ? v : '' }, grid: { drawOnChartArea: false } }
                        }
                    }
                });
            } else {
                // Clear chart and draw message on canvas
                const ctx = winCanvas.getContext('2d');
                ctx.clearRect(0, 0, winCanvas.width, winCanvas.height);
                ctx.save();
                ctx.font = '18px sans-serif';
                ctx.fillStyle = '#dc2626';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('No OP100 chart data available.', winCanvas.width/2, winCanvas.height/2);
                ctx.restore();
            }
        }
        // --- Losses Chart ---
        let lossDataFound = false;
        let lossMonthlyAmount = Array(12).fill(0);
        let lossMonthlyCount = Array(12).fill(0);
        data.forEach(item => {
            if (item.opp_status === 'LOST' && item.date_awarded) {
                const date = robustParseDate(item.date_awarded);
                if (date && !isNaN(date)) {
                    const month = date.getMonth();
                    lossMonthlyAmount[month] += Number(item.final_amt) || 0;
                    lossMonthlyCount[month] += 1;
                    lossDataFound = true;
                }
            }
        });
        if (lossChartInstance) lossChartInstance.destroy();
        if (lossCanvas) {
            if (lossDataFound) {
                lossChartInstance = new Chart(lossCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                        datasets: [
                            { label: 'Lost Amount', data: lossMonthlyAmount, backgroundColor: '#ef4444', borderColor: '#b91c1c', borderWidth: 1, yAxisID: 'yAmount', type: 'bar', order: 2 },
                            { label: 'Lost Count', data: lossMonthlyCount, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 2, fill: true, tension: 0.1, yAxisID: 'yCount', type: 'line', order: 1, pointRadius: 4, pointHoverRadius: 6 }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            yAmount: { beginAtZero: true, position: 'left', ticks: { callback: v => '₱' + v.toLocaleString() } },
                            yCount: { beginAtZero: true, position: 'right', ticks: { stepSize: 1, precision: 0, callback: v => Number.isInteger(v) ? v : '' }, grid: { drawOnChartArea: false } }
                        }
                    }
                });
            } else {
                // Clear chart and draw message on canvas
                const ctx = lossCanvas.getContext('2d');
                ctx.clearRect(0, 0, lossCanvas.width, lossCanvas.height);
                ctx.save();
                ctx.font = '18px sans-serif';
                ctx.fillStyle = '#dc2626';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('No LOST chart data available.', lossCanvas.width/2, lossCanvas.height/2);
                ctx.restore();
            }
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
            tr.innerHTML = `
                <td class="project-name-cell px-4 py-2 whitespace-normal text-sm text-gray-900 dark:text-gray-100">${projectName}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${client}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${acctMgr}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${dateAwarded}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">${formatCurrency(finalAmtValue)}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">${formatMargin(marginValue)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
    // --- Table header click: sorting ---
    document.querySelectorAll('#opportunitiesTable th').forEach((th, idx) => {
        th.style.cursor = 'pointer';
        th.onclick = function() {
            const key = tableHeaders[idx].key;
            if (!key) return;
            if (currentSort.col === key) currentSort.dir *= -1;
            else { currentSort.col = key; currentSort.dir = 1; }
            renderOpportunitiesTable(dashboardDataCache);
            document.querySelectorAll('#opportunitiesTable th').forEach((h, i) => {
                h.classList.toggle('sorted', i === idx);
                h.setAttribute('data-sort-dir', (i === idx) ? (currentSort.dir === 1 ? 'asc' : 'desc') : '');
            });
        };
    });

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
        ['filterOP100Btn','filterLOSTBtn','filterAllBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', id === activeId);
        });
    }
    function setupTableFilterButtons() {
        const opBtn = document.getElementById('filterOP100Btn');
        const lostBtn = document.getElementById('filterLOSTBtn');
        const allBtn = document.getElementById('filterAllBtn');
        if (opBtn) opBtn.onclick = function() {
            currentTableStatusFilter = 'OP100';
            setTableFilterActive('filterOP100Btn');
            renderOpportunitiesTable(dashboardDataCache);
        };
        if (lostBtn) lostBtn.onclick = function() {
            currentTableStatusFilter = 'LOST';
            setTableFilterActive('filterLOSTBtn');
            renderOpportunitiesTable(dashboardDataCache);
        };
        if (allBtn) allBtn.onclick = function() {
            currentTableStatusFilter = 'all';
            setTableFilterActive('filterAllBtn');
            renderOpportunitiesTable(dashboardDataCache);
        };
    }
});
