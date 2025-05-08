const xlsx = require('xlsx');
const path = require('path');

// Define the path to the Excel file
const filePath = path.join(__dirname, 'Opportunity_All.xlsx');

function readOpportunities() {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);

    // Get the first sheet name
    const sheetName = workbook.SheetNames[0];

    // Get the data from the first sheet
    // Use cellDates: true to attempt parsing Excel date serial numbers
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { cellDates: true });

    // Optional: Clean up data further if needed (e.g., parse currency strings)
    // sheetData.forEach(row => {
    //   if (row['Final amt']) {
    //     // Example: Remove currency symbols and convert to number
    //     const finalAmtString = String(row['Final amt']);
    //     row['Final amt'] = parseFloat(finalAmtString.replace(/[^\d.-]/g, '')) || 0;
    //   }
    //   // Add similar cleaning for other numeric/date fields if necessary
    // });

    return sheetData;
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return []; // Return empty array on error
  }
}

// If run directly, log the data (for testing the script)
if (require.main === module) {
  console.log(readOpportunities());
}

module.exports = { readOpportunities };