// Debug script to test action buttons specifically
// Run this in the browser console of the main application

console.log('🔍 Testing Action Buttons Implementation');

// Check if main functions exist
console.log('Functions available:');
console.log('- initializeTableHeader:', typeof initializeTableHeader);
console.log('- populateTableBody:', typeof populateTableBody);
console.log('- filterAndSortData:', typeof filterAndSortData);

// Check table structure
const table = document.getElementById('opportunitiesTable');
if (table) {
    console.log('📋 Table found');
    
    // Check headers
    const headers = table.querySelectorAll('thead th');
    console.log(`Headers count: ${headers.length}`);
    
    headers.forEach((header, index) => {
        console.log(`Header ${index}: "${header.textContent.trim()}"`);
    });
    
    // Check for Actions header specifically
    const actionsHeader = Array.from(headers).find(h => 
        h.textContent.trim().toLowerCase() === 'actions'
    );
    console.log('Actions header found:', !!actionsHeader);
    
    // Check table body
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        console.log(`Data rows count: ${rows.length}`);
        
        if (rows.length > 0) {
            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('td');
            console.log(`First row cells: ${cells.length}`);
            
            // Check last cell for action buttons
            if (cells.length > 0) {
                const lastCell = cells[cells.length - 1];
                const buttons = lastCell.querySelectorAll('button');
                console.log(`Action buttons in last cell: ${buttons.length}`);
                
                buttons.forEach((btn, index) => {
                    console.log(`Button ${index}: ${btn.title || btn.textContent || 'No title'}`);
                });
            }
        }
    }
} else {
    console.log('❌ Table not found');
}

// Check column visibility
if (typeof columnVisibility !== 'undefined') {
    console.log('📊 Column Visibility Settings:');
    Object.entries(columnVisibility).forEach(([col, visible]) => {
        console.log(`${col}: ${visible ? 'visible' : 'hidden'}`);
    });
} else {
    console.log('❌ columnVisibility not defined');
}

// Test rebuilding table
console.log('🔄 Testing table rebuild...');
if (typeof initializeTableHeader === 'function') {
    initializeTableHeader();
    console.log('✅ initializeTableHeader() called');
}

if (typeof filterAndSortData === 'function') {
    filterAndSortData();
    console.log('✅ filterAndSortData() called');
}

console.log('🔍 Debug test completed');
