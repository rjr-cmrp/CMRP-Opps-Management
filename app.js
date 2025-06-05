// --- API Configuration ---
function getApiUrl(endpoint) {
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || '';
    return `${baseUrl}${endpoint}`;
}

// --- Global Variables ---
let opportunities = [];
let headers = [];
let headerIndices = {};
let particularsIndices = [];
let currentSortColumnIndex = -1;
let currentSortDirection = 'asc';
let isLoginMode = true;
let isCreateMode = false;
let currentEditRowIndex = -1;
let showACRUD = false;
let columnVisibility = {}; // Add missing global variable for column visibility

// --- DOM Elements ---
let htmlElement;
let themeToggle;
let table;
let tableHead;
let tableBody;
let loadingText;
let searchInput;
let statusFilterButtonsContainer;
let accountMgrFilterDropdown;
let picFilterDropdown;
let createOpportunityButton;
let exportExcelButton;
let toggleColumnsButton;
let columnToggleContainer;
let authModalOverlay;
let authModal;
let authForm;
let authEmail;
let authPassword;
let authError;
let authSuccess;
let authSubmitBtn;
let switchAuthMode;
let logoutBtn;
let totalOpportunities;
let totalSubmitted;
let op100Summary;
let op90Summary;
let totalDeclined;
let totalInactive;
let lostSummary;
let declinedSummary;

// --- Constants ---
const DROPDOWN_FIELDS = ['solutions', 'sol_particulars', 'industries', 'ind_particulars', 'decision', 'account_mgr', 'pic', 'bom', 'status', 'opp_status', 'lost_rca', 'l_particulars', 'a', 'c', 'r', 'u', 'd'];
const DROPDOWN_FIELDS_NORM = DROPDOWN_FIELDS.map(field => field.toLowerCase().replace(/[^a-z0-9]/g, ''));
const encodedDateHeaders = ['encodeddate'];
const withDayHeaders = ['datereceived', 'clientdeadline', 'submitteddate', 'dateawardedlost', 'forecastdate'];
const rightAlignColumns = ['finalamt'];
let dropdownOptions = {};

// --- Utility Functions ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function normalizeField(field) {
    if (!field) return '';
    return field.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDateField(header) {
    const norm = normalizeField(header || '');
    return encodedDateHeaders.includes(norm) || withDayHeaders.includes(norm) || norm === 'forecastdate';
}

function isCurrencyField(header) {
    return normalizeField(header || '').includes('amt');
}

function isMarginField(header) {
    return normalizeField(header || '').includes('margin');
}

function parseDateString(dateString) {
    if (!dateString) return null;
    dateString = String(dateString).trim();
    if (!dateString) return null;

    // Try parsing as ISO date first
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;

    // Try parsing common formats
    const formats = [
        'MM/DD/YYYY',
        'MM-DD-YYYY',
        'YYYY/MM/DD',
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'DD-MM-YYYY',
        'MMM DD, YYYY',
        'MMMM DD, YYYY',
        'DD MMM YYYY',
        'DD MMMM YYYY'
    ];

    for (let format of formats) {
        try {
            const momentDate = moment(dateString, format);
            if (momentDate.isValid()) return momentDate.toDate();
        } catch (e) {
            continue;
        }
    }

    // If all else fails, try to extract numbers and make best guess
    const numbers = dateString.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
        const [n1, n2, n3] = numbers.map(n => parseInt(n));
        // Assume American format (MM/DD/YYYY) if month and day are ambiguous
        if (n1 <= 12 && n2 <= 31) {
            return new Date(n3 >= 100 ? n3 : 2000 + n3, n1 - 1, n2);
        }
    }

    console.warn(`Could not parse date string: ${dateString}`);
    return null;
}

function parseCurrency(currencyString) {
    if (!currencyString) return 0;
    if (typeof currencyString === 'number') return currencyString;
    
    // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
    const numStr = String(currencyString).replace(/[^0-9.-]/g, '');
    const value = parseFloat(numStr);
    return isNaN(value) ? 0 : value;
}

function formatDate(dateString) { // Target format: Jan-01
    try {
        let date = parseDateString(dateString);
        if (!date) return dateString;
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date (formatDate):", dateString, e);
        return dateString;
    }
}

function formatDateWithDay(dateString) { // Target format: Mon, Jan-01
    try {
        let date = parseDateString(dateString);
        if (!date) return dateString;
        const day = date.toLocaleString('en-US', { weekday: 'short' });
        const month = date.toLocaleString('en-US', { month: 'short' });
        const dayNum = String(date.getDate()).padStart(2, '0');
        return `${day}, ${month}-${dayNum}`;
    } catch (e) {
        console.error("Error formatting date (formatDateWithDay):", dateString, e);
        return dateString;
    }
}

function formatMargin(marginValue) {
    if (!marginValue && marginValue !== 0) return '';
    if (typeof marginValue === 'string') {
        if (marginValue.includes('%')) return marginValue;
        marginValue = parseFloat(marginValue);
    }
    if (isNaN(marginValue)) return '';
    return Math.round(marginValue) + '%';
}

function formatCurrency(amountValue) {
    if (!amountValue && amountValue !== 0) return '';
    const amount = parseCurrency(amountValue);
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatCellValue(value, header) {
    if (value === null || value === undefined) return '';
    
    const normHeader = normalizeField(header);
    
    if (encodedDateHeaders.includes(normHeader)) {
        return formatDate(value);
    }
    
    if (withDayHeaders.includes(normHeader)) {
        return formatDateWithDay(value);
    }
    
    if (isCurrencyField(normHeader)) {
        return formatCurrency(value);
    }
    
    if (isMarginField(normHeader)) {
        return formatMargin(value);
    }
    
    return value;
}

function formatHeaderText(header) {
    if (!header) return '';
    
    // Split on camelCase
    let text = header.replace(/([A-Z])/g, ' $1');
    
    // Split on underscores and remove them
    text = text.replace(/_/g, ' ');
    
    // Capitalize first letter of each word
    text = text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    // Handle special cases
    text = text.replace(/Amt/g, 'Amount')
        .replace(/Mgr/g, 'Manager')
        .replace(/Pic/g, 'PIC')
        .replace(/Op/g, 'OP')
        .replace(/Uid/g, 'ID')
        .replace(/Id/g, 'ID')
        .replace(/Rca/g, 'RCA');
    
    return text.trim();
}

// --- Initialize App ---
async function initializeApp() {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('No authentication token found');
        }

        // Show loading state
        loadingText.style.display = 'block';

        // Fetch opportunities data
        const response = await fetch(getApiUrl('/api/opportunities'), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch opportunities');
        }

        opportunities = await response.json();
        
        // Initialize the table with the data
        await initializeTable();
        
        // Load dashboard data
        loadDashboardData();
        
        // Update user management nav visibility
        updateUserMgmtNavVisibility();
        
        // Update change password button visibility
        updateChangePasswordBtnVisibility();
        
        // Hide loading state
        loadingText.style.display = 'none';
        
        // Initialize dashboard comparison toggles
        initializeDashboardToggles();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showAuthErrorBanner(error.message);
        handleLogout();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    htmlElement = document.documentElement;
    themeToggle = document.getElementById('themeToggle');
    table = document.getElementById('opportunitiesTable');
    tableHead = table.querySelector('thead');
    tableBody = table.querySelector('tbody');
    loadingText = document.getElementById('loadingText');
    searchInput = document.getElementById('searchInput');
    statusFilterButtonsContainer = document.getElementById('statusFilterButtons');
    accountMgrFilterDropdown = document.getElementById('accountMgrFilter');
    picFilterDropdown = document.getElementById('picFilter');
    createOpportunityButton = document.getElementById('createOpportunityButton');
    exportExcelButton = document.getElementById('exportExcelButton');
    toggleColumnsButton = document.getElementById('toggleColumnsButton');
    columnToggleContainer = document.getElementById('columnToggleContainer');
    authModalOverlay = document.getElementById('authModalOverlay');
    authModal = document.getElementById('authModal');
    authForm = document.getElementById('authForm');
    authEmail = document.getElementById('authEmail');
    authPassword = document.getElementById('authPassword');
    authError = document.getElementById('authError');
    authSuccess = document.getElementById('authSuccess');
    authSubmitBtn = document.getElementById('authSubmitBtn');
    switchAuthMode = document.getElementById('switchAuthMode');
    logoutBtn = document.getElementById('logoutBtn');
    totalOpportunities = document.getElementById('totalOpportunities');
    totalSubmitted = document.getElementById('totalSubmitted');
    op100Summary = document.getElementById('op100Summary');
    op90Summary = document.getElementById('op90Summary');
    totalDeclined = document.getElementById('totalDeclined');
    totalInactive = document.getElementById('totalInactive');
    lostSummary = document.getElementById('lostSummary');
    declinedSummary = document.getElementById('declinedSummary');

    // Initialize theme
    initializeTheme();

    // Check authentication status
    const token = getAuthToken();
    if (!token) {
        document.querySelector('.main-content').style.display = 'none';
        authModalOverlay.style.display = 'block';
        authModal.style.display = 'block';
    } else {
        document.querySelector('.main-content').style.display = 'block';
        authModalOverlay.style.display = 'none';
        authModal.style.display = 'none';
        initializeApp();
    }

    // Initialize change password button visibility
    updateChangePasswordBtnVisibility();

    // Initialize event listeners
    initializeEventListeners();
});

