/**
 * Supabase Storage Handler
 * Handles media file uploads and downloads using Supabase Storage
 */
const { getSupabaseClient, getStorageBucket } = require('./SupabaseClient');

class SupabaseStorage {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.supabase = getSupabaseClient();
        this.bucket = getStorageBucket();
    }

    /**
     * Generate storage path for a media file
     */
    _getStoragePath(messageId, extension = '') {
        return `${this.sessionId}/${messageId}${extension}`;
    }

    /**
     * Upload media file to Supabase Storage
     * @param {string} messageId - Unique message identifier
     * @param {Buffer} buffer - File buffer
     * @param {string} mimeType - MIME type of the file
     * @param {string} extension - File extension (e.g., '.jpg', '.mp4')
     * @returns {Promise<{success: boolean, path?: string, url?: string, error?: string}>}
     */
    async uploadMedia(messageId, buffer, mimeType, extension = '') {
        try {
            const storagePath = this._getStoragePath(messageId, extension);

            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .upload(storagePath, buffer, {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                console.error(`[${this.sessionId}] Storage upload error:`, error.message);
                return { success: false, error: error.message };
            }

            // Get signed URL for access (valid for 1 hour)
            const { data: urlData, error: urlError } = await this.supabase.storage
                .from(this.bucket)
                .createSignedUrl(storagePath, 3600);

            if (urlError) {
                console.error(`[${this.sessionId}] Error creating signed URL:`, urlError.message);
                return { success: true, path: data.path, url: null };
            }

            console.log(`📤 [${this.sessionId}] Media uploaded: ${storagePath}`);

            return {
                success: true,
                path: data.path,
                url: urlData.signedUrl
            };
        } catch (e) {
            console.error(`[${this.sessionId}] Upload error:`, e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Get signed URL for a media file
     * @param {string} messageId - Message identifier
     * @param {string} extension - File extension
     * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
     * @returns {Promise<string|null>}
     */
    async getMediaUrl(messageId, extension = '', expiresIn = 3600) {
        try {
            const storagePath = this._getStoragePath(messageId, extension);

            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .createSignedUrl(storagePath, expiresIn);

            if (error) {
                return null;
            }

            return data.signedUrl;
        } catch (e) {
            return null;
        }
    }

    /**
     * Download media file
     * @param {string} messageId - Message identifier
     * @param {string} extension - File extension
     * @returns {Promise<Buffer|null>}
     */
    async downloadMedia(messageId, extension = '') {
        try {
            const storagePath = this._getStoragePath(messageId, extension);

            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .download(storagePath);

            if (error) {
                return null;
            }

            // Convert Blob to Buffer
            const arrayBuffer = await data.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (e) {
            return null;
        }
    }

    /**
     * Delete a media file
     * @param {string} messageId - Message identifier
     * @param {string} extension - File extension
     */
    async deleteMedia(messageId, extension = '') {
        try {
            const storagePath = this._getStoragePath(messageId, extension);

            const { error } = await this.supabase.storage
                .from(this.bucket)
                .remove([storagePath]);

            if (!error) {
                console.log(`🗑️ [${this.sessionId}] Media deleted: ${storagePath}`);
            }
        } catch (e) {
            // Silent fail
        }
    }

    /**
     * Delete all media files for a session
     */
    async deleteAllMedia() {
        try {
            // List all files in session folder
            const { data: files, error: listError } = await this.supabase.storage
                .from(this.bucket)
                .list(this.sessionId);

            if (listError || !files || files.length === 0) {
                return;
            }

            // Build paths for deletion
            const paths = files.map(file => `${this.sessionId}/${file.name}`);

            const { error } = await this.supabase.storage
                .from(this.bucket)
                .remove(paths);

            if (!error) {
                console.log(`🗑️ [${this.sessionId}] All media deleted (${paths.length} files)`);
            }
        } catch (e) {
            console.error(`[${this.sessionId}] Error deleting all media:`, e.message);
        }
    }

    /**
     * Get file extension from MIME type
     */
    static getExtensionFromMime(mimeType) {
        const mimeMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/3gpp': '.3gp',
            'audio/ogg': '.ogg',
            'audio/mpeg': '.mp3',
            'audio/mp4': '.m4a',
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
        };

        return mimeMap[mimeType] || '';
    }
}

module.exports = SupabaseStorage;
