<?php
/*
  Бэкенд витрины. Один файл, ничего ставить не нужно — только PHP на хостинге.

  Что умеет:
    GET  ?action=ping    — проверка, что бэкенд жив
    POST action=login    — вход в админку (отдаёт токен на 12 часов)
    POST action=save     — перезаписывает data.js каталогом из админки
    POST action=lead     — принимает заявку с сайта: пишет в CSV, шлёт в телеграм и в Google-таблицу
    POST action=password — смена пароля админки (нужен токен сессии)
    POST action=catalog  — отдаёт админке каталог с выплатами (нужен токен)
    POST action=tg       — сюда стучится телеграм-бот, когда ему пишут

  Пароль админки лежит в config.php рядом. Если файла нет — берётся значение по умолчанию.
*/

declare(strict_types=1);

// Любой warning из PHP, напечатанный до JSON, ломает ответ на стороне сайта.
// Поэтому в вывод ничего не пускаем — только в лог хостинга.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const DEFAULT_PASSWORD = 'executtr';
const SESSION_TTL      = 43200; // 12 часов

const MIN_PASSWORD     = 8;
const LOGIN_TRIES      = 5;      // столько неудачных попыток
const LOGIN_WINDOW     = 900;    // за столько секунд
const LOGIN_LOCK       = 900;    // и вход закрывается на столько же

$ROOT       = __DIR__;
$DATA_FILE  = $ROOT . '/data.js';
$CONFIG     = $ROOT . '/config.php';

/* Всё, что не должно попадать в браузер, лежит НАД корнем сайта, и это
   принципиально. На шаред-хостингах (reg.ru, Beget) статику раздаёт nginx,
   не заглядывая в .htaccess: запрет оттуда работает для php и csv, а .js
   отдаётся как есть. Копия каталога рядом с сайтом открывалась по прямой
   ссылке вместе с внутренними полями выплат.
   Если папка выше корня недоступна на запись (бывает на жёстко закрытых
   хостингах), остаёмся в корне: там файлы прикрыты хотя бы .htaccess. */
$PRIV = dirname($ROOT) . '/.executtr-private';
if (!is_dir($PRIV)) @mkdir($PRIV, 0700);
/* Папку выше корня может не дать создать жёстко закрытый хостинг —
   тогда остаёмся в корне сайта под защитой .htaccess. */
if (!is_dir($PRIV) || !is_writable($PRIV)) $PRIV = $ROOT;

$BACKUP_FILE = $PRIV . '/data.backup.js';
$FULL_FILE   = $PRIV . '/data.full.json';   // каталог с выплатами, только для админки
$LEADS_FILE  = $PRIV . '/leads.csv';
$TOKENS      = $PRIV . '/.tokens';
$ATTEMPTS    = $PRIV . '/.login-attempts';
$TG_CHATS    = $PRIV . '/.tg-chats.json';   // кому слать заявки в телеграм
$TG_OFFSET   = $PRIV . '/.tg-offset';        // на чём остановился опрос бота

/* Переезд со старых мест: файлы могли лежать в корне сайта. */
foreach ([['/leads.csv', $LEADS_FILE], ['/.tokens', $TOKENS], ['/data.backup.js', $BACKUP_FILE]] as $m) {
    $old = $ROOT . $m[0];
    if ($old !== $m[1] && is_file($old) && !is_file($m[1])) @rename($old, $m[1]);
}

$cfg = ['password' => DEFAULT_PASSWORD, 'password_hash' => '', 'sheet_url' => '',
        'tg_token' => '', 'tg_secret' => '', 'salt' => 'executtr-salt'];
if (is_file($CONFIG)) {
    $loaded = include $CONFIG;
    if (is_array($loaded)) $cfg = array_merge($cfg, $loaded);
}

/* ---------- Пароль ---------- */

/* В файле может лежать либо хэш (нормальный случай), либо пароль открытым
   текстом (так было раньше и так проще для первой заливки). Второй вариант
   молча переводим в хэш при первом же удачном входе. */