function initializeEventListeners() {
    // Theme toggle
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Auth form submission
    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

    // Switch auth mode
    if (switchAuthMode) switchAuthMode.addEventListener('click', () => setAuthMode(!isLoginMode));

    // Close auth modal on overlay click
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', (e) => {
            if (e.target === authModalOverlay) {
                hideAuthModal();
            }
        });
    }
    
    // Prevent modal from closing when clicking inside the modal
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Logout button
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterAndSortData();
        }, 300));
    }

    // Status filter buttons
    if (statusFilterButtonsContainer) {
        statusFilterButtonsContainer.addEventListener('click', function(e) {
            if (e.target.matches('button.filter-button')) {
                // Remove active class from all buttons first
                statusFilterButtonsContainer.querySelectorAll('.filter-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Add active class to clicked button
                e.target.classList.add('active');
                filterAndSortData();
            }
        });
    }

    // Account Manager and PIC filters
    if (accountMgrFilterDropdown) accountMgrFilterDropdown.addEventListener('change', filterAndSortData);
    if (picFilterDropdown) picFilterDropdown.addEventListener('change', filterAndSortData);

    // Create opportunity button
    if (createOpportunityButton) {
        createOpportunityButton.addEventListener('click', showCreateOpportunityModal);
    }

    // Export to Excel button
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', function() {
            const wb = XLSX.utils.table_to_book(opportunitiesTable, {sheet: "Opportunities"});
            XLSX.writeFile(wb, "opportunities.xlsx");
        });
    }

    // Toggle columns button
    if (toggleColumnsButton) {
        toggleColumnsButton.addEventListener('click', () => {
            columnToggleContainer.classList.toggle('hidden');
        });
    }

    // Storage event listener (for multi-tab support)
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken') {
            if (!e.newValue) {
                showMainContent(false);
                setAuthMode(true);
                showAuthModal();
            } else {
                showMainContent(true);
                hideAuthModal();
            }
            // Update change password button visibility when auth token changes
            updateChangePasswordBtnVisibility();
        }
    });

    // Wire up the Clear Filter button
    const clearFilterButton = document.getElementById('clearFilterButton');
    if (clearFilterButton) {
        clearFilterButton.addEventListener('click', resetTable);
    }

    // Edit modal events
    document.getElementById('editRowModalCloseX').addEventListener('click', hideEditRowModal);
    document.getElementById('closeEditRowModalButton').addEventListener('click', hideEditRowModal);
    document.getElementById('editRowForm').addEventListener('submit', handleEditFormSubmit);

    // Revision history modal events
    document.getElementById('closeRevisionHistoryButton').addEventListener('click', hideRevisionHistoryModal);

    // Handle ESC key for edit modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideEditRowModal();
        }
    });

    // Handle click outside modal for edit modal
    document.getElementById('editRowModalOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            hideEditRowModal();
        }
    });

    // Create Opportunity modal events
    var createOpportunityButton = document.getElementById('createOpportunityButton');
    var createOpportunityModal = document.getElementById('createOpportunityModal');
    var createOpportunityModalOverlay = document.getElementById('createOpportunityModalOverlay');
    var closeCreateOpportunityModalButton = document.getElementById('closeCreateOpportunityModalButton');
    var createOpportunityModalCloseX = document.getElementById('createOpportunityModalCloseX');
    var createOpportunityForm = document.getElementById('createOpportunityForm');

    if (createOpportunityButton && createOpportunityModal && createOpportunityModalOverlay) {
        createOpportunityButton.addEventListener('click', function() {
            // Call our function to dynamically create the form with proper dropdowns
            showCreateOpportunityModal();
        });
    }
    function closeCreateModal() {
        createOpportunityModal.classList.add('hidden');
        createOpportunityModalOverlay.classList.add('hidden');
        // Clear form content completely, don't just reset values
        if (createOpportunityForm) createOpportunityForm.innerHTML = '';
    }
    if (closeCreateOpportunityModalButton) {
        closeCreateOpportunityModalButton.addEventListener('click', closeCreateModal);
    }
    if (createOpportunityModalCloseX) {
        createOpportunityModalCloseX.addEventListener('click', closeCreateModal);
    }
    if (createOpportunityModalOverlay) {
        createOpportunityModalOverlay.addEventListener('click', function(e) {
            if (e.target === createOpportunityModalOverlay) closeCreateModal();
        });
    }
    // Optionally: ESC key closes modal
    document.addEventListener('keydown', function(e) {
        if (!createOpportunityModal.classList.contains('hidden') && e.key === 'Escape') {
            closeCreateModal();
        }
    });
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
    authSubmitBtn.disabled = true;
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!validateEmail(email)) {
        authError.textContent = 'Invalid email format.';
        authError.style.display = 'block';
        authSubmitBtn.disabled = false;
        return;
    }
    
    if (!validatePassword(password)) {
        authError.textContent = 'Password must be 8-100 characters.';
        authError.style.display = 'block';
        authSubmitBtn.disabled = false;
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
        updateUserMgmtNavVisibility();
        updateChangePasswordBtnVisibility();
        showMainContent(true);
        hideAuthModal();
        await initializeApp();
    } catch (err) {
        authError.textContent = err.message;
        authError.style.display = 'block';
    } finally {
        authSubmitBtn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    showMainContent(false);
    setAuthMode(true);
    showAuthModal();
}

// --- Theme Management ---
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        const logo = document.getElementById('cmrpLogo');
        if (logo) {
            logo.src = savedTheme === 'dark' ? 'Logo/CMRP Logo Light.svg' : 'Logo/CMRP Logo Dark.svg';
        }
    }
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    htmlElement.classList.toggle('dark', isDark);
}

function toggleTheme() {
    const currentTheme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- Auth Modal Logic ---
function showAuthModal() {
    authModalOverlay.style.display = 'block';
    authModal.style.display = 'block';
}

function hideAuthModal() {
    try {
        if (authModalOverlay) authModalOverlay.style.display = 'none';
        if (authModal) authModal.style.display = 'none';
        if (authError) authError.style.display = 'none';
        if (authSuccess) authSuccess.style.display = 'none';
        if (authForm) authForm.reset();
    } catch (error) {
        console.error('Error hiding auth modal:', error);
    }
}

function setAuthMode(login) {
    isLoginMode = login;
    document.getElementById('authModalTitle').textContent = login ? 'Login' : 'Register';
    authSubmitBtn.textContent = login ? 'Login' : 'Register';
    document.getElementById('registerFields').style.display = login ? 'none' : 'block';
    switchAuthMode.textContent = login ? "Don't have an account? Register" : "Already have an account? Login";
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
    authForm.reset();
}

function hideRemarksModal() {
    const overlay = document.getElementById('remarksModalOverlay');
    const modal = document.getElementById('remarksModal');
    
    if (overlay) {
        overlay.classList.add('hidden');
        // Remove any event listeners that might be attached
        overlay.replaceWith(overlay.cloneNode(true));
    }
    if (modal) {
        modal.classList.add('hidden');
    }
}

function hideRevisionHistoryModal() {
    const overlay = document.getElementById('revisionHistoryModalOverlay');
    const modal = document.getElementById('revisionHistoryModal');
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
}

function hideEditRowModal() {
    const overlay = document.getElementById('editRowModalOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function showEditRowModal(rowIndex, isDuplicate = false) {
    const overlay = document.getElementById('editRowModalOverlay');
    const modal = document.getElementById('editRowModal');
    const form = document.getElementById('editRowForm');
    
    if (!overlay || !modal || !form) {
        console.error('Edit row modal elements not found');
        return;
    }

    // Update dropdown options before showing the modal
    dropdownOptions = getDropdownOptions(headers, opportunities);

    // Set mode variables
    isCreateMode = isDuplicate;
    currentEditRowIndex = isDuplicate ? -1 : rowIndex;
    
    // Get the current row data
    const rowData = opportunities[rowIndex];
    if (!rowData) {
        console.error('No data found for row index:', rowIndex);
        return;
    }
    
    // Store original values for change detection
    window.originalFormValues = {};
    
    // Clear and populate the form
    form.innerHTML = '';
    
    console.log('[DEBUG] Available headers:', headers);
    console.log('[DEBUG] Creating edit form for row:', rowData);
    
    // Create form fields for each editable column
    const editableFields = [
        'project_name', 'rev', 'client', 'solutions', 'sol_particulars', 'industries', 'ind_particulars',
        'date_received', 'client_deadline', 'decision',
        'account_mgr', 'pic', 'bom', 'status', 'submitted_date',
        'margin', 'final_amt', 'opp_status', 'date_awarded_lost',
        'a', 'c', 'r', 'u', 'd',
        'remarks_comments', 'forecast_date'
    ];
    
    editableFields.forEach(field => {
        const headerExists = headers.includes(field);
        const normalizedField = normalizeField(field);
        const normalizedHeaderExists = headers.some(h => normalizeField(h) === normalizedField);
        
        console.log(`[DEBUG] Checking field "${field}" (normalized: "${normalizedField}"): headerExists=${headerExists}, normalizedHeaderExists=${normalizedHeaderExists}`);
        
        // Special debug for ACRUD fields
        if (['a', 'c', 'r', 'u', 'd'].includes(field.toLowerCase())) {
            console.log(`[DEBUG] ACRUD field detected: "${field}"`);
        }
        
        // Always create field inputs for all editable fields to match create modal behavior
        const actualHeader = headers.find(h => normalizeField(h) === normalizedField) || field;
        const value = rowData[actualHeader] || '';
        
        console.log(`[DEBUG] Creating form field "${field}" with actualHeader="${actualHeader}" and value="${value}"`);
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = actualHeader.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        label.setAttribute('for', field);
        
        let input;
        // Use dropdown if getFieldOptions returns options
        const options = getFieldOptions(field);
        console.log(`[DEBUG] Field "${field}" getFieldOptions returned:`, options);
        if (options && options.length > 0) {
            input = document.createElement('select');
            input.className = 'w-full p-2 border rounded dropdown-field';
            // Clear any existing options first
            input.innerHTML = '';
            options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option;
                optionEl.textContent = option;
                if (option === value) {
                    optionEl.selected = true;
                }
                input.appendChild(optionEl);
            });
        } else if (field === 'remarks_comments') {
            input = document.createElement('textarea');
            input.rows = 4;
            input.className = 'w-full p-2 border rounded';
        } else if (field.includes('date') || field === 'client_deadline') {
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'w-full p-2 border rounded';
            if (value) {
                // Format date properly for date inputs
                try {
                    const dateObj = new Date(value);
                    if (!isNaN(dateObj)) {
                        input.value = dateObj.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error(`Error formatting date for field ${field}:`, e);
                }
            }
        } else if (field === 'margin' || field === 'final_amount') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.className = 'w-full p-2 border rounded';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'w-full p-2 border rounded';
        }
        
        input.id = field;
        input.name = field;
        if (input.type !== 'date') {
            input.value = value;
        }
            
        // Store original value for change detection
        window.originalFormValues[field] = value;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });
    
    // Update modal title
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = isDuplicate ? 'Duplicate Opportunity' : 'Edit Opportunity';
    }
    
    // Show the modal
    overlay.classList.remove('hidden');
}

