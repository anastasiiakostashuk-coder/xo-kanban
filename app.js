// XO Travel Suite (CRM 2.0) — Reactive Frontend Engine
// Local SQLite (`crm.db`) + Instant Kanban + Tanya's 3-sec Logger + Anastasiia's Finance Cockpit

const STAGES = [
  { id: 'new_request', title: '📥 Новий запит', sub: 'Таймер 15 хв' },
  { id: 'clarifying', title: '🎯 Уточнення побажань', sub: 'Кваліфікація' },
  { id: 'in_progress', title: '🔥 В роботі', sub: 'Підбір варіантів' },
  { id: 'waiting_decision', title: '⏳ Очікування рішення', sub: 'Думає / Дожим' },
  { id: 'combination', title: '🧩 Комбінація', sub: 'Складний тур / ТО' },
  { id: 'booked', title: '✅ Заброньовано', sub: 'Оплата & Документи' },
  { id: 'postponed', title: '⏸️ Відкладено', sub: 'На майбутнє / Пауза' },
  { id: 'lost', title: '❌ Втрачено', sub: 'Відмова / Причина' },
  { id: 'erroneous', title: '🚫 Помилковий', sub: 'Нецільовий / Брак' }
];

const SEGMENTS = [
  { id: 'all', label: '🌍 Всі напрямки' },
  { id: 'egypt', label: '🇪🇬 Єгипет (Шарм/Хургада/Марса)' },
  { id: 'turkey', label: '🇹🇷 Туреччина' },
  { id: 'europe', label: '🏖️ Європа (Іспанія/Італія/Хорватія/Чорногорія/Греція)' },
  { id: 'bus', label: '🚌 Автобусні тури' },
  { id: 'exotic', label: '🌴 Екзотика' }
];

const SOURCES = [
  { id: 'all', label: 'Всі джерела' },
  { id: 'facebook', label: '📘 Facebook', badge: '📘 Facebook' },
  { id: 'landing', label: '🌐 Лендінг', badge: '🌐 Лендінг' },
  { id: 'recommendation', label: '🤝 Рекомендація', badge: '🤝 Рекомендація' },
  { id: 'manual', label: '✍️ Вручну', badge: '✍️ Вручну' }
];

const QUICK_TOUCH_ACTIONS = [
  { label: '📞 Дозвонилась, думає', newStage: 'waiting_decision', comment: 'Дозвонилась, обговорили варіанти, турист думає' },
  { label: '📵 Не взяв трубку', newStage: null, comment: 'Не взяв трубку, передзвонити пізніше' },
  { label: '📩 Відправила варіанти', newStage: 'in_progress', comment: 'Відправила підбірку варіантів у месенджер' },
  { label: '💬 Зробила торкання в повідомленні', newStage: null, comment: 'Написала повідомлення / зробила торкання у месенджері' },
  { label: '💳 Чекаю оплату', newStage: 'waiting_decision', comment: 'Виставлено реквізити, очікуємо оплату' },
  { label: '❌ Відмова: дорого', newStage: 'lost', lostReason: 'Дорого / Не пройшли по бюджету', comment: 'Відмова клієнта: дорого' }
];

const state = {
  leads: [],
  kpis: {},
  currentUser: 'tetiana', // 'tetiana' | 'rita' | 'anastasiia'
  currentRole: 'manager', // 'manager' | 'director'
  viewMode: 'kanban', // 'kanban' | 'list'
  activeSegment: 'all',
  filterStage: 'all', // 'all' | stage.id
  filterSource: 'all', // 'all' | 'facebook' | 'landing' | 'recommendation' | 'manual'
  filterAlert: 'all', // 'all' | 'proposal' | 'silent' | 'reminder'
  searchQuery: '',
  filterBudget1000: false,
  filterFamily: 'all', // 'all' | '2' | '2+1' | '2+2'
  filterManager: 'all', // 'all' | 'tetiana' | 'rita' | 'anastasiia'
  showFinanceCockpit: false,
  rushMode: false,
  selectedLeadId: null,
  newLeadModalOpen: false,
  lostModalLeadId: null,
  combinationModalLeadId: null,
  postponedModalLeadId: null,
  eveningCarouselOpen: false,
  carouselIndex: 0,
  draggedLeadId: null,
  lastQueryMs: 1.4
};

function getCurrentAuthorName() {
  if (state.currentUser === 'rita') return 'Рита';
  if (state.currentUser === 'anastasiia') return 'Анастасія';
  return 'Тетяна';
}

async function apiCall(path, method = 'GET', body = null) {
  const t0 = performance.now();
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  state.lastQueryMs = Math.max(0.8, (performance.now() - t0)).toFixed(1);
  if (data.leads) {
    state.leads = data.leads;
    state.kpis = data.kpis || {};
  }
  render();
  return data;
}

function getMinutesSince(isoStr) {
  if (!isoStr) return 0;
  const diffMs = Date.now() - new Date(isoStr).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function formatMoney(num) {
  return Math.round(Number(num || 0)).toLocaleString('uk-UA');
}

function cleanPhoneForLink(phone) {
  let raw = (phone || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.startsWith('0') && raw.length === 10) {
    return '+38' + raw;
  }
  if (raw.startsWith('380') && raw.length === 12) {
    return '+' + raw;
  }
  if (!raw.startsWith('+')) {
    return '+' + raw;
  }
  return raw;
}

function getDaysSilent(lead) {
  const ref = lead.lastTouchAt || lead.createdAt;
  if (!ref) return 0;
  const diffMs = Date.now() - new Date(ref).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getHoursSilent(lead) {
  const ref = lead.lastTouchAt || lead.createdAt;
  if (!ref) return 0;
  const diffMs = Date.now() - new Date(ref).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

function formatReminderLabel(val) {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    try {
      const d = new Date(val);
      return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return val;
    }
  }
  return val;
}

function isReminderOverdue(lead) {
  const val = lead?.nextFollowUpAt || '';
  if (!val) return false;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    const t = new Date(val).getTime();
    if (!Number.isNaN(t)) return t < Date.now();
  }
  return false;
}

function isSilentOver24hLead(lead) {
  return ['in_progress', 'waiting_decision'].includes(lead.stage) && getHoursSilent(lead) >= 24;
}

function hasPendingDirectorProposal(lead) {
  return (lead.touchLogs || []).some(lg => lg.actionType === 'director_comment' && (lg.label || '').includes('Запропонувала'));
}

function getSourceBadge(src) {
  const s = (src || '').toLowerCase();
  if (s === 'facebook') return '📘 Facebook';
  if (s === 'recommendation') return '🤝 Рекомендація';
  if (s === 'manual') return '✍️ Вручну';
  if (s === 'landing' || s === 'promo_landing' || s === 'catalog_47') return '🌐 Лендінг';
  return '✍️ Вручну';
}

function normalizeSource(src) {
  const s = (src || '').toLowerCase();
  if (s === 'facebook') return 'facebook';
  if (s === 'recommendation') return 'recommendation';
  if (s === 'landing' || s === 'promo_landing' || s === 'catalog_47') return 'landing';
  return 'manual';
}

function hasSpecificLandingHotel(lead) {
  if (!lead) return false;
  if (normalizeSource(lead.sourceChannel) !== 'landing') return false;
  const h = (lead.hotelName || '').trim();
  if (!h) return false;
  const lower = h.toLowerCase();
  if (lower.includes('підбір під бюджет') || lower.includes('індивідуальний підбір') || lower.includes('всі готелі')) {
    return false;
  }
  return true;
}

function cleanCardSituationText(lead) {
  if (!lead) return '';
  const raw = String(lead.currentSituation || lead.wishes || '').trim();
  if (!raw) return '';
  // Never touch Combination questionnaire
  if (lead.stage === 'combination' || raw.includes('Анкета Комбінації')) {
    return raw;
  }
  const lines = raw.split(/\r?\n/);
  const cleaned = [];
  const seen = new Set();
  const hasSpecificHotel = hasSpecificLandingHotel(lead) || (lead.stage === 'booked' && lead.hotelName);
  for (let line of lines) {
    let ln = line.trim();
    if (!ln) continue;
    const low = ln.toLowerCase();
    // Strip only technical landing lines & duplicates
    if (/^\[сторінка:.*\]$/.test(low)) continue;
    if (low.includes('запит з вікна утримання') || low.includes('запит з промо-сторінки')) continue;
    if (low === '• клієнт шукає інші варіанти / інший бюджет' || low === 'клієнт шукає інші варіанти / інший бюджет' || low === 'дані поїздки:' || low === 'коментар клієнта:') continue;
    // Strip generic hotel placeholders or hotel line if already rendered in the green hotel badge above
    if (/^(?:🏨\s*)?(?:обраний готель|готель)\s*:/.test(low)) {
      if (hasSpecificHotel || low.includes('підбір під бюджет') || low.includes('індивідуальний підбір') || low.includes('всі готелі')) {
        continue;
      }
    }
    ln = ln.replace(/^(?:•\s*|💬\s*)?Побажання:\s*/i, 'Побажання: ').trim();
    const key = ln.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(ln);
    }
  }
  return cleaned.join('\n').trim();
}

const NAME_SYNONYM_GROUPS = [
  ['олена', 'елена', 'альона', 'алена', 'алёна', 'olena', 'elena', 'alona', 'alyona', 'helen', 'лена'],
  ['тетяна', 'татьяна', 'таня', 'tetiana', 'tetyana', 'tatiana', 'tatyana', 'tanya'],
  ['ганна', 'анна', 'аня', 'hanna', 'anna', 'ann', 'anya'],
  ['наталія', 'наталия', 'наталья', 'наташа', 'nataliia', 'natalia', 'natalya', 'natasha'],
  ['олександр', 'александр', 'саша', 'сашко', 'oleksandr', 'alexander', 'alex', 'sasha'],
  ['олександра', 'александра', 'саша', 'oleksandra', 'alexandra'],
  ['євген', 'євгеній', 'евгений', 'женя', 'yevhen', 'yevhenii', 'evgeniy', 'eugene', 'zhenya'],
  ['євгенія', 'евгения', 'женя', 'yevheniia', 'evgeniya', 'eugenia'],
  ['катерина', 'екатерина', 'катя', 'kateryna', 'ekaterina', 'kate', 'katya'],
  ['микола', 'николай', 'коля', 'mykola', 'nikolay', 'nicholas', 'kolya'],
  ['михайло', 'михаил', 'міша', 'миша', 'mykhailo', 'mikhail', 'michael', 'misha'],
  ['сергій', 'сергей', 'серьожа', 'сережа', 'serhii', 'sergiy', 'sergey', 'sergei'],
  ['андрій', 'андрей', 'andrii', 'andriy', 'andrey', 'andrew'],
  ['лексій', 'олексій', 'алексей', 'льоша', 'леша', 'oleksii', 'alexey', 'alexei', 'alex'],
  ['дмитро', 'дмитрий', 'діма', 'дима', 'dmytro', 'dmitry', 'dmitri', 'dima'],
  ['володимир', 'владимир', 'вова', 'volodymyr', 'vladimir', 'vova'],
  ['владислав', 'влад', 'vladyslav', 'vladislav', 'vlad'],
  ['вячеслав', "в'ячеслав", 'слава', 'viacheslav', 'vyacheslav', 'slava'],
  ['ірина', 'ирина', 'іра', 'ира', 'iryna', 'irina', 'ira'],
  ['юлія', 'юлия', 'юля', 'yuliia', 'yulia', 'julia', 'yulya'],
  ['марія', 'мария', 'маша', 'mariia', 'maria', 'mary', 'masha'],
  ['софія', 'софия', 'соня', 'sofiia', 'sofia', 'sophia', 'sonya'],
  ['дар’я', 'дарія', 'дарья', 'даша', 'daria', 'darya', 'dasha'],
  ['анастасія', 'анастасия', 'настя', 'anastasiia', 'anastasia', 'nastya'],
  ['вікторія', 'виктория', 'віка', 'вика', 'viktoriia', 'viktoria', 'victoria', 'vika'],
  ['віктор', 'виктор', 'вітя', 'витя', 'viktor', 'victor'],
  ['віталій', 'виталий', 'віталік', 'виталик', 'vitalii', 'vitaliy', 'vitaly'],
  ['валерiй', 'валерій', 'валерий', 'valerii', 'valeriy', 'valery'],
  ['валерія', 'валерия', 'лєра', 'лера', 'valeriia', 'valeria', 'lera'],
  ['маргарита', 'рита', 'ріта', 'marharyta', 'margarita', 'rita'],
  ['ольга', 'оля', 'olha', 'olga', 'olya'],
  ['світлана', 'светлана', 'свєта', 'света', 'svitlana', 'svetlana', 'sveta'],
  ['людмила', 'люда', 'liudmyla', 'lyudmila', 'luda'],
  ['надія', 'надежда', 'надя', 'nadiia', 'nadezhda', 'nadya'],
  ['любов', 'любовь', 'люба', 'liubov', 'lyubov', 'luba'],
  ['павло', 'павел', 'паша', 'pavlo', 'pavel', 'paul', 'pasha'],
  ['петро', 'петр', 'пётр', 'петя', 'petro', 'pyotr', 'peter', 'petya'],
  ['іван', 'иван', 'ваня', 'ivan', 'john', 'vanya'],
  ['ігор', 'игорь', 'ihor', 'igor'],
  ['олег', 'oleh', 'oleg'],
  ['юрій', 'юрий', 'юра', 'yurii', 'yuriy', 'yuri', 'yura'],
  ['максим', 'макс', 'maksym', 'maxim', 'max'],
  ['артем', 'артём', 'artem', 'artyom'],
  ['денис', 'денис', 'denys', 'denis'],
  ['кирило', 'кирилл', 'кіріл', 'kyrylo', 'kirill', 'cyril'],
  ['христина', 'кристина', 'крістіна', 'khrystyna', 'kristina', 'christina'],
  ['оксана', 'ксенія', 'ксения', 'ксюша', 'oksana', 'kseniia', 'ksenia', 'ksusha']
];

