const $ = (selector, scope = document) => scope.querySelector(selector)
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector))

const header = $('#siteHeader')
const menuToggle = $('#menuToggle')
const siteNav = $('#siteNav')
const heroPanel = $('#heroDemo')
const heroSource = $('#heroSource')
const heroResult = $('#heroResult')
const heroTarget = $('#heroTarget')
const heroTargetLabel = $('#heroTargetLabel')
const heroStatus = $('#heroStatus')
const heroTranslate = $('#heroTranslate')
const heroTranslateLabel = $('#heroTranslateLabel')
const heroLanguage = $('#heroLanguage')
const pointerGlow = $('#pointerGlow')
const summonLayer = $('#summonLayer')
const summonTarget = $('#summonTarget')
const summonTargetFooter = $('#summonTargetFooter')
const summonResult = $('#summonResult')
const summonNext = $('#summonNext')
const downloadPrimary = $('#downloadPrimary')
const downloadLabel = downloadPrimary?.querySelector('[data-download-label]')
const themeToggle = $('#themeToggle')
const langSwitchButtons = $$('[data-set-lang]')
const scrollProgressBar = $('#scrollProgress span')
const backToTop = $('#backToTop')
const metaThemeColor = $('#metaThemeColor')
const metaDescription = $('#metaDescription')
const ogTitle = $('#ogTitle')
const ogDescription = $('#ogDescription')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

const STORAGE_THEME = 'dodoi-theme'
const STORAGE_LANG = 'dodoi-lang'