function showCreateOpportunityModal() {
    const overlay = document.getElementById('createOpportunityModalOverlay');
    const modal = document.getElementById('createOpportunityModal');
    const form = document.getElementById('createOpportunityForm');
    if (!overlay || !modal || !form) return;
    
    // Update dropdown options before showing the modal
    dropdownOptions = getDropdownOptions(headers, opportunities);

    // Use the same editable fields as edit modal
    const editableFields = [
        'project_name', 'rev', 'client', 'solutions', 'sol_particulars', 'industries', 'ind_particulars',
        'date_received', 'client_deadline', 'decision',
        'account_mgr', 'pic', 'bom', 'status', 'submitted_date',
        'margin', 'final_amt', 'opp_status', 'date_awarded_lost',
        'a', 'c', 'r', 'u', 'd',
        'remarks_comments', 'forecast_date'
    ];
    form.innerHTML = '';
    editableFields.forEach(field => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group mb-4';
        const label = document.createElement('label');
        label.textContent = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        label.setAttribute('for', field);
        let input;
        // Use dropdown if getFieldOptions returns options
        const options = getFieldOptions(field);
        console.log(`[DEBUG] Create Modal - Field "${field}" getFieldOptions returned:`, options);
        if (options && options.length > 0) {
            input = document.createElement('select');
            input.className = 'w-full p-2 border rounded dropdown-field';
            // Clear any existing options first
            input.innerHTML = '';
            options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option;
                optionEl.textContent = option;
                input.appendChild(optionEl);
            });
        } else if (field === 'remarks_comments') {
            input = document.createElement('textarea');
            input.rows = 4;
            input.className = 'w-full p-2 border rounded';
        } else if (field.includes('date') || field === 'client_deadline') {
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'w-full p-2 border rounded';
        } else if (field === 'margin' || field === 'final_amount') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.className = 'w-full p-2 border rounded';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'w-full p-2 border rounded';
        }
        input.id = field;
        input.name = field;
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
}

// Helper function to get field options for dropdowns
function getFieldOptions(field) {
    switch (field) {
        case 'decision':
            return ['', 'GO', 'DECLINE', 'Pending'];
        case 'status':
            return ['', 'On-Going', 'For Revision', 'For Approval', 'Submitted', 'No Decision Yet', 'Not Yet Started'];
        case 'opp_status':
            return ['', 'OP100', 'LOST', 'OP90', 'OP60', 'OP30'];
        case 'a':
            return ['', '10-Existing', '10-Strategic', '5-New Account, No Champion', '2-Existing account with No Orders'];
        case 'c':
            return ['', '10 -Existing Solution', '8 -Need to Customize', '5 -Need External Resource'];
        case 'r':
            return ['', '10 -Focus Business', '10 -Core Business', '8 -Strategic Business', '7 -Core + Peripheral', '5 -Peripheral Scope', '2 -Non Core for Subcon'];
        case 'u':
            return ['', '10 -Reasonable Time', '7 -Urgent', '5 -Budgetary'];
        case 'd':
            return ['', '10 -Complete', '5 -Limited', '2 -No Data'];
        case 'solutions':
            return ['', 'Automation', 'Electrification', 'Digitalization'];
        case 'sol_particulars':
            return ['', 'PLC / SCADA', 'CCTV', 'IT', 'ACS', 'INSTRUMENTATION', 'ELECTRICAL', 'FDAS', 'BMS', 'EE & AUX', 'PABGM', 'SOLAR', 'SCS', 'MECHANICAL', 'AUXILIARY', 'MEPFS', 'CIVIL'];
        case 'industries':
            return ['', 'Manufacturing', 'Buildings', 'Power'];
        case 'ind_particulars':
            return ['', 'F&B', 'CONSTRUCTION', 'MANUFACTURING', 'POWER PLANT', 'CEMENT', 'SEMICON', 'OIL & GAS', 'OTHERS', 'UTILITIES', 'COLD STORAGE', 'PHARMA'];
        case 'account_mgr':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.accountmgr ? ['', ...dropdownOptions.accountmgr] : [''];
        case 'pic':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.pic ? ['', ...dropdownOptions.pic] : [''];
        case 'bom':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.bom ? ['', ...dropdownOptions.bom] : [''];
        default:
            return [];
    }
}

function showRevisionHistoryModal(uid) {
    const overlay = document.getElementById('revisionHistoryModalOverlay');
    const modal = document.getElementById('revisionHistoryModal');
    
    if (!overlay || !modal) {
        console.error('Revision history modal elements not found');
        return;
    }
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // TODO: Load and display revision history for the given uid
    // This needs to be implemented to fetch and display the history
}

// --- Helper Functions ---
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function showMainContent(show) {
    document.querySelector('.main-content').style.display = show ? 'block' : 'none';
    authModalOverlay.style.display = show ? 'none' : 'block';
    authModal.style.display = show ? 'none' : 'block';
}

// --- User Management Nav Visibility ---
function updateUserMgmtNavVisibility() {
    const token = localStorage.getItem('authToken');
    const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : null;
    const userMgmtNav = document.getElementById('userMgmtNav');
    if (userMgmtNav) {
        userMgmtNav.style.display = userRole === 'admin' ? '' : 'none';
    }
}

// --- Change Password Button Visibility ---
function updateChangePasswordBtnVisibility() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (!changePasswordBtn) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
        changePasswordBtn.style.display = 'none';
    } else {
        changePasswordBtn.style.display = '';
    }
}

// --- Table Operations ---
function buildHeaderMap(headersToMap) { // Map normalized header to actual header
    headerIndices = {};
    headersToMap.forEach((header, index) => {
        const norm = normalizeField(header);
        headerIndices[norm] = index;
        if (norm.includes('particulars')) {
            particularsIndices.push(index);
        }
    });
}

function getDropdownOptions(headersToUse, data) {
    const options = {};
    DROPDOWN_FIELDS.forEach(field => {
        const normField = normalizeField(field);
        let values = new Set();

        // Find the index of this field in the headers array
        let fieldIndex = -1;
        for (let i = 0; i < headersToUse.length; i++) {
            if (normalizeField(headersToUse[i]) === normField) {
                fieldIndex = i;
                break;
            }
        }

        // If field found in headers, collect unique values
        if (fieldIndex !== -1) {
            data.forEach(row => {
                const value = row[headersToUse[fieldIndex]];
                if (value) values.add(value);
            });
        }

        // Special handling for Account Manager, PIC and BOM
        if (normField === 'accountmgr') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'accountmgr') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        } 
        else if (normField === 'pic') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'pic') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        }
        else if (normField === 'bom') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'bom') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        }

        options[normField] = Array.from(values).sort();
    });

    return options;
}

// This function has been replaced by initializeTableHeader() which includes Actions column

function populateTableBody(data) {
    if (!data || !data.length) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center p-4">No data available</td></tr>';
        return;
    }
    tableBody.innerHTML = '';
    // Find first visible column index
    const firstVisibleIndex = headers.findIndex((h, i) => columnVisibility[h]);
    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        // Store the original index from opportunities array
        const originalIndex = opportunities.findIndex(opp => opp.uid === row.uid);
        tr.dataset.originalIndex = originalIndex;

        // Add status-based classes
        const status = row.opp_status?.toLowerCase();
        if (status === 'op100') {
            tr.classList.add('bg-op100');
        } else if (status === 'lost') {
            tr.classList.add('bg-lost');
        } else if (row.decision?.toLowerCase() === 'decline') {
            tr.classList.add('bg-declined');
        }

        let visibleColumnIndex = 0; // Track visible column position
        
        headers.forEach((header, index) => {
            // Check if columnVisibility is properly configured - if not, make all columns visible
            if (!columnVisibility) {
                columnVisibility = {};
                headers.forEach(h => columnVisibility[h] = true);
            }
            
            if (!columnVisibility[header]) return; // Skip hidden columns
            const td = document.createElement('td');
            td.innerHTML = formatCellValue(row[header], header);
            
            // Set the appropriate width based on column type
            const columnWidth = getDefaultColumnWidth(header);
            td.style.minWidth = columnWidth;
            td.style.width = columnWidth;
            
            // Add appropriate classes
            if (rightAlignColumns.includes(header.toLowerCase())) {
                td.classList.add('numeric-column');
                td.style.textAlign = 'right';
            }
            
            // Check if this is the project name column (with various possible field names)
            const normalizedHeader = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const isProjectNameColumn = normalizedHeader === 'projectname' || header.toLowerCase() === 'project_name';
            const isFirstVisibleColumn = visibleColumnIndex === 0;
            
            if (isProjectNameColumn || isFirstVisibleColumn) {
                td.classList.add('project-name-cell');
                // Make project name column sticky - using class for styling
                td.classList.add('sticky-col');
                // Forcefully apply styles for text wrapping
                td.style.whiteSpace = 'normal';
                td.style.wordBreak = 'break-word'; 
                td.style.wordWrap = 'break-word';
                td.style.overflow = 'visible';
                td.style.textOverflow = 'unset';
                td.style.padding = '12px';
                
                // Set background color based on row status
                // Using custom data attribute for status to use in CSS
                if (row.opp_status?.toLowerCase() === 'op100') {
                    td.dataset.rowStatus = 'op100';
                } else if (status === 'lost') {
                    td.dataset.rowStatus = 'lost';
                } else if (row.decision?.toLowerCase() === 'decline') {
                    td.dataset.rowStatus = 'declined';
                }
            }
            
            // Check if this is the remarks_comments column
            const normalizedHeaderForRemarks = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedHeaderForRemarks === 'remarkscomments' || header.toLowerCase().includes('remarks')) {
                td.classList.add('remarks-cell');
            }
            
            // Make cell editable
            makeEditable(td, row, header, originalIndex);
            
            tr.appendChild(td);
            visibleColumnIndex++; // Increment visible column counter
        });

        // Add action buttons
        const actionsTd = document.createElement('td');
        actionsTd.className = 'center-align-cell';
        
        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex justify-center items-center gap-2';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">edit</span>';
        editBtn.className = 'action-button px-2 py-1 rounded text-xs';
        editBtn.title = 'Edit Opportunity';
        editBtn.onclick = () => showEditRowModal(originalIndex);
        btnContainer.appendChild(editBtn);

        // Duplicate button
        const duplicateBtn = document.createElement('button');
        duplicateBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">content_copy</span>';
        duplicateBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        duplicateBtn.title = 'Duplicate Opportunity';
        duplicateBtn.onclick = () => showEditRowModal(originalIndex, true);
        btnContainer.appendChild(duplicateBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">delete</span>';
        deleteBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        deleteBtn.title = 'Delete Opportunity';
        deleteBtn.onclick = async () => {
            if (confirm('Are you sure you want to delete this opportunity?')) {
                try {
                    const token = getAuthToken();
                    const response = await fetch(getApiUrl(`/api/opportunities/${encodeURIComponent(row.uid)}`), {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || response.statusText);
                    }
                    // Remove from local data and re-render
                    const idx = opportunities.findIndex(opp => opp.uid === row.uid);
                    if (idx !== -1) opportunities.splice(idx, 1);
                    filterAndSortData();
                    updateRowCount();
                    updateSummaryCounters(opportunities);
                    alert('Opportunity deleted successfully.');
                } catch (err) {
                    alert('Failed to delete: ' + err.message);
                }
            }
        };
        btnContainer.appendChild(deleteBtn);

        // History button
        const historyBtn = document.createElement('button');
        historyBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">history</span>';
        historyBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        historyBtn.title = 'View Revision History';
        historyBtn.onclick = () => showRevisionHistoryModal(row.uid);
        btnContainer.appendChild(historyBtn);

        actionsTd.appendChild(btnContainer);
        tr.appendChild(actionsTd);
        tableBody.appendChild(tr);
    });
}

