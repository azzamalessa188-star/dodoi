'use strict'

const LOCAL_PROVIDER = 'local-nllb'
const LOCAL_MODEL_REPO = 'facebook/nllb-200-3.3B'
const LOCAL_MODEL_NAME = 'NLLB-200 3.3B · INT8'
const LOCAL_MODEL_DOWNLOAD_BYTES = 17_600_000_000
const LOCAL_MODEL_SIZE_BYTES = 3_500_000_000

// NLLB uses FLORES-200 codes, not display names. Every language exposed by the
// app's target picker has an entry here so the offline path never guesses.
const LOCAL_LANGUAGES = Object.freeze([
  { label: 'English', code: 'eng_Latn' },
  { label: 'Thai', code: 'tha_Thai' },
  { label: 'Spanish', code: 'spa_Latn' },
  { label: 'French', code: 'fra_Latn' },
  { label: 'German', code: 'deu_Latn' },
  { label: 'Italian', code: 'ita_Latn' },
  { label: 'Portuguese', code: 'por_Latn' },
  { label: 'Brazilian Portuguese', code: 'por_Latn' },
  { label: 'Japanese', code: 'jpn_Jpan' },
  { label: 'Korean', code: 'kor_Hang' },
  { label: 'Chinese (Simplified)', code: 'zho_Hans' },
  { label: 'Chinese (Traditional)', code: 'zho_Hant' },
  { label: 'Arabic', code: 'arb_Arab' },
  { label: 'Hindi', code: 'hin_Deva' },
  { label: 'Vietnamese', code: 'vie_Latn' },
  { label: 'Indonesian', code: 'ind_Latn' },
  { label: 'Malay', code: 'zsm_Latn' },
  { label: 'Turkish', code: 'tur_Latn' },
  { label: 'Russian', code: 'rus_Cyrl' },
  { label: 'Ukrainian', code: 'ukr_Cyrl' },
  { label: 'Polish', code: 'pol_Latn' },
  { label: 'Dutch', code: 'nld_Latn' },
  { label: 'Swedish', code: 'swe_Latn' },
  { label: 'Norwegian', code: 'nob_Latn' },
  { label: 'Danish', code: 'dan_Latn' },
  { label: 'Finnish', code: 'fin_Latn' },
  { label: 'Greek', code: 'ell_Grek' },
  { label: 'Hebrew', code: 'heb_Hebr' },
  { label: 'Persian', code: 'pes_Arab' },
  { label: 'Urdu', code: 'urd_Arab' },
  { label: 'Bengali', code: 'ben_Beng' },
  { label: 'Filipino', code: 'tgl_Latn' },
  { label: 'Swahili', code: 'swh_Latn' },
])

const ALIASES = Object.freeze({
  'brazil portuguese': 'por_Latn',
  'portuguese brazil': 'por_Latn',
  'portuguese brazilian': 'por_Latn',
  'pt br': 'por_Latn',
  'ptbr': 'por_Latn',
  chinese: 'zho_Hans',
  'chinese simplified': 'zho_Hans',
  'simplified chinese': 'zho_Hans',
  'zh cn': 'zho_Hans',
  'zh hans': 'zho_Hans',
  'chinese traditional': 'zho_Hant',
  'traditional chinese': 'zho_Hant',
  'zh tw': 'zho_Hant',
  'zh hant': 'zho_Hant',
  farsi: 'pes_Arab',
  'persian farsi': 'pes_Arab',
  tagalog: 'tgl_Latn',
  'filipino tagalog': 'tgl_Latn',
  norsk: 'nob_Latn',
  'norwegian bokmal': 'nob_Latn',
  'norwegian bokmål': 'nob_Latn',
  castilian: 'spa_Latn',
  'swahili kiswahili': 'swh_Latn',
  kiswahili: 'swh_Latn',
  'malay malaysian': 'zsm_Latn',
  'bahasa indonesia': 'ind_Latn',
  'bahasa melayu': 'zsm_Latn',
})

function normalizeLanguageKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CODE_BY_LANGUAGE = new Map(
  LOCAL_LANGUAGES.map((language) => [normalizeLanguageKey(language.label), language.code]),
)

for (const [alias, code] of Object.entries(ALIASES)) {
  const key = normalizeLanguageKey(alias)
  if (!CODE_BY_LANGUAGE.has(key)) CODE_BY_LANGUAGE.set(key, code)
}

function toFloresCode(language) {
  if (!language) return null
  return CODE_BY_LANGUAGE.get(normalizeLanguageKey(language)) || null
}

function languageLabelForCode(code) {
  const normalized = String(code || '').trim()
  const match = LOCAL_LANGUAGES.find((language) => language.code === normalized)
  return match?.label || ''
}

