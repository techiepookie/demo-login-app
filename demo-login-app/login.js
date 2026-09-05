```CodeLanguage.JAVASCRIPT
const twilio = require('twilio');

// Configuration with retry and timeout handling
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  timeout: 10000, // 10 second timeout
  retry: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 8000,
    randomize: true
  }
});

// Rate limiting configuration
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(phoneNumber) || [];
  
  // Filter out old requests
  const recentRequests = userRequests.filter(timestamp => 
    now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(phoneNumber, recentRequests);
  return true;
}

async function sendOTP(phoneNumber, otpCode) {
  // Check rate limit first
  if (!checkRateLimit(phoneNumber)) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  try {
    const message = await client.messages.create({
      body: `Your verification code is: ${otpCode}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      // Add status callback for better tracking
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL
    });
    
    console.log(`OTP sent successfully to ${phoneNumber}, SID: ${message.sid}`);
    return { success: true, messageSid: message.sid };
    
  } catch (error) {
    console.error(`Failed to send OTP to ${phoneNumber}:`, error);
    
    // Handle specific Twilio errors
    if (error.code === 429) {
      // Rate limit error - implement exponential backoff
      console.log('Twilio rate limit hit, implementing backoff');
      await new Promise(resolve => setTimeout(resolve, 5000));
      throw new Error('TWILIO_RATE_LIMITED');
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      console.log('Network timeout detected, retrying with backoff');
      throw new Error('NETWORK_TIMEOUT');
    }
    
    throw error;
  }
}

// Main OTP sending function with retry logic
async function sendOTPWithRetry(phoneNumber, otpCode, maxRetries = 3) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      return await sendOTP(phoneNumber, otpCode);
    } catch (error) {
      retryCount++;
      
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        console.log(`Rate limit exceeded for ${phoneNumber}`);
        throw error; // Don't retry on rate limit
      }
      
      if (retryCount === maxRetries) {
        console.error(`Failed to send OTP after ${maxRetries} attempts`);
        throw error;
      }
      
      // Exponential backoff
      const backoffTime = Math.pow(2, retryCount) * 1000;
      console.log(`Retry ${retryCount}/${maxRetries} in ${backoffTime}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
}

// Export the main function
module.exports = { sendOTPWithRetry };
```