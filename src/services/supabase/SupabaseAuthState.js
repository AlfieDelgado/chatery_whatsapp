/**
 * Supabase Auth State Adapter for Baileys
 * Replaces useMultiFileAuthState with Supabase database storage
 */
const { proto } = require('@whiskeysockets/baileys');
const { getSupabaseClient } = require('./SupabaseClient');

/**
 * Initialize auth state from Supabase for a session
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<{state: Object, saveCreds: Function}>}
 */
async function useSupabaseAuthState(sessionId) {
    const supabase = getSupabaseClient();

    /**
     * Read a key from the database
     */
    const readData = async (keyId) => {
        try {
            const { data, error } = await supabase
                .from('wa_auth_keys')
                .select('key_data')
                .eq('session_id', sessionId)
                .eq('key_id', keyId)
                .single();

            if (error || !data) {
                return null;
            }

            return data.key_data;
        } catch (e) {
            return null;
        }
    };

    /**
     * Write a key to the database
     */
    const writeData = async (keyId, keyData) => {
        try {
            const { error } = await supabase
                .from('wa_auth_keys')
                .upsert({
                    session_id: sessionId,
                    key_id: keyId,
                    key_data: keyData
                }, {
                    onConflict: 'session_id,key_id'
                });

            if (error) {
                console.error(`[${sessionId}] Error writing auth key ${keyId}:`, error.message);
            }
        } catch (e) {
            console.error(`[${sessionId}] Error writing auth key ${keyId}:`, e.message);
        }
    };

    /**
     * Remove a key from the database
     */
    const removeData = async (keyId) => {
        try {
            await supabase
                .from('wa_auth_keys')
                .delete()
                .eq('session_id', sessionId)
                .eq('key_id', keyId);
        } catch (e) {
            // Silent fail
        }
    };

    /**
     * Remove all keys for a session
     */
    const clearAll = async () => {
        try {
            await supabase
                .from('wa_auth_keys')
                .delete()
                .eq('session_id', sessionId);
        } catch (e) {
            // Silent fail
        }
    };

    // Load existing credentials
    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            const keyId = `${type}-${id}`;
                            let value = await readData(keyId);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            tasks.push(
                                value
                                    ? writeData(keyId, value)
                                    : removeData(keyId)
                            );
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        },
        clearAll
    };
}

/**
 * Initialize empty auth credentials
 * Based on Baileys initAuthCreds function
 */
function initAuthCreds() {
    const { randomBytes, createHmac, createHash } = require('crypto');
    const { Curve, signedKeyPair } = require('@whiskeysockets/baileys').default || require('@whiskeysockets/baileys');

    // Helper to generate key pair
    const generateKeyPair = () => {
        const privateKey = randomBytes(32);
        const publicKey = Curve.publicKey(privateKey);
        return { private: privateKey, public: publicKey };
    };

    // Helper to generate signed key pair
    const generateSignedKeyPair = (identityKeyPair) => {
        const keyId = randomBytes(2).readUInt16BE(0) & 0xFFFF;
        const keyPair = generateKeyPair();
        const signature = Curve.sign(identityKeyPair.private, keyPair.public);
        return { keyId, keyPair, signature };
    };

    const identityKey = generateKeyPair();

    return {
        noiseKey: generateKeyPair(),
        pairingEphemeralKeyPair: generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: generateSignedKeyPair(identityKey),
        registrationId: randomBytes(2).readUInt16BE(0) & 16383,
        advSecretKey: randomBytes(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false
        },
        registered: false,
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined
    };
}

/**
 * Delete all auth data for a session
 */
async function deleteSupabaseAuthState(sessionId) {
    const supabase = getSupabaseClient();

    try {
        await supabase
            .from('wa_auth_keys')
            .delete()
            .eq('session_id', sessionId);

        console.log(`🗑️ [${sessionId}] Auth keys deleted from Supabase`);
    } catch (e) {
        console.error(`[${sessionId}] Error deleting auth keys:`, e.message);
    }
}

module.exports = {
    useSupabaseAuthState,
    deleteSupabaseAuthState
};
