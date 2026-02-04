/**
 * Supabase Services Index
 * Export all Supabase-related modules
 */
const { getSupabaseClient, getStorageBucket, isSupabaseConfigured } = require('./SupabaseClient');
const { useSupabaseAuthState, deleteSupabaseAuthState } = require('./SupabaseAuthState');
const SupabaseStorage = require('./SupabaseStorage');

module.exports = {
    // Client
    getSupabaseClient,
    getStorageBucket,
    isSupabaseConfigured,

    // Auth State
    useSupabaseAuthState,
    deleteSupabaseAuthState,

    // Storage
    SupabaseStorage
};
