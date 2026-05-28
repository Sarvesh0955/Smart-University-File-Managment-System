/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format date to readable string
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Get file icon type based on mime type
 */
export function getFileIconType(mimeType) {
  if (!mimeType) return "default";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) return "archive";
  if (mimeType.includes("word") || mimeType.includes("document")) return "doc";
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml")) return "text";
  return "default";
}

/**
 * Get Material Symbols icon name for a file type
 */
export function getFileIcon(mimeType) {
  const type = getFileIconType(mimeType);
  const icons = {
    pdf: "picture_as_pdf",
    doc: "description",
    image: "image",
    video: "movie",
    audio: "audio_file",
    archive: "folder_zip",
    text: "code",
    default: "insert_drive_file",
  };
  return icons[type] || icons.default;
}

/**
 * Get preview type for a file
 */
export function getPreviewType(mimeType) {
  if (!mimeType) return "unsupported";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml")) return "text";
  return "unsupported";
}

/**
 * Category display names
 */
export const CATEGORIES = [
  { value: "NOTES", label: "Notes" },
  { value: "PYQS", label: "PYQs" },
  { value: "LAB_MANUALS", label: "Lab Manuals" },
  { value: "ASSIGNMENTS", label: "Assignments" },
  { value: "REFERENCE", label: "Reference" },
];

/**
 * Get display name for a category
 */
export function getCategoryLabel(category) {
  const found = CATEGORIES.find((c) => c.value === category);
  return found ? found.label : category;
}