function countMatches(text, pattern) {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function normalizeLatinWord(word) {
  return word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
}

const LATIN_STOPWORDS = Object.freeze({
  eng_Latn: ['the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'that', 'it', 'you', 'for', 'with', 'this', 'have', 'not', 'on', 'be', 'as'],
  spa_Latn: ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'con', 'para', 'no', 'del', 'se', 'su', 'como', 'pero'],
  fra_Latn: ['le', 'la', 'les', 'de', 'et', 'est', 'un', 'une', 'que', 'dans', 'pour', 'avec', 'pas', 'du', 'des', 'ce', 'cette', 'il', 'elle', 'nous'],
  deu_Latn: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'mit', 'fur', 'von', 'zu', 'den', 'dem', 'des', 'auch', 'sich', 'auf', 'werden', 'ich'],
  ita_Latn: ['il', 'la', 'gli', 'le', 'di', 'che', 'e', 'un', 'una', 'per', 'con', 'non', 'del', 'della', 'sono', 'come', 'questo', 'questa', 'anche', 'piu'],
  por_Latn: ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'um', 'uma', 'para', 'com', 'nao', 'do', 'da', 'dos', 'das', 'isso', 'como', 'mais', 'voce'],
  nld_Latn: ['de', 'het', 'een', 'en', 'is', 'van', 'dat', 'niet', 'met', 'voor', 'op', 'ik', 'je', 'zijn', 'er', 'maar', 'ook', 'aan', 'dit', 'wat'],
  pol_Latn: ['i', 'w', 'nie', 'na', 'z', 'ze', 'jest', 'do', 'to', 'sie', 'oraz', 'jak', 'ale', 'jestem', 'tak', 'dla', 'od', 'po', 'co', 'ten'],
  tur_Latn: ['ve', 'bir', 'bu', 'da', 'de', 'icin', 'ile', 'degil', 'cok', 'olarak', 'ben', 'sen', 'o', 'ne', 'var', 'yok', 'ama', 'gibi', 'daha', 'kadar'],
  vie_Latn: ['va', 'la', 'cua', 'khong', 'duoc', 'trong', 'co', 'nguoi', 'nhung', 'cho', 'mot', 'toi', 'ban', 'nay', 'do', 'voi', 'nhu', 'thi', 'ra', 'den'],
  ind_Latn: ['yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'saya', 'kamu', 'tidak', 'dengan', 'untuk', 'adalah', 'ada', 'akan', 'bisa', 'juga', 'dalam', 'mereka', 'kita'],
  zsm_Latn: ['yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'saya', 'awak', 'tidak', 'dengan', 'untuk', 'adalah', 'ada', 'akan', 'boleh', 'juga', 'dalam', 'mereka', 'kita'],
  tgl_Latn: ['ang', 'ng', 'mga', 'sa', 'ay', 'ako', 'ikaw', 'siya', 'hindi', 'para', 'ito', 'iyan', 'may', 'mayroon', 'naman', 'kung', 'pero', 'dahil', 'kami', 'tayo'],
  swh_Latn: ['na', 'ya', 'wa', 'kwa', 'ni', 'katika', 'hii', 'hiyo', 'lakini', 'kama', 'hapa', 'wewe', 'mimi', 'yeye', 'sisi', 'wana', 'kuna', 'ndiyo', 'hapana', 'sana'],
  swe_Latn: ['och', 'att', 'det', 'som', 'ar', 'en', 'ett', 'pa', 'for', 'med', 'inte', 'jag', 'du', 'han', 'hon', 'vi', 'de', 'den', 'har', 'kan'],
  nob_Latn: ['og', 'a', 'det', 'som', 'er', 'en', 'et', 'pa', 'for', 'med', 'ikke', 'jeg', 'du', 'han', 'hun', 'vi', 'de', 'den', 'har', 'kan'],
  dan_Latn: ['og', 'at', 'det', 'som', 'er', 'en', 'et', 'pa', 'for', 'med', 'ikke', 'jeg', 'du', 'han', 'hun', 'vi', 'de', 'den', 'har', 'kan'],
  fin_Latn: ['ja', 'on', 'ei', 'etta', 'se', 'joka', 'han', 'olla', 'kanssa', 'mutta', 'myos', 'kun', 'niin', 'voi', 'olen', 'sinun', 'me', 'he', 'tama', 'sita'],
})

const LATIN_CODE_BY_LANGUAGE = Object.freeze({
  eng_Latn: 'eng_Latn',
  spa_Latn: 'spa_Latn',
  fra_Latn: 'fra_Latn',
  deu_Latn: 'deu_Latn',
  ita_Latn: 'ita_Latn',
  por_Latn: 'por_Latn',
  nld_Latn: 'nld_Latn',
  pol_Latn: 'pol_Latn',
  tur_Latn: 'tur_Latn',
  vie_Latn: 'vie_Latn',
  ind_Latn: 'ind_Latn',
  zsm_Latn: 'zsm_Latn',
  tgl_Latn: 'tgl_Latn',
  swh_Latn: 'swh_Latn',
  swe_Latn: 'swe_Latn',
  nob_Latn: 'nob_Latn',
  dan_Latn: 'dan_Latn',
  fin_Latn: 'fin_Latn',
})

function detectLatinLanguage(text) {
  const tokens = text
    .toLowerCase()
    .match(/[\p{L}]+/gu)
    ?.map(normalizeLatinWord)
    .filter(Boolean)

  if (!tokens || !tokens.length) return null

  const scores = new Map()
  for (const [code, stopwords] of Object.entries(LATIN_STOPWORDS)) {
    const set = new Set(stopwords)
    const distinct = new Set(tokens.filter((token) => set.has(token)))
    if (distinct.size) scores.set(code, distinct.size)
  }

  if (!scores.size) return null
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const [bestCode, bestScore] = ranked[0]
  const secondScore = ranked[1]?.[1] || 0

  // A single common word is too ambiguous, unless it clearly separates one
  // candidate from every other language in the list.
  if (bestScore < 2 && !(bestScore === 1 && secondScore === 0 && tokens.length <= 6)) return null
  if (bestScore === secondScore) return null
  return LATIN_CODE_BY_LANGUAGE[bestCode] || null
}

function detectSourceLanguage(text, { fallback = 'eng_Latn' } = {}) {
  const value = String(text || '')
  if (!value.trim()) return fallback

  const scriptCounts = [
    ['thai', countMatches(value, /[\u0E00-\u0E7F]/g)],
    ['kana', countMatches(value, /[\u3040-\u30FF\u31F0-\u31FF]/g)],
    ['korean', countMatches(value, /[\uAC00-\uD7AF\u1100-\u11FF]/g)],
    ['han', countMatches(value, /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g)],
    ['arabic', countMatches(value, /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g)],
    ['hebrew', countMatches(value, /[\u0590-\u05FF]/g)],
    ['cyrillic', countMatches(value, /[\u0400-\u04FF]/g)],
    ['devanagari', countMatches(value, /[\u0900-\u097F]/g)],
    ['bengali', countMatches(value, /[\u0980-\u09FF]/g)],
    ['greek', countMatches(value, /[\u0370-\u03FF]/g)],
  ]

  const [script, scriptCount] = scriptCounts.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  )

  if (scriptCount > 0) {
    switch (script) {
      case 'thai':
        return 'tha_Thai'
      case 'kana':
        return 'jpn_Jpan'
      case 'korean':
        return 'kor_Hang'
      case 'han': {
        const traditional = countMatches(value, /[這個們學國語說時會來裡為與業體發現實點數電腦臺灣]/g)
        const simplified = countMatches(value, /[这个们学国语说时会来里为与业体发现实点数电脑台湾]/g)
        return traditional > simplified ? 'zho_Hant' : 'zho_Hans'
      }
      case 'arabic': {
        const urdu = countMatches(value, /[ٹڈڑںھےۓ]/g)
        const persian = countMatches(value, /[پچژگکی]/g)
        if (urdu > 0) return 'urd_Arab'
        if (persian > 0) return 'pes_Arab'
        return 'arb_Arab'
      }
      case 'hebrew':
        return 'heb_Hebr'
      case 'cyrillic': {
        const ukrainian = countMatches(value, /[іїєґІЇЄҐ]/g)
        return ukrainian > 0 ? 'ukr_Cyrl' : 'rus_Cyrl'
      }
      case 'devanagari':
        return 'hin_Deva'
      case 'bengali':
        return 'ben_Beng'
      case 'greek':
        return 'ell_Grek'
      default:
        break
    }
  }

  if (/[ăâđêôơưĂÂĐÊÔƠƯ]/.test(value)) return 'vie_Latn'
  if (/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/.test(value)) return 'pol_Latn'
  if (/[ğışİĞŞ]/.test(value)) return 'tur_Latn'

  return detectLatinLanguage(value) || fallback
}

module.exports = {
  LOCAL_LANGUAGES,
  LOCAL_MODEL_DOWNLOAD_BYTES,
  LOCAL_MODEL_NAME,
  LOCAL_MODEL_REPO,
  LOCAL_MODEL_SIZE_BYTES,
  LOCAL_PROVIDER,
  detectLatinLanguage,
  detectSourceLanguage,
  languageLabelForCode,
  normalizeLanguageKey,
  toFloresCode,
}
