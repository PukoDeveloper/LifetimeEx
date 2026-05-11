const BASE_STATS = {
  health: 1,
  intelligence: 1,
  charm: 1,
  social: 1,
  luck: 1,
};
const STAT_KEYS = Object.keys(BASE_STATS);

const HIDDEN_STATS = {
  magic: 0,
  power: 0,
};

const START_POINTS = 10;
const MAX_TRAITS = 2;
const MAX_EVENT_LOG_DISPLAY = 8;

const STAT_LABELS = {
  health: "健康",
  intelligence: "智慧",
  charm: "魅力",
  social: "社交",
  luck: "運氣",
};

const HIDDEN_STAT_LABELS = {
  magic: "法術",
  power: "權力",
};

function getLabel(labelMap, key, groupName) {
  const label = labelMap[key];
  if (!label) {
    console.warn(`Missing ${groupName} label for key: ${key}`);
    return key;
  }
  return label;
}

function validateLabelCoverage() {
  STAT_KEYS.forEach((key) => {
    if (!STAT_LABELS[key]) {
      console.warn(`Missing stat label config for key: ${key}`);
    }
  });
}

const TRAITS = [
  {
    id: "quick-learner",
    name: "快速學習",
    description: "初始智慧 +2",
    apply: (state) => {
      state.stats.intelligence += 2;
      state.statusTags.add("bookworm");
    },
  },
  {
    id: "born-athlete",
    name: "天生運動員",
    description: "初始健康 +2",
    apply: (state) => {
      state.stats.health += 2;
    },
  },
  {
    id: "social-butterfly",
    name: "社交高手",
    description: "初始社交 +1、魅力 +1",
    apply: (state) => {
      state.stats.social += 1;
      state.stats.charm += 1;
      state.statusTags.add("popular");
    },
  },
];

function createEvent(config) {
  return {
    id: config.id,
    title: config.title,
    description: config.description,
    tags: config.tags ?? [],
    condition: config.condition ?? (() => true),
    choices: config.choices,
  };
}

const EVENTS = [
  createEvent({
    id: "school-competition",
    title: "校內競賽",
    description: "你收到參加校內競賽的機會。",
    tags: ["education"],
    choices: [
      {
        text: "全力準備",
        effect: (state) => {
          state.stats.intelligence += 1;
          state.eventLog.push("你在競賽中獲得好成績。");
        },
      },
      {
        text: "放鬆面對",
        effect: (state) => {
          state.stats.luck += 1;
          state.eventLog.push("你雖未奪冠，但意外結識了新朋友。");
        },
      },
    ],
  }),
  createEvent({
    id: "street-opportunity",
    title: "街角奇遇",
    description: "你在街角遇見神秘商人。",
    tags: ["mystery"],
    condition: (state) => state.stats.luck >= 2,
    choices: [
      {
        text: "接受神秘道具",
        effect: (state) => {
          state.hiddenStats.magic += 1;
          state.visibleHiddenStats.add("magic");
          state.statusTags.add("mystic");
          state.eventLog.push("你感受到體內出現了微弱法力。");
        },
      },
      {
        text: "婉拒離開",
        effect: (state) => {
          state.stats.social += 1;
          state.eventLog.push("你保持警惕，平安離開。");
        },
      },
    ],
  }),
  createEvent({
    id: "team-project",
    title: "團隊企劃",
    description: "朋友邀請你參與大型企劃。",
    tags: ["career", "social"],
    condition: (state) => state.stats.social >= 2,
    choices: [
      {
        text: "擔任領導者",
        effect: (state) => {
          state.hiddenStats.power += 1;
          state.visibleHiddenStats.add("power");
          state.stats.charm += 1;
          state.eventLog.push("你在團隊中建立了影響力。");
        },
      },
      {
        text: "擔任支援者",
        effect: (state) => {
          state.stats.social += 1;
          state.stats.intelligence += 1;
          state.eventLog.push("你穩健協助團隊達成目標。");
        },
      },
    ],
  }),
];

const state = {
  turn: 0,
  traits: [],
  stats: { ...BASE_STATS },
  hiddenStats: { ...HIDDEN_STATS },
  visibleHiddenStats: new Set(),
  statusTags: new Set(),
  eventLog: [],
  currentEvent: null,
};

const pageElements = [...document.querySelectorAll(".page")];
const setupMessage = document.querySelector("#setup-message");
const pointsLeft = document.querySelector("#points-left");
const statConfig = document.querySelector("#stat-config");
const traitList = document.querySelector("#trait-list");
const turnIndicator = document.querySelector("#turn-indicator");
const statsView = document.querySelector("#stats-view");
const eventTitle = document.querySelector("#event-title");
const eventDescription = document.querySelector("#event-description");
const eventChoices = document.querySelector("#event-choices");
const eventLogList = document.querySelector("#event-log");
const nextEventButton = document.querySelector("#next-event");

function showPage(pageName) {
  pageElements.forEach((node) => {
    node.classList.toggle("is-active", node.dataset.page === pageName);
  });
}

function route() {
  const target = window.location.hash.replace("#", "") || "title";
  const valid = ["title", "setup", "game"];
  showPage(valid.includes(target) ? target : "title");
}

function renderTraitOptions() {
  traitList.innerHTML = "";
  TRAITS.forEach((trait) => {
    const wrapper = document.createElement("label");
    wrapper.className = "trait-card trait-option";
    wrapper.innerHTML = `
      <input type="checkbox" value="${trait.id}" />
      <strong>${trait.name}</strong>
      <span>${trait.description}</span>
    `;
    traitList.appendChild(wrapper);
  });
}

