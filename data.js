/* Каталог витрины. Этот файл переписывает админка при публикации.
   Руками править можно, но проще — через /admin.html */
window.SITE_DATA = {
  "site": {
    "name": "EXECUTTR",
    "tagline": "витрина офферов",
    "lead": "Ссылки, ставки и условия по всем активным офферам команды. Обновляется вручную — то, что видишь здесь, уже проверено и льётся.",
    "telegram": "https://t.me/executtr",
    "email": "",
    "sheetUrl": ""
  },
  "updated": "2026-08-09",
  "categories": [
    {
      "id": "all",
      "label": "Все"
    },
    {
      "id": "gambling",
      "label": "Gambling"
    },
    {
      "id": "betting",
      "label": "Betting"
    },
    {
      "id": "dating",
      "label": "Dating"
    },
    {
      "id": "nutra",
      "label": "Nutra"
    },
    {
      "id": "finance",
      "label": "Finance"
    },
    {
      "id": "utility",
      "label": "Utility"
    }
  ],
  "offers": [
    {
      "id": "of-1",
      "title": "1Win Casino",
      "cat": "gambling",
      "geo": "US, CA, AU",
      "payout": "45 $",
      "model": "CPA",
      "hold": "14 дней",
      "sources": "FB, UAC, ASO",
      "url": "https://example.com/1win",
      "badge": "Топ недели",
      "note": "Дают апрув по FTD от 10 $. Крео с локальной валютой заходят лучше — не лей общие.",
      "active": true
    },
    {
      "id": "of-2",
      "title": "BetWinner",
      "cat": "betting",
      "geo": "NG, GH, KE",
      "payout": "28 $",
      "model": "CPA",
      "hold": "7 дней",
      "sources": "FB, TikTok",
      "url": "https://example.com/betwinner",
      "badge": "",
      "note": "Нигерия отдаёт лучший объём вечером по местному времени. Ставка растёт после 100 конверсий.",
      "active": true
    },
    {
      "id": "of-3",
      "title": "MelBet",
      "cat": "betting",
      "geo": "NG, CM, TZ",
      "payout": "24 $",
      "model": "CPA",
      "hold": "10 дней",
      "sources": "FB, Push",
      "url": "https://example.com/melbet",
      "badge": "",
      "note": "Живой саппорт, быстро меняют домены при банах.",
      "active": true
    },
    {
      "id": "of-4",
      "title": "Vulkan Vegas",
      "cat": "gambling",
      "geo": "DE, AT, CH",
      "payout": "60 €",
      "model": "CPA",
      "hold": "21 день",
      "sources": "FB, Google Ads",
      "url": "https://example.com/vulkan",
      "badge": "Высокая ставка",
      "note": "Дорогое ГЕО, но и требования к качеству выше — мусорный трафик режут.",
      "active": true
    },
    {
      "id": "of-5",
      "title": "Rollbit",
      "cat": "gambling",
      "geo": "US, UK",
      "payout": "RevShare 40 %",
      "model": "RevShare",
      "hold": "—",
      "sources": "YouTube, Telegram",
      "url": "https://example.com/rollbit",
      "badge": "",
      "note": "Долгая история, но по крипте платят вовремя. Хорошо под контентный трафик.",
      "active": false
    },
    {
      "id": "of-6",
      "title": "Cupid Match",
      "cat": "dating",
      "geo": "US",
      "payout": "6 $",
      "model": "SOI",
      "hold": "3 дня",
      "sources": "FB, Native",
      "url": "https://example.com/cupid",
      "badge": "",
      "note": "SOI без подтверждения почты. Хорошо крутится на мобильном вебе.",
      "active": true
    },
    {
      "id": "of-7",
      "title": "FlirtLine",
      "cat": "dating",
      "geo": "US, CA",
      "payout": "14 $",
      "model": "DOI",
      "hold": "7 дней",
      "sources": "Push, Popunder",
      "url": "https://example.com/flirtline",
      "badge": "",
      "note": "DOI, письмо приходит сразу — конверт нормальный, если не тянуть прелендом.",
      "active": true
    },
    {
      "id": "of-8",
      "title": "NG Loans",
      "cat": "finance",
      "geo": "NG",
      "payout": "9 $",
      "model": "CPL",
      "hold": "5 дней",
      "sources": "FB, SEO",
      "url": "https://example.com/ngloans",
      "badge": "",
      "note": "Микрозаймы под Нигерию. Апрув по заявке с валидным номером.",
      "active": true
    },
    {
      "id": "of-9",
      "title": "CryptoBoost",
      "cat": "finance",
      "geo": "US, DE, NL",
      "payout": "180 $",
      "model": "CPA",
      "hold": "30 дней",
      "sources": "Google Ads, SEO",
      "url": "https://example.com/cryptoboost",
      "badge": "Долгий холд",
      "note": "Платят за пополнение от 250 $. Холд честный, но длинный — не бери, если нет запаса.",
      "active": true
    },
    {
      "id": "of-10",
      "title": "SecureVPN",
      "cat": "utility",
      "geo": "US, NG, IN",
      "payout": "5 $",
      "model": "CPS",
      "hold": "3 дня",
      "sources": "ASO, YouTube",
      "url": "https://example.com/securevpn",
      "badge": "Наш профиль",
      "note": "Основной оффер под VPN-трафик. Работает по подписке, ретеншн хороший.",
      "active": true
    },
    {
      "id": "of-11",
      "title": "TurboVPN Pro",
      "cat": "utility",
      "geo": "US, NG",
      "payout": "4,2 $",
      "model": "CPS",
      "hold": "3 дня",
      "sources": "ASO, Push",
      "url": "https://example.com/turbovpn",
      "badge": "",
      "note": "Ставка ниже, зато конверт выше — берут на объёме.",
      "active": true
    },
    {
      "id": "of-12",
      "title": "CleanMaster",
      "cat": "utility",
      "geo": "NG, PK, BD",
      "payout": "1,8 $",
      "model": "CPI",
      "hold": "—",
      "sources": "UAC, ASO",
      "url": "https://example.com/cleanmaster",
      "badge": "",
      "note": "Дешёвая установка под низкие ГЕО. Хорошо для разгона аккаунтов.",
      "active": false
    },
    {
      "id": "of-13",
      "title": "KetoSlim",
      "cat": "nutra",
      "geo": "US",
      "payout": "42 $",
      "model": "COD",
      "hold": "14 дней",
      "sources": "FB, Native",
      "url": "https://example.com/ketoslim",
      "badge": "",
      "note": "Классика на похудении. Колл-центр работает по будням, апрув держат около 45 %.",
      "active": true
    },
    {
      "id": "of-14",
      "title": "ProstaFix",
      "cat": "nutra",
      "geo": "DE, IT, ES",
      "payout": "34 €",
      "model": "COD",
      "hold": "14 дней",
      "sources": "FB, Native",
      "url": "https://example.com/prostafix",
      "badge": "",
      "note": "Мужская тема, аудитория 45+. Прелендер обязателен, иначе апрув падает.",
      "active": true
    },
    {
      "id": "of-15",
      "title": "Pin-Up Casino",
      "cat": "gambling",
      "geo": "KZ, UZ, AZ",
      "payout": "35 $",
      "model": "CPA",
      "hold": "14 дней",
      "sources": "FB, Telegram",
      "url": "https://example.com/pinup",
      "badge": "",
      "note": "СНГ-направление. Дают личного менеджера от 50 конверсий в месяц.",
      "active": true
    },
    {
      "id": "of-16",
      "title": "SportyBet",
      "cat": "betting",
      "geo": "NG, GH",
      "payout": "18 $",
      "model": "CPA",
      "hold": "7 дней",
      "sources": "FB, TikTok, SEO",
      "url": "https://example.com/sportybet",
      "badge": "",
      "note": "Локальный бренд, узнаваемость высокая — конверт на холодном трафике выше среднего.",
      "active": true
    }
  ],
  "faq": [
    {
      "q": "Как забрать ссылку на оффер?",
      "a": "Нажми «Забрать ссылку» на карточке — ссылка скопируется в буфер обмена. У карточек с пометкой «На паузе» кнопки нет: такой оффер сейчас не льём."
    },
    {
      "q": "Что значит пометка «На паузе»?",
      "a": "Оффер приостановлен: закончился кап, рекламодатель закрыл ГЕО или мы разбираемся с выплатами. Карточку не убираем, чтобы ты видел — оффер существует и вернётся."
    },
    {
      "q": "Как часто обновляется витрина?",
      "a": "По мере изменений — ставки и статусы правятся вручную в тот же день. Дата последнего обновления стоит в шапке витрины."
    },
    {
      "q": "Что делать, если ставка на витрине не совпала с ПП?",
      "a": "Напиши в форму ниже или в личку. Скорее всего рекламодатель поменял условия и мы ещё не успели обновить карточку."
    }
  ]
};
