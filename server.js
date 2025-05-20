require('dotenv').config(); // Load environment variables from .env
console.log("=== SERVER.JS STARTED ===");
const express = require('express');
const path = require('path'); // Import the path module
const { Pool } = require('pg'); // Import PostgreSQL client
const { v4: uuidv4 } = require('uuid'); // Import uuid package
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'; // Use env var in production
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const app = express();
const port = 3000; // You can change the port if needed

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PGUSER || 'reuelrivera',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'opps_management',
  password: process.env.PGPASSWORD || '',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
});

// --- Helper Functions ---

function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/[₱,]/g, '').trim();
    if (cleanedValue.startsWith('(') && cleanedValue.endsWith(')')) {
        return parseFloat(cleanedValue.replace(/[()]/g, '')) * -1 || 0;
    }
    return parseFloat(cleanedValue) || 0;
  }
  return 0;
}

// Function to format date as 'Month Year' (e.g., "January 2025") using UTC
function formatMonthYear(date) {
  if (!(date instanceof Date) || isNaN(date)) {
      // console.warn("formatMonthYear received invalid date:", date); // Optional logging
      return 'Invalid Date';
  }
  // Use UTC methods to avoid timezone issues affecting month/year display
  const year = date.getUTCFullYear();
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${year}`;
}

function getColumnInsensitive(obj, target) {
    if (!obj || typeof obj !== 'object') return null; // Add check for valid object
    const norm = s => (s || '').toLowerCase().replace(/\s|_/g, '');
    const targetNorm = norm(target);
    for (const key of Object.keys(obj)) {
        if (norm(key) === targetNorm) return key;
    }
    return null;
}

// Robust date parsing function - attempts to parse various formats into a JS Date object (UTC midnight)
function robustParseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
        // If already a Date object, normalize to UTC midnight
        return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
    }

    // Handle potential Excel serial dates (numbers)
    if (typeof val === 'number' && val > 25569) {
        try {
             // Excel epoch starts Dec 30 1899 (or Jan 1 1904 for Mac). Assuming Windows epoch.
             const utc_days = val - 25569; // Days from 1/1/1970 UTC
             const utc_milliseconds = utc_days * 86400 * 1000;
             const date_info = new Date(utc_milliseconds); // This date is already UTC
             if (!isNaN(date_info)) {
                 // Return as UTC midnight
                 return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
             }
        } catch (e) { console.warn("Error parsing potential Excel date number:", val, e); }
    }

    if (typeof val !== 'string') return null;

    const trimmedVal = val.trim();
    let d = null;

    // Try ISO format (YYYY-MM-DD...) - Date constructor handles this as UTC if Z or offset is not present
    if (trimmedVal.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
        d = new Date(trimmedVal + 'T00:00:00Z'); // Append Z to ensure UTC interpretation
        if (!isNaN(d)) return d;
    }
    // Try MM/DD/YYYY or M/D/YYYY
    if (trimmedVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [m, d1, y] = trimmedVal.split('/').map(Number);
        if (m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
            // Construct as UTC
            d = new Date(Date.UTC(y, m - 1, d1)); // Month is 0-indexed
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
        }
    }
    // Try DD/MM/YYYY (only if day > 12)
    if (trimmedVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [d1, m, y] = trimmedVal.split('/').map(Number);
        if (d1 > 12 && m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
             d = new Date(Date.UTC(y, m - 1, d1));
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
        }
    }
     // Try YYYY/MM/DD
    if (trimmedVal.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
         const [y, m, d1] = trimmedVal.split('/').map(Number);
         if (m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
             d = new Date(Date.UTC(y, m - 1, d1));
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
         }
    }
    // Try 'Day, Mon-DD' (e.g., 'Sat, Feb-01') - Append current year, then normalize
    if (trimmedVal.match(/^[A-Za-z]{3},\s[A-Za-z]{3}-\d{1,2}$/)) {
        const currentYear = new Date().getUTCFullYear(); // Use current UTC year
        // Use Date.parse which is generally better for month names, assume English
        const timestamp = Date.parse(`${trimmedVal.split(', ')[1]} ${currentYear} 00:00:00 GMT`);
        if (!isNaN(timestamp)) {
             d = new Date(timestamp);
             // Normalize to UTC midnight
             return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }
    }
    // Try 'Mon-DD' (e.g., 'Feb-01') - Append current year, then normalize
     if (trimmedVal.match(/^[A-Za-z]{3}-\d{1,2}$/)) {
         const currentYear = new Date().getUTCFullYear();
         const timestamp = Date.parse(`${trimmedVal} ${currentYear} 00:00:00 GMT`);
         if (!isNaN(timestamp)) {
             d = new Date(timestamp);
             return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
         }
     }

    console.warn("[robustParseDate] Could not parse date string:", val);
    return null; // Return null if no format matches
}


// NOTE: calculateWinLossDashboardData_ClientSide is now used on the FRONTEND
// This function remains here as a reference or if needed for other server-side tasks.
function calculateWinLossDashboardData_ServerReference(opportunities) {
    // ... (calculation logic as before) ...
}

// Function to calculate Forecast dashboard data
function calculateForecastDashboardData(opportunities) {
    console.log(`[calculateForecastDashboardData] Processing ${opportunities?.length ?? 0} opportunities.`);
    const now = new Date();
    const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); // Start of next month UTC

    let totalForecastCount = 0;
    let totalForecastAmount = 0;
    let nextMonthForecastCount = 0;
    let nextMonthForecastAmount = 0;
    const forecastMonthly = {}; // Key: YYYY-MM, Value: { monthName, count, totalAmount, projects }
    const projectDetails = []; // Array for project details table

    if (!opportunities || !Array.isArray(opportunities)) {
        console.error("[calculateForecastDashboardData] Invalid opportunities data received.");
        opportunities = [];
    }

    opportunities.forEach((opp, index) => {
        if (typeof opp !== 'object' || opp === null) {
            console.warn(`[calculateForecastDashboardData] Skipping invalid opportunity at index ${index}:`, opp);
            return;
        }

        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt'); // Use final amount for forecast value
        const projNameKey = getColumnInsensitive(opp, 'project_name'); // Get project name key

        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const projectName = projNameKey ? opp[projNameKey] : 'Unknown Project'; // Default name

        let parsedForecastDate = robustParseDate(forecastDateValue); // Returns UTC Date or null
        // --- Add forecastMonth and forecastWeek ---
        let forecastMonth = '';
        let forecastWeek = '';
        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            forecastMonth = formatMonthYear(parsedForecastDate);
            // Calculate week of month (1-based)
            const day = parsedForecastDate.getUTCDate();
            const firstDayOfMonth = new Date(Date.UTC(parsedForecastDate.getUTCFullYear(), parsedForecastDate.getUTCMonth(), 1));
            const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0=Sun
            forecastWeek = Math.ceil((day + firstDayWeekday) / 7);
        }

        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            totalForecastCount++;
            totalForecastAmount += finalAmt;

            const year = parsedForecastDate.getUTCFullYear();
            const month = parsedForecastDate.getUTCMonth();
            const monthYearKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const formattedMonthYear = formatMonthYear(parsedForecastDate);

            if (!forecastMonthly[monthYearKey]) {
                forecastMonthly[monthYearKey] = { monthName: formattedMonthYear, count: 0, totalAmount: 0 };
            }
            forecastMonthly[monthYearKey].count++;
            forecastMonthly[monthYearKey].totalAmount += finalAmt;

            projectDetails.push({ name: projectName, amount: finalAmt, forecastMonth: formattedMonthYear, forecastWeek: forecastWeek });

            if (year === nextMonthDate.getUTCFullYear() && month === nextMonthDate.getUTCMonth()) {
                nextMonthForecastCount++;
                nextMonthForecastAmount += finalAmt;
            }
        } else {
             if (forecastDateKey && forecastDateValue) {
                 console.warn(`[calculateForecastDashboardData index ${index}] Invalid or missing forecast date: '${forecastDateValue}'`);
             }
        }
    });

    const sortedMonthKeys = Object.keys(forecastMonthly).sort();
    const forecastMonthlySummary = sortedMonthKeys.map(key => ({
        monthYear: forecastMonthly[key].monthName,
        count: forecastMonthly[key].count,
        totalAmount: forecastMonthly[key].totalAmount
    }));

     console.log("[calculateForecastDashboardData] Forecast Summary:", forecastMonthlySummary);

    return {
        totalForecastCount,
        totalForecastAmount,
        nextMonthForecastCount,
        nextMonthForecastAmount,
        forecastMonthlySummary,
        projectDetails
    };
}


// --- Express Setup ---
app.use(express.json());

// --- HTTPS Enforcement in Production ---
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// Serve static files except for /api/*
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  express.static(__dirname)(req, res, next);
});

// --- AUTH MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.accountType !== 'Admin') {
    // Log forbidden admin access attempt
    const attemptedBy = req.user ? `${req.user.email} (${req.user.id})` : 'Unauthenticated';
    const now = new Date().toISOString();
    const logMsg = `[${now}] Forbidden admin API access attempt by: ${attemptedBy} on ${req.originalUrl}`;
    console.warn(logMsg);
    // --- Append to audit.log ---
    try {
      fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');
    } catch (err) {
      console.error('Failed to write to audit.log:', err);
    }
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// --- Rate Limiting for Auth Endpoints ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// --- API Endpoints ---
app.get('/api/opportunities', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opps_monitoring');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data from database:', error);
    res.status(500).json({ error: 'Failed to fetch data from database' });
  }
});

// API endpoint for Win/Loss dashboard data (sends all data + unique solutions)
app.get('/api/dashboard', async (req, res) => {
  console.log(`[API /api/dashboard] Request received.`);
  try {
    // Updated: Select all fields needed for the dashboard table
    const result = await pool.query(`
      SELECT 
        opp_status, 
        date_awarded_lost, 
        final_amt, 
        solutions, 
        account_mgr, 
        project_name, 
        client, 
        margin
      FROM opps_monitoring
    `);
    const allOpportunities = result.rows;

    // Unique Solutions
    const solutionKey = 'solutions';
    const uniqueSolutions = allOpportunities.length > 0 && allOpportunities[0].hasOwnProperty(solutionKey)
        ? Array.from(new Set(allOpportunities.map(opp => opp[solutionKey]).filter(Boolean))).sort()
        : [];
    console.log(`[API /api/dashboard] Unique Solutions found: ${uniqueSolutions.join(', ')}`);

    // Unique Account Managers
    const accountMgrKey = 'account_mgr';
    const uniqueAccountMgrs = allOpportunities.length > 0 && allOpportunities[0].hasOwnProperty(accountMgrKey)
        ? Array.from(new Set(allOpportunities.map(opp => opp[accountMgrKey]).filter(Boolean))).sort()
        : [];
    console.log(`[API /api/dashboard] Unique Account Managers found: ${uniqueAccountMgrs.join(', ')}`);

    res.json({
        opportunities: allOpportunities,
        uniqueSolutions: uniqueSolutions,
        uniqueAccountMgrs: uniqueAccountMgrs
    });
  } catch (error) {
    console.error('[API /api/dashboard] Error generating win/loss dashboard data:', error);
    res.status(500).json({ error: 'Failed to generate win/loss dashboard data' });
  }
});


// API endpoint for Forecast dashboard data (with status filter)
app.get('/api/forecast-dashboard', async (req, res) => {
  const requestedStatus = req.query.status;
  console.log(`[API /api/forecast-dashboard] Request received. Status filter: ${requestedStatus}`);
  try {
    // *** Use correct column name "final_amt" and "opp_status" ***
    let sql = `
        SELECT forecast_date, final_amt, opp_status, project_name
        FROM opps_monitoring
        WHERE forecast_date IS NOT NULL
          AND (decision IS NULL OR decision NOT IN ('DECLINE', 'DECLINED'))
          AND (opp_status IS NULL OR opp_status NOT IN ('LOST', 'OP100'))
    `;
    const queryParams = [];
    if (requestedStatus && requestedStatus.toLowerCase() !== 'all') {
        sql += ` AND opp_status = $${queryParams.length + 1}`;
        queryParams.push(requestedStatus);
    }
    console.log(`[API /api/forecast-dashboard] Executing SQL: ${sql}`);
    console.log(`[API /api/forecast-dashboard] Parameters:`, queryParams);
    const result = await pool.query(sql, queryParams);
    const opportunities = result.rows;

    // --- Find min/max forecast date ---
    let minDate = null, maxDate = null;
    opportunities.forEach(opp => {
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const parsedDate = robustParseDate(forecastDateValue);
        if (!parsedDate || isNaN(parsedDate)) return;
        if (!minDate || parsedDate < minDate) minDate = parsedDate;
        if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
    });
    // --- Build all months between min and max ---
    let allMonths = [];
    if (minDate && maxDate) {
      let cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
      const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));
      while (cursor <= end) {
        const monthName = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        allMonths.push(monthName);
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    }

    // --- Calculate monthly summary (with zero fill) ---
    const forecastMonthly = {};
    opportunities.forEach(opp => {
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt');
        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const parsedForecastDate = robustParseDate(forecastDateValue);
        if (!parsedForecastDate || isNaN(parsedForecastDate)) return;
        const monthName = parsedForecastDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        if (!forecastMonthly[monthName]) forecastMonthly[monthName] = { monthYear: monthName, count: 0, totalAmount: 0 };
        forecastMonthly[monthName].count++;
        forecastMonthly[monthName].totalAmount += finalAmt;
    });
    // Fill missing months with zero
    if (allMonths.length > 0) {
      allMonths.forEach(monthName => {
        if (!forecastMonthly[monthName]) forecastMonthly[monthName] = { monthYear: monthName, count: 0, totalAmount: 0 };
      });
    }
    // Sort months chronologically
    const forecastMonthlySummary = Object.values(forecastMonthly).sort((a, b) => {
      const pa = new Date(a.monthYear);
      const pb = new Date(b.monthYear);
      return pa - pb;
    });

    // --- Calculate other summary data as before ---
    // ...existing code for totalForecastCount, totalForecastAmount, nextMonthForecastCount, nextMonthForecastAmount, projectDetails...
    let totalForecastCount = 0;
    let totalForecastAmount = 0;
    let nextMonthForecastCount = 0;
    let nextMonthForecastAmount = 0;
    const now = new Date();
    const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const projectDetails = [];
    opportunities.forEach((opp, index) => {
        if (typeof opp !== 'object' || opp === null) return;
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt');
        const projNameKey = getColumnInsensitive(opp, 'project_name');
        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const projectName = projNameKey ? opp[projNameKey] : 'Unknown Project';
        let parsedForecastDate = robustParseDate(forecastDateValue);
        let forecastMonth = '';
        let forecastWeek = '';
        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            forecastMonth = parsedForecastDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            const day = parsedForecastDate.getUTCDate();
            const firstDayOfMonth = new Date(Date.UTC(parsedForecastDate.getUTCFullYear(), parsedForecastDate.getUTCMonth(), 1));
            const firstDayWeekday = firstDayOfMonth.getUTCDay();
            forecastWeek = Math.ceil((day + firstDayWeekday) / 7);
        }
        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            totalForecastCount++;
            totalForecastAmount += finalAmt;
            const year = parsedForecastDate.getUTCFullYear();
            const month = parsedForecastDate.getUTCMonth();
            if (year === nextMonthDate.getUTCFullYear() && month === nextMonthDate.getUTCMonth()) {
                nextMonthForecastCount++;
                nextMonthForecastAmount += finalAmt;
            }
            projectDetails.push({ name: projectName, amount: finalAmt, forecastMonth, forecastWeek });
        }
    });

    return res.json({
        totalForecastCount,
        totalForecastAmount,
        nextMonthForecastCount,
        nextMonthForecastAmount,
        forecastMonthlySummary,
        projectDetails
    });
  } catch (error) {
    console.error('[API /api/forecast-dashboard] Error generating forecast dashboard data:', error);
    res.status(500).json({ error: 'Failed to generate forecast dashboard data' });
  }
});

// API endpoint: Forecast revision summary (by revision date and by new forecast date)
app.get('/api/forecast-revision-summary', async (req, res) => {
    // ... (implementation remains the same) ...
    try {
        const byRevisionDate = await pool.query(`...`);
        const byForecastDate = await pool.query(`...`);
        res.json({ byRevisionDate: byRevisionDate.rows, byForecastDate: byForecastDate.rows });
    } catch (error) { /* ... error handling ... */ }
});

// API endpoint: Forecast dashboard data by CMRP week (Month-Week)
app.get('/api/forecast-dashboard-weeks', async (req, res) => {
    try {
        // Query only relevant opportunities (same filter as /api/forecast-dashboard)
        const result = await pool.query(`
            SELECT forecast_date, final_amt, opp_status, project_name
            FROM opps_monitoring
            WHERE forecast_date IS NOT NULL
              AND (decision IS NULL OR decision NOT IN ('DECLINE', 'DECLINED'))
              AND (opp_status IS NULL OR opp_status NOT IN ('LOST', 'OP100'))
        `);
        const opportunities = result.rows;
        // Helper to get week of month (1-based, UTC)
        function getWeekOfMonth(date) {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
            const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0=Sun
            const dayOfMonth = date.getUTCDate();
            const daysOffset = dayOfMonth + firstDayWeekday;
            return Math.ceil(daysOffset / 7);
        }
        // --- Find min/max forecast date ---
        let minDate = null, maxDate = null;
        opportunities.forEach(opp => {
            const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
            const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
            const parsedDate = robustParseDate(forecastDateValue);
            if (!parsedDate || isNaN(parsedDate)) return;
            if (!minDate || parsedDate < minDate) minDate = parsedDate;
            if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
        });
        if (!minDate || !maxDate) {
            res.json({ weekSummary: [] });
            return;
        }
        // --- Build all weeks between min and max ---
        const allWeeks = [];
        let cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
        const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()));
        while (cursor <= end) {
            const year = cursor.getUTCFullYear();
            const month = cursor.getUTCMonth();
            const monthName = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            // Find number of weeks in this month
            const lastDay = new Date(Date.UTC(year, month + 1, 0));
            const lastDate = lastDay.getUTCDate();
            for (let d = 1; d <= lastDate; d++) {
                const date = new Date(Date.UTC(year, month, d));
                const weekNumber = getWeekOfMonth(date);
                const monthWeek = `${monthName} - Week ${weekNumber}`;
                if (!allWeeks.includes(monthWeek)) {
                    allWeeks.push(monthWeek);
                }
            }
            // Move to next month
            cursor = new Date(Date.UTC(year, month + 1, 1));
        }
        // Group by 'Month - Week'
        const weekMap = {};
        opportunities.forEach(opp => {
            const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
            const amtKey = getColumnInsensitive(opp, 'final_amt');
            const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
            const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
            const parsedDate = robustParseDate(forecastDateValue);
            if (!parsedDate || isNaN(parsedDate)) return;
            const monthName = parsedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            const weekNumber = getWeekOfMonth(parsedDate);
            const monthWeek = `${monthName} - Week ${weekNumber}`;
            if (!weekMap[monthWeek]) weekMap[monthWeek] = { monthWeek, count: 0, totalAmount: 0 };
            weekMap[monthWeek].count++;
            weekMap[monthWeek].totalAmount += finalAmt;
        });
        // Build weekSummaryArr with all weeks (fill missing with 0)
        const weekSummaryArr = allWeeks.map(monthWeek => {
            if (weekMap[monthWeek]) return weekMap[monthWeek];
            return { monthWeek, count: 0, totalAmount: 0 };
        });
        // Sort by date (parse month/year/week)
        weekSummaryArr.sort((a, b) => {
            function parseMonthWeek(mw) {
                const match = mw.match(/^(\w+) (\d{4}) - Week (\d+)$/);
                if (!match) return { y: 0, m: 0, w: 0 };
                const [_, monthStr, yearStr, weekStr] = match;
                const m = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
                return { y: +yearStr, m, w: +weekStr };
            }
            const pa = parseMonthWeek(a.monthWeek);
            const pb = parseMonthWeek(b.monthWeek);
            if (pa.y !== pb.y) return pa.y - pb.y;
            if (pa.m !== pb.m) return pa.m - pb.m;
            return pa.w - pb.w;
        });
        res.json({ weekSummary: weekSummaryArr });
    } catch (error) {
        console.error('[API /api/forecast-dashboard-weeks] Error:', error);
        res.status(500).json({ error: 'Failed to generate weekly forecast dashboard data' });
    }
});

app.post('/api/opportunities', authenticateToken,
  [
    body().customSanitizer(obj => {
      // Sanitize all string fields in the object
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        }
      }
      return obj;
    }),
    body('opp_name').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('project_name').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('client').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('account_mgr').optional().isString().isLength({ min: 2, max: 100 }).escape(),
    body('margin').optional().isNumeric(),
    body('margin_percentage').optional().isNumeric(),
    body('final_amt').optional().isNumeric(),
    body('date_awarded_lost').optional().isISO8601().toDate(),
    // Add more fields as needed
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    console.log("=== POST /api/opportunities ===", req.body);
    let newOpp = { ...req.body };
    const changed_by = newOpp.changed_by || null;
    delete newOpp.changed_by;
    delete newOpp.uid; delete newOpp.UID; delete newOpp.Uid;
    newOpp.uid = uuidv4();
    newOpp = Object.fromEntries(Object.entries(newOpp).map(([k, v]) => [k, (typeof v === 'string' && v.trim() === '') ? null : v]));

    const keys = Object.keys(newOpp);
    const values = keys.map(k => newOpp[k]);
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO opps_monitoring (${columns}) VALUES (${placeholders}) RETURNING *`;

    console.log('Executing SQL:', sql); console.log('With Values:', values);
    try {
      const result = await pool.query(sql, values);
      const createdOpp = result.rows[0];
      const revKey = getColumnInsensitive(createdOpp, 'rev');
      const revNumber = revKey ? (Number(createdOpp[revKey]) || 0) : 0;
      // *** FIX: Use correct column name 'final_amt' in fieldsToStore ***
      const fieldsToStore = ['rev', 'final_amt', 'Margin', 'Client Deadline', 'Submitted Date', 'forecast_date'];
      const snapshotFields = {};
      fieldsToStore.forEach(f => {
        const key = (f === 'rev') ? 'rev' : getColumnInsensitive(createdOpp, f);
        if (key && createdOpp.hasOwnProperty(key)) snapshotFields[f] = createdOpp[key]; else snapshotFields[f] = null;
      });
      await pool.query(
        `INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
         VALUES ($1, $2, $3, NOW(), $4, $5)`,
        [createdOpp.uid, revNumber, changed_by, JSON.stringify(snapshotFields), JSON.stringify(snapshotFields)]
      );
      console.log(`Revision ${revNumber} created for new opportunity ${createdOpp.uid}`);
      res.status(201).json(createdOpp);
    } catch (error) {
      console.error('Error inserting new opportunity or revision:', error);
      res.status(500).json({ error: 'Failed to create opportunity.' });
    }
  }
);


