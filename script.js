const SELECTED_JOBS_KEY = "bxp_selected_jobs";
const TRACKER_POSITION_KEY = "bxp_tracker_position";


const JOBS = [
  { key: "business", label: "Business" },
  { key: "cargopilot", label: "Cargo" },
  { key: "conductor", label: "Train" },
  { key: "emergency", label: "EMS" },
  { key: "farmer", label: "Farming" },
  { key: "fisher", label: "Fishing" },
  { key: "firefighter", label: "Firefighting" },
  { key: "garbage", label: "Garbage" },
  { key: "helicopterpilot", label: "Helicopter" },
  { key: "hunter", label: "Hunting" },
  { key: "mechanic", label: "Mechanic" },
  { key: "miner", label: "Mining" },
  { key: "pilot", label: "Airline" },
  { key: "player", label: "Player" },
  { key: "postop", label: "PostOP" },
  { key: "racer", label: "Racing" },
  { key: "strength", label: "Strength" },
  { key: "trucker", label: "Trucking" },
  { key: "busdriver", label: "Bus Driver" }
];


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
  hunter:        { bxpTokenKey: "exp_token_a|hunting|skill", label: "Hunting BXP" },
  player:        { bxpTokenKey: "exp_token_a|player|player", label: "Player BXP" },
  strength:      { bxpTokenKey: "exp_token_a|physical|strength", label: "Strength BXP" },
};

let selectedJobs = new Set();
let bxpLogs = {};
let lastBxp = {};
let hasFirstGain = {};

const jobListEl = document.getElementById('job-list');
const summaryTbody = document.getElementById('summary-tbody');
const settingsPanel = document.getElementById('settings-panel');
const settingsIcon = document.getElementById('settings-icon');
const toggleBxpHr = document.getElementById('toggle-bxp-hr');
const toggleBxpMin = document.getElementById('toggle-bxp-min');
const trackerApp = document.getElementById('tracker-app');

function renderJobList() {
  jobListEl.innerHTML = '';
  const sortedJobs = [...JOBS].sort((a, b) => a.label.localeCompare(b.label));
  sortedJobs.forEach(job => {
    const label = document.createElement('label');
    label.className = 'job-checkbox-label';
    if (selectedJobs.has(job.key)) label.classList.add('selected');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = job.key;
    input.checked = selectedJobs.has(job.key);
    input.onchange = function() {
      if (this.checked) selectedJobs.add(job.key);
      else selectedJobs.delete(job.key);
      label.classList.toggle('selected', this.checked);
      saveSelectedJobs();
      renderSummary();
    };
    label.appendChild(input);
    label.appendChild(document.createTextNode(job.label));
    jobListEl.appendChild(label);
  });
}

function saveSelectedJobs() {
  localStorage.setItem(SELECTED_JOBS_KEY, JSON.stringify(Array.from(selectedJobs)));
}
function loadSelectedJobs() {
  try {
    const stored = JSON.parse(localStorage.getItem(SELECTED_JOBS_KEY));
    if (Array.isArray(stored)) {
      selectedJobs = new Set(stored);
    }
  } catch (e) {
    selectedJobs = new Set();
  }
}


function renderSummary() {
  summaryTbody.innerHTML = '';
  selectedJobs.forEach(jobKey => {
    const jobObj = JOBS.find(j => j.key === jobKey);
    const bxp = typeof lastBxp[jobKey] === "number" ? lastBxp[jobKey] : 0;
    const bxpPerHour = getBxpPerHour(jobKey);
    const bxpPerMinute = bxpPerHour !== null ? Math.round(bxpPerHour/60) : null;
    const showHr = toggleBxpHr.checked;
    const showMin = toggleBxpMin.checked;
    summaryTbody.innerHTML += `
      <tr>
      <td>${jobObj.label}</td>
      <td>${bxp.toLocaleString()}</td>
      <td>${showHr && bxpPerHour !== null ? bxpPerHour.toLocaleString() : '—'}</td>
      <td>${showMin && bxpPerMinute !== null ? bxpPerMinute.toLocaleString() : '—'}</td>
      </tr>
    `;
  });
}

