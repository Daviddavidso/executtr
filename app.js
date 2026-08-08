/* EXECUTTR — витрина офферов.
   Ванильный JS, без сборки. Данные приходят из data.js (его пишет админка). */
(function () {
  "use strict";

  var DATA = window.SITE_DATA || { site: {}, categories: [], offers: [], faq: [] };

  /* Предпросмотр из админки: ?draft — читаем черновик, а не опубликованный
     каталог. Админка и витрина на одном домене, так что это тот же localStorage. */
  if (/[?&]draft/.test(location.search)) {
    try {
      var draft = JSON.parse(localStorage.getItem("executtr:draft") || "null");
      if (draft && Array.isArray(draft.offers)) DATA = draft;
    } catch (e) { /* черновика нет или он битый — показываем опубликованное */ }
  }

  var SITE = DATA.site || {};
  var CATS = Array.isArray(DATA.categories) ? DATA.categories : [];
  var OFFERS = Array.isArray(DATA.offers) ? DATA.offers : [];

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var live = $("#live");
  function say(msg) {
    if (!live) return;
    live.textContent = "";
    setTimeout(function () { live.textContent = msg; }, 60);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Правильное окончание: 1 оффер, 2 оффера, 5 офферов. */
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  /* ---------- Тексты сайта из data.js ---------- */

  function applySite() {
    var name = (SITE.name || "").trim();
    if (name) {
      $$("[data-brand]").forEach(function (n) { n.textContent = name; });
      document.title = name + " — " + (SITE.tagline || "витрина офферов");
    }
    if (SITE.tagline) $$("[data-tagline]").forEach(function (n) { n.textContent = SITE.tagline; });
    if (SITE.lead) { var l = $("[data-lead]"); if (l) l.textContent = SITE.lead; }

    var tg = (SITE.telegram || "").trim();
    ["#hero-tg", "#footer-tg"].forEach(function (sel) {
      var a = $(sel);
      if (!a) return;
      if (tg) a.href = tg;
      else a.hidden = true;
    });

    var raw = String(DATA.updated || "");
    var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var human = m[3] + "." + m[2] + "." + m[1];
      var t = $("#updated-at");
      if (t) { t.textContent = human; t.setAttribute("datetime", m[0]); }
      var f = $("#updated-foot");
      if (f) f.textContent = human;
    }
  }

  /* ---------- Показатели в хиро ---------- */

  function applyStats() {
    var active = OFFERS.filter(function (o) { return o.active !== false; });

    var geo = {};
    active.forEach(function (o) {
      String(o.geo || "").split(/[,/]/).forEach(function (g) {
        g = g.trim();
        if (g) geo[g.toUpperCase()] = 1;
      });
    });

    var cats = {};
    active.forEach(function (o) { if (o.cat) cats[o.cat] = 1; });

    var set = function (id, v) { var n = $(id); if (n) n.textContent = v; };
    set("#stat-active", String(active.length));
    set("#stat-geo", String(Object.keys(geo).length));
    set("#stat-cats", String(Object.keys(cats).length));
  }

  /* ---------- Бегущая строка ---------- */

  function buildTicker() {
    var track = $("#ticker-track");
    if (!track) return;

    var words = [];
    CATS.forEach(function (c) { if (c.id !== "all" && c.label) words.push(c.label); });
    OFFERS.filter(function (o) { return o.active !== false; }).forEach(function (o) {
      String(o.geo || "").split(/[,/]/).forEach(function (g) {
        g = g.trim().toUpperCase();
        if (g && words.indexOf(g) < 0) words.push(g);
      });
    });
    if (!words.length) words = ["Офферы", "ГЕО", "Выплаты"];

    // Лента крутится на -50%, поэтому содержимое дублируется ровно дважды.
    var half = document.createDocumentFragment();
    words.forEach(function (w) { half.appendChild(el("span", "ticker__item", w)); });
    track.appendChild(half.cloneNode(true));
    track.appendChild(half);
  }

  /* ---------- Витрина ---------- */

  var state = { cat: "all", q: "" };

  var cardsBox = $("#cards");
  var countBox = $("#result-count");
  var emptyBox = $("#empty");
  var filtersBox = $("#filters");

  function catLabel(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].label;
    return "";
  }

  function matches(o) {
    if (state.cat !== "all" && o.cat !== state.cat) return false;
    if (!state.q) return true;
    var hay = [o.title, o.geo, o.sources, o.model, o.note, o.badge, catLabel(o.cat)]
      .join(" ").toLowerCase();
    return hay.indexOf(state.q) >= 0;
  }

  function buildFilters() {
    if (!filtersBox) return;
    filtersBox.textContent = "";

    CATS.forEach(function (c) {
      var n = c.id === "all"
        ? OFFERS.length
        : OFFERS.filter(function (o) { return o.cat === c.id; }).length;
      if (c.id !== "all" && n === 0) return; // пустые вертикали не показываем

      var b = el("button", "chip");
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.cat === c.id));
      b.dataset.cat = c.id;
      b.appendChild(document.createTextNode(c.label));

      var badge = el("span", "chip__n mono", String(n));
      badge.setAttribute("aria-hidden", "true");
      b.appendChild(badge);
      // Для скринридера счётчик проговариваем словами, а не «Gambling 4».
      b.appendChild(el("span", "vh", ", " + n + " " + plural(n, "оффер", "оффера", "офферов")));

      b.addEventListener("click", function () {
        state.cat = c.id;
        syncFilters();
        render(true);
      });
      filtersBox.appendChild(b);
    });
  }

  function syncFilters() {
    $$(".chip", filtersBox).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat));
    });
  }

  function spec(dl, label, value, accent) {
    if (!value) return;
    var d = el("div");
    d.appendChild(el("dt", null, label));
    var dd = el("dd", accent ? "is-accent" : null, value);
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function lockIcon() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 20 20");
    s.setAttribute("width", "16"); s.setAttribute("height", "16");
    s.setAttribute("focusable", "false"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M6 9V6.5a4 4 0 0 1 8 0V9M4.5 9h11v8h-11z");
    p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.7"); p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }

  function buildCard(o) {
    var paused = o.active === false;

    var uid = "of-" + (o.id || Math.random().toString(36).slice(2));

    var li = el("li");
    var card = el("article", "card" + (paused ? " card--paused" : ""));
    card.setAttribute("aria-labelledby", uid + "-t");
    li.appendChild(card);

    /* Верх: вертикаль, метка, статус */
    var top = el("div", "card__top");
    var cl = catLabel(o.cat);
    if (cl) {
      var ct = el("span", "tag tag--cat");
      ct.appendChild(el("span", "vh", "Вертикаль: "));
      ct.appendChild(document.createTextNode(cl));
      top.appendChild(ct);
    }
    if (o.badge && !paused) top.appendChild(el("span", "tag tag--badge", o.badge));
    if (paused) {
      var pt = el("span", "tag tag--pause");
      pt.id = uid + "-state";
      pt.appendChild(el("span", "vh", "Статус: "));
      pt.appendChild(document.createTextNode("На паузе"));
      pt.appendChild(el("span", "vh", " — ссылку сейчас забрать нельзя"));
      top.appendChild(pt);
      card.setAttribute("aria-describedby", uid + "-state");
    }
    card.appendChild(top);

    /* Заголовок */
    var h = el("h3", "card__title", o.title || "Без названия");
    h.id = uid + "-t";
    card.appendChild(h);

    /* Показатели */
    var dl = el("dl", "card__specs");
    spec(dl, "ГЕО", o.geo);
    spec(dl, "Ставка", o.payout, !paused);
    spec(dl, "Модель", o.model);
    spec(dl, "Холд", o.hold);
    if (dl.children.length) card.appendChild(dl);

    if (o.note) card.appendChild(el("p", "card__note", o.note));

    if (o.sources) {
      var src = el("div", "card__sources");
      src.appendChild(el("b", null, "Источники"));
      src.appendChild(el("span", null, o.sources));
      card.appendChild(src);
    }

    /* Действия */
    if (paused) {
      var lock = el("div", "card__locked");
      lock.appendChild(lockIcon());
      lock.appendChild(el("span", null, "Оффер на паузе — ссылка недоступна"));
      card.appendChild(lock);
    } else {
      var act = el("div", "card__actions");

      var copy = el("button", "btn btn--ink", "Забрать ссылку");
      copy.type = "button";
      copy.appendChild(el("span", "vh", " на оффер " + (o.title || "")));
      copy.addEventListener("click", function () { copyLink(o, copy); });
      act.appendChild(copy);

      if (o.url) {
        var go = el("a", "btn btn--line", "Перейти");
        go.href = o.url;
        go.target = "_blank";
        go.rel = "noopener nofollow";
        go.appendChild(el("span", "vh", " на оффер " + (o.title || "") + " (откроется в новой вкладке)"));
        act.appendChild(go);
      }
      card.appendChild(act);
    }

    return li;
  }

  function render(announce) {
    if (!cardsBox) return;
    var list = OFFERS.filter(matches);

    cardsBox.textContent = "";
    var frag = document.createDocumentFragment();
    list.forEach(function (o) { frag.appendChild(buildCard(o)); });
    cardsBox.appendChild(frag);

    var paused = list.filter(function (o) { return o.active === false; }).length;
    var txt = list.length + " " + plural(list.length, "оффер", "оффера", "офферов");
    if (paused) txt += " · " + paused + " на паузе";
    if (countBox) countBox.textContent = list.length ? txt : "Ничего не найдено";

    if (emptyBox) emptyBox.hidden = list.length > 0;
    if (cardsBox) cardsBox.hidden = list.length === 0;

    if (announce) say(list.length ? txt : "Ничего не найдено");
  }

  /* ---------- Копирование ссылки ---------- */

  var toast = $("#toast");
  var toastText = $("#toast-text");
  var toastTimer = null;

  /* Тост только показывает — озвучивает соседний #live. Поэтому его не
     прячут через hidden: скрытый элемент выпадает из дерева доступности,
     а прятать тут нечего, он и так aria-hidden. */
  function showToast(msg) {
    if (!toast) return;
    if (toastText) toastText.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-on"); }, 6000);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* Подпись кнопки при копировании не меняем: это её доступное имя,
     и голосовое управление перестало бы её находить. Успех показывает
     галочка на самой кнопке и тост. */
  function afterCopy(ok, o, btn) {
    if (ok) {
      btn.classList.add("is-done");
      setTimeout(function () { btn.classList.remove("is-done"); }, 2200);
      showToast("Ссылка на «" + o.title + "» скопирована");
      say("Ссылка на оффер " + o.title + " скопирована в буфер обмена");
    } else {
      showManualCopy(o, btn);
    }
  }

  /* Буфер обмена может быть закрыт (http без localhost, отказ в доступе).
     Тогда не мигаем сообщением, а показываем поле с готовой к копированию
     ссылкой и переводим в него фокус — само перемещение и есть сообщение. */
  function showManualCopy(o, btn) {
    var card = btn.closest(".card");
    if (!card) { window.open(o.url, "_blank", "noopener"); return; }

    var old = card.querySelector(".manual-copy");
    if (old) old.remove();

    var box = el("div", "manual-copy");
    var lab = el("label", null, "Скопируй ссылку вручную");
    var id = "mc-" + (o.id || Math.random().toString(36).slice(2));
    lab.setAttribute("for", id);

    var inp = document.createElement("input");
    inp.type = "text"; inp.id = id; inp.readOnly = true; inp.value = o.url;
    inp.setAttribute("spellcheck", "false");

    var close = el("button", "linkish", "Скрыть");
    close.type = "button";
    close.addEventListener("click", function () { box.remove(); btn.focus(); });

    box.appendChild(lab); box.appendChild(inp); box.appendChild(close);
    card.appendChild(box);

    inp.focus();
    inp.select();
  }

  function copyLink(o, btn) {
    if (!o.url) { showToast("У оффера пока нет ссылки"); say("У оффера пока нет ссылки"); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(o.url)
        .then(function () { afterCopy(true, o, btn); })
        .catch(function () { afterCopy(fallbackCopy(o.url), o, btn); });
    } else {
      afterCopy(fallbackCopy(o.url), o, btn);
    }
  }

  /* ---------- Поиск ---------- */

  var qInput = $("#q");
  if (qInput) {
    var qTimer = null;
    qInput.addEventListener("input", function () {
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        state.q = qInput.value.trim().toLowerCase();
        render(true);
      }, 220);
    });
    // Enter в поиске не должен ничего сабмитить и прыгать
    qInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); clearTimeout(qTimer); state.q = qInput.value.trim().toLowerCase(); render(true); }
    });
  }

  var resetBtn = $("#reset-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state.cat = "all"; state.q = "";
      if (qInput) qInput.value = "";
      syncFilters();
      render(true);
      var first = $(".chip", filtersBox);
      if (first) first.focus();
    });
  }

  /* ---------- FAQ ---------- */

  function buildFaq() {
    var box = $("#faq-list");
    if (!box) return;
    var items = Array.isArray(DATA.faq) ? DATA.faq : [];
    if (!items.length) {
      var sec = document.getElementById("faq");
      if (sec) sec.hidden = true;
      return;
    }
    items.forEach(function (it) {
      var d = el("details", "faq__item");
      var s = el("summary");
      // Заголовок внутри summary — чтобы вопросы попадали в навигацию
      // по заголовкам, а не только в список кнопок.
      s.appendChild(el("h3", "faq__q", it.q));
      var sign = el("span", "faq__sign");
      sign.setAttribute("aria-hidden", "true");
      s.appendChild(sign);
      d.appendChild(s);
      d.appendChild(el("p", "faq__answer", it.a));
      box.appendChild(d);
    });
  }

  /* ---------- Мобильное меню ---------- */

  var burger = $("#burger");
  var nav = $("#site-nav");

  function isMobileNav() { return window.matchMedia("(max-width: 1023.98px)").matches; }

  function closeNav(focusBurger) {
    if (!nav || !burger) return;
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    if (focusBurger) burger.focus();
  }

  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      if (open) { closeNav(false); return; }
      nav.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      var first = nav.querySelector("a");
      if (first) first.focus();
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && isMobileNav()) closeNav(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") closeNav(true);
    });

    document.addEventListener("click", function (e) {
      if (burger.getAttribute("aria-expanded") !== "true") return;
      if (nav.contains(e.target) || burger.contains(e.target)) return;
      closeNav(false);
    });

    // Меню открыто и экран стал широким — приводим состояние в порядок,
    // иначе на десктопе останется класс, который там ничего не значит.
    window.addEventListener("resize", function () {
      if (!isMobileNav()) closeNav(false);
    });
  }

  /* ---------- Тень у липкой шапки ---------- */

  var mast = $("#masthead");
  if (mast) {
    var onScrollHeader = function () {
      mast.classList.toggle("is-stuck", window.scrollY > 6);
    };
    onScrollHeader();
    window.addEventListener("scroll", onScrollHeader, { passive: true });
  }

  /* ---------- Параллакс ----------
     Клиент просил параллакс — он есть на скролле и на движении мыши.
     Тем, кто в системе просил меньше анимации, слои остаются на месте. */

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var parallaxBound = false;

  function motionAllowed() {
    return !reduce.matches && document.documentElement.dataset.motion !== "off";
  }

  function initParallax() {
    if (!motionAllowed()) return;
    var layers = $$("[data-par]");
    if (!layers.length) return;
    if (parallaxBound) { return; }
    parallaxBound = true;

    var mx = 0, my = 0, ticking = false;

    var clamp = function (v, lim) { return v > lim ? lim : (v < -lim ? -lim : v); };

    function paint() {
      ticking = false;
      if (!motionAllowed()) return;
      var vh = window.innerHeight || 1;

      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        var k = parseFloat(L.dataset.par) || 0;
        var box = L.getBoundingClientRect();
        // Считаем только то, что рядом с экраном.
        if (box.bottom < -300 || box.top > vh + 300) continue;

        // Смещение от положения слоя в окне, а не от абсолютной прокрутки:
        // так оно не растёт бесконечно к низу страницы.
        var progress = (vh / 2 - (box.top + box.height / 2)) / vh;
        var amp = Math.min(26, Math.abs(k) * 130);  // фон — максимум 26px
        var dy = clamp(progress * k * 130, amp);
        var dx = clamp(mx * k * 30, 6);             // мышь — максимум 6px
        dy = clamp(dy + my * k * 18, amp + 6);

        L.style.transform = "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px,0)";
      }
    }

    function request() {
      if (ticking) return;
      ticking = true;
      if (typeof requestAnimationFrame === "function" && document.visibilityState !== "hidden") {
        requestAnimationFrame(paint);
      } else {
        // В скрытых вкладках и панелях предпросмотра rAF не срабатывает.
        setTimeout(paint, 16);
      }
    }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener("pointermove", function (e) {
        mx = (e.clientX / window.innerWidth) - 0.5;
        my = (e.clientY / window.innerHeight) - 0.5;
        request();
      }, { passive: true });
    }

    request();
  }

  // Если человек поменял системную настройку на лету — снимаем сдвиги.
  if (reduce.addEventListener) {
    reduce.addEventListener("change", function () {
      if (reduce.matches) $$("[data-par]").forEach(function (L) { L.style.transform = ""; });
      else initParallax();
    });
  }

  /* ---------- Форма заявки ---------- */

  var form = $("#lead-form");

  function fieldError(input, msg) {
    var box = document.getElementById(input.id + "-err");
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      if (box) { box.textContent = msg; box.hidden = false; }
    } else {
      input.removeAttribute("aria-invalid");
      if (box) { box.textContent = ""; box.hidden = true; }
    }
  }

  function validate() {
    var errs = [];
    var name = $("#f-name"), contact = $("#f-contact");

    fieldError(name, null); fieldError(contact, null);

    if (!name.value.trim()) {
      fieldError(name, "Напиши, как к тебе обращаться");
      errs.push({ id: name.id, msg: "Поле «Как тебя зовут» не заполнено" });
    }

    var c = contact.value.trim();
    if (!c) {
      fieldError(contact, "Без контакта не сможем ответить");
      errs.push({ id: contact.id, msg: "Поле «Telegram или почта» не заполнено" });
    } else if (c.length < 3 || (c.indexOf("@") < 0 && !/^https?:\/\/|^t\.me\//i.test(c))) {
      fieldError(contact, "Похоже на опечатку. Ник пиши с собакой: @nickname");
      errs.push({ id: contact.id, msg: "Контакт указан не полностью" });
    }
    return errs;
  }

  function showErrorSummary(errs) {
    var box = $("#lead-errors"), list = $("#lead-error-list");
    if (!box || !list) return;
    if (!errs.length) { box.hidden = true; list.textContent = ""; return; }

    list.textContent = "";
    errs.forEach(function (e) {
      var li = el("li");
      var a = el("a", null, e.msg);
      a.href = "#" + e.id;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var t = document.getElementById(e.id);
        if (t) t.focus();
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    box.hidden = false;
    box.focus();
  }

  /* Сообщение о результате отправки.
     Блок всегда в DOM (hidden выкинул бы его из дерева доступности, и
     сообщение бы не прочиталось), а пустой прячется через :empty в CSS.
     Чистим и пишем в разных тиках: иначе повторная отправка с тем же
     текстом ничего не меняет в DOM и скринридер молчит. */
  var statusTimer = null;
  function setStatus(msg, tone, extra) {
    var s = $("#lead-status");
    if (!s) return;
    clearTimeout(statusTimer);
    s.textContent = "";
    s.dataset.tone = tone || "";
    if (!msg) return;
    statusTimer = setTimeout(function () {
      // Собираем целиком и вставляем разом — aria-atomic прочитает одной фразой.
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(msg));
      if (extra) { frag.appendChild(document.createTextNode(" ")); frag.appendChild(extra); }
      s.appendChild(frag);
    }, 100);
  }

  /* Ссылка на Telegram прямо внутри сообщения: отсылать человека «в шапку»
     бессмысленно, туда ещё надо доехать. Блок стоит сразу за кнопкой,
     поэтому следующий Tab попадает именно на неё. */
  function tgLink() {
    var tg = (SITE.telegram || "").trim();
    if (!tg) return null;
    var a = document.createElement("a");
    a.href = tg;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Написать в Telegram";
    a.appendChild(el("span", "vh", " (откроется в новой вкладке)"));
    return a;
  }

  // Определяется один раз: если бэкенда нет, второй запрос его не найдёт.
  var demoMode = false;

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", "");

      var errs = validate();
      if (errs.length) {
        // Ничего не озвучиваем отдельно: фокус уезжает в сводку ошибок,
        // и она читается сама. Два сообщения подряд перебивают друг друга.
        showErrorSummary(errs);
        return;
      }
      showErrorSummary([]);

      var btn = $("#lead-submit");
      if (btn.dataset.pending === "1") return; // защита от двойного нажатия
      // aria-disabled, а не disabled: отключённая кнопка вылетает из
      // порядка табуляции и утаскивает фокус в никуда.
      btn.dataset.pending = "1";
      btn.setAttribute("aria-disabled", "true");
      var label = btn.textContent;
      btn.textContent = "Отправляем…";
      // Сообщаем до запроса: сервер по таймауту может думать до 8 секунд.
      setStatus("Отправляем заявку…", "");

      var payload = {
        action: "lead",
        name: $("#f-name").value.trim(),
        contact: $("#f-contact").value.trim(),
        source: $("#f-source").value.trim(),
        comment: $("#f-comment").value.trim(),
        company: $("#f-company").value.trim()
      };

      /* Сюда витрину нередко выкладывают на статику (демо, GitHub Pages),
         где api.php просто нет. Отличаем это от обрыва связи: без бэкенда
         ответ приходит, но он не JSON; при обрыве fetch падает целиком.
         Путать нельзя — иначе человеку на боевом домене скажут «это демо». */
      if (demoMode) { showDemo(); finish(); return; }

      function finish() {
        delete btn.dataset.pending;
        btn.removeAttribute("aria-disabled");
        btn.textContent = label;
      }

      function showDemo() {
        demoMode = true;
        setStatus(
          "Это демо-версия сайта — отсюда заявка не уходит. На рабочем домене форма подключена, а пока —",
          "info", tgLink()
        );
      }

      fetch("api.php?action=lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(
          function (r) {
            return r.text().then(function (body) {
              var res = null;
              try { res = JSON.parse(body); } catch (e) { res = null; }
              if (!res) { showDemo(); return; }       // ответ есть, но это не наш бэкенд
              if (res.ok) {
                form.reset();
                setStatus("Заявка ушла. Ответим в течение дня — следи за Telegram.", "ok");
                return;
              }
              setStatus("Заявка не прошла: " + (res.error || "сервер отказал") +
                ". Поправь и отправь ещё раз.", "bad");
            });
          },
          function () {
            setStatus("Не получилось отправить — похоже, пропала связь. " +
              "Всё, что ты ввёл, осталось в полях: нажми «Отправить» ещё раз.", "bad", tgLink());
          }
        )
        .then(finish, finish);
    });

    // Ошибку снимаем, как только человек начал править поле.
    ["#f-name", "#f-contact"].forEach(function (sel) {
      var i = $(sel);
      if (i) i.addEventListener("input", function () {
        if (i.getAttribute("aria-invalid") === "true") fieldError(i, null);
      });
    });
  }

  /* ---------- Якоря переносят фокус, а не только прокрутку ----------
     Иначе после клика по пункту меню фокус остаётся в шапке, и следующий
     Tab уводит на соседнюю ссылку вместо содержимого раздела. */

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute("href");
    if (!hash || hash === "#") return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;

    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    if (history.pushState) history.pushState(null, "", hash);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: reduce.matches ? "auto" : "smooth" });
  });

  /* Страховка от липкой шапки: если сфокусированный элемент оказался под
     ней (обратный Tab, программный фокус) — доводим прокрутку. */
  document.addEventListener("focusin", function (e) {
    if (!mast) return;
    var t = e.target;
    if (!t || t === document.body || t.closest(".masthead")) return;
    var r = t.getBoundingClientRect();
    var h = mast.getBoundingClientRect().bottom + 12;
    if (r.top < h) window.scrollBy({ top: r.top - h, behavior: "auto" });
  });

  /* ---------- Переключатель движения фона ---------- */

  var motionBtn = $("#motion-toggle");
  if (motionBtn) {
    var motionOn = document.documentElement.dataset.motion !== "off";
    motionBtn.setAttribute("aria-pressed", String(motionOn));

    motionBtn.addEventListener("click", function () {
      motionOn = !motionOn;
      motionBtn.setAttribute("aria-pressed", String(motionOn));
      if (motionOn) {
        delete document.documentElement.dataset.motion;
        initParallax();
        window.dispatchEvent(new Event("scroll"));
        say("Фон в движении включён");
      } else {
        document.documentElement.dataset.motion = "off";
        $$("[data-par]").forEach(function (L) { L.style.transform = ""; });
        say("Фон в движении выключен");
      }
      try { localStorage.setItem("executtr:motion", motionOn ? "on" : "off"); } catch (err) { /* приватный режим */ }
    });
  }

  /* ---------- Старт ---------- */

  applySite();
  applyStats();
  buildTicker();
  buildFilters();
  buildFaq();
  render(false);
  initParallax();
})();