function getCellClass(header) {
    const normHeader = normalizeField(header);
    if (rightAlignColumns.includes(normHeader)) return 'text-right';
    return '';
}

function handleSortClick(columnIndex) {
    if (currentSortColumnIndex === columnIndex) {
        // Toggle direction if same column
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        currentSortColumnIndex = columnIndex;
        currentSortDirection = 'asc';
    }
    
    filterAndSortData();
    updateSortIndicators();
}

function updateSortIndicators() {
    const headers = tableHead.querySelectorAll('th');
    headers.forEach((th, index) => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (index === currentSortColumnIndex) {
            th.classList.add(`sort-${currentSortDirection}`);
        }
    });
}

function filterAndSortData() {
    const filters = getActiveFilters();
    
    // Filter data
    const filteredData = opportunities.filter(opp => {
        // Search filter
        if (filters.search) {
            const searchStr = filters.search.toLowerCase();
            const matchFound = Object.values(opp).some(value => 
                String(value).toLowerCase().includes(searchStr)
            );
            if (!matchFound) return false;
        }

        // Status filter
        if (filters.status && filters.status.length > 0) {
            const status = filters.status[0].toLowerCase(); // Since we made it single-select
            
            if (status !== 'all') {
                const oppStatus = (opp.opp_status || '').toLowerCase();
                const currentStatus = (opp.status || '').toLowerCase();
                const decision = (opp.decision || '').toLowerCase();
                
                // Map filter button values to actual data values
                switch (status) {
                    case 'op100':
                        if (oppStatus !== 'op100') return false;
                        break;
                    case 'op90':
                        if (oppStatus !== 'op90') return false;
                        break;
                    case 'op60':
                        if (oppStatus !== 'op60') return false;
                        break;
                    case 'op30':
                        if (oppStatus !== 'op30') return false;
                        break;
                    case 'submitted':
                        // Submitted typically means OP30 or OP60 status
                        if (oppStatus !== 'op30' && oppStatus !== 'op60') return false;
                        break;
                    case 'ongoing':
                        if (currentStatus !== 'on-going') return false;
                        break;
                    case 'not_yet_started':
                        if (currentStatus !== 'not yet started') return false;
                        break;
                    case 'no_decision':
                        if (decision === 'go' || decision === 'decline') return false;
                        break;
                    case 'lost':
                        if (oppStatus !== 'lost' && decision !== 'lost') return false;
                        break;
                    case 'declined':
                        if (decision !== 'decline') return false;
                        break;
                    case 'inactive':
                        if (oppStatus !== 'inactive') return false;
                        break;
                    default:
                        return false;
                }
            }
        }

        // Account Manager filter
        if (filters.accountMgr && filters.accountMgr !== 'all' && opp.account_mgr !== filters.accountMgr) {
            return false;
        }

        // PIC filter
        if (filters.pic && filters.pic !== 'all' && opp.pic !== filters.pic) {
            return false;
        }

        return true;
    });

    // Sort data if sort column is set
    if (currentSortColumnIndex >= 0 && headers[currentSortColumnIndex]) {
        const sortHeader = headers[currentSortColumnIndex];
        filteredData.sort((a, b) => {
            let aVal = a[sortHeader];
            let bVal = b[sortHeader];

            // Handle different types of values
            if (isDateField(sortHeader)) {
                aVal = parseDateString(aVal) || new Date(0);
                bVal = parseDateString(bVal) || new Date(0);
            } else if (isCurrencyField(sortHeader)) {
                aVal = parseFloat(String(aVal).replace(/[^0-9.-]+/g, '') || '0');
                bVal = parseFloat(String(bVal).replace(/[^0-9.-]+/g, '') || '0');
            } else {
                // Convert to lowercase strings for comparison
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }

            // Compare values
            if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Update table body with filtered data
    populateTableBody(filteredData);
    
    // Update row count
    updateRowCount();
    
    // Update summary counters using the full opportunities data (not filtered)
    updateSummaryCounters(opportunities);
}

function updateRowCount() {
    const rowCountElement = document.getElementById('rowCount');
    if (!rowCountElement) return;
    
    // Count visible rows in table body
    const visibleRows = tableBody.querySelectorAll('tr').length;
    
    // Don't count the "No data available" row
    const actualCount = (visibleRows === 1 && tableBody.querySelector('tr td[colspan]')) ? 0 : visibleRows;
    
    // Update the row count element with the count and total
    const totalCount = opportunities.length;
    rowCountElement.textContent = `Showing ${actualCount} of ${totalCount} opportunities`;
}

function getDefaultColumnWidth(header) {
    // Customize widths for specific columns if needed
    const normHeader = (header || '').toLowerCase();
    if (normHeader.includes('project')) return '220px';
    if (normHeader.includes('remarks')) return '200px';
    if (normHeader.includes('amount') || normHeader.includes('amt')) return '120px';
    if (normHeader.includes('date')) return '110px';
    if (normHeader.includes('status')) return '100px';
    if (normHeader.includes('manager') || normHeader.includes('account_mgr')) return '140px';
    if (normHeader.includes('pic')) return '120px';
    // Default width
    return '120px';
}

// --- Cell Editing Functions ---
function showRemarksModal(currentValue, header, uid, td) {
    const overlay = document.getElementById('remarksModalOverlay');
    const modal = document.getElementById('remarksModal');
    const textarea = document.getElementById('remarksTextarea');
    const closeBtn = modal.querySelector('button[aria-label="Close"]');
    const saveBtn = document.getElementById('saveRemarksButton');
    const cancelBtn = document.getElementById('closeModalButton');

    if (!overlay || !modal || !textarea || !closeBtn || !saveBtn || !cancelBtn) {
        console.error('Remarks modal elements not found');
        return;
    }

    // Store references for cleanup
    let overlayClickHandler, escHandler;

    // Handle close
    function closeModal() {
        overlay.classList.add('hidden');
        modal.classList.add('hidden');
        
        // Clean up event listeners
        if (overlayClickHandler) {
            overlay.removeEventListener('click', overlayClickHandler);
        }
        if (escHandler) {
            document.removeEventListener('keydown', escHandler);
        }
    }

    // Handle save
    async function saveRemarks() {
        const newValue = textarea.value.trim();
        // Only save if value actually changed
        if (newValue === currentValue) {
            closeModal();
            return;
        }
        try {
            await saveEdit(newValue, header, uid);
            // If td is provided, update it immediately
            if (td) {
                td.textContent = newValue;
                td.dataset.fullRemarks = newValue;
            }
            closeModal();
        } catch (error) {
            console.error('Error saving remarks:', error);
            alert('Failed to save remarks: ' + error.message);
        }
    }

    // Clean up any existing event listeners first
    const newCloseBtn = closeBtn.cloneNode(true);
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Add fresh event listeners
    newCloseBtn.addEventListener('click', closeModal);
    newSaveBtn.addEventListener('click', saveRemarks);
    newCancelBtn.addEventListener('click', closeModal);
    
    // Set up overlay click handler
    overlayClickHandler = (e) => {
        if (e.target === overlay) closeModal();
    };
    overlay.addEventListener('click', overlayClickHandler);

    // Set up ESC key handler
    escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Set current value and show modal
    textarea.value = currentValue || '';
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // Focus the textarea with a slight delay to ensure modal is visible
    setTimeout(() => {
        textarea.focus();
    }, 100);
}

function makeEditable(td, originalFullRow, header, originalIndex) {
    const normHeader = normalizeField(header);
    // Don't make certain columns editable
    const nonEditableColumns = ['uid', 'encodeddate'];
    if (nonEditableColumns.includes(normHeader)) return;

    td.classList.add('editable-cell');
    td.title = "Double-click to edit";

    td.addEventListener('dblclick', function(e) {
        if (td.querySelector('input, select, textarea')) return; // Already editing

        const currentValue = originalFullRow[header] ?? '';

        // Special handling for remarks_comments
        if (normHeader === 'remarkscomments') {
            showRemarksModal(currentValue, header, originalFullRow.uid, td);
            return;
        }

        // Regular inline editing for other fields
        const input = createEditInput(normHeader, currentValue);

        // --- Fixed: Constrained inline editor styling ---
        input.style.background = getComputedStyle(document.body).getPropertyValue('--bg-modal') || '#fff';
        input.style.color = getComputedStyle(document.body).getPropertyValue('--text-body') || '#222';
        input.style.border = '2px solid #4f46e5';
        input.style.outline = 'none';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
        input.style.boxSizing = 'border-box';
        input.style.zIndex = 1000;
        
        // Set cell to relative positioning to contain the input
        td.style.position = 'relative';
        td.style.overflow = 'visible';
        
        if (input.tagName === 'SELECT') {
            input.style.position = 'relative';
            input.style.width = '100%';
            input.style.minWidth = '120px';
            input.style.maxWidth = '200px';
            input.style.height = 'auto';
        } else {
            // For text inputs, constrain to cell dimensions
            const cellRect = td.getBoundingClientRect();
            input.style.position = 'absolute';
            input.style.left = '0';
            input.style.top = '0';
            input.style.width = `${cellRect.width - 4}px`; // Account for border
            input.style.height = `${cellRect.height - 4}px`; // Account for border
            input.style.minWidth = '80px';
            input.style.maxWidth = '300px';
        }

        // Store original content
        const originalContent = td.innerHTML;
        td.innerHTML = '';
        td.appendChild(input);
        input.focus();

        // If it's a select, open the dropdown immediately (simulate by showing all options)
        if (input.tagName === 'SELECT') {
            const originalSize = input.size;
            input.size = Math.min(input.options.length, 10); // Show up to 10 options
            // Revert to normal dropdown on blur or change
            const revertSize = () => { input.size = originalSize || 0; };
            input.addEventListener('blur', revertSize);
            input.addEventListener('change', revertSize);
        }

        let isProcessingSave = false;
        let saveOnBlur = async () => {
            if (isProcessingSave) return;
            let value = input.value;
            if (input.tagName === 'SELECT') value = input.options[input.selectedIndex].value;
            // Only save if value actually changed
            if (value === currentValue) {
                td.innerHTML = originalContent;
                return;
            }
            isProcessingSave = true;
            await saveEdit(value, header, originalFullRow.uid);
            td.innerHTML = formatCellValue(value, header);
            isProcessingSave = false;
        };

        // Save on Enter, Cancel on ESC
        input.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter' && !isProcessingSave) {
                e.preventDefault();
                await saveOnBlur();
            } else if (e.key === 'Escape') {
                td.innerHTML = originalContent;
            }
        });

        // Save on blur for all input types
        input.addEventListener('blur', function() {
            setTimeout(async () => {
                if (td.contains(input)) {
                    await saveOnBlur();
                }
            }, 100);
        });

        // For select, also save on change
        if (input.tagName === 'SELECT' || input.type === 'date') {
            input.addEventListener('change', async function() {
                await saveOnBlur();
            });
        }
    });
}