const I18N = {
  en: {
    'meta.title': 'Dodoi — Speak freely. Everywhere.',
    'meta.description':
      'Dodoi is a floating AI translator for every app. Summon it with a shortcut, translate with the cloud or fully offline, and paste the result back without losing your place.',
    'meta.ogTitle': 'Dodoi — Speak freely. Everywhere.',
    'meta.ogDescription':
      'A floating AI translator that lives above every app. One shortcut, any language, back to what you were doing.',

    'a11y.skip': 'Skip to content',
    'brand.tagline': 'AI translator',
    'brand.home': 'Dodoi home',

    'nav.label': 'Primary navigation',
    'nav.open': 'Open navigation',
    'nav.close': 'Close navigation',
    'nav.features': 'Features',
    'nav.offline': 'Offline',
    'nav.product': 'A closer look',
    'nav.how': 'How it works',
    'nav.download': 'Download',

    'controls.language': 'Language',
    'controls.chooseLanguage': 'Choose a translation language',
    'controls.languagesFoot': '33 languages in the app',
    'controls.langEn': 'English',
    'controls.langAr': 'Arabic',
    'controls.themeLight': 'Switch to light mode',
    'controls.themeDark': 'Switch to dark mode',
    'controls.toTop': 'Back to top',

    'hero.eyebrow': 'A floating AI translator for every app',
    'hero.title1': 'Speak freely.',
    'hero.title2': 'Everywhere.',
    'hero.lead':
      'Dodoi floats above your work. One shortcut, any language, and the right words are back in the app you were using — before the thought escapes.',
    'hero.get': 'Get Dodoi',
    'hero.try': 'Try the shortcut',
    'hero.openSource': 'Open source · v0.2.0',
    'hero.chipLanguages': '33 languages',
    'hero.chipLocal': 'Local model ready',
    'hero.chipSummon': 'to summon',
    'hero.ready': 'Ready',
    'hero.fromApp': 'From any app',
    'hero.autoDetect': 'Auto-detect',
    'hero.translation': 'Translation',
    'hero.livePreview': 'Live preview',
    'hero.scroll': "See what's inside",
    'hero.scrollLabel': 'Scroll to features',
    'hero.changeLanguage': 'Change preview language',
    'hero.previewAria': 'Interactive Dodoi preview',
    'hero.translate': 'Translate',
    'hero.translating': 'Translating',
    'hero.translated': 'Translated',

    'marquee.label': 'One shortcut · thirty-three languages',
    'marquee.aria': 'Dodoi in many languages',

    'features.eyebrow': 'Why Dodoi',
    'features.title1': 'Small window.',
    'features.title2': 'Serious range.',
    'features.lead': 'Everything you need to translate in flow, and nothing that pulls you out of it.',
    'features.summonTitle': 'Summon it. Anywhere.',
    'features.summonBody':
      "A global shortcut opens Dodoi above the app you're already in. No alt-tabbing, no tabs, no lost place.",
    'features.tryNow': 'Try it now',
    'features.cloudTitle': 'Cloud. Local. Your call.',
    'features.cloudBody':
      'Use any OpenAI-compatible provider, or switch to the built-in NLLB-200 engine and keep every word on your machine.',
    'features.cloud': 'Cloud',
    'features.local': 'Local',
    'features.switchAria': 'Toggle local engine preview',
    'features.switchCloud': 'OpenRouter · auto-routed',
    'features.switchLocal': 'NLLB-200 · on this device',
    'features.you': 'you',
    'features.cloudNode': 'cloud',
    'features.device': 'this device',
    'features.fallbackTitle': 'Smart Fallback',
    'features.fallbackBody':
      'If the local engine is stopped or busy, Dodoi quietly retries through your last cloud connection. You just see the translation.',
    'features.localNode': 'local',
    'features.cloudNodeShort': 'cloud',
    'features.seamless': 'seamless',
    'features.pasteTitle': 'Paste-back, without the pause.',
    'features.pasteBody':
      'The result is copied and inserted into the app you came from, cursor still where you left it. Your train of thought stays on the rails.',
    'features.keyTitle': 'Your key stays yours.',
    'features.keyBody':
      'API keys live in a local <code>.env</code> file, masked in the UI, and never enter the renderer.',
    'features.languagesTitle': '33 languages, mapped.',
    'features.languagesBody':
      'FLORES-200 codes and automatic source detection, from Japanese to Arabic.',

    'offline.eyebrow': 'Local engine',
    'offline.title1': 'The cloud is',
    'offline.title2': 'optional.',
    'offline.lead':
      'Dodoi ships with an on-demand NLLB-200 3.3B engine. Download it once, and translation keeps working with no connection, no API key, and no text leaving your machine.',
    'offline.check1': 'CTranslate2 INT8 · about 3.5 GB',
    'offline.check2': 'Bundled Python 3.12 runtime',
    'offline.check3': 'Real Stop control that releases RAM',
    'offline.simulate': 'Simulate offline',
    'offline.restore': 'Restore network',
    'offline.footnote': 'No account. No API key. No requests.',
    'offline.engineKicker': 'Local engine',
    'offline.online': 'Online',
    'offline.airplane': 'Airplane mode',
    'offline.noNetwork': 'no network',
    'offline.localhost': '127.0.0.1',
    'offline.modelLabel': 'Model',
    'offline.modelValue': 'INT8 · CTranslate2',
    'offline.languagesLabel': 'Languages',
    'offline.languagesValue': '33 targets',
    'offline.requestsLabel': 'Requests leaving',
    'offline.log1': 'Embedded Python runtime ready',
    'offline.log2': 'Model loaded · 3.5 GB',
    'offline.log3': 'Listening on localhost',
    'offline.logAirplane': 'No network · still translating',

    'product.eyebrow': 'A closer look',
    'product.title1': 'Made to disappear',
    'product.title2': 'into your flow.',
    'product.lead':
      'A translator should feel like a reflex, not a destination. Dodoi opens over your work and gets out of the way.',
    'product.tabsLabel': 'Dodoi screenshots',
    'product.tabOverlay': 'Floating overlay',
    'product.tabSettings': 'Control room',
    'product.overlayNote': 'Summon · type · translate',
    'product.settingsNote': 'Providers · language · local engine',
    'product.overlayAlt': 'Dodoi floating translation overlay with a lime translate button',
    'product.settingsAlt':
      'Dodoi settings window with provider, language, and local engine controls',

    'how.eyebrow': 'Three moves',
    'how.title1': 'In and out.',
    'how.title2': 'Nothing in between.',
    'how.step1Title': 'Summon',
    'how.step1Body':
      "Press <kbd>Shift</kbd> + <kbd>~</kbd> anywhere. Dodoi appears on the display you're using.",
    'how.step2Title': 'Say it',
    'how.step2Body':
      'Type or paste anything. Dodoi detects the source and keeps the tone, dialect, and formatting.',
    'how.step3Title': 'Move on',
    'how.step3Body':
      'Hit <kbd>Ctrl</kbd> + <kbd>↵</kbd>. The translation is copied and pasted back where you were typing.',

    'download.eyebrow': 'Get Dodoi',
    'download.title1': 'Take it',
    'download.title2': 'everywhere.',
    'download.lead': 'Free and open source. Available for the three desktops you actually use.',
    'download.browse': 'Browse the source',
    'download.note': 'v0.2.0 · Direct downloads · unsigned builds may ask for your OS approval',
    'download.portable': 'Portable',
    'download.debian': 'Debian / Ubuntu',
    'download.altWindows': 'Windows logo',
    'download.altMac': 'macOS logo',
    'download.altLinux': 'Linux logo',
    'download.windows': 'Download for Windows',
    'download.mac': 'Download for macOS',
    'download.linux': 'Download for Linux',
    'download.mobile': 'Choose your desktop',

    'closing.eyebrow': 'The right words, right where you are',
    'closing.title': 'Stay in your flow.',
    'closing.body': 'The world can keep its languages. You keep your train of thought.',
    'closing.get': 'Get Dodoi',
    'closing.summon': 'Summon the preview',

    'footer.tagline': 'The right words, right where you are.',
    'footer.license': 'MIT licensed',
    'footer.built': 'Built with Electron + NLLB-200',
    'footer.copyright': '© 2026 Dodoi',

    'summon.title': 'Dodoi preview',
    'summon.close': 'Close preview',
    'summon.desc':
      "This is the web preview. In the app, Dodoi opens above whatever you're working in.",
    'summon.ready': 'Ready',
    'summon.fromApp': 'From any app · Auto-detect',
    'summon.next': 'Next phrase',
    'summon.hint': '<kbd>Esc</kbd> to close · <kbd>Shift</kbd><kbd>~</kbd> to summon',

    'lang.ja': 'Japanese',
    'lang.es': 'Spanish',
    'lang.fr': 'French',
    'lang.de': 'German',
    'lang.ar': 'Arabic',
    'lang.ko': 'Korean',
    'lang.zh': 'Chinese',
    'lang.pt': 'Portuguese',
    'lang.it': 'Italian',
    'lang.hi': 'Hindi',
    'lang.tr': 'Turkish',
    'lang.ru': 'Russian',
  },
  ar: {
    'meta.title': 'Dodoi — تحدَّث بحرية. في كل مكان.',
    'meta.description':
      'Dodoi مترجم ذكي عائم لكل التطبيقات. استدعِه باختصار، وترجِم عبر السحابة أو دون اتصال بالكامل، ثم ألصق النتيجة في مكانك دون أن تفقد موضعك.',
    'meta.ogTitle': 'Dodoi — تحدَّث بحرية. في كل مكان.',
    'meta.ogDescription':
      'مترجم ذكي عائم يعمل فوق كل التطبيقات. اختصار واحد، وأي لغة، ثم تعود إلى ما كنت تفعله.',

    'a11y.skip': 'تخطَّ إلى المحتوى',
    'brand.tagline': 'مترجم ذكي',
    'brand.home': 'الصفحة الرئيسية لـ Dodoi',

    'nav.label': 'التنقل الرئيسي',
    'nav.open': 'افتح التنقل',
    'nav.close': 'أغلق التنقل',
    'nav.features': 'المزايا',
    'nav.offline': 'دون اتصال',
    'nav.product': 'نظرة أقرب',
    'nav.how': 'كيف يعمل',
    'nav.download': 'التنزيل',

    'controls.language': 'اللغة',
    'controls.chooseLanguage': 'اختر لغة الترجمة',
    'controls.languagesFoot': '33 لغة في التطبيق',
    'controls.langEn': 'الإنجليزية',
    'controls.langAr': 'العربية',
    'controls.themeLight': 'التبديل إلى الوضع الفاتح',
    'controls.themeDark': 'التبديل إلى الوضع الداكن',
    'controls.toTop': 'العودة إلى الأعلى',

    'hero.eyebrow': 'مترجم ذكي عائم لكل التطبيقات',
    'hero.title1': 'تحدَّث بحرية.',
    'hero.title2': 'في كل مكان.',
    'hero.lead':
      'يطفو Dodoi فوق عملك. اختصار واحد، وأي لغة، لتعود الكلمات الصحيحة إلى التطبيق الذي تستخدمه — قبل أن تفلت الفكرة.',
    'hero.get': 'احصل على Dodoi',
    'hero.try': 'جرّب الاختصار',
    'hero.openSource': 'مفتوح المصدر · v0.2.0',
    'hero.chipLanguages': '33 لغة',
    'hero.chipLocal': 'النموذج المحلي جاهز',
    'hero.chipSummon': 'للاستدعاء',
    'hero.ready': 'جاهز',
    'hero.fromApp': 'من أي تطبيق',
    'hero.autoDetect': 'كشف تلقائي',
    'hero.translation': 'الترجمة',
    'hero.livePreview': 'معاينة حية',
    'hero.scroll': 'اكتشف ما بالداخل',
    'hero.scrollLabel': 'انتقل إلى المزايا',
    'hero.changeLanguage': 'غيّر لغة المعاينة',
    'hero.previewAria': 'معاينة تفاعلية لـ Dodoi',
    'hero.translate': 'ترجِم',
    'hero.translating': 'جارٍ الترجمة',
    'hero.translated': 'تمت الترجمة',

    'marquee.label': 'اختصار واحد · ثلاث وثلاثون لغة',
    'marquee.aria': 'Dodoi بلغات كثيرة',

    'features.eyebrow': 'لماذا Dodoi',
    'features.title1': 'نافذة صغيرة.',
    'features.title2': 'قدرات واسعة.',
    'features.lead': 'كل ما تحتاجه للترجمة دون انقطاع، ولا شيء يخرجك عن سياقك.',
    'features.summonTitle': 'استدعِه. في أي مكان.',
    'features.summonBody':
      'يفتح اختصار عام Dodoi فوق التطبيق الذي تعمل فيه. بلا تنقّل بين النوافذ، وبلا تبويبات، وبلا فقدان لموضعك.',
    'features.tryNow': 'جرّبه الآن',
    'features.cloudTitle': 'سحابي. محلي. القرار لك.',
    'features.cloudBody':
      'استخدم أي مزوّد متوافق مع OpenAI، أو بدّل إلى محرك NLLB-200 المدمج وأبقِ كل كلمة على جهازك.',
    'features.cloud': 'سحابي',
    'features.local': 'محلي',
    'features.switchAria': 'بدّل معاينة المحرك المحلي',
    'features.switchCloud': 'OpenRouter · توجيه تلقائي',
    'features.switchLocal': 'NLLB-200 · على هذا الجهاز',
    'features.you': 'أنت',
    'features.cloudNode': 'السحابة',
    'features.device': 'هذا الجهاز',
    'features.fallbackTitle': 'احتياطي ذكي',
    'features.fallbackBody':
      'إذا توقف المحرك المحلي أو كان مشغولًا، يعيد Dodoi المحاولة بهدوء عبر آخر اتصال سحابي لديك. وأنت ترى الترجمة فقط.',
    'features.localNode': 'محلي',
    'features.cloudNodeShort': 'سحابي',
    'features.seamless': 'بسلاسة',
    'features.pasteTitle': 'لصق فوري، بلا توقف.',
    'features.pasteBody':
      'تُنسخ النتيجة وتُدرج في التطبيق الذي جئت منه، ويبقى المؤشر حيث تركته. فيظل خيط أفكارك متصلًا.',
    'features.keyTitle': 'مفتاحك يبقى ملكك.',
    'features.keyBody':
      'تعيش مفاتيح API في ملف <code>.env</code> محلي، وتظهر مقنّعة في الواجهة، ولا تدخل أبدًا إلى طبقة العرض.',
    'features.languagesTitle': '33 لغة، بدقة.',
    'features.languagesBody':
      'رموز FLORES-200 وكشف تلقائي للغة المصدر، من اليابانية إلى العربية.',

    'offline.eyebrow': 'المحرك المحلي',
    'offline.title1': 'السحابة',
    'offline.title2': 'اختيارية.',
    'offline.lead':
      'يأتي Dodoi مع محرك NLLB-200 3.3B يُحمَّل عند الطلب. نزّله مرة واحدة، وستستمر الترجمة دون اتصال، ودون مفتاح API، ودون أن يغادر أي نص جهازك.',
    'offline.check1': 'CTranslate2 INT8 · نحو 3.5 غيغابايت',
    'offline.check2': 'بيئة Python 3.12 مضمّنة',
    'offline.check3': 'زر إيقاف حقيقي يحرّر الذاكرة',
    'offline.simulate': 'حاكِ انقطاع الاتصال',
    'offline.restore': 'استعد الاتصال',
    'offline.footnote': 'بلا حساب. بلا مفتاح API. بلا طلبات.',
    'offline.engineKicker': 'المحرك المحلي',
    'offline.online': 'متصل',
    'offline.airplane': 'وضع الطيران',
    'offline.noNetwork': 'بلا شبكة',
    'offline.localhost': '127.0.0.1',
    'offline.modelLabel': 'النموذج',
    'offline.modelValue': 'INT8 · CTranslate2',
    'offline.languagesLabel': 'اللغات',
    'offline.languagesValue': '33 لغة هدف',
    'offline.requestsLabel': 'طلبات خارجة',
    'offline.log1': 'بيئة Python المضمّنة جاهزة',
    'offline.log2': 'تم تحميل النموذج · 3.5 غيغابايت',
    'offline.log3': 'يستمع على localhost',
    'offline.logAirplane': 'بلا شبكة · ما زال يترجم',

    'product.eyebrow': 'نظرة أقرب',
    'product.title1': 'مصمم ليختفي',
    'product.title2': 'داخل تدفّق عملك.',
    'product.lead':
      'ينبغي أن يكون المترجم ردّ فعل تلقائي، لا وجهة تقصدها. يفتح Dodoi فوق عملك ثم يفسح لك الطريق.',
    'product.tabsLabel': 'لقطات من Dodoi',
    'product.tabOverlay': 'النافذة العائمة',
    'product.tabSettings': 'غرفة التحكم',
    'product.overlayNote': 'استدعاء · كتابة · ترجمة',
    'product.settingsNote': 'المزوّدون · اللغة · المحرك المحلي',
    'product.overlayAlt': 'نافذة Dodoi العائمة للترجمة مع زر ترجمة أخضر ليموني',
    'product.settingsAlt': 'نافذة إعدادات Dodoi مع خيارات المزوّد واللغة والمحرك المحلي',

    'how.eyebrow': 'ثلاث خطوات',
    'how.title1': 'دخول وخروج.',
    'how.title2': 'بلا أي عوائق.',
    'how.step1Title': 'استدعِ',
    'how.step1Body': 'اضغط <kbd>Shift</kbd> + <kbd>~</kbd> في أي مكان. يظهر Dodoi على الشاشة التي تستخدمها.',
    'how.step2Title': 'اكتبها',
    'how.step2Body':
      'اكتب أو ألصق أي نص. يكتشف Dodoi اللغة المصدر ويحافظ على النبرة واللهجة والتنسيق.',
    'how.step3Title': 'واصل عملك',
    'how.step3Body':
      'اضغط <kbd>Ctrl</kbd> + <kbd>↵</kbd>. تُنسخ الترجمة وتُلصق حيث كنت تكتب.',

    'download.eyebrow': 'احصل على Dodoi',
    'download.title1': 'خذ Dodoi',
    'download.title2': 'إلى كل مكان.',
    'download.lead': 'مجاني ومفتوح المصدر. متاح لأنظمة سطح المكتب الثلاثة التي تستخدمها فعلًا.',
    'download.browse': 'تصفّح الكود المصدري',
    'download.note':
      'v0.2.0 · تنزيلات مباشرة · قد تطلب النسخ غير الموقّعة موافقة نظام التشغيل',
    'download.portable': 'محمول',
    'download.debian': 'Debian / Ubuntu',
    'download.altWindows': 'شعار Windows',
    'download.altMac': 'شعار macOS',
    'download.altLinux': 'شعار Linux',
    'download.windows': 'نزّل لـ Windows',
    'download.mac': 'نزّل لـ macOS',
    'download.linux': 'نزّل لـ Linux',
    'download.mobile': 'اختر نظام سطح المكتب',

    'closing.eyebrow': 'الكلمات الصحيحة، في المكان الذي أنت فيه',
    'closing.title': 'ابقَ في تدفّقك.',
    'closing.body': 'ليحتفظ العالم بلغاته. وأنت احتفظ بخيط أفكارك.',
    'closing.get': 'احصل على Dodoi',
    'closing.summon': 'استدعِ المعاينة',

    'footer.tagline': 'الكلمات الصحيحة، في المكان الذي أنت فيه.',
    'footer.license': 'مرخّص بموجب MIT',
    'footer.built': 'مبني بـ Electron + NLLB-200',
    'footer.copyright': '© 2026 Dodoi',

    'summon.title': 'معاينة Dodoi',
    'summon.close': 'أغلق المعاينة',
    'summon.desc': 'هذه معاينة الويب. في التطبيق، يفتح Dodoi فوق أي شيء تعمل عليه.',
    'summon.ready': 'جاهز',
    'summon.fromApp': 'من أي تطبيق · كشف تلقائي',
    'summon.next': 'العبارة التالية',
    'summon.hint': '<kbd>Esc</kbd> للإغلاق · <kbd>Shift</kbd><kbd>~</kbd> للاستدعاء',

    'lang.ja': 'اليابانية',
    'lang.es': 'الإسبانية',
    'lang.fr': 'الفرنسية',
    'lang.de': 'الألمانية',
    'lang.ar': 'العربية',
    'lang.ko': 'الكورية',
    'lang.zh': 'الصينية',
    'lang.pt': 'البرتغالية',
    'lang.it': 'الإيطالية',
    'lang.hi': 'الهندية',
    'lang.tr': 'التركية',
    'lang.ru': 'الروسية',
  },
}

