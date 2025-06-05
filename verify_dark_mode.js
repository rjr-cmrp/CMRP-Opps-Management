// Verification script for dark mode default functionality
// This script can be run in the browser console to verify dark mode is working correctly

console.log('=== DARK MODE DEFAULT VERIFICATION ===');

// Check if theme is stored in localStorage
const storedTheme = localStorage.getItem('theme');
console.log('Stored theme in localStorage:', storedTheme);

// Check if body has dark theme class
const bodyClasses = document.body.classList;
console.log('Body classes:', Array.from(bodyClasses));

// Check if dark theme is active
const isDarkTheme = document.body.classList.contains('dark-theme');
console.log('Is dark theme active?', isDarkTheme);

// Check current theme preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
console.log('System prefers dark mode?', prefersDark);

// Verify logo source (should show light logo in dark mode)
const logo = document.querySelector('.logo img');
if (logo) {
    console.log('Logo source:', logo.src);
    const isLightLogo = logo.src.includes('CMRP_Logo_Light');
    console.log('Is using light logo (correct for dark mode)?', isLightLogo);
} else {
    console.log('No logo found on this page');
}

// Test theme toggle if available
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    console.log('Theme toggle found:', themeToggle);
} else {
    console.log('No theme toggle found on this page');
}

console.log('=== VERIFICATION COMPLETE ===');

// Function to clear localStorage and test fresh load
window.testFreshLoad = function() {
    console.log('Clearing localStorage and reloading...');
    localStorage.removeItem('theme');
    location.reload();
};

// Function to manually toggle theme for testing
window.testToggle = function() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    console.log('Toggled to theme:', newTheme);
    
    // Update logo if present
    const logo = document.querySelector('.logo img');
    if (logo) {
        if (newTheme === 'dark') {
            logo.src = 'assets/CMRP_Logo_Light.png';
        } else {
            logo.src = 'assets/CMRP_Logo_Dark.png';
        }
    }
};

console.log('Available test functions:');
console.log('- testFreshLoad(): Clear localStorage and reload page');
console.log('- testToggle(): Manually toggle between light and dark themes');
