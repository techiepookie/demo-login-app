/**
 * Login page logic
 * INTENTIONAL BUGS for ArguxAI to detect and fix
 */

// BUG #1: API timeout too short (will cause failures)
const API_TIMEOUT = 5000; // Should be at least 15 seconds!

// BUG #2: No retry logic
const MAX_RETRIES = 0; // Should retry failed requests!

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

    // Show loading
    loginButton.disabled = true;
    loginButton.style.display = 'none';
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';

    try {
        // BUG #3: No validation before API call
        // Should validate email format first!

        // Attempt login
        const result = await loginUser(email, password);

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
 * Login API call
 * BUG #4: Hardcoded timeout, no retry, poor error handling
 */
async function loginUser(email, password) {
    // BUG: Should use environment variable for API URL
    const API_URL = 'https://demo-api.arguxai.com/login';

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

        // BUG #5: No status code checking
        const data = await response.json();
        return data;

    } catch (error) {
        // BUG #6: Poor error messages
        if (error.name === 'AbortError') {
            // This will happen frequently with 5s timeout!
            throw new Error('Login timed out. Please try again.');
        }

        // BUG: No network error handling
        throw new Error('Network error. Please check your connection.');
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

// BUG #7: No click tracking on individual input fields
// Should track when users interact with email/password fields

// Track input focus (good)
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

// BUG #8: Button click might not register properly on mobile
// Due to CSS positioning issue
loginButton.addEventListener('click', (e) => {
    console.log('Button clicked!');
    // BUG: No debouncing, could cause duplicate submissions
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

console.log('Login page initialized (with intentional bugs for ArguxAI demo)');
