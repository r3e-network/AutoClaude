/**
 * ID Generator utility for creating unique identifiers
 */

/**
 * Generate a unique ID
 * @returns A unique string identifier
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Generate a unique ID with a prefix
 * @param prefix - The prefix to prepend to the ID
 * @returns A unique string identifier with the given prefix
 */
export function generateUniqueId(prefix: string): string {
  const baseId = generateId();
  return prefix ? `${prefix}-${baseId}` : baseId;
}

/**
 * Generate a short unique ID (8 characters)
 * @returns A short unique string identifier
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Generate a UUID v4 compatible ID
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
  // Simple UUID v4 implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a unique message ID for queue messages
 * @param prefix - Optional prefix for the message ID
 * @returns A unique message identifier
 */
export function generateMessageId(prefix: string = "msg"): string {
  return generateUniqueId(prefix);
}
