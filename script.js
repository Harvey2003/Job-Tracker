// ====== START UP ===================================================
// ===================================================================

// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qbZRx_7dX4dg8niBS0TedA_grY5M0su";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === EMAILJS INIT ===
emailjs.init("ASqDA9Nflas4yZppr");

// === HELPER: format duration ===
function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

// === DOM ELEMENTS ===
const loginScreen         = document.getElementById("loginScreen");
const loginEmail          = document.getElementById("loginEmail");
const loginPassword       = document.getElementById("loginPassword");
const loginButton         = document.getElementById("loginButton");
const loginError          = document.getElementById("loginError");
const welcomeSub          = document.getElementById("welcomeSub");
const logoutButton        = document.getElementById("logoutButton");
const openCloseNav        = document.getElementById("openCloseNav");
const navBar              = document.getElementById("navBar");
const navOverlay          = document.getElementById("navOverlay");
const addJob              = document.getElementById("addJob");
const newJobForm          = document.getElementById("newJobForm");
const formClose           = document.getElementById("formClose");
const newJobButton        = document.getElementById("newJobButton");
const jobCardsContainer   = document.getElementById("jobCardsContainer");
const jobsSection         = document.getElementById("jobsSection");
const createJobSection    = document.getElementById("createJobSection");
const jobDetail           = document.getElementById("jobDetail");
const jobDetailBack       = document.getElementById("jobDetailBack");
const jobDetailEditToggle = document.getElementById("jobDetailEditToggle");
const jobDetailView       = document.getElementById("jobDetailView");
const jobDetailEdit       = document.getElementById("jobDetailEdit");
const clockButton         = document.getElementById("clockButton");
const clockButtonText     = document.getElementById("clockButtonText");
const clockStatus         = document.getElementById("clockStatus");
const totalTimeDisplay    = document.getElementById("totalTimeDisplay");
const completeJobButton   = document.getElementById("completeJobButton");
const uncompleteJobButton = document.getElementById("uncompleteJobButton");
const saveEditButton      = document.getElementById("saveEditButton");
const timeLogsContainer   = document.getElementById("timeLogsContainer");
const searchInput         = document.getElementById("searchInput");
const clearSearchButton   = document.getElementById("clearSearchButton");
const travelToggleBtn     = document.getElementById("travelToggleBtn");
const travelToggleText    = document.getElementById("travelToggleText");
const travelStatus        = document.getElementById("travelStatus");
const takePhotoBtn        = document.getElementById("takePhotoBtn");
const photoGrid           = document.getElementById("photoGrid");
const sendPhotosEmailBtn  = document.getElementById("sendPhotosEmailBtn");

// === STATE ===
let currentJob        = null;
let currentUser       = null;
let activeWorkSession = null;
let activeTravelLog   = null;
let capturedPhotos    = [];
let currentSearchTerm = "";
let groupCollapsedState = { active: false, upcoming: false, completed: false };
let newJobStock = [];
let editJobStock = [];
let detailStockArray = [];
let allTimeLogs = [];
let currentLogsPage = 1;
const logsPerPage = 5;
let syncInProgress = false;
const QUEUE_KEY = 'offline_queue';

// === OFFLINE QUEUE HELPERS ===
function getQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}
function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    updateSyncBadge();
}
function addToQueue(action) {
    const queue = getQueue();
    queue.push({ ...action, queuedAt: new Date().toISOString() });
    saveQueue(queue);
}
function clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    updateSyncBadge();
}

function updateSyncBadge() {
    const queue = getQueue();
    const count = queue.length;
    let badge = document.getElementById('syncBadge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'syncBadge';
        badge.style.cssText = 'background:#f59e0b;color:#111827;font-size:0.7rem;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:8px;';
        const welcome = document.getElementById('welcomeMessage');
        if (welcome) welcome.appendChild(badge);
    }
    badge.textContent = count ? `${count} pending` : '';
    badge.style.display = count ? 'inline-block' : 'none';
}