const normalizeLang = (value) => (value === 'ar' ? 'ar' : 'en')
const normalizeTheme = (value) => (value === 'light' ? 'light' : 'dark')

let siteLang = normalizeLang(document.documentElement.lang)
let siteTheme = normalizeTheme(document.documentElement.getAttribute('data-theme'))
let heroPhase = 'ready'
let airplaneMode = false
let localPreview = false
let downloadTargetKey = 'windows'
let currentShotKey = 'overlay'
let refreshSwitchPreview = () => {}
let refreshEnginePreview = () => {}
let refreshShotCopy = () => {}

const t = (key, fallback = '') => {
  const dictionary = I18N[siteLang] || I18N.en
  if (dictionary[key] != null) return dictionary[key]
  if (I18N.en[key] != null) return I18N.en[key]
  return fallback || key
}

const getLanguageName = (language) => {
  const key = `lang.${language.lang}`
  const translated = t(key)
  return translated === key ? language.name : translated
}

const persistSetting = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    /* Storage can be unavailable on file:// or in private mode. */
  }
}

const LANGUAGES = [
  {
    name: 'Japanese',
    native: '日本語',
    lang: 'ja',
    text: 'あなたのいる場所に、ふさわしい言葉を。',
  },
  {
    name: 'Spanish',
    native: 'Español',
    lang: 'es',
    text: 'Las palabras correctas, justo donde estás.',
  },
  {
    name: 'French',
    native: 'Français',
    lang: 'fr',
    text: 'Les bons mots, là où vous êtes.',
  },
  {
    name: 'German',
    native: 'Deutsch',
    lang: 'de',
    text: 'Die richtigen Worte, genau dort, wo Sie sind.',
  },
  {
    name: 'Arabic',
    native: 'العربية',
    lang: 'ar',
    dir: 'rtl',
    text: 'الكلمات الصحيحة، في المكان الذي أنت فيه.',
  },
  {
    name: 'Korean',
    native: '한국어',
    lang: 'ko',
    text: '당신이 있는 곳에 꼭 맞는 말을.',
  },
  {
    name: 'Chinese',
    native: '中文',
    lang: 'zh',
    text: '恰如其分的话语，就在你所在之处。',
  },
  {
    name: 'Portuguese',
    native: 'Português',
    lang: 'pt',
    text: 'As palavras certas, bem onde você está.',
  },
  {
    name: 'Italian',
    native: 'Italiano',
    lang: 'it',
    text: 'Le parole giuste, proprio dove sei.',
  },
  {
    name: 'Hindi',
    native: 'हिन्दी',
    lang: 'hi',
    text: 'सही शब्द, ठीक वहीं जहाँ आप हैं।',
  },
  {
    name: 'Turkish',
    native: 'Türkçe',
    lang: 'tr',
    text: 'Doğru sözcükler, tam da olduğunuz yerde.',
  },
  {
    name: 'Russian',
    native: 'Русский',
    lang: 'ru',
    text: 'Нужные слова — прямо там, где вы.',
  },
]

