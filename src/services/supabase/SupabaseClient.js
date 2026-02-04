/**
 * Supabase Client Singleton
 * Provides database and storage access for WhatsApp session persistence
 */
const { createClient } = require('@supabase/supabase-js');

let supabaseClient = null;

/**
 * Get or create Supabase client instance
 */
function getSupabaseClient() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
        }
        
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    
    return supabaseClient;
}

/**
 * Get storage bucket name
 */
function getStorageBucket() {
    return process.env.SUPABASE_STORAGE_BUCKET || 'chatery-media';
}

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured() {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

module.exports = {
    getSupabaseClient,
    getStorageBucket,
    isSupabaseConfigured
};
