console.log("=== SERVER.JS STARTED ===");
const express = require('express');
const path = require('path'); // Import the path module
const { Pool } = require('pg'); // Import PostgreSQL client
const { v4: uuidv4 } = require('uuid'); // Import uuid package

const app = express();
const port = 3000; // You can change the port if needed

// PostgreSQL connection pool
const pool = new Pool({
  user: 'reuelrivera', // Replace with your actual username if different
  host: 'localhost',
  database: 'opps_management', // Replace with your actual database name if different
  password: '', // Replace with your actual password if you have one
  port: 5432, // Default PostgreSQL port
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
app.use(express.static(__dirname));
app.use(express.json());

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
    // *** FIX: Use correct column name "solutions" (lowercase, plural) ***
    // Also select account_mgr for unique Account Manager list
    const result = await pool.query('SELECT opp_status, date_awarded_lost, final_amt, solutions, account_mgr FROM opps_monitoring');
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
    res.status(500).json({ error: 'Failed to generate win/loss dashboard data', details: error.message });
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
    console.log(`[API /api/forecast-dashboard] Fetched ${opportunities.length} relevant opportunities for status: ${requestedStatus || 'all'}.`);
    const forecastData = calculateForecastDashboardData(opportunities);
    console.log("[API /api/forecast-dashboard] Calculation complete. Sending data:", forecastData);
    res.json(forecastData);
  } catch (error) {
    console.error('[API /api/forecast-dashboard] Error generating forecast dashboard data:', error);
    res.status(500).json({ error: 'Failed to generate forecast dashboard data', details: error.message });
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
    // ... (implementation remains the same) ...
    try {
        const result = await pool.query(`...`);
        // ... (week calculation logic) ...
        res.json({ weekSummary: weekSummaryArr });
    } catch (error) { /* ... error handling ... */ }
});

app.post('/api/opportunities', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to create opportunity.', details: error.message });
  }
});


// PUT Endpoint with Revision Logic v5
app.put('/api/opportunities/:uid', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update opportunity.', details: error.message });
  } finally {
    client.release();
  }
});


app.delete('/api/opportunities/:uid', async (req, res) => {
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
      res.status(500).json({ error: 'Failed to delete opportunity.', details: error.message });
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
    res.status(500).json({ error: 'Failed to fetch revision history.', details: error.message });
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
    res.status(500).json({ error: 'Failed to fetch forecast revision history.', details: error.message });
  }
});

// --- Static File Serving & Server Start ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); }); // Keep old dashboard route if needed
app.get('/win-loss_dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'win-loss_dashboard.html')); });
// *** UPDATED: Route for the new forecast dashboard page (matching case) ***
app.get('/Forecast_Dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Forecast_Dashboard.html'));
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Serving static files from: ${__dirname}`);
  console.log(`Win/Loss Dashboard available at http://localhost:${port}/win-loss_dashboard.html`);
  // *** UPDATED: Log for forecast dashboard URL (matching case) ***
  console.log(`Forecast Dashboard available at http://localhost:${port}/Forecast_Dashboard.html`);
});