function buildMultilingualSearchForms(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw) return '';
  // Normalize UA/RU equivalences (і/ї/є/е/и/ы/ъ/ь/ґ/г)
  const uaRuNorm = raw
    .replace(/і|ї|и|ы/g, 'и')
    .replace(/є|э|е|ё/g, 'е')
    .replace(/ґ/g, 'г')
    .replace(/['’ʼ`ьъ]/g, '');

  // Expand known UA/RU/EN name synonyms (e.g., Олена <-> Елена <-> Olena <-> Elena)
  const tokens = raw.split(/[^a-zа-яіїєґё0-9]+/).filter(Boolean);
  const synonymExpansion = [];
  for (const tok of tokens) {
    for (const group of NAME_SYNONYM_GROUPS) {
      if (group.includes(tok)) {
        synonymExpansion.push(...group);
      }
    }
  }
  const expandedRaw = synonymExpansion.length ? `${raw} ${synonymExpansion.join(' ')}` : raw;

  // Transliterate Cyrillic (UA & RU) -> Latin so searching Latin or Cyrillic matches either way
  const cyrToLatMap = {
    а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ye',
    ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh',
    ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };
  let lat = '';
  for (const ch of expandedRaw) {
    lat += (cyrToLatMap[ch] !== undefined ? cyrToLatMap[ch] : ch);
  }
  // Simplified phonetic Latin (so "Olena"/"Elena", "Yuliia"/"Yulia"/"Julia", "h"/"g"/"kh", "v"/"w", "i"/"y" match)
  const phoneticLat = lat
    .replace(/shch/g, 'sch')
    .replace(/kh/g, 'h')
    .replace(/zh/g, 'j')
    .replace(/ts/g, 'c')
    .replace(/yu|ju|iu/g, 'u')
    .replace(/ya|ja|ia/g, 'a')
    .replace(/ye|je|ie/g, 'e')
    .replace(/yi|ji/g, 'i')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/h/g, 'g')
    .replace(/k/g, 'c')
    .replace(/(.)\1+/g, '$1');

  return `${expandedRaw} ${uaRuNorm} ${lat} ${phoneticLat}`;
}

function matchesMultilingualSearch(haystackText, queryText) {
  const qRaw = String(queryText || '').trim().toLowerCase();
  if (!qRaw) return true;
  const hayForms = buildMultilingualSearchForms(haystackText);
  const words = qRaw.split(/\s+/).filter(Boolean);
  return words.every(word => {
    const wordForms = buildMultilingualSearchForms(word).split(/\s+/).filter(Boolean);
    return wordForms.some(wf => hayForms.includes(wf));
  });
}

function filteredLeads(ignoreStageFilter = false) {
  return state.leads.filter(l => {
    if (state.activeSegment !== 'all' && l.segment !== state.activeSegment) return false;
    if (!ignoreStageFilter && state.viewMode === 'list' && state.filterStage !== 'all' && l.stage !== state.filterStage) return false;
    if (state.filterSource !== 'all' && normalizeSource(l.sourceChannel) !== state.filterSource) return false;
    if (state.filterManager !== 'all' && l.assignedTo !== state.filterManager) return false;
    if (state.filterAlert === 'proposal' && !hasPendingDirectorProposal(l)) return false;
    if (state.filterAlert === 'silent' && !isSilentOver24hLead(l)) return false;
    if (state.filterAlert === 'reminder' && !l.nextFollowUpAt) return false;
    if (state.filterBudget1000 && Number(l.budgetEUR || 0) < 1000) return false;
    if (state.filterFamily !== 'all' && l.familyComposition !== state.filterFamily) return false;
    if (state.searchQuery.trim()) {
      const hay = `${l.shortId} ${l.clientName} ${l.phone} ${l.destination} ${l.hotelName} ${l.departureCity} ${l.wishes || ''}`;
      if (!matchesMultilingualSearch(hay, state.searchQuery)) return false;
    }
    return true;
  });
}

function renderHeader() {
  const touchedTodayCount = state.leads.filter(l => l.touchedToday).length;
  return `
    <header class="xo-header">
      <div class="xo-brand">
        <div class="xo-logo-badge">XO 2.0</div>
        <div>
          <div class="xo-brand-title">XO Travel Suite <span style="font-weight:500;opacity:0.75;font-size:13px;">• Таня & Анастасія</span></div>
          <div class="xo-brand-sub">
            <span>SQLite Local-First (\`crm.db\`)</span>
            <span class="db-latency-pill">⚡ ${state.lastQueryMs} ms</span>
            <span>• ${state.leads.length} клієнтів у базі</span>
          </div>
        </div>
      </div>

      <div class="xo-header-controls">
        <input
          type="text"
          id="global-search"
          class="xo-search-input"
          placeholder="🔍 Пошук (UA/RU/EN): ім'я, телефон, #ID, готель..."
          value="${escapeHtml(state.searchQuery)}"
          oninput="window.onSearchInput(this.value)"
        />

        <button class="xo-btn xo-btn-rush ${state.rushMode ? 'active' : ''}" onclick="window.toggleRushMode()">
          🔥 Режим Вогню (Rush)
        </button>

        <button class="xo-btn xo-btn-ghost" onclick="window.openEveningCarousel()">
          🌙 Підсумки дня (${touchedTodayCount})
        </button>

        <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.1);padding:3px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);">
          <button
            class="xo-btn ${state.currentUser === 'tetiana' ? 'xo-btn-lime' : 'xo-btn-ghost'}"
            style="padding:5px 10px;font-size:12px;border:none;"
            onclick="window.setUserProfile('tetiana')"
          >
            👩‍💼 Менеджер: Тетяна
          </button>
          <button
            class="xo-btn ${state.currentUser === 'rita' ? 'xo-btn-lime' : 'xo-btn-ghost'}"
            style="padding:5px 10px;font-size:12px;border:none;"
            onclick="window.setUserProfile('rita')"
          >
            👩‍💻 Менеджер: Ріта
          </button>
          <button
            class="xo-btn ${state.currentUser === 'anastasiia' ? 'xo-btn-lime' : 'xo-btn-ghost'}"
            style="padding:5px 10px;font-size:12px;border:none;"
            onclick="window.setUserProfile('anastasiia')"
          >
            👑 Пульт керівника
          </button>
        </div>

        ${state.currentRole === 'director' ? `
          <button class="xo-btn xo-btn-ghost ${state.showFinanceCockpit ? 'active' : ''}" onclick="window.toggleFinance()">
            💰 Каса & Фінанси
          </button>
        ` : ''}

        <a href="/api/backup" class="xo-btn xo-btn-ghost" style="text-decoration:none;" title="Миттєвий бекап файлу crm.db">
          💾 Бекап .db
        </a>

        <button class="xo-btn xo-btn-lime" onclick="window.openNewLeadModal()">
          + Новий лід
        </button>
      </div>
    </header>
  `;
}

