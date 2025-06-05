// Configuration for production deployment
const config = {
    // For production, use your Render backend URL
    // For development, use localhost
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://cmrp-opps-backend.onrender.com', // Your actual backend URL
    
    // Other configuration options
    APP_NAME: 'CMRP Opps Management',
    VERSION: '1.0.0'
};

// Make config available globally
window.APP_CONFIG = config;