// === LOCAL STORAGE HELPERS ===
function cacheJob(job) {
    try { localStorage.setItem(`job_${job.id}`, JSON.stringify(job)); } catch(e) {}
}
function getCachedJob(jobId) {
    try { return JSON.parse(localStorage.getItem(`job_${jobId}`)); } catch(e) { return null; }
}
function cacheAllJobs(jobs) {
    jobs.forEach(job => cacheJob(job));
    localStorage.setItem("all_job_ids", JSON.stringify(jobs.map(j => j.id)));
}
function getCachedAllJobs() {
    try {
        const ids = JSON.parse(localStorage.getItem("all_job_ids") || "[]");
        return ids.map(id => getCachedJob(id)).filter(Boolean);
    } catch(e) { return []; }
}

// === STOCK HELPERS ===
function parseStockArray(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m] || m));
}
function renderStockChips(containerId, arr, removeFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    arr.forEach((item, idx) => {
        const chip = document.createElement('span');
        chip.className = 'stockChip';
        chip.innerHTML = `${escapeHtml(item)} <span class="removeChip" data-index="${idx}"><i class="fa-solid fa-xmark"></i></span>`;
        container.appendChild(chip);
    });
    if (removeFn) {
        container.querySelectorAll('.removeChip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                removeFn(idx);
            });
        });
    }
}

// === SYNC QUEUE PROCESSING ===
async function processQueue() {
    if (syncInProgress || !navigator.onLine) return;
    const queue = getQueue();
    if (!queue.length) return;
    syncInProgress = true;
    let remaining = [];
    for (const item of queue) {
        try {
            if (item.type === 'create_job') {
                const { data, error } = await db.from('Jobs').insert(item.data).select().single();
                if (error) throw error;
                // Replace temp ID with real ID in cache
                const cached = getCachedAllJobs();
                const idx = cached.findIndex(j => j.tempId === item.data.tempId);
                if (idx !== -1) {
                    cached[idx] = { ...data, tempId: undefined };
                    cacheAllJobs(cached);
                }
            }
            // Add other actions here if needed
        } catch (err) {
            console.warn('Sync failed, will retry:', item, err);
            remaining.push(item);
        }
    }
    saveQueue(remaining);
    syncInProgress = false;
    if (remaining.length === 0) {
        loadJobs(); // refresh list
    }
}

// Network listeners
window.addEventListener('online', () => { processQueue(); });
window.addEventListener('load', () => {
    processQueue();
    // periodic sync every 30s when online
    setInterval(() => { if (navigator.onLine) processQueue(); }, 30000);
});

// === AUTH ===
db.auth.onAuthStateChange((event, session) => {
    if (session) showApp(session.user);
    else showLogin();
});
function showLogin() {
    loginScreen.classList.add("active");
    loginEmail.value = "";
    loginPassword.value = "";
    loginError.textContent = "";
}
function showApp(user) {
    currentUser = user;
    loginScreen.classList.remove("active");
    const displayName = user.user_metadata?.display_name || user.email.split("@")[0];
    welcomeSub.textContent = displayName;
    loadJobs();
    updateSyncBadge();
}
loginButton.onclick = async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    if (!email || !password) { loginError.textContent = "Enter email and password"; return; }
    loginButton.disabled = true;
    loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Signing...';
    const { error } = await db.auth.signInWithPassword({ email, password });
    loginButton.disabled = false;
    loginButton.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In';
    if (error) loginError.textContent = "Incorrect email or password.";
};
loginPassword.addEventListener("keydown", e => { if (e.key === "Enter") loginButton.click(); });
logoutButton.onclick = async () => { await db.auth.signOut(); closeNav(); };

// === NAV ===
function closeNav() { navBar.classList.remove("open"); navOverlay.classList.remove("active"); }
openCloseNav.onclick = () => { navBar.classList.toggle("open"); navOverlay.classList.toggle("active"); };
navOverlay.onclick = closeNav;
jobsSection.onclick = () => { closeNav(); closeJobDetail(); };
createJobSection.onclick = () => { closeNav(); openForm(); };