function renderSubbar() {
  const segCounts = { all: state.leads.length };
  SEGMENTS.forEach(s => {
    if (s.id !== 'all') {
      segCounts[s.id] = state.leads.filter(l => l.segment === s.id).length;
    }
  });
  const proposalCount = state.leads.filter(hasPendingDirectorProposal).length;
  const silentCount = state.leads.filter(isSilentOver24hLead).length;
  const reminderCount = state.leads.filter(l => Boolean(l.nextFollowUpAt)).length;
  const overdueReminderCount = state.leads.filter(isReminderOverdue).length;

  return `
    <div class="xo-subbar">
      <div class="segment-pills">
        ${SEGMENTS.map(s => `
          <button
            class="seg-pill ${state.activeSegment === s.id ? 'active' : ''}"
            onclick="window.setSegment('${s.id}')"
          >
            <span>${s.label}</span>
            <span class="seg-count">${segCounts[s.id] || 0}</span>
          </button>
        `).join('')}
      </div>

      <div class="qualify-filters">
        <div class="view-switcher">
          <button class="view-btn ${state.viewMode === 'kanban' ? 'active' : ''}" onclick="window.setViewMode('kanban')">
            📊 Канбан
          </button>
          <button class="view-btn ${state.viewMode === 'list' ? 'active' : ''}" onclick="window.setViewMode('list')">
            📋 Список
          </button>
        </div>
        <button class="q-chip ${state.filterManager === 'tetiana' ? 'active' : ''}" onclick="window.setManagerFilter('tetiana')">
          👩‍💼 Тетяна
        </button>
        <button class="q-chip ${state.filterManager === 'rita' ? 'active' : ''}" onclick="window.setManagerFilter('rita')">
          👩‍💻 Рита
        </button>
        <button
          class="q-chip ${state.filterAlert === 'proposal' ? 'active' : ''}"
          style="${state.filterAlert === 'proposal' ? '' : 'background:#fefce8;border-color:#fde047;color:#854d0e;font-weight:800;'}"
          onclick="window.setAlertFilter('proposal')"
          title="Показати картки з активною порадою керівника"
        >
          💬 Поради (${proposalCount})
        </button>
        <button
          class="q-chip ${state.filterAlert === 'silent' ? 'active' : ''}"
          style="${state.filterAlert === 'silent' ? '' : 'background:#fffbeb;border-color:#fcd34d;color:#b45309;font-weight:800;'}"
          onclick="window.setAlertFilter('silent')"
          title="Показати картки в роботі або очікуванні без дотику >24 годин"
        >
          ⚠️ >24г без дотику (${silentCount})
        </button>
        <button
          class="q-chip ${state.filterAlert === 'reminder' ? 'active' : ''}"
          style="${state.filterAlert === 'reminder' ? '' : (overdueReminderCount > 0 ? 'background:#fef2f2;border-color:#fca5a5;color:#b91c1c;font-weight:800;' : 'background:#f8fafc;border-color:#cbd5e1;color:#334155;font-weight:700;')}"
          onclick="window.setAlertFilter('reminder')"
          title="Показати картки з встановленим нагадуванням"
        >
          ⏰ Нагадування (${reminderCount}${overdueReminderCount > 0 ? ` • 🔥${overdueReminderCount}` : ''})
        </button>
        <select
          class="q-chip"
          style="outline:none;padding:5px 9px;"
          onchange="window.setSourceFilter(this.value)"
        >
          ${SOURCES.map(src => `<option value="${src.id}" ${state.filterSource === src.id ? 'selected' : ''}>${src.label}</option>`).join('')}
        </select>
        ${(state.activeSegment !== 'all' || state.filterStage !== 'all' || state.filterSource !== 'all' || state.filterManager !== 'all' || state.filterAlert !== 'all' || state.searchQuery) ? `
          <button class="q-chip" style="color:#dc2626;border-color:#fca5a5;" onclick="window.resetFilters()">
            ✕ Скинути
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderFinanceCockpit() {
  if (state.currentRole !== 'director' || !state.showFinanceCockpit) return '';
  const k = state.kpis || {};

  return `
    <section class="finance-cockpit">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="background:#d9ef9f;color:#153629;font-weight:800;font-size:11px;padding:3px 9px;border-radius:99px;">КОНТРОЛЬ АНАСТАСІЇ</span>
          <h3 style="font-size:15px;font-weight:800;">Фінансовий пульт та конверсія</h3>
        </div>
        <div style="font-size:12px;color:#b0cec0;">
          Курс розрахунку: 1$ = 41.5 ₴ • 1€ = 45.0 ₴ • Податок ФОП 6% враховано
        </div>
      </div>

      <div class="finance-grid" style="grid-template-columns:repeat(4,1fr);">
        <div class="fin-card">
          <div class="fin-label">Реальна каса / Оборот (✅ Заброньовано)</div>
          <div class="fin-value">${formatMoney(k.turnoverUAH)} ₴</div>
          <div class="fin-sub">≈ $${formatMoney(k.turnoverUSD)} USD • Оплачених броней: <b>${k.wonCount || 0}</b></div>
        </div>

        <div class="fin-card">
          <div class="fin-label">Чиста комісія (-6% ФОП) & Бонус 50%</div>
          <div class="fin-value">${formatMoney(k.netCommissionUAH)} ₴</div>
          <div class="fin-sub">Бонус 50%: <b>${formatMoney(k.bonus50UAH ?? k.tanyaBonusUAH)} ₴</b> (Таня: ${formatMoney(k.tanyaBonusUAH)} ₴ • Ріта 20%: ${formatMoney(k.ritaBonusUAH)} ₴)</div>
        </div>

        <div class="fin-card" style="border-color:rgba(253,224,71,0.45);background:rgba(254,240,138,0.08);">
          <div class="fin-label" style="color:#fde047;">⏳ Потенційний пул у дожимі (Think Pool)</div>
          <div class="fin-value" style="color:#fef08a;">${formatMoney(k.thinkPoolUAH ?? k.pipelineUAH)} ₴</div>
          <div class="fin-sub">≈ $${formatMoney(k.thinkPoolUSD ?? k.pipelineUSD)} USD • В «Очікуванні рішення»: <b>${k.thinkPoolCount ?? k.bookingPendingCount ?? 0} клієнтів</b></div>
        </div>

        <div class="fin-card">
          <div class="fin-label">Воронка & Реальна конверсія</div>
          <div class="fin-value">${k.totalLeads || 0} → ${k.qualifiedCount || 0} → ${k.wonCount || 0}</div>
          <div class="fin-sub">Кваліфікація: <b>${k.qualifyRate || 0}%</b> • У бронь: <b>${k.winRate || 0}%</b></div>
        </div>
      </div>
    </section>
  `;
}

function renderCard(lead) {
  const mins = getMinutesSince(lead.createdAt);
  const isNewOverdue = lead.stage === 'new_request' && !lead.firstContactAt && mins >= 15;
  const hoursSilent = getHoursSilent(lead);
  const daysSilent = Math.max(1, Math.floor(hoursSilent / 24));
  const isSilentOver24h = ['in_progress', 'waiting_decision'].includes(lead.stage) && hoursSilent >= 24;
  const hasProposal = hasPendingDirectorProposal(lead);

  let slaBadgeHtml = '';
  if (lead.stage === 'new_request') {
    if (isNewOverdue) {
      slaBadgeHtml = `<span class="sla-badge urgent">🚨 ${mins} хв без дзвінка!</span>`;
    } else {
      slaBadgeHtml = `<span class="sla-badge fresh">🟢 ${mins} хв тому</span>`;
    }
  } else if (isSilentOver24h) {
    slaBadgeHtml = `<span class="sla-badge normal" style="background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-weight:800;">⚠️ ${daysSilent} дн. без дотику</span>`;
  } else {
    slaBadgeHtml = `<span class="sla-badge normal">📞 ${lead.rushTouchesCount || 0} торк.</span>`;
  }

  const mgrName = lead.assignedTo === 'rita' ? 'Ріта' : (lead.assignedTo === 'anastasiia' ? 'Анастасія' : 'Тетяна');
  const budgetText = lead.budgetEUR > 0 ? `€${formatMoney(lead.budgetEUR)}` : (lead.budgetUAH > 0 ? `${formatMoney(lead.budgetUAH)} ₴` : 'Підбір');

  return `
    <div
      class="lead-card ${isNewOverdue ? 'sla-overdue' : ''}"
      data-lead-id="${lead.id}"
      draggable="true"
      ondragstart="window.onDragStart(event, '${lead.id}')"
      onclick="window.openLead('${lead.id}')"
    >
      ${hasProposal ? `
        <div style="background:#fef08a;color:#854d0e;border:1px solid #eab308;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;">
          <span>💬 Порада керівника</span>
          <span>Чекає реакції →</span>
        </div>
      ` : ''}
      ${lead.nextFollowUpAt ? `
        <div class="reminder-badge" style="${isReminderOverdue(lead) ? 'background:#fef2f2;color:#b91c1c;border:1px solid #ef4444;' : 'background:#fffbeb;color:#b45309;border:1px solid #fcd34d;'}font-size:10.5px;font-weight:800;padding:3px 7px;border-radius:6px;display:flex;align-items:center;gap:4px;">
          <span>${isReminderOverdue(lead) ? '🔥 Прострочено:' : '⏰ Нагадування:'} ${escapeHtml(formatReminderLabel(lead.nextFollowUpAt))}</span>
        </div>
      ` : ''}
      <div class="card-row-1">
        <div class="card-id-name">
          <span class="card-id">#${lead.shortId}</span>${escapeHtml(lead.clientName)}
        </div>
        ${slaBadgeHtml}
      </div>

      <div class="card-row-2">
        <span>✈️ ${escapeHtml(lead.departureCity)} → ${escapeHtml(lead.destination)}</span>
      </div>

      ${(lead.selectionLinks && lead.selectionLinks.length) || lead.selectionUrl ? `
        <div style="font-size:11px;display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;padding:3px 7px;border-radius:6px;" onclick="event.stopPropagation()">
          <a href="${escapeHtml((lead.selectionLinks && lead.selectionLinks[0] && lead.selectionLinks[0].url) || lead.selectionUrl)}" target="_blank" style="color:#047857;font-weight:700;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">
            🔗 Підбірка (${(lead.selectionLinks && lead.selectionLinks.length) || 1})
          </a>
          <button
            style="border:none;background:transparent;color:#153629;font-size:10.5px;font-weight:800;cursor:pointer;padding:0;"
            onclick="window.copySelectionUrl(event, '${escapeHtml((lead.selectionLinks && lead.selectionLinks[0] && lead.selectionLinks[0].url) || lead.selectionUrl)}')"
            title="Скопіювати посилання на підбірку"
          >
            📋 Копія
          </button>
        </div>
      ` : ''}

      ${((lead.stage === 'booked' && lead.hotelName) || hasSpecificLandingHotel(lead)) ? `
        <div style="font-size:11px;color:#047857;font-weight:700;white-space:pre-line;word-break:break-word;">
          🏨 ${escapeHtml(lead.hotelName)}
        </div>
      ` : ''}

      ${lead.stage === 'booked' ? `
        <div style="background:#ecfdf5;color:#065f46;border:1px solid #10b981;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;display:flex;align-items:center;gap:6px;">
          <span>📄 Договір створено в X-ISO CRM (Центральний офіс)</span>
        </div>
      ` : ''}

      ${cleanCardSituationText(lead) ? `
        <div style="font-size:11.5px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:6px;white-space:pre-line;word-break:break-word;line-height:1.35;">
          💬 ${escapeHtml(cleanCardSituationText(lead))}
        </div>
      ` : ''}

      <div class="card-row-3">
        <div class="card-tags-inline">
          <span>👤 ${mgrName}</span>
          <span style="background:#f1f5f9;color:#334155;font-weight:700;padding:1px 6px;border-radius:5px;font-size:10px;">${getSourceBadge(lead.sourceChannel)}</span>
        </div>
        <span class="badge-budget">${budgetText}</span>
      </div>

      <!-- ШВИДКА ЗМІНА СТАТУСУ ПРЯМО НА КАРТЦІ КАНБАНУ (В БУДЬ-ЯКИЙ БІК) -->
      <div style="margin-top:2px;" onclick="event.stopPropagation()">
        <select
          class="stage-select-inline"
          style="width:100%;padding:4px 7px;font-size:11px;border-radius:6px;background:#f8fafc;border:1px solid #cbd5e1;color:#153629;font-weight:800;"
          onchange="window.changeStageFromDrawer('${lead.id}', this.value)"
          title="Перевести картку в будь-який статус"
        >
          ${STAGES.map(s => `<option value="${s.id}" ${lead.stage === s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
        </select>
      </div>

      ${state.rushMode ? `
        <button
          class="rush-touch-btn"
          onclick="window.onRushTouch(event, '${lead.id}')"
        >
          ⚡ Касание +1 (Вже ${lead.rushTouchesCount || 0})
        </button>
      ` : ''}
    </div>
  `;
}

function renderListView() {
  const baseLeads = filteredLeads(true);
  const leads = filteredLeads(false);
  const stageCounts = { all: baseLeads.length };
  STAGES.forEach(s => {
    stageCounts[s.id] = baseLeads.filter(l => l.stage === s.id).length;
  });

  const srcCounts = { all: baseLeads.length };
  SOURCES.forEach(src => {
    if (src.id !== 'all') {
      srcCounts[src.id] = baseLeads.filter(l => normalizeSource(l.sourceChannel) === src.id).length;
    }
  });

  return `
    <div style="margin:12px 20px 0;display:flex;flex-direction:column;gap:8px;">
      <!-- ПЛАШКИ СТАТУСІВ ДЛЯ СПИСКУ -->
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#fff;padding:10px 14px;border-radius:12px;border:1px solid #e2e8e4;">
        <span style="font-size:11px;font-weight:800;color:#5c7065;text-transform:uppercase;margin-right:4px;">Статус:</span>
        <button
          class="seg-pill ${state.filterStage === 'all' ? 'active' : ''}"
          onclick="window.setStageFilter('all')"
        >
          <span>Всі статуси</span>
          <span class="seg-count">${stageCounts.all || 0}</span>
        </button>
        ${STAGES.map(s => `
          <button
            class="seg-pill ${state.filterStage === s.id ? 'active' : ''}"
            onclick="window.setStageFilter('${s.id}')"
          >
            <span>${s.title}</span>
            <span class="seg-count">${stageCounts[s.id] || 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- ПЛАШКИ ДЖЕРЕЛ (FACEBOOK / РЕКОМЕНДАЦІЇ / ВРУЧНУ / ЛЕНДІНГ) -->
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#fff;padding:8px 14px;border-radius:12px;border:1px solid #e2e8e4;">
        <span style="font-size:11px;font-weight:800;color:#5c7065;text-transform:uppercase;margin-right:4px;">Джерело:</span>
        ${SOURCES.map(src => `
          <button
            class="q-chip ${state.filterSource === src.id ? 'active' : ''}"
            onclick="window.setSourceFilter('${src.id}')"
          >
            ${src.label} (${srcCounts[src.id] || 0})
          </button>
        `).join('')}
      </div>
    </div>

    <main class="list-wrapper">
      <table class="leads-table">
        <thead>
          <tr>
            <th>#ID</th>
            <th>Турист & Контакт</th>
            <th>Джерело</th>
            <th>Статус</th>
            <th>Маршрут</th>
            <th>Бюджет</th>
            <th>Торкань</th>
            <th>Менеджер</th>
            <th>Поточна ситуація / Нотатка</th>
          </tr>
        </thead>
        <tbody>
          ${leads.length ? leads.map(lead => {
            const mgrName = lead.assignedTo === 'rita' ? 'Рита' : (lead.assignedTo === 'anastasiia' ? 'Анастасія' : 'Таня');
            const budgetText = lead.budgetEUR > 0 ? `€${formatMoney(lead.budgetEUR)} (${formatMoney(lead.budgetUAH)} ₴)` : (lead.budgetUAH > 0 ? `${formatMoney(lead.budgetUAH)} ₴` : 'Підбір');
            const phoneClean = cleanPhoneForLink(lead.phone);
            const tgUrl = phoneClean ? `https://t.me/${phoneClean.startsWith('+') ? phoneClean : '+' + phoneClean}` : 'https://t.me/';
            const hoursSilent = getHoursSilent(lead);
            const daysSilent = Math.max(1, Math.floor(hoursSilent / 24));
            const isSilentOver24h = ['in_progress', 'waiting_decision'].includes(lead.stage) && hoursSilent >= 24;
            const pendingDir = hasPendingDirectorProposal(lead);

            return `
              <tr class="lead-row" onclick="window.openLead('${lead.id}')">
                <td style="font-weight:800;color:#5c7065;">#${lead.shortId}</td>
                <td>
                  <div style="font-weight:800;color:#13241c;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span>${escapeHtml(lead.clientName)}</span>
                    ${pendingDir ? `<span style="background:#fef08a;color:#854d0e;border:1px solid #ca8a04;font-size:10px;padding:1px 6px;border-radius:99px;">💬 Порада керівника</span>` : ''}
                    ${isSilentOver24h ? `<span style="background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-size:10px;padding:1px 6px;border-radius:99px;">⚠️ ${daysSilent} дн. без дотику</span>` : ''}
                    ${lead.nextFollowUpAt ? `<span style="${isReminderOverdue(lead) ? 'background:#fef2f2;color:#b91c1c;border:1px solid #ef4444;font-weight:800;' : 'background:#fffbeb;color:#b45309;border:1px solid #fcd34d;'}font-size:10px;padding:1px 6px;border-radius:99px;">${isReminderOverdue(lead) ? '🔥 Прострочено:' : '⏰'} ${escapeHtml(formatReminderLabel(lead.nextFollowUpAt))}</span>` : ''}
                  </div>
                  <div style="font-size:11.5px;color:#047857;font-weight:700;margin-top:2px;display:flex;gap:8px;" onclick="event.stopPropagation()">
                    <a href="tel:${phoneClean}" style="color:#047857;text-decoration:none;">📞 ${escapeHtml(lead.phone || '—')}</a>
                    <a href="${tgUrl}" target="_blank" style="color:#1d4ed8;text-decoration:none;">✈️ TG</a>
                  </div>
                </td>
                <td>
                  <span style="background:#f1f5f9;color:#1e293b;font-weight:700;padding:4px 8px;border-radius:6px;font-size:11.5px;white-space:nowrap;">
                    ${getSourceBadge(lead.sourceChannel)}
                  </span>
                </td>
                <td onclick="event.stopPropagation()">
                  <select class="stage-select-inline" onchange="window.changeStageFromDrawer('${lead.id}', this.value)">
                    ${STAGES.map(s => `<option value="${s.id}" ${lead.stage === s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <div style="font-weight:700;color:#1e293b;">✈️ ${escapeHtml(lead.departureCity)} → ${escapeHtml(lead.destination)}</div>
                  ${lead.travelDates ? `<div style="font-size:11px;color:#475569;margin-top:2px;">🌙 ${escapeHtml(lead.travelDates)}</div>` : ''}
                  ${((lead.stage === 'booked' && lead.hotelName) || hasSpecificLandingHotel(lead)) ? `<div style="font-size:11.5px;color:#047857;font-weight:700;margin-top:2px;">🏨 ${escapeHtml(lead.hotelName)}</div>` : ''}
                  ${lead.stage === 'booked' ? `<div style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #10b981;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;margin-top:3px;">📄 Договір створено в X-ISO CRM (Центральний офіс)</div>` : ''}
                </td>
                <td><span class="badge-budget">${budgetText}</span></td>
                <td onclick="event.stopPropagation()">
                  <button
                    class="q-chip"
                    style="background:#fffbeb;border-color:#fde68a;color:#b45309;"
                    onclick="window.onRushTouch(event, '${lead.id}')"
                    title="Швидке торкання +1"
                  >
                    ⚡ ${lead.rushTouchesCount || 0} торк.
                  </button>
                </td>
                <td style="font-weight:700;">👤 ${mgrName}</td>
                <td style="max-width:340px;white-space:pre-line;word-break:break-word;color:#334155;font-size:12px;line-height:1.35;">
                  ${escapeHtml(cleanCardSituationText(lead) || '—')}
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="9" style="text-align:center;padding:32px;color:#94a3b8;">За вашим фільтром клієнтів не знайдено</td>
            </tr>
          `}
        </tbody>
      </table>
    </main>
  `;
}

function renderKanban() {
  const leads = filteredLeads();
  return `
    <main class="kanban-wrapper">
      ${STAGES.map(stage => {
        const colLeads = leads.filter(l => l.stage === stage.id);
        return `
          <section
            class="kanban-col"
            ondragover="window.onDragOver(event)"
            ondragleave="window.onDragLeave(event)"
            ondrop="window.onDrop(event, '${stage.id}')"
          >
            <div class="col-header">
              <div>
                <div class="col-title">${stage.title}</div>
                <div style="font-size:10.5px;color:#64748b;font-weight:600;">${stage.sub}</div>
              </div>
              <span class="col-count">${colLeads.length}</span>
            </div>
            <div class="col-body">
              ${colLeads.length ? colLeads.map(renderCard).join('') : `
                <div style="text-align:center;padding:28px 10px;color:#94a3b8;font-size:12px;">
                  Немає карток у цьому статусі
                </div>
              `}
            </div>
          </section>
        `;
      }).join('')}
    </main>
  `;
}

function renderLeadDrawer() {
  if (!state.selectedLeadId) return '';
  const lead = state.leads.find(l => l.id === state.selectedLeadId);
  if (!lead) return '';

  const phoneClean = cleanPhoneForLink(lead.phone);
  const tgUrl = phoneClean ? `https://t.me/${phoneClean.startsWith('+') ? phoneClean : '+' + phoneClean}` : 'https://t.me/';
  const viberUrl = phoneClean ? `viber://chat?number=${encodeURIComponent(phoneClean)}` : '#';
  const curAuthor = getCurrentAuthorName();
  const curAssignedLabel = lead.assignedTo === 'rita' ? 'Рита' : (lead.assignedTo === 'anastasiia' ? 'Анастасія' : 'Тетяна');

  return `
    <div class="modal-backdrop" onclick="window.closeDrawerOnBackdrop(event)">
      <aside class="lead-drawer" onclick="event.stopPropagation()">
        <div class="drawer-top">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="background:#153629;color:#d9ef9f;font-weight:800;font-size:11.5px;padding:2px 8px;border-radius:6px;">#${lead.shortId}</span>
              <h2 class="drawer-client-name">${escapeHtml(lead.clientName)}</h2>
              <span style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;">
                👤 Відповідальна: ${curAssignedLabel}
              </span>
              ${hasPendingDirectorProposal(lead) ? `
                <button
                  type="button"
                  style="background:#fef08a;color:#854d0e;border:1px solid #eab308;font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px;cursor:pointer;"
                  onclick="document.getElementById('director-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' })"
                  title="Перейти до поради керівника внизу картки"
                >
                  💬 Є порада керівника (перейти ↓)
                </button>
              ` : ''}
            </div>
            <div class="drawer-meta-bar">
              <a href="tel:${phoneClean}" class="meta-pill phone">📞 ${escapeHtml(lead.phone || 'Немає телефону')}</a>
              <a href="${tgUrl}" target="_blank" class="meta-pill tg">✈️ Написати у Telegram</a>
              <a href="${viberUrl}" class="meta-pill" style="background:#f3e8ff;color:#6b21a8;">💬 Viber</a>
              <span class="meta-pill">🛫 Виліт: ${escapeHtml(lead.departureCity)}</span>
              <span class="meta-pill">💶 €${formatMoney(lead.budgetEUR)} (${formatMoney(lead.budgetUAH)} ₴)</span>
              <span class="meta-pill">👨‍👩‍👧 Сім'я: ${escapeHtml(lead.familyComposition)}</span>
            </div>
          </div>
          <button class="xo-btn" style="background:#f1f5f9;color:#0f172a;" onclick="window.closeLead()">✕ Закрити</button>
        </div>

        <!-- ПЕРЕДАЧА ЛІДА В 1 КЛІК (ТАНЯ ⇄ РИТА ⇄ АНАСТАСІЯ) + НАГАДУВАННЯ -->
        <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:9px 12px;border-radius:10px;">
          <div style="font-size:11px;font-weight:800;color:#153629;text-transform:uppercase;margin-bottom:6px;">
            🔄 Швидка зміна статусу картки (в будь-який бік без обмежень):
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            ${STAGES.map(s => `
              <button
                type="button"
                class="q-chip ${lead.stage === s.id ? 'active' : ''}"
                style="padding:4px 9px;font-size:11.5px;${lead.stage === s.id ? 'background:#153629;color:#d9ef9f;border-color:#153629;font-weight:800;' : ''}"
                onclick="window.changeStageFromDrawer('${lead.id}', '${s.id}')"
              >
                ${s.title}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f0fdf4;border:1px solid #bbf7d0;padding:9px 12px;border-radius:10px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:11px;font-weight:800;color:#153629;text-transform:uppercase;">🤝 Передати лід:</span>
            <button
              class="q-chip ${lead.assignedTo === 'tetiana' || !lead.assignedTo ? 'active' : ''}"
              style="padding:4px 10px;font-size:11.5px;"
              onclick="window.transferLead('${lead.id}', 'tetiana')"
            >
              👩‍💼 Тані
            </button>
            <button
              class="q-chip ${lead.assignedTo === 'rita' ? 'active' : ''}"
              style="padding:4px 10px;font-size:11.5px;"
              onclick="window.transferLead('${lead.id}', 'rita')"
            >
              👩‍💻 Риті
            </button>
            <button
              class="q-chip ${lead.assignedTo === 'anastasiia' ? 'active' : ''}"
              style="padding:4px 10px;font-size:11.5px;"
              onclick="window.transferLead('${lead.id}', 'anastasiia')"
            >
              👩‍💼 Анастасії
            </button>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
            <span style="font-size:11px;font-weight:800;color:#153629;text-transform:uppercase;">⏰ Нагадати:</span>
            <button class="q-chip" style="padding:3px 8px;font-size:11px;" onclick="window.setFollowUpReminder('${lead.id}', 'Сьогодні 18:00')">Сьогодні 18:00</button>
            <button class="q-chip" style="padding:3px 8px;font-size:11px;" onclick="window.setFollowUpReminder('${lead.id}', 'Завтра 11:00')">Завтра 11:00</button>
            <button class="q-chip" style="padding:3px 8px;font-size:11px;" onclick="window.setFollowUpReminder('${lead.id}', 'Через 2 дні')">Через 2 дні</button>
            ${lead.nextFollowUpAt ? `
              <span style="${isReminderOverdue(lead) ? 'background:#fef2f2;color:#b91c1c;border:1px solid #ef4444;' : 'background:#fef3c7;color:#92400e;'}font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;">
                ${isReminderOverdue(lead) ? '🔥' : '📌'} ${escapeHtml(formatReminderLabel(lead.nextFollowUpAt))}
                <button style="border:none;background:transparent;color:#b91c1c;cursor:pointer;font-weight:800;margin-left:3px;" onclick="window.setFollowUpReminder('${lead.id}', '')">✕</button>
              </span>
            ` : ''}
          </div>
        </div>

        <!-- 3-SECOND 1-CLICK LOGGER (ТАНЯ / РИТА / АНАСТАСІЯ) -->
        <div class="tanya-logger-box">
          <div class="logger-title">
            <span>⚡ Надшвидкий логгер торкань (${curAuthor} • в 1 клік = 3 сек)</span>
            <span style="color:#047857;">Торкань: ${lead.rushTouchesCount || 0}</span>
          </div>
          <div class="quick-touch-grid">
            ${QUICK_TOUCH_ACTIONS.map((act, idx) => `
              <button
                class="qt-btn ${act.newStage === 'lost' ? 'danger' : ''}"
                onclick="window.runQuickTouch('${lead.id}', ${idx})"
              >
                ${act.label}
              </button>
            `).join('')}
          </div>
          <div class="comment-inline-row">
            <input
              type="text"
              id="quick-comment-input"
              class="comment-input"
              placeholder="Швидкий коментар від ${curAuthor} (Enter — зберегти за 1 мс)..."
              onkeydown="if(event.key==='Enter') window.submitInlineComment('${lead.id}')"
            />
            <button class="xo-btn xo-btn-lime" onclick="window.submitInlineComment('${lead.id}')">
              Зберегти
            </button>
          </div>
        </div>

        <!-- ПОВНА РЕДАГОВАНА АНКЕТА ТУРИСТА (ЗБЕРІГАЄТЬСЯ В БАЗІ ДАНИХ) -->
        <div style="background:#f8fafc;padding:13px;border-radius:11px;border:1px solid #e2e8f0;">
          <div style="font-size:11.5px;font-weight:800;color:#153629;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>📋 Анкета туриста (всі поля редагуються і зберігаються в БД)</span>
            <span style="font-size:10.5px;color:#047857;font-weight:700;">💾 Автозбереження при зміні</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Ім'я та прізвище (UA / RU / EN латиниця)</label>
              <input
                type="text"
                value="${escapeHtml(lead.clientName)}"
                placeholder="Олена Ковальчук / Елена / Olena Kovalchuk"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'clientName', this.value)"
              />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Телефон</label>
              <input
                type="text"
                value="${escapeHtml(lead.phone)}"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'phone', this.value)"
              />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Статус воронки</label>
              <select
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.changeStageFromDrawer('${lead.id}', this.value)"
              >
                ${STAGES.map(s => `<option value="${s.id}" ${lead.stage === s.id ? 'selected' : ''}>${s.title}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Відповідальний менеджер</label>
              <select
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.transferLead('${lead.id}', this.value)"
              >
                <option value="tetiana" ${lead.assignedTo === 'tetiana' || !lead.assignedTo ? 'selected' : ''}>👩‍💼 Тетяна</option>
                <option value="rita" ${lead.assignedTo === 'rita' ? 'selected' : ''}>👩‍💻 Рита</option>
                <option value="anastasiia" ${lead.assignedTo === 'anastasiia' ? 'selected' : ''}>👩‍💼 Анастасія</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Сегмент напрямку</label>
              <select
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'segment', this.value)"
              >
                ${SEGMENTS.filter(s => s.id !== 'all').map(s => `<option value="${s.id}" ${lead.segment === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Країна / Курорт</label>
              <input
                type="text"
                value="${escapeHtml(lead.destination)}"
                placeholder="Напр. Єгипет, Шарм-ель-Шейх"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'destination', this.value)"
              />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Місто вильоту</label>
              <input
                type="text"
                value="${escapeHtml(lead.departureCity)}"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'departureCity', this.value)"
              />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;">Дати вильоту / Період</label>
                <div style="position:relative;display:inline-flex;align-items:center;gap:4px;">
                  <button
                    type="button"
                    class="q-chip"
                    style="padding:2px 7px;font-size:10.5px;background:#ecfdf5;border-color:#a7f3d0;color:#065f46;font-weight:800;"
                    onclick="window.openPickerById('travel-date-from')"
                  >
                    📅 Обрати дати
                  </button>
                  <input
                    id="travel-date-from"
                    type="date"
                    style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;"
                    onchange="window.onTravelDatePicked('${lead.id}', 'from', this.value)"
                  />
                  <input
                    id="travel-date-to"
                    type="date"
                    style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;"
                    onchange="window.onTravelDatePicked('${lead.id}', 'to', this.value)"
                  />
                </div>
              </div>
              <input
                id="travel-dates-text-input"
                type="text"
                value="${escapeHtml(lead.travelDates || '')}"
                placeholder="Напр. 12.11 - 19.11 (7 ночей)"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'travelDates', this.value)"
              />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Склад сім'ї</label>
              <select
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'familyComposition', this.value)"
              >
                ${['2', '2+1', '2+2', '1', '3+'].map(fc => `<option value="${fc}" ${lead.familyComposition === fc ? 'selected' : ''}>👨‍👩‍👧 ${fc}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Орієнтовний бюджет (€)</label>
              <input
                type="number"
                value="${Math.round(lead.budgetEUR || 0)}"
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadBudgetEUR('${lead.id}', this.value)"
              />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#64748b;">Джерело звернення</label>
              <select
                style="width:100%;padding:7px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;margin-top:3px;"
                onchange="window.updateLeadField('${lead.id}', 'sourceChannel', this.value)"
              >
                ${SOURCES.filter(s => s.id !== 'all').map(s => `<option value="${s.id}" ${normalizeSource(lead.sourceChannel) === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
            ${hasSpecificLandingHotel(lead) ? `
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">🏨 Готель (обраний на лендінгу)</label>
                <input
                  type="text"
                  value="${escapeHtml(lead.hotelName || '')}"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;font-weight:700;margin-top:3px;"
                  onchange="window.updateLeadField('${lead.id}', 'hotelName', this.value)"
                />
              </div>
            ` : ''}
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;">⏰ Нагадування: коли передзвонити</label>
                <div style="position:relative;display:inline-flex;align-items:center;">
                  <button
                    type="button"
                    class="q-chip"
                    style="padding:2px 8px;font-size:10.5px;background:#fef3c7;border-color:#fcd34d;color:#92400e;font-weight:800;"
                    onclick="window.openPickerById('reminder-calendar-picker')"
                  >
                    📅 Обрати календар
                  </button>
                  <input
                    id="reminder-calendar-picker"
                    type="datetime-local"
                    style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;"
                    onchange="window.setFollowUpReminder('${lead.id}', this.value)"
                  />
                </div>
              </div>
              <div style="display:flex;gap:5px;margin-top:3px;">
                <input
                  type="text"
                  value="${escapeHtml(formatReminderLabel(lead.nextFollowUpAt || ''))}"
                  placeholder="Оберіть у календарі або напишіть (Завтра 14:00)"
                  style="flex:1;padding:7px;border-radius:7px;border:1px solid #cbd5e1;"
                  onchange="window.setFollowUpReminder('${lead.id}', this.value)"
                />
                ${lead.nextFollowUpAt ? `
                  <button
                    type="button"
                    class="q-chip"
                    style="padding:0 8px;color:#b91c1c;border-color:#fca5a5;"
                    onclick="window.setFollowUpReminder('${lead.id}', '')"
                    title="Очистити нагадування"
                  >✕</button>
                ` : ''}
              </div>
            </div>
            ${lead.stage === 'booked' ? `
              <div style="grid-column:1 / -1;background:#ecfdf5;border:1.5px solid #10b981;border-radius:9px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:18px;">📄</span>
                  <div>
                    <div style="font-size:12.5px;font-weight:800;color:#065f46;">Договір створено в X-ISO CRM (Центральний офіс)</div>
                    <div style="font-size:11px;color:#047857;font-weight:600;">Бронювання підтверджено • Оформлення договору та документів у центральному офісі</div>
                  </div>
                </div>
                <span style="background:#153629;color:#d9ef9f;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:99px;">✅ X-ISO CRM</span>
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">Обраний готель (Бронь)</label>
                <input
                  type="text"
                  value="${escapeHtml(lead.hotelName)}"
                  placeholder="Напр. Sunrise Arabian 5*"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;margin-top:3px;font-weight:700;"
                  onchange="window.updateLeadField('${lead.id}', 'hotelName', this.value)"
                />
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">Вартість туру (₴)</label>
                <input
                  type="number"
                  value="${Math.round(lead.budgetUAH || 0)}"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;margin-top:3px;font-weight:700;"
                  onchange="window.updateLeadBudget('${lead.id}', this.value)"
                />
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">Комісія агентства (₴)</label>
                <input
                  type="number"
                  value="${Math.round(lead.agencyCommissionUAH || 0)}"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;margin-top:3px;font-weight:700;"
                  onchange="window.updateLeadField('${lead.id}', 'agencyCommissionUAH', Number(this.value))"
                />
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">Передоплата внесена (₴)</label>
                <input
                  type="number"
                  value="${Math.round(lead.prepaymentUAH || 0)}"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;margin-top:3px;font-weight:700;"
                  onchange="window.updateLeadField('${lead.id}', 'prepaymentUAH', Number(this.value))"
                />
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:#047857;">Залишок доплати ТО (₴)</label>
                <input
                  type="number"
                  value="${Math.round(lead.remainingBalanceUAH || 0)}"
                  style="width:100%;padding:7px;border-radius:7px;border:1px solid #a7f3d0;background:#ecfdf5;margin-top:3px;font-weight:700;"
                  onchange="window.updateLeadField('${lead.id}', 'remainingBalanceUAH', Number(this.value))"
                />
              </div>
            ` : ''}
          </div>

          <div style="margin-top:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:6px;">
              <label style="font-weight:800;font-size:11px;color:#475569;text-transform:uppercase;">
                Побажання туриста з анкети / лендінгу / Комбінації (повний текст без обрізання):
              </label>
              <div style="display:flex;align-items:center;gap:8px;">
                <span id="wishes-save-status" style="font-size:10.5px;color:#047857;font-weight:800;">✅ Збережено в БД</span>
                <button
                  type="button"
                  class="xo-btn xo-btn-lime"
                  style="padding:3px 10px;font-size:11px;"
                  onclick="window.saveWishesExplicit('${lead.id}')"
                >
                  💾 Зберегти побажання
                </button>
              </div>
            </div>
            <textarea
              id="lead-wishes-textarea"
              style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;line-height:1.5;background:#fff;resize:vertical;min-height:130px;overflow-y:hidden;white-space:pre-wrap;"
              rows="${Math.max(5, (lead.wishes || '').split('\n').length + 1)}"
              placeholder="Впишіть побажання клієнта (бухта без вітру, риф, перша лінія, харчування тощо)..."
              oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';window.onWishesInput('${lead.id}', this.value)"
            >${escapeHtml(lead.wishes || '')}</textarea>
          </div>
        </div>

        <!-- ДОДАТКОВІ КОМЕНТАРІ В АНКЕТІ ТУРИСТА (ЩО ЗМІНИЛОСЬ / ДЕТАЛІ) -->
        <div style="background:#f0fdf4;border:1px solid #a7f3d0;padding:12px 13px;border-radius:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-weight:800;font-size:11.5px;color:#153629;text-transform:uppercase;">
              🔗 Посилання на підбір туру / Збережені підбірки (${(lead.selectionLinks || []).length})
            </label>
          </div>
          <div style="display:flex;gap:7px;margin-bottom:8px;">
            <input
              type="text"
              id="new-selection-title"
              class="comment-input"
              style="flex:0.45;padding:7px 10px;font-size:12.5px;"
              placeholder="Назва (напр. Шарм ТОП-3)"
            />
            <input
              type="url"
              id="new-selection-url"
              class="comment-input"
              style="flex:1;padding:7px 10px;font-size:12.5px;"
              placeholder="Вставте посилання на підбірку (https://...)"
              onkeydown="if(event.key==='Enter') window.addSelectionLink('${lead.id}')"
            />
            <button class="xo-btn xo-btn-lime" style="padding:7px 12px;" onclick="window.addSelectionLink('${lead.id}')">
              + Зберегти
            </button>
          </div>
          ${(lead.selectionLinks || []).length ? `
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${lead.selectionLinks.map((item, idx) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border:1px solid #d1fae5;padding:6px 10px;border-radius:8px;font-size:12.5px;">
                  <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    <strong style="color:#153629;">${escapeHtml(item.title || 'Підбірка туру')}:</strong>
                    <a href="${escapeHtml(item.url)}" target="_blank" style="color:#047857;margin-left:5px;text-decoration:underline;">
                      ${escapeHtml(item.url)}
                    </a>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <button
                      class="q-chip"
                      style="padding:3px 8px;font-size:11px;background:#ecfdf5;border-color:#a7f3d0;color:#065f46;"
                      onclick="window.copySelectionUrl(event, '${escapeHtml(item.url)}')"
                    >
                      📋 Копіювати
                    </button>
                    <button
                      style="border:none;background:transparent;color:#dc2626;cursor:pointer;font-weight:800;font-size:12px;"
                      onclick="window.removeSelectionLink('${lead.id}', ${idx})"
                      title="Видалити посилання"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:11.5px;color:#64748b;">Збережених посилань на підбірки ще немає. Додайте посилання вище — воно збережеться в анкеті та на картці канбану.</div>
          `}
        </div>

        <!-- ДОДАТКОВІ КОМЕНТАРІ В АНКЕТІ ТУРИСТА (СТРІЧКА КОМЕНТАРІВ МЕНЕДЖЕРА) -->
        <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:12px 13px;border-radius:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <label style="font-weight:800;font-size:11.5px;color:#153629;text-transform:uppercase;">
              📝 Додаткові коментарі по анкеті (що змінилось, деталі підбору):
            </label>
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="font-size:11px;color:#64748b;font-weight:700;">Хто пише:</span>
              <select
                id="mgr-comment-author"
                style="padding:3px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:11.5px;font-weight:800;color:#153629;background:#fff;"
              >
                <option value="Тетяна" ${state.currentUser === 'tetiana' ? 'selected' : ''}>Тетяна</option>
                <option value="Рита" ${state.currentUser === 'rita' ? 'selected' : ''}>Рита</option>
                <option value="Анастасія" ${state.currentUser === 'anastasiia' ? 'selected' : ''}>Анастасія</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:7px;margin-bottom:8px;">
            <textarea
              id="lead-situation-notes"
              style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;background:#fff;resize:vertical;min-height:44px;"
              placeholder="Напишіть новий коментар (що змінилось по датах, готелях, складу сім'ї)..."
              onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); window.addManagerThreadComment('${lead.id}'); }"
            ></textarea>
            <button class="xo-btn xo-btn-lime" style="align-self:stretch;padding:0 14px;" onclick="window.addManagerThreadComment('${lead.id}')">
              + Додати
            </button>
          </div>
          ${(() => {
            const mgrLogs = (lead.touchLogs || []).filter(lg =>
              (lg.actionType === 'comment' ||
               lg.actionType === 'manager_note' ||
               lg.actionType === 'quick_touch' ||
               lg.actionType === 'combination_form' ||
               lg.actionType === 'lost_form' ||
               lg.actionType === 'postponed_form') &&
              lg.comment &&
              !lg.comment.includes('Швидке касание у Режимі Вогню')
            );
            if (!mgrLogs.length && !lead.currentSituation) {
              return `<div style="font-size:11.5px;color:#64748b;">Додаткових коментарів ще немає.</div>`;
            }
            return `
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${mgrLogs.map(lg => {
                  const isComb = lg.actionType === 'combination_form';
                  const isLost = lg.actionType === 'lost_form';
                  const isPostponed = lg.actionType === 'postponed_form';
                  const borderColor = isComb ? '#047857' : (isLost ? '#dc2626' : (isPostponed ? '#d97706' : '#153629'));
                  const bgHeader = isComb ? '#dcfce7' : (isLost ? '#fee2e2' : (isPostponed ? '#fef3c7' : '#e2e8f0'));
                  return `
                    <div style="background:#fff;border:1px solid #e2e8f0;border-left:3px solid ${borderColor};padding:8px 10px;border-radius:7px;font-size:12.5px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                        <strong style="color:#153629;background:${bgHeader};padding:2px 7px;border-radius:5px;">👤 ${escapeHtml(lg.author)} • ${escapeHtml(lg.label || 'Коментар')}</strong>
                        <div style="display:flex;gap:8px;align-items:center;">
                          <button
                            style="border:none;background:transparent;color:#047857;font-size:11px;font-weight:800;cursor:pointer;padding:0;"
                            onclick="window.editTouchLog('${lead.id}', '${lg.id}', ${JSON.stringify(lg.comment || '').replace(/"/g, '&quot;')})"
                          >
                            ✏️ Редагувати
                          </button>
                          <span>🕒 ${formatDateTime(lg.createdAt)}</span>
                        </div>
                      </div>
                      <div style="color:#1e293b;white-space:pre-line;word-break:break-word;line-height:1.4;margin-top:3px;">${escapeHtml(lg.comment)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          })()}
        </div>

        <!-- DEAL TOUCH LOG HISTORY (WITH EDITABLE COMMENTS) -->
        <div>
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#153629;margin-bottom:8px;">
            📜 Історія угоди та лог торкань (${(lead.touchLogs || []).length})
          </div>
          <div class="history-list">
            ${(lead.touchLogs || []).length ? lead.touchLogs.map(lg => `
              <div class="history-item">
                <div class="history-meta">
                  <strong>👤 ${escapeHtml(lg.author)} • ${escapeHtml(lg.label)}</strong>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button
                      style="border:none;background:transparent;color:#047857;font-size:11px;font-weight:800;cursor:pointer;padding:0;"
                      onclick="window.editTouchLog('${lead.id}', '${lg.id}', ${ JSON.stringify(lg.comment || '').replace(/"/g, '&quot;') })"
                    >
                      ✏️ Редагувати
                    </button>
                    <span>🕒 ${formatDateTime(lg.createdAt)}</span>
                  </div>
                </div>
                ${lg.comment ? `<div style="color:#1e293b;margin-top:3px;white-space:pre-line;word-break:break-word;line-height:1.4;">${escapeHtml(lg.comment)}</div>` : ''}
              </div>
            `).join('') : `<div style="color:#94a3b8;font-size:12.5px;">Логів ще немає. Натисніть швидку кнопку вище!</div>`}
          </div>
        </div>

        <!-- МАЛЕНЬКА ПЛАШКА ВНИЗУ: КОМЕНТАР КЕРІВНИКА (СТРІЧКА ПЕРЕПИСКИ + СТАТУСИ ПРОПОЗИЦІЇ) -->
        <div id="director-block" style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:10px 12px;margin-top:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
            <span style="font-size:11px;font-weight:800;color:#854d0e;text-transform:uppercase;letter-spacing:0.03em;">
              Коментар керівника
            </span>
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="font-size:11px;color:#854d0e;font-weight:700;">Від кого:</span>
              <select
                id="dir-comment-author"
                style="padding:2px 7px;border-radius:6px;border:1px solid #fde047;font-size:11.5px;font-weight:800;color:#713f12;background:#fff;"
              >
                <option value="Анастасія" ${state.currentUser === 'anastasiia' ? 'selected' : ''}>Анастасія</option>
                <option value="Тетяна" ${state.currentUser === 'tetiana' ? 'selected' : ''}>Тетяна</option>
                <option value="Рита" ${state.currentUser === 'rita' ? 'selected' : ''}>Рита</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:7px;margin-bottom:8px;">
            <textarea
              id="director-note-input"
              style="flex:1;border:1px solid #fde047;border-radius:7px;padding:7px 9px;font-family:inherit;font-size:12.5px;background:#fff;color:#713f12;font-weight:600;resize:vertical;min-height:40px;"
              placeholder="Напишіть рекомендацію або пропозицію (Enter — відправити)..."
              onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); window.addDirectorThreadComment('${lead.id}'); }"
            ></textarea>
            <button
              class="xo-btn"
              style="background:#854d0e;color:#fef9c3;align-self:stretch;padding:0 12px;"
              onclick="window.addDirectorThreadComment('${lead.id}')"
            >
              + Додати
            </button>
          </div>
          ${(() => {
            const dirLogs = (lead.touchLogs || []).filter(lg => lg.actionType === 'director_comment');
            if (!dirLogs.length && !lead.directorNote) {
              return `<div style="font-size:11.5px;color:#a16207;">Повідомлень у блоці керівника ще немає.</div>`;
            }
            return `
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${dirLogs.map(lg => {
                  const curStatus = lg.label || 'Запропонувала';
                  return `
                    <div style="background:#fffbeb;border:1px solid #fde047;border-left:3px solid #ca8a04;padding:7px 10px;border-radius:7px;font-size:12.5px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#854d0e;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                        <strong style="background:#fef08a;color:#713f12;padding:1px 7px;border-radius:5px;font-size:11px;">👤 ${escapeHtml(lg.author)}</strong>
                        <div style="display:flex;gap:8px;align-items:center;">
                          <button
                            style="border:none;background:transparent;color:#854d0e;font-size:10.5px;font-weight:800;cursor:pointer;padding:0;"
                            onclick="window.editTouchLog('${lead.id}', '${lg.id}', ${JSON.stringify(lg.comment || '').replace(/"/g, '&quot;')})"
                          >
                            ✏️ Редагувати
                          </button>
                          <span>🕒 ${formatDateTime(lg.createdAt)}</span>
                        </div>
                      </div>
                      <div style="color:#713f12;font-weight:600;white-space:pre-line;margin-bottom:6px;">${escapeHtml(lg.comment)}</div>
                      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                        ${['💡 Запропонувала', '✅ Підійшло', '❌ Не підійшло'].map(stLabel => {
                          const isActive = curStatus === stLabel;
                          let activeStyle = 'background:#fff;color:#713f12;border:1px solid #fde047;';
                          if (isActive && stLabel.includes('Запропонувала')) activeStyle = 'background:#fef08a;color:#854d0e;border:1px solid #ca8a04;font-weight:800;';
                          if (isActive && stLabel.includes('Підійшло')) activeStyle = 'background:#dcfce7;color:#166534;border:1px solid #22c55e;font-weight:800;';
                          if (isActive && stLabel.includes('Не підійшло')) activeStyle = 'background:#fee2e2;color:#991b1b;border:1px solid #ef4444;font-weight:800;';
                          return `
                            <button
                              style="padding:2px 8px;border-radius:99px;font-size:10.5px;cursor:pointer;font-family:inherit;${activeStyle}"
                              onclick="window.setDirectorProposalStatus('${lead.id}', '${lg.id}', '${stLabel}')"
                            >
                              ${stLabel}
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          })()}
        </div>
      </aside>
    </div>
  `;
}

function renderEveningCarouselModal() {
  if (!state.eveningCarouselOpen) return '';
  const touchedLeads = state.leads.filter(l => l.touchedToday);
  const current = touchedLeads[state.carouselIndex] || null;

  return `
    <div class="modal-backdrop" onclick="window.closeEveningCarousel()">
      <div class="carousel-modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="background:#153629;color:#d9ef9f;font-weight:800;font-size:11px;padding:3px 9px;border-radius:99px;">
            🌙 ВЕЧІРНЯ КАРУСЕЛЬ (ПІДСУМКИ ДНЯ)
          </span>
          <button class="xo-btn" onclick="window.closeEveningCarousel()">✕</button>
        </div>

        ${!current ? `
          <div style="text-align:center;padding:24px 0;">
            <h3 style="margin-bottom:8px;">Сьогодні ще не було швидких торкань у Rush-режимі</h3>
            <p style="font-size:13px;color:#64748b;">Увімкніть «🔥 Режим Вогню» або натисніть кнопку торкання в картці клієнта.</p>
          </div>
        ` : `
          <div style="margin-bottom:14px;">
            <div style="font-size:12px;color:#64748b;font-weight:700;">Картка ${state.carouselIndex + 1} з ${touchedLeads.length}</div>
            <h3 style="font-size:19px;font-weight:800;margin-top:4px;">#${current.shortId} ${escapeHtml(current.clientName)}</h3>
            <p style="font-size:13px;color:#334155;margin-top:4px;">
              ✈️ ${escapeHtml(current.departureCity)} → ${escapeHtml(current.destination)} • 💶 €${formatMoney(current.budgetEUR)}
            </p>
            <div style="margin-top:10px;">
              <label style="font-size:11.5px;font-weight:800;color:#153629;display:block;margin-bottom:5px;">
                📝 Новий коментар / Підсумок дня по клієнту (додається в переписку та анкету):
              </label>
              <div style="display:flex;gap:7px;">
                <textarea
                  id="carousel-comment-input"
                  class="comment-input"
                  rows="3"
                  style="width:100%;resize:vertical;"
                  placeholder="Напишіть новий коментар: про що домовились або яка ситуація..."
                  onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); window.saveCarouselComment('${current.id}'); }"
                ></textarea>
                <button
                  class="xo-btn xo-btn-lime"
                  style="align-self:stretch;"
                  onclick="window.saveCarouselComment('${current.id}')"
                >
                  + Додати в переписку
                </button>
              </div>
              ${(() => {
                const threadLogs = (current.touchLogs || []).filter(lg =>
                  (lg.comment && lg.comment.trim() && !lg.comment.includes('Швидке касание у Режимі Вогню'))
                );
                if (!threadLogs.length && !current.currentSituation) return '';
                return `
                  <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">💬 Переписка та збережені коментарі (${threadLogs.length}):</div>
                    ${threadLogs.map(lg => `
                      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #153629;padding:7px 10px;border-radius:7px;font-size:12.5px;">
                        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748b;margin-bottom:3px;">
                          <strong style="color:#153629;">👤 ${escapeHtml(lg.author)} • ${escapeHtml(lg.label || 'Коментар')}</strong>
                          <span>🕒 ${formatDateTime(lg.createdAt)}</span>
                        </div>
                        <div style="color:#1e293b;white-space:pre-line;word-break:break-word;line-height:1.4;">${escapeHtml(lg.comment)}</div>
                      </div>
                    `).join('')}
                  </div>
                `;
              })()}
            </div>
          </div>

          <div style="font-size:12px;font-weight:800;margin-bottom:8px;">Куди перенести клієнта за підсумками дня? (коментар збережеться автоматично)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
            ${STAGES.map(s => `
              <button
                class="qt-btn"
                style="${current.stage === s.id ? 'border-color:#153629;background:#ecfdf5;' : ''}"
                onclick="window.carouselMoveStage('${current.id}', '${s.id}')"
              >
                ${s.title}
              </button>
            `).join('')}
          </div>

          <div style="display:flex;justify-content:space-between;">
            <button class="xo-btn" onclick="window.stepCarousel(-1)" ${state.carouselIndex === 0 ? 'disabled' : ''}>← Попередній</button>
            <button class="xo-btn xo-btn-lime" onclick="window.stepCarousel(1)" ${state.carouselIndex >= touchedLeads.length - 1 ? 'disabled' : ''}>Наступний →</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCombinationModal() {
  if (!state.combinationModalLeadId) return '';
  const lead = state.leads.find(l => l.id === state.combinationModalLeadId);
  if (!lead) return '';

  return `
    <div class="modal-backdrop" onclick="window.closeCombinationModal()">
      <div class="carousel-modal" style="max-width:700px;width:95%;padding:24px 26px;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:19px;font-weight:800;color:#13241c;margin:0;">Комбінація — побажання туриста</h3>
          <button
            class="xo-btn"
            style="border:2px solid #84cc16;background:#fff;color:#4d7c0f;padding:4px 10px;font-size:16px;border-radius:6px;"
            onclick="window.closeCombinationModal()"
          >✕</button>
        </div>

        <div style="font-size:16px;font-weight:800;color:#13241c;margin-bottom:14px;">
          ${escapeHtml(lead.clientName)}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Чи потрібен багаж 20 кг?</label>
            <select id="comb-baggage" class="comment-input" style="width:100%;padding:10px 12px;font-size:14px;">
              <option value="">Обери відповідь</option>
              <option value="Так, потрібен багаж 20 кг">Так, потрібен багаж 20 кг</option>
              <option value="Ні, тільки ручна поклажа">Ні, тільки ручна поклажа</option>
              <option value="1 валіза 20 кг на двох">1 валіза 20 кг на двох</option>
              <option value="Потрібно уточнити">Потрібно уточнити</option>
            </select>
          </div>

          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Які варіанти готелів розглядає?</label>
            <textarea
              id="comb-hotels"
              class="comment-input"
              rows="${Math.max(5, (lead.wishes || '').split('\n').length + 1)}"
              style="width:100%;resize:vertical;padding:10px 12px;font-size:14px;line-height:1.5;min-height:120px;overflow-y:hidden;"
              oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';"
              placeholder="Вкажи готелі, категорію 4*/5*, першу лінію або напиши «Потрібно уточнити»..."
            >${escapeHtml(lead.wishes || '')}</textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <select id="comb-hotels-lang" class="comment-input" style="padding:5px 10px;font-size:12px;width:auto;">
                <option value="uk-UA">Українська</option>
                <option value="ru-RU">Русский</option>
              </select>
              <button
                type="button"
                class="xo-btn"
                style="background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;font-size:12px;padding:5px 11px;"
                onclick="window.startVoiceDictation('comb-hotels', 'comb-hotels-lang')"
              >
                🎙️ Диктувати
              </button>
            </div>
          </div>

          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Скільки туристів?</label>
            <input
              id="comb-tourists"
              type="text"
              class="comment-input"
              style="width:100%;padding:10px 12px;font-size:14px;"
              value="${escapeHtml(lead.familyComposition || '2 дорослих')}"
              placeholder="Напр. 2 дорослих + 1 дитина (7 років)"
            />
          </div>

          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Які аеропорти вильоту?</label>
            <textarea
              id="comb-airports"
              class="comment-input"
              rows="${Math.max(4, (lead.departureCity || '').split('\n').length + 1)}"
              style="width:100%;resize:vertical;padding:10px 12px;font-size:14px;line-height:1.5;min-height:92px;overflow-y:hidden;"
              oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';"
              placeholder="Вкажи всі підходящі аеропорти через кому (напр. Кишинів, Варшава, Сучава)..."
            >${escapeHtml(lead.departureCity || '')}</textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <select id="comb-airports-lang" class="comment-input" style="padding:5px 10px;font-size:12px;width:auto;">
                <option value="uk-UA">Українська</option>
                <option value="ru-RU">Русский</option>
              </select>
              <button
                type="button"
                class="xo-btn"
                style="background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;font-size:12px;padding:5px 11px;"
                onclick="window.startVoiceDictation('comb-airports', 'comb-airports-lang')"
              >
                🎙️ Диктувати
              </button>
            </div>
            <div style="font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.35;">
              Вкажи всі підходящі аеропорти через кому. Якщо готелі або аеропорти поки не визначені, напиши «Потрібно уточнити».
            </div>
          </div>

          <div id="comb-modal-error" style="display:none;background:#fee2e2;color:#b91c1c;padding:8px 11px;border-radius:8px;font-size:12px;font-weight:700;"></div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px;">
            <button
              class="xo-btn"
              style="background:#fff;border:1px solid #cbd5e1;color:#1e293b;padding:9px 18px;"
              onclick="window.closeCombinationModal()"
            >
              Скасувати
            </button>
            <button
              class="xo-btn"
              style="background:#153629;color:#fff;padding:9px 20px;font-weight:800;"
              onclick="window.submitCombinationModal()"
            >
              Зберегти і перевести в «Комбінацію»
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLostReasonModal() {
  if (!state.lostModalLeadId) return '';
  const lead = state.leads.find(l => l.id === state.lostModalLeadId);
  if (!lead) return '';

  return `
    <div class="modal-backdrop" onclick="window.closeLostModal()">
      <div class="carousel-modal" style="max-width:680px;width:95%;padding:24px 26px;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:19px;font-weight:800;color:#13241c;margin:0;">Перед переводом у «Втрачено»</h3>
          <button
            class="xo-btn"
            style="border:2px solid #84cc16;background:#fff;color:#4d7c0f;padding:4px 10px;font-size:16px;border-radius:6px;"
            onclick="window.closeLostModal()"
          >✕</button>
        </div>

        <div style="font-size:16px;font-weight:800;color:#13241c;margin-bottom:8px;">
          ${escapeHtml(lead.clientName)}
        </div>

        <div style="font-size:14.5px;font-weight:800;color:#13241c;margin-bottom:4px;">
          Зроблено торкання останньої надії?
        </div>
        <div style="font-size:12.5px;color:#64748b;margin-bottom:10px;">
          Останній дзвінок або повідомлення туристу перед закриттям ліда.
        </div>

        <div style="font-size:13.5px;color:#13241c;margin-bottom:14px;">
          Всього записано торкань: <strong>${lead.rushTouchesCount || 0}</strong>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Причина втрати</label>
            <select id="lost-reason-select" class="comment-input" style="width:100%;padding:10px 12px;font-size:14px;">
              <option value="">Обери причину</option>
              <option value="Придбав у іншому агентстві">1. Придбав у іншому агентстві</option>
              <option value="Дорого / Не пройшли по бюджету">2. Дорого / Не пройшли по бюджету</option>
              <option value="Не вдається полетіти / Відмінили відпустку">3. Не вдається полетіти / Відмінили відпустку</option>
              <option value="Змінилися плани / Перенесли дати">4. Змінилися плани / Перенесли дати</option>
              <option value="Не виходить на зв'язок після торкань">5. Не виходить на зв'язок після торкань</option>
              <option value="Інше">6. Інше (свій коментар нижче)</option>
            </select>
          </div>

          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Коментар до причини</label>
            <textarea
              id="lost-reason-comment"
              class="comment-input"
              rows="5"
              style="width:100%;resize:vertical;padding:10px 12px;font-size:14px;line-height:1.5;min-height:125px;overflow-y:hidden;"
              oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';"
              placeholder="Напиши деталі (чому саме відмовились, що пропонували в останньому торканні)..."
            ></textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <select id="lost-comment-lang" class="comment-input" style="padding:5px 10px;font-size:12px;width:auto;">
                <option value="uk-UA">Українська</option>
                <option value="ru-RU">Русский</option>
              </select>
              <button
                type="button"
                class="xo-btn"
                style="background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;font-size:12px;padding:5px 11px;"
                onclick="window.startVoiceDictation('lost-reason-comment', 'lost-comment-lang')"
              >
                🎙️ Диктувати
              </button>
            </div>
          </div>

          <div id="lost-modal-error" style="display:none;background:#fee2e2;color:#b91c1c;padding:8px 11px;border-radius:8px;font-size:12px;font-weight:700;"></div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px;">
            <button
              class="xo-btn"
              style="background:#fff;border:1px solid #cbd5e1;color:#1e293b;padding:9px 18px;"
              onclick="window.closeLostModal()"
            >
              Ні
            </button>
            <button
              class="xo-btn"
              style="background:#153629;color:#fff;padding:9px 20px;font-weight:800;"
              onclick="window.submitLostModal()"
            >
              Так — перевести у «Втрачено»
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPostponedModal() {
  if (!state.postponedModalLeadId) return '';
  const lead = state.leads.find(l => l.id === state.postponedModalLeadId);
  if (!lead) return '';

  return `
    <div class="modal-backdrop" onclick="window.closePostponedModal()">
      <div class="carousel-modal" style="max-width:680px;width:95%;padding:24px 26px;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
          <h3 style="font-size:19px;font-weight:800;color:#13241c;margin:0;">⏸️ Переведення у «Відкладено»</h3>
          <button
            class="xo-btn"
            style="border:2px solid #84cc16;background:#fff;color:#4d7c0f;padding:4px 10px;font-size:16px;border-radius:6px;"
            onclick="window.closePostponedModal()"
          >✕</button>
        </div>

        <div style="font-size:16px;font-weight:800;color:#13241c;margin-bottom:10px;">
          ${escapeHtml(lead.clientName)}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Чому лід було відкладено? (Причина)</label>
            <select id="postponed-reason-select" class="comment-input" style="width:100%;padding:10px 12px;font-size:14px;">
              <option value="">Обери причину відкладення</option>
              <option value="Перенесли відпустку на інші дати">1. Перенесли відпустку на інші дати</option>
              <option value="Чекають погодження відпустки на роботі">2. Чекають погодження відпустки на роботі</option>
              <option value="Оформлюють закордонні паспорти / документи">3. Оформлюють закордонні паспорти / документи</option>
              <option value="Чекають фінанси / зарплату">4. Чекають фінанси / зарплату</option>
              <option value="Планують раннє бронювання пізніше">5. Планують раннє бронювання пізніше</option>
              <option value="Інша причина">6. Інша причина (свій коментар нижче)</option>
            </select>
          </div>

          <div>
            <label style="font-size:13px;font-weight:700;color:#1e293b;display:block;margin-bottom:5px;">Коментар (чому відклали та про що домовились)</label>
            <textarea
              id="postponed-reason-comment"
              class="comment-input"
              rows="5"
              style="width:100%;resize:vertical;padding:10px 12px;font-size:14px;line-height:1.5;min-height:125px;overflow-y:hidden;"
              oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';"
              placeholder="Напиши деталі: чому клієнт відклав поїздку та коли повернутися до підбору..."
            ></textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <select id="postponed-comment-lang" class="comment-input" style="padding:5px 10px;font-size:12px;width:auto;">
                <option value="uk-UA">Українська</option>
                <option value="ru-RU">Русский</option>
              </select>
              <button
                type="button"
                class="xo-btn"
                style="background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;font-size:12px;padding:5px 11px;"
                onclick="window.startVoiceDictation('postponed-reason-comment', 'postponed-comment-lang')"
              >
                🎙️ Диктувати
              </button>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <label style="font-size:12.5px;font-weight:700;color:#1e293b;">⏰ Нагадування: коли зв'язатися знову?</label>
              <button
                type="button"
                class="q-chip"
                style="padding:3px 9px;font-size:11px;background:#fef3c7;border-color:#fcd34d;color:#92400e;font-weight:800;"
                onclick="window.openPickerById('postponed-followup-date')"
              >
                📅 Обрати календар
              </button>
            </div>
            <input
              id="postponed-followup-date"
              type="datetime-local"
              class="comment-input"
              style="width:100%;padding:8px 11px;font-size:13px;"
            />
          </div>

          <div id="postponed-modal-error" style="display:none;background:#fee2e2;color:#b91c1c;padding:8px 11px;border-radius:8px;font-size:12px;font-weight:700;"></div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px;">
            <button
              class="xo-btn"
              style="background:#fff;border:1px solid #cbd5e1;color:#1e293b;padding:9px 18px;"
              onclick="window.closePostponedModal()"
            >
              Скасувати
            </button>
            <button
              class="xo-btn"
              style="background:#153629;color:#fff;padding:9px 20px;font-weight:800;"
              onclick="window.submitPostponedModal()"
            >
              Зберегти і перевести у «Відкладено»
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderNewLeadModal() {
  if (!state.newLeadModalOpen) return '';
  return `
    <div class="modal-backdrop" onclick="window.closeNewLeadModal()">
      <div class="carousel-modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="font-size:17px;font-weight:800;color:#153629;">📥 Новий лід (Лендінг / Каталог 47 / TG)</h3>
          <button class="xo-btn" onclick="window.closeNewLeadModal()">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="nl-name" class="comment-input" placeholder="Ім'я та прізвище (UA / RU / EN: Олена Ковальчук / Елена / Olena)" />
          <input id="nl-phone" class="comment-input" placeholder="Телефон (+380...)" value="+380" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <select id="nl-segment" class="comment-input">
              ${SEGMENTS.filter(s => s.id !== 'all').map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
            </select>
            <select id="nl-city" class="comment-input">
              <option value="Кишинів">🛫 Кишинів</option>
              <option value="Варшава">🛫 Варшава</option>
              <option value="Сучава">🛫 Сучава</option>
              <option value="Катовіце">🛫 Катовіце</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <input id="nl-budget" type="number" class="comment-input" placeholder="Бюджет у € (напр. 1450)" value="1450" />
            <select id="nl-source" class="comment-input">
              <option value="manual">✍️ Додано вручну</option>
              <option value="facebook">📘 Facebook</option>
              <option value="recommendation">🤝 Рекомендація</option>
              <option value="landing">🌐 Лендінг</option>
            </select>
          </div>
          <textarea id="nl-wishes" class="comment-input" rows="3" placeholder="Побажання (без вітру, теплий басейн, риф)..."></textarea>
          <button class="xo-btn xo-btn-lime" style="justify-content:center;padding:11px;" onclick="window.submitNewLead()">
            🚀 Додати в «Нові ліди» (таймер 15 хв)
          </button>
        </div>
      </div>
    </div>
  `;
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Global UI Handlers
window.onSearchInput = (val) => {
  state.searchQuery = val;
  render();
  const input = document.getElementById('global-search');
  if (input) {
    input.focus();
    input.setSelectionRange(val.length, val.length);
  }
};

window.setViewMode = (mode) => {
  state.viewMode = mode;
  render();
};

window.setSegment = (segId) => {
  state.activeSegment = segId;
  render();
};

window.setStageFilter = (stageId) => {
  state.filterStage = stageId;
  render();
};

window.setSourceFilter = (srcId) => {
  state.filterSource = srcId;
  render();
};

window.toggleBudgetFilter = () => {
  state.filterBudget1000 = !state.filterBudget1000;
  render();
};

window.setFamilyFilter = (fam) => {
  state.filterFamily = state.filterFamily === fam ? 'all' : fam;
  render();
};

window.setManagerFilter = (mgr) => {
  state.filterManager = state.filterManager === mgr ? 'all' : mgr;
  render();
};

window.setAlertFilter = (alertType) => {
  state.filterAlert = state.filterAlert === alertType ? 'all' : alertType;
  render();
};

window.resetFilters = () => {
  state.activeSegment = 'all';
  state.filterStage = 'all';
  state.filterSource = 'all';
  state.filterAlert = 'all';
  state.filterBudget1000 = false;
  state.filterFamily = 'all';
  state.filterManager = 'all';
  state.searchQuery = '';
  render();
};

window.toggleRushMode = () => {
  state.rushMode = !state.rushMode;
  render();
};

window.setRole = (role) => {
  state.currentRole = role;
  state.showFinanceCockpit = (role === 'director');
  render();
};

window.setUserProfile = (user) => {
  state.currentUser = user;
  state.currentRole = (user === 'anastasiia' ? 'director' : 'manager');
  state.showFinanceCockpit = (user === 'anastasiia');
  render();
};

window.toggleFinance = () => {
  state.showFinanceCockpit = !state.showFinanceCockpit;
  render();
};

window.openLead = (id) => {
  state.selectedLeadId = id;
  render();
};

window.closeLead = () => {
  state.selectedLeadId = null;
  render();
};

window.closeDrawerOnBackdrop = (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    window.closeLead();
  }
};

window.onRushTouch = async (e, leadId) => {
  e.stopPropagation();
  const author = getCurrentAuthorName();
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'rush_touch',
    label: `⚡ +1 торкання (${author})`,
    comment: ''
  });
};

function promptStageMoveReason(newStage, defaultReason = '') {
  if (newStage === 'lost') {
    const r = prompt('Вкажіть обов’язкову причину перенесення у «❌ Втрачено» (Дорого / Перенос дат / Обрали інше):', defaultReason || 'Дорого');
    return r ? r.trim() : null;
  }
  if (newStage === 'erroneous') {
    const r = prompt('Вкажіть обов’язкову причину перенесення у «🚫 Помилковий» (Дубль / Невірний номер / Спам / Не наш клієнт):', defaultReason || 'Невірний номер / Дубль');
    return r ? r.trim() : null;
  }
  if (newStage === 'postponed') {
    const r = prompt('Вкажіть причину або коли повернутись у «⏸️ Відкладено» (Чекають відпустку / Перенесли на наступний місяць):', defaultReason || 'Перенесли поїздку на пізніше');
    return r ? r.trim() : null;
  }
  return '';
}

window.runQuickTouch = async (leadId, actionIdx) => {
  const act = QUICK_TOUCH_ACTIONS[actionIdx];
  if (!act) return;
  if (act.newStage === 'lost') {
    window.openLostModal(leadId, act.lostReason || 'Дорого / Не пройшли по бюджету');
    return;
  }
  if (act.newStage === 'combination') {
    window.openCombinationModal(leadId);
    return;
  }
  if (act.newStage === 'postponed') {
    window.openPostponedModal(leadId);
    return;
  }
  const author = getCurrentAuthorName();
  let lostReason = act.lostReason || '';
  if (act.newStage === 'erroneous') {
    const prompted = promptStageMoveReason(act.newStage, lostReason);
    if (prompted === null) return;
    lostReason = prompted;
  }
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'quick_touch',
    label: act.label,
    comment: lostReason ? `${act.comment} (${lostReason})` : act.comment,
    newStage: act.newStage,
    lostReason,
    nextFollowUpAt: act.nextFollowUpAt || ''
  });
};

window.submitInlineComment = async (leadId) => {
  const el = document.getElementById('quick-comment-input');
  if (!el || !el.value.trim()) return;
  const text = el.value.trim();
  const author = getCurrentAuthorName();
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'comment',
    label: `💬 Швидкий коментар (${author})`,
    comment: text
  });
};

window.transferLead = async (leadId, targetManager) => {
  const author = getCurrentAuthorName();
  const targetLabel = targetManager === 'rita' ? 'Рита' : (targetManager === 'anastasiia' ? 'Анастасія' : 'Тетяна');
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author,
    fields: { assignedTo: targetManager },
    logLabel: `🤝 Передано лід менеджеру: ${targetLabel} (від ${author})`
  });
};

function resolveReminderPresetToIso(reminderText) {
  if (!reminderText) return '';
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const toLocalIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (reminderText === 'Сьогодні 18:00' || reminderText === 'today_18') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
    return toLocalIso(d);
  }
  if (reminderText === 'Завтра 11:00' || reminderText === 'tomorrow_11') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0);
    return toLocalIso(d);
  }
  if (reminderText === 'Через 2 дні' || reminderText === 'in_2_days') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 11, 0, 0);
    return toLocalIso(d);
  }
  return reminderText;
}

window.setFollowUpReminder = async (leadId, reminderText) => {
  const author = getCurrentAuthorName();
  const isoValue = resolveReminderPresetToIso(reminderText);
  const humanLabel = isoValue ? formatReminderLabel(isoValue) : '';
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author,
    fields: { nextFollowUpAt: isoValue },
    logLabel: isoValue ? `⏰ Встановлено нагадування: ${humanLabel} (${reminderText})` : '⏰ Нагадування знято'
  });
};

window.changeStageFromDrawer = async (leadId, newStage) => {
  if (newStage === 'combination') {
    window.openCombinationModal(leadId);
    return;
  }
  if (newStage === 'lost') {
    window.openLostModal(leadId);
    return;
  }
  if (newStage === 'postponed') {
    window.openPostponedModal(leadId);
    return;
  }
  let lostReason = '';
  if (newStage === 'erroneous') {
    const prompted = promptStageMoveReason(newStage);
    if (prompted === null) {
      render();
      return;
    }
    lostReason = prompted;
  }
  await apiCall('/api/leads/stage', 'POST', {
    leadId,
    stage: newStage,
    lostReason,
    author: getCurrentAuthorName()
  });
};

let wishesSaveTimer = null;
window.onWishesInput = (leadId, text) => {
  const lead = state.leads.find(l => l.id === leadId);
  if (lead) {
    lead.wishes = text;
  }
  const statusEl = document.getElementById('wishes-save-status');
  if (statusEl) {
    statusEl.textContent = '⏳ Зберігається...';
    statusEl.style.color = '#d97706';
  }
  if (wishesSaveTimer) clearTimeout(wishesSaveTimer);
  wishesSaveTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          author: getCurrentAuthorName(),
          fields: { wishes: text }
        })
      });
      const data = await res.json();
      if (data.leads) {
        state.leads = data.leads;
        state.kpis = data.kpis || {};
      }
      const st = document.getElementById('wishes-save-status');
      if (st) {
        st.textContent = '✅ Збережено в БД';
        st.style.color = '#047857';
      }
    } catch (e) {
      const st = document.getElementById('wishes-save-status');
      if (st) {
        st.textContent = '⚠️ Помилка збереження';
        st.style.color = '#dc2626';
      }
    }
  }, 350);
};

window.saveWishesExplicit = async (leadId) => {
  if (wishesSaveTimer) clearTimeout(wishesSaveTimer);
  const el = document.getElementById('lead-wishes-textarea');
  const text = el ? el.value : '';
  const statusEl = document.getElementById('wishes-save-status');
  if (statusEl) {
    statusEl.textContent = '⏳ Зберігається...';
    statusEl.style.color = '#d97706';
  }
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: { wishes: text },
    logLabel: `📋 Збережено побажання туриста: ${text}`
  });
};

window.openCombinationModal = (leadId) => {
  state.combinationModalLeadId = leadId;
  render();
};

window.closeCombinationModal = () => {
  state.combinationModalLeadId = null;
  render();
};

window.submitCombinationModal = async () => {
  const leadId = state.combinationModalLeadId;
  if (!leadId) return;
  const baggage = (document.getElementById('comb-baggage')?.value || '').trim();
  const hotels = (document.getElementById('comb-hotels')?.value || '').trim();
  const tourists = (document.getElementById('comb-tourists')?.value || '').trim();
  const airports = (document.getElementById('comb-airports')?.value || '').trim();
  const errEl = document.getElementById('comb-modal-error');

  if (!baggage || !hotels || !tourists || !airports) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Будь ласка, заповніть усі поля анкети для переводу в «Комбінацію» (багаж, готелі, кількість туристів та аеропорти вильоту).';
    }
    return;
  }

  const fullCombText = `🧩 Анкета Комбінації:\n• Багаж 20 кг: ${baggage}\n• Варіанти готелів: ${hotels}\n• Кількість туристів: ${tourists}\n• Аеропорти вильоту: ${airports}`;
  const author = getCurrentAuthorName();
  const lead = state.leads.find(l => l.id === leadId);
  const prevWishes = (lead?.wishes || '').trim();
  const combinedWishes = prevWishes && !prevWishes.includes(fullCombText) && prevWishes !== hotels
    ? `${prevWishes}\n\n${fullCombText}`
    : fullCombText;
  const validFamilies = ['2', '2+1', '2+2', '1', '3+'];
  const nextFamily = validFamilies.includes(tourists) ? tourists : (lead?.familyComposition || '2');

  state.combinationModalLeadId = null;
  if (state.eveningCarouselOpen) {
    const touchedLeads = state.leads.filter(l => l.touchedToday);
    if (state.carouselIndex < touchedLeads.length - 1) {
      state.carouselIndex += 1;
    }
  }

  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'combination_form',
    label: '🧩 Комбінація — побажання туриста',
    comment: fullCombText,
    newStage: 'combination',
    fields: {
      wishes: combinedWishes,
      familyComposition: nextFamily,
      departureCity: airports
    }
  });
};

window.openLostModal = (leadId, preselectReason = '') => {
  state.lostModalLeadId = leadId;
  render();
  if (preselectReason) {
    const sel = document.getElementById('lost-reason-select');
    if (sel) sel.value = preselectReason;
  }
};

window.closeLostModal = () => {
  state.lostModalLeadId = null;
  render();
};

window.submitLostModal = async () => {
  const leadId = state.lostModalLeadId;
  if (!leadId) return;
  const reason = (document.getElementById('lost-reason-select')?.value || '').trim();
  const comment = (document.getElementById('lost-reason-comment')?.value || '').trim();
  const errEl = document.getElementById('lost-modal-error');

  if (!reason || !comment) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Без вибору причини втрати та коментаря лід не може перейти у «Втрачено»!';
    }
    return;
  }

  const fullLostText = `❌ Причина втрати: ${reason}\n💬 Коментар: ${comment}`;
  const author = getCurrentAuthorName();
  state.lostModalLeadId = null;
  if (state.eveningCarouselOpen) {
    const touchedLeads = state.leads.filter(l => l.touchedToday);
    if (state.carouselIndex < touchedLeads.length - 1) {
      state.carouselIndex += 1;
    }
  }

  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'lost_form',
    label: `❌ Переведено у «Втрачено» (${reason})`,
    comment: fullLostText,
    newStage: 'lost',
    lostReason: `${reason} — ${comment}`
  });
};

window.openPostponedModal = (leadId) => {
  state.postponedModalLeadId = leadId;
  render();
};

window.closePostponedModal = () => {
  state.postponedModalLeadId = null;
  render();
};

window.submitPostponedModal = async () => {
  const leadId = state.postponedModalLeadId;
  if (!leadId) return;
  const reason = (document.getElementById('postponed-reason-select')?.value || '').trim();
  const comment = (document.getElementById('postponed-reason-comment')?.value || '').trim();
  const followUp = (document.getElementById('postponed-followup-date')?.value || '').trim();
  const errEl = document.getElementById('postponed-modal-error');

  if (!reason || !comment) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ Вкажіть причину та напишіть коментар, чому лід було відкладено!';
    }
    return;
  }

  const fullPostponedText = `⏸️ Причина відкладення: ${reason}\n💬 Коментар: ${comment}${followUp ? `\n⏰ Нагадування: ${formatReminderLabel(followUp)}` : ''}`;
  const author = getCurrentAuthorName();
  state.postponedModalLeadId = null;
  if (state.eveningCarouselOpen) {
    const touchedLeads = state.leads.filter(l => l.touchedToday);
    if (state.carouselIndex < touchedLeads.length - 1) {
      state.carouselIndex += 1;
    }
  }

  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'postponed_form',
    label: `⏸️ Переведено у «Відкладено» (${reason})`,
    comment: fullPostponedText,
    newStage: 'postponed',
    lostReason: `${reason} — ${comment}`,
    nextFollowUpAt: followUp
  });
};

window.openPickerById = (inputId) => {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (typeof el.showPicker === 'function') {
    try {
      el.showPicker();
      return;
    } catch (e) {}
  }
  el.focus();
  el.click();
};

let tempTravelFrom = {};
window.onTravelDatePicked = async (leadId, part, val) => {
  if (!val) return;
  if (part === 'from') {
    tempTravelFrom[leadId] = val;
    const d1 = new Date(val).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const textInput = document.getElementById('travel-dates-text-input');
    if (textInput) {
      textInput.value = `Виліт: ${d1} (оберіть дату повернення...)`;
    }
    const toEl = document.getElementById('travel-date-to');
    if (toEl) {
      toEl.min = val;
      window.openPickerById('travel-date-to');
    } else {
      await window.updateLeadField(leadId, 'travelDates', `Виліт: ${d1}`);
    }
  } else if (part === 'to') {
    const fromVal = tempTravelFrom[leadId];
    if (fromVal) {
      const d1 = new Date(fromVal);
      const d2 = new Date(val);
      const nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      const s1 = d1.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      const s2 = d2.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
      await window.updateLeadField(leadId, 'travelDates', `${s1} - ${s2} (${nights} ночей)`);
    } else {
      const d2 = new Date(val).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
      await window.updateLeadField(leadId, 'travelDates', `До ${d2}`);
    }
  }
};

window.startVoiceDictation = (targetInputId, langSelectId) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Ваш браузер не підтримує голосове введення (використовуйте Chrome або Safari).');
    return;
  }
  const targetEl = document.getElementById(targetInputId);
  const langEl = document.getElementById(langSelectId);
  if (!targetEl) return;

  const rec = new SpeechRecognition();
  rec.lang = langEl?.value || 'uk-UA';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    targetEl.value = (targetEl.value ? targetEl.value.trim() + ' ' : '') + transcript;
  };
  rec.start();
};

window.updateLeadField = async (leadId, key, value) => {
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: { [key]: value },
    logLabel: `📋 Оновлено поле анкети (${key}): ${String(value)}`
  });
};

window.updateLeadBudgetEUR = async (leadId, eurVal) => {
  const eur = Number(eurVal || 0);
  const uah = Math.round(eur * 45);
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: { budgetEUR: eur, budgetUAH: uah },
    logLabel: `💶 Оновлено бюджет в анкеті: €${eur} (${uah} ₴)`
  });
};

window.addManagerThreadComment = async (leadId) => {
  const el = document.getElementById('lead-situation-notes');
  const authorEl = document.getElementById('mgr-comment-author');
  const text = (el?.value || '').trim();
  if (!text) return;
  const author = authorEl?.value || getCurrentAuthorName();
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'manager_note',
    label: '📝 Коментар в анкеті',
    comment: text
  });
};

window.addDirectorThreadComment = async (leadId) => {
  const el = document.getElementById('director-note-input');
  const authorEl = document.getElementById('dir-comment-author');
  const text = (el?.value || '').trim();
  if (!text) return;
  const author = authorEl?.value || (state.currentRole === 'director' ? 'Анастасія' : 'Тетяна');
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author,
    actionType: 'director_comment',
    label: '💡 Запропонувала',
    comment: text
  });
};

window.setDirectorProposalStatus = async (leadId, logId, statusLabel) => {
  await apiCall('/api/leads/log/edit', 'POST', {
    leadId,
    logId,
    label: statusLabel
  });
};

window.addSelectionLink = async (leadId) => {
  const titleEl = document.getElementById('new-selection-title');
  const urlEl = document.getElementById('new-selection-url');
  const url = (urlEl?.value || '').trim();
  if (!url) return;
  const title = (titleEl?.value || '').trim() || `Підбірка #${((state.leads.find(l => l.id === leadId)?.selectionLinks || []).length + 1)}`;

  const lead = state.leads.find(l => l.id === leadId);
  const existing = Array.isArray(lead?.selectionLinks) ? [...lead.selectionLinks] : [];
  existing.unshift({
    id: String(Date.now()),
    title,
    url,
    createdAt: new Date().toISOString()
  });

  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: {
      selectionUrl: url,
      selectionLinks: existing
    },
    logLabel: `🔗 Додано посилання на підбір туру: ${title} (${url})`
  });
};

window.removeSelectionLink = async (leadId, idx) => {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;
  const existing = Array.isArray(lead.selectionLinks) ? [...lead.selectionLinks] : [];
  existing.splice(idx, 1);
  const latestUrl = existing.length ? existing[0].url : '';
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: {
      selectionUrl: latestUrl,
      selectionLinks: existing
    },
    logLabel: '🗑️ Видалено посилання на підбірку'
  });
};

