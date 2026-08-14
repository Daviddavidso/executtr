#!/usr/bin/env bash
# Заливка витрины CASHMACHINE на хостинг по FTP.
#
#   bash deploy.sh                — залить сайт (каталог на сервере не трогаем)
#   bash deploy.sh --with-data    — залить ещё и data.js, затерев правки клиента
#
# Доступы лежат в ~/.executtr-ftp (chmod 600), в репозиторий не попадают —
# репо публичный. Там FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR и SITE_URL.
#
# Пока у клиента нет своего хостинга, сайт живёт подпапкой /cashmachine
# на full-worker.ru. Появится свой домен — меняем FTP_DIR и SITE_URL в
# ~/.executtr-ftp, сам скрипт трогать не нужно.
set -euo pipefail

CREDS="$HOME/.executtr-ftp"
[ -f "$CREDS" ] || { echo "нет $CREDS — там должны быть FTP_HOST/USER/PASS/DIR и SITE_URL"; exit 1; }
# shellcheck disable=SC1090
. "$CREDS"

cd "$(dirname "$0")"
FTP="ftp://${FTP_HOST}${FTP_DIR}"
AUTH="${FTP_USER}:${FTP_PASS}"

# README.md не заливаем: это заметка для себя, на живом сайте ей делать нечего.
FILES=(index.html app.js styles.css
       admin.html admin.css admin.js
       api.php .htaccess)

# ВНИМАНИЕ ПРО data.js. Каталог правит клиент через админку, и живёт он на
# сервере. Обычная заливка его НЕ трогает — иначе правки клиента молча
# затрутся нашей локальной копией.
WITH_DATA=0
if [ "${1:-}" = "--with-data" ]; then
  echo "⚠ Заливаю ещё и data.js — правки, сделанные клиентом в админке, будут затёрты."
  FILES+=(data.js)
  WITH_DATA=1
fi

ok=0; fail=0
put() {
  if curl -sS --max-time 180 --ftp-create-dirs -u "$AUTH" -T "$1" "$FTP/$1"; then
    echo "  ok    $1"; ok=$((ok + 1))
  else
    echo "  ОШИБКА $1"; fail=$((fail + 1))
  fi
}

echo "Заливаю на ${FTP_HOST}${FTP_DIR}"
for f in "${FILES[@]}"; do put "$f"; done
for f in fonts/*; do put "$f"; done
for f in logos/*; do put "$f"; done

# Первая заливка: без data.js сайту нечего показывать.
if [ "$WITH_DATA" = "0" ]; then
  if curl -s --max-time 30 -o /dev/null -u "$AUTH" "$FTP/data.js"; then
    echo "  —     data.js уже на сервере, не трогаю (там правки клиента)"
  else
    echo "  ·     data.js на сервере нет — заливаю первый раз"
    put data.js
  fi
fi

# Пароль от админки заливаем, только если на сервере его ещё нет: иначе
# сменённый клиентом пароль откатится к нашему.
if [ -f config.php ]; then
  if curl -s --max-time 30 -o /dev/null -u "$AUTH" "$FTP/config.php"; then
    echo "  —     config.php уже на сервере, не трогаю (там может быть новый пароль)"
  else
    put config.php
  fi
fi

# Админка сохраняет каталог, переписывая data.js — значит, ему нужны права на
# запись. Без этого api.php отвечает writable:false и «Опубликовать» не работает.
curl -sS --max-time 30 -u "$AUTH" -Q "SITE CHMOD 666 ${FTP_DIR}/data.js" "ftp://${FTP_HOST}${FTP_DIR}/" >/dev/null \
  && echo "  ok    права на запись для data.js" \
  || echo "  ⚠     не получилось выставить права на data.js — поставь 666 в файловом менеджере"

echo "── залито: $ok, ошибок: $fail"
[ "$fail" -eq 0 ] || exit 1

# Проверка: без неё «залито» ничего не значит.
echo "── проверяю живой сайт"
cb=$(date +%s)
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$SITE_URL")
admin=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${SITE_URL}admin.html")
ping=$(curl -s --max-time 30 "${SITE_URL}api.php?action=ping&cb=$cb")
alive=$(echo "$ping" | grep -c '"ok":true' || true)
writable=$(echo "$ping" | grep -c '"writable":true' || true)
logos=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${SITE_URL}logos/tbank.svg")
secret=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${SITE_URL}config.php")

echo "   $SITE_URL → HTTP $code"
echo "   ${SITE_URL}admin.html → HTTP $admin"
echo "   логотипы отдаются: HTTP $logos"
echo "   бэкенд отвечает: $alive (ждём 1), data.js доступен на запись: $writable (ждём 1)"
echo "   config.php закрыт: HTTP $secret (ждём 403)"
[ "$code" = "200" ] && [ "$admin" = "200" ] && [ "$alive" = "1" ] && [ "$writable" = "1" ] && [ "$logos" = "200" ] &&
  echo "── готово: ${SITE_URL}admin.html" || {
  echo "── что-то не так, смотри вывод выше"; exit 1; }