// === CREATE JOB FORM ===
function openForm() {
    newJobForm.classList.add("active");
    newJobStock = [];
    renderStockChips('stockChipsCreate', newJobStock, i => newJobStock.splice(i,1) && renderStockChips('stockChipsCreate', newJobStock, () => {}));
    document.getElementById('inputStockItem').value = '';
}
function closeForm() { newJobForm.classList.remove("active"); }
addJob.onclick = openForm;
formClose.onclick = closeForm;
newJobForm.onclick = e => { if (e.target === newJobForm) closeForm(); };
document.getElementById('addStockItemBtn').onclick = () => {
    const inp = document.getElementById('inputStockItem');
    const item = inp.value.trim();
    if (item) { newJobStock.push(item); inp.value = ''; renderStockChips('stockChipsCreate', newJobStock, i => newJobStock.splice(i,1)); }
};
document.getElementById('inputStockItem').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addStockItemBtn').click(); } });

function clearForm() {
    document.getElementById("inputJobName").value = "";
    document.getElementById("inputAddress").value = "";
    document.getElementById("inputClientName").value = "";
    document.getElementById("startDate").value = "";
    document.getElementById("inputFault").value = "";
    document.getElementById("inputPhone").value = "";
    newJobStock = [];
    renderStockChips('stockChipsCreate', [], null);
}

newJobButton.onclick = async () => {
    const jobName = document.getElementById("inputJobName").value.trim();
    if (!jobName) { alert("Please enter a job name."); return; }
    newJobButton.disabled = true;
    newJobButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Saving...';

    const jobData = {
        job_name: jobName,
        address: document.getElementById("inputAddress").value.trim(),
        client_name: document.getElementById("inputClientName").value.trim(),
        start_date: document.getElementById("startDate").value || null,
        stock: newJobStock.join(', '),
        fault_desc: document.getElementById("inputFault").value.trim(),
        status: "active",
        phone: document.getElementById("inputPhone").value.trim()
    };

    if (!navigator.onLine) {
        // Offline: store locally with temp ID
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const localJob = { ...jobData, id: tempId, tempId: tempId, created_at: new Date().toISOString() };
        const cached = getCachedAllJobs();
        cached.unshift(localJob);
        cacheAllJobs(cached);
        addToQueue({ type: 'create_job', data: { ...jobData, tempId } });
        renderJobList(cached);
        alert('📶 Job saved locally and will sync when online.');
        clearForm();
        closeForm();
        newJobButton.disabled = false;
        newJobButton.innerHTML = '<i class="fa-solid fa-check"></i> Create Job';
        return;
    }

    // Online: normal insert
    const { data, error } = await db.from("Jobs").insert([jobData]).select().single();
    newJobButton.disabled = false;
    newJobButton.innerHTML = '<i class="fa-solid fa-check"></i> Create Job';
    if (error) { alert("Failed to save job."); return; }
    const jobs = getCachedAllJobs();
    jobs.unshift(data);
    cacheAllJobs(jobs);
    renderJobList(jobs);
    clearForm();
    closeForm();
};