window.copySelectionUrl = (e, url) => {
  if (e) e.stopPropagation();
  if (!url) return;
  navigator.clipboard.writeText(url);
  const btn = e?.currentTarget;
  if (btn) {
    const orig = btn.innerText;
    btn.innerText = '✅ Скопійовано';
    setTimeout(() => { btn.innerText = orig; }, 1200);
  }
};

window.saveDirectorNote = async (leadId, text) => {
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: 'Керівник',
    fields: { directorNote: text },
    logLabel: text ? `Коментар керівника: ${text.slice(0, 60)}` : 'Очищено коментар керівника'
  });
};

window.editTouchLog = async (leadId, logId, currentText) => {
  const updated = prompt('Редагувати коментар:', currentText || '');
  if (updated === null) return;
  await apiCall('/api/leads/log/edit', 'POST', {
    leadId,
    logId,
    comment: updated
  });
};

window.updateLeadBudget = async (leadId, uahVal) => {
  const uah = Number(uahVal || 0);
  const eur = Math.round(uah / 45);
  await apiCall('/api/leads/update', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    fields: { budgetUAH: uah, budgetEUR: eur },
    logLabel: `💰 Оновлено вартість туру (Бронь): ${uah} ₴ (€${eur})`
  });
};

// Drag & Drop Handlers
window.onDragStart = (e, leadId) => {
  state.draggedLeadId = leadId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', leadId);
    } catch (err) {}
  }
};

