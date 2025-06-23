let hasWelcomed = false;
let lastBXP = null;
let lastInventoryObj = null;

function sendTrackerMessage(msg) {
  window.parent.postMessage({
    type: "notification",
    text: `~g~[BXP Tracker]~s~ ${msg}`
  }, "*");
}

function sendWelcomeMessages(userName) {
  sendTrackerMessage(`Welcome ${userName}`);
  setTimeout(() => {
    sendTrackerMessage(`If the BXP/hr starts to get inaccurate, open the settings and click ~r~'Reset BXP Tracking'~s~`);
  }, 3000);
}

const jobEl = document.getElementById('job');
const bxpEl = document.getElementById('total-bxp');
const bxpHrEl = document.getElementById('bxp-per-hour');
const bxpMinEl = document.getElementById('bxp-per-minute');
const popup = document.getElementById('bxp-gain-popup');

let lastJobKey = null;
let lastBxpAmount = null;
let bxpLog = [];
let hasFirstGain = false;
let initialBxpValue = null;

function showBXPGain(amount) {
  const showDrops = document.getElementById("toggle-bxp-drops")?.checked;
  if (!popup || !showDrops) return;

  popup.classList.remove("show");
  void popup.offsetWidth;
  popup.textContent = `+${amount.toLocaleString()} BXP`;
  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 800);
}

