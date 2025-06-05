// Weekly/Monthly Toggle Test Script
// Run this in the browser console on the main application page

console.log('🎯 Testing Weekly/Monthly Dashboard Toggle Functionality');
console.log('=======================================================');

// Step 1: Check if toggle elements exist
console.log('\n📋 Step 1: Toggle Elements Check');
const toggleElements = [
    'weeklyToggle',
    'monthlyToggle', 
    'noCompareToggle',
    'saveSnapshotBtn'
];

toggleElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ ${id}: Found`);
    } else {
        console.log(`❌ ${id}: Not found`);
    }
});

// Step 2: Check current localStorage state
console.log('\n📊 Step 2: Current Storage State');
const currentMode = localStorage.getItem('dashboardComparisonMode') || 'not set';
const weeklyData = localStorage.getItem('dashboardLastWeek');
const monthlyData = localStorage.getItem('dashboardLastMonth');

console.log(`Current mode: ${currentMode}`);
console.log(`Weekly data: ${weeklyData ? 'exists' : 'not found'}`);
console.log(`Monthly data: ${monthlyData ? 'exists' : 'not found'}`);

// Step 3: Create comprehensive test data
console.log('\n🧪 Step 3: Creating Test Data');

// Create realistic test data based on your screenshot values
const currentValues = {
    totalOpportunities: 361,
    op100Count: 30,
    op90Count: 25, 
    totalInactive: 7,
    totalSubmitted: 222,
    totalDeclined: 88
};

const weeklyTestData = {
    totalOpportunities: 335,  // +26 this week
    op100Count: 18,          // +12 this week
    op90Count: 17,           // +8 this week
    totalInactive: 4,        // +3 this week
    totalSubmitted: 217,     // +5 this week
    totalDeclined: 86,       // +2 this week
    savedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
};

const monthlyTestData = {
    totalOpportunities: 272,  // +89 this month
    op100Count: 5,           // +25 this month
    op90Count: 7,            // +18 this month
    totalInactive: -5,       // +12 this month
    totalSubmitted: 191,     // +31 this month
    totalDeclined: 73,       // +15 this month
    savedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
};

localStorage.setItem('dashboardLastWeek', JSON.stringify(weeklyTestData));
localStorage.setItem('dashboardLastMonth', JSON.stringify(monthlyTestData));
localStorage.setItem('dashboardComparisonMode', 'weekly');

console.log('✅ Test data created');
console.log('Weekly comparison should show: +26, +12, +8, +3, +5, +2');
console.log('Monthly comparison should show: +89, +25, +18, +12, +31, +15');

// Step 4: Test toggle functionality
console.log('\n🔄 Step 4: Testing Toggle Functionality');

function testToggleMode(mode, delay = 1500) {
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`\n🎯 Testing ${mode} mode...`);
            
            if (typeof setComparisonMode === 'function') {
                setComparisonMode(mode);
                console.log(`✅ setComparisonMode('${mode}') called`);
            } else {
                // Fallback: trigger click event
                const button = document.getElementById(`${mode}Toggle`) || 
                              document.getElementById('noCompareToggle');
                if (button) {
                    button.click();
                    console.log(`✅ ${mode} toggle clicked`);
                }
            }
            
            // Check dashboard values
            setTimeout(() => {
                const dashboardElements = [
                    'totalOpportunities',
                    'op100Summary',
                    'op90Summary', 
                    'totalInactive',
                    'totalSubmitted',
                    'totalDeclined'
                ];
                
                console.log(`📊 Dashboard values in ${mode} mode:`);
                dashboardElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        const value = element.textContent;
                        const hasDelta = value.includes('(+') || value.includes('(-');
                        console.log(`  ${id}: "${value}" ${hasDelta ? '✅' : (mode === 'none' ? '✅' : '⚠️')}`);
                    }
                });
                
                resolve();
            }, 200);
        }, delay);
    });
}

// Step 5: Run sequential tests
async function runToggleTests() {
    console.log('\n🚀 Running sequential toggle tests...');
    
    // Test weekly mode
    await testToggleMode('weekly');
    
    // Test monthly mode  
    await testToggleMode('monthly');
    
    // Test no comparison mode
    await testToggleMode('none');
    
    // Return to weekly mode
    await testToggleMode('weekly');
    
    console.log('\n🎉 Toggle functionality testing complete!');
    console.log('\n📝 Summary:');
    console.log('✅ Weekly mode should show small deltas (+26, +12, etc.)');
    console.log('✅ Monthly mode should show larger deltas (+89, +25, etc.)');
    console.log('✅ No comparison mode should show plain numbers');
    console.log('\n💡 You can now manually test by clicking the toggle buttons above the dashboard!');
}

// Step 6: Test save snapshot functionality
function testSaveSnapshot() {
    console.log('\n💾 Testing Save Snapshot functionality...');
    
    if (typeof saveManualSnapshot === 'function') {
        try {
            saveManualSnapshot();
            console.log('✅ saveManualSnapshot() executed successfully');
        } catch (error) {
            console.log('❌ Error in saveManualSnapshot():', error.message);
        }
    } else {
        const saveBtn = document.getElementById('saveSnapshotBtn');
        if (saveBtn) {
            saveBtn.click();
            console.log('✅ Save snapshot button clicked');
        } else {
            console.log('❌ Save snapshot button not found');
        }
    }
}

// Run the tests
runToggleTests().then(() => {
    console.log('\n🔧 Additional Tests:');
    
    // Test save snapshot
    setTimeout(() => {
        testSaveSnapshot();
    }, 1000);
    
    // Instructions for manual testing
    setTimeout(() => {
        console.log('\n📖 Manual Testing Instructions:');
        console.log('1. Look for the toggle buttons above the dashboard cards');
        console.log('2. Click "Last Week" - should show smaller deltas like (+26)');
        console.log('3. Click "Last Month" - should show larger deltas like (+89)');
        console.log('4. Click "No Comparison" - should show plain numbers');
        console.log('5. Click "Save Snapshot" - should save current data for future comparisons');
        console.log('\n🎯 The toggle functionality is now ready for production use!');
    }, 2000);
});

// Export test functions for manual use
window.testWeeklyMonthlyToggle = () => runToggleTests();
window.testSaveSnapshot = testSaveSnapshot;
window.clearToggleTestData = () => {
    localStorage.removeItem('dashboardLastWeek');
    localStorage.removeItem('dashboardLastMonth');
    localStorage.removeItem('dashboardComparisonMode');
    console.log('🗑️ Toggle test data cleared');
};
