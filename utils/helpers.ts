import { SubtitleSegment } from '../types';

export const formatTime = (ms: number): string => {
  const date = new Date(ms);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

export const generateSRT = (segments: SubtitleSegment[]): string => {
  return segments.map((seg, index) => {
    return `${index + 1}
${formatTime(seg.startMs)} --> ${formatTime(seg.endMs)}
${seg.original}
${seg.translation}
`;
  }).join('\n');
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the Data-URL declaration (e.g. "data:audio/mp3;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('无法将 Blob 转换为 Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