// PUT Endpoint with Revision Logic v5
app.put('/api/opportunities/:uid', authenticateToken,
  [
    body().customSanitizer(obj => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        }
      }
      return obj;
    }),
    body('opp_name').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('project_name').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('client').optional().isString().isLength({ min: 2, max: 200 }).escape(),
    body('account_mgr').optional().isString().isLength({ min: 2, max: 100 }).escape(),
    body('margin').optional().isNumeric(),
    body('margin_percentage').optional().isNumeric(),
    body('final_amt').optional().isNumeric(),
    body('date_awarded_lost').optional().isISO8601().toDate(),
    // Add more fields as needed
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    const { uid } = req.params;
    console.log(`[PUT /api/opportunities/${uid}] Received raw body:`, JSON.stringify(req.body, null, 2));
    let updateData = { ...req.body };
    const changed_by = updateData.changed_by || null;
    delete updateData.changed_by;
    delete updateData.uid; delete updateData.UID; delete updateData.Uid;
    updateData = Object.fromEntries(Object.entries(updateData).map(([k, v]) => [k, (typeof v === 'string' && v.trim() === '') ? null : v]));
    console.log(`[PUT /api/opportunities/${uid}] Processed updateData:`, JSON.stringify(updateData, null, 2));

    if (!uid) return res.status(400).json({ error: 'UID is required.' });
    const keysToUpdate = Object.keys(updateData);
    if (keysToUpdate.length === 0) return res.status(400).json({ error: 'No data provided for update.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Current State
      console.log(`[PUT /api/opportunities/${uid}] Fetching current state...`);
      const currentResult = await client.query('SELECT * FROM opps_monitoring WHERE uid = $1 FOR UPDATE', [uid]);
      const currentOpp = currentResult.rows[0];
      if (!currentResult.rows.length) {
        await client.query('ROLLBACK');
        console.log(`[PUT /api/opportunities/${uid}] Opportunity not found.`);
        return res.status(404).json({ error: 'Opportunity not found.' });
      }
      console.log(`[PUT /api/opportunities/${uid}] Current Opp Data:`, JSON.stringify(currentOpp, null, 2));

      // After fetching currentOpp and before updating the main table:
      const oldForecastDate = currentOpp['forecast_date'] || null;
      const newForecastDate = updateData['forecast_date'] || null;
      if (oldForecastDate !== newForecastDate && newForecastDate) {
        await client.query(
          `INSERT INTO forecast_revisions (opportunity_uid, old_forecast_date, new_forecast_date, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [uid, oldForecastDate, newForecastDate, changed_by]
        );
        console.log(`[PUT /api/opportunities/${uid}] Forecast change logged: ${oldForecastDate} -> ${newForecastDate}`);
      }

      // 2. Determine Revision Numbers and if Changed (using direct key access and number conversion)
      const oldRevValue = currentOpp['rev'];
      const newRevValue = updateData['rev'];
      console.log(`[PUT /api/opportunities/${uid}] Comparing Old Rev Value: ${oldRevValue} (Type: ${typeof oldRevValue}), New Rev Value: ${newRevValue} (Type: ${typeof newRevValue})`);
      const oldRevNumber = Number(oldRevValue) || 0;
      const newRevNumber = (newRevValue !== undefined && !isNaN(Number(newRevValue))) ? Number(newRevValue) : oldRevNumber;
      const isRevChanged = newRevNumber !== oldRevNumber;
      console.log(`[PUT /api/opportunities/${uid}] Determined Old Rev#: ${oldRevNumber}, Determined New Rev#: ${newRevNumber}, isRevChanged: ${isRevChanged}`);

      // 3. Build Snapshot of State *Before* Update
      // *** FIX: Use correct column name 'final_amt' in fieldsToStore ***
      const fieldsToStore = ['rev', 'final_amt', 'Margin', 'Client Deadline', 'Submitted Date', 'forecast_date'];
      const buildSnapshot = (row) => {
          const snap = {};
          fieldsToStore.forEach(f => {
              const key = (f === 'rev') ? 'rev' : getColumnInsensitive(row, f);
              if (key && row.hasOwnProperty(key)) { snap[f] = row[key]; }
              else { snap[f] = null; }
          });
          return snap;
      };
      const prevSnapshot = buildSnapshot(currentOpp);
      console.log(`[PUT /api/opportunities/${uid}] Previous Snapshot (for rev ${oldRevNumber}):`, JSON.stringify(prevSnapshot, null, 2));

      // 4. Update Main Table
      const setClause = keysToUpdate.map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
      const values = keysToUpdate.map(key => updateData[key]);
      values.push(uid);
      const updateSql = `UPDATE opps_monitoring SET ${setClause} WHERE uid = $${values.length} RETURNING *`;
      console.log('[PUT] Executing Update SQL:', updateSql); console.log('With Values:', values);
      const updateResult = await client.query(updateSql, values);
      const updatedOpp = updateResult.rows[0];
      console.log(`[PUT /api/opportunities/${uid}] Updated Opp Data:`, JSON.stringify(updatedOpp, null, 2));

      // 5. Build Snapshot of State *After* Update
      const updatedSnapshot = buildSnapshot(updatedOpp);
      console.log(`[PUT /api/opportunities/${uid}] Updated Snapshot (for rev ${newRevNumber}):`, JSON.stringify(updatedSnapshot, null, 2));

      // 6. Handle Revision History Logic (Refined v5)
      // Attempt to INSERT the previous state (if rev changed), doing nothing if it exists
      if (isRevChanged) {
          console.log(`[Revision] Revision Changed. Inserting previous revision (if not exists): ${oldRevNumber}`);
          const insertOldSql = `
              INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
              VALUES ($1, $2, $3, NOW(), $4, $5)
              ON CONFLICT (opportunity_uid, revision_number) DO NOTHING`;
          await client.query(insertOldSql, [
              uid,
              oldRevNumber,
              changed_by,
              JSON.stringify(prevSnapshot),
              JSON.stringify(prevSnapshot)
          ]);
      }

      // Always UPSERT the *current* state for the current/new revision number
      console.log(`[Revision] Upserting current revision state: ${newRevNumber}`);
      const revisionSqlUpsert = `
          INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
          VALUES ($1, $2, $3, NOW(), $4, $5)
          ON CONFLICT (opportunity_uid, revision_number)
          DO UPDATE SET
              changed_by = EXCLUDED.changed_by,
              changed_at = NOW(),
              changed_fields = EXCLUDED.changed_fields,
              full_snapshot = EXCLUDED.full_snapshot`;
      await client.query(revisionSqlUpsert, [
          uid,
          newRevNumber, // Use the potentially new revision number
          changed_by,
          JSON.stringify(updatedSnapshot), // Use the snapshot reflecting the current state
          JSON.stringify(updatedSnapshot)
      ]);


      await client.query('COMMIT');
      console.log(`[PUT /api/opportunities/${uid}] Transaction Committed Successfully.`);
      res.json(updatedOpp);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[PUT /api/opportunities/${uid}] Error during update/revision:`, error);
      res.status(500).json({ error: 'Failed to update opportunity.' });
    } finally {
      client.release();
    }
  }
);


app.delete('/api/opportunities/:uid', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'UID is required.' });
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      console.log(`[DELETE /api/opportunities/${uid}] Deleting revisions...`);
      await client.query('DELETE FROM opportunity_revisions WHERE opportunity_uid = $1', [uid]);
      await client.query('DELETE FROM forecast_revisions WHERE opportunity_uid = $1', [uid]); // Also delete forecast revisions
      console.log(`[DELETE /api/opportunities/${uid}] Deleting main opportunity...`);
      const result = await client.query('DELETE FROM opps_monitoring WHERE uid = $1', [uid]);
      if (result.rowCount === 0) {
          await client.query('ROLLBACK');
          console.log(`[DELETE /api/opportunities/${uid}] Opportunity not found.`);
          return res.status(404).json({ error: 'Opportunity not found.' });
      }
      await client.query('COMMIT');
      console.log(`[DELETE /api/opportunities/${uid}] Delete successful.`);
      res.json({ success: true, message: 'Opportunity and its revisions deleted successfully.' });
  } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[DELETE /api/opportunities/${uid}] Error during delete:`, error);
      res.status(500).json({ error: 'Failed to delete opportunity.' });
  } finally {
      client.release();
  }
});

