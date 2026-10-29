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

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

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
let interactionPauseUntil = 0
let lastFocus = null

/* ── Header & navigation ────────────────────────────────────────────── */

let headerFrame = 0

const syncHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 14)
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

const setNavOpen = (open) => {
  if (!menuToggle || !siteNav) return
  menuToggle.setAttribute('aria-expanded', String(open))
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
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

const RELEASE_BASE = 'https://github.com/azzamalessa188-star/dodoi/releases/download/v0.1.0'

const DOWNLOADS = {
  windows: { file: 'Dodoi-Setup-0.1.0-x64.exe', label: 'Download for Windows' },
  mac: { file: 'Dodoi-0.1.0-arm64.zip', label: 'Download for macOS' },
  linux: { file: 'Dodoi-0.1.0-x86_64.AppImage', label: 'Download for Linux' },
  mobile: { href: '#platformList', label: 'Choose your desktop' },
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

  if (target.file) {
    downloadPrimary.href = `${RELEASE_BASE}/${target.file}`
  } else {
    downloadPrimary.href = target.href
    downloadPrimary.removeAttribute('download')
  }

  if (downloadLabel) downloadLabel.textContent = target.label
}

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
languageMenu.setAttribute('aria-label', 'Choose a translation language')
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
  name.textContent = language.name

  const check = document.createElement('span')
  check.className = 'lang-check'
  check.setAttribute('aria-hidden', 'true')
  check.textContent = '✓'

  option.append(native, name, check)
  languageMenu.append(option)
})

const languageMenuFoot = document.createElement('p')
languageMenuFoot.className = 'lang-menu-foot'
languageMenuFoot.textContent = '33 languages in the app'
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

  if (heroTarget) heroTarget.textContent = language.name
  if (heroTargetLabel) heroTargetLabel.textContent = language.name
  if (summonTarget) summonTarget.textContent = language.name
  if (summonTargetFooter) summonTargetFooter.textContent = language.name

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

  if (heroTarget) heroTarget.textContent = language.name
  if (heroTargetLabel) heroTargetLabel.textContent = language.name
  if (summonTargetFooter) summonTargetFooter.textContent = language.name
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

if (reduceMotion.matches) {
  if (heroSource) heroSource.textContent = sourceText
} else if (heroSource) {
  let typed = 0
  heroSource.textContent = ''

  const typeNext = () => {
    if (!heroVisible) {
      heroSource.textContent = sourceText
      scheduleAutoCycle()
      return
    }

    typed = Math.min(sourceText.length, typed + 1 + Math.floor(Math.random() * 2))
    heroSource.textContent = sourceText.slice(0, typed)

    if (typed < sourceText.length) {
      window.setTimeout(typeNext, 24 + Math.random() * 34)
    } else {
      scheduleAutoCycle()
    }
  }

  window.setTimeout(typeNext, 520)
} else {
  scheduleAutoCycle()
}

heroTranslate?.addEventListener('click', () => {
  if (heroBusy) return

  heroBusy = true
  interactionPauseUntil = Date.now() + 9000
  window.clearTimeout(autoTimer)
  heroPanel?.classList.add('is-translating')
  heroTranslate.disabled = true

  if (heroStatus) heroStatus.textContent = 'Translating'
  if (heroTranslateLabel) heroTranslateLabel.textContent = 'Translating'

  window.setTimeout(() => {
    setLanguage(languageIndex + 1)

    if (heroStatus) heroStatus.textContent = 'Translated'
    if (heroTranslateLabel) heroTranslateLabel.textContent = 'Translated'

    window.setTimeout(() => {
      heroPanel?.classList.remove('is-translating')
      if (heroStatus) heroStatus.textContent = 'Ready'
      if (heroTranslateLabel) heroTranslateLabel.textContent = 'Translate'
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

const pageChrome = [$('.site-header'), $('#main'), $('.site-footer')].filter(Boolean)

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

$$('[data-switch-demo]').forEach((demo) => {
  const toggle = $('.switch', demo)
  const labels = $$('[data-mode-label]', demo)
  const caption = $('[data-switch-caption]', demo)
  if (!toggle) return

  const setLocal = (local) => {
    demo.classList.toggle('is-local', local)
    toggle.setAttribute('aria-checked', String(local))
    labels.forEach((label) => {
      label.classList.toggle('is-active', (label.dataset.modeLabel === 'local') === local)
    })
    if (caption) caption.textContent = local ? 'NLLB-200 · on this device' : 'OpenRouter · auto-routed'
  }

  toggle.addEventListener('click', () => setLocal(!demo.classList.contains('is-local')))
})

/* ── Local engine preview ───────────────────────────────────────────── */

const offlineToggle = $('[data-offline-toggle]')
const offlineLabel = $('[data-offline-label]')
const engineCard = $('[data-engine-card]')
const engineState = $('[data-engine-state]')
const engineBadge = $('.engine-badge')
const engineLogLast = $('.engine-log span:last-child')

if (offlineToggle && engineCard) {
  let airplane = false

  const setAirplane = (next) => {
    airplane = next
    engineCard.classList.toggle('is-airplane', airplane)
    offlineToggle.classList.toggle('is-airplane', airplane)
    offlineToggle.setAttribute('aria-pressed', String(airplane))

    if (offlineLabel) offlineLabel.textContent = airplane ? 'Restore network' : 'Simulate offline'
    if (engineState) {
      engineState.innerHTML = `<span class="status-dot"></span> ${airplane ? 'Airplane mode' : 'Online'}`
    }
    if (engineBadge) {
      engineBadge.innerHTML = `<span class="status-dot"></span> ${airplane ? 'no network' : '127.0.0.1'}`
    }
    if (engineLogLast) {
      engineLogLast.innerHTML = `<i></i> ${
        airplane ? 'No network · still translating' : 'Listening on localhost'
      }`
    }
  }

  offlineToggle.addEventListener('click', () => {
    setAirplane(!airplane)
    interactionPauseUntil = Date.now() + 4000
  })
}

/* ── Screenshot tabs ────────────────────────────────────────────────── */

const shotTabs = $$('.tab[data-shot]')
const shotImage = $('#shotImage')
const shotNote = $('#shotNote')
const shotPanel = $('#shot-panel')

const SHOTS = {
  overlay: {
    src: 'assets/shots/overlay.png',
    alt: 'Dodoi floating translation overlay with a lime translate button',
    note: 'Summon · type · translate',
  },
  settings: {
    src: 'assets/shots/settings.png',
    alt: 'Dodoi settings window with provider, language, and local engine controls',
    note: 'Providers · language · local engine',
  },
}

Object.values(SHOTS).forEach((shot) => {
  const image = new Image()
  image.src = shot.src
})

let shotToken = 0

const showShot = (key, tab) => {
  const shot = SHOTS[key]
  if (!shot || !shotImage) return

  const token = ++shotToken
  shotTabs.forEach((item) => {
    const active = item === tab
    item.classList.toggle('is-active', active)
    item.setAttribute('aria-selected', String(active))
    item.tabIndex = active ? 0 : -1
  })

  shotPanel?.setAttribute('aria-labelledby', tab.id)
  if (shotNote) shotNote.textContent = shot.note
  shotImage.classList.add('is-switching')

  const preload = new Image()
  preload.src = shot.src

  const apply = () => {
    if (token !== shotToken) return
    shotImage.src = shot.src
    shotImage.alt = shot.alt
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

applyLanguage(LANGUAGES[languageIndex])
