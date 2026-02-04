const path = require('path');
const fs = require('fs');
const WhatsAppSession = require('./WhatsAppSession');
const { isSupabaseConfigured, getSupabaseClient } = require('../supabase');

/**
 * WhatsApp Manager Class
 * Mengelola semua sesi WhatsApp (Singleton)
 */
class WhatsAppManager {
    constructor() {
        this.sessions = new Map();
        this.sessionsFolder = path.join(process.cwd(), 'sessions');
        this.useSupabase = isSupabaseConfigured();
        this.initExistingSessions();
    }

    /**
     * Load existing sessions on startup
     */
    async initExistingSessions() {
        try {
            const sessionIds = new Set();

            // Load from Supabase if configured
            if (this.useSupabase) {
                try {
                    const supabase = getSupabaseClient();
                    const { data: sessions, error } = await supabase
                        .from('wa_sessions')
                        .select('session_id')
                        .neq('status', 'deleted');

                    if (!error && sessions) {
                        for (const row of sessions) {
                            sessionIds.add(row.session_id);
                        }
                        console.log(`☁️ Found ${sessions.length} sessions in Supabase`);
                    }
                } catch (e) {
                    console.log('⚠️ Could not load sessions from Supabase:', e.message);
                }
            }

            // Also check filesystem for sessions (fallback/migration)
            if (fs.existsSync(this.sessionsFolder)) {
                const sessionDirs = fs.readdirSync(this.sessionsFolder);
                for (const sessionId of sessionDirs) {
                    const sessionPath = path.join(this.sessionsFolder, sessionId);
                    if (fs.statSync(sessionPath).isDirectory()) {
                        sessionIds.add(sessionId);
                    }
                }
            } else {
                fs.mkdirSync(this.sessionsFolder, { recursive: true });
            }

            // Restore all discovered sessions
            for (const sessionId of sessionIds) {
                console.log(`🔄 Restoring session: ${sessionId}`);
                const session = new WhatsAppSession(sessionId, {});
                this.sessions.set(sessionId, session);
                await session.connect();
            }

            console.log(`✅ Restored ${sessionIds.size} sessions`);
        } catch (error) {
            console.error('Error initializing sessions:', error);
        }
    }

    /**
     * Create a new session or reconnect existing
     * @param {string} sessionId - Session identifier
     * @param {Object} options - Session options
     * @param {Object} options.metadata - Custom metadata to store with session
     * @param {Array} options.webhooks - Array of webhook configs [{ url, events }]
     * @returns {Object}
     */
    async createSession(sessionId, options = {}) {
        // Validate session ID
        if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
            return {
                success: false,
                message: 'Invalid session ID. Use only letters, numbers, underscore, and dash.'
            };
        }

        // Check if session already exists
        if (this.sessions.has(sessionId)) {
            const existingSession = this.sessions.get(sessionId);

            // Update config if provided
            if (options.metadata || options.webhooks) {
                existingSession.updateConfig(options);
            }

            if (existingSession.connectionStatus === 'connected') {
                return {
                    success: false,
                    message: 'Session already connected',
                    data: existingSession.getInfo()
                };
            }
            // Reconnect existing session
            await existingSession.connect();
            return {
                success: true,
                message: 'Reconnecting existing session',
                data: existingSession.getInfo()
            };
        }

        // Create new session with options
        const session = new WhatsAppSession(sessionId, options);
        session._saveConfig(); // Save initial config
        this.sessions.set(sessionId, session);
        await session.connect();

        return {
            success: true,
            message: 'Session created',
            data: session.getInfo()
        };
    }

    /**
     * Get session by ID
     * @param {string} sessionId 
     * @returns {WhatsAppSession|undefined}
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all sessions info
     * @returns {Array}
     */
    getAllSessions() {
        const sessionsInfo = [];
        for (const [sessionId, session] of this.sessions) {
            sessionsInfo.push(session.getInfo());
        }
        return sessionsInfo;
    }

    /**
     * Delete a session
     * @param {string} sessionId 
     * @returns {Object}
     */
    async deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, message: 'Session not found' };
        }

        await session.logout();
        this.sessions.delete(sessionId);
        return { success: true, message: 'Session deleted successfully' };
    }

    /**
     * Get session QR code info
     * @param {string} sessionId 
     * @returns {Object|null}
     */
    getSessionQR(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        return session.getInfo();
    }
}

module.exports = WhatsAppManager;