app.get('/api/opportunities/:uid/revisions', async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'UID is required.' });
  try {
    const result = await pool.query(
      `SELECT revision_number, changed_by, changed_at, changed_fields, full_snapshot
       FROM opportunity_revisions
       WHERE opportunity_uid = $1
       ORDER BY revision_number ASC, changed_at ASC`,
      [uid]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching revision history:', error);
    res.status(500).json({ error: 'Failed to fetch revision history.' });
  }
});

// API endpoint to fetch forecast revision history for an opportunity
app.get('/api/opportunities/:uid/forecast-revisions', async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'UID is required.' });
  try {
    const result = await pool.query(
      `SELECT id, old_forecast_date, new_forecast_date, changed_by, changed_at, comment
       FROM forecast_revisions
       WHERE opportunity_uid = $1
       ORDER BY changed_at ASC, id ASC`,
      [uid]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching forecast revision history:', error);
    res.status(500).json({ error: 'Failed to fetch forecast revision history.' });
  }
});

// --- AUTH: Register ---
app.post('/api/register', authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 100 }).withMessage('Password must be 8-100 chars.'),
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('roles').isArray({ min: 1 }),
    body('roles.*').isString().trim().escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
        const { email, password, name, roles } = req.body;
        if (!email || !password || !name || !Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({ error: 'All fields and at least one role are required.' });
        }
        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        // Determine accountType: if roles includes 'Admin', set 'Admin', else 'User'
        const accountType = roles.includes('Admin') ? 'Admin' : 'User';
        await pool.query('INSERT INTO users (id, email, password_hash, name, is_verified, roles, account_type) VALUES ($1, $2, $3, $4, $5, $6, $7)', [userId, email, password_hash, name, true, roles, accountType]);
        // Assign roles (legacy, if needed)
        for (const roleName of roles) {
            const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
            if (roleRes.rows.length > 0) {
                await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleRes.rows[0].id]);
            }
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('/api/register error:', err);
        return res.status(500).json({ error: 'Registration failed.' });
    }
});