// === JOB LIST ===
searchInput.oninput = (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    clearSearchButton.style.display = currentSearchTerm ? "flex" : "none";
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    else loadJobs();
};
clearSearchButton.onclick = () => {
    searchInput.value = "";
    currentSearchTerm = "";
    clearSearchButton.style.display = "none";
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    searchInput.focus();
};
function getJobStatus(job) {
    if (job.status === "completed") return "completed";
    if (job.start_date && new Date(job.start_date) > new Date()) return "upcoming";
    return "active";
}
async function loadJobs() {
    jobCardsContainer.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    // Try network first
    if (navigator.onLine) {
        const { data, error } = await db.from("Jobs").select("*").order("created_at", { ascending: false });
        if (!error && data) {
            cacheAllJobs(data);
            renderJobList(data);
            return;
        }
    }
    // Offline or error: use cache
    const cached = getCachedAllJobs();
    if (cached.length) renderJobList(cached);
    else jobCardsContainer.innerHTML = `<p class="emptyState">No jobs found. ${!navigator.onLine ? ' (offline)' : ''}</p>`;
}
function renderJobList(jobs) {
    const filtered = jobs.filter(j => !currentSearchTerm || (j.job_name||"").toLowerCase().includes(currentSearchTerm) || (j.client_name||"").toLowerCase().includes(currentSearchTerm));
    const groups = { active: [], upcoming: [], completed: [] };
    filtered.forEach(j => groups[getJobStatus(j)].push(j));
    jobCardsContainer.innerHTML = "";
    for (const [key, title, icon] of [['active','Active','fa-play'],['upcoming','Upcoming','fa-calendar'],['completed','Completed','fa-check-circle']]) {
        if (groups[key].length) {
            const header = document.createElement("div");
            header.className = "statusGroupHeader";
            if (groupCollapsedState[key]) header.classList.add("collapsed");
            header.innerHTML = `<span class="statusGroupTitle"><i class="fa-solid ${icon}"></i> ${title} <span class="statusGroupCount">${groups[key].length}</span></span><i class="fa-solid fa-chevron-down groupChevron"></i>`;
            header.onclick = () => {
                header.classList.toggle("collapsed");
                groupCollapsedState[key] = header.classList.contains("collapsed");
                let next = header.nextSibling;
                while (next && !next.classList?.contains("statusGroupHeader")) {
                    if (next.classList?.contains("jobCard")) next.classList.toggle("group-collapsed", groupCollapsedState[key]);
                    next = next.nextSibling;
                }
            };
            jobCardsContainer.appendChild(header);
            groups[key].forEach(job => {
                const card = buildJobCard(job);
                if (groupCollapsedState[key]) card.classList.add("group-collapsed");
                jobCardsContainer.appendChild(card);
            });
        }
    }
    if (!filtered.length) jobCardsContainer.innerHTML = `<p class="emptyState">No jobs found.</p>`;
}
function buildJobCard(job) {
    const card = document.createElement("div");
    card.className = "jobCard";
    card.dataset.id = job.id;
    const status = getJobStatus(job);
    const { bg, color } = status === 'active' ? { bg: "#fef3c7", color: "#d97706" } : status === 'upcoming' ? { bg: "#dbeafe", color: "#2563eb" } : { bg: "#dcfce7", color: "#16a34a" };
    const isTemp = job.tempId ? true : false;
    const pendingBadge = isTemp ? `<span style="background:#f59e0b;color:#111;font-size:0.6rem;padding:2px 8px;border-radius:12px;margin-left:6px;">⏳ Syncing</span>` : '';
    card.innerHTML = `<div class="jobCardHeader"><p class="jobName">${escapeHtml(job.job_name)} ${pendingBadge}</p><span class="statusBadge" style="background:${bg};color:${color}">${status}</span></div><p class="jobSub">${escapeHtml(job.client_name||'No client')} · ${job.start_date||'No date'}</p>`;
    card.onclick = () => openJobDetail(job.id);
    return card;
}

// === TRAVEL & CLOCK LOGIC (unchanged but with offline handling) ===
async function fetchActiveTravelLog(jobId) {
    if (!navigator.onLine) return null;
    const { data } = await db.from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", currentUser.id)
        .eq("is_travel", true)
        .is("clocked_out_at", null)
        .maybeSingle();
    return data;
}
async function fetchActiveWorkSession(jobId) {
    if (!navigator.onLine) return null;
    const { data } = await db.from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", currentUser.id)
        .eq("is_travel", false)
        .is("clocked_out_at", null)
        .maybeSingle();
    return data;
}

async function updateTravelUI() {
    const isTravelActive = !!activeTravelLog;
    if (isTravelActive) {
        travelToggleBtn.classList.add("activeTravel");
        travelToggleText.textContent = "Stop Travel";
        travelStatus.textContent = `Travel started at ${new Date(activeTravelLog.clocked_in_at).toLocaleTimeString()}`;
    } else {
        travelToggleBtn.classList.remove("activeTravel");
        travelToggleText.textContent = "Start Travel";
        travelStatus.textContent = "";
    }
}

