```javascript
/**
 * Login page logic
 * Fixed version with Twilio API improvements
 */

// Fixed: Increased timeout for international API calls
const API_TIMEOUT = 30000; // 30 seconds for international Twilio calls

// Fixed: Added retry logic for Twilio API failures
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second initial delay

// Fixed: Added exponential backoff for rate limiting
const RETRY_BACKOFF_FACTOR = 2;

// Fixed: Added rate limiting tracking
let rateLimitResetTime = 0;
let consecutiveFailures = 0;

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

// Fixed: Added form submission debouncing
let isSubmitting = false;

// Form submission handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) {
        return;
    }

    isSubmitting = true;

    // Track click
    arguxai.click('login_button', {
        funnel_step: 'login_button_click'
    });

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Fixed: Added email validation before API call
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
        isSubmitting = false;
        return;
    }

    // Fixed: Check rate limiting before attempting
    if (Date.now() < rateLimitResetTime) {
        const waitTime = Math.ceil((rateLimitResetTime - Date.now()) / 1000);
        showError(`Too many attempts. Please wait ${waitTime} seconds before trying again.`);
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
            // Reset failure counter on success
            consecutiveFailures = 0;

            // Track conversion
            arguxai.conversion('login_success', {
                funnel_step: 'login_complete',
                user_email: email
            });

            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            // Handle specific Twilio errors
            if (result.errorCode === 'rate_limited') {
                consecutiveFailures++;
                rateLimitResetTime = Date.now() + (60000 * Math.pow(2, Math.min(consecutiveFailures - 1, 4))); // Exponential backoff up to 16 minutes
                throw new Error('Too many attempts. Please wait before trying again.');
            } else if (result.errorCode === 'twilio_timeout') {
                throw new Error('OTP service is temporarily unavailable. Please try again in a moment.');
            } else {
                throw new Error(result.message || 'Login failed');
            }
        }

    } catch (error) {
        // Track error with specific type
        arguxai.error(`Login failed: ${error.message}`, {
            funnel_step: 'login_error',
            error_type: error.name,
            email: email,
            consecutive_failures: consecutiveFailures,
            is_rate_limited: Date.now() < rateLimitResetTime
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
        // Check if we should retry
        if (retryCount < MAX_RETRIES && 
            (error.name === 'AbortError' || 
             error.message.includes('Network error') ||
             error.message.includes('temporarily unavailable'))) {
            
            // Calculate delay with exponential backoff
            const delay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, retryCount);
            
            // Track retry attempt
            arguxai.track('login_retry_attempt', {
                retry_count: retryCount + 1,
                max_retries: MAX_RETRIES,
                delay_ms: delay,
                error_type: error.name
            });

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Retry the request
            return await loginUserWithRetry(email, password, retryCount + 1);
        }
        
        // Max retries reached or non-retryable error
        throw error;
    }
}

/**
 * Login API call with improved error handling
 */
async function loginUser(email, password) {
    // Fixed: Use environment variable or fallback
    const API_URL = process.env.API_URL || 'https://demo-api.arguxai.com/login';

    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Region': getClientRegion() // Added for regional routing
            },
            body: JSON.stringify({ email, password }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Fixed: Check status code
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle specific Twilio errors
            if (response.status === 429) {
                throw new Error('rate_limited');
            } else if (response.status === 504) {
                throw new Error('twilio_timeout');
            }
            
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        // Fixed: Improved error messages with specific handling
        if (error.name === 'AbortError') {
            throw new Error('OTP service is taking longer than expected. Please try again.');
        } else if (error.message === 'rate_limited') {
            throw new Error('rate_limited');
        } else if (error.message === 'twilio_timeout') {
            throw new Error('twilio_timeout');
        } else if (error.message.includes('Network error')) {
            throw new Error('Unable to connect to authentication service. Please check your internet connection.');
        }
        
        throw new Error('Authentication service is temporarily unavailable. Please try again later.');
    }
}

/**
 * Get client region for API routing
 */
function getClientRegion() {
    // This would typically use a geolocation service
    // For now, detect from timezone or user agent hints
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.includes('Asia') || timezone.includes('India')) {
        return 'asia';
    } else if (timezone.includes('Europe')) {
        return 'europe';
    } else if (timezone.includes('America')) {
        return 'americas';
    }
    return 'global';
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

// Fixed: Added input tracking for better analytics
document.getElementById('email').addEventListener('input', debounce(() => {
    arguxai.track('email_input_changed', {
        funnel_step: 'login_form',
        has_value: document.getElementById('email').value.length > 0
    });
}, 500));

document.getElementById('password').addEventListener('input', debounce(() => {
    arguxai.track('password_input_changed', {
        funnel_step: 'login_form',
