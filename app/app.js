/* ÖZEN — приложение родителя (пилот). Все данные живут только в localStorage этого устройства. */
(function () {
  'use strict';
  var M = window.OZEN_METHOD, C = window.OZEN_CORE, CAT = window.OZEN_CATALOG;
  var KEY = 'ozen-app-v1';
  var MAIL = 'danaabilt@ozen.ink';
  var BOT = 'https://t.me/OZIkids_bot';
  var MINI = M.questions.filter(function (q) { return q.m; });
  var DRAFT = M.status !== 'approved';
  var ui = { cat: 'all', dist: 'all', more: 30, confirm: null, diaryAx: '', installEvt: null };

  /* ---------- состояние ---------- */
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fmt(iso) {
    if (!iso) { return ''; }
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
  }
  function daysSince(iso) { var p = iso.split('-'); return Math.floor((Date.now() - new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getTime()) / 864e5); }
  function rand(n) { var s = '', a = 'abcdefghjkmnpqrstuvwxyz23456789'; for (var i = 0; i < n; i++) { s += a.charAt(Math.floor(Math.random() * a.length)); } return s; }
  function fresh() { return { v: 1, consent: { ok: false, c1: false, c2: false, research: false, date: null }, children: [], active: null, mods: {}, created: today() }; }
  function newChild() {
    return { id: 'c' + Date.now().toString(36), pid: rand(8), year: '', district: '', interests: [], ans: {}, qi: 0, l1: null,
      status: 'new', verif: null, snaps: [], diary: [], ext: [], obs: {}, plan: {}, mini: null, miniCount: 0 };
  }
  function load() {
    try { var raw = window.localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); if (o && o.v === 1) { return o; } } } catch (e) { /* хранилище недоступно */ }
    return fresh();
  }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* работаем в памяти */ } }
  var S = load();
  function cur() {
    for (var i = 0; i < S.children.length; i++) { if (S.children[i].id === S.active) { return S.children[i]; } }
    return S.children[0] || null;
  }
  function childNo(c) { return S.children.indexOf(c) + 1; }
  function childLabel(c) { return 'Ребёнок ' + childNo(c) + (c.year ? ' · ' + c.year + ' г. р.' : ''); }

  /* ---------- расчёты ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function axis(key) { for (var i = 0; i < M.axes.length; i++) { if (M.axes[i].key === key) { return M.axes[i]; } } return null; }
  function obsDone(c) { var n = 0; M.observe.forEach(function (o) { if (c.obs[o.id] && c.obs[o.id].done) { n++; } }); return n; }
  /* Уверенность профиля: полнота анкеты + повторные оценки + дневник + наблюдение + внешние характеристики (допущение вместо D4). */
  function conf(c) {
    var parts = [
      ['Анкета родителя', Math.round(40 * C.answered(c.ans) / M.questions.length), C.answered(c.ans) + ' из ' + M.questions.length + ' ответов'],
      ['Повторные оценки', Math.min(20, 10 * c.miniCount), String(c.miniCount)],
      ['Дневник', Math.min(15, 3 * c.diary.length), c.diary.length + ' зап.'],
      ['Наблюдение вместе', Math.min(15, 5 * obsDone(c)), obsDone(c) + ' из ' + M.observe.length],
      ['Слова педагогов и специалистов', c.ext.length ? 10 : 0, c.ext.length ? 'есть' : 'нет']
    ];
    var pts = parts.reduce(function (a, p) { return a + p[1]; }, 0);
    var lvl = pts >= 90 ? 4 : (pts >= 70 ? 3 : (pts >= 50 ? 2 : 1));
    return { pts: pts, lvl: lvl, name: ['', 'начальная', 'базовая', 'уверенная', 'высокая'][lvl], parts: parts };
  }
  function pushSnap(c, kind) { c.snaps.push({ d: today(), k: kind, idx: C.indices(c.ans), fl: C.flags(c.ans), lvl: conf(c).lvl }); }
  function weekNo() {
    var d = new Date(), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { y: t.getUTCFullYear(), w: Math.ceil(((t - y0) / 864e5 + 1) / 7) };
  }
  function suggest(c) {
    var subs = {};
    c.interests.forEach(function (i) { (M.interests[i] ? M.interests[i][1] : []).forEach(function (s) { subs[s] = 1; }); });
    var list = CAT.items.filter(function (x) { return subs[x[3]]; });
    if (c.district) { list.sort(function (a, b) { return (b[4] === c.district) - (a[4] === c.district); }); }
    return list;
  }
  function planItems(c) {
    var wk = weekNo(), idx = C.indices(c.ans), items = [];
    var order = [0, 1, 2, 3].filter(function (i) { return idx[i] !== null; }).sort(function (a, b) { return idx[b] - idx[a]; });
    if (order.length) {
      var hi = C.AX4[order[0]], lo = C.AX4[order[order.length - 1]];
      items.push({ id: 's' + hi, k: 'Опора на сильное · ' + axis(hi).short, t: M.actions[hi][wk.w % 2] });
      if (lo !== hi) { items.push({ id: 'p' + lo, k: 'Поддержка · ' + axis(lo).short, t: M.actions[lo][(wk.w + 1) % 2] }); }
    }
    var sug = suggest(c);
    if (c.district) { var near = sug.filter(function (x) { return x[4] === c.district; }); if (near.length) { sug = near; } }
    if (sug.length) { var x = sug[wk.w % sug.length]; items.push({ id: 'c' + x[0], k: 'Куда сходить', t: 'Узнайте о пробном занятии: ' + x[1] + ' (' + x[3] + ')' }); }
    var ob = M.observe.filter(function (o) { return !(c.obs[o.id] && c.obs[o.id].done); })[0];
    if (ob) { items.push({ id: ob.id, k: 'Наблюдение вместе · ' + ob.time, t: ob.title + '. ' + ob.todo }); }
    return items;
  }
  function planKey() { var w = weekNo(); return w.y + '-' + w.w; }
  function miniDue(c) { return c.status === 'open' && c.snaps.length && daysSince(c.snaps[c.snaps.length - 1].d) >= M.miniEveryDays; }

  /* ---------- куски интерфейса ---------- */
  function draftNote() { return DRAFT ? '<div class="note">Методика в статусе «' + esc(M.version) + '»: вопросы и тексты ещё не утверждены методологом.</div>' : ''; }
  function back(view, label) { return '<button class="link" data-go="' + view + '">' + (label || 'Назад') + '</button>'; }
  function segs(n) { var s = ''; for (var i = 1; i <= 4; i++) { s += '<i' + (i <= n ? ' class="on"' : '') + '></i>'; } return '<div class="segs">' + s + '</div>'; }
  function row(view, title, sub) {
    return '<button class="row" data-go="' + view + '"><div><b>' + title + '</b>' + (sub ? '<div class="mute">' + sub + '</div>' : '') + '</div><span class="arr">›</span></button>';
  }
  function bandWord(v) { var b = C.band(v); return b ? M.texts.K[b][0] : 'Нет ответов'; }
  function confirmBtn(act, label, sure) {
    return '<button class="btn warn" data-act="' + act + '">' + (ui.confirm === act ? (sure || 'Нажмите ещё раз, чтобы подтвердить') : label) + '</button>';
  }

  /* ---------- экраны ---------- */
  var V = {};

  V.intro = function () {
    return '<h1 class="big">Карта, а не рейтинг</h1>' +
      '<p style="font-size:17px">ÖZEN помогает родителю увидеть целостный профиль ребёнка 10–14 лет и понять, что делать дальше.</p>' +
      '<div class="card"><b>Как это устроено</b>' +
      '<p>На вопросы отвечаете вы. Ребёнок ничего не проходит и в приложение не входит.</p>' +
      '<p>Общего балла и сравнения с другими детьми здесь нет.</p>' +
      '<p>Черновик профиля сначала смотрит специалист, и только потом он открывается вам.</p></div>' +
      '<div class="card"><b>Где хранятся данные</b>' +
      '<p>Только на этом устройстве. Регистрации и аккаунта нет, на сервер ничего не уходит.</p>' +
      '<p class="mute">Специалисту вы сами отправляете код черновика: в нём год рождения, интересы и ответы, без имён и контактов.</p></div>' +
      '<div class="grow"></div>' +
      '<button class="btn" data-go="consent">Начать</button>' +
      '<p class="small" style="text-align:center">Пилотная версия · часть экосистемы OZI<span class="gold">.</span>ÖZEN · Астана</p>';
  };

  V.consent = function () {
    var k = S.consent, blocked = !(k.c1 && k.c2);
    return '<h1>Согласие</h1>' +
      '<p>Данные о ребёнке принадлежат семье. Их можно выгрузить и удалить в любой момент в настройках.</p>' +
      '<label class="chk"><input type="checkbox" data-ch="c1"' + (k.c1 ? ' checked' : '') + '><span>Согласен(на), что мои ответы хранятся на этом устройстве и используются для построения профиля. <span class="mute">Обязательно</span></span></label>' +
      '<label class="chk"><input type="checkbox" data-ch="c2"' + (k.c2 ? ' checked' : '') + '><span>Понимаю, что ÖZEN не ставит диагнозов и не заменяет специалиста. <span class="mute">Обязательно</span></span></label>' +
      '<label class="chk"><input type="checkbox" data-ch="research"' + (k.research ? ' checked' : '') + '><span>Готов(а) делиться обезличенными ответами для исследования. <span class="mute">По желанию</span></span></label>' +
      '<p class="small">[Юридический текст согласия по Закону РК о персональных данных утверждается перед пилотом.]</p>' +
      '<div class="grow"></div>' +
      '<button class="btn" data-act="consentOk"' + (blocked ? ' disabled' : '') + '>Продолжить</button>' + back('intro');
  };

  V.child = function () {
    var c = cur(), y = new Date().getFullYear(), years = [];
    for (var a = 10; a <= 14; a++) { years.push(String(y - a)); }
    var yo = '<option value="">Выберите год</option>' + years.map(function (v) { return '<option' + (c.year === v ? ' selected' : '') + '>' + v + '</option>'; }).join('');
    var dopt = '<option value="">Не указывать</option>' + Object.keys(M.districts).map(function (k) { return '<option value="' + k + '"' + (c.district === k ? ' selected' : '') + '>' + M.districts[k] + '</option>'; }).join('');
    var chips = M.interests.map(function (it, i) { return '<button type="button" class="chip" data-act="interest" data-arg="' + i + '" aria-pressed="' + (c.interests.indexOf(i) >= 0) + '">' + it[0] + '</button>'; }).join('');
    return '<h1>Профиль ребёнка</h1>' +
      '<p>Имя, фото и точную дату рождения не спрашиваем.</p>' +
      '<label class="f">Год рождения<select data-ch="year">' + yo + '</select></label>' +
      '<p class="small">Сейчас ÖZEN рассчитан на возраст 10–14 лет.</p>' +
      '<div><p style="font-weight:500;font-size:14px;margin-bottom:10px">Чем ребёнок интересуется сейчас</p><div class="chips">' + chips + '</div></div>' +
      '<label class="f">Район Астаны<select data-ch="district">' + dopt + '</select></label>' +
      '<p class="small">Район нужен только для подбора центров в маршруте.</p>' +
      '<div class="grow"></div>' +
      '<button class="btn" data-go="home"' + (c.year ? '' : ' disabled') + '>Готово</button>';
  };

  V.home = function () {
    var c = cur(), n = C.answered(c.ans), h = '<div><h1>' + childLabel(c) + '</h1></div>';
    if (c.status === 'new') {
      var started = n > 0 || c.qi > 0;
      return h + '<div class="card"><b>Анкета родителя</b>' +
        '<p>' + M.questions.length + ' вопросов о том, каким вы видите ребёнка. Занимает 10–12 минут, можно прерваться и продолжить.</p>' +
        (started ? '<div class="bar"><i style="width:' + Math.round(c.qi / M.questions.length * 100) + '%"></i></div><p class="small">Пройдено ' + c.qi + ' из ' + M.questions.length + '</p>' : '') +
        '<button class="btn" data-go="quiz">' + (started ? 'Продолжить' : 'Начать анкету') + '</button></div>' + draftNote() +
        '<div class="rows">' + row('diary', 'Дневник наблюдений', 'Можно вести уже сейчас') + row('modules', 'Короткие уроки для родителя', '4 текста по 3–4 минуты') + '</div>';
    }
    if (c.status === 'ready' || c.status === 'sent') {
      return h + '<div class="card steps">' +
        '<div><span class="dot"></span><span>Анкета заполнена</span></div>' +
        '<div><span class="dot"></span><span>Черновик профиля собран</span></div>' +
        '<div><span class="dot cur"></span><b>' + (c.status === 'sent' ? 'Черновик у специалиста' : 'Нужно отправить специалисту') + '</b></div>' +
        '<div><span class="dot off"></span><span class="mute">Профиль открыт семье</span></div></div>' +
        '<p>Профиль не показывается, пока его не посмотрит специалист ÖZEN. Так устроено намеренно.</p>' +
        '<button class="btn" data-go="review">' + (c.status === 'sent' ? 'Ввести код открытия' : 'Отправить специалисту') + '</button>' +
        '<div class="rows">' + row('diary', 'Дневник наблюдений', 'Записи повышают уверенность профиля') + row('observe', 'Наблюдение вместе', 'Задания с ребёнком, не тест') + '</div>';
    }
    var idx = C.indices(c.ans), cf = conf(c), fl = C.flags(c.ans);
    var rows = C.AX4.map(function (k, i) { return '<div class="row"><div><b>' + axis(k).name + '</b><div class="mute">' + bandWord(idx[i]) + '</div></div></div>'; }).join('') +
      '<div class="row"><div><b>Зона внимания</b><div class="mute">' + (fl ? 'Отметок: ' + fl + '. Без баллов и ярлыков' : 'Отметок нет') + '</div></div></div>' +
      '<div class="row"><div><b>Зона потенциала</b><div class="mute">' + (c.verif && c.verif.l && c.verif.l.length ? esc(c.verif.l.join(' · ')) : 'Определит специалист') + '</div></div></div>';
    return h +
      (miniDue(c) ? '<div class="card pot"><b>Пора обновить профиль</b><p class="mute">С прошлой оценки прошло больше четырёх недель. Десять вопросов, три минуты.</p><button class="btn ghost" data-act="miniStart">Пройти мини-оценку</button></div>' : '') +
      '<div class="card" style="padding:6px">' + C.hexSvg(idx) + '</div>' +
      '<p class="small">Фигура показывает, насколько заметно проявляется каждая сторона. Дальше от центра не значит «лучше». Общего балла нет.</p>' +
      '<div class="rows">' + rows + '</div>' +
      '<div class="card"><b>Уверенность профиля: ' + cf.name + '</b>' + segs(cf.lvl) +
      '<p class="mute">Чем больше источников, тем точнее профиль: дневник, наблюдение вместе, повторные оценки, слова педагогов.</p></div>' +
      (C.level(fl) >= 2 ? '<div class="card att"><b>Есть зоны внимания</b><p style="font-size:14px">Некоторые наблюдения стоит обсудить со специалистом. Это не оценка и не диагноз.</p><button class="btn ghost" data-go="help">Куда обратиться</button></div>' : '') +
      '<button class="btn" data-go="full">Полный профиль</button>' +
      '<button class="btn ghost" data-go="route">Маршрут развития</button>';
  };

  function quizView(mode) {
    var c = cur(), list = mode === 'mini' ? MINI : M.questions, st = mode === 'mini' ? c.mini : c;
    var qi = Math.min(st.qi, list.length - 1), q = list[qi];
    var labels = q.t === 'c' ? q.o.map(function (o) { return o[0]; }) : (q.t === 'f' ? M.freq : M.likert);
    var hint = q.t === 'f' ? 'За последний месяц ребёнок…' : (q.t === 'c' ? 'Выберите самое близкое' : 'Насколько это похоже на вашего ребёнка');
    var opts = labels.map(function (l, i) { return '<button type="button" class="opt" data-act="ans" data-arg="' + (i + 1) + '" aria-pressed="' + (st.ans[q.id] === i + 1) + '">' + l + '</button>'; }).join('');
    return '<div><div style="display:flex;justify-content:space-between;gap:10px" class="small"><span>' + axis(q.ax).name + '</span><span>' + (qi + 1) + ' из ' + list.length + '</span></div>' +
      '<div class="bar" style="margin-top:8px"><i style="width:' + Math.round(qi / list.length * 100) + '%"></i></div></div>' +
      (qi === 0 ? draftNote() : '') +
      '<p class="small">' + hint + '</p><p class="q">' + q.q + '</p><div class="opts">' + opts + '</div>' +
      '<div class="grow"></div>' +
      '<button class="link" data-act="skip">Не знаю, пропустить</button>' +
      '<button class="link" data-act="qback">' + (qi === 0 ? 'Выйти, ответы сохранятся' : 'Назад') + '</button>';
  }
  V.quiz = function () { return quizView('l1'); };
  V.mini = function () { return cur().mini ? quizView('mini') : V.home(); };

  V.help = function (arg) {
    var c = cur(), lv = c ? C.level(C.flags(c.ans)) : 0;
    var list = M.help.map(function (x) {
      return '<div class="card"><a class="help-n" href="tel:' + x.n + '">' + x.n + '</a><b>' + x.t + '</b><p class="mute">' + x.d + '</p></div>';
    }).join('');
    return '<h1>Помощь</h1>' +
      (arg === 'after' ? '<p>В ваших ответах есть наблюдения, которые повторяются часто. Это не оценка и не диагноз: приложение их не толкует.</p>' : '') +
      (lv >= 2 ? '<div class="card att"><b>Что стоит сделать</b><p style="font-size:14px">Обсудите эти наблюдения со специалистом: школьным психологом, педиатром или детским психологом. Возьмите с собой записи из дневника.</p></div>' : '<p>Если вас что-то тревожит в состоянии ребёнка, не ждите результатов профиля. Поговорите со школьным психологом или педиатром.</p>') +
      (lv >= 3 ? '<p><b>Если есть угроза жизни или здоровью, звоните 112.</b></p>' : '') +
      '<h2>Куда можно позвонить в Казахстане</h2>' + list +
      '<p class="small">Контакты сверены по открытым источникам ' + fmt(CAT.date) + '. ÖZEN не оказывает экстренную помощь.</p>' +
      (arg === 'after' ? '<button class="btn" data-go="review">Продолжить</button>' : back('more'));
  };

  V.review = function () {
    var c = cur();
    if (c.status === 'new') { return V.home(); }
    var code = C.packProfile(c);
    var mail = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('ÖZEN пилот — черновик профиля') + '&body=' + encodeURIComponent('Код черновика:\n\n' + code);
    return '<h1>Проверка специалистом</h1>' +
      '<p>Отправьте код черновика специалисту ÖZEN. В ответ придёт код открытия, и профиль станет доступен.</p>' +
      '<div class="card"><b>1. Код черновика</b>' +
      '<p class="mute">Внутри: год рождения, интересы и ответы анкеты. Имён, телефонов и адресов в нём нет.</p>' +
      '<textarea class="code" id="pcode" readonly rows="4">' + code + '</textarea>' +
      '<button class="btn ghost" data-act="copy">Скопировать код</button>' +
      '<a class="btn ghost" href="' + mail + '" data-act="sent">Отправить письмом</a>' +
      '<p class="small">Адрес: ' + MAIL + '</p></div>' +
      '<div class="card"><b>2. Код открытия</b>' +
      '<p class="mute">Вставьте код, который прислал специалист.</p>' +
      '<textarea class="code" id="ocode" rows="3" placeholder="OZO1…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>' +
      '<button class="btn" data-act="unlock">Открыть профиль</button></div>' +
      (c.status === 'open' ? '<p class="small">Профиль уже открыт ' + fmt(c.verif.date) + '.</p>' : '') + back('home');
  };

  V.full = function () {
    var c = cur();
    if (c.status !== 'open') { return V.home(); }
    var idx = C.indices(c.ans), fl = C.flags(c.ans), v = c.verif || {};
    var cards = C.AX4.map(function (k, i) {
      var b = C.band(idx[i]), a = axis(k), t = b ? M.texts[k][b] : null;
      var pills = C.cats(c.ans, k).map(function (x) { return '<span class="pill">' + x + '</span>'; }).join('');
      return '<div class="card"><div><b>' + a.name + '</b><div class="small">' + a.about + '</div></div>' +
        (t ? '<p><span class="pill g">' + t[0] + '</span></p><p>' + t[1] + '</p>' + (pills ? '<div class="pills">' + pills + '</div>' : '') +
          '<p class="mute"><b>Что поддерживает.</b> ' + t[2] + '</p>' : '<p class="mute">На вопросы этой оси нет ответов.</p>') + '</div>';
    }).join('');
    var pot = v.l && v.l.length
      ? '<div class="pills">' + v.l.map(function (x) { return '<span class="pill g">' + esc(x) + '</span>'; }).join('') + '</div>' +
        (v.v ? '<p><b>Вектор.</b> ' + esc(v.v) + '</p>' : '') + (v.n ? '<p class="mute">' + esc(v.n) + '</p>' : '')
      : '<p class="mute">Специалист пока не описал линии потенциала.</p>';
    return '<h1>Полный профиль</h1><p class="mute">' + childLabel(c) + ' · проверен специалистом ' + fmt(v.date) + '</p>' + draftNote() + cards +
      '<div class="card att"><div><b>Зона внимания</b><div class="small">' + axis('A').about + '</div></div>' +
      '<p>' + (fl ? 'Часто повторяющихся наблюдений: ' + fl + '.' : 'Часто повторяющихся наблюдений нет.') + '</p>' +
      (fl ? '<button class="btn ghost" data-go="help">Куда обратиться</button>' : '') + '</div>' +
      '<div class="card pot"><div><b>Зона потенциала</b><div class="small">' + axis('P').about + '</div></div>' + pot + '</div>' +
      '<div class="rows">' + row('history', 'История развития', c.snaps.length + ' ' + (c.snaps.length === 1 ? 'снимок' : 'снимков')) + row('route', 'Маршрут развития', 'План недели и куда сходить') + '</div>' + back('home');
  };

  V.route = function () {
    var c = cur();
    if (c.status !== 'open') {
      return '<h1>Маршрут развития</h1><div class="card"><b>Маршрут откроется вместе с профилем</b><p class="mute">Он строится из профиля, который подтвердил специалист. Пока можно посмотреть каталог центров.</p></div>' +
        '<div class="rows">' + row('catalog', 'Каталог центров Астаны', CAT.items.length + ' центров из базы OZI') + '</div>';
    }
    var key = planKey(), done = c.plan[key] || {}, items = planItems(c), v = c.verif || {};
    var tasks = items.map(function (it) {
      return '<label class="task"><input type="checkbox" data-ch="plan" data-arg="' + it.id + '"' + (done[it.id] ? ' checked' : '') + '><span><small>' + it.k + '</small>' + esc(it.t) + '</span></label>';
    }).join('');
    var sug = suggest(c).slice(0, 3).map(centerCard).join('');
    return '<h1>Маршрут развития</h1>' +
      (v.l && v.l.length ? '<div class="card pot"><b>Линии потенциала</b><div class="pills">' + v.l.map(function (x) { return '<span class="pill g">' + esc(x) + '</span>'; }).join('') + '</div>' + (v.v ? '<p>' + esc(v.v) + '</p>' : '') + '</div>' : '') +
      '<div class="card"><b>План на эту неделю</b><p class="small">Обновляется каждый понедельник. Достаточно одного шага.</p>' + tasks + '</div>' +
      '<h2>Куда сходить</h2>' +
      (sug || '<p class="mute">Отметьте интересы ребёнка в его профиле, и здесь появятся подходящие центры.</p>') +
      '<div class="rows">' + row('catalog', 'Весь каталог', CAT.items.length + ' центров из базы OZI') + row('observe', 'Наблюдение вместе', obsDone(c) + ' из ' + M.observe.length + ' выполнено') + '</div>';
  };

  function centerCard(x) {
    return '<div class="entry"><b>' + esc(x[1]) + '</b><div class="mute">' + esc(x[3]) + ' · ' + (M.districts[x[4]] || '') + '</div>' +
      '<div class="small">' + esc(x[5]) + '</div><div class="top"><span>Кандидат · верификация идёт</span><a href="' + BOT + '" target="_blank" rel="noopener">Найти в OZI-боте</a></div></div>';
  }
  V.catalog = function () {
    var cats = [['all', 'Все']].concat(Object.keys(M.categories).map(function (k) { return [k, M.categories[k]]; }));
    var chips = cats.map(function (k) { return '<button type="button" class="chip" data-act="cat" data-arg="' + k[0] + '" aria-pressed="' + (ui.cat === k[0]) + '">' + k[1] + '</button>'; }).join('');
    var dopt = '<option value="all">Все районы</option>' + Object.keys(M.districts).map(function (k) { return '<option value="' + k + '"' + (ui.dist === k ? ' selected' : '') + '>' + M.districts[k] + '</option>'; }).join('');
    var list = CAT.items.filter(function (x) { return (ui.cat === 'all' || x[2] === ui.cat) && (ui.dist === 'all' || x[4] === ui.dist); });
    return '<h1>Каталог центров</h1>' +
      '<p class="mute">' + CAT.items.length + ' центров Астаны из базы OZI. Данные собраны из открытых источников, верификация идёт. Контакты и запись — в OZI-боте.</p>' +
      '<div class="chips">' + chips + '</div><select data-ch="dist" aria-label="Район">' + dopt + '</select>' +
      '<p class="small">Найдено: ' + list.length + '</p>' + list.slice(0, ui.more).map(centerCard).join('') +
      (list.length > ui.more ? '<button class="btn ghost" data-act="moreCat">Показать ещё</button>' : '') +
      '<a class="btn" href="' + BOT + '" target="_blank" rel="noopener">Открыть OZI-бот</a>' + back('route');
  };

  V.diary = function () {
    var c = cur();
    var chips = C.AX4.map(function (k) { return '<button type="button" class="chip" data-act="dax" data-arg="' + k + '" aria-pressed="' + (ui.diaryAx === k) + '">' + axis(k).short + '</button>'; }).join('');
    var list = c.diary.slice().reverse().map(function (e) {
      return '<div class="entry"><div class="top"><span>' + fmt(e.d) + (e.ax ? ' · ' + axis(e.ax).short : '') + '</span><button class="x" data-act="delDiary" data-arg="' + e.id + '">Удалить</button></div><p>' + esc(e.t) + '</p></div>';
    }).join('');
    var ext = c.ext.slice().reverse().map(function (e) {
      return '<div class="entry"><div class="top"><span>' + fmt(e.d) + ' · ' + esc(e.s) + '</span><button class="x" data-act="delExt" data-arg="' + e.id + '">Удалить</button></div><p>' + esc(e.t) + '</p></div>';
    }).join('');
    return '<h1>Дневник</h1>' +
      '<div class="card"><b>Новая запись</b><p class="small">Что произошло, без оценок. Имена и названия школы не нужны.</p>' +
      '<textarea id="dtext" placeholder="Например: сорок минут собирал модель и не просил помочь."></textarea>' +
      '<div class="chips">' + chips + '</div><button class="btn" data-act="addDiary">Сохранить</button></div>' +
      (list || '<p class="mute">Записей пока нет. Одна запись в неделю уже делает профиль точнее.</p>') +
      '<h2>Слова педагогов и специалистов</h2>' +
      '<div class="card"><p class="small">Перескажите своими словами, что о ребёнке говорят учитель, тренер или психолог. Это контекст, а не диагноз.</p>' +
      '<select id="esrc"><option>Учитель</option><option>Тренер или педагог кружка</option><option>Психолог</option><option>Другой взрослый</option></select>' +
      '<textarea id="etext" placeholder="Например: тренер говорит, что на тренировках он первым помогает новичкам."></textarea>' +
      '<button class="btn ghost" data-act="addExt">Добавить</button></div>' + ext +
      '<p class="small">Фото и голосовые заметки в этой версии не сохраняются.</p>';
  };

  V.observe = function () {
    var c = cur();
    var cards = M.observe.map(function (o) {
      var st = c.obs[o.id] || {};
      return '<div class="card"><div><b>' + o.title + '</b><div class="small">' + axis(o.ax).name + ' · ' + o.time + (st.done ? ' · выполнено ' + fmt(st.d) : '') + '</div></div>' +
        '<p>' + o.todo + '</p><p class="mute"><b>На что смотреть.</b> ' + o.look.join(' ') + '</p>' +
        '<textarea data-obs="' + o.id + '" placeholder="Что вы заметили">' + esc(st.note || '') + '</textarea>' +
        '<button class="btn ghost" data-act="obs" data-arg="' + o.id + '">' + (st.done ? 'Сохранить заметку' : 'Сохранить и отметить выполненным') + '</button></div>';
    }).join('');
    return '<h1>Наблюдение вместе</h1><p>Задания, которые вы делаете вместе с ребёнком. Это не тест: ребёнка никто не оценивает, вы просто смотрите внимательнее.</p>' + cards + back('route');
  };

  V.history = function () {
    var c = cur();
    var list = c.snaps.slice().reverse().map(function (s) {
      var words = C.AX4.map(function (k, i) { return axis(k).short + ': ' + bandWord(s.idx[i]).replace('Проявляется ', ''); }).join(' · ');
      return '<div class="tl"><div class="hx">' + C.hexSvg(s.idx, { small: true }) + '</div><div><b>' + fmt(s.d) + '</b><div class="small">' + (s.k === 'mini' ? 'Мини-оценка' : 'Анкета родителя') + ' · уверенность ' + ['', 'начальная', 'базовая', 'уверенная', 'высокая'][s.lvl] + '</div><div class="mute">' + words + '</div></div></div>';
    }).join('');
    return '<h1>История развития</h1><p class="mute">Снимки профиля по датам. Сравнивать можно только ребёнка с самим собой.</p>' +
      (list || '<p class="mute">Снимков пока нет.</p>') +
      (c.status === 'open' ? '<button class="btn ghost" data-act="miniStart">Пройти мини-оценку</button>' : '') + back('more');
  };

  V.more = function () {
    var c = cur();
    return '<h1>Ещё</h1><div class="rows">' +
      row('children', 'Дети', S.children.length + ' ' + (S.children.length === 1 ? 'профиль' : 'профиля') + ' · сейчас: ' + childLabel(c)) +
      row('history', 'История развития', 'Снимки профиля по датам') +
      row('observe', 'Наблюдение вместе', 'Задания с ребёнком') +
      row('modules', 'Уроки для родителя', Object.keys(S.mods).length + ' из ' + M.modules.length + ' прочитано') +
      row('help', 'Помощь', 'Куда обратиться') +
      '</div><div class="rows">' +
      row('companion', 'Навигатор', 'ИИ-помощник · пока не подключён') +
      row('premium', 'ÖZEN Premium', 'В пилоте доступ открыт бесплатно') +
      row('settings', 'Настройки и приватность', 'Выгрузка, удаление, согласия') +
      row('about', 'О приложении', 'Версия и методика') + '</div>' +
      (ui.installEvt ? '<button class="btn ghost" data-act="install">Установить на главный экран</button>' : '<p class="small">Чтобы установить приложение, откройте меню браузера и выберите «На экран Домой» или «Установить».</p>');
  };

  V.companion = function () {
    return '<h1>Навигатор</h1><div class="card"><b>ИИ-помощник пока не подключён</b>' +
      '<p>Навигатор будет отвечать на вопросы о профиле и маршруте. Он появится после того, как заработает серверная защита и пройдут проверки безопасности.</p>' +
      '<p class="mute">Правила, которые уже зафиксированы: он не ставит диагнозов, не толкует зону внимания и не общается с ребёнком.</p></div>' + back('more');
  };
  V.premium = function () {
    return '<h1>ÖZEN Premium</h1><div class="card pot"><b>В пилоте всё открыто бесплатно</b>' +
      '<p>Полный профиль, маршрут, дневник, история, уроки и повторные оценки доступны участникам пилота без оплаты.</p>' +
      '<p class="mute">Оплаты в приложении нет. Подписка появится после пилота.</p></div>' + back('more');
  };
  V.about = function () {
    return '<h1>О приложении</h1><div class="card"><b>ÖZEN · пилотная версия</b>' +
      '<p>Профиль ребёнка 10–14 лет глазами родителя: шесть осей без общего балла, проверка специалистом, маршрут развития.</p>' +
      '<p class="mute">Методика: ' + esc(M.version) + '. Каталог центров: база OZI на ' + fmt(CAT.date) + ', ' + CAT.items.length + ' центров, верификация идёт.</p>' +
      '<p class="mute">ÖZEN не является медицинским или психологическим сервисом и не ставит диагнозов.</p></div>' +
      '<div class="rows"><a class="row" href="https://ozen.ink"><div><b>Сайт проекта</b><div class="mute">ozen.ink</div></div><span class="arr">›</span></a>' +
      '<a class="row" href="' + BOT + '" target="_blank" rel="noopener"><div><b>OZI-бот</b><div class="mute">Навигатор детских центров Астаны</div></div><span class="arr">›</span></a></div>' + back('more');
  };

  V.modules = function () {
    return '<h1>Уроки для родителя</h1><div class="rows">' + M.modules.map(function (m) {
      return row('module/' + m.id, m.title, m.min + ' мин' + (S.mods[m.id] ? ' · прочитано' : ''));
    }).join('') + '</div>' + draftNote() + back('more');
  };
  V.module = function (id) {
    var m = M.modules.filter(function (x) { return x.id === id; })[0];
    if (!m) { return V.modules(); }
    return '<h1>' + m.title + '</h1>' + m.body.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      '<div class="grow"></div><button class="btn" data-act="modDone" data-arg="' + m.id + '">' + (S.mods[m.id] ? 'К списку уроков' : 'Прочитано') + '</button>';
  };

  V.children = function () {
    var list = S.children.map(function (c) {
      var st = { 'new': 'анкета не завершена', ready: 'ждёт отправки специалисту', sent: 'у специалиста', open: 'профиль открыт' }[c.status];
      return '<button class="row" data-act="pick" data-arg="' + c.id + '"><div><b>' + childLabel(c) + (c.id === cur().id ? ' ✓' : '') + '</b><div class="mute">' + st + '</div></div><span class="arr">›</span></button>';
    }).join('');
    return '<h1>Дети</h1><div class="rows">' + list + '</div>' +
      '<button class="btn ghost" data-go="child">Изменить год, район и интересы</button>' +
      (S.children.length < 5 ? '<button class="btn ghost" data-act="addChild">Добавить ребёнка</button>' : '') + back('more');
  };

  V.settings = function () {
    var c = cur();
    return '<h1>Настройки и приватность</h1>' +
      '<div class="card"><b>Ваши данные</b><p class="mute">Всё хранится только на этом устройстве. Если удалить приложение или очистить данные браузера, они исчезнут.</p>' +
      '<button class="btn ghost" data-act="export">Выгрузить все данные файлом</button></div>' +
      '<div class="card"><b>Согласия</b><p class="mute">Приняты ' + fmt(S.consent.date) + '.</p>' +
      '<label class="chk"><input type="checkbox" data-ch="research"' + (S.consent.research ? ' checked' : '') + '><span>Делиться обезличенными ответами для исследования</span></label>' +
      '<p class="small">Сейчас приложение ничего не отправляет само. Отметка понадобится, когда появится серверная часть.</p></div>' +
      '<div class="card"><b>Язык</b><p class="mute">Русский. Казахский и английский появятся позже.</p></div>' +
      '<div class="card"><b>Удаление</b>' +
      confirmBtn('delChild', 'Удалить данные: ' + childLabel(c)) +
      confirmBtn('delAll', 'Отозвать согласие и удалить всё') + '</div>' + back('more');
  };

  /* ---------- маршрутизация ---------- */
  var TABS = [['home', 'Профиль', 'M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z'], ['route', 'Маршрут', 'M12 3a9 9 0 100 18 9 9 0 000-18zm3.5 5.5l-2 5-5 2 2-5z'], ['diary', 'Дневник', 'M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4'], ['more', 'Ещё', 'M5 12h.01M12 12h.01M19 12h.01']];
  var TAB_OF = { home: 'home', full: 'home', review: 'home', route: 'route', catalog: 'route', observe: 'route', diary: 'diary' };
  var app = document.getElementById('app'), tabs = document.getElementById('tabs'), who = document.getElementById('who');

  function parse() { var p = (window.location.hash || '').replace(/^#\/?/, '').split('/'); return { view: p[0] || 'home', arg: p[1] || '' }; }
  function go(view, arg) {
    var h = '#/' + view + (arg ? '/' + arg : '');
    if (window.location.hash === h) { render(); } else { window.location.hash = h; }
  }
  function render() {
    var r = parse(), c = cur();
    if (!S.consent.ok) { if (r.view !== 'consent') { r = { view: 'intro', arg: '' }; } }
    else if (!c) { S.children.push(newChild()); S.active = S.children[0].id; c = cur(); r = { view: 'child', arg: '' }; }
    else if (!c.year) { r = { view: 'child', arg: '' }; }
    else if (!V[r.view] || r.view === 'intro' || r.view === 'consent') { r = { view: 'home', arg: '' }; }
    if (c && c.year && ((r.view === 'quiz' && c.status !== 'new') || (r.view === 'mini' && !c.mini))) { r = { view: 'home', arg: '' }; }
    app.innerHTML = V[r.view](r.arg);
    var bare = !S.consent.ok || !c || !c.year || r.view === 'quiz' || r.view === 'mini' || r.view === 'child';
    tabs.hidden = bare;
    if (!bare) {
      var on = TAB_OF[r.view] || 'more';
      tabs.innerHTML = TABS.map(function (t) {
        return '<button data-go="' + t[0] + '"' + (on === t[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + t[2] + '"/></svg>' + t[1] + '</button>';
      }).join('');
    }
    who.textContent = c && c.year && S.consent.ok ? childLabel(c) : '';
    window.scrollTo(0, 0);
    save();
  }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); window.setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- действия ---------- */
  function quizState() { var c = cur(), mini = parse().view === 'mini'; return { c: c, mini: mini, list: mini ? MINI : M.questions, st: mini ? c.mini : c }; }
  function quizNext(z) {
    if (z.st.qi + 1 < z.list.length) { z.st.qi += 1; render(); return; }
    var c = z.c;
    if (z.mini) {
      Object.keys(c.mini.ans).forEach(function (k) { c.ans[k] = c.mini.ans[k]; });
      c.mini = null; c.miniCount += 1; pushSnap(c, 'mini'); save();
      go(C.level(C.flags(c.ans)) >= 2 ? 'help' : 'home'); toast('Профиль обновлён');
      return;
    }
    c.qi = z.list.length; c.l1 = today(); c.status = 'ready'; pushSnap(c, 'l1'); save();
    if (C.level(C.flags(c.ans)) >= 2) { go('help', 'after'); } else { go('review'); }
  }
  var ACT = {
    consentOk: function () { S.consent.ok = true; S.consent.date = today(); go('child'); },
    interest: function (a, el) {
      var c = cur(), i = Number(a), p = c.interests.indexOf(i);
      if (p >= 0) { c.interests.splice(p, 1); } else { c.interests.push(i); }
      el.setAttribute('aria-pressed', String(p < 0)); save();
    },
    ans: function (a) { var z = quizState(), q = z.list[Math.min(z.st.qi, z.list.length - 1)]; z.st.ans[q.id] = Number(a); quizNext(z); },
    skip: function () { var z = quizState(), q = z.list[Math.min(z.st.qi, z.list.length - 1)]; delete z.st.ans[q.id]; quizNext(z); },
    qback: function () { var z = quizState(); if (z.st.qi > 0) { z.st.qi -= 1; render(); } else { go('home'); } },
    miniStart: function () { var c = cur(); c.mini = { qi: 0, ans: {} }; go('mini'); },
    copy: function () {
      var el = document.getElementById('pcode');
      function done() { toast('Код скопирован'); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(el.value).then(done, function () { el.select(); toast('Выделите и скопируйте код вручную'); }); }
      else { el.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Выделите и скопируйте код вручную'); } }
      ACT.sent();
    },
    sent: function () { var c = cur(); if (c.status === 'ready') { c.status = 'sent'; save(); } },
    unlock: function () {
      var c = cur(), data = C.unpackOpen(document.getElementById('ocode').value, c.pid);
      if (!data) { toast('Код не подходит к этому черновику'); return; }
      c.verif = { l: (data.l || []).filter(Boolean), v: data.v || '', n: data.n || '', date: today() };
      c.status = 'open'; go('home'); toast('Профиль открыт');
    },
    cat: function (a) { ui.cat = a; ui.more = 30; render(); },
    moreCat: function () { ui.more += 30; render(); },
    dax: function (a) { ui.diaryAx = ui.diaryAx === a ? '' : a; var t = document.getElementById('dtext').value; render(); document.getElementById('dtext').value = t; },
    addDiary: function () {
      var t = document.getElementById('dtext').value.trim();
      if (!t) { toast('Напишите, что вы заметили'); return; }
      cur().diary.push({ id: 'd' + Date.now().toString(36), d: today(), t: t.slice(0, 2000), ax: ui.diaryAx });
      ui.diaryAx = ''; render(); toast('Запись сохранена');
    },
    delDiary: function (a) { var c = cur(); c.diary = c.diary.filter(function (e) { return e.id !== a; }); render(); },
    addExt: function () {
      var t = document.getElementById('etext').value.trim();
      if (!t) { toast('Добавьте текст'); return; }
      cur().ext.push({ id: 'e' + Date.now().toString(36), d: today(), s: document.getElementById('esrc').value, t: t.slice(0, 2000) });
      render(); toast('Добавлено');
    },
    delExt: function (a) { var c = cur(); c.ext = c.ext.filter(function (e) { return e.id !== a; }); render(); },
    obs: function (a) {
      var c = cur(), el = app.querySelector('[data-obs="' + a + '"]'), st = c.obs[a] || {};
      c.obs[a] = { done: true, d: st.d || today(), note: el.value.trim().slice(0, 2000) }; render(); toast('Сохранено');
    },
    modDone: function (a) { S.mods[a] = today(); go('modules'); },
    pick: function (a) { S.active = a; go('home'); },
    addChild: function () { var c = newChild(); S.children.push(c); S.active = c.id; go('child'); },
    'export': function () {
      var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'ozen-data-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    },
    delChild: function () {
      if (ui.confirm !== 'delChild') { ui.confirm = 'delChild'; render(); return; }
      ui.confirm = null; var id = cur().id;
      S.children = S.children.filter(function (c) { return c.id !== id; });
      S.active = S.children.length ? S.children[0].id : null; go('home'); toast('Данные ребёнка удалены');
    },
    delAll: function () {
      if (ui.confirm !== 'delAll') { ui.confirm = 'delAll'; render(); return; }
      ui.confirm = null;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* нет хранилища */ }
      S = fresh(); go('intro'); toast('Все данные удалены');
    },
    install: function () { if (ui.installEvt) { ui.installEvt.prompt(); ui.installEvt = null; } }
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-go]');
    if (!t || t.disabled) { return; }
    if (t.dataset.act !== 'delChild' && t.dataset.act !== 'delAll') { ui.confirm = null; }
    if (t.dataset.go) { var p = t.dataset.go.split('/'); go(p[0], p[1]); return; }
    if (ACT[t.dataset.act]) { ACT[t.dataset.act](t.dataset.arg, t); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.dataset.ch, c = cur();
    if (!k) { return; }
    if (k === 'c1' || k === 'c2') { S.consent[k] = t.checked; render(); }
    else if (k === 'research') { S.consent.research = t.checked; save(); }
    else if (k === 'year') { c.year = t.value; render(); }
    else if (k === 'district') { c.district = t.value; save(); }
    else if (k === 'dist') { ui.dist = t.value; ui.more = 30; render(); }
    else if (k === 'plan') {
      var key = planKey(); c.plan[key] = c.plan[key] || {};
      if (t.checked) { c.plan[key][t.dataset.arg] = today(); } else { delete c.plan[key][t.dataset.arg]; }
      save();
    }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ui.installEvt = e; });
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн-режим недоступен */ }); }
  render();
})();
