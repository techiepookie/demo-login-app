```javascript
/**
 * Login page logic
 * Fixed version
 */

// FIX: Increased API timeout to prevent failures
const API_TIMEOUT = 15000; // Increased from 5 to 15 seconds

// FIX: Added retry logic for failed requests
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

// FIX: Added debouncing to prevent duplicate submissions
let isSubmitting = false;

// Form submission handler
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

    // FIX: Added email validation before API call
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
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
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Login API call with retry logic
 */
async function loginUserWithRetry(email, password, retryCount = 0) {
    try {
        return await loginUser(email, password);
    } catch (error) {
        if (retryCount < MAX_RETRIES && !error.message.includes('Invalid credentials')) {
            console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return loginUserWithRetry(email, password, retryCount + 1);
        }
        throw error;
    }
}

/**
 * Login API call
 */
async function loginUser(email, password) {
    // FIX: Use environment variable or fallback for API URL
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

        // FIX: Check status code before parsing response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // FIX: Improved error messages with better error handling
        if (error.name === 'AbortError') {
            throw new Error('Login timed out. Please try again.');
        }

        if (error.message.includes('Network error') || !navigator.onLine) {
            throw new Error('Network error. Please check your connection and try again.');
        }

        if (error.message.includes('Failed to fetch')) {
            throw new Error('Unable to connect to server. Please try again later.');
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

// Track input focus
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

// FIX: Added click tracking for input fields
document.getElementById('email').addEventListener('click', () => {
    arguxai.track('email_input_clicked', {
        funnel_step: 'login_form'
    });
});

document.getElementById('password').addEventListener('click', () => {
    arguxai.track('password_input_clicked', {
        funnel_step: 'login_form'
    });
});

// FIX: Fixed mobile button click issue by ensuring proper event handling
loginButton.addEventListener('click', (e) => {
    console.log('Button clicked!');
    // Trigger form submission programmatically to ensure it works
    if (!isSubmitting) {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// FIX: Added CSS fix for mobile positioning
function fixMobileButtonPosition() {
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        const button = document.getElementById('loginButton');
        if (button) {
            // Remove problematic absolute positioning for mobile
            button.style.position = 'relative';
            button.style.bottom = '0';
            button.style.marginTop = '20px';
        }
    }
}

// Apply mobile fix on load and resize
window.addEventListener('load', fixMobileButtonPosition);
window.addEventListener('resize', fixMobileButtonPosition);

// Track page unload (user leaving without logging in)
window.addEventListener('beforeunload', () => {
    arguxai.track('login_page_exit', {
        funnel_step: 'login_abandoned',
        time_on_page: Date.now() - window.performance.timing.navigationStart
    });

    // Force flush events before page closes
    arguxai.flush();
});

console.log('Login page initialized (fixed version)');
```