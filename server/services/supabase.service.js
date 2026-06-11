const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const BUCKET_NAME = "resources";

/**
 * Uploads a file buffer to Supabase Storage
 * @param {string} fileName 
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @returns {Promise<string>} The path to the file in the bucket
 */
async function uploadToSupabase(fileName, fileBuffer, mimeType) {
  if (!supabase) throw new Error("Supabase is not configured");
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}

/**
 * Gets a download URL for a file in Supabase Storage
 */
async function getSupabaseDownloadUrl(filePath) {
  if (!supabase) throw new Error("Supabase is not configured");
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Downloads a file buffer from Supabase Storage
 */
async function downloadFromSupabase(filePath) {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
  if (error) throw error;
  
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Deletes a file from Supabase Storage
 */
async function deleteFromSupabase(filePath) {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  if (error) throw error;
}

module.exports = {
  supabase,
  uploadToSupabase,
  getSupabaseDownloadUrl,
  downloadFromSupabase,
  deleteFromSupabase,
};
