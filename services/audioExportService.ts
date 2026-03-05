
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Encodes raw PCM data into a WAV file format.
 * Gemini TTS returns raw PCM (16-bit, Mono, 24kHz).
 */
export function encodeWAV(samples: Int16Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates audio for a single text chunk.
 */
export async function generateChunkAudio(text: string, voiceName: string = 'Kore'): Promise<Int16Array> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio content.");
  }

  const audioBytes = decodeBase64(base64Audio);
  // Ensure we correctly view the buffer as Int16 (PCM 16-bit)
  return new Int16Array(audioBytes.buffer);
}

/**
 * Splits text into chunks of roughly 3000 characters to stay safe with TTS limits.
 */
function chunkText(text: string, size: number = 3000): string[] {
  const chunks: string[] = [];
  let current = "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    if ((current + sentence).length > size) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Converts an entire document to a single WAV blob.
 */
export async function generateFullDocumentAudio(
  text: string, 
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const chunks = chunkText(text);
  const allPcmChunks: Int16Array[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const pcm = await generateChunkAudio(chunks[i]);
    allPcmChunks.push(pcm);
    if (onProgress) onProgress(((i + 1) / chunks.length) * 100);
  }

  // Calculate total length
  const totalLength = allPcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const mergedPcm = new Int16Array(totalLength);
  
  let offset = 0;
  for (const chunk of allPcmChunks) {
    mergedPcm.set(chunk, offset);
    offset += chunk.length;
  }

  return encodeWAV(mergedPcm, 24000);
}

// Keep the original single-segment helper for small snippets if needed
export async function generateHQAudio(text: string, voiceName: string = 'Kore'): Promise<Blob> {
  const pcm = await generateChunkAudio(text, voiceName);
  return encodeWAV(pcm, 24000);
}
