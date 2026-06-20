
import { jsPDF } from 'jspdf';

/**
 * Loads Noto Sans Tamil and registers it with the jsPDF instance.
 * The font must be present in the public/ folder.
 */
export async function setupTamilFont(doc: jsPDF) {
  try {
    const response = await fetch('/NotoSansTamil-Regular.ttf');
    const blob = await response.blob();
    const reader = new FileReader();
    
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip the data URL prefix
        resolve(base64String.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });

    const fontBase64 = await base64Promise;
    
    // Virtual File System name
    const fontName = 'NotoSansTamil-Regular.ttf';
    
    // Add file to VFS
    doc.addFileToVFS(fontName, fontBase64);
    
    // Add font to jsPDF
    // Font name: 'Tamil', Style: 'normal'
    doc.addFont(fontName, 'Tamil', 'normal');
    
    return true;
  } catch (error) {
    console.error('Failed to load Tamil font:', error);
    return false;
  }
}