travelToggleBtn.addEventListener("click", async () => {
    if (!currentJob || !navigator.onLine) { alert("You must be online to track travel."); return; }
    travelToggleBtn.disabled = true;
    try {
        if (activeTravelLog) {
            const now = new Date();
            const duration = Math.floor((now - new Date(activeTravelLog.clocked_in_at)) / 1000);
            await db.from("time_logs").update({
                clocked_out_at: now.toISOString(),
                duration_seconds: duration
            }).eq("id", activeTravelLog.id);
            activeTravelLog = null;
            await loadTimeLogs(currentJob.id);
            await updateTravelUI();
        } else {
            if (activeWorkSession) {
                alert("Please clock out before starting travel.");
                return;
            }
            const now = new Date().toISOString();
            const displayName = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "User";
            const { data, error } = await db.from("time_logs").insert([{
                job_id: currentJob.id,
                user_id: currentUser.id,
                user_name: displayName,
                clocked_in_at: now,
                clocked_out_at: null,
                duration_seconds: 0,
                is_travel: true
            }]).select().single();
            if (error) throw error;
            activeTravelLog = data;
            await updateTravelUI();
        }
    } catch (err) {
        console.error("Travel toggle error:", err);
        alert("Action failed: " + err.message);
    } finally {
        travelToggleBtn.disabled = false;
    }
});

async function handleClockIn() {
    if (activeTravelLog) {
        const now = new Date();
        const duration = Math.floor((now - new Date(activeTravelLog.clocked_in_at)) / 1000);
        await db.from("time_logs").update({
            clocked_out_at: now.toISOString(),
            duration_seconds: duration
        }).eq("id", activeTravelLog.id);
        activeTravelLog = null;
        await updateTravelUI();
        await loadTimeLogs(currentJob.id);
    }

    const now = new Date().toISOString();
    const displayName = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "User";
    const { data, error } = await db.from("time_logs").insert([{
        job_id: currentJob.id,
        user_id: currentUser.id,
        user_name: displayName,
        clocked_in_at: now,
        clocked_out_at: null,
        duration_seconds: 0,
        is_travel: false
    }]).select().single();
    if (error) { alert("Clock in failed: " + error.message); return; }
    activeWorkSession = data;
    updateClockUI();
    loadTimeLogs(currentJob.id);
}

async function handleClockOut() {
    if (!activeWorkSession) return;
    const now = new Date();
    const duration = Math.floor((now - new Date(activeWorkSession.clocked_in_at)) / 1000);
    const newTotal = (currentJob.total_time_seconds || 0) + duration;
    await db.from("time_logs").update({
        clocked_out_at: now.toISOString(),
        duration_seconds: duration
    }).eq("id", activeWorkSession.id);
    await db.from("Jobs").update({ total_time_seconds: newTotal }).eq("id", currentJob.id);
    const { data: updated } = await db.from("Jobs").select("*").eq("id", currentJob.id).single();
    if (updated) { currentJob = updated; cacheJob(updated); populateDetailView(updated); }
    activeWorkSession = null;
    updateClockUI();
    loadTimeLogs(currentJob.id);
}

function updateClockUI() {
    if (activeWorkSession) {
        clockButton.classList.add("clockedIn");
        clockButtonText.textContent = "Clock Out";
        clockStatus.textContent = `Clocked in at ${new Date(activeWorkSession.clocked_in_at).toLocaleTimeString()}`;
        // Live timer
        if (window.clockInterval) clearInterval(window.clockInterval);
        window.clockInterval = setInterval(() => {
            const start = new Date(activeWorkSession.clocked_in_at);
            const elapsed = Math.floor((Date.now() - start) / 1000);
            totalTimeDisplay.textContent = `⏳ ${formatDuration(elapsed)}`;
        }, 1000);
    } else {
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";
        clockStatus.textContent = "Not clocked in";
        if (window.clockInterval) clearInterval(window.clockInterval);
        totalTimeDisplay.textContent = (currentJob?.total_time_seconds || 0) > 0 ? `Total work time: ${formatDuration(currentJob.total_time_seconds)}` : "";
    }
}

clockButton.addEventListener("click", async () => {
    if (!currentJob) return;
    if (!navigator.onLine) { alert("You must be online to clock in/out."); return; }
    clockButton.disabled = true;
    try {
        if (activeWorkSession) await handleClockOut();
        else await handleClockIn();
    } catch (err) { console.error(err); alert("Action failed."); }
    finally { clockButton.disabled = false; }
});

