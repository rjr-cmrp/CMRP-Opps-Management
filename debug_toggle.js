// Quick debug script to inject into browser console
console.log('🔧 TOGGLE DEBUG SCRIPT LOADED');

// Check if main elements exist
const toggleBtn = document.getElementById('toggleColumnsButton');
const toggleContainer = document.getElementById('columnToggleContainer');
const table = document.getElementById('opportunitiesTable');

console.log('📋 Element Check:');
console.log('- Toggle Button:', toggleBtn ? '✅ Found' : '❌ Missing');
console.log('- Toggle Container:', toggleContainer ? '✅ Found' : '❌ Missing');
console.log('- Table:', table ? '✅ Found' : '❌ Missing');

if (toggleContainer) {
    console.log('- Container Classes:', toggleContainer.className);
    console.log('- Container Content Length:', toggleContainer.innerHTML.length);
    
    const checkboxes = toggleContainer.querySelectorAll('input[type="checkbox"]');
    console.log('- Checkboxes Found:', checkboxes.length);
    
    checkboxes.forEach((cb, i) => {
        console.log(`  ${i}: ${cb.dataset.columnName} (${cb.checked ? 'checked' : 'unchecked'})`);
    });
}

if (table) {
    const rows = table.querySelector('tbody')?.querySelectorAll('tr') || [];
    console.log('- Table Rows:', rows.length);
    
    if (rows.length > 0) {
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('td');
        console.log('- First Row Cells:', cells.length);
        
        if (cells.length > 0) {
            const lastCell = cells[cells.length - 1];
            const actionButtons = lastCell.querySelectorAll('button');
            console.log('- Action Buttons in Last Cell:', actionButtons.length);
            
            actionButtons.forEach((btn, i) => {
                console.log(`  Button ${i}: ${btn.title || btn.textContent || 'untitled'}`);
            });
        }
    }
}

// Test toggle functionality
if (toggleBtn && toggleContainer) {
    console.log('🧪 Testing toggle functionality...');
    
    const initialState = toggleContainer.classList.contains('hidden');
    console.log('- Initial state:', initialState ? 'hidden' : 'visible');
    
    toggleBtn.click();
    
    setTimeout(() => {
        const afterClickState = toggleContainer.classList.contains('hidden');
        console.log('- After click state:', afterClickState ? 'hidden' : 'visible');
        console.log('- Toggle Working:', initialState !== afterClickState ? '✅ YES' : '❌ NO');
    }, 100);
}

// Check if app is authenticated and has data
console.log('📊 App State:');
console.log('- Opportunities array length:', window.opportunities?.length || 'undefined');
console.log('- Headers array length:', window.headers?.length || 'undefined');
console.log('- Column visibility object:', window.columnVisibility ? Object.keys(window.columnVisibility).length + ' columns' : 'undefined');
