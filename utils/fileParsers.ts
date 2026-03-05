
declare const pdfjsLib: { GlobalWorkerOptions: { workerSrc: string }; getDocument: (config: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> } };
declare const mammoth: { extractRawText: (config: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const parseFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return await file.text();
  } 
  
  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str);
      fullText += strings.join(" ") + "\n";
    }
    return fullText;
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  throw new Error("Unsupported file format. Please upload PDF, DOCX, or TXT.");
};

export const segmentText = (text: string): string[] => {
  // Split by double newlines or punctuation for natural reading segments
  return text
    .split(/\n\s*\n|\.|\?|!/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
};
