// Human-readable messages for failures of the direct browser → storage upload.
export function storageUploadError(status: number, ar = false) {
  if (status === 413) {
    return ar
      ? "الملف أكبر من الحد المسموح بالتخزين. صغّر حجم الفيديو أو ارفع حد حجم الملفات في Supabase."
      : "This file is larger than the storage limit. Compress the video, or raise the file size limit in Supabase Storage.";
  }
  if (status === 403) {
    return ar ? "انتهت صلاحية رابط الرفع. جرّب مرة ثانية." : "The upload link expired or was rejected. Please try again.";
  }
  return ar ? `فشل الرفع (${status}). جرّب مرة ثانية.` : `Upload failed (${status}). Please try again.`;
}