window.onDragOver = (e) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  e.currentTarget.classList.add('drag-over');
};

window.onDragLeave = (e) => {
  e.currentTarget.classList.remove('drag-over');
};

window.onDrop = async (e, targetStage) => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  let droppedId = '';
  try {
    droppedId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
  } catch (err) {}
  const leadId = state.draggedLeadId || droppedId;
  if (!leadId) return;
  state.draggedLeadId = null;

  await window.changeStageFromDrawer(leadId, targetStage);
};

// Evening Carousel
window.openEveningCarousel = () => {
  state.carouselIndex = 0;
  state.eveningCarouselOpen = true;
  render();
};

window.closeEveningCarousel = () => {
  state.eveningCarouselOpen = false;
  render();
};

window.stepCarousel = (dir) => {
  state.carouselIndex = Math.max(0, state.carouselIndex + dir);
  render();
};

window.saveCarouselComment = async (leadId) => {
  const el = document.getElementById('carousel-comment-input');
  const comment = (el?.value || '').trim();
  if (!comment) return;
  await apiCall('/api/leads/touch', 'POST', {
    leadId,
    author: getCurrentAuthorName(),
    actionType: 'comment',
    label: '🌙 Підсумки дня (Rush-звіт)',
    comment
  });
};

window.carouselMoveStage = async (leadId, newStage) => {
  const el = document.getElementById('carousel-comment-input');
  const comment = (el?.value || '').trim();
  const lead = state.leads.find(l => l.id === leadId);

  if (newStage === 'combination' || newStage === 'lost' || newStage === 'postponed') {
    if (comment && comment !== (lead?.currentSituation || '')) {
      await apiCall('/api/leads/touch', 'POST', {
        leadId,
        author: getCurrentAuthorName(),
        actionType: 'comment',
        label: '🌙 Підсумки дня (Rush-звіт)',
        comment
      });
    }
    if (newStage === 'combination') window.openCombinationModal(leadId);
    if (newStage === 'lost') window.openLostModal(leadId);
    if (newStage === 'postponed') window.openPostponedModal(leadId);
    return;
  }

  let lostReason = '';
  if (newStage === 'erroneous') {
    const prompted = promptStageMoveReason(newStage);
    if (prompted === null) return;
    lostReason = prompted;
  }
  const touchedLeads = state.leads.filter(l => l.touchedToday);
  if (state.carouselIndex < touchedLeads.length - 1) {
    state.carouselIndex += 1;
  }
  if (comment && comment !== (lead?.currentSituation || '')) {
    await apiCall('/api/leads/touch', 'POST', {
      leadId,
      author: getCurrentAuthorName(),
      actionType: 'comment',
      label: '🌙 Підсумки дня (Rush-звіт)',
      comment,
      newStage,
      lostReason
    });
  } else {
    await apiCall('/api/leads/stage', 'POST', {
      leadId,
      stage: newStage,
      lostReason,
      author: getCurrentAuthorName()
    });
  }
};