// --- AUTH: Login ---
app.post('/api/login', authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
          console.error(`[LOGIN] No user found for email: ${email}`);
          return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const user = userRes.rows[0];
        console.log('[LOGIN] User record:', user);
        if (!user.password_hash) {
          console.error(`[LOGIN] No password_hash for user: ${email}`);
          return res.status(500).json({ error: 'User record missing password hash.' });
        }
        let valid = false;
        try {
          valid = await bcrypt.compare(password, user.password_hash);
        } catch (bcryptErr) {
          console.error('[LOGIN] bcrypt.compare error:', bcryptErr);
          return res.status(500).json({ error: 'Password hash comparison failed.' });
        }
        console.log(`[LOGIN] Password valid: ${valid}`);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });
        // Get roles
        const rolesRes = await pool.query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1', [user.id]);
        const roles = rolesRes.rows.map(r => r.name);
        // Determine accountType: if user.account_type exists, use it; else if roles includes 'Admin', set 'Admin', else 'User'
        const accountType = user.account_type ? user.account_type : (roles.includes('Admin') ? 'Admin' : 'User');
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, roles, accountType }, JWT_SECRET, { expiresIn: '2d' });
        return res.json({ token });
    } catch (err) {
        console.error('/api/login error:', err);
        if (err && err.stack) console.error(err.stack);
        return res.status(500).json({ error: 'Login failed.' });
    }
  }
);