function password_ok(array $cfg, string $pass): bool {
    $hash = (string)($cfg['password_hash'] ?? '');
    if ($hash !== '') return password_verify($pass, $hash);
    return hash_equals((string)($cfg['password'] ?? ''), $pass);
}

function config_write(string $file, array $cfg): bool {
    /* Пишем все известные ключи разом: если забыть здесь любой из них,
       он пропадёт из файла при первой же смене пароля. */
    $hash   = var_export((string)($cfg['password_hash'] ?? ''), true);
    $sheet  = var_export((string)($cfg['sheet_url'] ?? ''), true);
    $tgTok  = var_export((string)($cfg['tg_token'] ?? ''), true);
    $tgSec  = var_export((string)($cfg['tg_secret'] ?? ''), true);
    $php = "<?php\n"
         . "/*\n"
         . "  Настройки бэкенда. Пароль от админки здесь не хранится открытым:\n"
         . "  в password_hash лежит его хэш, и обратно из него пароль не достать.\n"
         . "  Меняется пароль в самой админке, раздел «Пароль от админки».\n"
         . "  Забыл пароль — сотри строку password_hash и впиши временный:\n"
         . "      'password' => 'временный',\n"
         . "  войди с ним и сразу смени в админке на постоянный.\n"
         . "\n"
         . "  sheet_url — адрес веб-приложения Google Apps Script для заявок.\n"
         . "  tg_token  — токен телеграм-бота, в него уходят заявки.\n"
         . "  tg_secret — пароль вебхука: с ним телеграм стучится на api.php.\n"
         . "*/\n\n"
         . "return [\n"
         . "    'password_hash' => $hash,\n"
         . "    'sheet_url'     => $sheet,\n"
         . "    'tg_token'      => $tgTok,\n"
         . "    'tg_secret'     => $tgSec,\n"
         . "];\n";
    $tmp = $file . '.tmp';
    if (@file_put_contents($tmp, $php, LOCK_EX) === false) return false;
    if (!@rename($tmp, $file)) { @unlink($tmp); return false; }
    @chmod($file, 0600);
    /* Без этого сервер ещё несколько секунд отдаёт старый конфиг из кэша
       скомпилированного кода: сразу после смены пароля успевал сработать
       предыдущий. Проверено на локальном PHP — на хостинге кэш тем более. */
    if (function_exists('opcache_invalidate')) @opcache_invalidate($file, true);
    return true;
}

/* ---------- Защита от перебора пароля ---------- */

function attempts_read(string $file): array {
    if (!is_file($file)) return [];
    $j = json_decode((string)file_get_contents($file), true);
    return is_array($j) ? $j : [];
}

function attempts_key(): string {
    return substr(hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'cli')), 0, 16);
}

/* Сколько секунд осталось до конца блокировки; 0 — вход открыт. */
function login_locked(string $file): int {
    $all  = attempts_read($file);
    $rec  = $all[attempts_key()] ?? null;
    if (!$rec) return 0;
    $left = (int)($rec['until'] ?? 0) - time();
    return $left > 0 ? $left : 0;
}

function login_failed(string $file): void {
    $all = attempts_read($file);
    $key = attempts_key();
    $now = time();
    /* Заодно подчищаем чужие протухшие записи, иначе файл растёт вечно. */
    foreach ($all as $k => $r) {
        if ((int)($r['seen'] ?? 0) < $now - LOGIN_WINDOW && (int)($r['until'] ?? 0) < $now) unset($all[$k]);
    }
    $rec = $all[$key] ?? ['n' => 0, 'seen' => $now, 'until' => 0];
    if ((int)$rec['seen'] < $now - LOGIN_WINDOW) $rec['n'] = 0;   // окно истекло, счёт заново
    $rec['n']    = (int)$rec['n'] + 1;
    $rec['seen'] = $now;
    if ($rec['n'] >= LOGIN_TRIES) { $rec['until'] = $now + LOGIN_LOCK; $rec['n'] = 0; }
    $all[$key] = $rec;
    @file_put_contents($file, json_encode($all), LOCK_EX);
    @chmod($file, 0600);
}

function login_ok(string $file): void {
    $all = attempts_read($file);
    unset($all[attempts_key()]);
    @file_put_contents($file, json_encode($all), LOCK_EX);
}

