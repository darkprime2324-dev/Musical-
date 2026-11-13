// Song title from file names like "Yetu_Pone_-_SomeSite.Co.mp3": drops site names, bitrates and extensions.
export function cleanTitle(input: string | undefined): string {
  if (!input) return '';
  const s = String(input).replace(/\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i, '').replace(/_+/g, ' ');
  const junk = /(mp3|\.co\b|\.com|\.in\b|\.net|www\.|kbps|songs?\.|naa ?songs|download|320|128)/i;
  const parts = s.split(/\s*(?:::|\||\s-\s|\s–\s)\s*/).map(x => x.replace(/[([][^)\]]*(kbps|mp3|www|\.com|\.co)[^)\]]*[)\]]/ig, '').trim()).filter(x => x && !junk.test(x));
  return (parts[0] || s).replace(/\s{2,}/g, ' ').trim();
}

export interface Tags { title?: string; artist?: string; album?: string; cover?: string }

// Minimal ID3v2 reader: title, artist, album and the embedded cover picture.
export async function readTags(file: File): Promise<Tags> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
    const ver = head[3], size = (head[6] & 127) << 21 | (head[7] & 127) << 14 | (head[8] & 127) << 7 | (head[9] & 127);
    const b = new Uint8Array(await file.slice(10, 10 + Math.min(size, 12e6)).arrayBuffer()), out: Record<string, string> = {};
    let p = 0;
    while (p + 10 <= b.length) {
      const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fs = ver === 4 ? ((b[p + 4] & 127) << 21 | (b[p + 5] & 127) << 14 | (b[p + 6] & 127) << 7 | (b[p + 7] & 127)) : ((b[p + 4] << 24 | b[p + 5] << 16 | b[p + 6] << 8 | b[p + 7]) >>> 0);
      if (fs <= 0 || p + 10 + fs > b.length) break;
      if ((id === 'TIT2' || id === 'TPE1' || id === 'TALB') && fs > 1) {
        const enc = b[p + 10]; let data = b.subarray(p + 11, p + 10 + fs), label = enc === 0 ? 'latin1' : enc === 3 ? 'utf-8' : enc === 2 ? 'utf-16be' : 'utf-16le';
        if (enc === 1 && data[0] === 0xFE && data[1] === 0xFF) { label = 'utf-16be'; data = data.subarray(2); } else if (enc === 1 && data[0] === 0xFF && data[1] === 0xFE) data = data.subarray(2);
        out[id] = new TextDecoder(label).decode(data).replace(/\0/g, ' ').trim();
      }
      if (id === 'APIC' && !out.cover && fs > 16) {
        const end = p + 10 + fs, enc = b[p + 10]; let q = p + 11; while (q < end && b[q] !== 0) q++;
        let mime = new TextDecoder('latin1').decode(b.subarray(p + 11, q)).toLowerCase() || 'image/jpeg'; if (!mime.includes('/')) mime = 'image/' + (mime === 'jpg' ? 'jpeg' : mime);
        q += 2;
        if (enc === 1 || enc === 2) { while (q + 1 < end && !(b[q] === 0 && b[q + 1] === 0)) q += 2; q += 2; } else { while (q < end && b[q] !== 0) q++; q++; }
        if (q < end) out.cover = URL.createObjectURL(new Blob([b.slice(q, end)], { type: mime }));
      }
      p += 10 + fs;
    }
    return { title: out.TIT2, artist: out.TPE1, album: out.TALB, cover: out.cover };
  } catch { return {}; }
}