function createEditInput(normHeader, currentValue) {
    let input;
    
    if (DROPDOWN_FIELDS_NORM.includes(normHeader)) {
        input = document.createElement('select');
        const options = dropdownOptions[normHeader] || [];
        // Add default empty option for better UX
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Select --';
        input.appendChild(defaultOpt);
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            if (option === currentValue) {
                opt.selected = true;
            }
            input.appendChild(opt);
        });
    } else if (normHeader === 'remarkscomments') {
        input = document.createElement('textarea');
        input.value = currentValue || '';
        input.style.minHeight = '200px';
        input.style.width = '100%';
        input.style.padding = '0.5rem';
        input.style.marginTop = '0.5rem';
        input.style.marginBottom = '0.5rem';
        input.style.fontFamily = 'inherit';
        input.style.borderRadius = '4px';
        input.style.border = '1px solid var(--border-color)';
    } else if (isDateField(normHeader)) {
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'w-full p-2 border rounded mt-1 text-sm';
        input.value = currentValue || '';
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full p-2 border rounded mt-1 text-sm';
        input.value = currentValue || '';
    }
    
    return input;
}

async function saveEdit(newValue, header, uid) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('No authentication token found. Please log in again.');
        }

        // Prepare update data with changed_by
        const updateData = {
            [header]: newValue,
            changed_by: getCurrentUserName()
        };
        
        const response = await fetch(getApiUrl(`/api/opportunities/${encodeURIComponent(uid)}`), {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Failed to save: ${err.error || response.statusText}`);
        }

        const result = await response.json();
        
        // Update local data
        const index = opportunities.findIndex(opp => opp.uid === uid);
        if (index !== -1) {
            opportunities[index][header] = newValue;
            // Do NOT update the DOM cell here; let makeEditable handle it
        }
        
    } catch (error) {
        console.error("Error saving edit:", error);
        alert(`Error saving: ${error.message}`);
        // Revert cell display to original value
        // (Handled in makeEditable by restoring originalContent on cancel)
    }
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    
    // Small delay to ensure form is fully populated
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get form data
    const formData = new FormData(e.target);
    const opportunityData = {};
    
    // Convert FormData to a regular object
    for (const [key, value] of formData.entries()) {
        opportunityData[key] = value;
    }
    
    console.log('[DEBUG] Form submission - collected data:');
    console.log(opportunityData);
    
    try {
        // For create mode, validate all required fields and use all data
        if (isCreateMode) {
            // Remove UID so server generates new one for duplicates
            delete opportunityData.uid;
            
            // Validate all required fields for new records
            let hasError = false;
            const allInputs = e.target.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => input.classList.remove('error'));
            
            const requiredFieldPatterns = [
                {
                    pattern: /project.*name|name.*project|project_name|projectname/i,
                    description: 'Project Name'
                },
                {
                    pattern: /^status$|opp.*status|opportunity.*status/i,
                    description: 'Status'
                }
            ];
            
            // Check all required fields for create mode
            for (const [fieldName, value] of Object.entries(opportunityData)) {
                for (const requiredPattern of requiredFieldPatterns) {
                    if (requiredPattern.pattern.test(fieldName)) {
                        const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
                        if (isEmpty) {
                            const fieldElement = e.target.querySelector(`[name="${fieldName}"]`);
                            if (fieldElement) {
                                fieldElement.classList.add('error');
                                hasError = true;
                            }
                        }
                        break;
                    }
                }
            }
            
            if (hasError) {
                alert('Please fill in all required fields.');
                return;
            }
            
            // Add metadata
            opportunityData.changed_by = getCurrentUserName();
            
            const response = await fetch(getApiUrl('/api/opportunities'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(opportunityData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create opportunity');
            }
            
            // Add to opportunities array
            const newOpportunity = await response.json();
            opportunities.unshift(newOpportunity);
            
        } else {
            // For edit mode, only validate and submit changed fields
            const changedFields = {};
            let hasError = false;
            
            // Clear any previous error styling
            const allInputs = e.target.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => input.classList.remove('error'));
            
            console.log('[DEBUG] Starting change-detection validation...');
            console.log('[DEBUG] Original values:', window.originalFormValues);
            console.log('[DEBUG] Current form data:', opportunityData);
            
            // Detect which fields have actually changed
            for (const [fieldName, currentValue] of Object.entries(opportunityData)) {
                const originalValue = window.originalFormValues?.[fieldName] || '';
                const normalizedCurrent = (currentValue || '').toString().trim();
                const normalizedOriginal = (originalValue || '').toString().trim();
                
                if (normalizedCurrent !== normalizedOriginal) {
                    changedFields[fieldName] = currentValue;
                    console.log(`[DEBUG] Field "${fieldName}" changed: "${normalizedOriginal}" -> "${normalizedCurrent}"`);
                }
            }
            
            console.log('[DEBUG] Changed fields:', changedFields);
            
            // If no fields changed, close modal without making API call
            if (Object.keys(changedFields).length === 0) {
                console.log('[DEBUG] No fields changed - closing modal without API call');
                hideEditRowModal();
                return;
            }
            
            // Only validate changed fields that are required
            const requiredFieldPatterns = [
                {
                    pattern: /project.*name|name.*project|project_name|projectname/i,
                    description: 'Project Name'
                },
                {
                    pattern: /^status$|opp.*status|opportunity.*status/i,
                    description: 'Status'
                }
            ];
            
            // Check if any changed fields are required and empty
            for (const [changedFieldName, changedValue] of Object.entries(changedFields)) {
                for (const requiredPattern of requiredFieldPatterns) {
                    if (requiredPattern.pattern.test(changedFieldName)) {
                        console.log(`[DEBUG] Validating changed required field: ${changedFieldName}`);
                        
                        const isEmpty = !changedValue || (typeof changedValue === 'string' && changedValue.trim() === '');
                        
                        if (isEmpty) {
                            const fieldElement = e.target.querySelector(`[name="${changedFieldName}"]`);
                            if (fieldElement) {
                                fieldElement.classList.add('error');
                                hasError = true;
                                console.log(`[DEBUG] Changed field "${changedFieldName}" is empty - marked as error`);
                            }
                        } else {
                            console.log(`[DEBUG] Changed field "${changedFieldName}" validation PASSED`);
                        }
                        break;
                    }
                }
            }
            
            console.log(`[DEBUG] Change-detection validation completed. hasError: ${hasError}`);
            
            if (hasError) {
                alert('Please fill in all required fields that you are trying to change.');
                return;
            }
            
            // Add metadata to changed fields
            const submissionData = {
                ...changedFields,
                changed_by: getCurrentUserName()
            };
            
            console.log('[DEBUG] Submitting only changed data:', submissionData);
            
            // Get UID for update
            const uid = opportunities[currentEditRowIndex]?.uid;
            if (!uid) {
                throw new Error('No UID found for update operation');
            }
            
            const response = await fetch(getApiUrl(`/api/opportunities/${uid}`), {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(submissionData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update opportunity');
            }
            
            // Update the opportunity in the array with the changed fields
            Object.assign(opportunities[currentEditRowIndex], changedFields);
        }
        
        // Re-render the table with updated data
        filterAndSortData();
        
        // Hide the modal
        hideEditRowModal();
        
        // Show success message
        alert(isCreateMode ? 'Opportunity created successfully!' : 'Opportunity updated successfully!');
    } catch (err) {
        alert(`Error: ${err.message}`);
        console.error('Error submitting form:', err);
    }
}

// --- Populate Filter Dropdowns ---
function populateFilterDropdowns() {
    // Clear existing options
    accountMgrFilterDropdown.innerHTML = '<option value="all">All</option>';
    picFilterDropdown.innerHTML = '<option value="all">All</option>';
    
    // Add options from the data
    if (dropdownOptions.accountmgr) {
        dropdownOptions.accountmgr.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            accountMgrFilterDropdown.appendChild(option);
        });
    }
    
    if (dropdownOptions.pic) {
        dropdownOptions.pic.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            picFilterDropdown.appendChild(option);
        });
    }
}

// --- Helper function to abbreviate amounts ---
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

// --- Load Dashboard Data ---
async function loadDashboardData() {
    try {
        // Calculate dashboard metrics from opportunities data
        const totalOppsCount = opportunities.length;
        
        // Count opportunities by status and calculate amounts
        const op100Opportunities = opportunities.filter(opp => 
            opp.opp_status?.toLowerCase() === 'op100'
        );
        const op100Count = op100Opportunities.length;
        const op100Amount = op100Opportunities.reduce((sum, opp) => 
            sum + (parseCurrency(opp.final_amt) || 0), 0
        );
        
        const op90Opportunities = opportunities.filter(opp => 
            opp.opp_status?.toLowerCase() === 'op90'
        );
        const op90Count = op90Opportunities.length;
        const op90Amount = op90Opportunities.reduce((sum, opp) => 
            sum + (parseCurrency(opp.final_amt) || 0), 0
        );
        
        const inactiveCount = opportunities.filter(opp => 
            opp.opp_status?.toLowerCase() === 'inactive'
        ).length;
        
        const submittedOppsCount = opportunities.filter(opp => 
            opp.opp_status?.toLowerCase() === 'op30' || 
            opp.opp_status?.toLowerCase() === 'op60'
        ).length;
        
        const declinedCount = opportunities.filter(opp => 
            opp.decision?.toLowerCase() === 'decline'
        ).length;

        // --- Enhancement: Show difference from last week/month ---
        // Get comparison period preference
        const comparisonMode = localStorage.getItem('dashboardComparisonMode') || 'weekly';
        
        // Get last week's and last month's values from localStorage
        const lastWeekDashboard = JSON.parse(localStorage.getItem('dashboardLastWeek') || '{}');
        const lastMonthDashboard = JSON.parse(localStorage.getItem('dashboardLastMonth') || '{}');
        
        let comparisonData = {};
        let comparisonLabel = '';
        
        if (comparisonMode === 'weekly') {
            comparisonData = lastWeekDashboard;
            comparisonLabel = 'vs last week';
        } else if (comparisonMode === 'monthly') {
            comparisonData = lastMonthDashboard;
            comparisonLabel = 'vs last month';
        }
        
        console.log(`Dashboard comparison mode: ${comparisonMode}`, comparisonData);
        
        // Helper to format value with delta
        function withDelta(current, last, mode = comparisonMode) {
            console.log(`withDelta: current=${current}, last=${last}, mode=${mode}, type=${typeof last}`);
            if (mode === 'none' || typeof last !== 'number') {
                console.log(`withDelta result (no comparison): ${current}`);
                return `${current}`;
            }
            
            const diff = current - last;
            if (diff === 0) return `${current}`;
            const sign = diff > 0 ? '+' : '';
            const result = `${current} (${sign}${diff})`;
            console.log(`withDelta result: ${result}`);
            return result;
        }
        // Update dashboard cards (use correct IDs)
        function setDashboardValue(id, value) {
            const el = document.getElementById(id);
            if (el) {
                console.log(`Setting ${id} to: ${value}`);
                el.textContent = value;
            } else {
                console.warn('Dashboard element not found:', id);
            }
        }
        setDashboardValue('totalOpportunities', withDelta(totalOppsCount, comparisonData.totalOpportunities));
        setDashboardValue('op100Summary', `${withDelta(op100Count, comparisonData.op100Count)} / ${abbreviateAmount(op100Amount)}`);
        setDashboardValue('op90Summary', `${withDelta(op90Count, comparisonData.op90Count)} / ${abbreviateAmount(op90Amount)}`);
        setDashboardValue('totalInactive', withDelta(inactiveCount, comparisonData.totalInactive));
        setDashboardValue('totalSubmitted', withDelta(submittedOppsCount, comparisonData.totalSubmitted));
        setDashboardValue('totalDeclined', withDelta(declinedCount, comparisonData.totalDeclined));

        // Save snapshots based on day of week/month
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
        const dayOfMonth = today.getDate(); // 1-31
        
        // Save weekly snapshot on Mondays
        if (dayOfWeek === 1) {
            localStorage.setItem('dashboardLastWeek', JSON.stringify({
                totalOpportunities: totalOppsCount,
                op100Count: op100Count,
                op90Count: op90Count,
                totalInactive: inactiveCount,
                totalSubmitted: submittedOppsCount,
                               totalDeclined: declinedCount,
                savedDate: today.toISOString()
            }));
            console.log('Weekly snapshot saved (Monday)');
        }
        
        // Save monthly snapshot on the 1st of each month
        if (dayOfMonth === 1) {
            localStorage.setItem('dashboardLastMonth', JSON.stringify({
                totalOpportunities: totalOppsCount,
                op100Count: op100Count,
                op90Count: op90Count,
                totalInactive: inactiveCount,
                totalSubmitted: submittedOppsCount,
                totalDeclined: declinedCount,
                savedDate: today.toISOString()
            }));
            console.log('Monthly snapshot saved (1st of month)');
        }
        
        // DEBUG: For testing purposes, create sample data if none exists
        if (Object.keys(lastWeekDashboard).length === 0) {
            console.log('Creating test weekly data for demonstration...');
            const testLastWeekData = {
                totalOpportunities: Math.max(0, totalOppsCount - 26),
                op100Count: Math.max(0, op100Count - 12),
                op90Count: Math.max(0, op90Count - 8),
                totalInactive: Math.max(0, inactiveCount - 3),
                totalSubmitted: Math.max(0, submittedOppsCount - 5),
                totalDeclined: Math.max(0, declinedCount - 2),
                savedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
            };
            localStorage.setItem('dashboardLastWeek', JSON.stringify(testLastWeekData));
            console.log('Test weekly data created:', testLastWeekData);
        }
        
        if (Object.keys(lastMonthDashboard).length === 0) {
            console.log('Creating test monthly data for demonstration...');
            const testLastMonthData = {
                totalOpportunities: Math.max(0, totalOppsCount - 89),
                op100Count: Math.max(0, op100Count - 25),
                op90Count: Math.max(0, op90Count - 18),
                totalInactive: Math.max(0, inactiveCount - 12),
                totalSubmitted: Math.max(0, submittedOppsCount - 31),
                totalDeclined: Math.max(0, declinedCount - 15),
                savedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
            };
            localStorage.setItem('dashboardLastMonth', JSON.stringify(testLastMonthData));
            console.log('Test monthly data created:', testLastMonthData);
        }
        
        // Re-run the calculation with current comparison mode
        const currentComparisonData = comparisonMode === 'weekly' ? 
            JSON.parse(localStorage.getItem('dashboardLastWeek') || '{}') :
            comparisonMode === 'monthly' ? 
            JSON.parse(localStorage.getItem('dashboardLastMonth') || '{}') : {};
            
        if (comparisonMode !== 'none' && Object.keys(currentComparisonData).length > 0) {
            setDashboardValue('totalOpportunities', withDelta(totalOppsCount, currentComparisonData.totalOpportunities));
            setDashboardValue('op100Summary', `${withDelta(op100Count, currentComparisonData.op100Count)} / ${abbreviateAmount(op100Amount)}`);
            setDashboardValue('op90Summary', `${withDelta(op90Count, currentComparisonData.op90Count)} / ${abbreviateAmount(op90Amount)}`);
            setDashboardValue('totalInactive', withDelta(inactiveCount, currentComparisonData.totalInactive));
            setDashboardValue('totalSubmitted', withDelta(submittedOppsCount, currentComparisonData.totalSubmitted));
            setDashboardValue('totalDeclined', withDelta(declinedCount, currentComparisonData.totalDeclined));
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateSummaryCounters(data) {
    // Update summary counters based on the data
    if (!data) return;

    
    // Calculate counts and amounts
    const op100Opportunities = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op100'
    );
    const op100Count = op100Opportunities.length;
    const op100Amount = op100Opportunities.reduce((sum, opp) => 
        sum + (parseCurrency(opp.final_amt) || 0), 0
    );
    
    const op90Opportunities = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op90'
    );
    const op90Count = op90Opportunities.length;
    const op90Amount = op90Opportunities.reduce((sum, opp) => 
        sum + (parseCurrency(opp.final_amt) || 0), 0
    );
    
    const inactiveCount = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'inactive'
    ).length;
    
    const submittedOppsCount = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op30' || 
        opp.opp_status?.toLowerCase() === 'op60'
    ).length;
    
    const declinedCount = data.filter(opp => 
        opp.decision?.toLowerCase() === 'decline'
    ).length;
    
    const lostCount = data.filter(opp => 
        opp.decision?.toLowerCase() === 'lost'
    ).length;

    // Update the DOM elements if they exist
    if (op100Summary) op100Summary.textContent = `${op100Count} / ${abbreviateAmount(op100Amount)}`;
    if (op90Summary) op90Summary.textContent = `${op90Count} / ${abbreviateAmount(op90Amount)}`;
    if (totalInactive) totalInactive.textContent = inactiveCount;
    if (totalSubmitted) totalSubmitted.textContent = submittedOppsCount;
       if (totalDeclined) totalDeclined.textContent = declinedCount;
    if (lostSummary) lostSummary.textContent = lostCount;
}

// --- Filter Functions ---
function getActiveFilters() {
    const filters = {
        search: searchInput.value.toLowerCase(),
        status: Array.from(statusFilterButtonsContainer.querySelectorAll('.filter-button.active'))
            .map(btn => btn.dataset.filterValue),
        accountMgr: accountMgrFilterDropdown.value,
        pic: picFilterDropdown.value
    };
    return filters;
}

async function initializeTable() {
    if (!opportunities || !opportunities.length) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center p-4">No data available</td></tr>';
        return;
    }

    // Get headers from the first row and reorder so project_name is first, and remove UID
    let rawHeaders = Object.keys(opportunities[0]);
    console.log(`[DEBUG] Raw headers from database:`, rawHeaders);
    let norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let projectNameHeader = rawHeaders.find(h => norm(h) === 'projectname');
    let otherHeaders = rawHeaders.filter(h => norm(h) !== 'projectname' && norm(h) !== 'uid');
    headers = [projectNameHeader, ...otherHeaders].filter(Boolean);
    console.log(`[DEBUG] Final headers for table:`, headers);
    
    // Check if A,C,R,U,D fields are present
    const acrudFields = ['a', 'c', 'r', 'u', 'd'];
    acrudFields.forEach(field => {
        const found = headers.includes(field);
        console.log(`[DEBUG] Field "${field}" present in headers:`, found);
    });

    // Build headerIndices
    headerIndices = {};
    headers.forEach((header, index) => {
        headerIndices[header] = index;
    });

    // Initialize column visibility using user-specific preferences
    try {
        // Try to load user preferences first
        const userPreferences = await loadUserColumnPreferences('opportunities');
        
        if (userPreferences) {
            // User has saved preferences, use them
            columnVisibility = userPreferences;
        } else {
            // No user preferences found, check localStorage for migration
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                // Migrate from localStorage
                columnVisibility = JSON.parse(stored);
                await saveUserColumnPreferences('opportunities', columnVisibility);
                localStorage.removeItem('columnVisibility');
            } else {
                // Set and save defaults
                await resetColumnVisibilityToDefaults();
            }
        }
    } catch (error) {
        console.error('Error initializing column visibility:', error);
        // Fallback to legacy localStorage initialization
        if (!localStorage.getItem('columnVisibility')) {
            await resetColumnVisibilityToDefaults();
        } else {
            await initializeColumnVisibility();
        }
    }
    
    // Populate column toggle container
    populateColumnToggleContainer();

    // Populate dropdown options for filters (Account Manager, PIC, etc.)
    dropdownOptions = getDropdownOptions(headers, opportunities);
    populateFilterDropdowns();

    // Initialize table header
    initializeTableHeader();

    // Initialize table body
    filterAndSortData();

    // Update row count
    updateRowCount();
}

function initializeTableHeader() {
    const headerRow = document.createElement('tr');
    let visibleColumnIndex = 0; // Track visible column position
    
    headers.forEach((header, index) => {
               // Check if columnVisibility is properly configured - if not, make all columns visible
        if (!columnVisibility) {
            columnVisibility = {};
            headers.forEach(h => columnVisibility[h] = true);
        }
        
        if (!columnVisibility[header]) return; // Only render visible columns
        const th = document.createElement('th');
        
        // Create a container for header content to improve layout
        const headerContent = document.createElement('div');
        headerContent.className = 'header-content';
        headerContent.textContent = formatHeaderText(header);
        
        // Add sort indicator in a separate element for better styling
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.innerHTML = '&nbsp;↕';
        headerContent.appendChild(sortIndicator);
        
        th.appendChild(headerContent);
        th.dataset.field = header;
        
        // Set width based on column type
        const columnWidth = getDefaultColumnWidth(header);
        th.style.minWidth = columnWidth;
        th.style.width = columnWidth;
        
        // Add appropriate classes
        if (rightAlignColumns.includes(header.toLowerCase())) {
            th.classList.add('numeric-column');
        }
        
        // Check if this is the project name column (with various possible field names)
        const normalizedHeader = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isProjectNameColumn = normalizedHeader === 'projectname' || header.toLowerCase() === 'project_name';
        const isFirstVisibleColumn = visibleColumnIndex === 0;
        
        if (isProjectNameColumn || isFirstVisibleColumn) {
            th.classList.add('project-name-cell');
            // Make project name column sticky
            th.classList.add('sticky-col');
        }
        
        // Check if this is the remarks_comments column
        const normalizedHeaderForRemarks = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedHeaderForRemarks === 'remarkscomments' || header.toLowerCase().includes('remarks')) {
            th.classList.add('remarks-cell');
        }
        // Add click handler for sorting
        th.addEventListener('click', () => handleSortClick(index));
        headerRow.appendChild(th);
        
        visibleColumnIndex++; // Increment visible column counter
    });

    // Add Actions column header with consistent styling
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'Actions';
    actionsHeader.className = 'px-3 py-2 bg-header text-left center-align-cell';
    actionsHeader.style.minWidth = '120px'; // Ensure enough space for the action buttons
    headerRow.appendChild(actionsHeader);

    tableHead.innerHTML = '';
    tableHead.appendChild(headerRow);
}

function formatShortCurrency(num) {
    const prefix = '₱';
    if (num >= 1e9) {
        return prefix + (num / 1e9).toFixed(1) + 'B';
    }
    if (num >= 1e6) {
        return prefix + (num / 1e6).toFixed(1) + 'M';
    }
    if (num >= 1e3) {
        return prefix + (num / 1e3).toFixed(1) + 'K';
    }
    return prefix + num.toFixed(0);
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function showAuthErrorBanner(message) {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
        banner.textContent = message;
        banner.style.display = 'block';
        setTimeout(() => {
            banner.style.display = 'none';
        }, 5000);
    }
}

// --- Validation Functions ---
function validateEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 100;
}

// Helper function to enable horizontal scrolling with mousewheel
function setupHorizontalScroll() {
    const tableContainer = document.querySelector('.table-container');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    if (tableContainer) {
        // FIXED: Only enable horizontal scroll when SHIFT+wheel or when primarily horizontal movement
        tableContainer.addEventListener('wheel', function(e) {
            // Only intercept if shift is held
            if (e.shiftKey) {
                e.preventDefault();
                
                // Use deltaY for shift+wheel, deltaX for normal horizontal wheel
                const scrollAmount = e.shiftKey ? e.deltaY : e.deltaX;
                const scrollSpeed = Math.min(80, Math.abs(scrollAmount) * 0.8);
                this.scrollLeft += scrollAmount > 0 ? scrollSpeed : -scrollSpeed;
                
                // Add visual feedback for horizontal scrolling
                tableContainer.classList.add('scrolling');
                setTimeout(() => {
                    tableContainer.classList.remove('scrolling');
                }, 300);
            }
            // Let vertical scrolling work normally for all other cases
        }, { passive: false });
        
        // Hide scroll indicator when we reach the end of the table
        tableContainer.addEventListener('scroll', function() {
            if (scrollIndicator) {
                const maxScroll = this.scrollWidth - this.clientWidth;
                const scrollPosition = this.scrollLeft;
                
                // If we're near the end of the scroll area
                if (scrollPosition > maxScroll - 20) {
                    scrollIndicator.style.opacity = '0';
                } else {
                    scrollIndicator.style.opacity = '0.8';
                }
            }
        });
        
        // Update scroll indicator visibility on window resize
        window.addEventListener('resize', function() {
            if (scrollIndicator) {
                if (tableContainer.scrollWidth <= tableContainer.clientWidth) {
                    // No horizontal scroll needed
                    scrollIndicator.style.display = 'none';
                } else {
                    scrollIndicator.style.display = 'block';
                }
            }
        });
        
        // Initial check
        setTimeout(() => {
            if (scrollIndicator) {
                if (tableContainer.scrollWidth <= tableContainer.clientWidth) {
                    scrollIndicator.style.display = 'none';
                } else {
                    scrollIndicator.style.display = 'block';
                }
            }
        }, 1000); // Wait for table to fully render
    }
}

setupHorizontalScroll();

// --- Reset Table Function ---
function resetTable() {
    // Clear search input
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset status filter buttons
    const activeStatusButtons = document.querySelectorAll('.status-filter-button.active');
    activeStatusButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Reset dropdown filters
    if (accountMgrFilterDropdown) {
        accountMgrFilterDropdown.value = '';
    }
    
    if (picFilterDropdown) {
        picFilterDropdown.value = '';
    }
    
    // Reset any other filters
    
    // Re-render the table with all data
    filterAndSortData();
    
    // Update summary counters
    updateSummaryCounters(opportunities);
}

async function initializeColumnVisibility() {
    // Default hidden columns (specific columns that should be hidden on initial load for new users)
    const defaultHiddenColumns = [
        'description', 'comments', 'uid', 'created_at', 'updated_at', 
        'encoded_date', 'a', 'c', 'r', 'u', 'd', 'rev', 'project_code',
        'sol_particulars', 'ind_particulars', 'lost_rca', 'l_particulars',
        'client_deadline', 'submitted_date', 'date_awarded_lost', 'forecast_date'
    ];
    
    let visibilitySettings = {};
    
    try {
        // Try to load user-specific preferences from server
        const userPreferences = await loadUserColumnPreferences('opportunities');
        
        if (userPreferences) {
            // User has saved preferences, use them
            visibilitySettings = userPreferences;
        } else {
            // No user preferences found, check localStorage as fallback
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                visibilitySettings = JSON.parse(stored);
                // Migrate localStorage preferences to user-specific storage
                await saveUserColumnPreferences('opportunities', visibilitySettings);
                // Clear localStorage after migration
                localStorage.removeItem('columnVisibility');
            } else {
                // Set defaults if no stored preferences
                headers.forEach(header => {
                    const shouldHide = defaultHiddenColumns.some(col => 
                        header.toLowerCase() === col.toLowerCase()
                    );
                    visibilitySettings[header] = !shouldHide;
                });
                
                // Save default settings to user-specific storage
                await saveUserColumnPreferences('opportunities', visibilitySettings);
            }
        }
    } catch (e) {
        console.error('Error loading column preferences:', e);
        // Fallback to localStorage or defaults
        try {
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                visibilitySettings = JSON.parse(stored);
            } else {
                // Set defaults
                headers.forEach(header => {
                    const shouldHide = defaultHiddenColumns.some(col => 
                        header.toLowerCase() === col.toLowerCase()
                    );
                    visibilitySettings[header] = !shouldHide;
                });
            }
        } catch (fallbackError) {
            // Final fallback to showing all columns
            headers.forEach(header => {
                visibilitySettings[header] = true;
            });
        }
    }
    
    // Apply visibility settings
    columnVisibility = visibilitySettings;
}

// Function to reset column visibility to defaults
async function resetColumnVisibilityToDefaults() {
    try {
        // Reset user preferences on server (which also clears localStorage as fallback)
        const resetSuccess = await resetUserColumnPreferences('opportunities');
        
        if (!resetSuccess) {
            // If server reset fails, clear localStorage as fallback
            localStorage.removeItem('columnVisibility');
        }
        
        // Re-initialize with defaults
        // Ensure headers are available before proceeding
        if (headers && headers.length > 0) {
            // Re-initialize column visibility to load fresh defaults
            await initializeColumnVisibility(); 
            
            // These need to be called to reflect the changes in the UI
            populateColumnToggleContainer();
            initializeTableHeader();
            filterAndSortData(); // This will render the table with new visibility
        } else {
            console.warn("resetColumnVisibilityToDefaults called before headers were initialized.");
        }
    } catch (error) {
        console.error('Error resetting column visibility to defaults:', error);
        // Fallback to localStorage-only reset
        localStorage.removeItem('columnVisibility');
        if (headers && headers.length > 0) {
            await initializeColumnVisibility();
            populateColumnToggleContainer();
            initializeTableHeader();
            filterAndSortData();
        }
    }
}

function populateColumnToggleContainer() {
    if (!columnToggleContainer || !headers || headers.length === 0) {
        return;
    }
    
    // Clear the container
    columnToggleContainer.innerHTML = '';
    
    // Create toggle controls for each column
    headers.forEach((header, index) => {
        // Skip actions column - it should always be visible
        if (header.toLowerCase() === 'actions') {
            return;
        }
        
        // Create a wrapper div for the checkbox and label
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-2';
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `column-toggle-${index}`;
        checkbox.dataset.columnName = header;
        checkbox.checked = columnVisibility[header] ?? true;
        
        // Disable the first visible column (usually project name) to prevent hiding it
        const isFirstVisibleColumn = headers.findIndex(h => columnVisibility[h] !== false) === index;
        if (isFirstVisibleColumn) {
            checkbox.disabled = true;
            checkbox.title = 'First column cannot be hidden';
        }
        
        // Create label
        const label = document.createElement('label');
        label.htmlFor = `column-toggle-${index}`;
        label.textContent = formatHeaderText(header);
        label.className = 'text-sm select-none';
        
        // Add change event listener
        checkbox.addEventListener('change', async function() {
            // Update column visibility
            columnVisibility[header] = this.checked;
            
            // Save to user-specific preferences with localStorage fallback
            await saveUserColumnPreferences('opportunities', columnVisibility);
            
            // Rebuild table with new visibility settings
            initializeTableHeader();
            filterAndSortData();
            
            // Update disabled state of first visible column checkbox
            updateFirstVisibleColumnState();
        });
        
        // Append elements to wrapper
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        
        // Add wrapper to container
        columnToggleContainer.appendChild(wrapper);
    });
    
    // Update disabled state for the first visible column
    updateFirstVisibleColumnState();
}

function updateFirstVisibleColumnState() {
    if (!columnToggleContainer || !headers) return;
    
    // Find the first visible column
    const firstVisibleIndex = headers.findIndex(h => columnVisibility[h] !== false);
    
    // Enable all checkboxes first
    columnToggleContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.disabled = false;
        checkbox.title = '';
    });
    
    // Disable the first visible column checkbox
    if (firstVisibleIndex >= 0) {
        const firstVisibleHeader = headers[firstVisibleIndex];
        const firstVisibleCheckbox = columnToggleContainer.querySelector(`input[data-column-name="${firstVisibleHeader}"]`);
        if (firstVisibleCheckbox) {
            firstVisibleCheckbox.disabled = true;
            firstVisibleCheckbox.title = 'First visible column cannot be hidden';
        }
    }
}

// --- User Column Preferences Functions ---
async function loadUserColumnPreferences(pageName) {
    try {
        const token = getAuthToken();
        if (!token) {
            return null; // Not authenticated, can't load user preferences
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 404 || response.status === 401) {
                return null; // No preferences found or not authenticated
            }
            throw new Error(`Failed to load column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.columnSettings;
    } catch (error) {
        console.error('Error loading user column preferences:', error);
        return null; // Fall back to localStorage or defaults
    }
}

