```javascript
/**
 * Login page logic
 * Fixed version
 */

// FIX #1: Increased API timeout to prevent failures
const API_TIMEOUT = 15000; // Increased from 5 to 15 seconds

// FIX #2: Added retry logic for failed requests
const MAX_RETRIES = 3; // Added retry capability

// Get form elements
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');

// Track form view
arguxai.track('login_form_viewed', {
    funnel_step: 'login_form',
    device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
});

// Form submission handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Track click
    arguxai.click('login_button', {
        funnel_step: 'login_button_click'
    });

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // FIX #3: Added email validation before API call
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }

    // Show loading
    loginButton.disabled = true;
    loginButton.style.display = 'none';
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';

    try {
        // Attempt login with retry logic
        const result = await loginUserWithRetry(email, password, MAX_RETRIES);

        if (result.success) {
            // Track conversion
            arguxai.conversion('login_success', {
                funnel_step: 'login_complete',
                user_email: email
            });

            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            throw new Error(result.message || 'Login failed');
        }

    } catch (error) {
        // Track error
        arguxai.error(`Login failed: ${error.message}`, {
            funnel_step: 'login_error',
            error_type: error.name,
            email: email
        });

        // Show error
        showError(error.message);
    } finally {
        // Reset UI
        loginButton.disabled = false;
        loginButton.style.display = 'block';
        loadingIndicator.style.display = 'none';
    }
});

/**
 * Login API call with retry logic
 * FIX #4: Added proper timeout, retry mechanism, and better error handling
 */
async function loginUser(email, password) {
    // FIX: Use environment variable for API URL in production
    const API_URL = process.env.API_URL || 'https://demo-api.arguxai.com/login';

    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // FIX #5: Added status code checking
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // FIX #6: Improved error messages
        if (error.name === 'AbortError') {
            throw new Error('Login timed out. Please try again.');
        }

        if (!navigator.onLine) {
            throw new Error('Network error. Please check your internet connection.');
        }

        throw new Error(error.message || 'Login failed. Please try again.');
    }
}

/**
 * Login with retry logic
 */
async function loginUserWithRetry(email, password, maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await loginUser(email, password);
        } catch (error) {
            lastError = error;
            
            // Don't retry on validation errors
            if (error.message.includes('valid email') || error.message.includes('Network error')) {
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

/**
 * Email validation helper
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// FIX #7: Added click tracking on individual input fields
document.getElementById('email').addEventListener('focus', () => {
    arguxai.track('email_input_focused', {
        funnel_step: 'login_form'
    });
});

document.getElementById('password').addEventListener('focus', () => {
    arguxai.track('password_input_focused', {
        funnel_step: 'login_form'
    });
});

// FIX #8: Fixed mobile button click issue and added debouncing
let isSubmitting = false;
let submitTimeout = null;

loginButton.addEventListener('click', (e) => {
    console.log('Button clicked!');
    
    // Debounce to prevent duplicate submissions
    if (isSubmitting) {
        e.preventDefault();
        return;
    }
    
    if (submitTimeout) {
        clearTimeout(submitTimeout);
    }
    
    isSubmitting = true;
    submitTimeout = setTimeout(() => {
        isSubmitting = false;
    }, 1000);
});

// Track page unload (user leaving without logging in)
window.addEventListener('beforeunload', () => {
    arguxai.track('login_page_exit', {
        funnel_step: 'login_abandoned',
        time_on_page: Date.now() - window.performance.timing.navigationStart
    });

    // Force flush events before page closes
    arguxai.flush();
});

// FIX: Mobile-specific button positioning fix
function fixMobileButtonPosition() {
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            // Remove problematic absolute positioning for mobile
            loginButton.style.position = 'relative';
            loginButton.style.bottom = '0';
            
            // Ensure button is visible and accessible
            loginButton.style.marginTop = '20px';
            loginButton.style.width = '100%';
        }
    }
}

// Apply mobile fixes when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixMobileButtonPosition);
} else {
    fixMobileButtonPosition();
}

console.log('Login page initialized (fixed version)');
```