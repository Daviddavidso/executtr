/* CASHMACHINE — панель управления витриной.
   Черновик лежит в localStorage, на сайт уезжает через api.php. */
(function () {
  "use strict";

  var DRAFT_KEY = "executtr:draft";
  var TOKEN_KEY = "executtr:token";

  var FILE = window.SITE_DATA || { site: {}, categories: [], offers: [], faq: [] };

  /* Что лежит в папке logos — двумя группами: банки и МФО. Список руками:
     браузер не умеет читать папку на обычном хостинге. Положил новый файл
     на сервер — допиши строку в нужную группу.
     Если файла на сервере нет, а логотип нужен, в форме есть «Загрузить свою
     картинку»: она попадает в библиотеку «Мои картинки» внутри data.js,
     сервер для неё не нужен, и выбрать её можно любому офферу.
     Ещё вариант — пункт «По ссылке из интернета…»: в поле logo кладётся
     прямой http(s)-адрес картинки, витрина показывает его как есть. */
  var URL_VALUE = "__url__";
  var LOGO_BANKS = [
    ["sber.svg", "Сбербанк"],
    ["tbank.svg", "Т-Банк"],
    ["alfa.svg", "Альфа-Банк"],
    ["vtb.svg", "ВТБ"],
    ["gpb.png", "Газпромбанк"],
    ["sovcom.svg", "Совкомбанк"],
    ["halva.png", "Халва"],
    ["raiffeisen.png", "Райффайзен Банк"],
    ["psbank.png", "ПСБ"],
    ["uralsib.png", "Уралсиб"],
    ["otpbank.png", "ОТП Банк"],
    ["pochtabank.png", "Почта Банк"],
    ["mtsbank.png", "МТС Банк"],
    ["ubrr.png", "УБРиР"],
    ["akbars.png", "Ак Барс Банк"],
    ["lockobank.png", "Локо-Банк"],
    ["ozon.svg", "Ozon Банк"],
    ["rencredit.png", "Ренессанс Банк"],
    ["tochka.png", "Точка"],
    ["modulbank.png", "Модульбанк"],
    ["bspb.png", "Банк Санкт-Петербург"],
    ["nskbl.png", "Банк Левобережный"],
    ["rshb.png", "Россельхозбанк"],
    ["zenit.png", "Банк Зенит"],
    ["yandex.svg", "Яндекс Банк"]
  ];
  var LOGO_MFO = [
    ["zaymer.png", "Займер"],
    ["moneyman.png", "MoneyMan"],
    ["ekapusta.png", "еКапуста"],
    ["limezaim.png", "Лайм-Займ"],
    ["webzaim.png", "Веб-займ"],
    ["bistrodengi.png", "Быстроденьги"],
    ["dozarplati.png", "До Зарплаты"],
    ["migcredit.png", "МигКредит"],
    ["turbozaim.png", "Турбозайм"],
    ["carmoney.png", "CarMoney"],
    ["webbankir.png", "Веббанкир"],
    ["platiza.png", "Платиза"]
  ];

  function isHttpUrl(v) { return /^https?:\/\/\S+$/i.test(String(v || "")); }

  var LOGO_MAX = 4 * 1024 * 1024;   /* растр всё равно ужмётся до 512 px,
                                       а SVG крупнее раздул бы data.js */

  /* Библиотека загруженных картинок живёт в DATA.library и уезжает в data.js
     вместе с каталогом: любую можно выбрать любому офферу и скачать обратно —
     хранить исходник у себя не обязательно. */
  function lib() { return DATA.library || (DATA.library = []); }
  function libFind(name) {
    var l = DATA.library || [];
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].name === name) return l[i];
    return null;
  }

  /* Своя картинка — ссылка lib: на библиотеку (раньше — data:-строка прямо
     в оффере, такие тоже понимаем), файл из папки — по имени. */
  function logoSrc(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (v.indexOf("lib:") === 0) {
      var it = libFind(v.slice(4));
      return it ? it.data : "";
    }
    return /^(data:|https?:|\.?\/)/.test(v) ? v : "logos/" + v;
  }

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function el(t, c, txt) { var n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  var live = $("#live"), liveAlert = $("#live-alert");
  /* 60 мс хватало Chrome и Firefox, но VoiceOver успевает проглотить фразу. */
  function say(m)   { if (live) { live.textContent = ""; setTimeout(function () { live.textContent = m; }, 150); } }
  function shout(m) { if (liveAlert) { liveAlert.textContent = ""; setTimeout(function () { liveAlert.textContent = m; }, 150); } }

  /* ---------- Черновик ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.offers)) {
          if (!Array.isArray(p.categories) || !p.categories.length) p.categories = clone(FILE.categories);
          if (!p.site) p.site = clone(FILE.site || {});
          if (!Array.isArray(p.faq)) p.faq = clone(FILE.faq || []);
          // Черновик мог родиться до библиотеки картинок — доливаем её из файла.
          if (!Array.isArray(p.library) && Array.isArray(FILE.library)) p.library = clone(FILE.library);
          return p;
        }
      }
    } catch (e) { /* битый черновик — берём файл */ }
    return clone(FILE);
  }

  var DATA = load();
  var dirty = false;

  function persist(announceText) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(DATA));
    } catch (e) {
      shout("Черновик не сохранился: в браузере кончилось место. Выгрузи JSON, пока правки не потерялись.");
      return;
    }
    setDirty(true);
    refreshPreview();
    if (announceText) say(announceText);
  }

  function setDirty(v) {
    dirty = v;
    var d = $("#dirty");
    if (d) d.hidden = !v;
  }

  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* Расширение для имени скачиваемого файла берём из самой data:-строки,
     а не пишем руками: png и jpg путать нельзя. */
  function extFromDataUrl(u) {
    var m = /^data:image\/(svg\+xml|jpeg|png)/.exec(String(u || ""));
    if (!m) return "png";
    return m[1] === "svg+xml" ? "svg" : m[1] === "jpeg" ? "jpg" : "png";
  }

  /* Старые загрузки лежали data:-строкой прямо в оффере — переносим их в
     библиотеку, чтобы картинкой можно было пользоваться и в других офферах.
     Каталог от этого меняется, поэтому черновик честно помечается
     несохранённым. Зовётся при каждой замене DATA: загрузка, импорт, сброс. */
  function migrateLogos() {
    var moved = 0;
    (DATA.offers || []).forEach(function (o) {
      if (!o || !o.logo || String(o.logo).indexOf("data:") !== 0) return;
      var base = String(o.bank || o.title || "").trim().slice(0, 40) || "картинка";
      var name = base, n = 2;
      while (libFind(name)) name = base + "-" + (n++);
      lib().push({ name: name, ext: extFromDataUrl(o.logo), data: o.logo });
      o.logo = "lib:" + name;
      moved++;
    });
    if (moved) persist();
  }

  migrateLogos();

  /* ---------- Сервер ---------- */

  var token = "";
  try { token = sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { token = ""; }
  var online = false;

  function api(action, payload) {
    return fetch("api.php?action=" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token },
      body: JSON.stringify(payload || {})
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "Сервер ответил не по делу" }; }); });
  }

  function setConn(state, text) {
    var c = $("#conn");
    if (!c) return;
    c.dataset.state = state;
    c.textContent = text;
  }

  function ping() {
    return fetch("api.php?action=ping", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        online = !!(j && j.ok);
        if (online && j.writable === false) {
          setConn("off", "сервер на связи, но data.js защищён от записи");
        } else {
          setConn("on", "сервер на связи");
        }
        return j;
      })
      .catch(function () {
        online = false;
        setConn("off", "офлайн — публикация недоступна");
        return null;
      });
  }

  /* ---------- Вход ---------- */

  var gate = $("#gate"), gateForm = $("#gate-form"), gateErr = $("#gate-err");

  function openApp() {
    gate.hidden = true;
    $("#masthead").hidden = false;
    $("#main").hidden = false;
    renderAll();
    ping();
    loadFullCatalog();
    refreshPreview();
  }

  /* В data.js, который лежит на сайте, выплат нет — их оттуда специально
     вырезают при публикации. Полный каталог отдаёт сервер по паролю, его и
     берём за основу. Черновик при этом главнее: в нём несохранённые правки. */
  function loadFullCatalog() {
    api("catalog").then(function (res) {
      if (!res || !res.ok || !res.data || !Array.isArray(res.data.offers)) return;
      FILE = res.data;
      if (dirty) return;   // человек уже что-то правил — не затираем
      var draft = null;
      try { draft = localStorage.getItem(DRAFT_KEY); } catch (e) { /* нет доступа */ }
      if (draft) return;
      DATA = clone(FILE);
      migrateLogos();
      renderAll();
    }).catch(function () { /* офлайн — работаем с тем, что в data.js */ });
  }

  /* Экран входа перекрывает редактор картинкой, но сам по себе его не
     выключает: без этого Tab уходит в редактор под оверлеем, а на странице
     оказываются сразу два H1. Поэтому редактор именно скрываем. */
  function lockApp() {
    $("#masthead").hidden = true;
    $("#main").hidden = true;
    gate.hidden = false;
    var p = $("#gate-pass");
    if (p) { p.value = ""; p.focus(); }
  }

  function gateError(msg) {
    gateErr.textContent = msg;
    gateErr.hidden = false;
    var p = $("#gate-pass");
    p.focus();
    p.select();
  }

  ping().then(function (j) {
    if (!j) $("#gate-offline").hidden = false;
    if (token) {
      // Проверяем токен пустым сохранением прав: просто пробуем открыть.
      openApp();
    }
  });

  gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    gateErr.hidden = true;
    var pass = $("#gate-pass").value;
    if (!pass) { gateError("Введи пароль."); return; }

    var btn = $("#gate-submit");
    btn.setAttribute("aria-disabled", "true");
    var lbl = btn.textContent;
    btn.textContent = "Проверяем…";

    api("login", { password: pass })
      .then(function (res) {
        if (res && res.ok && res.token) {
          token = res.token;
          try { sessionStorage.setItem(TOKEN_KEY, token); } catch (err) { /* приватный режим */ }
          openApp();
          $("#main").focus();
        } else {
          gateError((res && res.error) || "Пароль не подошёл. Проверь раскладку и регистр — пароль латиницей.");
        }
      })
      .catch(function () {
        $("#gate-offline").hidden = false;
        gateError("Сервер не отвечает. Можно продолжить офлайн — правки сохранятся в браузере.");
      })
      .then(function () {
        btn.removeAttribute("aria-disabled");
        btn.textContent = lbl;
      });
  });

  $("#gate-eye").addEventListener("click", function () {
    var p = $("#gate-pass"), on = this.getAttribute("aria-pressed") === "true";
    this.setAttribute("aria-pressed", String(!on));
    this.textContent = on ? "Показать" : "Скрыть";
    p.type = on ? "password" : "text";
    p.focus();
  });

  $("#gate-skip").addEventListener("click", function () { openApp(); });

  $("#logout").addEventListener("click", function () {
    if (dirty && !window.confirm("В черновике есть несохранённые правки. Выйти всё равно?")) return;
    token = "";
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ок */ }
    location.reload();
  });

  /* ---------- Предпросмотр ---------- */

  var prevTimer = null;
  function refreshPreview(announce) {
    var f = $("#prev-frame");
    if (!f) return;
    clearTimeout(prevTimer);
    prevTimer = setTimeout(function () {
      var url = "./?draft=" + Date.now();
      try { f.contentWindow.location.replace(url); }
      catch (e) { f.setAttribute("src", url); }
      if (announce) say("Предпросмотр обновлён");
    }, 400);
  }

  $("#prev-refresh").addEventListener("click", function () { refreshPreview(true); });

  /* Витрину с ?draft рисует сам app.js — он читает тот же черновик
     из localStorage. Здесь достаточно перезагрузить фрейм. */

  /* ---------- Настройки сайта ---------- */

  function fillSiteForm() {
    var s = DATA.site || (DATA.site = {});
    $("#s-name").value = s.name || "";
    $("#s-tagline").value = s.tagline || "";
    $("#s-lead").value = s.lead || "";
    $("#s-tg").value = s.telegram || "";
    $$("[data-brand]").forEach(function (n) { n.textContent = s.name || "CASHMACHINE"; });
  }

  $("#site-form").addEventListener("submit", function (e) {
    e.preventDefault();
    DATA.site = DATA.site || {};
    DATA.site.name = $("#s-name").value.trim();
    DATA.site.tagline = $("#s-tagline").value.trim();
    DATA.site.lead = $("#s-lead").value.trim();
    DATA.site.telegram = $("#s-tg").value.trim();
    fillSiteForm();
    persist("Настройки сохранены в черновик");
  });

  /* ---------- Категории ---------- */

  var catRows = $("#cat-rows");

  function catCount(id) {
    return DATA.offers.filter(function (o) { return o.cat === id; }).length;
  }

  function slug(label) {
    var base = label.toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "cat";
    var id = base, n = 2;
    while (DATA.categories.some(function (c) { return c.id === id; })) id = base + "-" + (n++);
    return id;
  }

  function iconBtn(label, glyph, cls) {
    var b = el("button", "iconbtn" + (cls ? " " + cls : ""));
    b.type = "button";
    b.appendChild(el("span", null, glyph));
    b.lastChild.setAttribute("aria-hidden", "true");
    b.appendChild(el("span", "vh", label));
    return b;
  }

  function renderCats() {
    catRows.textContent = "";
    var list = DATA.categories;

    list.forEach(function (c, i) {
      var isAll = c.id === "all";
      var tr = el("tr");
      tr.dataset.id = c.id;

      // Первая ячейка — заголовок строки: так вслух читается «Кредитные
      // карты, офферов 5», а не голые числа без привязки.
      var td1 = el("th");
      td1.setAttribute("scope", "row");
      td1.appendChild(el("b", "cell-title", c.label));
      if (isAll) td1.appendChild(el("span", "cell-sub", "общий фильтр"));
      tr.appendChild(td1);

      var n = isAll ? DATA.offers.length : catCount(c.id);
      tr.appendChild(el("td", null, String(n)));

      var td3 = el("td");
      var acts = el("div", "cell-acts");

      var up = iconBtn("Поднять категорию «" + c.label + "»", "↑");
      var dn = iconBtn("Опустить категорию «" + c.label + "»", "↓");
      up.dataset.act = "up"; dn.dataset.act = "down";
      up.dataset.id = c.id;  dn.dataset.id = c.id;
      if (i <= 1) up.setAttribute("aria-disabled", "true");   // «Все» всегда первая
      if (i === 0 || i === list.length - 1) dn.setAttribute("aria-disabled", "true");
      if (isAll) { up.setAttribute("aria-disabled", "true"); dn.setAttribute("aria-disabled", "true"); }

      var catGuard = function (btn, dir) {
        return function () {
          if (btn.getAttribute("aria-disabled") !== "true") { moveCat(c.id, dir); return; }
          if (isAll) say("Категория «Все» всегда стоит первой — её порядок не меняется.");
          else say("«" + c.label + "» уже " + (dir < 0 ? "первая" : "последняя") + " в списке.");
        };
      };
      up.addEventListener("click", catGuard(up, -1));
      dn.addEventListener("click", catGuard(dn, 1));
      acts.appendChild(up); acts.appendChild(dn);

      if (!isAll) {
        var ed = iconBtn("Переименовать категорию «" + c.label + "»", "✎");
        ed.dataset.act = "edit"; ed.dataset.id = c.id;
        ed.addEventListener("click", function () { openCatDialog(c); });
        acts.appendChild(ed);

        var rm = iconBtn("Удалить категорию «" + c.label + "»", "✕", "iconbtn--danger");
        rm.dataset.act = "del"; rm.dataset.id = c.id;
        rm.addEventListener("click", function () { openCatDelete(c); });
        acts.appendChild(rm);
      }

      td3.appendChild(acts);
      tr.appendChild(td3);
      catRows.appendChild(tr);
    });

    $("#cat-cap").textContent = "Категорий: " + list.length;
    fillCatSelect();
  }

  function moveCat(id, dir) {
    var i = DATA.categories.findIndex(function (c) { return c.id === id; });
    var j = i + dir;
    if (i < 1 || j < 1 || j >= DATA.categories.length) return; // «Все» держим первой
    var tmp = DATA.categories[i];
    DATA.categories[i] = DATA.categories[j];
    DATA.categories[j] = tmp;
    persist();
    renderCats();
    say("Категория «" + tmp.label + "» теперь " + (j + 1) + "-я");
    refocus('[data-act="' + (dir < 0 ? "up" : "down") + '"][data-id="' + cssEsc(id) + '"]');
  }

  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

  function refocus(sel) {
    var n = document.querySelector(sel);
    if (n && n.isConnected) n.focus();
  }

  /* Диалог категории */
  var catDlg = $("#cat-dlg"), catForm = $("#cat-form"), catEditing = null, catOpener = null;

  function openCatDialog(cat) {
    catEditing = cat || null;
    catOpener = document.activeElement;
    $("#cat-dlg-h").textContent = cat ? "Переименовать категорию" : "Новая категория";
    $("#cat-save").textContent = cat ? "Сохранить" : "Добавить";
    $("#c-name").value = cat ? cat.label : "";
    $("#c-name-err").hidden = true;
    $("#c-name").removeAttribute("aria-invalid");
    catDlg.showModal();
    $("#c-name").focus();
  }

  $("#cat-add").addEventListener("click", function () { openCatDialog(null); });
  $("#cat-cancel").addEventListener("click", function () { catDlg.close(); });

  catDlg.addEventListener("close", function () {
    if (catOpener && catOpener.isConnected) catOpener.focus();
    else refocus("#cat-add");
  });

  catForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#c-name"), errBox = $("#c-name-err");
    var name = input.value.trim();

    var clash = DATA.categories.some(function (c) {
      return c.label.toLowerCase() === name.toLowerCase() && c !== catEditing;
    });

    var msg = "";
    if (!name) msg = "Напиши название категории — например «Crypto».";
    else if (name.length > 40) msg = "Слишком длинно: " + name.length + " символов, а на кнопке помещается 40.";
    else if (clash) msg = "Категория «" + name + "» уже есть. Придумай другое название.";

    if (msg) {
      input.setAttribute("aria-invalid", "true");
      errBox.textContent = msg;
      errBox.hidden = false;
      input.focus();
      return;
    }

    if (catEditing) {
      catEditing.label = name;
      say("Категория переименована в «" + name + "»");
    } else {
      DATA.categories.push({ id: slug(name), label: name });
      say("Категория «" + name + "» добавлена");
    }
    persist();
    renderCats();
    renderOffers();
    catDlg.close();
  });

  /* Удаление категории с переносом офферов */
  var catDelDlg = $("#catdel-dlg"), catDelTarget = null, catDelOpener = null;

  function openCatDelete(cat) {
    catDelTarget = cat;
    catDelOpener = document.activeElement;
    var n = catCount(cat.id);

    $("#catdel-h").textContent = "Удалить «" + cat.label + "»?";
    var move = $("#catdel-move"), sel = $("#catdel-target");
    $("#catdel-err").hidden = true;

    if (n) {
      $("#catdel-desc").textContent = "В категории " + n + " " + plural(n, "оффер", "оффера", "офферов") +
        ". Выбери, куда их перенести — иначе они потеряются.";
      sel.textContent = "";
      sel.appendChild(new Option("— выбери категорию —", ""));
      DATA.categories.forEach(function (c) {
        if (c.id !== cat.id && c.id !== "all") sel.appendChild(new Option(c.label, c.id));
      });
      move.hidden = false;
    } else {
      $("#catdel-desc").textContent = "В категории нет офферов, удаляем без последствий.";
      move.hidden = true;
    }

    catDelDlg.showModal();
    $("#catdel-cancel").focus();
  }

  $("#catdel-cancel").addEventListener("click", function () { catDelDlg.close(); });
  catDelDlg.addEventListener("close", function () {
    if (catDelOpener && catDelOpener.isConnected) catDelOpener.focus();
    else refocus("#cats-h");
  });

  $("#catdel-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var cat = catDelTarget, n = catCount(cat.id);
    if (n) {
      var to = $("#catdel-target").value;
      if (!to) {
        var er = $("#catdel-err");
        er.textContent = "Выбери категорию, в которую перенести офферы.";
        er.hidden = false;
        $("#catdel-target").focus();
        return;
      }
      DATA.offers.forEach(function (o) { if (o.cat === cat.id) o.cat = to; });
    }
    DATA.categories = DATA.categories.filter(function (c) { return c.id !== cat.id; });
    persist();
    catDelOpener = null;
    catDelDlg.close();
    renderCats();
    renderOffers();
    shout("Категория «" + cat.label + "» удалена");
    refocus("#cat-add");
  });

  /* ---------- Офферы ---------- */

  var offerRows = $("#offer-rows"), adminQ = $("#admin-q");
  var query = "";

  function visibleOffers() {
    if (!query) return DATA.offers.slice();
    return DATA.offers.filter(function (o) {
      var hay = [o.title, o.bank, o.payout, o.payFor, o.note, o.badge];
      if (Array.isArray(o.facts)) o.facts.forEach(function (f) { if (f) hay.push(f.k, f.v); });
      return hay.join(" ").toLowerCase().indexOf(query) >= 0;
    });
  }

  function catLabel(id) {
    var c = DATA.categories.filter(function (x) { return x.id === id; })[0];
    return c ? c.label : "без категории";
  }

  /* Логотип в таблице — подсказка глазами: банк написан рядом текстом,
     поэтому картинка молчит, а буква-заглушка спрятана от скринридера. */
  function logoThumb(o) {
    var src = logoSrc(o.logo);   // пусто и для lib:-ссылки без записи в библиотеке
    if (!src) {
      var m = el("span", "cell-logo cell-logo--mono", String(o.bank || "?").trim().charAt(0).toUpperCase());
      m.setAttribute("aria-hidden", "true");
      return m;
    }
    var box = el("span", "cell-logo");
    var img = el("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    box.appendChild(img);
    return box;
  }

  function renderOffers() {
    offerRows.textContent = "";
    var list = visibleOffers();
    var total = DATA.offers.length;

    list.forEach(function (o) {
      var i = DATA.offers.indexOf(o);
      var tr = el("tr");
      tr.dataset.id = o.id;

      var td1 = el("th");
      td1.setAttribute("scope", "row");
      td1.appendChild(el("b", "cell-title", o.title || "Без названия"));
      td1.appendChild(el("span", "cell-sub", catLabel(o.cat)));
      tr.appendChild(td1);

      var td2 = el("td");
      var bankCell = el("div", "cell-bank");
      bankCell.appendChild(logoThumb(o));
      bankCell.appendChild(el("span", null, o.bank || "—"));
      td2.appendChild(bankCell);
      tr.appendChild(td2);

      tr.appendChild(el("td", null, o.payout || "—"));

      var td4 = el("td");
      var on = o.active !== false;
      var st = el("span", "state " + (on ? "state--on" : "state--off"), on ? "Активен" : "На паузе");
      td4.appendChild(st);
      tr.appendChild(td4);

      var td5 = el("td");
      var acts = el("div", "cell-acts");

      var up = iconBtn("Поднять оффер «" + o.title + "»", "↑");
      var dn = iconBtn("Опустить оффер «" + o.title + "»", "↓");
      up.dataset.act = "up"; up.dataset.id = o.id;
      dn.dataset.act = "down"; dn.dataset.id = o.id;
      /* При включённом поиске в таблице видна только часть офферов, а порядок
         меняется в полном списке — стрелка меняла бы оффер местами с тем,
         кого на экране нет. Поэтому пока идёт поиск, порядок не трогаем. */
      if (query) { up.setAttribute("aria-disabled", "true"); dn.setAttribute("aria-disabled", "true"); }
      if (i === 0) up.setAttribute("aria-disabled", "true");
      if (i === total - 1) dn.setAttribute("aria-disabled", "true");
      /* aria-disabled сам ничего не запрещает — отказ проверяем руками и
         говорим причину, иначе нажатие просто ничего не делает. */
      var guard = function (btn, dir) {
        return function () {
          if (btn.getAttribute("aria-disabled") !== "true") { moveOffer(o.id, dir); return; }
          if (query) {
            say("Пока включён поиск, порядок менять нельзя — очисти поиск и попробуй снова.");
          } else {
            say("«" + o.title + "» уже " + (dir < 0 ? "первый" : "последний") + " в списке.");
          }
        };
      };
      up.addEventListener("click", guard(up, -1));
      dn.addEventListener("click", guard(dn, 1));
      acts.appendChild(up); acts.appendChild(dn);

      var tg = iconBtn((on ? "Поставить на паузу оффер «" : "Вернуть в работу оффер «") + o.title + "»", on ? "⏸" : "▶");
      tg.dataset.act = "toggle"; tg.dataset.id = o.id;
      tg.addEventListener("click", function () {
        o.active = !(o.active !== false);
        persist();
        renderOffers();
        say("«" + o.title + "» — " + (o.active ? "снова в работе" : "на паузе"));
        refocus('[data-act="toggle"][data-id="' + cssEsc(o.id) + '"]');
      });
      acts.appendChild(tg);

      var ed = iconBtn("Изменить оффер «" + o.title + "»", "✎");
      ed.dataset.act = "edit"; ed.dataset.id = o.id;
      ed.addEventListener("click", function () { openOfferDialog(o); });
      acts.appendChild(ed);

      var rm = iconBtn("Удалить оффер «" + o.title + "»", "✕", "iconbtn--danger");
      rm.dataset.act = "del"; rm.dataset.id = o.id;
      rm.addEventListener("click", function () { askDelete(o); });
      acts.appendChild(rm);

      td5.appendChild(acts);
      tr.appendChild(td5);
      offerRows.appendChild(tr);
    });

    $("#offer-empty").hidden = list.length > 0;
    var paused = DATA.offers.filter(function (o) { return o.active === false; }).length;
    $("#admin-count").textContent = query
      ? "Найдено " + list.length + " из " + total
      : total + " " + plural(total, "оффер", "оффера", "офферов") + (paused ? " · " + paused + " на паузе" : "");
  }

  function moveOffer(id, dir) {
    var i = DATA.offers.findIndex(function (o) { return o.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= DATA.offers.length) return;
    var tmp = DATA.offers[i];
    DATA.offers[i] = DATA.offers[j];
    DATA.offers[j] = tmp;
    persist();
    renderOffers();
    announceMove(tmp.title, j + 1, DATA.offers.length);
    refocus('[data-act="' + (dir < 0 ? "up" : "down") + '"][data-id="' + cssEsc(id) + '"]');
  }

  /* Зажатую стрелку не читаем на каждый шаг — только итог */
  var moveTimer = null;
  function announceMove(title, pos, total) {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function () {
      say("«" + title + "» на позиции " + pos + " из " + total);
    }, 250);
  }

  adminQ.addEventListener("input", function () {
    query = adminQ.value.trim().toLowerCase();
    renderOffers();
  });

  /* Диалог оффера */
  var offerDlg = $("#offer-dlg"), offerForm = $("#offer-form"), editing = null, offerOpener = null;

  function fillCatSelect() {
    var sel = $("#o-cat");
    var keep = sel.value;
    sel.textContent = "";
    DATA.categories.forEach(function (c) {
      if (c.id !== "all") sel.appendChild(new Option(c.label, c.id));
    });
    if (keep) sel.value = keep;
  }

  function setActiveState() {
    $("#o-active-state").textContent = $("#o-active").checked ? "Активен" : "На паузе";
  }
  $("#o-active").addEventListener("change", setActiveState);

  /* ---------- Условия продукта ----------
     У карты, займа и счёта условия разные, поэтому список пар задаётся
     руками. Каждая строка — два поля с настоящими подписями (label), иначе
     в скринридере получится «поле ввода, поле ввода, поле ввода». */

  var factsBox = $("#o-facts");
  var FACTS_MAX = 6;
  var factSeq = 0;

  function factRow(k, v) {
    var i = ++factSeq;
    var row = el("div", "facts__row");

    var kf = el("div", "facts__cell");
    var kid = "o-fact-k-" + i;
    var kl = el("label", "facts__lab", "Условие");
    kl.setAttribute("for", kid);
    var ki = el("input");
    ki.type = "text"; ki.id = kid; ki.className = "fact-k";
    ki.autocomplete = "off";
    ki.placeholder = "Без процентов";
    ki.value = k || "";
    kf.appendChild(kl); kf.appendChild(ki);

    var vf = el("div", "facts__cell");
    var vid = "o-fact-v-" + i;
    var vl = el("label", "facts__lab", "Значение");
    vl.setAttribute("for", vid);
    var vi = el("input");
    vi.type = "text"; vi.id = vid; vi.className = "fact-v";
    vi.autocomplete = "off";
    vi.placeholder = "120 дней";
    vi.value = v || "";
    vf.appendChild(vl); vf.appendChild(vi);

    var rm = el("button", "iconbtn iconbtn--danger facts__del", "✕");
    rm.type = "button";
    rm.appendChild(el("span", "vh", " Удалить условие"));
    rm.addEventListener("click", function () { removeFact(row); });

    row.appendChild(kf); row.appendChild(vf); row.appendChild(rm);
    return row;
  }

  function factRows() { return $$(".facts__row", factsBox); }

  /* Строки нумеруются подписями «Условие 2», иначе в списке полей формы
     будет шесть одинаковых «Условие» без понимания, какое из них какое. */
  function renumberFacts() {
    var rows = factRows();
    rows.forEach(function (row, idx) {
      var n = idx + 1;
      var labs = $$(".facts__lab", row);
      if (labs[0]) labs[0].textContent = "Условие " + n;
      if (labs[1]) labs[1].textContent = "Значение " + n;
      var rm = $(".facts__del", row);
      var k = ($(".fact-k", row) || {}).value;
      if (rm) $(".vh", rm).textContent = " Удалить условие " + n + (k ? " «" + k + "»" : "");
    });
    var add = $("#o-facts-add");
    if (add) {
      // aria-disabled, а не disabled: выключенная кнопка выпадает из обхода
      // клавиатурой, и объяснить, почему больше нельзя, уже нечем.
      var full = rows.length >= FACTS_MAX;
      if (full) add.setAttribute("aria-disabled", "true");
      else add.removeAttribute("aria-disabled");
    }
    var cnt = $("#o-facts-count");
    if (cnt) cnt.textContent = "Условий: " + rows.length + " из " + FACTS_MAX;
  }

  function removeFact(row) {
    var rows = factRows();
    var idx = rows.indexOf(row);
    row.remove();
    renumberFacts();
    var left = factRows();
    // Фокус не должен улететь в начало формы: уходим на соседнюю строку.
    var next = left[Math.min(idx, left.length - 1)];
    if (next) $(".fact-k", next).focus();
    else $("#o-facts-add").focus();
    say("Условие удалено. Осталось " + left.length + " " + plural(left.length, "условие", "условия", "условий"));
  }

  function addFact(k, v, focus) {
    if (factRows().length >= FACTS_MAX) return null;
    var row = factRow(k, v);
    factsBox.appendChild(row);
    renumberFacts();
    if (focus) {
      // Ничего не объявляем: фокус переезжает в поле с подписью
      // «Условие N», и она сама себя прочитает. Иначе фразы наложатся.
      $(".fact-k", row).focus();
    }
    return row;
  }

  function fillFacts(offer) {
    factsBox.textContent = "";
    var list = offer && Array.isArray(offer.facts) ? offer.facts : null;
    // Каталог прежней версии: показатели лежали отдельными полями.
    if (!list && offer) {
      list = [];
      [["ГЕО", offer.geo], ["Модель", offer.model], ["Холд", offer.hold], ["Источники", offer.sources]]
        .forEach(function (p) { if (p[1]) list.push({ k: p[0], v: p[1] }); });
    }
    if (!list || !list.length) list = [{ k: "", v: "" }, { k: "", v: "" }];
    list.slice(0, FACTS_MAX).forEach(function (f) { addFact(f && f.k, f && f.v, false); });
    renumberFacts();
  }

  function collectFacts() {
    var out = [];
    factRows().forEach(function (row) {
      var k = $(".fact-k", row).value.trim();
      var v = $(".fact-v", row).value.trim();
      if (k && v) out.push({ k: k, v: v });
    });
    return out;
  }

  /* Заполнена половина строки — молча выбрасывать её нельзя: человек думает,
     что условие сохранилось. Возвращаем список проблем для сводки ошибок. */
  function factErrors() {
    var errs = [];
    factRows().forEach(function (row, idx) {
      var ki = $(".fact-k", row), vi = $(".fact-v", row);
      var k = ki.value.trim(), v = vi.value.trim();
      ki.removeAttribute("aria-invalid");
      vi.removeAttribute("aria-invalid");
      if (k && !v) {
        vi.setAttribute("aria-invalid", "true");
        errs.push([vi.id, "У условия «" + k + "» не заполнено значение"]);
      } else if (!k && v) {
        ki.setAttribute("aria-invalid", "true");
        errs.push([ki.id, "У значения «" + v + "» не заполнено условие"]);
      }
    });
    return errs;
  }

  $("#o-facts-add").addEventListener("click", function () {
    if ($("#o-facts-add").getAttribute("aria-disabled") === "true") {
      say("Больше " + FACTS_MAX + " условий в карточку не поместится. Удали лишнее условие, чтобы добавить новое.");
      return;
    }
    addFact("", "", true);
  });
  factsBox.addEventListener("input", function (e) {
    if (e.target.classList.contains("fact-k")) renumberFacts();
  });

  /* ---------- Логотип в форме оффера ---------- */

  var logoSel     = $("#o-logo"),
      logoPrev    = $("#o-logo-prev"),
      logoFile    = $("#o-logo-file"),
      logoStatus  = $("#o-logo-status"),
      logoUrlWrap = $("#o-logo-url-wrap"),
      logoUrlIn   = $("#o-logo-url"),
      logoUrlErr  = $("#o-logo-url-err");

  function logoUrlError(msg) {
    if (msg) {
      logoUrlIn.setAttribute("aria-invalid", "true");
      logoUrlErr.textContent = msg;
      logoUrlErr.hidden = false;
    } else {
      logoUrlIn.removeAttribute("aria-invalid");
      logoUrlErr.textContent = "";
      logoUrlErr.hidden = true;
    }
  }

  /* Поле адреса живёт сразу под селектом и показывается только для пункта
     «По ссылке из интернета…». Перед тем как спрятать его, возвращаем фокус
     на селект — фокус не должен пропадать внутри скрытого блока. */
  function syncLogoUrl() {
    var show = logoSel.value === URL_VALUE;
    if (!show && !logoUrlWrap.hidden && logoUrlWrap.contains(document.activeElement)) logoSel.focus();
    logoUrlWrap.hidden = !show;   // показ без автофокуса: человек дойдёт Tab'ом
  }

  /* Что на самом деле кладём в поле logo: для «По ссылке» — годный адрес
     из поля, иначе пусто; для остальных пунктов — значение селекта. */
  function logoValue() {
    if (logoSel.value !== URL_VALUE) return logoSel.value;
    var v = logoUrlIn.value.trim();
    return isHttpUrl(v) ? v : "";
  }

  /* Чистим и заполняем в разных тиках, как pubStatus: иначе живая область
     молчит, когда та же ошибка приходит второй раз подряд. */
  var logoStatusTimer = null;
  function logoStatusSet(msg, tone) {
    clearTimeout(logoStatusTimer);
    logoStatus.textContent = "";
    logoStatus.dataset.tone = tone || "";
    if (!msg) return;
    logoStatusTimer = setTimeout(function () { logoStatus.textContent = msg; }, 100);
  }

  /* Группа пресетов. Сортируем по названию банка, а не по имени файла:
     в раскрытом списке работает набор с клавиатуры, и «Сбербанк» должен
     стоять там, где его ищут, а не там, где оказалась латиница. */
  function presetGroup(label, list, current, state) {
    var grp = el("optgroup");
    grp.label = label;
    list.slice().sort(function (a, b) { return a[1].localeCompare(b[1], "ru"); })
      .forEach(function (l) {
        var o = el("option", null, l[1]);
        o.value = l[0];
        grp.appendChild(o);
        if (l[0] === current) state.known = true;
      });
    return grp;
  }

  /* Список файлов двумя группами, библиотека «Мои картинки», пункт
     «По ссылке из интернета…» и, если логотип оффера не отсюда, отдельный
     пункт для него: иначе картинка исчезала бы при повторном открытии формы. */
  function fillLogoSelect(current) {
    current = String(current || "").trim();
    logoSel.textContent = "";

    var none = el("option", null, "Без логотипа — первая буква банка");
    none.value = "";
    logoSel.appendChild(none);

    /* Загруженные через админку картинки: библиотека общая, любую можно
       выбрать любому офферу — не только тому, где её загрузили. */
    var mine = DATA.library || [];
    if (mine.length) {
      var grp = el("optgroup");
      grp.label = "Мои картинки";
      mine.forEach(function (it) {
        var op = el("option", null, it.name);
        op.value = "lib:" + it.name;
        grp.appendChild(op);
      });
      logoSel.appendChild(grp);
    }

    var state = { known: current.indexOf("lib:") === 0 && !!libFind(current.slice(4)) };
    logoSel.appendChild(presetGroup("Банки", LOGO_BANKS, current, state));
    logoSel.appendChild(presetGroup("МФО", LOGO_MFO, current, state));

    var urlOpt = el("option", null, "По ссылке из интернета…");
    urlOpt.value = URL_VALUE;
    logoSel.appendChild(urlOpt);

    /* Сохранённый http(s)-адрес — это и есть режим «По ссылке»: пункт-дубль
       «Свой файл: …» ему не нужен, адрес встаёт в поле под селектом. */
    var isUrl = isHttpUrl(current);

    /* Логотип, которого нет ни в списках, ни в библиотеке, не теряем молча. */
    if (current && !state.known && !isUrl) {
      var own = el("option", null,
        /^data:/.test(current) ? "Своя картинка (загружена)"
        : current.indexOf("lib:") === 0 ? current.slice(4) + " (нет в библиотеке)"
        : "Свой файл: " + current);
      own.value = current;
      own.dataset.custom = "1";
      logoSel.appendChild(own);
    }

    logoUrlIn.value = isUrl ? current : "";
    logoUrlError(null);
    logoSel.value = isUrl ? URL_VALUE : current;
    syncLogoUrl();
    drawLogoPreview();
  }

  /* Ссылка «скачать текущую картинку» — для загруженных через админку:
     исходник не обязательно хранить у себя. href, имя файла и подпись
     меняются только вместе и только здесь — устаревшее имя при новой
     картинке хуже, чем ничего. */
  var logoDl = $("#o-logo-dl");
  function updateLogoDl() {
    logoDl.textContent = "";
    var v = logoSel.value;
    var it = v.indexOf("lib:") === 0 ? libFind(v.slice(4))
           : v.indexOf("data:") === 0 ? { name: "картинка", ext: extFromDataUrl(v), data: v }
           : null;
    if (!it) return;
    var fname = it.name + "." + (it.ext || "png");
    var a = el("a", "dl", "Скачать текущую картинку");
    a.download = fname;
    a.href = it.data;
    a.appendChild(el("span", "vh", " (" + fname + ")"));
    logoDl.appendChild(a);
  }

  /* Превью — оформление: то же самое написано в выбранном пункте списка,
     поэтому наружу оно не звучит. */
  function drawLogoPreview() {
    updateLogoDl();
    logoPrev.textContent = "";
    logoSel.removeAttribute("aria-invalid");
    var v = logoValue();
    if (!v) {
      var bank = $("#o-bank").value.trim();
      logoPrev.appendChild(el("span", "logo-pick__mono", (bank || "?").charAt(0).toUpperCase()));
      return;
    }
    var src = logoSrc(v);
    if (!src) {
      /* lib:-ссылка без записи в библиотеке: на витрине будет буква банка. */
      logoPrev.appendChild(el("span", "logo-pick__mono", "?"));
      logoSel.setAttribute("aria-invalid", "true");
      return;
    }
    var img = el("img");
    img.alt = "";
    /* Файла на сервере может не быть — тогда показываем букву и говорим
       об этом прямо в форме: иначе о пустой карточке узнаёшь уже на сайте. */
    img.addEventListener("error", function () {
      logoPrev.textContent = "";
      logoPrev.appendChild(el("span", "logo-pick__mono", "?"));
      logoSel.setAttribute("aria-invalid", "true");
      logoStatusSet(/^(data:|lib:)/.test(v)
        ? "Картинка не открылась. Загрузи файл заново или выбери другой логотип."
        : isHttpUrl(v)
        ? "Картинка по ссылке не открылась. Проверь адрес — нужна прямая ссылка на png, jpg или svg."
        : "Файла " + src + " нет на сервере. Залей его в папку logos/ " +
          "или выбери другой логотип — иначе в карточке будет буква.", "bad");
    });
    img.src = src;
    logoPrev.appendChild(img);
  }

  logoSel.addEventListener("change", function () {
    syncLogoUrl();
    drawLogoPreview();
    logoStatusSet("");
  });

  /* Адрес картинки: годный URL сразу попадает в превью, ошибка — только
     когда адрес дописан (по уходу из поля), а не на каждой букве. */
  logoUrlIn.addEventListener("input", function () {
    var v = logoUrlIn.value.trim();
    if (!v || isHttpUrl(v)) logoUrlError(null);
    drawLogoPreview();
  });
  logoUrlIn.addEventListener("change", function () {
    var v = logoUrlIn.value.trim();
    if (v && !isHttpUrl(v)) {
      logoUrlError("Ссылка должна начинаться с http:// или https:// и быть без пробелов.");
    }
  });

  /* Пока логотип не выбран, в превью стоит буква банка — она должна меняться
     вместе с полем «Банк», иначе там висит буква от прошлого оффера. */
  $("#o-bank").addEventListener("input", function () {
    if (!logoSel.value) drawLogoPreview();
  });

  /* Свою картинку вписываем в 512 px на канвасе: фотографии с телефона
     весят мегабайты, а в data.js они поедут текстом. SVG не трогаем —
     это вектор, канвас его только испортит. */
  function readLogoFile(f, done, fail) {
    if (f.size > LOGO_MAX) {
      fail("Файл больше 4 МБ. Сожми картинку и попробуй снова.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type)) {
      fail("Такой файл не подойдёт. Нужна картинка: PNG, JPG, WebP или SVG.");
      return;
    }
    var r = new FileReader();
    r.onerror = function () { fail("Файл не прочитался. Попробуй другой."); };
    r.onload = function () {
      if (f.type === "image/svg+xml") { done(String(r.result)); return; }
      var img = new Image();
      img.onerror = function () { fail("Файл не открылся как картинка. Попробуй другой."); };
      img.onload = function () {
        var k = Math.min(1, 512 / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * k));
        var h = Math.max(1, Math.round(img.height * k));
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        done(f.type === "image/jpeg" ? c.toDataURL("image/jpeg", .85) : c.toDataURL("image/png"));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  }

  logoFile.addEventListener("change", function () {
    var input = this;
    var f = input.files && input.files[0];
    input.value = "";   /* иначе тот же файл второй раз не выбрать */
    logoStatusSet("");  /* прошлая ошибка не должна пережить новую попытку */
    input.removeAttribute("aria-invalid");
    if (!f) return;

    readLogoFile(f, function (dataUrl) {
      /* Картинка сразу уходит в общую библиотеку — она не часть черновика
         диалога, «Отмена» её не заберёт. А вот выбор логотипа в самом оффере
         закрепится только по кнопке «Сохранить». */
      var base = String(f.name || "").replace(/\.[^.]+$/, "").trim().slice(0, 40) || "картинка";
      var ext = f.type === "image/svg+xml" ? "svg" : f.type === "image/jpeg" ? "jpg" : "png";
      var name = base, n = 2;
      while (libFind(name)) name = base + "-" + (n++);   // имена в списке должны различаться
      lib().push({ name: name, ext: ext, data: dataUrl });
      persist();
      fillLogoSelect("lib:" + name);   // перерисует и превью, и ссылку скачивания
      logoStatusSet("Картинка добавлена в библиотеку и выбрана — не забудь сохранить оффер.", "ok");
    }, function (msg) {
      input.setAttribute("aria-invalid", "true");
      logoStatusSet(msg, "bad");
    });
  });

  function openOfferDialog(offer) {
    editing = offer || null;
    offerOpener = document.activeElement;
    fillCatSelect();

    $("#offer-dlg-h").textContent = offer ? "Изменить оффер" : "Новый оффер";
    $("#o-title").value   = offer ? (offer.title || "") : "";
    $("#o-bank").value    = offer ? (offer.bank || "") : "";
    $("#o-cat").value     = offer ? (offer.cat || "") : ($("#o-cat").options[0] ? $("#o-cat").options[0].value : "");
    $("#o-payout").value  = offer ? (offer.payout || "") : "";
    $("#o-payfor").value  = offer ? (offer.payFor || "") : "";
    $("#o-badge").value   = offer ? (offer.badge || "") : "";
    $("#o-url").value     = offer ? (offer.url || "") : "";
    $("#o-note").value    = offer ? (offer.note || "") : "";
    fillLogoSelect(offer ? (offer.logo || "") : "");
    logoStatusSet("");
    logoFile.removeAttribute("aria-invalid");
    fillFacts(offer);
    $("#o-active").checked = offer ? offer.active !== false : true;
    setActiveState();

    ["#o-title-err", "#o-url-err"].forEach(function (s) { $(s).hidden = true; });
    ["#o-title", "#o-url"].forEach(function (s) { $(s).removeAttribute("aria-invalid"); });
    $("#offer-errs").hidden = true;

    offerDlg.showModal();
    $("#o-title").focus();
  }

  $("#offer-add").addEventListener("click", function () { openOfferDialog(null); });
  $("#offer-cancel").addEventListener("click", function () { offerDlg.close(); });

  /* Куда вернуть фокус после закрытия, решаем в одном месте. Событие close
     приходит отдельной задачей, уже после кода, который вызвал close(): если
     возвращать фокус прямо там, обработчик close всё равно перебьёт его — и
     после сохранения оффера фокус улетал на «Добавить оффер».
     Вызываем и там, и сразу после close(): в некоторых встроенных браузерах
     (например, в панели предпросмотра) событие close вообще не приходит,
     и тогда фокус остался бы в закрытом диалоге. Повторный вызов безвреден. */
  var pendingFocus = null;

  function applyPendingFocus() {
    var sel = pendingFocus;
    pendingFocus = null;
    if (sel && document.querySelector(sel)) { refocus(sel); return; }
    if (sel === null) return; // фокус уже возвращён
    if (offerOpener && offerOpener.isConnected) offerOpener.focus();
    else refocus("#offer-add");
  }

  offerDlg.addEventListener("close", function () {
    if (pendingFocus) { applyPendingFocus(); return; }
    if (offerOpener && offerOpener.isConnected) offerOpener.focus();
    else refocus("#offer-add");
  });

  function fieldErr(sel, msg) {
    var i = $(sel), b = $(sel + "-err");
    if (msg) { i.setAttribute("aria-invalid", "true"); b.textContent = msg; b.hidden = false; }
    else { i.removeAttribute("aria-invalid"); b.textContent = ""; b.hidden = true; }
  }

  offerForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var errs = [];
    fieldErr("#o-title", null);
    fieldErr("#o-url", null);

    var title = $("#o-title").value.trim();
    var url = $("#o-url").value.trim();

    if (!title) {
      fieldErr("#o-title", "Без названия карточку не подписать. Например: Платиновая карта.");
      errs.push(["o-title", "Название оффера не заполнено"]);
    }
    if (!url) {
      fieldErr("#o-url", "Нужна ссылка — её и забирают по кнопке. Например: https://track.example.com/abc");
      errs.push(["o-url", "Ссылка не заполнена"]);
    } else if (!/^https?:\/\/\S+$/i.test(url)) {
      fieldErr("#o-url", "Ссылка должна начинаться с http:// или https:// и быть без пробелов.");
      errs.push(["o-url", "Ссылка указана не полностью"]);
    }

    /* Логотип «По ссылке»: пустое поле — просто без логотипа, а вот кривой
       адрес молча выбрасывать нельзя — человек думает, что картинка есть. */
    if (logoSel.value === URL_VALUE) {
      var logoUrl = logoUrlIn.value.trim();
      if (logoUrl && !isHttpUrl(logoUrl)) {
        logoUrlError("Ссылка должна начинаться с http:// или https:// и быть без пробелов.");
        errs.push(["o-logo-url", "Ссылка на картинку указана не полностью"]);
      }
    }

    errs = errs.concat(factErrors());

    var box = $("#offer-errs"), list = $("#offer-err-list");
    if (errs.length) {
      $("#offer-errs h3").textContent = errs.length === 1
        ? "В форме одна ошибка"
        : "В форме " + errs.length + " " + plural(errs.length, "ошибка", "ошибки", "ошибок");
      list.textContent = "";
      errs.forEach(function (pair) {
        var li = el("li"), a = el("a", null, pair[1]);
        a.href = "#" + pair[0];
        a.addEventListener("click", function (ev) { ev.preventDefault(); $("#" + pair[0]).focus(); });
        li.appendChild(a);
        list.appendChild(li);
      });
      box.hidden = false;
      box.focus();
      return;
    }
    box.hidden = true;

    var data = {
      title:  title,
      cat:    $("#o-cat").value,
      bank:   $("#o-bank").value.trim(),
      logo:   logoValue(),
      payout: $("#o-payout").value.trim(),
      payFor: $("#o-payfor").value.trim(),
      facts:  collectFacts(),
      badge:  $("#o-badge").value.trim(),
      url:    url,
      note:   $("#o-note").value.trim(),
      active: $("#o-active").checked
    };

    // Пустой логотип в файле не нужен: карточка и без ключа рисует букву.
    if (!data.logo) delete data.logo;

    if (editing) {
      // Поля прежней версии (ГЕО, модель, холд, источники) переехали в
      // «условия», поэтому при сохранении убираем их, чтобы они не тянулись
      // в опубликованный data.js.
      ["geo", "model", "hold", "sources"].forEach(function (k) { delete editing[k]; });
      if (!data.logo) delete editing.logo;
      Object.keys(data).forEach(function (k) { editing[k] = data[k]; });
      say("Оффер «" + title + "» изменён");
    } else {
      data.id = "of-" + Date.now().toString(36);
      DATA.offers.push(data);
      say("Оффер «" + title + "» добавлен");
    }

    persist();
    renderOffers();
    var id = editing ? editing.id : data.id;
    // Назначаем цель ДО close(), чтобы обработчик close не перебил её своей.
    pendingFocus = '[data-act="edit"][data-id="' + cssEsc(id) + '"]';
    offerDlg.close();
    applyPendingFocus();
  });

  /* Удаление оффера */
  var confirmDlg = $("#confirm-dlg"), pendingDelete = null, deleteOpener = null;

  function askDelete(o) {
    pendingDelete = o;
    deleteOpener = document.activeElement;
    $("#confirm-h").textContent = "Удалить «" + o.title + "»?";
    confirmDlg.showModal();
    $("#confirm-cancel").focus();
  }

  $("#confirm-cancel").addEventListener("click", function () { confirmDlg.close(); });

  confirmDlg.addEventListener("close", function () {
    if (deleteOpener && deleteOpener.isConnected) deleteOpener.focus();
  });

  $("#confirm-ok").addEventListener("click", function () {
    var o = pendingDelete;
    if (!o) return;
    var i = DATA.offers.indexOf(o);
    // Соседа считаем до удаления — потом индексы уже другие.
    var next = DATA.offers[i + 1] || DATA.offers[i - 1];
    DATA.offers.splice(i, 1);
    persist();
    renderOffers();
    deleteOpener = null;
    confirmDlg.close();
    shout("Оффер «" + o.title + "» удалён");
    if (next) refocus('[data-act="del"][data-id="' + cssEsc(next.id) + '"]');
    else refocus("#offer-add");
  });

  /* ---------- Публикация, выгрузка, импорт ---------- */

  function stamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* Как и на витрине: блок не прячем атрибутом hidden (он выкидывает его
     из дерева доступности), а чистим и заполняем в разных тиках, чтобы
     повторное сообщение с тем же текстом тоже прочиталось. */
  var pubTimer = null;
  function pubStatus(msg, tone) {
    var s = $("#pub-status");
    clearTimeout(pubTimer);
    s.textContent = "";
    s.dataset.tone = tone || "";
    if (!msg) return;
    pubTimer = setTimeout(function () { s.textContent = msg; }, 100);
  }

  function dataFileText() {
    return "/* Каталог витрины. Файл собран админкой. */\nwindow.SITE_DATA = " +
      JSON.stringify(DATA, null, 2) + ";\n";
  }

  $("#publish").addEventListener("click", function () {
    var btn = this;
    DATA.updated = stamp();
    persist();

    if (!online) {
      pubStatus("Публикация работает только там, где есть PHP. Здесь правки живут в браузере — " +
        "нажми «Скачать data.js» и залей файл на хостинг вручную.", "info");
      return;
    }

    btn.setAttribute("aria-disabled", "true");
    var lbl = btn.textContent;
    btn.textContent = "Публикуем…";
    pubStatus("Публикуем изменения…", "");

    api("save", { data: DATA })
      .then(function (res) {
        if (res && res.ok) {
          setDirty(false);
          pubStatus("Готово. Витрина обновлена — можно открывать сайт и проверять.", "ok");
          say("Изменения опубликованы");
        } else if (res && res.error && /Сессия/.test(res.error)) {
          // Черновик уже в localStorage, поэтому ничего не теряем.
          pubStatus("Сессия истекла. Введи пароль ещё раз — черновик сохранён, публикацию повторим.", "bad");
          token = "";
          try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ок */ }
          lockApp();
        } else {
          throw new Error((res && res.error) || "не вышло");
        }
      })
      .catch(function (err) {
        pubStatus("Не удалось опубликовать: " + (err.message || "сервер не ответил") +
          ". Черновик цел — попробуй ещё раз или скачай data.js и залей вручную.", "bad");
        shout("Опубликовать не удалось");
      })
      .then(function () {
        btn.removeAttribute("aria-disabled");
        btn.textContent = lbl;
      });
  });

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  $("#download").addEventListener("click", function () {
    DATA.updated = stamp();
    persist();
    download("data.js", dataFileText(), "application/javascript;charset=utf-8");
    say("Файл data.js скачан");
  });

  $("#export").addEventListener("click", function () {
    download("executtr-" + stamp() + ".json", JSON.stringify(DATA, null, 2), "application/json;charset=utf-8");
    say("Резервная копия скачана");
  });

  $("#import-file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var p = JSON.parse(String(r.result));
        if (!p || !Array.isArray(p.offers)) throw new Error("в файле нет списка офферов");
        DATA = p;
        if (!Array.isArray(DATA.categories) || !DATA.categories.length) DATA.categories = clone(FILE.categories);
        if (!DATA.site) DATA.site = {};
        migrateLogos();
        persist();
        renderAll();
        shout("Каталог загружен из файла: " + DATA.offers.length + " " +
          plural(DATA.offers.length, "оффер", "оффера", "офферов"));
      } catch (e) {
        shout("Файл не прочитан: " + e.message + ". Каталог не изменён.");
      }
    };
    r.onerror = function () { shout("Файл не прочитан. Каталог не изменён."); };
    r.readAsText(f);
    this.value = "";
  });

  /* ---------- Смена пароля ---------- */

  var passForm = $("#pass-form"), passStatus = $("#pass-status");

  /* #pass-status — живая область, поэтому текст сюда пишем только тогда,
     когда фокус никуда не уезжает. Уехал фокус — читается то, куда он
     приехал, и вторая фраза здесь наложилась бы на первую. */
  function passState(msg, tone) {
    passStatus.dataset.tone = tone || "";
    passStatus.textContent = msg || "";
  }

  function showPassErrors(errs) {
    var box = $("#pass-errs"), list = $("#pass-err-list");
    box.querySelector("h3").textContent = errs.length === 1
      ? "В форме одна ошибка"
      : "В форме " + errs.length + " " + plural(errs.length, "ошибка", "ошибки", "ошибок");
    list.textContent = "";
    errs.forEach(function (pair) {
      var li = el("li"), a = el("a", null, pair[1]);
      a.href = "#" + pair[0];
      a.addEventListener("click", function (ev) { ev.preventDefault(); $("#" + pair[0]).focus(); });
      li.appendChild(a);
      list.appendChild(li);
    });
    passState("");
    box.hidden = false;
    box.focus();
  }

  /* Галочка объявляет своё состояние сама, поэтому вслух тут ничего не
     говорим. Каретку сохраняем руками: смена type её сбрасывает в конец,
     и человек, который правил середину пароля, теряет место. */
  $("#p-show").addEventListener("change", function () {
    var show = this.checked;
    ["#p-old", "#p-new", "#p-new2"].forEach(function (s) {
      var i = $(s), a = i.selectionStart, b = i.selectionEnd, focused = document.activeElement === i;
      i.type = show ? "text" : "password";
      if (focused) { try { i.setSelectionRange(a, b); } catch (e) { /* поле не даёт */ } }
    });
  });

  passForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var errs = [];
    ["#p-old", "#p-new", "#p-new2"].forEach(function (s) { fieldErr(s, null); });
    passState("");

    var old = $("#p-old").value, nw = $("#p-new").value, nw2 = $("#p-new2").value;

    if (!old) { fieldErr("#p-old", "Без текущего пароля сменить нельзя."); errs.push(["p-old", "Текущий пароль не введён"]); }
    if (nw.length < 8) { fieldErr("#p-new", "Нужно хотя бы 8 символов, сейчас " + nw.length + "."); errs.push(["p-new", "Новый пароль короче 8 символов"]); }
    else if (nw !== nw2) { fieldErr("#p-new2", "Второй пароль отличается от первого. Введи один и тот же."); errs.push(["p-new2", "Пароли не совпадают"]); }

    /* Один список ошибок на все случаи, и клиентские, и серверные: две
       разные точки приземления фокуса на одну кнопку сбивают с толку. */
    if (errs.length) { showPassErrors(errs); return; }
    $("#pass-errs").hidden = true;

    if (!online) {
      passState("Пароль меняется на сервере, а сейчас связи с ним нет. Открой админку на своём сайте.", "info");
      return;
    }

    var btn = this.querySelector('button[type="submit"]');
    btn.setAttribute("aria-disabled", "true");
    var lbl = btn.textContent;
    btn.textContent = "Меняем…";

    api("password", { old: old, new: nw })
      .then(function (res) {
        if (res && res.ok) {
          /* Сервер закрыл все прежние сессии и выдал новый токен — кладём
             его на место старого, иначе следующая же публикация упрётся
             в «сессия истекла». */
          if (res.token) {
            token = res.token;
            try { sessionStorage.setItem(TOKEN_KEY, token); } catch (err) { /* приватный режим */ }
          }
          passForm.reset();
          $("#p-show").checked = false;
          ["#p-old", "#p-new", "#p-new2"].forEach(function (s) { $(s).type = "password"; });
          /* Фокус остаётся на кнопке — читается только эта строка. */
          passState("Готово. Пароль изменён — следующий вход уже с новым.", "ok");
        } else {
          /* Сервер говорит, какое поле не подошло. Показываем ошибку там же,
             а фокус уводим в общий список — как и при своей проверке. */
          var msg = (res && res.error) || "Не получилось сменить пароль";
          var isNew = res && res.field === "new";
          fieldErr(isNew ? "#p-new" : "#p-old", msg);
          if (!isNew) $("#p-old").value = "";   // новый пароль набран верно, стирать его незачем
          showPassErrors([[isNew ? "p-new" : "p-old", msg.replace(/\.$/, "")]]);
        }
      })
      .catch(function () {
        passState("Сервер не ответил. Пароль не изменён — попробуй ещё раз.", "bad");
      })
      .then(function () {
        btn.removeAttribute("aria-disabled");
        btn.textContent = lbl;
      });
  });

  $("#reset").addEventListener("click", function () {
    if (!window.confirm("Сбросить черновик и вернуться к тому, что сейчас опубликовано на сайте?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ок */ }
    DATA = clone(FILE);
    setDirty(false);
    migrateLogos();
    renderAll();
    refreshPreview();
    shout("Черновик сброшен");
  });

  /* ---------- Отрисовка ---------- */

  function renderAll() {
    fillSiteForm();
    renderCats();
    renderOffers();
  }
})();
