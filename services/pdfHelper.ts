import * as pdfjsModule from 'https://esm.sh/pdfjs-dist@3.11.174';

// Handle potential ESM/CJS interop issues where the library is on the default export
const pdfjsLib = (pdfjsModule as any).default || pdfjsModule;

// Initialize worker
// Using unpkg for the worker source as it is often more reliable for direct linking in this context
// This fixes the 'NetworkError' and 'importScripts' failures
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

export const loadPDF = async (file: File): Promise<any> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
};

export const extractPageText = async (page: any): Promise<string> => {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => item.str)
    .filter((str: string) => str.trim().length > 0)
    .join(' ');
};

export const extractTextFromDocument = async (pdf: any, maxPages = 3): Promise<string> => {
  let fullText = '';
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    try {
      const page = await pdf.getPage(i);
      const text = await extractPageText(page);
      fullText += text + ' ';
    } catch (e) {
      console.warn(`Error extracting text from page ${i}`, e);
    }
  }
  return fullText.trim();
};

export const renderPageTextLayer = async (page: any, container: HTMLDivElement, scale: number) => {
  container.innerHTML = ''; // Clear previous text layer
  
  // Fix for PDF.js 3.x+: The --scale-factor CSS variable must be set to the viewport scale
  container.style.setProperty('--scale-factor', `${scale}`);

  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale });
  
  // PDF.js TextLayerBuilder logic (simplified for CDN usage)
  // We use the renderTextLayer API exposed by the library
  await pdfjsLib.renderTextLayer({
    textContentSource: textContent,
    container: container,
    viewport: viewport,
    textDivs: []
  }).promise;
};

export const generatePDFThumbnail = async (pdfDoc: any): Promise<string> => {
  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 }); // Low scale for thumbnail
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return '';

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (e) {
    console.error("Error generating thumbnail", e);
    return '';
  }
};