async function saveUserColumnPreferences(pageName, columnSettings) {
    try {
        const token = getAuthToken();
        if (!token) {
            console.warn('Cannot save column preferences: not authenticated');
            return false;
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ columnSettings })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Column preferences saved successfully:', data.message);
        return true;
    } catch (error) {
        console.error('Error saving user column preferences:', error);
        // Fallback to localStorage for backward compatibility
        try {
            localStorage.setItem('columnVisibility', JSON.stringify(columnSettings));
            console.warn('Saved to localStorage as fallback');
        } catch (localStorageError) {
            console.error('Failed to save to localStorage as fallback:', localStorageError);
        }
        return false;
    }
}

async function resetUserColumnPreferences(pageName) {
    try {
        const token = getAuthToken();
        if (!token) {
            console.warn('Cannot reset column preferences: not authenticated');
            return false;
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to reset column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Column preferences reset successfully:', data.message);
        return true;
    } catch (error) {
        console.error('Error resetting user column preferences:', error);
        return false;
    }
}

// --- Dashboard Comparison Toggle Functions ---
function initializeDashboardToggles() {
    const weeklyToggle = document.getElementById('weeklyToggle');
    const monthlyToggle = document.getElementById('monthlyToggle');
    const noCompareToggle = document.getElementById('noCompareToggle');
    const saveSnapshotBtn = document.getElementById('saveSnapshotBtn');
    
    if (!weeklyToggle || !monthlyToggle || !noCompareToggle || !saveSnapshotBtn) {
        console.log('Dashboard toggle elements not found, skipping initialization');
        return;
    }
    
    // Get current comparison mode
    const currentMode = localStorage.getItem('dashboardComparisonMode') || 'weekly';
    updateToggleStates(currentMode);
    
    // Event listeners
    weeklyToggle.addEventListener('click', () => setComparisonMode('weekly'));
    monthlyToggle.addEventListener('click', () => setComparisonMode('monthly'));
    noCompareToggle.addEventListener('click', () => setComparisonMode('none'));
    saveSnapshotBtn.addEventListener('click', saveManualSnapshot);
}

function setComparisonMode(mode) {
    localStorage.setItem('dashboardComparisonMode', mode);
    updateToggleStates(mode);
    
    // Refresh dashboard with new comparison mode
    loadDashboardData();
    
    console.log('Comparison mode set to:', mode);
}

function updateToggleStates(activeMode) {
    const weeklyToggle = document.getElementById('weeklyToggle');
    const monthlyToggle = document.getElementById('monthlyToggle');
    const noCompareToggle = document.getElementById('noCompareToggle');
    
    if (!weeklyToggle || !monthlyToggle || !noCompareToggle) return;
    
    // Reset all buttons
    [weeklyToggle, monthlyToggle, noCompareToggle].forEach(btn => {
        btn.className = 'dashboard-toggle-btn';
    });
    
    // Activate current mode
    let activeButton;
    switch (activeMode) {
        case 'weekly':
            activeButton = weeklyToggle;
            break;
        case 'monthly':
            activeButton = monthlyToggle;
            break;
        case 'none':
            activeButton = noCompareToggle;
            break;
    }
    
    if (activeButton) {
        activeButton.className = 'dashboard-toggle-btn active';
    }
}

function saveManualSnapshot() {
    if (!opportunities || !opportunities.length) {
        alert('No data available to save');
        return;
    }
    
    try {
        // Calculate current dashboard metrics
        const totalOppsCount = opportunities.length;
        const op100Count = opportunities.filter(opp => opp.opp_status?.toLowerCase() === 'op100').length;
        const op90Count = opportunities.filter(opp => opp.opp_status?.toLowerCase() === 'op90').length;
        const inactiveCount = opportunities.filter(opp => opp.opp_status?.toLowerCase() === 'inactive').length;
        const submittedOppsCount = opportunities.filter(opp => 
            opp.opp_status?.toLowerCase() === 'op30' || opp.opp_status?.toLowerCase() === 'op60'
        ).length;
        const declinedCount = opportunities.filter(opp => opp.decision?.toLowerCase() === 'decline').length;
        
        const snapshotData = {
            totalOpportunities: totalOppsCount,
            op100Count: op100Count,
            op90Count: op90Count,
            totalInactive: inactiveCount,
            totalSubmitted: submittedOppsCount,
            totalDeclined: declinedCount,
            savedDate: new Date().toISOString()
        };
        
        // Save as both weekly and monthly snapshot
        localStorage.setItem('dashboardLastWeek', JSON.stringify(snapshotData));
        localStorage.setItem('dashboardLastMonth', JSON.stringify(snapshotData));
        
        // Show success message
        alert('Snapshot saved successfully! This data will be used for future comparisons.');
        console.log('Manual snapshot saved:', snapshotData);
        
        // Refresh dashboard
        loadDashboardData();
        
    } catch (error) {
        console.error('Error saving snapshot:', error);
        alert('Error saving snapshot: ' + error.message);
    }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tooltips
    initializeTooltips();
    
    // Initialize auth (check token, fetch user info)
    if (typeof initializeAuth === 'function') {
        initializeAuth();
    } else {
        // Basic auth check if initializeAuth doesn't exist
        const token = getAuthToken();
        if (token) {
            showMainContent(true);
            initializeApp();
        } else {
            // Show auth modal or redirect to login
            console.log('No auth token found');
        }
    }
});