// New Lead Modal
window.openNewLeadModal = () => {
  state.newLeadModalOpen = true;
  render();
};

window.closeNewLeadModal = () => {
  state.newLeadModalOpen = false;
  render();
};

window.submitNewLead = async () => {
  const clientName = document.getElementById('nl-name')?.value || 'Новий турист';
  const phone = document.getElementById('nl-phone')?.value || '+380';
  const segment = document.getElementById('nl-segment')?.value || 'egypt';
  const departureCity = document.getElementById('nl-city')?.value || 'Кишинів';
  const budgetEUR = Number(document.getElementById('nl-budget')?.value || 1450);
  const sourceChannel = document.getElementById('nl-source')?.value || 'manual';
  const wishes = document.getElementById('nl-wishes')?.value || '';

  const segObj = SEGMENTS.find(s => s.id === segment);
  const hasLandingResortOrHotelInWishes = /(?:Курорт|Готель|Обраний готель)\s*:/i.test(wishes);
  const destination = hasLandingResortOrHotelInWishes
    ? ''
    : (segObj ? segObj.label.replace(/^[^\s]+\s/, '') : 'Єгипет, Шарм-ель-Шейх');

  state.newLeadModalOpen = false;
  await apiCall('/api/leads/create', 'POST', {
    clientName,
    phone,
    segment,
    destination,
    departureCity,
    budgetEUR,
    budgetUAH: Math.round(budgetEUR * 45),
    familyComposition: '2',
    wishes,
    sourceChannel,
    assignedTo: state.currentUser === 'rita' ? 'rita' : 'tetiana'
  });
};

