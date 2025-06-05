// Dashboard Delta Test Script
// Run this in the browser console on the main application page

console.log('🎯 Starting Dashboard Delta Functionality Test');
console.log('===============================================');

// Step 1: Check if the main functions exist
console.log('\n📋 Step 1: Function Availability Check');
if (typeof loadDashboardData === 'function') {
    console.log('✅ loadDashboardData function exists');
} else {
    console.log('❌ loadDashboardData function not found');
}

if (typeof window.testDashboardDelta === 'function') {
    console.log('✅ testDashboardDelta function exists');
} else {
    console.log('❌ testDashboardDelta function not found');
}

// Step 2: Check current localStorage state
console.log('\n📊 Step 2: localStorage State Check');
const currentData = localStorage.getItem('dashboardLastWeek');
if (currentData) {
    console.log('✅ Last week data found in localStorage:');
    try {
        const parsed = JSON.parse(currentData);
        console.log(parsed);
    } catch (e) {
        console.log('❌ Error parsing localStorage data:', e.message);
    }
} else {
    console.log('ℹ️ No last week data in localStorage (this is normal for first run)');
}

// Step 3: Check DOM elements
console.log('\n🎨 Step 3: DOM Elements Check');
const elements = [
    'totalOpportunities',
    'op100Summary', 
    'op90Summary',
    'totalInactive',
    'totalSubmitted',
    'totalDeclined'
];

elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ ${id}: "${element.textContent}"`);
    } else {
        console.log(`❌ ${id}: Element not found`);
    }
});

// Step 4: Create test data and test delta calculation
console.log('\n🧪 Step 4: Create Test Data & Test Deltas');

// Create sample last week data
const testLastWeekData = {
    totalOpportunities: 414,
    op100Count: 88,
    op90Count: 42,
    totalInactive: 17,
    totalSubmitted: 35,
    totalDeclined: 8
};

// Save test data
localStorage.setItem('dashboardLastWeek', JSON.stringify(testLastWeekData));
console.log('✅ Test last week data created:', testLastWeekData);

// Step 5: Run the dashboard update
console.log('\n🔄 Step 5: Running Dashboard Update');
if (typeof loadDashboardData === 'function') {
    try {
        loadDashboardData();
        console.log('✅ loadDashboardData() executed successfully');
        
        // Wait a moment for async operations
        setTimeout(() => {
            console.log('\n📊 Step 6: Final Results Check');
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const value = element.textContent;
                    const hasDelta = value.includes('(+') || value.includes('(-');
                    console.log(`${hasDelta ? '✅' : 'ℹ️'} ${id}: "${value}" ${hasDelta ? '(HAS DELTA!)' : '(no delta)'}`);
                }
            });
            
            console.log('\n🎉 Dashboard Delta Test Complete!');
            console.log('If you see "(+X)" or "(-X)" in the values above, the delta functionality is working! 🎯');
        }, 1000);
        
    } catch (error) {
        console.log('❌ Error running loadDashboardData():', error.message);
    }
} else {
    console.log('❌ Cannot run test - loadDashboardData function not available');
}

// Step 6: Instructions for manual testing
console.log('\n📝 Manual Testing Instructions:');
console.log('1. Look at the dashboard cards on the page');
console.log('2. Values should now show format like "440 (+26)" if delta functionality is working');
console.log('3. If you want to test again, run: window.testDashboardDelta()');
console.log('4. To clear test data, run: localStorage.removeItem("dashboardLastWeek")');