// --- Tooltip Initialization ---
function initializeTooltips() {
    // Simple tooltip implementation using data attributes
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            const tooltipText = el.getAttribute('data-tooltip');
            showTooltip(el, tooltipText);
        });
        el.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    });
}

function showTooltip(element, text) {
    let tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.innerText = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Position the tooltip above the element
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + scrollTop - tooltip.offsetHeight - 5}px`;
    
    // Fade in effect
    tooltip.style.opacity = '0';
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 10);
    
    // Store the tooltip element on the target for later removal
    element._tooltipElement = tooltip;
}

function hideTooltip(element) {
    if (element._tooltipElement) {
        // Fade out effect
        element._tooltipElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(element._tooltipElement);
            element._tooltipElement = null;
        }, 300);
    }
}

// --- Miscellaneous Enhancements ---
// Improved error handling for fetch requests
async function safeFetch(url, options = {}) {
    const token = getAuthToken();
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Request failed');
    }
    
    return response;
}

// Enhanced logging for debugging
function log(...args) {
    if (window.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// --- CSS Enhancements ---
// Improved scrollbar styles
const style = document.createElement('style');
style.textContent = `
    /* Custom scrollbar styles */
    ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
    }

    ::-webkit-scrollbar-thumb {
        background-color: #888;
        border-radius: 6px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background-color: #555;
    }

    ::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 6px;
    }