function render() {
  const root = document.getElementById('crm-root');
  if (!root) return;

  // Preserve horizontal Kanban scroll, vertical column scrolls, list scroll, and drawer scroll
  const prevKanban = root.querySelector('.kanban-wrapper');
  const savedKanbanScrollLeft = prevKanban ? prevKanban.scrollLeft : 0;
  const savedColScrollTops = Array.from(root.querySelectorAll('.col-body')).map(el => el.scrollTop);
  const prevList = root.querySelector('.list-wrapper');
  const savedListScrollTop = prevList ? prevList.scrollTop : 0;
  const prevDrawer = root.querySelector('.lead-drawer');
  const savedDrawerScrollTop = prevDrawer ? prevDrawer.scrollTop : 0;

  root.innerHTML = `
    ${renderHeader()}
    ${renderSubbar()}
    ${renderFinanceCockpit()}
    ${state.viewMode === 'list' ? renderListView() : renderKanban()}
    ${renderLeadDrawer()}
    ${renderEveningCarouselModal()}
    ${renderCombinationModal()}
    ${renderLostReasonModal()}
    ${renderPostponedModal()}
    ${renderNewLeadModal()}
  `;

  // Restore scroll positions immediately so Kanban/List/Drawer never jumps
  const nextKanban = root.querySelector('.kanban-wrapper');
  if (nextKanban && savedKanbanScrollLeft > 0) {
    nextKanban.scrollLeft = savedKanbanScrollLeft;
  }
  const nextCols = root.querySelectorAll('.col-body');
  nextCols.forEach((el, idx) => {
    if (savedColScrollTops[idx] > 0) {
      el.scrollTop = savedColScrollTops[idx];
    }
  });
  const nextList = root.querySelector('.list-wrapper');
  if (nextList && savedListScrollTop > 0) {
    nextList.scrollTop = savedListScrollTop;
  }
  const nextDrawer = root.querySelector('.lead-drawer');
  if (nextDrawer && savedDrawerScrollTop > 0) {
    nextDrawer.scrollTop = savedDrawerScrollTop;
  }

  // Auto-expand all textareas so no text is ever clipped or requires internal scrolling
  root.querySelectorAll('textarea').forEach(ta => {
    if (ta.scrollHeight > ta.clientHeight) {
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight + 6) + 'px';
    }
  });
}