const sourceText = heroSource ? heroSource.textContent.trim() : ''
const canHover = () => finePointer.matches && !reduceMotion.matches
const isTypingTarget = (target) =>
  target instanceof Element &&
  Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))

let languageIndex = 0
let heroVisible = true
let languageMenuOpen = false
let summonOpen = false
let heroBusy = false
let autoTimer = 0
let resultTimer = 0
let typingTimer = 0
let typingToken = 0
let interactionPauseUntil = 0
let lastFocus = null

/* ── Theme, language & chrome ───────────────────────────────────────── */

const syncShareUrl = () => {
  if (!window.history?.replaceState) return

  try {
    const url = new URL(window.location.href)
    if (siteTheme === 'light') url.searchParams.set('theme', 'light')
    else url.searchParams.delete('theme')
    if (siteLang === 'ar') url.searchParams.set('lang', 'ar')
    else url.searchParams.delete('lang')
    window.history.replaceState(null, '', url)
  } catch (error) {
    /* Some file:// contexts disallow history updates. */
  }
}

const updateThemeButton = () => {
  if (!themeToggle) return
  const light = siteTheme === 'light'
  const key = light ? 'controls.themeDark' : 'controls.themeLight'
  themeToggle.setAttribute('aria-pressed', String(light))
  themeToggle.dataset.i18nAria = key
  themeToggle.setAttribute('aria-label', t(key))
  themeToggle.setAttribute('title', t(key))
}