function renderStatConfig() {
  statConfig.innerHTML = "";
  STAT_KEYS.forEach((key) => {
    const label = document.createElement("label");
    label.className = "trait-card stat-item";
    label.innerHTML = `
      <span>${getLabel(STAT_LABELS, key, "stat")}</span>
      <input type="number" min="0" value="0" data-stat="${key}" />
    `;
    statConfig.appendChild(label);
  });
  updatePointsLeft();
}

function selectedTraitIds() {
  return [...traitList.querySelectorAll('input[type="checkbox"]:checked')].map((node) => node.value);
}

function totalAllocatedPoints() {
  return [...statConfig.querySelectorAll("input")].reduce(
    (sum, input) => sum + Number(input.value || 0),
    0
  );
}

function updatePointsLeft() {
  const left = START_POINTS - totalAllocatedPoints();
  pointsLeft.textContent = `剩餘點數：${left}`;
}

function resetState() {
  state.turn = 0;
  state.traits = [];
  state.stats = { ...BASE_STATS };
  state.hiddenStats = { ...HIDDEN_STATS };
  state.visibleHiddenStats = new Set();
  state.statusTags = new Set();
  state.eventLog = [];
  state.currentEvent = null;
}

function applySetup() {
  const traits = selectedTraitIds();
  const allocatedPoints = totalAllocatedPoints();

  if (traits.length > MAX_TRAITS) {
    setupMessage.textContent = `最多只能選擇 ${MAX_TRAITS} 個天賦。`;
    return false;
  }
  if (allocatedPoints > START_POINTS) {
    setupMessage.textContent = "初始點數分配超過上限。";
    return false;
  }

  resetState();
  state.traits = traits;

  [...statConfig.querySelectorAll("input")].forEach((input) => {
    const key = input.dataset.stat;
    state.stats[key] += Number(input.value || 0);
  });

  traits.forEach((id) => {
    const trait = TRAITS.find((item) => item.id === id);
    if (trait) {
      trait.apply(state);
    }
  });

  return true;
}

function getAvailableEvents() {
  return EVENTS.filter((event) => event.condition(state));
}

function pickEvent() {
  const pool = getAvailableEvents();
  if (!pool.length) {
    return {
      id: "default",
      title: "平凡的一天",
      description: "今天沒有特別的事件發生，你平穩度過了一天。",
      tags: ["daily"],
      choices: [
        {
          text: "繼續前進",
          effect: () => {},
        },
      ],
    };
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderState() {
  turnIndicator.textContent = `第 ${state.turn} 回合`;
  statsView.innerHTML = "";

  Object.entries(state.stats).forEach(([key, value]) => {
    const li = document.createElement("li");
    li.textContent = `${getLabel(STAT_LABELS, key, "stat")}: ${value}`;
    statsView.appendChild(li);
  });

  state.visibleHiddenStats.forEach((key) => {
    const li = document.createElement("li");
    li.textContent = `${getLabel(HIDDEN_STAT_LABELS, key, "hidden stat")}: ${state.hiddenStats[key]}`;
    statsView.appendChild(li);
  });

  if (state.statusTags.size) {
    const li = document.createElement("li");
    li.textContent = `狀態標記: ${[...state.statusTags].join(", ")}`;
    statsView.appendChild(li);
  }

  eventLogList.innerHTML = "";
  state.eventLog.slice(-MAX_EVENT_LOG_DISPLAY).reverse().forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    eventLogList.appendChild(li);
  });
}

function renderCurrentEvent() {
  if (!state.currentEvent) {
    eventTitle.textContent = "尚未開始";
    eventDescription.textContent = "按下「下一事件」開始你的人生。";
    eventChoices.innerHTML = "";
    return;
  }
  eventTitle.textContent = state.currentEvent.title;
  eventDescription.textContent = state.currentEvent.description;
  eventChoices.innerHTML = "";
  state.currentEvent.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.addEventListener("click", () => {
      choice.effect(state);
      state.eventLog.push(`[${state.currentEvent.tags.join(",")}] ${state.currentEvent.title}`);
      state.currentEvent = null;
      nextEventButton.disabled = false;
      renderState();
      renderCurrentEvent();
    });
    eventChoices.appendChild(button);
  });
  nextEventButton.disabled = true;
}

function nextTurn() {
  state.turn += 1;
  state.currentEvent = pickEvent();
  renderCurrentEvent();
  renderState();
}

document.querySelector("#go-setup").addEventListener("click", () => {
  window.location.hash = "#setup";
});

document.querySelector("#back-title").addEventListener("click", () => {
  window.location.hash = "#title";
});

document.querySelector("#start-game").addEventListener("click", () => {
  setupMessage.textContent = "";
  if (!applySetup()) return;
  window.location.hash = "#game";
  renderState();
  renderCurrentEvent();
});

document.querySelector("#restart").addEventListener("click", () => {
  renderTraitOptions();
  renderStatConfig();
  setupMessage.textContent = "";
  window.location.hash = "#title";
});

nextEventButton.addEventListener("click", nextTurn);

statConfig.addEventListener("input", updatePointsLeft);
window.addEventListener("hashchange", route);

renderTraitOptions();
renderStatConfig();
validateLabelCoverage();
route();