function refreshSlaTimersInPlace() {
  const cards = document.querySelectorAll('.lead-card[data-lead-id]');
  cards.forEach(cardEl => {
    const leadId = cardEl.getAttribute('data-lead-id');
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    const mins = getMinutesSince(lead.createdAt);
    const isNewOverdue = lead.stage === 'new_request' && !lead.firstContactAt && mins >= 15;
    cardEl.classList.toggle('sla-overdue', isNewOverdue);

    const remBadgeEl = cardEl.querySelector('.reminder-badge');
    if (remBadgeEl && lead.nextFollowUpAt) {
      const overdue = isReminderOverdue(lead);
      remBadgeEl.style.background = overdue ? '#fef2f2' : '#fffbeb';
      remBadgeEl.style.color = overdue ? '#b91c1c' : '#b45309';
      remBadgeEl.style.border = overdue ? '1px solid #ef4444' : '1px solid #fcd34d';
      const spanEl = remBadgeEl.querySelector('span');
      if (spanEl) {
        spanEl.textContent = `${overdue ? '🔥 Прострочено:' : '⏰ Нагадування:'} ${formatReminderLabel(lead.nextFollowUpAt)}`;
      }
    }

    const badgeEl = cardEl.querySelector('.sla-badge');
    if (!badgeEl) return;

    const hoursSilent = getHoursSilent(lead);
    const daysSilent = Math.max(1, Math.floor(hoursSilent / 24));
    const isSilentOver24h = ['in_progress', 'waiting_decision'].includes(lead.stage) && hoursSilent >= 24;

    if (lead.stage === 'new_request') {
      if (isNewOverdue) {
        badgeEl.className = 'sla-badge urgent';
        badgeEl.removeAttribute('style');
        badgeEl.textContent = `🚨 ${mins} хв без дзвінка!`;
      } else {
        badgeEl.className = 'sla-badge fresh';
        badgeEl.removeAttribute('style');
        badgeEl.textContent = `🟢 ${mins} хв тому`;
      }
    } else if (isSilentOver24h) {
      badgeEl.className = 'sla-badge normal';
      badgeEl.style.cssText = 'background:#fef3c7;color:#b45309;border:1px solid #f59e0b;font-weight:800;';
      badgeEl.textContent = `⚠️ ${daysSilent} дн. без дотику`;
    }
  });
}

// Close active modal or lead drawer with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.combinationModalLeadId) {
    window.closeCombinationModal();
  } else if (state.lostModalLeadId) {
    window.closeLostModal();
  } else if (state.postponedModalLeadId) {
    window.closePostponedModal();
  } else if (state.newLeadModalOpen) {
    window.closeNewLeadModal();
  } else if (state.eveningCarouselOpen) {
    window.closeEveningCarousel();
  } else if (state.selectedLeadId) {
    window.closeDrawer();
  }
});

// Initial boot + 30-second SLA timer refresh IN-PLACE (zero full DOM rebuilds!)
apiCall('/api/leads');
setInterval(() => {
  refreshSlaTimersInPlace();
}, 30000);