const updateLangSwitch = () => {
  langSwitchButtons.forEach((button) => {
    const active = button.dataset.setLang === siteLang
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

const applyTheme = (theme, { persist = true, syncUrl = persist } = {}) => {
  siteTheme = normalizeTheme(theme)
  document.documentElement.setAttribute('data-theme', siteTheme)
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', siteTheme === 'light' ? '#f4f6ed' : '#080a06')
  }
  updateThemeButton()
  if (persist) persistSetting(STORAGE_THEME, siteTheme)
  if (syncUrl) syncShareUrl()
}

const applyI18n = () => {
  $$('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n
    if (key && t(key) !== key) element.innerHTML = t(key)
  })

  $$('[data-i18n-aria]').forEach((element) => {
    const key = element.dataset.i18nAria
    if (key && t(key) !== key) element.setAttribute('aria-label', t(key))
  })

  $$('[data-i18n-alt]').forEach((element) => {
    const key = element.dataset.i18nAlt
    if (key && t(key) !== key) element.setAttribute('alt', t(key))
  })

  if (metaDescription) metaDescription.setAttribute('content', t('meta.description'))
  if (ogTitle) ogTitle.setAttribute('content', t('meta.ogTitle'))
  if (ogDescription) ogDescription.setAttribute('content', t('meta.ogDescription'))
  document.title = t('meta.title')

  updateLangSwitch()
  updateThemeButton()
  refreshDynamicCopy()
}

const applySiteLang = (lang, { persist = true, syncUrl = persist } = {}) => {
  siteLang = normalizeLang(lang)
  document.documentElement.lang = siteLang
  document.documentElement.dir = siteLang === 'ar' ? 'rtl' : 'ltr'
  if (persist) persistSetting(STORAGE_LANG, siteLang)
  applyI18n()
  startTyping(160)
  if (syncUrl) syncShareUrl()
}

/* ── Header & navigation ────────────────────────────────────────────── */

let headerFrame = 0

const syncScrollUi = () => {
  const maximum = document.documentElement.scrollHeight - window.innerHeight
  const progress = maximum > 0 ? Math.min(1, Math.max(0, window.scrollY / maximum)) : 0
  if (scrollProgressBar) scrollProgressBar.style.transform = `scaleX(${progress.toFixed(4)})`
  backToTop?.classList.toggle('is-visible', window.scrollY > 680)
}

const syncHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 14)
  syncScrollUi()
  headerFrame = 0
}

if (header) {
  syncHeader()
  window.addEventListener(
    'scroll',
    () => {
      if (!headerFrame) headerFrame = window.requestAnimationFrame(syncHeader)
    },
    { passive: true },
  )
}

window.addEventListener('resize', syncScrollUi)

backToTop?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
})

const setNavOpen = (open) => {
  if (!menuToggle || !siteNav) return
  menuToggle.setAttribute('aria-expanded', String(open))
  menuToggle.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.open'))
  siteNav.classList.toggle('is-open', open)
}

menuToggle?.addEventListener('click', () => {
  setNavOpen(menuToggle.getAttribute('aria-expanded') !== 'true')
})

siteNav?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setNavOpen(false)
})

document.addEventListener('pointerdown', (event) => {
  if (
    siteNav?.classList.contains('is-open') &&
    !siteNav.contains(event.target) &&
    !menuToggle?.contains(event.target)
  ) {
    setNavOpen(false)
  }
})

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) setNavOpen(false)
  closeLanguageMenu(false)
})

$$('#siteNav a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => setNavOpen(false))
})

/* ── Download CTA ───────────────────────────────────────────────────── */

const RELEASE_BASE = 'https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0'

const DOWNLOADS = {
  windows: { file: 'Dodoi-Setup-0.2.0-x64.zip', key: 'windows' },
  mac: { file: 'Dodoi-0.2.0-arm64.zip', key: 'mac' },
  linux: { file: 'Dodoi-0.2.0-x86_64.AppImage', key: 'linux' },
  mobile: { href: '#platformList', key: 'mobile' },
}

const detectDownload = () => {
  const source = `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${
    navigator.userAgent || ''
  }`.toLowerCase()
  const touchMac = /mac/.test(source) && navigator.maxTouchPoints > 1

  if (/android|iphone|ipad|ipod/.test(source) || touchMac) return DOWNLOADS.mobile
  if (/win/.test(source)) return DOWNLOADS.windows
  if (/mac|darwin/.test(source)) return DOWNLOADS.mac
  if (/linux|x11/.test(source)) return DOWNLOADS.linux
  return DOWNLOADS.windows
}

if (downloadPrimary) {
  const target = detectDownload()
  downloadTargetKey = target.key

  if (target.file) {
    downloadPrimary.href = `${RELEASE_BASE}/${target.file}`
  } else {
    downloadPrimary.href = target.href
    downloadPrimary.removeAttribute('download')
  }

  if (downloadLabel) downloadLabel.textContent = t(`download.${downloadTargetKey}`)
}

$$('.platform-card').forEach((card) => {
  card.addEventListener('click', (event) => {
    if (event.target.closest('a')) return

    const firstLink = card.querySelector('.version-link, a')
    if (firstLink?.href) window.open(firstLink.href, '_blank', 'noopener')
  })
})

/* ── Scroll spy ─────────────────────────────────────────────────────── */

const navLinks = $$('#siteNav a[href^="#"]')
const spySections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean)

