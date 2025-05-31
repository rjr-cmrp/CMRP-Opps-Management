#!/usr/bin/env node

// Quick verification script for default column visibility settings
console.log('🔍 Verifying Default Column Visibility Settings\n');

// This mirrors the logic from app.js initializeColumnVisibility()
const defaultHiddenColumns = [
    'description', 'comments', 'uid', 'created_at', 'updated_at', 
    'encoded_date', 'A', 'C', 'R', 'U', 'D', 'rev', 'project_code',
    'sol_particulars', 'ind_particulars', 'lost_rca', 'l_particulars',
    'client_deadline', 'submitted_date', 'date_awarded_lost', 'forecast_date'
];

// Sample headers from the database (represents typical column structure)
const sampleHeaders = [
    'encoded_date', 'project_name', 'project_code', 'rev', 'client', 'solutions',
    'sol_particulars', 'industries', 'ind_particulars', 'date_received', 'client_deadline',
    'decision', 'account_mgr', 'pic', 'bom', 'status', 'submitted_date', 'margin',
    'final_amt', 'opp_status', 'date_awarded_lost', 'lost_rca', 'l_particulars',
    'A', 'C', 'R', 'U', 'D', 'remarks_comments', 'uid', 'forecast_date', 'description', 'comments'
];

console.log('📋 Checking which columns should be hidden by default...\n');

// Apply the same logic as in app.js (FIXED VERSION with exact match)
let visibilitySettings = {};
sampleHeaders.forEach(header => {
    const shouldHide = defaultHiddenColumns.some(col => 
        header.toLowerCase() === col.toLowerCase()
    );
    visibilitySettings[header] = !shouldHide;
    
    // Debug output for specific columns
    if (['A', 'C', 'R', 'U', 'D', 'encoded_date'].includes(header)) {
        const matchedCol = defaultHiddenColumns.find(col => 
            header.toLowerCase() === col.toLowerCase()
        );
        console.log(`DEBUG: ${header} -> shouldHide: ${shouldHide}, matched: ${matchedCol || 'none'}, visible: ${!shouldHide}`);
    }
});

// Check specifically for the requested columns
const requestedHiddenColumns = ['A', 'C', 'R', 'U', 'D', 'encoded_date'];
const visibleColumns = [];
const hiddenColumns = [];

Object.entries(visibilitySettings).forEach(([column, isVisible]) => {
    if (isVisible) {
        visibleColumns.push(column);
    } else {
        hiddenColumns.push(column);
    }
});

console.log('✅ VERIFICATION RESULTS:');
console.log('=======================\n');

// Check if requested columns are hidden
requestedHiddenColumns.forEach(col => {
    const isHidden = hiddenColumns.includes(col);
    const status = isHidden ? '✅ HIDDEN' : '❌ VISIBLE';
    console.log(`${col}: ${status}`);
});

console.log(`\n📊 Summary:`);
console.log(`- Total columns tested: ${sampleHeaders.length}`);
console.log(`- Visible columns: ${visibleColumns.length}`);
console.log(`- Hidden columns: ${hiddenColumns.length}`);

console.log(`\n🙈 Hidden columns: ${hiddenColumns.join(', ')}`);
console.log(`\n👁️  Visible columns: ${visibleColumns.join(', ')}`);

// Check if all requested columns are properly hidden
const allRequestedHidden = requestedHiddenColumns.every(col => hiddenColumns.includes(col));

if (allRequestedHidden) {
    console.log('\n🎉 SUCCESS: All requested columns (A, C, R, U, D, encoded_date) are hidden by default!');
} else {
    const stillVisible = requestedHiddenColumns.filter(col => !hiddenColumns.includes(col));
    console.log(`\n⚠️  WARNING: Some requested columns are still visible: ${stillVisible.join(', ')}`);
}

console.log('\n✅ Default column visibility verification complete.');
