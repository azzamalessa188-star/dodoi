'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  LOCAL_LANGUAGES,
  LOCAL_MODEL_DOWNLOAD_BYTES,
  LOCAL_MODEL_SIZE_BYTES,
  LOCAL_PROVIDER,
  detectLatinLanguage,
  detectSourceLanguage,
  languageLabelForCode,
  normalizeLanguageKey,
  toFloresCode,
} = require('../electron/lib/local-languages.cjs')

test('maps every app language to a FLORES-200 code', () => {
  assert.equal(LOCAL_PROVIDER, 'local-nllb')
  assert.ok(LOCAL_LANGUAGES.length >= 30)
  assert.ok(LOCAL_MODEL_DOWNLOAD_BYTES > LOCAL_MODEL_SIZE_BYTES)

  const labels = new Set()
  for (const language of LOCAL_LANGUAGES) {
    assert.ok(language.label)
    assert.ok(labels.add(language.label), `duplicate language label: ${language.label}`)
    assert.match(language.code, /^[a-z]{3}_[A-Z][a-z]{3}$/)
    assert.equal(toFloresCode(language.label), language.code)
    assert.equal(toFloresCode(languageLabelForCode(language.code)), language.code)
  }
  assert.equal(languageLabelForCode('por_Latn'), 'Portuguese')

  assert.equal(toFloresCode('Thai'), 'tha_Thai')
  assert.equal(toFloresCode('Brazilian Portuguese'), 'por_Latn')
  assert.equal(toFloresCode('Chinese (Traditional)'), 'zho_Hant')
  assert.equal(toFloresCode('PT-BR'), 'por_Latn')
  assert.equal(toFloresCode('Tagalog'), 'tgl_Latn')
  assert.equal(toFloresCode('Klingon'), null)
  assert.equal(toFloresCode(''), null)
})

test('normalizes labels for matching', () => {
  assert.equal(normalizeLanguageKey('  Chinese (Simplified) '), 'chinese simplified')
  assert.equal(normalizeLanguageKey('pt_BR'), 'pt br')
  assert.equal(normalizeLanguageKey('Norwegian Bokmål'), 'norwegian bokmal')
})

test('detects non-Latin scripts and regional variants', () => {
  assert.equal(detectSourceLanguage('สวัสดีครับ วันนี้อากาศดี'), 'tha_Thai')
  assert.equal(detectSourceLanguage('こんにちは、元気ですか'), 'jpn_Jpan')
  assert.equal(detectSourceLanguage('안녕하세요 오늘 날씨가 좋네요'), 'kor_Hang')
  assert.equal(detectSourceLanguage('今天天气很好，我们出去走走吧'), 'zho_Hans')
  assert.equal(
    detectSourceLanguage('這個國語說時會來裡為與業體發現實點數電腦臺灣'),
    'zho_Hant',
  )
  assert.equal(detectSourceLanguage('مرحبا كيف حالك اليوم'), 'arb_Arab')
  assert.equal(detectSourceLanguage('سلام حال شما چطور است'), 'pes_Arab')
  assert.equal(detectSourceLanguage('آپ کیسے ہیں؟'), 'urd_Arab')
  assert.equal(detectSourceLanguage('שלום מה שלומך היום'), 'heb_Hebr')
  assert.equal(detectSourceLanguage('Привет, как дела сегодня?'), 'rus_Cyrl')
  assert.equal(detectSourceLanguage('Привіт, як справи сьогодні?'), 'ukr_Cyrl')
  assert.equal(detectSourceLanguage('नमस्ते आज मौसम अच्छा है'), 'hin_Deva')
  assert.equal(detectSourceLanguage('আজ আবহাওয়া খুব ভালো'), 'ben_Beng')
  assert.equal(detectSourceLanguage('Καλημέρα, τι κάνεις σήμερα;'), 'ell_Grek')
})

test('detects Latin languages with stopwords and diacritics', () => {
  assert.equal(detectLatinLanguage('This is the best day of the week'), 'eng_Latn')
  assert.equal(detectLatinLanguage('El perro es muy bueno y está en la casa'), 'spa_Latn')
  assert.equal(detectLatinLanguage('Le chat est dans la maison avec les enfants'), 'fra_Latn')
  assert.equal(detectLatinLanguage('Der Hund ist nicht mit dem Auto gefahren'), 'deu_Latn')
  assert.equal(detectLatinLanguage('Saya tidak bisa pergi karena kamu ada di sini'), 'ind_Latn')
  assert.equal(detectLatinLanguage('12345 67890'), null)

  assert.equal(detectSourceLanguage('Xin chào, hôm nay trời đẹp quá'), 'vie_Latn')
  assert.equal(detectSourceLanguage('Dzień dobry, jak się masz?'), 'pol_Latn')
  assert.equal(detectSourceLanguage('Merhaba, bugün hava çok güzel'), 'tur_Latn')
  assert.equal(detectSourceLanguage('12345'), 'eng_Latn')
  assert.equal(detectSourceLanguage('', { fallback: 'tha_Thai' }), 'tha_Thai')
})