function minutes_left(int $sec): string {
    $m = (int)ceil($sec / 60);
    $last = $m % 10; $tens = $m % 100;
    $word = ($last === 1 && $tens !== 11) ? 'минуту'
          : (($last >= 2 && $last <= 4 && ($tens < 12 || $tens > 14)) ? 'минуты' : 'минут');
    return $m . ' ' . $word;
}

function out(array $payload, int $code = 200): void {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $j = json_decode($raw, true);
    if (is_array($j)) return $j;
    return $_POST;
}

/* ---------- Токены сессии ---------- */

function tokens_read(string $file): array {
    if (!is_file($file)) return [];
    $j = json_decode((string)file_get_contents($file), true);
    return is_array($j) ? $j : [];
}

function tokens_write(string $file, array $list): void {
    $now = time();
    $list = array_filter($list, fn($exp) => (int)$exp > $now);
    file_put_contents($file, json_encode($list), LOCK_EX);
    @chmod($file, 0600);
}

function token_issue(string $file): string {
    $t = bin2hex(random_bytes(24));
    $list = tokens_read($file);
    $list[$t] = time() + SESSION_TTL;
    tokens_write($file, $list);
    return $t;
}

function token_valid(string $file, string $t): bool {
    if ($t === '') return false;
    $list = tokens_read($file);
    if (!isset($list[$t])) return false;
    if ((int)$list[$t] < time()) { unset($list[$t]); tokens_write($file, $list); return false; }
    return true;
}

function token_from_request(): string {
    $h = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    if ($h !== '') return (string)$h;
    $b = body();
    return isset($b['token']) ? (string)$b['token'] : '';
}


/* ---------- Телеграм ---------- */

function tg_api(string $token, string $method, array $payload): array {
    if ($token === '' || !function_exists('curl_init')) return ['code' => 0, 'body' => ''];
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $body = (string)curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}

/* Кому слать. Список ведёт сам бот: человек нажал «Старт» — попал сюда,
   отправил «стоп» — вышел. Никаких chat_id руками в настройках. */
function tg_chats(string $file): array {
    if (!is_file($file)) return [];
    $j = json_decode((string)file_get_contents($file), true);
    return is_array($j) ? $j : [];
}

function tg_chats_save(string $file, array $list): void {
    @file_put_contents($file, json_encode($list, JSON_UNESCAPED_UNICODE), LOCK_EX);
    @chmod($file, 0600);
}

function tg_esc(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}


/* Опрос бота вместо вебхука.

   Вебхук на этом хостинге не работает: телеграм не может достучаться до
   сервера («Connection timed out»), обновления копятся у них в очереди.
   Поэтому ходим за ними сами — наружу сервер ходит нормально.

   Опрос дёргается в моменты, когда мы и так что-то делаем: открылась
   админка (ping) и пришла заявка. Этого достаточно: нужно всего лишь
   заметить, что человек нажал «Старт». */
