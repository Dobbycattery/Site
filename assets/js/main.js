/* ==========================================================================
   Добби — сценарии
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ------------------------------------------------------------------
     1. Данные галереи — читаются из image_list.js
     ------------------------------------------------------------------ */
  const DATA = window.IMAGE_LIST || { lines: [] };
  const LINES = (Array.isArray(DATA.lines) ? DATA.lines : [])
    .map((line) => ({
      key: String(line.key || ""),
      cat: String(line.cat || ""),
      coat: String(line.coat || ""),
      photos: (Array.isArray(line.photos) ? line.photos : [])
        .map((p) => {
          const src = String(p.src || "");
          if (!src) return null;
          return {
            src,
            thumb: p.thumb ? String(p.thumb) : src,
            w: Number(p.w) || 600,
            h: Number(p.h) || 400,
          };
        })
        .filter(Boolean),
    }))
    .filter((line) => line.key && line.photos.length);

  if (!LINES.length) {
    console.warn(
      "[Добби] image_list.js не загружен или пуст. " +
      "Откройте image-editor.html, чтобы собрать список фотографий."
    );
  }

  const PHOTOS = [];
  LINES.forEach((line) => {
    line.photos.forEach((photo, i) => {
      PHOTOS.push({
        id: photo.src,
        line,
        num: String(i + 1).padStart(2, "0"),
        src: photo.src,
        thumb: photo.thumb,
        w: photo.w,
        h: photo.h,
      });
    });
  });
  PHOTOS.sort((a, b) => Number(a.id) - Number(b.id));

  /* ------------------------------------------------------------------
     2. Галерея
     ------------------------------------------------------------------ */
  const grid = $("#galleryGrid");
  const status = $("#galleryStatus");
  const loadMore = $("#loadMore");
  const galleryFoot = loadMore ? loadMore.closest(".gallery__foot") : null;
  // --- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ КНОПОК ФИЛЬТРА ---
  const filtersContainer = document.querySelector(".filters");
  if (filtersContainer) {
    filtersContainer.innerHTML = ""; // Очищаем старые жестко прописанные кнопки

    // 1. Создаем кнопку "Все"
    const allBtn = document.createElement("button");
    allBtn.className = "chip is-active";
    allBtn.type = "button";
    allBtn.dataset.filter = "all";
    allBtn.setAttribute("aria-pressed", "true");
    allBtn.innerHTML = `Все <span class="chip__count">${PHOTOS.length}</span>`;
    filtersContainer.appendChild(allBtn);

    // 2. Создаем кнопки для каждой линии из image_list.js
    LINES.forEach((line) => {
      const count = line.photos.length;
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.dataset.filter = line.key;
      btn.setAttribute("aria-pressed", "false");
      
      // Берем первое слово из окраса (например, "шоколадный окрас" -> "Шоколадный")
      let shortName = line.coat ? line.coat.split(" ")[0] : line.cat;
      shortName = shortName.charAt(0).toUpperCase() + shortName.slice(1);

      btn.innerHTML = `${shortName} <span class="chip__cat">· ${line.cat}</span> <span class="chip__count">${count}</span>`;
      filtersContainer.appendChild(btn);
    });
  }

  // Обновляем список кнопок для дальнейшей работы скрипта
  const chips = $$("[data-filter]");
  // --- ДИНАМИЧЕСКИЙ РАСЧЕТ ЦИФР ---
  function pluralize(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  // 1. Обновляем цифры на кнопках фильтра (Все, Шоколад, Голубой...)
  chips.forEach((chip) => {
    const filterKey = chip.dataset.filter;
    const countSpan = chip.querySelector(".chip__count");
    if (countSpan) {
      const count = filterKey === "all"
        ? PHOTOS.length
        : PHOTOS.filter((p) => p.line.key === filterKey).length;
      countSpan.textContent = count;
    }
  });

  // 2. Обновляем текст в карточке "Портретная галерея" (блок "Три двери")
  const promoEyebrow = document.querySelector('.promo-card__eyebrow');
  if (promoEyebrow && promoEyebrow.textContent.toLowerCase().includes('портрет')) {
    const count = PHOTOS.length;
    const word = pluralize(count, "портрет", "портрета", "портретов");
    promoEyebrow.textContent = `${count} ${word}`;
  }
  // ---------------------------------
  const PAGE = 15;

  let filter = "all";
  let shown = PAGE;
  let currentList = PHOTOS;

  function makeItem(photo, indexInList) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery__item";
    btn.dataset.index = String(indexInList);
    btn.style.setProperty("--i", String(indexInList % PAGE));
    btn.setAttribute("aria-label", `Открыть фотографию: ${photo.line.cat}, ${photo.line.coat}`);
    btn.innerHTML =
      `<img src="${photo.thumb}" ` +
      `alt="${photo.line.cat} — ориентальная короткошёрстная, ${photo.line.coat}" ` +
      `loading="lazy" decoding="async" width="${photo.w}" height="${photo.h}">` +
      `<span class="gallery__cap"><b>${photo.line.cat}</b><span>DB · ${photo.num}</span></span>`;
    return btn;
  }

  function render(reset = true) {
    if (!grid) return;
    if (reset) grid.innerHTML = "";
    const slice = currentList.slice(reset ? 0 : grid.children.length, shown);
    const frag = document.createDocumentFragment();
    const offset = grid.children.length;
    slice.forEach((photo, i) => frag.appendChild(makeItem(photo, offset + i)));
    grid.appendChild(frag);

    if (status) status.textContent = `Показано ${Math.min(shown, currentList.length)} из ${currentList.length}`;
    if (galleryFoot) galleryFoot.classList.toggle("is-complete", shown >= currentList.length);
    if (loadMore) {
      const left = Math.max(0, currentList.length - shown);
      const label = loadMore.querySelector("span");
      if (label) label.textContent = left > PAGE ? "Показать ещё" : "Показать все";
    }
  }

  function setFilter(key, { scroll = false } = {}) {
    filter = key;
    shown = PAGE;
    currentList = key === "all" ? PHOTOS : PHOTOS.filter((p) => p.line.key === key);
    chips.forEach((chip) => {
      const active = chip.dataset.filter === key;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    render(true);
    if (scroll) {
      const gallery = $("#gallery");
      if (gallery) gallery.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => setFilter(chip.dataset.filter));
  });

  if (loadMore) {
    loadMore.addEventListener("click", () => {
      shown = Math.min(shown + PAGE, currentList.length);
      render(false);
    });
  }

  $$(".link-filter").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filterTarget, { scroll: true }));
  });

  render(true);

  /* ------------------------------------------------------------------
     3. Лайтбокс
     ------------------------------------------------------------------ */
  const lightbox = $("#lightbox");
  const lbImg = $("#lightboxImg");
  const lbCap = $("#lightboxCap");
  const lbCount = $("#lightboxCount");
  const lbClose = $("#lightboxClose");
  const lbPrev = $("#lightboxPrev");
  const lbNext = $("#lightboxNext");
  let lbIndex = 0;
  let lastFocused = null;

  function paintLightbox() {
    const photo = currentList[lbIndex];
    if (!photo || !lbImg) return;
    lbImg.src = photo.src;
    lbImg.alt = `${photo.line.cat} — ориентальная короткошёрстная, ${photo.line.coat}`;
    lbCap.textContent = `${photo.line.cat} · ${photo.line.coat} · питомник «Добби»`;
    lbCount.textContent = `${lbIndex + 1} / ${currentList.length}`;

    /* в режиме зума фото показывается в натуральную величину */
    if (lightbox.classList.contains("zoomed")) {
      lbImg.style.width = `${photo.w}px`;
      lbImg.style.height = `${photo.h}px`;
    } else fitLightbox(photo);

    [currentList[lbIndex + 1], currentList[lbIndex - 1]].forEach((next) => {
      if (!next) return;
      const preload = new Image();
      preload.src = next.src;
    });
  }

  function fitLightbox(photo) {
    if (!lbImg) return;
    const p = photo || currentList[lbIndex];
    if (!p) return;
    /* снимки небольшие — аккуратно увеличиваем их под экран */
    const maxW = Math.min(window.innerWidth * 0.9, 1000);
    const maxH = window.innerHeight * 0.76;
    const ratio = p.w / p.h;
    let w = Math.min(p.w * 1.5, maxW);
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    lbImg.style.width = `${Math.round(w)}px`;
    lbImg.style.height = `${Math.round(h)}px`;
  }

  function openLightbox(index) {
    if (!lightbox) return;
    lbIndex = index;
    lastFocused = document.activeElement;
    lightbox.classList.remove("zoomed");
    paintLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    if (lbClose) lbClose.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightbox.classList.remove("zoomed");
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
  }

  function stepLightbox(delta) {
    if (!currentList.length) return;
    lbIndex = (lbIndex + delta + currentList.length) % currentList.length;
    if (lightbox.classList.contains("zoomed")) {
      /* листаем и в зуме — но сбрасываем к обычному виду, как в системных галереях */
      lightbox.classList.remove("zoomed");
      document.body.style.overflow = "hidden";
    }
    paintLightbox();
  }

  /* зум по двойному тапу / двойному клику: Facebook-style,
     мобильная галерея без этого неудобна — фото слишком мелкие */
  function toggleZoom() {
    if (!lightbox || !lbImg) return;
    const on = lightbox.classList.toggle("zoomed");
    if (on) {
      const photo = currentList[lbIndex];
      if (photo) { lbImg.style.width = `${photo.w}px`; lbImg.style.height = `${photo.h}px`; }
      lightbox.scrollTop = 0;
    } else {
      fitLightbox();
    }
  }

  /* вью-порт/поворот: пересчитываем размер фото в обычном режиме */
  let rotTimer = 0;
  window.addEventListener("resize", () => {
    if (!lightbox || lightbox.hidden || lightbox.classList.contains("zoomed")) return;
    clearTimeout(rotTimer);
    rotTimer = setTimeout(() => fitLightbox(), 180);
  });
  lightbox.addEventListener("dblclick", (e) => {
    if (e.target === lightbox || e.target.closest(".lightbox__top") || e.target.closest(".lightbox__nav")) return;
    e.preventDefault();
    toggleZoom();
  });
  if (grid) {
    grid.addEventListener("click", (e) => {
      const item = e.target.closest(".gallery__item");
      if (!item) return;
      openLightbox(Number(item.dataset.index));
    });
  }

  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lbPrev) lbPrev.addEventListener("click", () => stepLightbox(-1));
  if (lbNext) lbNext.addEventListener("click", () => stepLightbox(1));

  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
      if (e.key === "Tab") {
        const focusables = [lbClose, lbPrev, lbNext].filter(Boolean);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    let touchX = 0;
    let touchY = 0;
    let touchT = 0;
    lightbox.addEventListener("touchstart", (e) => {
      touchX = e.changedTouches[0].clientX;
      touchY = e.changedTouches[0].clientY;
      touchT = Date.now();
    }, { passive: true });
    lightbox.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      const quick = Date.now() - touchT < 400 && Math.hypot(dx, dy) < 24;
      if (lightbox.classList.contains("zoomed")) return; /* в зуме скроллим, не листаем */
      if (quick) return; /* тап без движения — это клик, не свайп */
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx > 0 ? -1 : 1);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     4. Тема «Люмос / Нокс»
     ------------------------------------------------------------------ */
  const root = document.documentElement;
  const themeToggle = $("#themeToggle");

  function storeTheme(value) {
    try { localStorage.setItem("db-theme", value); } catch (err) { /* file:// может запрещать */ }
  }

  function applyTheme(value) {
    root.dataset.theme = value;
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", value === "dark" ? "Включить свет: Люмос" : "Погасить свет: Нокс");
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", value === "dark" ? "#04100a" : "#eff5e2");
    dustColors();
  }

  try {
    const saved = localStorage.getItem("db-theme");
    if (saved === "light" || saved === "dark") applyTheme(saved);
  } catch (err) { /* ignore */ }

  /* предпросмотр темы по ссылке: index.html?theme=light */
  const themeParam = new URLSearchParams(window.location.search).get("theme");
  if (themeParam === "light" || themeParam === "dark") applyTheme(themeParam);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
      storeTheme(root.dataset.theme);
    });
  }

  /* дорожка из лапок вдоль страницы */
  const rail = $("#rail");
  const railFill = $("#railFill");
  const railTip = $("#railTip");
  const railPaws = $$(".rail__paw");
  railPaws.forEach((paw) => {
    paw.style.top = `${parseFloat(paw.dataset.at) * 100}%`;
  });

  function updateRail(progress, y) {
    if (!rail) return;
    const pct = Math.max(0, Math.min(100, progress * 100));
    if (railFill) railFill.style.height = `${pct}%`;
    if (railTip) railTip.style.top = `${pct}%`;
    railPaws.forEach((paw) => {
      paw.classList.toggle("is-lit", progress >= parseFloat(paw.dataset.at));
    });
    rail.classList.toggle("is-on", y > 240);
  }

  /* ------------------------------------------------------------------
     5. Шапка, прогресс, наверх + параллакс героя
     ------------------------------------------------------------------ */
  const header = $("#header");
  const progressBar = $("#progressBar");
  const toTop = $("#toTop");

  const heroSection = $(".hero");
  const heroCopy = $(".hero__copy");
  const heroPortrait = $("#portrait");
  const heroSeal = $(".hero__seal");
  let heroHeight = 0;

  function measureHero() {
    heroHeight = heroSection ? heroSection.offsetHeight : 0;
  }
  measureHero();

  function resetHeroParallax() {
    [heroCopy, heroPortrait, heroSeal].forEach((el) => {
      if (!el) return;
      el.style.transform = "";
      el.style.opacity = "";
    });
  }

  function updateHeroParallax(y) {
    if (!heroSection) return;
    if (reduceMotion || window.innerWidth < 900) return;
    if (y > heroHeight + 160) return;
    const p = Math.min(1, y / (heroHeight * 0.85 || 1));
    if (heroCopy) {
      heroCopy.style.transform = `translate3d(0, ${(y * 0.2).toFixed(1)}px, 0)`;
      heroCopy.style.opacity = Math.max(0, 1 - p * 1.3).toFixed(3);
    }
    if (heroPortrait) {
      heroPortrait.style.transform = `translate3d(0, ${(y * 0.07).toFixed(1)}px, 0) scale(${(1 + p * 0.05).toFixed(3)})`;
    }
    if (heroSeal) {
      heroSeal.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0) rotate(-5deg)`;
    }
  }

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (toTop) toTop.classList.toggle("is-visible", y > 700);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (y / max) * 100) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    updateRail(pct / 100, y);
    updateHeroParallax(y);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measureHero();
    if (window.innerWidth < 900 || reduceMotion) resetHeroParallax();
    onScroll();
  });
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ------------------------------------------------------------------
     6. Меню
     ------------------------------------------------------------------ */
  const burger = $("#burger");
  const nav = $("#nav");

  function setMenu(open) {
    if (!burger || !nav) return;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  }

  if (burger) {
    burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  }
  if (nav) {
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMenu(false);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav && nav.classList.contains("is-open")) setMenu(false);
  });

  /* ------------------------------------------------------------------
     7. Появление при скролле
     ------------------------------------------------------------------ */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    const groups = new Map();
    revealEls.forEach((el) => {
      const parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, 0);
      const index = groups.get(parent);
      groups.set(parent, index + 1);
      el.style.setProperty("--delay", `${Math.min(index * 90, 420)}ms`);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in-view"));
  }

  /* ------------------------------------------------------------------
     8. Активный пункт меню
     ------------------------------------------------------------------ */
  const navLinks = $$(".nav__link");
  const sections = $$("main section[id]");
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach((section) => spy.observe(section));
  }

  /* ------------------------------------------------------------------
     9. FAQ
     ------------------------------------------------------------------ */
  const faqItems = $$(".faq__item");

  /* --- «намокание чернил»: слова проступают пятнами вразнобой --- */
  const faqTimers = new WeakMap();

  function inkWrap(paragraph) {
    /* делим на слова, каждое получает своё время «намокания» */
    if (paragraph.dataset.wetted === "1") return;
    const text = paragraph.textContent;
    paragraph.dataset.raw = text;
    paragraph.dataset.wetted = "1";
    paragraph.setAttribute("aria-label", text);
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return;
      if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
      const w = document.createElement("span");
      w.className = "ink-w";
      w.textContent = chunk;
      frag.appendChild(w);
    });
    paragraph.replaceChildren(frag);
  }

  function inkUnwrap(paragraph) {
    const t = faqTimers.get(paragraph);
    if (t) { clearTimeout(t); faqTimers.delete(paragraph); }
    if (paragraph.dataset.wetted === "1") {
      paragraph.textContent = paragraph.dataset.raw;
      delete paragraph.dataset.raw;
      paragraph.dataset.wetted = "0";
      paragraph.removeAttribute("aria-label");
    }
  }

  function inkWet(paragraph, index) {
    inkUnwrap(paragraph);
    inkWrap(paragraph);
    const words = $$(".ink-w", paragraph);
    /* небольшой разброс: слово может «намокнуть» раньше или позже соседа */
    words.forEach((w, i) => {
      const base = index * 0.14 + i * 0.105;
      const jitter = Math.random() * 0.16;
      w.style.setProperty("--d", (base + jitter).toFixed(2) + "s");
    });
    void paragraph.offsetWidth;
    words.forEach((w) => { w.style.animation = "none"; void w.offsetWidth; w.style.animation = ""; });
    faqTimers.set(paragraph, setTimeout(() => inkUnwrap(paragraph), 2600 + index * 140));
  }

  function wetItem(item) {
    $$(".faq__a p", item).forEach((p, i) => inkWet(p, i));
  }

  faqItems.forEach((item) => {
    const btn = $(".faq__q", item);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      faqItems.forEach((other) => {
        other.classList.remove("is-open");
        const otherBtn = $(".faq__q", other);
        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
        $$(".faq__a p", other).forEach(inkUnwrap);
      });
      if (willOpen) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        wetItem(item);
      }
    });
  });

  /* первый, уже открытый вопрос намокает при появлении в кадре */
  const diary = $(".diary");
  if (diary && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const openItem = $(".faq__item.is-open", diary);
        if (openItem) setTimeout(() => wetItem(openItem), 240);
      });
    }, { threshold: 0.3 });
    io.observe(diary);
  }

  /* ------------------------------------------------------------------
     10. Звёздная карта, пыль и падающие звёзды
     ------------------------------------------------------------------ */
  const canvas = $("#dust");
  /* var, а не let: applyTheme() вызывает dustColors() раньше этого места */
  var dustCtx = null;
  var particles = [];
  var stars = [];
  var links = [];
  var shooting = null;
  var nextShooting = 4500;
  var dustRAF = 0;
  var dustVisible = true;
  var heroInView = true;
  var skyFrame = 0;
  var rgb = null;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function hexToRgb(hex) {
    const clean = String(hex).trim().replace("#", "");
    if (clean.length !== 6) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  function dustColors() {
    rgb = hexToRgb(getComputedStyle(root).getPropertyValue("--gold")) || rgb || { r: 168, g: 255, b: 62 };
    (particles || []).forEach((p) => { p.alpha = 0.15 + Math.random() * 0.5; });
  }

  function buildSky(w, h) {
    const count = Math.max(26, Math.min(84, Math.round((w * h) / 34000)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.35 + Math.random() * 0.95,
      alpha: 0.14 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.009,
      depth: 0.3 + Math.random() * 0.7,
    }));
    links = [];
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const d = Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y);
        if (d < 168) links.push({ a: i, b: j, alpha: (1 - d / 168) * 0.1 });
      }
    }
  }

  function sizeDust() {
    if (!dustCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(24, Math.min(76, Math.round((w * h) / 24000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.7,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.06 - Math.random() * 0.22,
      alpha: 0.12 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.012,
    }));
    buildSky(w, h);
  }

  function drawDust() {
    if (!dustCtx) return;
    if (!rgb) rgb = { r: 168, g: 255, b: 62 };
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    dustCtx.clearRect(0, 0, w, h);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    /* созвездия рисуем через кадр — экономим GPU */
    skyFrame = (skyFrame + 1) % 2;
    if (skyFrame === 0) {
      dustCtx.lineWidth = 0.5;
      links.forEach((l) => {
        const a = stars[l.a];
        const b = stars[l.b];
        if (!a || !b) return;
        dustCtx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${l.alpha})`;
        dustCtx.beginPath();
        dustCtx.moveTo(a.x + pointer.x * a.depth * 9, a.y + pointer.y * a.depth * 6);
        dustCtx.lineTo(b.x + pointer.x * b.depth * 9, b.y + pointer.y * b.depth * 6);
        dustCtx.stroke();
      });
    }

    /* звёзды */
    dustCtx.shadowBlur = 6;
    stars.forEach((s) => {
      if (!reduceMotion) s.phase += s.speed;
      const tw = 0.55 + 0.45 * Math.sin(s.phase);
      const x = s.x + pointer.x * s.depth * 9;
      const y = s.y + pointer.y * s.depth * 6;
      dustCtx.beginPath();
      dustCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.alpha * tw})`;
      dustCtx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${s.alpha * tw})`;
      dustCtx.arc(x, y, s.r, 0, Math.PI * 2);
      dustCtx.fill();
    });

    /* пыль */
    particles.forEach((p) => {
      if (!reduceMotion) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.speed;
        if (p.y < -12) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -12) p.x = w + 10;
        if (p.x > w + 12) p.x = -10;
      }
      const twinkle = 0.55 + 0.45 * Math.sin(p.phase);
      const a = p.alpha * twinkle;
      dustCtx.beginPath();
      dustCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
      dustCtx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a * 0.9})`;
      dustCtx.shadowBlur = 7;
      dustCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      dustCtx.fill();
    });
    dustCtx.shadowBlur = 0;

    /* падающая звезда */
    if (!reduceMotion) {
      const now = performance.now();
      if (!shooting && now > nextShooting) {
        shooting = {
          x: w * (0.15 + Math.random() * 0.7),
          y: h * (0.05 + Math.random() * 0.28),
          vx: -2.6 - Math.random() * 1.8,
          vy: 1.6 + Math.random() * 1.2,
          life: 1,
        };
        nextShooting = now + 7000 + Math.random() * 9000;
      }
      if (shooting) {
        shooting.x += shooting.vx * 5;
        shooting.y += shooting.vy * 5;
        shooting.life -= 0.018;
        if (shooting.life <= 0) {
          shooting = null;
        } else {
          const tail = 12;
          const grad = dustCtx.createLinearGradient(
            shooting.x, shooting.y,
            shooting.x - shooting.vx * tail, shooting.y - shooting.vy * tail
          );
          grad.addColorStop(0, `rgba(240, 255, 214, ${0.85 * shooting.life})`);
          grad.addColorStop(1, "rgba(168, 255, 62, 0)");
          dustCtx.strokeStyle = grad;
          dustCtx.lineWidth = 1.5;
          dustCtx.beginPath();
          dustCtx.moveTo(shooting.x, shooting.y);
          dustCtx.lineTo(shooting.x - shooting.vx * tail, shooting.y - shooting.vy * tail);
          dustCtx.stroke();
        }
      }
    }
  }

  function loopDust() {
    drawDust();
    dustRAF = requestAnimationFrame(loopDust);
  }

  if (canvas && canvas.getContext) {
    dustCtx = canvas.getContext("2d");
    sizeDust();
    dustColors();

    const hero = $(".hero");
    if (hero && finePointer) {
      hero.addEventListener("pointermove", (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      }, { passive: true });
    }

    if (reduceMotion) {
      drawDust();
    } else {
      loopDust();
      if (hero && "IntersectionObserver" in window) {
        const dustObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            heroInView = entry.isIntersecting;
            if (entry.isIntersecting && dustVisible === false) {
              dustVisible = true;
              loopDust();
            } else if (!entry.isIntersecting && dustVisible === true) {
              dustVisible = false;
              cancelAnimationFrame(dustRAF);
            }
          });
        }, { threshold: 0 });
        dustObserver.observe(hero);
      }
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelAnimationFrame(dustRAF);
        } else if (dustVisible) {
          loopDust();
        }
      });
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sizeDust();
        if (reduceMotion) drawDust();
      }, 180);
    });
  }

  /* ------------------------------------------------------------------
     10.5 Искры, свечение курсора, дорожка из лапок
     ------------------------------------------------------------------ */
  const sparkCanvas = $("#sparks");
  let sparkCtx = null;
  let sparkParts = [];
  let sparkRings = [];
  let sparkRAF = 0;
  let sparkW = 0;
  let sparkH = 0;

  function sizeSparks() {
    if (!sparkCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    sparkW = window.innerWidth;
    sparkH = window.innerHeight;
    sparkCanvas.width = Math.round(sparkW * dpr);
    sparkCanvas.height = Math.round(sparkH * dpr);
    sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sparkLoop() {
    if (!sparkCtx) return;
    sparkCtx.clearRect(0, 0, sparkW, sparkH);
    sparkParts = sparkParts.filter((p) => p.life > 0);
    sparkRings = sparkRings.filter((r) => r.life > 0);

    sparkRings.forEach((r) => {
      r.r += 1.9;
      r.life -= 0.05;
      sparkCtx.beginPath();
      sparkCtx.strokeStyle = `rgba(214, 255, 155, ${Math.max(r.life, 0) * 0.45})`;
      sparkCtx.lineWidth = 1.2;
      sparkCtx.shadowColor = "rgba(190, 255, 110, 0.5)";
      sparkCtx.shadowBlur = 10;
      sparkCtx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      sparkCtx.stroke();
    });

    sparkParts.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.02;
      p.life -= p.decay;
      const a = Math.max(p.life, 0);
      sparkCtx.beginPath();
      sparkCtx.fillStyle = p.color.replace("ALPHA", a.toFixed(3));
      sparkCtx.shadowColor = p.color.replace("ALPHA", Math.min(a + 0.25, 1).toFixed(3));
      sparkCtx.shadowBlur = 12;
      sparkCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      sparkCtx.fill();
    });
    sparkCtx.shadowBlur = 0;
    if (sparkParts.length || sparkRings.length) {
      sparkRAF = requestAnimationFrame(sparkLoop);
    } else {
      sparkRAF = 0;
    }
  }

  function sparkBurst(x, y, count = 18, power = 1) {
    if (!sparkCtx || reduceMotion) return;
    sparkRings.push({ x, y, r: 5, life: 1 });
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.9 + Math.random() * 3.6) * power;
      sparkParts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        life: 0.95 + Math.random() * 0.35,
        decay: 0.012 + Math.random() * 0.02,
        size: 1 + Math.random() * 2.2,
        color: Math.random() < 0.26
          ? "rgba(248, 255, 236, ALPHA)"
          : "rgba(190, 255, 110, ALPHA)",
      });
    }
    if (!sparkRAF) sparkLoop();
  }

  if (sparkCanvas && sparkCanvas.getContext && !reduceMotion) {
    sparkCtx = sparkCanvas.getContext("2d");
    sizeSparks();
    window.addEventListener("resize", sizeSparks);
    document.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      sparkBurst(e.clientX, e.clientY, 13, 1);
    });

    /* лёгкий звёздный след за курсором в hero */
    let lastTrail = 0;
    document.addEventListener("pointermove", (e) => {
      const now = performance.now();
      if (now - lastTrail < 70) return;
      const heroEl = $(".hero");
      if (!heroEl) return;
      const rect = heroEl.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) return;
      lastTrail = now;
      sparkParts.push({
        x: e.clientX + (Math.random() - 0.5) * 8,
        y: e.clientY + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.2 - Math.random() * 0.5,
        life: 0.55,
        decay: 0.03,
        size: 0.6 + Math.random() * 1.1,
        color: "rgba(214, 255, 155, ALPHA)",
      });
      if (!sparkRAF) sparkLoop();
    }, { passive: true });
  }

  /* искристый след за метлой */
  const broomEl = $(".broom");
  if (broomEl && sparkCtx && !reduceMotion) {
    setInterval(() => {
      if (!heroInView || document.hidden) return;
      const r = broomEl.getBoundingClientRect();
      if (r.right < 0 || r.left > window.innerWidth) return;
      if (r.top > window.innerHeight || r.bottom < 0) return;
      const opacity = parseFloat(getComputedStyle(broomEl).opacity || "0");
      if (opacity < 0.25) return;
      sparkParts.push({
        x: r.left + r.width * 0.16,
        y: r.top + r.height * 0.62,
        vx: -0.3 - Math.random() * 0.6,
        vy: 0.1 + Math.random() * 0.45,
        life: 0.75,
        decay: 0.028,
        size: 0.7 + Math.random() * 1.3,
        color: "rgba(214, 255, 155, ALPHA)",
      });
      if (!sparkRAF) sparkLoop();
    }, 80);
  }

  /* мягкое свечение за курсором */
  const glow = $("#cursorGlow");
  if (glow && finePointer && !reduceMotion) {
    let gx = window.innerWidth / 2;
    let gy = window.innerHeight / 2;
    let tx = gx;
    let ty = gy;
    let active = false;
    let glowRAF = 0;

    function glowLoop() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0)`;
      const settled = Math.abs(tx - gx) + Math.abs(ty - gy) < 0.3;
      glowRAF = active || !settled ? requestAnimationFrame(glowLoop) : 0;
    }

    document.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!active) {
        active = true;
        gx = tx;
        gy = ty;
        glow.classList.add("is-on");
      }
      if (!glowRAF) glowLoop();
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      active = false;
      glow.classList.remove("is-on");
    });

    glowLoop();
  }

  /* ------------------------------------------------------------------
     11. Лёгкий наклон портрета
     ------------------------------------------------------------------ */
  const portrait = $("#portrait");
  if (portrait && finePointer && !reduceMotion) {
    const frame = $(".portrait__frame", portrait);
    let raf = 0;
    let tx = 0;
    let ty = 0;

    portrait.addEventListener("mousemove", (e) => {
      const rect = portrait.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (frame) frame.style.transform = `rotateY(${tx * 4}deg) rotateX(${-ty * 3}deg)`;
          raf = 0;
        });
      }
    });

    portrait.addEventListener("mouseleave", () => {
      if (frame) frame.style.transform = "";
    });
  }

  /* ------------------------------------------------------------------
     12. Магические подсказки: тост, заклинания, секрет на гербе
     ------------------------------------------------------------------ */
  const toast = $("#toast");
  const toastText = $("#toastText");
  let toastTimer = 0;

  function showToast(text, duration = 4600) {
    if (!toast || !toastText) return;
    toastText.textContent = text;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), duration);
  }

  function sparkAt(el, count = 22, power = 1.2) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, count, power);
  }

  /* заклинания на клавиатуре: lumos / nox / alohomora */
  const spellBuffer = [];
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    const tag = (target && target.tagName ? target.tagName : "").toLowerCase();
    if (tag === "input" || tag === "textarea" || (target && target.isContentEditable)) return;
    if (document.querySelector(".letter-modal:not([hidden])")) return;
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    spellBuffer.push(e.key.toLowerCase());
    if (spellBuffer.length > 18) spellBuffer.shift();
    const word = spellBuffer.join("");

    if (word.endsWith("lumos")) {
      applyTheme("light");
      storeTheme("light");
      showToast("Люмос! Свет зажжён.");
      sparkBurst(window.innerWidth / 2, window.innerHeight * 0.35, 26, 1.2);
    } else if (word.endsWith("nox")) {
      applyTheme("dark");
      storeTheme("dark");
      showToast("Нокс! Свет погашен.");
    } else if (word.endsWith("alohomora")) {
      showToast("Дверь открыта. Заходите в гости — мы в Новокузнецке.");
    }
  });

  /* три клика по гербу — маленький секрет */
  const brand = $(".brand");
  let crestClicks = 0;
  let crestTimer = 0;
  if (brand) {
    brand.addEventListener("click", () => {
      crestClicks += 1;
      clearTimeout(crestTimer);
      crestTimer = setTimeout(() => { crestClicks = 0; }, 1700);
      if (crestClicks >= 3) {
        crestClicks = 0;
        sparkAt(brand, 28, 1.3);
        showToast("«Добби — свободный эльф!» А этот Добби ещё и очень ушастый.");
      }
    });
  }

  /* искры при переключении света */
  if (themeToggle) {
    themeToggle.addEventListener("click", () => sparkAt(themeToggle, 12, 0.8));
  }

  /* ------------------------------------------------------------------
     13. Письмо Добби
     ------------------------------------------------------------------ */
  const letterModal = $("#letterModal");
  const letterOpen = $("#letterOpen");
  const letterClose = $("#letterClose");
  const letterOk = $("#letterOk");
  const letterTriggers = $$("[data-open-letter]");
  let letterLastFocus = null;
  let speechTimer = 0;

  /* --- мокрые чернила в тексте свитка: слова проступают пятнами --- */
  const letterInkState = { wrapped: false, timer: 0 };

  function letterInkWrap() {
    const targets = $$(".letter__body p, .letter__ps");
    targets.forEach((p) => {
      const text = p.textContent;
      p.dataset.raw = text;
      p.setAttribute("aria-label", text);
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
        const w = document.createElement("span");
        w.className = "ink-w";
        w.textContent = chunk;
        frag.appendChild(w);
      });
      p.replaceChildren(frag);
    });
    letterInkState.wrapped = true;
  }

  function letterInkUnwrap() {
    $$(".letter__body p, .letter__ps").forEach((p) => {
      if (p.dataset.raw !== undefined) {
        p.textContent = p.dataset.raw;
        delete p.dataset.raw;
        p.removeAttribute("aria-label");
      }
    });
    letterInkState.wrapped = false;
  }

  function letterWetRun() {
    if (reduceMotion) return;
    clearTimeout(letterInkState.timer);
    letterInkUnwrap();
    /* даём развернуться ситку — текст намокает сразу вслед за бумагой */
    setTimeout(() => {
      letterInkWrap();
      const words = $$(".letter .ink-w");
      words.forEach((w, i) => {
        const base = 0.55 + (i % 9) * 0.11 + Math.random() * 0.2;
        w.style.setProperty("--d", base.toFixed(2) + "s");
      });
      void document.body.offsetWidth;
      words.forEach((w) => { w.style.animation = "none"; void w.offsetWidth; w.style.animation = ""; });
      letterInkState.timer = setTimeout(letterInkUnwrap, 4200);
    }, reduceMotion ? 0 : 430);
  }

  function letterWetRestart() {
    /* при открытии свитка заново: чистим spans, задержка и старт — всегда */
    clearTimeout(letterInkState.timer);
    letterInkUnwrap();
    setTimeout(letterWetRun, 20);
  }

  /* Разбиваем реплику на слова, чтобы каждое «проявлялось» своим черёдом */
  const speechText = letterOpen ? letterOpen.querySelector("[data-speech]") : null;
  if (speechText) {
    const words = speechText.textContent.trim().split(/\s+/);
    speechText.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "letter-float__speech-word";
      span.style.setProperty("--i", String(i));
      span.textContent = word;
      speechText.append(span, i < words.length - 1 ? " " : "");
    });
    speechText.setAttribute("aria-label", words.join(" "));
  }

  function speak(hold = 7000) {
    if (!letterOpen) return;
    clearTimeout(speechTimer);
    /* перезапуск перехода слов: снимаем класс в следующем кадре */
    letterOpen.classList.remove("is-speaking");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => letterOpen.classList.add("is-speaking"));
    });
    if (hold) speechTimer = setTimeout(() => letterOpen.classList.remove("is-speaking"), hold);
  }

  /* Добби сам объявляет о письме через пару секунд */
  if (letterOpen && !reduceMotion) {
    setTimeout(() => speak(7000), 2200);

    letterOpen.addEventListener("pointerenter", () => {
      if (letterOpen.classList.contains("is-speaking")) clearTimeout(speechTimer);
      else speak(0);
    });
    letterOpen.addEventListener("pointerleave", () => {
      speechTimer = setTimeout(() => letterOpen.classList.remove("is-speaking"), 1400);
    });
  }

  function openLetter() {
    if (!letterModal || letterModal.hidden === false) return;
    letterLastFocus = document.activeElement;
    letterModal.classList.remove("is-closing");
    letterModal.hidden = false;
    document.body.style.overflow = "hidden";
    if (letterOpen) {
      letterOpen.classList.add("is-read");
      letterOpen.classList.remove("is-speaking");
    }
    /* два кадра — чтобы transition разворачивания сработал, а не «прыгнул» */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        letterModal.classList.add("is-open");
        letterWetRestart();
        if (!reduceMotion) sparkBurst(window.innerWidth / 2, window.innerHeight * 0.42, 20, 1);
      });
    });
    setTimeout(() => {
      if (letterClose && !letterModal.hidden) letterClose.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 620);
    try { localStorage.setItem("db-letter", "1"); } catch (err) { /* ignore */ }
  }

  function closeLetter() {
    if (!letterModal || letterModal.hidden) return;
    const finish = () => {
      letterModal.hidden = true;
      letterModal.classList.remove("is-open", "is-closing");
      document.body.style.overflow = "";
      if (letterLastFocus && letterLastFocus.focus) {
        letterLastFocus.focus({ preventScroll: true });
      }
    };
    if (reduceMotion) { finish(); return; }
    letterModal.classList.remove("is-open");
    letterModal.classList.add("is-closing");
    setTimeout(finish, 760);
  }

  if (letterOpen) letterOpen.addEventListener("click", openLetter);
  letterTriggers.forEach((el) => el.addEventListener("click", openLetter));
  if (letterClose) letterClose.addEventListener("click", closeLetter);
  if (letterOk) letterOk.addEventListener("click", closeLetter);
  $$("[data-letter-close]").forEach((el) => el.addEventListener("click", closeLetter));

  if (letterModal) {
    document.addEventListener("keydown", (e) => {
      if (letterModal.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeLetter();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(letterModal.querySelectorAll("a[href], button"))
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  try {
    if (localStorage.getItem("db-letter") === "1") letterOpen?.classList.add("is-read");
  } catch (err) { /* ignore */ }

  /* ------------------------------------------------------------------
     14. Промо-карточки: наклон за курсором
     ------------------------------------------------------------------ */
  if (finePointer && !reduceMotion) {
    $$("[data-tilt]").forEach((card) => {
      let raf = 0;
      let px = 0.5;
      let py = 0.4;

      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        px = (e.clientX - rect.left) / rect.width;
        py = (e.clientY - rect.top) / rect.height;
        card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        if (raf) return;
        raf = requestAnimationFrame(() => {
          card.style.transform =
            `perspective(900px) rotateY(${((px - 0.5) * 7).toFixed(2)}deg) ` +
            `rotateX(${((0.5 - py) * 7).toFixed(2)}deg) translateY(-4px)`;
          raf = 0;
        });
      });

      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ------------------------------------------------------------------
     15. Музыка (main.mp3)
     ------------------------------------------------------------------ */
  const soundToggle = $("#soundToggle");
  const siteMusic = $("#siteMusic");
  if (soundToggle && siteMusic) {
    let musicOn = false;
    let fadeRAF = 0;
    const targetVolume = 0.45;

    function setSoundUI(on) {
      soundToggle.classList.toggle("is-playing", on);
      soundToggle.setAttribute("aria-pressed", String(on));
      soundToggle.setAttribute("aria-label", on ? "Выключить музыку" : "Включить музыку");
    }

    function fadeTo(target, done) {
      cancelAnimationFrame(fadeRAF);
      const from = siteMusic.volume;
      const start = performance.now();
      const duration = 900;
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        siteMusic.volume = Math.max(0, Math.min(1, from + (target - from) * p));
        if (p < 1) {
          fadeRAF = requestAnimationFrame(step);
        } else if (done) {
          done();
        }
      };
      fadeRAF = requestAnimationFrame(step);
    }

    async function startMusic() {
      try {
        siteMusic.volume = 0;
        await siteMusic.play();
        musicOn = true;
        setSoundUI(true);
        fadeTo(targetVolume);
        try { localStorage.setItem("db-music", "1"); } catch (err) { /* ignore */ }
      } catch (err) {
        showToast("Не получилось включить музыку. Проверьте, что main.mp3 лежит рядом с index.html.");
      }
    }

    function stopMusic() {
      if (!musicOn) return;
      musicOn = false;
      setSoundUI(false);
      fadeTo(0, () => siteMusic.pause());
      try { localStorage.setItem("db-music", "0"); } catch (err) { /* ignore */ }
    }

    soundToggle.addEventListener("click", () => {
      if (musicOn) stopMusic();
      else startMusic();
    });

    siteMusic.addEventListener("error", () => {
      soundToggle.disabled = true;
      soundToggle.setAttribute("aria-label", "Музыка недоступна: не найден main.mp3");
      soundToggle.title = "Положите main.mp3 рядом с index.html";
    });

    document.addEventListener("visibilitychange", () => {
      if (!musicOn) return;
      if (document.hidden) siteMusic.pause();
      else siteMusic.play().catch(() => { /* ignore */ });
    });
  }

  /* ------------------------------------------------------------------
     16. Год
     ------------------------------------------------------------------ */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