function cleanJobKey(rawJob) {
  return rawJob.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeJobKey(rawJob) {
  const cleaned = cleanJobKey(rawJob);
  return JOB_ALIASES[cleaned] || cleaned;
}

function updateStatToggles(currentBxp) {
  const hr = getBxpPerHour();
  const min = getBxpPerMinute();
  bxpHrEl.textContent = hr ? `BXP/hr: ${hr.toLocaleString()}` : `BXP/hr: —`;
  bxpMinEl.textContent = min ? `BXP/min: ${min.toLocaleString()}` : `BXP/min: —`;
}


const RECENT_WINDOW_MS = 10 * 60 * 1000;

function getBxpPerHour() {
  if (!hasFirstGain || bxpLog.length < 2) return null;
  const now = Date.now();
  const [first, last] = [bxpLog[0], bxpLog[bxpLog.length - 1]];
  const sessionDuration = last.time - first.time;
  const sessionBXP = last.bxp - first.bxp;
  const sessionHours = sessionDuration / 3600000;
  const sessionBXPH = sessionHours > 0 ? sessionBXP / sessionHours : 0;

  const recentDrops = bxpLog.filter(entry => now - entry.time <= RECENT_WINDOW_MS);
  let recentBXPH = 0;
  if (recentDrops.length >= 2) {
    const recentFirst = recentDrops[0];
    const recentLast = recentDrops[recentDrops.length - 1];
    const recentBXP = recentLast.bxp - recentFirst.bxp;
    const recentDuration = recentLast.time - recentFirst.time;
    const recentHours = recentDuration / 3600000;
    if (recentHours > 0) {
      recentBXPH = recentBXP / recentHours;
    }
  } else {
    return Math.round(sessionBXPH);
  }

  const sessionWeight = Math.min(sessionDuration / RECENT_WINDOW_MS, 1.0);
  const liveWeight = 1.0 - sessionWeight;
  const hybridBXPH = sessionBXPH * sessionWeight + recentBXPH * liveWeight;
  return Math.round(hybridBXPH);
}

function getBxpPerMinute() {
  const perHour = getBxpPerHour();
  return perHour !== null ? Math.round(perHour / 60) : null;
}



window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "data" || !msg.data) return;

  const now = new Date();
  const data = msg.data;

  const rawJob = data.job_name || data.job || localStorage.getItem("last-valid-job") || "unknown";
  const jobDisplay = rawJob;
  const rawJobKey = cleanJobKey(rawJob);
  const jobKey = normalizeJobKey(rawJob);

  const jobInfo = JOB_BXP_KEYS[jobKey];
  if (!jobInfo) {
    console.warn("Job key not found:", jobKey);
    return;
  }

  const expectedBxpToken = jobInfo.bxpTokenKey;
  invObj = typeof data.inventory === "string" ? JSON.parse(data.inventory) : data.inventory;
  let bxpAmount = null;

  if (invObj) {
    const altTokenKey = expectedBxpToken.replace("exp_token_a|", "exp_token|");

    const primaryAmount = invObj[expectedBxpToken]?.amount ?? 0;
    const secondaryAmount = invObj[altTokenKey]?.amount ?? 0;

    const combined = primaryAmount + secondaryAmount;
    if (combined > 0) {
      bxpAmount = combined;
    } else {
      bxpAmount = 0;
    }
  } else {
    bxpAmount = null;
    lastBXP = null;
  }

  const playerName = data.name || "Player";
  if (!hasWelcomed && playerName) {
    sendWelcomeMessages(playerName);
    hasWelcomed = true;
  }

  if (rawJobKey !== lastJobKey) {
    jobEl.textContent = `Job: ${jobDisplay}`;
    localStorage.setItem("last-valid-job", rawJob);
    lastJobKey = rawJobKey;
    lastBxpAmount = null;
    bxpLog = [];
    hasFirstGain = false;
    initialBxpValue = null;

    ["bxp-per-hour", "bxp-per-minute"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${el.textContent.split(":")[0]}: —`;
    });

    window.parent.postMessage({ type: "getData" }, "*");
  }

  if (typeof bxpAmount !== "number") return;

  bxpEl.textContent = `${jobInfo.label}: ${Math.round(bxpAmount).toLocaleString()}`;

  if (initialBxpValue === null) initialBxpValue = bxpAmount;
  if (!hasFirstGain && bxpAmount !== initialBxpValue) hasFirstGain = true;

  if (lastBxpAmount !== null && bxpAmount > lastBxpAmount) {
    const gain = bxpAmount - lastBxpAmount;
    showBXPGain(gain);
    bxpLog.push({ time: now, bxp: bxpAmount });

    if (bxpLog.length === 1) {
      bxpLog.unshift({ time: new Date(now.getTime() - 5000), bxp: initialBxpValue ?? bxpAmount - gain });
    }
  }

  updateStatToggles(bxpAmount);
  lastBxpAmount = bxpAmount;
});


window.parent.postMessage({ type: "getData" }, "*");

const trackerWindow = document.getElementById("tracker-window");
let isDragging = false;
let offsetX = 0, offsetY = 0;

const savedPos = JSON.parse(localStorage.getItem("tracker-position"));
if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
  trackerWindow.style.left = `${savedPos.x}px`;
  trackerWindow.style.top = `${savedPos.y}px`;
  trackerWindow.style.position = "absolute";
}
trackerWindow.addEventListener("mousedown", (e) => {
  if (!trackerWindow.contains(e.target)) return;
  isDragging = true;
  offsetX = e.clientX - trackerWindow.offsetLeft;
  offsetY = e.clientY - trackerWindow.offsetTop;
});
document.addEventListener("mouseup", () => isDragging = false);
document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    trackerWindow.style.left = `${newX}px`;
    trackerWindow.style.top = `${newY}px`;
    trackerWindow.style.position = "absolute";
    localStorage.setItem("tracker-position", JSON.stringify({ x: newX, y: newY }));
  }
});

document.getElementById("settings-icon").addEventListener("click", () => {
  const panel = document.getElementById("settings-panel");
  panel.style.display = (panel.style.display === "none" || !panel.style.display) ? "block" : "none";
});

document.getElementById("reset-bxp-log").addEventListener("click", () => {
  bxpLog = [];
  hasFirstGain = false;
  initialBxpValue = lastBxpAmount;
  ["bxp-per-hour", "bxp-per-minute"].forEach(id => {
    document.getElementById(id).textContent = `${document.getElementById(id).textContent.split(":")[0]}: —`;
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
});

const settingIds = ["bxp-hr", "bxp-min"];
settingIds.forEach(id => {
  const checkbox = document.getElementById(`toggle-${id}`);
  const displayEl = document.getElementById(
    id === "bxp-hr" ? "bxp-per-hour" :
    id === "bxp-min" ? "bxp-per-minute" : "bxp-gain-popup"
  );

  const savedState = localStorage.getItem(`toggle-${id}`);
  if (savedState !== null) {
    checkbox.checked = savedState === "true";
    if (id !== "bxp-drops") {
      displayEl.style.display = checkbox.checked ? "block" : "none";
    }
  }

  checkbox.addEventListener("change", () => {
    localStorage.setItem(`toggle-${id}`, checkbox.checked);
    if (id !== "bxp-drops") {
      displayEl.style.display = checkbox.checked ? "block" : "none";
    }
  });
});

const transparencySlider = document.getElementById("transparency-slider");
const savedOpacity = localStorage.getItem("ui-opacity");
if (savedOpacity) {
  transparencySlider.value = savedOpacity;
  trackerWindow.style.backgroundColor = `rgba(35, 39, 43, ${savedOpacity})`;
  trackerWindow.style.boxShadow = `0 0 12px rgba(0, 0, 0, ${savedOpacity * 0.5})`;
}

transparencySlider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  localStorage.setItem("ui-opacity", value);
  const shadowStrength = value < 0.1 ? 0 : value * 0.5;
  trackerWindow.style.backgroundColor = `rgba(35, 39, 43, ${value})`;
  trackerWindow.style.boxShadow = `0 0 12px rgba(0, 0, 0, ${shadowStrength})`;
});

const JOB_ALIASES = {
  trucker: "trucker", mechanic: "mechanic", garbagecollector: "garbage",
  postopdriver: "postop", airlinepilot: "pilot", helicopterpilot: "helicopterpilot",
  cargopilot: "cargopilot", busdriver: "busdriver", trainconductor: "conductor",
  emsparamedic: "emergency",  aerialfirefighter: "firefighter", firefighter: "firefighter", businesses: "citizen",
  streetracer: "racer", farmer: "farmer", fisherman: "fisher", miner: "miner",
  wildlifehunter: "hunter", postopemployee: "postop", rtsaviator: "business", rtsprofessional: "business", rtstransporter: "business", collinscocabbies: "business",
};
const JOB_BXP_KEYS = {
  trucker:       { bxpTokenKey: "exp_token_a|trucking|trucking", label: "Trucking BXP" },
  mechanic:      { bxpTokenKey: "exp_token_a|trucking|mechanic", label: "Mechanic BXP" },
  garbage:       { bxpTokenKey: "exp_token_a|trucking|garbage", label: "Garbage BXP" },
  postop:        { bxpTokenKey: "exp_token_a|trucking|postop", label: "PostOP BXP" },
  pilot:         { bxpTokenKey: "exp_token_a|piloting|piloting", label: "Airline BXP" },
  helicopterpilot:{ bxpTokenKey: "exp_token_a|piloting|heli", label: "Helicopter BXP" },
  cargopilot:    { bxpTokenKey: "exp_token_a|piloting|cargos", label: "Cargo BXP" },
  busdriver:     { bxpTokenKey: "exp_token_a|train|bus", label: "Bus Driver BXP" },
  conductor:     { bxpTokenKey: "exp_token_a|train|train", label: "Train BXP" },
  emergency:     { bxpTokenKey: "exp_token_a|ems|ems", label: "EMS BXP" },
  firefighter:   { bxpTokenKey: "exp_token_a|ems|fire", label: "Firefighting BXP" },
  racer:         { bxpTokenKey: "exp_token_a|player|racing", label: "Racing BXP" },
  farmer:        { bxpTokenKey: "exp_token_a|farming|farming", label: "Farming BXP" },
  fisher:        { bxpTokenKey: "exp_token_a|farming|fishing", label: "Fishing BXP" },
  miner:         { bxpTokenKey: "exp_token_a|farming|mining", label: "Mining BXP" },
  business:      { bxpTokenKey: "exp_token_a|business|business", label: "Business BXP" },
  hunter:        { bxpTokenKey: "exp_token_a|hunting|skill", label: "Hunting BXP" }
};