function tg_poll(string $token, string $chatsFile, string $offsetFile): int {
    if ($token === '' || !function_exists('curl_init')) return 0;

    $offset = is_file($offsetFile) ? (int)file_get_contents($offsetFile) : 0;
    $url = 'https://api.telegram.org/bot' . $token . '/getUpdates?timeout=0&allowed_updates=%5B%22message%22%5D'
         . ($offset ? '&offset=' . $offset : '');

    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
    $body = (string)curl_exec($ch);
    curl_close($ch);

    $j = json_decode($body, true);
    if (!is_array($j) || empty($j['ok']) || empty($j['result'])) return 0;

    $list    = tg_chats($chatsFile);
    $changed = 0;
    $last    = $offset;

    foreach ($j['result'] as $u) {
        $last = max($last, (int)($u['update_id'] ?? 0) + 1);
        $msg  = $u['message'] ?? null;
        $chat = is_array($msg) ? ($msg['chat'] ?? null) : null;
        if (!is_array($chat) || ($chat['type'] ?? '') !== 'private') continue;

        $id    = (string)($chat['id'] ?? '');
        if ($id === '') continue;
        $text  = mb_strtolower(trim((string)($msg['text'] ?? '')));
        $title = trim(((string)($chat['first_name'] ?? '')) . ' ' . ((string)($chat['last_name'] ?? '')));
        if (($chat['username'] ?? '') !== '') $title .= ' (@' . $chat['username'] . ')';

        if ($text === '/stop' || $text === 'стоп') {
            if (isset($list[$id])) { unset($list[$id]); $changed++; }
            tg_api($token, 'sendMessage', [
                'chat_id' => $id,
                'text'    => "Отключил. Заявки сюда больше не приходят.\nЧтобы вернуть — напиши /start.",
            ]);
        } else {
            $first = !isset($list[$id]);
            $list[$id] = ['title' => trim($title), 'since' => date('c')];
            $changed++;
            tg_api($token, 'sendMessage', [
                'chat_id'    => $id,
                'parse_mode' => 'HTML',
                'text'       => $first
                    ? "✅ <b>Готово, всё подключено.</b>\n\nТеперь каждая заявка с сайта падает сюда: имя, контакт, что человеку нужно и когда он оставил заявку. Под заявкой будет кнопка, чтобы написать ему в один тап.\n\nСайт: cashmachine-store.ru\nОтключить уведомления — команда /stop."
                    : "Всё уже подключено — заявки приходят сюда. Отключить: /stop.",
            ]);
        }
    }

    if ($changed) tg_chats_save($chatsFile, $list);
    if ($last > $offset) { @file_put_contents($offsetFile, (string)$last, LOCK_EX); @chmod($offsetFile, 0600); }
    return $changed;
}

/* ---------- Действия ---------- */

$action = $_GET['action'] ?? (body()['action'] ?? '');

if ($action === 'ping') {
    tg_poll((string)($cfg['tg_token'] ?? ''), $TG_CHATS, $TG_OFFSET);
    out([
        'ok'       => true,
        'writable' => is_writable($DATA_FILE) || is_writable($ROOT),
        'configured' => is_file($CONFIG),
    ]);
}

if ($action === 'login') {
    $b = body();
    $pass = (string)($b['password'] ?? '');
    // Небольшая задержка, чтобы перебор был невыгодным.
    usleep(300000);

    if ($left = login_locked($ATTEMPTS)) {
        out(['ok' => false, 'error' => 'Слишком много попыток. Вход закрыт ещё на ' . minutes_left($left) . '.'], 429);
    }
    if (!password_ok($cfg, $pass)) {
        login_failed($ATTEMPTS);
        $left = login_locked($ATTEMPTS);
        out(['ok' => false, 'error' => $left
            ? 'Неверный пароль. Попыток больше нет, вход закрыт на ' . minutes_left($left) . '.'
            : 'Неверный пароль'], 401);
    }
    login_ok($ATTEMPTS);

    /* Пароль лежал открытым текстом — переводим в хэш прямо сейчас, чтобы
       из config.php его нельзя было прочитать. Не вышло записать (файл
       только на чтение) — вход всё равно работает, просто без обновления. */
    if ((string)($cfg['password_hash'] ?? '') === '' && is_writable($CONFIG)) {
        $cfg['password_hash'] = password_hash($pass, PASSWORD_DEFAULT);
        if (config_write($CONFIG, $cfg)) $cfg['password'] = '';
    }

    out(['ok' => true, 'token' => token_issue($TOKENS), 'ttl' => SESSION_TTL]);
}

