#!/bin/bash

# Script to update all API calls in the project to use the getApiUrl function

# Update app.js
sed -i '' "s|fetch('/api/|fetch(getApiUrl('/api/|g" "/Users/reuelrivera/Documents/CMRP Opps Management/app.js"
sed -i '' "s|fetch(\`/api/|fetch(getApiUrl(\`/api/|g" "/Users/reuelrivera/Documents/CMRP Opps Management/app.js"

# Update other JavaScript files that might have API calls
find "/Users/reuelrivera/Documents/CMRP Opps Management" -name "*.js" -not -name "app.js" -not -name "config.js" -exec sed -i '' "s|fetch('/api/|fetch(getApiUrl('/api/|g" {} \;
find "/Users/reuelrivera/Documents/CMRP Opps Management" -name "*.html" -exec sed -i '' "s|fetch('/api/|fetch(getApiUrl('/api/|g" {} \;

echo "API calls updated successfully!"
