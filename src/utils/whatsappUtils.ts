/**
 * WhatsApp sharing & quick messaging utility.
 * Generates direct wa.me links with clean international phone numbers
 * and prefilled, encoded messages.
 */

export function cleanPhoneNumberForWhatsApp(phone?: string): string {
  if (!phone) return '';
  // Remove all spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[^0-9+]/g, '');

  // If starts with 0 (e.g. French 0612345678), convert to +33612345678
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `33${cleaned.slice(1)}`;
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

export function getWhatsAppShareUrl(phone: string | undefined, message: string): string {
  const cleanPhone = cleanPhoneNumberForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export async function copyMessageToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
}