function getBxpPerHour(jobKey) {
  const log = bxpLogs[jobKey] || [];
  if (!hasFirstGain[jobKey] || log.length < 2) return null;
  const now = Date.now();
  const [first, last] = [log[0], log[log.length-1]];
  const sessionDuration = last.time - first.time;
  const sessionBXP = last.bxp - first.bxp;
  const sessionHours = sessionDuration / 3600000;
  const sessionBXPH = sessionHours > 0 ? sessionBXP / sessionHours : 0;
  const RECENT_WINDOW_MS = 10 * 60 * 1000;
  const recentDrops = log.filter(entry => now - entry.time <= RECENT_WINDOW_MS);
  let recentBXPH = 0;
  if (recentDrops.length >= 2) {
    const recentFirst = recentDrops[0];
    const recentLast = recentDrops[recentDrops.length-1];
    const recentBXP = recentLast.bxp - recentFirst.bxp;
    const recentDuration = recentLast.time - recentFirst.time;
    const recentHours = recentDuration / 3600000;
    if (recentHours > 0) recentBXPH = recentBXP / recentHours;
  } else {
    return Math.round(sessionBXPH);
  }
  const sessionWeight = Math.min(sessionDuration / RECENT_WINDOW_MS, 1.0);
  const liveWeight = 1.0 - sessionWeight;
  const hybridBXPH = sessionBXPH * sessionWeight + recentBXPH * liveWeight;
  return Math.round(hybridBXPH);
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "data" || !msg.data) return;

  const data = msg.data;

  let invObj;
  try {
    invObj = typeof data.inventory === "string" ? JSON.parse(data.inventory) : data.inventory;
  } catch (e) {
    console.warn("❌ Failed to parse inventory:", e);
    return;
  }

  if (!invObj || typeof invObj !== "object") {
    console.warn("⚠️ No valid inventory object.");
    return;
  }

  const now = Date.now();
  const allJobs = Object.keys(JOB_BXP_KEYS);

  allJobs.forEach(jobKey => {
    const jobInfo = JOB_BXP_KEYS[jobKey];
    if (!jobInfo) return;

    const expectedKey = jobInfo.bxpTokenKey;
    const altKey = expectedKey.replace("exp_token_a|", "exp_token|");

    const primaryAmount = invObj[expectedKey]?.amount ?? 0;
    const secondaryAmount = invObj[altKey]?.amount ?? 0;
    const combinedAmount = primaryAmount + secondaryAmount;

    if (primaryAmount === 0 && secondaryAmount === 0 && !(expectedKey in invObj) && !(altKey in invObj)) return;

    const amount = combinedAmount;


    if (!bxpLogs[jobKey]) bxpLogs[jobKey] = [];

    if (typeof lastBxp[jobKey] !== "number") {
      bxpLogs[jobKey].push({ time: now - 1000, bxp: amount });
      hasFirstGain[jobKey] = true;
    }

    if (amount !== lastBxp[jobKey]) {
      bxpLogs[jobKey].push({ time: now, bxp: amount });
      if (bxpLogs[jobKey].length > 120) {
        bxpLogs[jobKey] = bxpLogs[jobKey].slice(-120);
      }
    }

    lastBxp[jobKey] = amount;
  });

  renderSummary();
});


function cleanJobKey(rawJob) {
  return rawJob.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function normalizeJobKey(rawJob) {
  const cleaned = cleanJobKey(rawJob);
  return JOB_BXP_KEYS[cleaned] ? cleaned : cleaned;
}

settingsIcon.onclick = () => {
  settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('reset-bxp-log').onclick = () => {
  bxpLogs = {};
  hasFirstGain = {};
  lastBxp = {};
  renderSummary();
};
toggleBxpHr.onchange = toggleBxpMin.onchange = renderSummary;

(function enableDrag() {
  const dragHandle = document.getElementById('drag-handle');
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target === settingsIcon) return;
    isDragging = true;
    const rect = trackerApp.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      trackerApp.style.left = (e.clientX - dragOffsetX) + "px";
      trackerApp.style.top = (e.clientY - dragOffsetY) + "px";
      trackerApp.style.position = "absolute";

      localStorage.setItem(TRACKER_POSITION_KEY, JSON.stringify({
        left: trackerApp.style.left,
        top: trackerApp.style.top
      }));
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
})();


const escapeListener = (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
};
window.addEventListener('keydown', escapeListener);

document.getElementById('toggle-job-list').onclick = () => {
  const jobList = document.getElementById('job-list');
  const toggleBtn = document.getElementById('toggle-job-list');
  const currentlyVisible = jobList.style.display === 'flex';
  jobList.style.display = currentlyVisible ? 'none' : 'flex';
  toggleBtn.textContent = currentlyVisible ? '▶' : '▼';
};


function restoreTrackerPosition() {
  const pos = localStorage.getItem(TRACKER_POSITION_KEY);
  if (pos) {
    try {
      const { left, top } = JSON.parse(pos);
      trackerApp.style.left = left;
      trackerApp.style.top = top;
    } catch {}
  }
}



function init() {
  loadSelectedJobs();
  restoreTrackerPosition();
  renderJobList();
  renderSummary();
}

init();
