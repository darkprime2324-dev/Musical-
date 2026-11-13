// English letters for Telugu and Hindi lyrics: a readable, phonetic transliteration (not a translation).
interface Script { cons: Record<string, string>; vow: Record<string, string>; sign: Record<string, string>; virama: string; anus: string; candra: string; visarga: string; nukta?: string; schwaDrop: boolean; yInitial: Record<string, string> }

const TE: Script = {
  cons: { 'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'n', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'nj', 'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n', 'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ఱ': 'r', 'ల': 'l', 'ళ': 'l', 'ఴ': 'zh', 'వ': 'v', 'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h' },
  vow: { 'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ru', 'ౠ': 'roo', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au' },
  sign: { 'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ru', 'ౄ': 'roo', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au' },
  virama: '్', anus: 'ం', candra: 'ఁ', visarga: 'ః', schwaDrop: false, yInitial: { 'ఎ': 'ye', 'ఏ': 'ye' },
};
const HI: Script = {
  cons: { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y' },
  vow: { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e' },
  sign: { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' },
  virama: '्', anus: 'ं', candra: 'ँ', visarga: 'ः', nukta: '़', schwaDrop: true, yInitial: {},
};
const NUKTA: Record<string, string> = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' };

function romanWord(w: string, L: Script): string {
  const ch = Array.from(w); let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (L.cons[c] != null) {
      let base = L.cons[c], j = i + 1;
      if (L.nukta && ch[j] === L.nukta) { base = NUKTA[c] || base; j++; }
      const nx = ch[j];
      if (nx === L.virama) { out += base; i = j; continue; }
      if (L.sign[nx] != null) { out += base + L.sign[nx]; i = j; continue; }
      out += base + (L.schwaDrop && j >= ch.length && out ? '' : 'a'); i = j - 1; continue;
    }
    if (L.vow[c] != null) { out += (i === 0 && L.yInitial[c]) || L.vow[c]; continue; }
    if (c === L.anus || c === L.candra) { const nx = L.cons[ch[i + 1]] || ''; out += /^[pbm]/.test(nx) || (!nx && L === TE) ? 'm' : 'n'; continue; }
    if (c === L.visarga) { out += 'h'; continue; }
    out += c;
  }
  return out;
}

export function roman(text: string): string {
  return text.split(/(\s+)/).map(tok =>
    /[ఀ-౿]/.test(tok) ? romanWord(tok.normalize('NFC'), TE)
      : /[ऀ-ॿ]/.test(tok) ? romanWord(tok.normalize('NFC'), HI) : tok).join('');
}
export const capFirst = (s: string) => s.replace(/^(\W*)(\p{Ll})/u, (_m, a: string, b: string) => a + b.toUpperCase());