if ($action === 'password') {
    if (!token_valid($TOKENS, token_from_request())) {
        out(['ok' => false, 'error' => 'Сессия истекла, войдите заново'], 401);
    }
    $b   = body();
    $old = (string)($b['old'] ?? '');
    $new = (string)($b['new'] ?? '');
    usleep(300000);

    if (!password_ok($cfg, $old)) {
        out(['ok' => false, 'error' => 'Текущий пароль не подошёл', 'field' => 'old'], 403);
    }
    if (mb_strlen($new) < MIN_PASSWORD) {
        out(['ok' => false, 'error' => 'Новый пароль короче ' . MIN_PASSWORD . ' символов', 'field' => 'new'], 400);
    }
    if ($new === $old) {
        out(['ok' => false, 'error' => 'Новый пароль совпадает со старым', 'field' => 'new'], 400);
    }
    if (!is_writable($CONFIG)) {
        out(['ok' => false, 'error' => 'Файл настроек защищён от записи. Поставьте config.php права 664 и повторите.'], 500);
    }

    $cfg['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
    $cfg['password']      = '';
    if (!config_write($CONFIG, $cfg)) {
        out(['ok' => false, 'error' => 'Не удалось сохранить новый пароль'], 500);
    }

    /* Все прежние сессии закрываем: если паролем кто-то успел
       воспользоваться, его вкладка перестаёт работать сразу. Себе выдаём
       новый токен, чтобы не выкидывать из админки того, кто менял. */
    @unlink($TOKENS);
    out(['ok' => true, 'token' => token_issue($TOKENS), 'ttl' => SESSION_TTL]);
}

if ($action === 'catalog') {
    if (!token_valid($TOKENS, token_from_request())) {
        out(['ok' => false, 'error' => 'Сессия истекла, войдите заново'], 401);
    }
    if (!is_file($FULL_FILE)) {
        // Полного каталога ещё нет — админка возьмёт то, что лежит в data.js.
        out(['ok' => true, 'data' => null]);
    }
    $j = json_decode((string)file_get_contents($FULL_FILE), true);
    out(['ok' => true, 'data' => is_array($j) ? $j : null]);
}


/* Телеграм стучится сюда сам, когда человек пишет боту. Задача одна:
   запомнить, кому слать заявки. Никаких chat_id руками — нажал «Старт»,
   и всё. Секрет в заголовке проверяем обязательно: адрес api.php публичный,
   и без проверки сюда мог бы написать кто угодно. */
if ($action === 'tg') {
    $secret = (string)($cfg['tg_secret'] ?? '');
    $got    = (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
    if ($secret === '' || !hash_equals($secret, $got)) out(['ok' => false], 403);

    $u   = body();
    $msg = $u['message'] ?? $u['edited_message'] ?? null;
    $chat = is_array($msg) ? ($msg['chat'] ?? null) : null;

    if (is_array($chat) && ($chat['type'] ?? '') === 'private') {
        $id    = (string)($chat['id'] ?? '');
        $text  = mb_strtolower(trim((string)($msg['text'] ?? '')));
        $title = trim(((string)($chat['first_name'] ?? '')) . ' ' . ((string)($chat['last_name'] ?? '')));
        if (($chat['username'] ?? '') !== '') $title .= ' (@' . $chat['username'] . ')';

        $list  = tg_chats($TG_CHATS);
        $token = (string)($cfg['tg_token'] ?? '');

        if ($text === '/stop' || $text === 'стоп') {
            unset($list[$id]);
            tg_chats_save($TG_CHATS, $list);
            tg_api($token, 'sendMessage', [
                'chat_id' => $id,
                'text'    => "Отключил. Заявки сюда больше не приходят.\nЧтобы вернуть — напиши /start.",
            ]);
        } elseif ($id !== '') {
            $first = !isset($list[$id]);
            $list[$id] = ['title' => trim($title), 'since' => date('c')];
            tg_chats_save($TG_CHATS, $list);
            tg_api($token, 'sendMessage', [
                'chat_id'    => $id,
                'parse_mode' => 'HTML',
                'text'       => $first
                    ? "✅ <b>Готово, всё подключено.</b>\n\nТеперь каждая заявка с сайта падает сюда: имя, контакт, что человеку нужно и когда он оставил заявку. Под заявкой будет кнопка, чтобы написать ему в один тап.\n\nСайт: cashmachine-store.ru\nОтключить уведомления — команда /stop."
                    : "Всё уже подключено — заявки приходят сюда. Отключить: /stop.",
            ]);
        }
    }
    out(['ok' => true]);
}

if ($action === 'save') {
    if (!token_valid($TOKENS, token_from_request())) {
        out(['ok' => false, 'error' => 'Сессия истекла, войдите заново'], 401);
    }
    $b = body();
    $data = $b['data'] ?? null;
    if (!is_array($data) || !isset($data['offers']) || !is_array($data['offers'])) {
        out(['ok' => false, 'error' => 'Каталог пустой или повреждён'], 400);
    }

    /* Страховка от потери выплат. Если админка почему-то не смогла забрать
       полный каталог (сессия истекла, сеть моргнула) и прислала офферы без
       внутренних полей, берём их из прошлой сохранённой версии по id.
       Без этого одно сохранение молча стирало бы все суммы. */
    $prev = is_file($FULL_FILE) ? json_decode((string)file_get_contents($FULL_FILE), true) : null;
    if (is_array($prev) && !empty($prev['offers']) && !empty($data['offers']) && is_array($data['offers'])) {
        $byId = [];
        foreach ($prev['offers'] as $po) {
            if (is_array($po) && isset($po['id'])) $byId[(string)$po['id']] = $po;
        }
        foreach ($data['offers'] as $i => $o) {
            if (!is_array($o) || !isset($o['id'])) continue;
            $old = $byId[(string)$o['id']] ?? null;
            if (!$old) continue;
            foreach (['payout', 'payFor'] as $k) {
                $incoming = isset($o[$k]) ? trim((string)$o[$k]) : '';
                if ($incoming === '' && trim((string)($old[$k] ?? '')) !== '') {
                    $data['offers'][$i][$k] = $old[$k];
                }
            }
        }
    }

    /* Полный каталог — с выплатами — ложится над корнем сайта: он нужен
       только админке. В data.js, который грузит браузер каждого посетителя,
       внутренние поля не попадают вовсе: на витрине их и так не показывают,
       а в файле их мог прочитать любой, кто откроет ссылку. */
    $full = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($full !== false && $FULL_FILE !== $DATA_FILE) {
        $t = $FULL_FILE . '.tmp';
        if (@file_put_contents($t, $full, LOCK_EX) !== false) { @rename($t, $FULL_FILE); @chmod($FULL_FILE, 0600); }
        else @unlink($t);
    }

    $public = $data;
    if (isset($public['offers']) && is_array($public['offers'])) {
        foreach ($public['offers'] as $i => $o) {
            if (!is_array($o)) continue;
            unset($o['payout'], $o['payFor']);
            $public['offers'][$i] = $o;
        }
    }

    $json = json_encode($public, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) out(['ok' => false, 'error' => 'Не удалось собрать каталог'], 500);

    $out = "/* Каталог витрины. Файл переписан админкой " . date('d.m.Y H:i') . ".\n"
         . "   Внутренние поля (выплата и за что платят) сюда не попадают —\n"
         . "   они хранятся отдельно и видны только в панели управления. */\n"
         . "window.SITE_DATA = " . $json . ";\n";

    // Бэкап предыдущей версии — на случай, если что-то улетело не то.
    if ($BACKUP_FILE && is_file($DATA_FILE)) @copy($DATA_FILE, $BACKUP_FILE);

    $tmp = $DATA_FILE . '.tmp';
    if (file_put_contents($tmp, $out, LOCK_EX) === false || !@rename($tmp, $DATA_FILE)) {
        @unlink($tmp);
        out(['ok' => false, 'error' => 'Нет прав на запись data.js. Поставьте файлу права 664.'], 500);
    }
    out(['ok' => true, 'updated' => date('Y-m-d H:i')]);
}

if ($action === 'lead') {
    $b = body();
    $name    = trim((string)($b['name'] ?? ''));
    $contact = trim((string)($b['contact'] ?? ''));
    $source  = trim((string)($b['source'] ?? ''));
    $comment = trim((string)($b['comment'] ?? ''));
    $trap    = trim((string)($b['company'] ?? '')); // honeypot

    if ($trap !== '') out(['ok' => true]); // бот — молча принимаем и никуда не пишем
    if ($name === '' || $contact === '') {
        out(['ok' => false, 'error' => 'Заполните имя и контакт'], 400);
    }
    if (mb_strlen($name) > 100 || mb_strlen($contact) > 120 || mb_strlen($comment) > 1500) {
        out(['ok' => false, 'error' => 'Слишком длинное значение'], 400);
    }

    $row = [date('Y-m-d H:i:s'), $name, $contact, $source, $comment, $_SERVER['REMOTE_ADDR'] ?? ''];

    $fh = @fopen($LEADS_FILE, 'a');
    if ($fh) {
        // $escape задаём явно: в PHP 8.4+ значение по умолчанию объявлено устаревшим.
        if (filesize($LEADS_FILE) === 0) {
            fwrite($fh, "\xEF\xBB\xBF"); // BOM, чтобы Excel не ломал кириллицу
            fputcsv($fh, ['Дата', 'Имя', 'Контакт', 'Источник трафика', 'Комментарий', 'IP'], ';', '"', '');
        }
        fputcsv($fh, $row, ';', '"', '');
        fclose($fh);
        @chmod($LEADS_FILE, 0600);
    }

    // Пересылка в Google-таблицу через веб-приложение Apps Script.
    $sheet = (string)($cfg['sheet_url'] ?? '');
    $sheetOk = null;
    if ($sheet !== '' && function_exists('curl_init')) {
        $ch = curl_init($sheet);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode([
                'date' => $row[0], 'name' => $name, 'contact' => $contact,
                'source' => $source, 'comment' => $comment,
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 8,
        ]);
        curl_exec($ch);
        $sheetOk = (curl_getinfo($ch, CURLINFO_HTTP_CODE) < 400);
        curl_close($ch);
    }

    /* Телеграм. Заявка должна читаться с одного взгляда: кто, как связаться,
       что нужно и когда пришло. Время — московское: клиент и его люди в РФ,
       а сервер живёт по своему часовому поясу. */
    $tgOk = null;
    $token = (string)($cfg['tg_token'] ?? '');
    if ($token !== '') tg_poll($token, $TG_CHATS, $TG_OFFSET);
    $chats = $token !== '' ? tg_chats($TG_CHATS) : [];
    if ($chats) {
        try {
            $when = (new DateTime('now', new DateTimeZone('Europe/Moscow')))->format('d.m.Y, H:i');
        } catch (Exception $e) {
            $when = date('d.m.Y, H:i');
        }

        $lines = [];
        $lines[] = '🟢 <b>Новая заявка с сайта</b>';
        $lines[] = '';
        $lines[] = '<b>Имя:</b> ' . tg_esc($name);
        $lines[] = '<b>Контакт:</b> ' . tg_esc($contact);
        if ($source  !== '') $lines[] = '<b>Что нужно:</b> ' . tg_esc($source);
        if ($comment !== '') $lines[] = '<b>Комментарий:</b> ' . tg_esc($comment);
        $lines[] = '';
        $lines[] = '<i>' . $when . ' МСК · cashmachine-store.ru</i>';

        /* Кнопка «Написать» — только когда контакт похож на ник или телефон:
           на мусорной строке она вела бы в никуда. */
        $kb = null;
        $c  = ltrim($contact, ' ');
        if (preg_match('~^@?([A-Za-z][A-Za-z0-9_]{4,31})$~', $c, $m)) {
            $kb = ['inline_keyboard' => [[['text' => '✍️ Написать в Telegram', 'url' => 'https://t.me/' . $m[1]]]]];
        } elseif (preg_match('~^\+?\d[\d\s\-()]{8,}$~', $c)) {
            $kb = ['inline_keyboard' => [[['text' => '📞 Позвонить', 'url' => 'tel:' . preg_replace('~[^\d+]~', '', $c)]]]];
        }

        $sent = 0;
        foreach (array_keys($chats) as $cid) {
            $payload = [
                'chat_id'    => $cid,
                'parse_mode' => 'HTML',
                'text'       => implode("\n", $lines),
                'disable_web_page_preview' => true,
            ];
            if ($kb) $payload['reply_markup'] = $kb;
            $r = tg_api($token, 'sendMessage', $payload);
            if ($r['code'] === 200) $sent++;
        }
        $tgOk = $sent > 0;
    }

    out(['ok' => true, 'sheet' => $sheetOk, 'tg' => $tgOk]);
}

out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
