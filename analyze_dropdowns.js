// This script will analyze all dropdown fields in the application
// Run this in your browser console to debug dropdown options

function analyzeDropdowns() {
    console.log('=== DROPDOWN ANALYSIS ===');
    
    // Get all field options from getFieldOptions
    const dropdownFields = [
        'decision', 
        'status', 
        'opp_status',
        'a', 'c', 'r', 'u', 'd',
        'solutions', 'sol_particulars', 
        'industries', 'ind_particulars',
        'submitted'
    ];
    
    console.log('\n1. OPTIONS FROM getFieldOptions():');
    dropdownFields.forEach(field => {
        const options = window.getFieldOptions ? window.getFieldOptions(field) : [];
        console.log(`${field}: ${options && options.length ? options.join(', ') : 'NO OPTIONS'}`);
    });
    
    // Try to find modals in the page
    const editModal = document.getElementById('editRowModal');
    const createModal = document.getElementById('createOpportunityModal');
    
    console.log('\n2. EDIT MODAL FIELDS:');
    if (editModal && editModal.style.display !== 'none' && !editModal.classList.contains('hidden')) {
        const selects = editModal.querySelectorAll('select');
        
        if (selects.length === 0) {
            console.log('No select elements found in Edit Modal');
        } else {
            selects.forEach(select => {
                const name = select.name || select.id;
                const options = Array.from(select.options).map(opt => opt.value);
                console.log(`${name}: ${options.join(', ')}`);
            });
        }
    } else {
        console.log('Edit Modal not open or not found');
    }
    
    console.log('\n3. CREATE MODAL FIELDS:');
    if (createModal && createModal.style.display !== 'none' && !createModal.classList.contains('hidden')) {
        const selects = createModal.querySelectorAll('select');
        
        if (selects.length === 0) {
            console.log('No select elements found in Create Modal');
        } else {
            selects.forEach(select => {
                const name = select.name || select.id;
                const options = Array.from(select.options).map(opt => opt.value);
                console.log(`${name}: ${options.join(', ')}`);
            });
        }
    } else {
        console.log('Create Modal not open or not found');
    }
    
    console.log('\n4. DROPDOWN_FIELDS constant:');
    if (window.DROPDOWN_FIELDS) {
        console.log(window.DROPDOWN_FIELDS);
    } else {
        console.log('DROPDOWN_FIELDS not found');
    }
    
    console.log('\n=== END ANALYSIS ===');
}

// Run the analysis
analyzeDropdowns();

// Add message to copy-paste and use
console.log('\nTo analyze dropdowns again, copy and run this function:');
console.log('analyzeDropdowns()');