// === JOB DETAIL ===
async function openJobDetail(jobId) {
    jobDetail.classList.add("active");
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    document.getElementById('addStockInlineForm').style.display = 'none';
    document.getElementById('addStockInlineBtn').style.display = 'inline-flex';

    // Try cache first
    let job = getCachedJob(jobId);
    if (job) {
        currentJob = job;
        populateDetailView(job);
        // Refresh if online
        if (navigator.onLine) {
            try {
                const { data, error } = await db.from("Jobs").select("*").eq("id", jobId).single();
                if (!error && data) {
                    currentJob = data;
                    cacheJob(data);
                    populateDetailView(data);
                }
            } catch {}
        }
    } else if (navigator.onLine) {
        const { data, error } = await db.from("Jobs").select("*").eq("id", jobId).single();
        if (error) { alert("Failed to load job details."); closeJobDetail(); return; }
        currentJob = data;
        cacheJob(data);
        populateDetailView(data);
    } else {
        alert("You are offline and this job is not cached.");
        closeJobDetail();
        return;
    }

    // Active sessions only if online
    if (navigator.onLine) {
        activeTravelLog = await fetchActiveTravelLog(jobId);
        activeWorkSession = await fetchActiveWorkSession(jobId);
        await updateTravelUI();
        updateClockUI();
        loadTimeLogs(jobId);
        travelToggleBtn.disabled = false;
        clockButton.disabled = false;
    } else {
        activeTravelLog = null;
        activeWorkSession = null;
        travelToggleBtn.disabled = true;
        clockButton.disabled = true;
        clockStatus.textContent = 'Offline – clock/travel unavailable';
        travelStatus.textContent = '';
        totalTimeDisplay.textContent = '';
    }

    capturedPhotos = [];
    renderPhotoGrid();
}

function closeJobDetail() {
    jobDetail.classList.remove("active");
    currentJob = null;
    activeWorkSession = null;
    activeTravelLog = null;
    if (window.clockInterval) clearInterval(window.clockInterval);
}
jobDetailBack.onclick = closeJobDetail;

function populateDetailView(job) {
    const status = getJobStatus(job);
    const { bg, color } = status === 'active' ? { bg: "#fef3c7", color: "#d97706" } : status === 'upcoming' ? { bg: "#dbeafe", color: "#2563eb" } : { bg: "#dcfce7", color: "#16a34a" };
    document.getElementById("jobDetailTitle").textContent = job.job_name;
    document.getElementById("detailJobName").textContent = job.job_name || "—";
    
    // Phone clickable
    const phoneSpan = document.getElementById("detailPhone");
    const phone = job.phone || "";
    if (phone) {
        phoneSpan.innerHTML = `<a href="tel:${encodeURIComponent(phone)}" style="color:inherit; text-decoration:none;" class="clickable-phone">${escapeHtml(phone)} <i class="fa-solid fa-phone" style="color:#10b981; margin-left:6px;"></i></a>`;
        phoneSpan.style.cursor = "pointer";
    } else {
        phoneSpan.textContent = "—";
        phoneSpan.style.cursor = "default";
    }

    // Address clickable
    const addressSpan = document.getElementById("detailAddress");
    const addr = job.address || "";
    if (addr) {
        addressSpan.innerHTML = `${escapeHtml(addr)} <i class="fa-solid fa-location-dot" style="color:#f59e0b; margin-left:6px;"></i>`;
        addressSpan.style.cursor = "pointer";
        addressSpan.onclick = (e) => {
            e.stopPropagation();
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
            window.open(url, '_blank');
        };
    } else {
        addressSpan.textContent = "—";
        addressSpan.style.cursor = "default";
        addressSpan.onclick = null;
    }

    document.getElementById("detailClientName").textContent = job.client_name || "—";
    document.getElementById("detailStartDate").textContent = job.start_date || "—";
    document.getElementById("detailFault").textContent = job.fault_desc || "—";
    document.getElementById("detailStatus").innerHTML = `<span class="statusBadge" style="background:${bg};color:${color}">${status}</span>`;

    const stockArr = parseStockArray(job.stock || '');
    detailStockArray = [...stockArr];
    const container = document.getElementById('stockChipsView');
    container.innerHTML = '';
    stockArr.forEach(s => { const chip = document.createElement('span'); chip.className='stockChip'; chip.textContent=s; container.appendChild(chip); });

    const isCompleted = job.status === "completed";
    document.getElementById('addStockInlineBtn').style.display = isCompleted ? 'none' : 'inline-flex';
    document.getElementById("clockSection").style.display = isCompleted ? "none" : "block";
    document.getElementById("photosSection").style.display = isCompleted ? "none" : "block";
    completeJobButton.style.display = isCompleted ? "none" : "flex";
    uncompleteJobButton.style.display = isCompleted ? "flex" : "none";
}