`;
document.head.appendChild(style);

// --- Accessibility Enhancements
// Improved focus styles for keyboard navigation
const focusStyle = document.createElement('style');
focusStyle.textContent = `
    /* Custom focus styles */
    :focus {
        outline: 3px solid #4f46e5;
        outline-offset: 2px;
    }

    /* Focus styles for buttons and links */
    button:focus, a:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.4);
    }
`;
document.head.appendChild(focusStyle);

// --- Performance Enhancements ---
// Throttle resize event to improve performance
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Handle resize event
        console.log('Resized:', window.innerWidth, window.innerHeight);
    }, 200);
});

// --- Debugging Tools ---
// Simple debug overlay to show variable values
function createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '10px';
    overlay.style.right = '10px';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.color = '#fff';
    overlay.style.padding = '10px';
    overlay.style.borderRadius = '8px';
    overlay.style.zIndex = 10000;
    overlay.style.fontSize = '12px';
    overlay.style.maxHeight = '300px';
    overlay.style.overflowY = 'auto';
    
    document.body.appendChild(overlay);
    
    return overlay;
}

function logToDebugOverlay(overlay, ...messages) {
    const message = messages.join(' ');
    const div = document.createElement('div');
    div.textContent = message;
    overlay.appendChild(div);
}

// Usage example:
// const debugOverlay = createDebugOverlay();
// logToDebugOverlay(debugOverlay, 'Debug message:', someVariable);

function getCurrentUserName() {
    const token = localStorage.getItem('authToken');
    if (!token) return 'Unknown User';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Try to get name, fallback to email, then to 'Unknown User'
        return payload.name || payload.email || 'Unknown User';
    } catch (e) {
        return 'Unknown User';
    }
}

// --- Temporary DEBUG function for testing dashboard delta ---
window.testDashboardDelta = function() {
    console.log('=== Testing Dashboard Delta Functionality ===');
    
    // Clear any existing data
    localStorage.removeItem('dashboardLastWeek');
    localStorage.removeItem('dashboardLastMonth');
    localStorage.removeItem('dashboardComparisonMode');
    
    // Set to weekly mode for testing
    localStorage.setItem('dashboardComparisonMode', 'weekly');
    
    // Re-run the loadDashboardData function
    loadDashboardData();
    
    // Update toggle states
    if (typeof updateToggleStates === 'function') {
        updateToggleStates('weekly');
    }
    
    console.log('Dashboard delta test completed. Check the dashboard cards for changes.');
    console.log('Try switching between Weekly/Monthly/No Comparison modes using the toggle buttons.');
};