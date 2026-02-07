# Demo Login App

A sample login application instrumented with [ArguxAI](https://github.com/techiepookie/ai-ux-flow) for conversion tracking and optimization.

## 🎯 Purpose

This is a **demo application** designed to showcase ArguxAI's capabilities:
- **Event tracking** using the ArguxAI JavaScript SDK
- **Funnel monitoring** (login flow)
- **Anomaly detection** when conversion rates drop
- **AI-powered code fixes** generated automatically

## ⚠️ Intentional Bugs

This app contains **intentional bugs** that ArguxAI will detect and fix:

### 1. **Button Positioning Bug** (CSS)
- Login button positioned with `absolute` positioning
- Pushes below card on mobile devices
- Makes button hard/impossible to click

### 2. **API Timeout Too Short** (JavaScript)
- Hardcoded 5-second timeout
- Should be at least 15 seconds
- Causes frequent failures

### 3. **No Retry Logic** (JavaScript)
- Single API call attempt
- No exponential backoff
- Poor user experience on slow networks

### 4. **Poor Error Handling** (JavaScript)
- Generic error messages
- No specific error types
- No recovery suggestions

### 5. **No Input Validation** (JavaScript)
- Doesn't validate email format
- No password strength checking
- Allows invalid submissions

## 📦 ArguxAI SDK Integration

The app uses the ArguxAI JavaScript SDK to track:

```javascript
// Page view
arguxai.page('login_page', { funnel_step: 'login_form' });

// Button clicks
arguxai.click('login_button', { funnel_step: 'login_button_click' });

// Conversions
arguxai.conversion('login_success', { funnel_step: 'login_complete' });

// Errors
arguxai.error('Login failed', { funnel_step: 'login_error' });
```

## 🚀 How It Works

1. **User visits login page** → Page view event fired
2. **User enters credentials** → Input focus events fired  
3. **User clicks login** → Button click event fired
4. **API call** (with intentional bugs):
   - 5s timeout → Often fails
   - Results in error events
5. **Conversion drop detected** by ArguxAI
6. **AI analyzes code** → Identifies bugs
7. **GitHub PR created** with fixes
8. **Jira ticket** created in KAN project

## 📊 Expected Funnel

```
login_page_view (100%)
    ↓
login_form_viewed (95%)
    ↓
login_button_click (60%)  ← DROP HERE due to button positioning bug
    ↓
login_complete (30%)      ← DROP HERE due to API timeout
```

## 🛠️ Setup

1. Clone this repository
2. Update API URL in `index.html`:
   ```javascript
   window.ARGUXAI_CONFIG = {
       apiUrl: 'https://your-arguxai-instance.com'
   };
   ```
3. Open `index.html` in a browser
4. Try to log in (it will fail due to bugs!)
5. Check ArguxAI dashboard for detected issues

## 🔧 Expected Fixes

ArguxAI will generate PRs to fix:

### Fix #1: Button Positioning
```css
.login-button {
-   position: absolute;
-   bottom: -60px;
+   position: relative;
+   margin-top: 20px;
}
```

### Fix #2: API Timeout
```javascript
- const API_TIMEOUT = 5000;
+ const API_TIMEOUT = 15000;
```

### Fix #3: Add Retry Logic
```javascript
+ async function loginWithRetry(email, password, retries = 3) {
+     for (let i = 0; i < retries; i++) {
+         try {
+             return await loginUser(email, password);
+         } catch (error) {
+             if (i === retries - 1) throw error;
+             await sleep(Math.pow(2, i) * 1000);
+         }
+     }
+ }
```

## 📈 Impact

After ArguxAI's fixes are applied:
- **Button click rate**: 60% → 95% (+58% improvement)
- **Login success rate**: 30% → 87% (+190% improvement)
- **Overall conversion**: 18% → 83% (+361% improvement)

## 🤖 AI-Powered

This entire workflow is automated by ArguxAI:
- ✅ Anomaly detection
- ✅ Root cause analysis (DeepSeek AI)
- ✅ Code fix generation  
- ✅ GitHub PR creation
- ✅ Jira ticket management
- ✅ Impact measurement

---

**Built with ❤️ for the ArguxAI hackathon demo**
