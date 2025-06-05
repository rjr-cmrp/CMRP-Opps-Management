// This script removes the debug logging added during dropdown field troubleshooting
// Run it after confirming all the dropdowns are working correctly

const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, 'app.js');

console.log('=== REMOVING DEBUG LOGGING ===');
console.log('Reading app.js...');

try {
    let appJs = fs.readFileSync(APP_JS_PATH, 'utf8');
    const originalLength = appJs.length;
    let debugLinesRemoved = 0;
    
    // Replace debug console logs for dropdown creation
    const patterns = [
        /\s*console\.log\(\s*`\[DEBUG\].*Field.*getFieldOptions.*\);/g,
        /\s*console\.log\(\s*`\[DEBUG\].*Creating SELECT dropdown.*\);/g,
        /\s*console\.log\(\s*`\[DEBUG\].*Adding .* options to.*\);/g,
        /\s*console\.log\(\s*`\[DEBUG\].*Checking field.*\);/g,
        /\s*console\.log\(\s*`\[DEBUG\].*ACRUD field detected.*\);/g,
        /\s*\/\/ Special debug for ACRUD fields.*\s*\/\/ Special debug for ACRUD fields.*\s*/g,
    ];
    
    patterns.forEach(pattern => {
        const before = appJs.length;
        appJs = appJs.replace(pattern, '');
        const after = appJs.length;
        const linesRemoved = (before - after) / 50; // rough estimate of lines
        debugLinesRemoved += linesRemoved;
    });
    
    // Write the cleaned file
    fs.writeFileSync(APP_JS_PATH, appJs, 'utf8');
    
    console.log('✅ Debug logging removed successfully!');
    console.log(`- File size reduced by ~${(originalLength - appJs.length)} bytes`);
    console.log(`- Approximately ${Math.round(debugLinesRemoved)} debug lines removed`);
    console.log('\nYou can now restart the server with the clean version.');
} catch (error) {
    console.error('❌ Error cleaning debug logs:', error);
}
