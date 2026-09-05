```CodeLanguage.JAVASCRIPT
const twilio = require('twilio');

// Configuration with retry and timeout handling
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  timeout: 30000, // Increased to 30 seconds for better network tolerance
  retry: {
    retries: 5,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 30000,
    randomize: true
  }
});

// Rate limiting configuration with per-country and per-number tracking
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3; // Reduced to prevent throttling
const MAX_REQUESTS_PER_COUNTRY_WINDOW = 50; // Country-level limit
const COUNTRY_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Country-specific configuration for high-risk regions
const COUNTRY_CONFIG = {
  'IN': { maxRequests: 2, backoffMs: 10000 },
  'PH': { maxRequests: 2, backoffMs: 10000 },
  'BD': { maxRequests: 2, backoffMs: 10000 },
  'default': { maxRequests: 3, backoffMs: 5000 }
};

function getCountryCode(phoneNumber) {
  // Extract country code from phone number (assuming E.164 format)
  const match = phoneNumber.match(/^\+(\d{1,3})/);
  return match ? match[1] : 'default';
}

function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const countryCode = getCountryCode(phoneNumber);
  const config = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.default;
  
  // Per-number rate limit
  const userRequests = rateLimitStore.get(phoneNumber) || [];
  const recentRequests = userRequests.filter(timestamp => 
    now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  
  if (recentRequests.length >= config.maxRequests) {
    return { allowed: false, backoffMs: config.backoffMs };
  }
  
  // Country-level rate limit
  const countryKey = `country_${countryCode}`;
  const countryRequests = rateLimitStore.get(countryKey) || [];
  const recentCountryRequests = countryRequests.filter(timestamp => 
    now - timestamp < COUNTRY_RATE_LIMIT_WINDOW_MS
  );
  
  if (recentCountryRequests.length >= MAX_REQUESTS_PER_COUNTRY_WINDOW) {
    return { allowed: false, backoffMs: 30000 };
  }
  
  // Update stores
  recentRequests.push(now);
  rateLimitStore.set(phoneNumber, recentRequests);
  
  recentCountryRequests.push(now);
  rateLimitStore.set(countryKey, recentCountryRequests);
  
  return { allowed: true, backoffMs: 0 };
}

async function sendOTP(phoneNumber, otpCode) {
  // Check rate limit with country-specific rules
  const rateLimit = checkRateLimit(phoneNumber);
  if (!rateLimit.allowed) {
    const error = new Error('RATE_LIMIT_EXCEEDED');
    error.backoffMs = rateLimit.backoffMs;
    throw error;
  }

  try {
    // Use a more reliable message template
    const message = await client.messages.create({
      body: `Your verification code is: ${otpCode}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
      // Add messaging service for better delivery
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
    });
    
    console.log(`OTP sent successfully to ${phoneNumber}, SID: ${message.sid}`);
    return { success: true, messageSid: message.sid };
    
  } catch (error) {
    console.error(`Failed to send OTP to ${phoneNumber}:`, error);
    
    // Handle specific Twilio errors with better backoff
    if (error.code === 429 || error.status === 429) {
      console.log('Twilio rate limit hit, implementing extended backoff');
      const backoffMs = error.retryAfter || 30000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      const rateError = new Error('TWILIO_RATE_LIMITED');
      rateError.backoffMs = backoffMs;
      throw rateError;
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || 
        error.code === 'ECONNRESET' || error.code === 'ENETUNREACH') {
      console.log('Network error detected, will retry with longer backoff');
      const networkError = new Error('NETWORK_ERROR');
      networkError.backoffMs = 15000;
      throw networkError;
    }
    
    // Handle Twilio specific error codes
    if (error.code === 21610) { // Unable to send to this number
      throw new Error('INVALID_PHONE_NUMBER');
    }
    
    if (error.code === 30007) { // Carrier blocked
      throw new Error('CARRIER_BLOCKED');
    }
    
    throw error;
  }
}

// Main OTP sending function with adaptive retry logic
async function sendOTPWithRetry(phoneNumber, otpCode, maxRetries = 5) {
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < maxRetries) {
    try {
      return await sendOTP(phoneNumber, otpCode);
    } catch (error) {
      retryCount++;
      lastError = error;
      
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        console.log(`Rate limit exceeded for ${phoneNumber}`);
        // Wait for the specified backoff period
        const backoffMs = error.backoffMs || 10000;
        console.log(`Waiting ${backoffMs}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue; // Retry after backoff
      }
      
      if (error.message === 'INVALID_PHONE_NUMBER' || error.message === 'CARRIER_BLOCKED') {
        console.error(`Permanent failure for ${phoneNumber}: ${error.message}`);
        throw error; // Don't retry on permanent failures
      }
      
      if (retryCount === maxRetries) {
        console.error(`Failed to send OTP after ${maxRetries} attempts`);
        throw error;
      }
      
      // Adaptive exponential backoff with jitter
      const baseBackoff = error.backoffMs || 5000;
      const jitter = Math.random() * 2000;
      const backoffTime = Math.min(baseBackoff * Math.pow(2, retryCount - 1) + jitter, 60000);
      
      console.log(`Retry ${retryCount}/${maxRetries} in ${backoffTime}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
  
  throw lastError || new Error('OTP_SEND_FAILED');
}

// Cleanup function for rate limit store (call periodically)
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter(timestamp => 
      now - timestamp < Math.max(RATE_LIMIT_WINDOW_MS, COUNTRY_RATE_LIMIT_WINDOW_MS)
    );
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// Export the main function
module.exports = { sendOTPWithRetry };
```