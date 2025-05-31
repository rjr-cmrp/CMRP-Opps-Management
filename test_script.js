// Quick test script for table functionality
// Run this in the browser console to test

function testTableFunctionality() {
    console.log('=== TESTING TABLE FUNCTIONALITY ===');
    
    // Test 1: Check if table exists
    const table = document.getElementById('opportunitiesTable');
    const container = document.querySelector('.table-container');
    
    if (!table) {
        console.error('❌ Table not found');
        return;
    }
    
    if (!container) {
        console.error('❌ Container not found');
        return;
    }
    
    console.log('✅ Table and container found');
    
    // Test 2: Check sticky columns
    const stickyHeaders = table.querySelectorAll('thead th.sticky-col');
    const stickyCells = table.querySelectorAll('tbody td.sticky-col');
    
    console.log('🏷️ Sticky elements:');
    console.log('  - Headers:', stickyHeaders.length);
    console.log('  - Cells:', stickyCells.length);
    
    if (stickyHeaders.length === 0) {
        console.warn('⚠️ No sticky headers found - running patch...');
        if (typeof patchStickyProjectNameColumn === 'function') {
            patchStickyProjectNameColumn();
        }
    }
    
    // Test 3: Check scrolling capability
    console.log('📊 Scroll info:');
    console.log('  - Container size:', container.offsetWidth + 'x' + container.offsetHeight);
    console.log('  - Scroll area:', container.scrollWidth + 'x' + container.scrollHeight);
    console.log('  - Can scroll horizontally:', container.scrollWidth > container.offsetWidth);
    console.log('  - Can scroll vertically:', container.scrollHeight > container.offsetHeight);
    console.log('  - Overflow X:', getComputedStyle(container).overflowX);
    console.log('  - Overflow Y:', getComputedStyle(container).overflowY);
    
    // Test 4: Test actual scrolling
    const originalLeft = container.scrollLeft;
    const originalTop = container.scrollTop;
    
    console.log('🧪 Testing scrolling...');
    container.scrollLeft = Math.min(100, container.scrollWidth - container.offsetWidth);
    container.scrollTop = Math.min(50, container.scrollHeight - container.offsetHeight);
    
    setTimeout(() => {
        console.log('  - After scroll test:', container.scrollLeft + ', ' + container.scrollTop);
        
        // Check if sticky is working during scroll
        const firstStickyCell = table.querySelector('tbody td.sticky-col');
        if (firstStickyCell) {
            const rect = firstStickyCell.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            console.log('  - First sticky cell visible:', rect.left >= containerRect.left - 5);
        }
        
        // Restore original position
        container.scrollLeft = originalLeft;
        container.scrollTop = originalTop;
        
        console.log('✅ Tests complete');
    }, 100);
}

// Make function available globally
window.testTableFunctionality = testTableFunctionality;

console.log('📝 Test script loaded. Run testTableFunctionality() to test the table.');
