```javascript
/**
 * Login page logic
 * Fixed version
 */

// FIX #1: Increased API timeout to 15 seconds
const API_TIMEOUT = 15000;

// FIX #2: Added retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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

// Form submission handler with debouncing
let isSubmitting = false;
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) return;
    isSubmitting = true;

    // Track click
    arguxai.click('login_button', {
        funnel_step: 'login_button_click'
    });

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // FIX #3: Added validation before API call
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        isSubmitting = false;
        return;
    }

    if (!password || password.length < 6) {
        showError('Password must be at least 6 characters');
        isSubmitting = false;
        return;
    }

    // Show loading
    loginButton.disabled = true;
    loginButton.style.display = 'none';
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';

    try {
        // Attempt login with retry logic
        const result = await loginUserWithRetry(email, password);

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
        isSubmitting = false;
    }
});

/**
 * Email validation helper
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Login API call with retry logic and better error handling
 */
async function loginUser(email, password) {
    // FIX: Use environment variable or fallback for API URL
    const API_URL = window.API_URL || 'https://demo-api.arguxai.com/login';

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

        // FIX #5: Check status code
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // FIX #6: Better error messages
        if (error.name === 'AbortError') {
            throw new Error('Login timed out. Please try again.');
        }

        if (!navigator.onLine) {
            throw new Error('Network error. Please check your internet connection.');
        }

        throw error;
    }
}

/**
 * Login with retry logic
 */
async function loginUserWithRetry(email, password, retryCount = 0) {
    try {
        return await loginUser(email, password);
    } catch (error) {
        if (retryCount < MAX_RETRIES && 
            (error.message.includes('timed out') || error.message.includes('Network'))) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
            return loginUserWithRetry(email, password, retryCount + 1);
        }
        throw error;
    }
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

// Track input changes for better analytics
document.getElementById('email').addEventListener('input', () => {
    arguxai.track('email_input_changed', {
        funnel_step: 'login_form'
    });
});

document.getElementById('password').addEventListener('input', () => {
    arguxai.track('password_input_changed', {
        funnel_step: 'login_form'
    });
});

// FIX #8: Ensure button is accessible on mobile
// Add touch event listener for better mobile support
loginButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    console.log('Button touched (mobile)!');
});

loginButton.addEventListener('click', (e) => {
    console.log('Button clicked!');
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

// Fix for mobile button positioning issue
function fixMobileButtonPosition() {
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        const button = document.getElementById('loginButton');
        if (button) {
            // Remove problematic absolute positioning styles
            button.style.position = '';
            button.style.bottom = '';
            
            // Ensure button is visible and accessible
            button.style.marginTop = '20px';
            button.style.width = '100%';
        }
    }
}

// Apply mobile fixes when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixMobileButtonPosition);
} else {
    fixMobileButtonPosition();
}

// Also apply on window resize for responsive adjustments
window.addEventListener('resize', fixMobileButtonPosition);

console.log('Login page initialized (fixed version)');
```