// --- One-time endpoint to fix test user password hash ---
app.get('/api/fix-test-user-password', async (req, res) => {
  const bcrypt = require('bcrypt');
  const email = 'reuelrivera@gmail.com';
  const password = 'testpassword';
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE email=$2', [hash, email]);
  res.send('Test user password hash updated.');
});

// --- Static File Serving & Server Start ---
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); }); // Keep old dashboard route if needed
app.get('/win-loss_dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'win-loss_dashboard.html')); });
// *** UPDATED: Route for the new forecast dashboard page (matching case) ***
app.get('/forecast_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'forecast_dashboard.html'));
});
app.get('/forecastr_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'forecastr_dashboard.html'));
});

// --- User Management API (PostgreSQL-backed, schema-aligned) ---

// GET all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, is_verified, roles, account_type FROM users ORDER BY email ASC');
    const users = result.rows.map(u => ({
      _id: u.id,
      username: u.name, // Map 'name' to 'username' for frontend compatibility
      email: u.email,
      role: Array.isArray(u.roles) ? u.roles : [], // Multi-role support
      accountType: u.account_type || 'User',
      is_verified: u.is_verified
    }));
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// GET a single user by ID
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, is_verified, roles, account_type FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ _id: u.id, username: u.name, email: u.email, role: Array.isArray(u.roles) ? u.roles : [], accountType: u.account_type || 'User', is_verified: u.is_verified });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// POST (create) a new user
app.post('/api/users', authenticateToken, requireAdmin,
  [
    body('username').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 8, max: 100 }),
    body('role').isArray({ min: 1 }),
    body('role.*').isString().trim().escape(),
    body('accountType').optional().isIn(['Admin', 'User'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
      const { username, email, password, role, accountType } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
      }
      // Check for duplicate email
      const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (check.rows.length > 0) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, name, is_verified, roles, account_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, email, password_hash, username, true, Array.isArray(role) ? role : (role ? [role] : []), accountType || 'User']
      );
      res.status(201).json({ _id: id, username, email, role: Array.isArray(role) ? role : (role ? [role] : []), accountType: accountType || 'User', is_verified: true });
    } catch (err) {
      console.error('Error creating user:', err);
      res.status(500).json({ error: 'Failed to create user.' });
    }
  }
);

