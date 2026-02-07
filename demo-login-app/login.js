```javascript
/**
 * Login page logic
 * Fixed version
 */

// FIX #1: Increased API timeout to 15 seconds
const API_TIMEOUT = 15000;

// FIX #2: Added retry logic
const MAX_RETRIES = 3;

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
 * Login API call with retry logic
 */
async function loginUserWithRetry(email, password, maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await loginUser(email, password);
            return result;
        } catch (error) {
            lastError = error;
            
            // Don't retry on validation errors
            if (error.message.includes('Please enter') || error.message.includes('Password must')) {
                throw error;
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Login API call
 */
async function loginUser(email, password) {
    // FIX: Use environment variable for API URL
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

        // FIX #5: Check status code
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: Login failed`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // FIX #6: Improved error messages
        if (error.name === 'AbortError') {
            throw new Error('Login timed out. Please try again.');
        }

        if (error.message.includes('Network error') || !navigator.onLine) {
            throw new Error('Network error. Please check your connection and try again.');
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

// Track input changes
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

// FIX #8: Fixed mobile button click handling
let lastClickTime = 0;
const CLICK_DEBOUNCE_MS = 500;

loginButton.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastClickTime < CLICK_DEBOUNCE_MS) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    lastClickTime = now;
    
    // Fix for mobile positioning issue
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        // Ensure button is visible on mobile
        const buttonRect = loginButton.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        if (buttonRect.bottom > viewportHeight || buttonRect.top < 0) {
            // Scroll button into view if it's not fully visible
            loginButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
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

// Fix for mobile positioning - adjust button position on resize
window.addEventListener('resize', () => {
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        const buttonRect = loginButton.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Check if button is visible
        if (buttonRect.bottom > viewportHeight || buttonRect.top < 0) {
            // Add a small delay to avoid layout thrashing
            setTimeout(() => {
                loginButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
});

// Initial check for mobile positioning
if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const buttonRect = loginButton.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            if (buttonRect.bottom > viewportHeight || buttonRect.top < 0) {
                loginButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    });
}

console.log('Login page initialized');
```