async function loadTimeLogs(jobId) {
    const timeLogsContainer = document.getElementById("timeLogsContainer");
    if (!timeLogsContainer) return;
    if (!navigator.onLine) {
        timeLogsContainer.innerHTML = '<p class="emptyState">Offline – time logs not available.</p>';
        return;
    }
    timeLogsContainer.innerHTML = '<p class="emptyState">Loading...</p>';
    const oldPagination = document.querySelector(".pagination-controls");
    if (oldPagination) oldPagination.remove();
    
    const { data, error } = await db.from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("clocked_in_at", { ascending: false });
    
    if (error || !data || !data.length) {
        timeLogsContainer.innerHTML = '<p class="emptyState">No time records yet.</p>';
        allTimeLogs = [];
        currentLogsPage = 1;
        return;
    }
    allTimeLogs = data;
    currentLogsPage = 1;
    renderTimeLogsPage();
}

function renderTimeLogsPage() { /* unchanged */ }

// === STOCK INLINE ADD ===
document.getElementById('addStockInlineBtn').onclick = () => {
    document.getElementById('addStockInlineForm').style.display = 'flex';
    document.getElementById('addStockInlineBtn').style.display = 'none';
};
document.getElementById('cancelAddStockBtn').onclick = () => {
    document.getElementById('addStockInlineForm').style.display = 'none';
    document.getElementById('addStockInlineBtn').style.display = 'inline-flex';
};
document.getElementById('addStockInlineConfirmBtn').onclick = async () => {
    const item = document.getElementById('newStockItemInput').value.trim();
    if (!item || !currentJob) return;
    if (!navigator.onLine) { alert("You must be online to update stock."); return; }
    detailStockArray.push(item);
    const newStock = detailStockArray.join(', ');
    await db.from("Jobs").update({ stock: newStock }).eq("id", currentJob.id);
    currentJob.stock = newStock;
    cacheJob(currentJob);
    populateDetailView(currentJob);
    document.getElementById('newStockItemInput').value = '';
    document.getElementById('addStockInlineForm').style.display = 'none';
    document.getElementById('addStockInlineBtn').style.display = 'inline-flex';
};

// === EDIT JOB ===
jobDetailEditToggle.onclick = () => { /* unchanged */ };
document.getElementById('editAddStockItemBtn').onclick = () => { /* unchanged */ };
saveEditButton.onclick = async () => {
    /* unchanged but add offline check */
    if (!navigator.onLine) { alert("You must be online to edit a job."); return; }
    // ... rest of save logic
};

// === COMPLETE JOB ===
completeJobButton.addEventListener("click", async () => {
    if (!navigator.onLine) { alert("You must be online to complete a job."); return; }
    // ... rest unchanged
});

// === UNCOMPLETE JOB ===
uncompleteJobButton.addEventListener("click", async () => {
    if (!navigator.onLine) { alert("You must be online to uncomplete a job."); return; }
    // ... rest unchanged
});

// === PHOTOS (unchanged) ===
// ... all photo functions remain as before

// === SERVICE WORKER & UPDATES ===
async function registerSW() { /* unchanged */ }
const manualUpdateBtn = document.getElementById('manual-update-btn');
if (manualUpdateBtn) { /* unchanged */ }
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSW);
} else {
    registerSW();
}