// PUT (update) an existing user
app.put('/api/users/:id', authenticateToken, requireAdmin,
  [
    body('username').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 8, max: 100 }),
    body('role').isArray({ min: 1 }),
    body('role.*').isString().trim().escape(),
    body('accountType').optional().isIn(['Admin', 'User'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
      const { username, email, password, role, accountType } = req.body;
      const id = req.params.id;
      let updateSql = 'UPDATE users SET name=$1, email=$2, roles=$3, account_type=$4';
      let params = [username, email, Array.isArray(role) ? role : (role ? [role] : []), accountType || 'User', id];
      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        updateSql = 'UPDATE users SET name=$1, email=$2, password_hash=$3, roles=$4, account_type=$5 WHERE id=$6';
        params = [username, email, password_hash, Array.isArray(role) ? role : (role ? [role] : []), accountType || 'User', id];
      } else {
        updateSql += ' WHERE id=$5';
      }
      const result = await pool.query(updateSql, params);
      if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ _id: id, username, email, role: Array.isArray(role) ? role : (role ? [role] : []), accountType: accountType || 'User' });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

// DELETE a user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// --- Audit endpoint for unauthorized user-management page access ---
app.post('/api/audit-log-page-access', express.json(), (req, res) => {
  const now = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const user = req.body && req.body.user ? req.body.user : 'unknown';
  const reason = req.body && req.body.reason ? req.body.reason : 'unknown';
  const logMsg = `[${now}] Unauthorized user-management page access attempt by: ${user} (IP: ${ip}, UA: ${ua}) Reason: ${reason}`;
  try {
    fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');
  } catch (err) {
    console.error('Failed to write to audit.log:', err);
  }
  res.json({ success: true });
});

