/**
 * ArguxAI JavaScript SDK
 * Track user events and send to ArguxAI for conversion optimization
 */

class ArguxAI {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiUrl = config.apiUrl || 'http://localhost:8000';
        this.userId = config.userId || this.generateUserId();
        this.sessionId = this.generateSessionId();
        this.metadata = config.metadata || {};

        // Event queue for batching
        this.eventQueue = [];
        this.flushInterval = config.flushInterval || 5000; // 5 seconds

        // Start auto-flush
        this.startAutoFlush();

        console.log('[ArguxAI] SDK initialized', {
            apiUrl: this.apiUrl,
            sessionId: this.sessionId
        });
    }

    /**
     * Track an event
     */
    track(eventName, properties = {}) {
        const event = {
            event_name: eventName,
            user_id: this.userId,
            session_id: this.sessionId,
            timestamp: Date.now(),
            properties: {
                ...this.metadata,
                ...properties,
                page_url: window.location.href,
                page_title: document.title,
                user_agent: navigator.userAgent
            }
        };

        console.log('[ArguxAI] Event tracked:', event);

        // Add to queue
        this.eventQueue.push(event);

        // Flush if queue is large
        if (this.eventQueue.length >= 10) {
            this.flush();
        }

        return event;
    }

    /**
     * Track page view
     */
    page(pageName, properties = {}) {
        return this.track('page_view', {
            page_name: pageName,
            ...properties
        });
    }

    /**
     * Track button click
     */
    click(buttonName, properties = {}) {
        return this.track('button_click', {
            button_name: buttonName,
            ...properties
        });
    }

    /**
     * Track form submission
     */
    submit(formName, properties = {}) {
        return this.track('form_submit', {
            form_name: formName,
            ...properties
        });
    }

    /**
     * Track conversion event
     */
    conversion(eventName, properties = {}) {
        return this.track('conversion', {
            conversion_event: eventName,
            ...properties
        });
    }

    /**
     * Track error
     */
    error(errorMessage, properties = {}) {
        return this.track('error', {
            error_message: errorMessage,
            error_stack: new Error().stack,
            ...properties
        });
    }

    /**
     * Flush events to API
     */
    async flush() {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            console.log(`[ArguxAI] Flushing ${events.length} events...`);

            const response = await fetch(`${this.apiUrl}/api/events/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({ events })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();
            console.log('[ArguxAI] Events sent successfully:', result);

        } catch (error) {
            console.error('[ArguxAI] Failed to send events:', error);
            // Re-add events to queue on failure
            this.eventQueue.unshift(...events);
        }
    }

    /**
     * Start auto-flush timer
     */
    startAutoFlush() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Generate unique user ID
     */
    generateUserId() {
        let userId = localStorage.getItem('arguxai_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('arguxai_user_id', userId);
        }
        return userId;
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Identify user (update metadata)
     */
    identify(userId, traits = {}) {
        this.userId = userId;
        this.metadata = { ...this.metadata, ...traits };
        localStorage.setItem('arguxai_user_id', userId);

        console.log('[ArguxAI] User identified:', { userId, traits });
    }
}

// Auto-initialize if config is in window
if (typeof window !== 'undefined' && window.ARGUXAI_CONFIG) {
    window.arguxai = new ArguxAI(window.ARGUXAI_CONFIG);
}
