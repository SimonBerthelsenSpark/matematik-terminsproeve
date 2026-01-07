/**
 * PDF to Images Converter
 * Converts PDF pages to base64-encoded images for Vision API
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Convert a PDF file to an array of base64-encoded images (one per page)
 * @param {File} pdfFile - The PDF file to convert
 * @param {Object} options - Conversion options
 * @param {number} options.scale - Scale factor for rendering (default: 1.5)
 * @param {number} options.maxPages - Maximum number of pages to convert (default: 10)
 * @param {string} options.format - Image format: 'png' or 'jpeg' (default: 'jpeg')
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.8)
 * @returns {Promise<Array<string>>} Array of base64-encoded image data URLs
 */
export async function convertPDFToImages(pdfFile, options = {}) {
  const {
    scale = 1.0,        // Reduced from 1.5 for faster processing
    maxPages = 5,       // Reduced from 10 to avoid timeout
    format = 'jpeg',
    quality = 0.5       // Reduced from 0.8 for smaller files
  } = options;

  console.log('🔄 Converting PDF to images...');
  console.log('  - File:', pdfFile.name);
  console.log('  - Scale:', scale);
  console.log('  - Max pages:', maxPages);
  console.log('  - Format:', format);

  try {
    // Read PDF file as ArrayBuffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const numPages = Math.min(pdf.numPages, maxPages);
    console.log(`📄 PDF has ${pdf.numPages} pages, converting ${numPages} pages`);
    
    const images = [];
    
    // Convert each page to image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`  🖼️ Rendering page ${pageNum}/${numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to base64 image
      const imageFormat = format === 'png' ? 'image/png' : 'image/jpeg';
      const imageDataUrl = canvas.toDataURL(imageFormat, quality);
      
      images.push(imageDataUrl);
      
      console.log(`  ✅ Page ${pageNum} converted (${(imageDataUrl.length / 1024).toFixed(2)} KB)`);
      
      // Cleanup
      canvas.remove();
    }
    
    const totalSize = images.reduce((sum, img) => sum + img.length, 0);
    console.log(`✅ Converted ${numPages} pages → ${(totalSize / 1024 / 1024).toFixed(2)} MB total`);
    
    return images;
  } catch (error) {
    console.error('❌ Error converting PDF to images:', error);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

/**
 * Check if Vision API should be used based on exam settings and file type
 * @param {Object} exam - Exam object with settings
 * @param {File} file - File to check
 * @returns {boolean} True if Vision API should be used
 */
export function shouldUseVision(exam, file) {
  // Only use Vision if enabled in exam settings
  if (!exam?.enableVision) {
    return false;
  }
  
  // Only works with PDF files
  if (!file || file.type !== 'application/pdf') {
    console.log('⚠️ Vision mode is enabled but file is not PDF, using text-only');
    return false;
  }
  
  // Check file size (Vision has limits)
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    console.warn(`⚠️ File too large for Vision (${(file.size / 1024 / 1024).toFixed(2)} MB > 20MB), using text-only`);
    return false;
  }
  
  return true;
}