// --- Opps Monitoring Import/Export API ---
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const csv = require('fast-csv');

// Export opps_monitoring as CSV (import-template ready)
app.get('/api/opps-monitoring/export', async (req, res) => {
  try {
    // Get all columns in correct order for import template
    const columns = [
      'encoded_date','project_name','project_code','rev','client','solutions','sol_particulars','industries','ind_particulars','date_received','client_deadline','decision','account_mgr','pic','bom','status','submitted_date','margin','final_amt','opp_status','date_awarded_lost','lost_rca','l_particulars','a','c','r','u','d','remarks_comments','uid','forecast_date'
    ];
    const result = await pool.query('SELECT ' + columns.map(c => `"${c}"`).join(', ') + ' FROM opps_monitoring ORDER BY encoded_date DESC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="opps_monitoring_import_template.csv"');
    csv.write([columns, ...result.rows.map(row => columns.map(c => row[c]))], { headers: false }).pipe(res);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Failed to export opps_monitoring');
  }
});

// Import opps_monitoring from CSV (upsert/merge, preserve forecast values)
app.post('/api/opps-monitoring/import', upload.single('csvFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const fileRows = [];
  const columns = [
    'encoded_date','project_name','project_code','rev','client','solutions','sol_particulars','industries','ind_particulars','date_received','client_deadline','decision','account_mgr','pic','bom','status','submitted_date','margin','final_amt','opp_status','date_awarded_lost','lost_rca','l_particulars','a','c','r','u','d','remarks_comments','uid','forecast_date'
  ];
  fs.createReadStream(req.file.path)
    .pipe(csv.parse({ headers: columns, ignoreEmpty: true, trim: true }))
    .on('error', error => {
      console.error('CSV parse error:', error);
      res.status(400).json({ success: false, error: 'CSV parse error' });
    })
    .on('data', row => fileRows.push(row))
    .on('end', async () => {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const row of fileRows) {
            // Upsert: update all fields except forecast_date if uid exists, else insert
            const uid = row.uid;
            if (!uid) continue;
            // Remove empty strings/nulls for optional fields
            Object.keys(row).forEach(k => { if (row[k] === '') row[k] = null; });
            // Do not overwrite forecast_date if already present in DB
            const existing = await client.query('SELECT forecast_date FROM opps_monitoring WHERE uid = $1', [uid]);
            if (existing.rows.length > 0 && existing.rows[0].forecast_date) {
              row.forecast_date = existing.rows[0].forecast_date;
            }
            // Upsert
            const updateCols = columns.filter(c => c !== 'uid');
            const setClause = updateCols.map((c, i) => `"${c}" = $${i+2}`).join(', ');
            const values = updateCols.map(c => row[c]);
            values.unshift(uid); // $1 = uid
            const updateRes = await client.query(`UPDATE opps_monitoring SET ${setClause} WHERE uid = $1`, values);
            if (updateRes.rowCount === 0) {
              // Insert if not exists
              const insertCols = columns;
              const insertVals = insertCols.map((c, i) => `$${i+1}`);
              await client.query(`INSERT INTO opps_monitoring (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${insertVals.join(', ')})`, insertCols.map(c => row[c]));
            }
          }
          await client.query('COMMIT');
          res.json({ success: true });
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Import error:', err);
          res.status(500).json({ success: false, error: 'DB import error' });
        } finally {
          client.release();
          fs.unlink(req.file.path, () => {}); // Clean up temp file
        }
      } catch (err) {
        console.error('DB connect error:', err);
        res.status(500).json({ success: false, error: 'DB connect error' });
      }
    });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Serving static files from: ${__dirname}`);
  console.log(`Win/Loss Dashboard available at http://localhost:${port}/win-loss_dashboard.html`);
  console.log(`Forecast Dashboard available at http://localhost:${port}/forecast_dashboard.html`);
});