if ('IntersectionObserver' in window && spySections.length) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`
          link.classList.toggle('is-current', active)
          if (active) link.setAttribute('aria-current', 'true')
          else link.removeAttribute('aria-current')
        })
      })
    },
    { rootMargin: '-40% 0px -54% 0px', threshold: 0 },
  )

  spySections.forEach((section) => spy.observe(section))
}

/* ── Reveal on scroll ───────────────────────────────────────────────── */

const revealElements = $$('.reveal')

if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  )

  revealElements.forEach((element) => revealObserver.observe(element))
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'))
}

const steps = $('.steps')

if (steps) {
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const stepsObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          steps.classList.add('is-visible')
          observer.disconnect()
        })
      },
      { threshold: 0.2 },
    )

    stepsObserver.observe(steps)
  } else {
    steps.classList.add('is-visible')
  }
}

/* ── Pointer glow ───────────────────────────────────────────────────── */

if (pointerGlow && finePointer.matches && !reduceMotion.matches) {
  let targetX = window.innerWidth / 2
  let targetY = window.innerHeight * 0.36
  let currentX = targetX
  let currentY = targetY
  let started = false

  const renderGlow = () => {
    currentX += (targetX - currentX) * 0.11
    currentY += (targetY - currentY) * 0.11
    pointerGlow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
    window.requestAnimationFrame(renderGlow)
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return
      targetX = event.clientX
      targetY = event.clientY
      if (!started) {
        started = true
        currentX = targetX
        currentY = targetY
        pointerGlow.classList.add('is-active')
      }
    },
    { passive: true },
  )

  window.requestAnimationFrame(renderGlow)
}

/* ── Tilt & card light ──────────────────────────────────────────────── */

$$('.feature-card').forEach((card) => {
  card.addEventListener(
    'pointermove',
    (event) => {
      if (!canHover()) return
      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
      card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    },
    { passive: true },
  )

  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--mx')
    card.style.removeProperty('--my')
  })
})

$$('.tilt').forEach((card) => {
  const isPanel = card.classList.contains('translator-panel')
  const strength = isPanel ? 5.2 : 2.4

  card.addEventListener(
    'pointermove',
    (event) => {
      if (!canHover()) return
      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      card.style.setProperty('--ry', `${((x - 0.5) * strength * 2).toFixed(2)}deg`)
      card.style.setProperty('--rx', `${((0.5 - y) * strength * 2).toFixed(2)}deg`)
    },
    { passive: true },
  )

  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--rx')
    card.style.removeProperty('--ry')
  })
})

/* ── Language preview ───────────────────────────────────────────────── */

const languageMenu = document.createElement('div')
languageMenu.className = 'lang-menu'
languageMenu.id = 'heroLanguageMenu'
languageMenu.setAttribute('role', 'listbox')
languageMenu.setAttribute('aria-label', t('controls.chooseLanguage'))
languageMenu.hidden = true

LANGUAGES.forEach((language, index) => {
  const option = document.createElement('button')
  option.type = 'button'
  option.className = 'lang-option'
  option.dataset.index = String(index)
  option.setAttribute('role', 'option')
  option.setAttribute('aria-selected', 'false')

  const native = document.createElement('span')
  native.className = 'lang-native'
  native.lang = language.lang
  native.dir = language.dir || 'ltr'
  native.textContent = language.native

  const name = document.createElement('span')
  name.className = 'lang-name'
  name.textContent = getLanguageName(language)

  const check = document.createElement('span')
  check.className = 'lang-check'
  check.setAttribute('aria-hidden', 'true')
  check.textContent = '✓'

  option.append(native, name, check)
  languageMenu.append(option)
})

const languageMenuFoot = document.createElement('p')
languageMenuFoot.className = 'lang-menu-foot'
languageMenuFoot.textContent = t('controls.languagesFoot')
languageMenu.append(languageMenuFoot)
document.body.append(languageMenu)

if (heroLanguage) {
  heroLanguage.setAttribute('aria-haspopup', 'listbox')
  heroLanguage.setAttribute('aria-expanded', 'false')
  heroLanguage.setAttribute('aria-controls', 'heroLanguageMenu')
}

const updateLanguageMenuSelection = () => {
  $$('.lang-option', languageMenu).forEach((option, index) => {
    const selected = index === languageIndex
    option.classList.toggle('is-selected', selected)
    option.setAttribute('aria-selected', String(selected))
  })
}

const positionLanguageMenu = () => {
  if (!heroLanguage || languageMenu.hidden) return
  const rect = heroLanguage.getBoundingClientRect()
  const width = Math.min(238, window.innerWidth - 24)
  languageMenu.style.width = `${width}px`

  const menuRect = languageMenu.getBoundingClientRect()
  const gap = 10
  let left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12)
  let top = rect.top - menuRect.height - gap

  if (top < 12) top = Math.min(rect.bottom + gap, window.innerHeight - menuRect.height - 12)
  languageMenu.style.left = `${left}px`
  languageMenu.style.top = `${Math.max(12, top)}px`
}

const closeLanguageMenu = (restoreFocus = false) => {
  if (!languageMenuOpen) return
  languageMenuOpen = false
  languageMenu.classList.remove('is-open')
  heroLanguage?.setAttribute('aria-expanded', 'false')

  window.setTimeout(() => {
    if (!languageMenuOpen) languageMenu.hidden = true
  }, 180)

  window.removeEventListener('scroll', onWindowScrollWhileMenuOpen)
  window.removeEventListener('resize', onWindowResizeWhileMenuOpen)

  if (restoreFocus) heroLanguage?.focus({ preventScroll: true })
  scheduleAutoCycle()
}

const onWindowScrollWhileMenuOpen = () => positionLanguageMenu()
const onWindowResizeWhileMenuOpen = () => positionLanguageMenu()

const onDocumentPointerDownWhileMenuOpen = (event) => {
  if (!languageMenu.contains(event.target) && !heroLanguage?.contains(event.target)) {
    closeLanguageMenu(true)
  }
}

const openLanguageMenu = () => {
  if (!heroLanguage || languageMenuOpen) return
  languageMenuOpen = true
  window.clearTimeout(autoTimer)
  languageMenu.hidden = false
  updateLanguageMenuSelection()
  positionLanguageMenu()
  heroLanguage.setAttribute('aria-expanded', 'true')

  window.requestAnimationFrame(() => {
    languageMenu.classList.add('is-open')
    const selected = $('.lang-option.is-selected', languageMenu)
    if (selected) {
      languageMenu.scrollTop = Math.max(
        0,
        selected.offsetTop - languageMenu.clientHeight / 2 + selected.offsetHeight / 2,
      )
      selected.focus({ preventScroll: true })
    }
  })

  document.addEventListener('pointerdown', onDocumentPointerDownWhileMenuOpen, true)
  window.addEventListener('scroll', onWindowScrollWhileMenuOpen, { passive: true })
  window.addEventListener('resize', onWindowResizeWhileMenuOpen)
}

heroLanguage?.addEventListener('click', () => {
  if (languageMenuOpen) closeLanguageMenu(true)
  else openLanguageMenu()
})

languageMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.lang-option')
  if (!option) return
  interactionPauseUntil = Date.now() + 9000
  setLanguage(Number(option.dataset.index))
  closeLanguageMenu(true)
})

languageMenu.addEventListener('keydown', (event) => {
  const options = $$('.lang-option', languageMenu)
  const currentIndex = options.indexOf(document.activeElement)

  if (event.key === 'Escape') {
    event.preventDefault()
    closeLanguageMenu(true)
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    closeLanguageMenu(true)
    return
  }

  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()

  let nextIndex = currentIndex
  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length
  if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = options.length - 1
  options[nextIndex]?.focus()
})

const applyLanguage = (language) => {
  if (languageMenuOpen) updateLanguageMenuSelection()

  const name = getLanguageName(language)
  if (heroTarget) heroTarget.textContent = name
  if (heroTargetLabel) heroTargetLabel.textContent = name
  if (summonTarget) summonTarget.textContent = name
  if (summonTargetFooter) summonTargetFooter.textContent = name

  if (heroResult) {
    heroResult.textContent = language.text
    heroResult.lang = language.lang
    heroResult.dir = language.dir || 'ltr'
    heroResult.classList.remove('is-changing')
  }

  if (summonResult) {
    summonResult.textContent = language.text
    summonResult.lang = language.lang
    summonResult.dir = language.dir || 'ltr'
    summonResult.classList.remove('is-changing')
  }
}

const setLanguage = (index, { instant = false } = {}) => {
  languageIndex = ((index % LANGUAGES.length) + LANGUAGES.length) % LANGUAGES.length
  const language = LANGUAGES[languageIndex]
  const name = getLanguageName(language)

  if (heroTarget) heroTarget.textContent = name
  if (heroTargetLabel) heroTargetLabel.textContent = name
  if (summonTargetFooter) summonTargetFooter.textContent = name
  updateLanguageMenuSelection()

  window.clearTimeout(resultTimer)

  if (instant || reduceMotion.matches) {
    applyLanguage(language)
    return
  }

  heroResult?.classList.add('is-changing')
  summonResult?.classList.add('is-changing')
  resultTimer = window.setTimeout(() => applyLanguage(language), 200)
}

const scheduleAutoCycle = () => {
  window.clearTimeout(autoTimer)
  if (reduceMotion.matches || !heroVisible || document.hidden || languageMenuOpen || summonOpen) {
    return
  }

  autoTimer = window.setTimeout(() => {
    if (heroBusy || languageMenuOpen || summonOpen || Date.now() < interactionPauseUntil) {
      scheduleAutoCycle()
      return
    }

    setLanguage(languageIndex + 1)
    scheduleAutoCycle()
  }, 6500)
}

if (heroPanel) {
  const heroObserver = new IntersectionObserver(
    (entries) => {
      heroVisible = entries[0]?.isIntersecting ?? true
      if (heroVisible) scheduleAutoCycle()
      else window.clearTimeout(autoTimer)
    },
    { threshold: 0.25 },
  )

  heroObserver.observe(heroPanel)

  heroPanel.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') window.clearTimeout(autoTimer)
  })

  heroPanel.addEventListener('pointerleave', () => {
    if (!languageMenuOpen) scheduleAutoCycle()
  })

  heroPanel.addEventListener('focusin', () => window.clearTimeout(autoTimer))
  heroPanel.addEventListener('focusout', (event) => {
    if (!heroPanel.contains(event.relatedTarget)) scheduleAutoCycle()
  })
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.clearTimeout(autoTimer)
  else scheduleAutoCycle()
})

const startTyping = (delay = 520) => {
  if (!heroSource) {
    scheduleAutoCycle()
    return
  }

  window.clearTimeout(typingTimer)
  typingToken += 1
  const token = typingToken
  let typed = 0

  heroSource.textContent = sourceText

  if (reduceMotion.matches) {
    scheduleAutoCycle()
    return
  }

  heroSource.textContent = ''

  const typeNext = () => {
    if (token !== typingToken) return

    if (!heroVisible) {
      heroSource.textContent = sourceText
      scheduleAutoCycle()
      return
    }

    typed = Math.min(sourceText.length, typed + 1 + Math.floor(Math.random() * 2))
    heroSource.textContent = sourceText.slice(0, typed)

    if (typed < sourceText.length) {
      typingTimer = window.setTimeout(typeNext, 24 + Math.random() * 34)
    } else {
      scheduleAutoCycle()
    }
  }

  typingTimer = window.setTimeout(typeNext, delay)
}

const refreshHeroLabels = () => {
  const phaseKey =
    heroPhase === 'translating'
      ? 'hero.translating'
      : heroPhase === 'translated'
        ? 'hero.translated'
        : 'hero.ready'
  if (heroStatus) heroStatus.textContent = t(phaseKey)
  if (heroTranslateLabel) {
    heroTranslateLabel.textContent = t(heroPhase === 'ready' ? 'hero.translate' : phaseKey)
  }
}

heroTranslate?.addEventListener('click', () => {
  if (heroBusy) return

  heroBusy = true
  interactionPauseUntil = Date.now() + 9000
  window.clearTimeout(autoTimer)
  heroPanel?.classList.add('is-translating')
  heroTranslate.disabled = true

  heroPhase = 'translating'
  refreshHeroLabels()

  window.setTimeout(() => {
    setLanguage(languageIndex + 1)
    heroPhase = 'translated'
    refreshHeroLabels()

    window.setTimeout(() => {
      heroPanel?.classList.remove('is-translating')
      heroPhase = 'ready'
      refreshHeroLabels()
      heroTranslate.disabled = false
      heroBusy = false
      scheduleAutoCycle()
    }, 1350)
  }, 680)
})

updateLanguageMenuSelection()

/* ── Summon modal ───────────────────────────────────────────────────── */

const getFocusable = (scope) =>
  $$(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    scope,
  ).filter((element) => element.getClientRects().length > 0)

const pageChrome = [$('.site-header'), $('#main'), $('.site-footer'), backToTop].filter(Boolean)

const openSummon = () => {
  if (!summonLayer || !summonLayer.hidden) return

  lastFocus = document.activeElement
  summonOpen = true
  window.clearTimeout(autoTimer)
  setNavOpen(false)
  closeLanguageMenu(false)
  summonLayer.hidden = false
  document.body.classList.add('is-locked')
  pageChrome.forEach((element) => {
    element.inert = true
  })
  applyLanguage(LANGUAGES[languageIndex])

  window.requestAnimationFrame(() => {
    const closeButton = $('[data-summon-close]', summonLayer)
    closeButton?.focus({ preventScroll: true })
  })
}

const closeSummon = () => {
  if (!summonLayer || summonLayer.hidden) return

  summonLayer.hidden = true
  summonOpen = false
  document.body.classList.remove('is-locked')
  pageChrome.forEach((element) => {
    element.inert = false
  })

  if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true })
  lastFocus = null
  scheduleAutoCycle()
}

$$('.summon-trigger').forEach((trigger) => {
  trigger.addEventListener('click', openSummon)
})

summonLayer?.addEventListener('click', (event) => {
  if (event.target.closest('[data-summon-close]')) closeSummon()
})

summonNext?.addEventListener('click', () => {
  interactionPauseUntil = Date.now() + 9000
  setLanguage(languageIndex + 1)
})

summonLayer?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSummon()
    return
  }

  if (event.key !== 'Tab') return
  const focusable = getFocusable(summonLayer)
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
})

/* ── Cloud / local switch ───────────────────────────────────────────── */

const switchDemo = $('[data-switch-demo]')

if (switchDemo) {
  const toggle = $('.switch', switchDemo)
  const labels = $$('[data-mode-label]', switchDemo)
  const caption = $('[data-switch-caption]', switchDemo)

  refreshSwitchPreview = () => {
    if (!toggle) return
    switchDemo.classList.toggle('is-local', localPreview)
    toggle.setAttribute('aria-checked', String(localPreview))
    labels.forEach((label) => {
      label.classList.toggle('is-active', (label.dataset.modeLabel === 'local') === localPreview)
    })
    if (caption) {
      caption.textContent = t(localPreview ? 'features.switchLocal' : 'features.switchCloud')
    }
  }

  toggle?.addEventListener('click', () => {
    localPreview = !localPreview
    refreshSwitchPreview()
  })

  refreshSwitchPreview()
}

/* ── Local engine preview ───────────────────────────────────────────── */

const offlineToggle = $('[data-offline-toggle]')
const offlineLabel = $('[data-offline-label]')
const engineCard = $('[data-engine-card]')
const engineStateLabel = $('[data-engine-state-label]')
const engineBadge = $('.engine-badge')
const engineLogLast = $('[data-engine-log]')

if (offlineToggle && engineCard) {
  refreshEnginePreview = () => {
    engineCard.classList.toggle('is-airplane', airplaneMode)
    offlineToggle.classList.toggle('is-airplane', airplaneMode)
    offlineToggle.setAttribute('aria-pressed', String(airplaneMode))

    if (offlineLabel) {
      offlineLabel.textContent = t(airplaneMode ? 'offline.restore' : 'offline.simulate')
    }
    if (engineStateLabel) {
      engineStateLabel.textContent = t(airplaneMode ? 'offline.airplane' : 'offline.online')
    }
    if (engineBadge) {
      engineBadge.innerHTML = `<span class="status-dot"></span> ${t(
        airplaneMode ? 'offline.noNetwork' : 'offline.localhost',
      )}`
    }
    if (engineLogLast) {
      engineLogLast.textContent = t(airplaneMode ? 'offline.logAirplane' : 'offline.log3')
    }
  }

  offlineToggle.addEventListener('click', () => {
    airplaneMode = !airplaneMode
    refreshEnginePreview()
    interactionPauseUntil = Date.now() + 4000
  })

  refreshEnginePreview()
}

/* ── Screenshot tabs ────────────────────────────────────────────────── */

const shotTabs = $$('.tab[data-shot]')
const shotImage = $('#shotImage')
const shotNote = $('#shotNote')
const shotPanel = $('#shot-panel')

const SHOTS = {
  overlay: {
    src: 'assets/shots/overlay.png',
    altKey: 'product.overlayAlt',
    noteKey: 'product.overlayNote',
  },
  settings: {
    src: 'assets/shots/settings.png',
    altKey: 'product.settingsAlt',
    noteKey: 'product.settingsNote',
  },
}

Object.values(SHOTS).forEach((shot) => {
  const image = new Image()
  image.src = shot.src
})

let shotToken = 0

refreshShotCopy = () => {
  const shot = SHOTS[currentShotKey]
  if (!shot) return
  if (shotNote) shotNote.textContent = t(shot.noteKey)
  if (shotImage) shotImage.alt = t(shot.altKey)
}

const showShot = (key, tab) => {
  const shot = SHOTS[key]
  if (!shot || !shotImage) return

  const token = ++shotToken
  currentShotKey = key
  shotTabs.forEach((item) => {
    const active = item === tab
    item.classList.toggle('is-active', active)
    item.setAttribute('aria-selected', String(active))
    item.tabIndex = active ? 0 : -1
  })

  shotPanel?.setAttribute('aria-labelledby', tab.id)
  refreshShotCopy()
  shotImage.classList.add('is-switching')

  const preload = new Image()
  preload.src = shot.src

  const apply = () => {
    if (token !== shotToken) return
    shotImage.src = shot.src
    shotImage.alt = t(shot.altKey)
    window.setTimeout(() => {
      if (token === shotToken) shotImage.classList.remove('is-switching')
    }, 70)
  }

  if (preload.complete) {
    window.setTimeout(apply, 170)
  } else {
    preload.addEventListener('load', () => window.setTimeout(apply, 70), { once: true })
    preload.addEventListener('error', apply, { once: true })
  }
}

shotTabs.forEach((tab) => {
  tab.addEventListener('click', () => showShot(tab.dataset.shot, tab))

  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    const current = shotTabs.indexOf(tab)
    let next = current
    if (event.key === 'ArrowLeft') next = (current - 1 + shotTabs.length) % shotTabs.length
    if (event.key === 'ArrowRight') next = (current + 1) % shotTabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = shotTabs.length - 1

    const nextTab = shotTabs[next]
    nextTab.focus()
    showShot(nextTab.dataset.shot, nextTab)
  })
})

/* ── Dynamic copy refresh ───────────────────────────────────────────── */

function refreshDynamicCopy() {
  refreshHeroLabels()
  updateLangSwitch()
  updateThemeButton()
  refreshSwitchPreview()
  refreshEnginePreview()
  refreshShotCopy()

  if (downloadLabel) downloadLabel.textContent = t(`download.${downloadTargetKey}`)
  if (languageMenuFoot) languageMenuFoot.textContent = t('controls.languagesFoot')
  if (languageMenu) languageMenu.setAttribute('aria-label', t('controls.chooseLanguage'))

  $$('.lang-name', languageMenu).forEach((element, index) => {
    const language = LANGUAGES[index]
    if (language) element.textContent = getLanguageName(language)
  })

  applyLanguage(LANGUAGES[languageIndex], { instant: true })

  if (menuToggle) {
    const open = menuToggle.getAttribute('aria-expanded') === 'true'
    menuToggle.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.open'))
  }
}

/* ── Theme & language controls ──────────────────────────────────────── */

themeToggle?.addEventListener('click', () => {
  applyTheme(siteTheme === 'light' ? 'dark' : 'light')
})

langSwitchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.setLang === siteLang) return
    applySiteLang(button.dataset.setLang)
  })
})

/* ── Global shortcut & escape ───────────────────────────────────────── */

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) return

  if (event.key === 'Escape') {
    if (summonOpen) return closeSummon()
    if (languageMenuOpen) return closeLanguageMenu(true)
    if (siteNav?.classList.contains('is-open')) setNavOpen(false)
    return
  }

  if (event.repeat || summonOpen || event.ctrlKey || event.metaKey || event.altKey) return
  if (isTypingTarget(event.target)) return

  const summonShortcut = event.shiftKey && (event.key === '~' || event.code === 'Backquote')
  if (summonShortcut) {
    event.preventDefault()
    openSummon()
  }
})

/* ── Initial state ──────────────────────────────────────────────────── */

applyTheme(siteTheme, { persist: false, syncUrl: false })
applySiteLang(siteLang, { persist: false, syncUrl: false })
updateLanguageMenuSelection()
applyLanguage(LANGUAGES[languageIndex])
refreshHeroLabels()
syncScrollUi()
startTyping()
