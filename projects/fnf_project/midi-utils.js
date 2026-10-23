// Utility functions shared across MIDI code

// Convert AudioBuffer to WAV blob
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const buffer_ = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer_);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const offset = 44;
  let pos = offset;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, val, true);
      pos += 2;
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  return new Blob([buffer_], { type: 'audio/wav' });
}

// Parse a timecode string ("MM:SS.ms" or raw seconds) to seconds
export function parseTimecodeToSeconds(timecodeStr) {
  const trimmedTimecode = timecodeStr.trim();
  if (trimmedTimecode.includes(':')) {
    const parts = trimmedTimecode.split(':');
    if (parts.length !== 2) return NaN;

    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);

    if (isNaN(minutes) || isNaN(seconds)) return NaN;
    return (minutes * 60) + seconds;
  } else {
    const seconds = parseFloat(trimmedTimecode);
    return isNaN(seconds) ? NaN : seconds;
  }
}

// Format seconds as "MM:SS.s"
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
}