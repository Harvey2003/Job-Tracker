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

// === HELPER: datetime-local conversions ===
function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    // Build YYYY-MM-DDTHH:MM in local time
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
    if (!local) return null;
    const d = new Date(local);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
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
const jobPaginationContainer = document.getElementById("jobPaginationContainer");
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
let activeWorkSession = null;   // active work log (clocked in, is_travel=false)
let activeTravelLog   = null;   // active travel log (is_travel=true, clocked_out_at=null)
let capturedPhotos    = [];
let currentSearchTerm = "";
let newJobStock = [];
let editJobStock = [];
let detailStockArray = [];

// Global variables for time-log pagination
let allTimeLogs = [];
let currentLogsPage = 1;
const logsPerPage = 5;
let currentTimeLogFilter = "all";  // 'all' | 'work' | 'travel'

// Job list: tab + per-tab pagination
let currentJobTab = 'active';                       // 'active' | 'upcoming' | 'completed'
let currentJobsPage = { active: 1, upcoming: 1, completed: 1 };
const jobsPerPage = 5;

// Time-log edit modal state
let editingLogId = null;
let editingLogType = "work";  // 'work' | 'travel'


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
    return text.replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m] || m));
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
    const email = user.email || "";

    // Top nav welcome text
    welcomeSub.textContent = displayName;

    // Sidebar user area
    const sidebarName = document.getElementById("navUserName");
    const sidebarEmail = document.getElementById("navUserEmail");
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarEmail) sidebarEmail.textContent = email;

    loadJobs();
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
newJobButton.onclick = async () => {
    const jobName = document.getElementById("inputJobName").value.trim();
    if (!jobName) { alert("Please enter a job name."); return; }
    newJobButton.disabled = true;
    newJobButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Saving...';
    const { data, error } = await db.from("Jobs").insert([{
        job_name: jobName,
        address: document.getElementById("inputAddress").value.trim(),
        client_name: document.getElementById("inputClientName").value.trim(),
        start_date: document.getElementById("startDate").value || null,
        stock: newJobStock.join(', '),
        fault_desc: document.getElementById("inputFault").value.trim(),
        status: "active",
        phone: document.getElementById("inputPhone").value.trim()
    }]).select().single();
    newJobButton.disabled = false;
    newJobButton.innerHTML = '<i class="fa-solid fa-check"></i> Create Job';
    if (error) { alert("Failed to save job."); return; }
    const jobs = getCachedAllJobs();
    jobs.unshift(data);
    cacheAllJobs(jobs);
    renderJobList(jobs);
    document.getElementById("inputJobName").value = "";
    document.getElementById("inputAddress").value = "";
    document.getElementById("inputClientName").value = "";
    document.getElementById("startDate").value = "";
    document.getElementById("inputFault").value = "";
    document.getElementById("inputPhone").value = "";
    newJobStock = [];
    renderStockChips('stockChipsCreate', [], null);
    closeForm();
};


// === JOB LIST ===
searchInput.oninput = (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    clearSearchButton.style.display = currentSearchTerm ? "flex" : "none";
    currentJobsPage[currentJobTab] = 1;
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    else loadJobs();
};
clearSearchButton.onclick = () => {
    searchInput.value = "";
    currentSearchTerm = "";
    clearSearchButton.style.display = "none";
    currentJobsPage[currentJobTab] = 1;
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    searchInput.focus();
};

function getJobStatus(job) {
    if (job.status === "completed") return "completed";
    if (job.start_date && new Date(job.start_date) > new Date()) return "upcoming";
    return "active";
}

function setJobTab(tab) {
    if (!['active', 'upcoming', 'completed'].includes(tab)) return;
    currentJobTab = tab;
    currentJobsPage[tab] = 1;
    document.querySelectorAll('#jobTabs .jobTab').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    else loadJobs();
}
document.querySelectorAll('#jobTabs .jobTab').forEach(btn => {
    btn.addEventListener('click', () => setJobTab(btn.dataset.tab));
});

async function loadJobs() {
    jobCardsContainer.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    jobPaginationContainer.innerHTML = '';
    const { data, error } = await db.from("Jobs").select("*").order("created_at", { ascending: false });
    if (error || !data) {
        const cached = getCachedAllJobs();
        if (cached.length) renderJobList(cached);
        else jobCardsContainer.innerHTML = `<p class="emptyState">Failed to load jobs.</p>`;
        return;
    }
    cacheAllJobs(data);
    renderJobList(data);
}

function renderJobList(jobs) {
    const searched = jobs.filter(j =>
        !currentSearchTerm ||
        (j.job_name || "").toLowerCase().includes(currentSearchTerm) ||
        (j.client_name || "").toLowerCase().includes(currentSearchTerm) ||
        (j.address || "").toLowerCase().includes(currentSearchTerm)
    );
    const groups = { active: [], upcoming: [], completed: [] };
    searched.forEach(j => groups[getJobStatus(j)].push(j));

    document.getElementById('tabCountActive').textContent = groups.active.length;
    document.getElementById('tabCountUpcoming').textContent = groups.upcoming.length;
    document.getElementById('tabCountCompleted').textContent = groups.completed.length;

    const currentGroup = groups[currentJobTab] || [];
    renderJobTabPage(currentGroup);
}

function renderJobTabPage(groupJobs) {
    jobCardsContainer.innerHTML = '';
    jobPaginationContainer.innerHTML = '';

    if (!groupJobs.length) {
        const emptyMsg = currentSearchTerm
            ? `No ${currentJobTab} jobs match "${escapeHtml(currentSearchTerm)}".`
            : `No ${currentJobTab} jobs.`;
        jobCardsContainer.innerHTML = `<p class="emptyState">${emptyMsg}</p>`;
        return;
    }

    const totalPages = Math.ceil(groupJobs.length / jobsPerPage);
    if (currentJobsPage[currentJobTab] > totalPages) currentJobsPage[currentJobTab] = totalPages;
    if (currentJobsPage[currentJobTab] < 1) currentJobsPage[currentJobTab] = 1;

    const page = currentJobsPage[currentJobTab];
    const start = (page - 1) * jobsPerPage;
    const pageJobs = groupJobs.slice(start, start + jobsPerPage);

    pageJobs.forEach(job => {
        jobCardsContainer.appendChild(buildJobCard(job));
    });

    if (totalPages > 1) {
        jobPaginationContainer.innerHTML = `
            <div class="pagination-controls">
                <button class="pagination-btn" id="jobsPrevBtn" ${page === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <span class="page-indicator">Page ${page} of ${totalPages}</span>
                <button class="pagination-btn" id="jobsNextBtn" ${page === totalPages ? 'disabled' : ''}>
                    Next <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
        const prevBtn = document.getElementById('jobsPrevBtn');
        const nextBtn = document.getElementById('jobsNextBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (currentJobsPage[currentJobTab] > 1) {
                currentJobsPage[currentJobTab]--;
                renderJobList(getCachedAllJobs());
                document.getElementById('jobLists').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            if (currentJobsPage[currentJobTab] < totalPages) {
                currentJobsPage[currentJobTab]++;
                renderJobList(getCachedAllJobs());
                document.getElementById('jobLists').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

function buildJobCard(job) {
    const card = document.createElement("div");
    card.className = "jobCard";
    card.dataset.id = job.id;

    const status = getJobStatus(job);
    const { bg, color } = status === 'active'
        ? { bg: "#fef3c7", color: "#b45309" }
        : status === 'upcoming'
            ? { bg: "#dbeafe", color: "#1d4ed8" }
            : { bg: "#dcfce7", color: "#15803d" };

    const client  = job.client_name || "No client";
    const address = job.address     || "No address";

    card.innerHTML = `
        <div class="jobCardHeader">
            <p class="jobName">${escapeHtml(job.job_name || "Untitled job")}</p>
            <span class="statusBadge" style="background:${bg};color:${color}">${status}</span>
        </div>
        <div class="jobCardMeta">
            <div class="jobCardMetaRow client">
                <i class="fa-regular fa-user"></i>
                <span>${escapeHtml(client)}</span>
            </div>
            <div class="jobCardMetaRow address">
                <i class="fa-solid fa-location-dot"></i>
                <span>${escapeHtml(address)}</span>
            </div>
        </div>
    `;
    card.onclick = () => openJobDetail(job.id);
    return card;
}


// === TRAVEL & CLOCK LOGIC ===
async function fetchActiveTravelLog(jobId) {
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
    if (!currentJob) return;
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
    } else {
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";
        clockStatus.textContent = "Not clocked in";
    }
    totalTimeDisplay.textContent = (currentJob?.total_time_seconds || 0) > 0 ? `Total work time: ${formatDuration(currentJob.total_time_seconds)}` : "";
}

clockButton.addEventListener("click", async () => {
    if (!currentJob) return;
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

    const { data, error } = await db.from("Jobs").select("*").eq("id", jobId).single();
    if (error) { alert("Failed to load job details."); closeJobDetail(); return; }
    currentJob = data;
    cacheJob(data);
    populateDetailView(data);

    activeTravelLog = await fetchActiveTravelLog(jobId);
    activeWorkSession = await fetchActiveWorkSession(jobId);
    await updateTravelUI();
    updateClockUI();

    // Default the time-log filter to All on entry.
    currentTimeLogFilter = "all";
    document.querySelectorAll('#timeLogFilterTabs .timeLogFilterTab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    currentLogsPage = 1;

    loadTimeLogs(jobId);

    capturedPhotos = [];
    renderPhotoGrid();
}

function closeJobDetail() {
    jobDetail.classList.remove("active");
    currentJob = null;
    activeWorkSession = null;
    activeTravelLog = null;
    closeTimeLogEditModal();
    closeUserTimesModal();
}
jobDetailBack.onclick = closeJobDetail;

function populateDetailView(job) {
    const status = getJobStatus(job);
    const { bg, color } = status === 'active'
        ? { bg: "#fef3c7", color: "#b45309" }
        : status === 'upcoming'
            ? { bg: "#dbeafe", color: "#1d4ed8" }
            : { bg: "#dcfce7", color: "#15803d" };

    // ---- HERO CARD ----
    document.getElementById("jobDetailTitle").textContent = job.job_name || "Job Details";
    document.getElementById("jobHeroName").textContent    = job.job_name || "Untitled job";
    document.getElementById("jobHeroStatus").textContent  = status;
    document.getElementById("jobHeroStatus").style.background = bg;
    document.getElementById("jobHeroStatus").style.color = color;

    const clientText = job.client_name || "No client";
    document.getElementById("jobHeroClient").textContent = clientText;

    const addressSpan = document.getElementById("jobHeroAddress");
    const addr = job.address || "";
    if (addr) {
        addressSpan.textContent = addr;
        addressSpan.onclick = (e) => {
            e.stopPropagation();
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
            window.open(url, '_blank');
        };
    } else {
        addressSpan.textContent = "No address";
        addressSpan.onclick = null;
    }

    // ---- INFO GRID ----
    // Description
    document.getElementById("detailFault").textContent = job.fault_desc || "—";

    // Phone (clickable)
    const phoneSpan = document.getElementById("detailPhone");
    const phone = job.phone || "";
    if (phone) {
        phoneSpan.innerHTML = `<a href="tel:${encodeURIComponent(phone)}" class="clickable-phone">${escapeHtml(phone)} <i class="fa-solid fa-phone"></i></a>`;
    } else {
        phoneSpan.textContent = "—";
    }

    // Start date
    document.getElementById("detailStartDate").textContent = job.start_date || "—";

    // Stock chips
    const stockArr = parseStockArray(job.stock || '');
    detailStockArray = [...stockArr];
    const container = document.getElementById('stockChipsView');
    container.innerHTML = '';
    stockArr.forEach(s => {
        const chip = document.createElement('span');
        chip.className = 'stockChip';
        chip.textContent = s;
        container.appendChild(chip);
    });

    // Toggle completed/active controls
    const isCompleted = job.status === "completed";
    document.getElementById('addStockInlineBtn').style.display = isCompleted ? 'none' : 'inline-flex';
    document.getElementById("clockSection").style.display = isCompleted ? "none" : "block";
    document.getElementById("photosSection").style.display = isCompleted ? "none" : "block";
    completeJobButton.style.display = isCompleted ? "none" : "flex";
    uncompleteJobButton.style.display = isCompleted ? "flex" : "none";
}


// ==================== TIME LOGS ====================

function computeDurationSeconds(log) {
    if (!log.clocked_in_at) return 0;
    const inT = new Date(log.clocked_in_at).getTime();
    const outT = log.clocked_out_at ? new Date(log.clocked_out_at).getTime() : null;
    if (outT && outT > inT) return Math.floor((outT - inT) / 1000);
    if (!log.clocked_out_at && !isNaN(inT)) {
        // Active log: live duration
        return Math.max(0, Math.floor((Date.now() - inT) / 1000));
    }
    return log.duration_seconds || 0;
}

function isActiveLog(log) {
    return !log.clocked_out_at;
}

async function loadTimeLogs(jobId) {
    if (!timeLogsContainer) return;
    timeLogsContainer.innerHTML = '<p class="emptyState">Loading...</p>';

    const { data, error } = await db.from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("clocked_in_at", { ascending: false });

    if (error || !data || !data.length) {
        timeLogsContainer.innerHTML = '<p class="emptyState">No time records yet.</p>';
        allTimeLogs = [];
        currentLogsPage = 1;
        updateTimeLogsTotals([]);
        return;
    }

    allTimeLogs = data;
    currentLogsPage = 1;
    renderTimeLogsPage();
}

function updateTimeLogsTotals(logs) {
    const totalEl = document.getElementById("timeLogsTotals");
    if (!totalEl) return;
    if (!logs || !logs.length) { totalEl.textContent = ""; return; }
    let workSec = 0;
    let travelSec = 0;
    logs.forEach(log => {
        const sec = computeDurationSeconds(log);
        if (log.is_travel) travelSec += sec;
        else workSec += sec;
    });
    totalEl.textContent = `Work ${formatDuration(workSec)} · Travel ${formatDuration(travelSec)}`;
}

function applyTimeLogFilter(logs) {
    if (currentTimeLogFilter === "work")   return logs.filter(l => !l.is_travel);
    if (currentTimeLogFilter === "travel") return logs.filter(l =>  l.is_travel);
    return logs;
}

function renderTimeLogsPage() {
    if (!timeLogsContainer) return;

    const filtered = applyTimeLogFilter(allTimeLogs);
    updateTimeLogsTotals(allTimeLogs);

    if (!filtered.length) {
        const msg = currentTimeLogFilter === "all"
            ? "No time records yet."
            : `No ${currentTimeLogFilter} logs yet.`;
        timeLogsContainer.innerHTML = `<p class="emptyState">${msg}</p>`;
        return;
    }

    const totalPages = Math.ceil(filtered.length / logsPerPage);
    if (currentLogsPage > totalPages) currentLogsPage = totalPages;
    if (currentLogsPage < 1) currentLogsPage = 1;

    const startIdx = (currentLogsPage - 1) * logsPerPage;
    const pageLogs = filtered.slice(startIdx, startIdx + logsPerPage);

    const rowsHtml = pageLogs.map(log => {
        const inTime = new Date(log.clocked_in_at);
        const outTime = log.clocked_out_at ? new Date(log.clocked_out_at) : null;
        const active = isActiveLog(log);

        const dateStr = inTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const inStr   = inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const outStr  = outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

        const duration = computeDurationSeconds(log);
        const durStr = formatDuration(duration);

        const typeClass = log.is_travel ? 'travel' : 'work';
        const typeIcon  = log.is_travel ? 'fa-car' : 'fa-clock';
        const typeLabel = log.is_travel ? 'Travel' : 'Work';

        return `
            <div class="timelog-row" data-log-id="${log.id}">
                <div class="timelog-row top">
                    <div class="timelog-typeBadge ${typeClass}" title="${typeLabel}">
                        <i class="fa-solid ${typeIcon}"></i>
                    </div>
                    <div class="timelog-headline">
                        <span class="timelog-user">${escapeHtml(log.user_name || 'User')}</span>
                        <span class="timelog-date">${escapeHtml(dateStr)} · ${typeLabel}</span>
                    </div>
                    <span class="timelog-durationPill ${active ? 'live' : ''}">${active ? '● ' : ''}${durStr}</span>
                </div>
                <div class="timelog-times">
                    <span class="timelog-time"><i class="fa-solid fa-arrow-right-to-bracket"></i>${escapeHtml(inStr)}</span>
                    <i class="fa-solid fa-arrow-right timelog-arrow"></i>
                    <span class="timelog-time ${active ? 'active' : ''}">
                        <i class="fa-solid ${active ? 'fa-spinner fa-pulse' : 'fa-arrow-right-from-bracket'}"></i>
                        ${outStr ? escapeHtml(outStr) : 'Active'}
                    </span>
                </div>
                <div class="timelog-actions">
                    <button class="timelog-editBtn" data-log-id="${log.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }).join('');

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div class="pagination-controls">
                <button class="pagination-btn" id="logsPrevBtn" ${currentLogsPage === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <span class="page-indicator">Page ${currentLogsPage} of ${totalPages}</span>
                <button class="pagination-btn" id="logsNextBtn" ${currentLogsPage === totalPages ? 'disabled' : ''}>
                    Next <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    timeLogsContainer.innerHTML = rowsHtml + paginationHtml;

    // Wire pagination
    const prevBtn = document.getElementById('logsPrevBtn');
    const nextBtn = document.getElementById('logsNextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (currentLogsPage > 1) { currentLogsPage--; renderTimeLogsPage(); }
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (currentLogsPage < totalPages) { currentLogsPage++; renderTimeLogsPage(); }
    });

    // Wire edit buttons
    timeLogsContainer.querySelectorAll('.timelog-editBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTimeLogEditModal(btn.dataset.logId);
        });
    });
}

// Time-log filter tabs
document.querySelectorAll('#timeLogFilterTabs .timeLogFilterTab').forEach(btn => {
    btn.addEventListener('click', () => {
        currentTimeLogFilter = btn.dataset.filter;
        currentLogsPage = 1;
        document.querySelectorAll('#timeLogFilterTabs .timeLogFilterTab').forEach(b => {
            b.classList.toggle('active', b === btn);
        });
        renderTimeLogsPage();
    });
});


// ==================== TIME LOG EDIT MODAL ====================

function openTimeLogEditModal(logId) {
    // Prefer the inline list; fall back to the modal's raw list (All jobs /
    // different-job scope) so editing works from either place.
    let log = allTimeLogs.find(l => String(l.id) === String(logId));
    if (!log && Array.isArray(userTimesRawLogs)) {
        log = userTimesRawLogs.find(l => String(l.id) === String(logId));
    }
    if (!log) return;

    editingLogId = log.id;
    editingLogType = log.is_travel ? 'travel' : 'work';

    const modal = document.getElementById('timeLogEditModal');
    const typeControl = document.getElementById('editLogTypeControl');
    typeControl.querySelectorAll('.segmentedOption').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.type === editingLogType);
    });

    document.getElementById('editLogIn').value  = isoToLocalInput(log.clocked_in_at);
    document.getElementById('editLogOut').value = log.clocked_out_at ? isoToLocalInput(log.clocked_out_at) : '';

    updateEditLogDurationPreview();
    modal.classList.add('active');
}

function closeTimeLogEditModal() {
    const modal = document.getElementById('timeLogEditModal');
    if (modal) modal.classList.remove('active');
    editingLogId = null;
}

function updateEditLogDurationPreview() {
    const inVal  = document.getElementById('editLogIn').value;
    const outVal = document.getElementById('editLogOut').value;
    const previewEl = document.getElementById('editLogDurationPreview');
    if (!previewEl) return;

    const inIso = localInputToIso(inVal);
    const outIso = localInputToIso(outVal);

    if (!inIso) {
        previewEl.innerHTML = 'Duration: <b>—</b>';
        return;
    }
    const inT = new Date(inIso).getTime();
    const outT = outIso ? new Date(outIso).getTime() : null;

    if (outT !== null && outT <= inT) {
        previewEl.innerHTML = 'Duration: <b style="color:#dc2626;">Invalid — clock-out must be after clock-in</b>';
        return;
    }
    const sec = outT ? Math.floor((outT - inT) / 1000) : Math.floor((Date.now() - inT) / 1000);
    previewEl.innerHTML = `Duration: <b>${formatDuration(Math.max(0, sec))}</b>${outT ? '' : ' <span style="color:#94a3b8;font-weight:500;">(still active)</span>'}`;
}

// Modal — type toggle
document.getElementById('editLogTypeControl').addEventListener('click', (e) => {
    const opt = e.target.closest('.segmentedOption');
    if (!opt) return;
    editingLogType = opt.dataset.type;
    document.querySelectorAll('#editLogTypeControl .segmentedOption').forEach(o => {
        o.classList.toggle('active', o === opt);
    });
});

// Modal — live preview on input change
document.getElementById('editLogIn').addEventListener('input', updateEditLogDurationPreview);
document.getElementById('editLogOut').addEventListener('input', updateEditLogDurationPreview);

// Modal — close / cancel
document.getElementById('timeLogEditClose').addEventListener('click', closeTimeLogEditModal);
document.getElementById('timeLogEditCancel').addEventListener('click', closeTimeLogEditModal);
document.getElementById('timeLogEditModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('timeLogEditModal')) closeTimeLogEditModal();
});

// Modal — save
document.getElementById('timeLogEditSave').addEventListener('click', async () => {
    if (!editingLogId || !currentJob) return;

    const saveBtn = document.getElementById('timeLogEditSave');
    const inVal  = document.getElementById('editLogIn').value;
    const outVal = document.getElementById('editLogOut').value;
    const inIso  = localInputToIso(inVal);
    const outIso = localInputToIso(outVal);

    if (!inIso) {
        alert("Please set a valid clock-in time.");
        return;
    }
    if (outIso && new Date(outIso) <= new Date(inIso)) {
        alert("Clock-out time must be after clock-in time.");
        return;
    }

    const duration = outIso
        ? Math.floor((new Date(outIso) - new Date(inIso)) / 1000)
        : 0;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Saving...';

    try {
        const { error } = await db.from("time_logs").update({
            clocked_in_at: inIso,
            clocked_out_at: outIso,
            duration_seconds: duration,
            is_travel: editingLogType === 'travel'
        }).eq("id", editingLogId);

        if (error) throw error;

        // Recalculate parent job's total_time_seconds from all WORK logs.
        await recalcJobTotalTime(currentJob.id);

        // Reload the logs and refresh the local cache.
        const { data: updatedJob } = await db.from("Jobs").select("*").eq("id", currentJob.id).single();
        if (updatedJob) {
            currentJob = updatedJob;
            cacheJob(updatedJob);
            updateClockUI();
        }

        closeTimeLogEditModal();
        await loadTimeLogs(currentJob.id);

        // If the "My Times" modal is open, refresh it too.
        const userTimesOpen = document.getElementById("userTimesModal")?.classList.contains("active");
        if (userTimesOpen) {
            await fetchAndRenderUserTimes();
        }
    } catch (err) {
        console.error("Save time log failed:", err);
        alert("Failed to save: " + (err.message || "Unknown error"));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save';
    }
});

// Recompute Jobs.total_time_seconds from all non-travel logs of a job.
async function recalcJobTotalTime(jobId) {
    const { data: logs, error } = await db.from("time_logs")
        .select("duration_seconds, is_travel")
        .eq("job_id", jobId);
    if (error || !logs) return;
    const total = logs
        .filter(l => !l.is_travel)
        .reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    await db.from("Jobs").update({ total_time_seconds: total }).eq("id", jobId);
}


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
jobDetailEditToggle.onclick = () => {
    const editing = jobDetailEdit.style.display === "block";
    jobDetailView.style.display = editing ? "block" : "none";
    jobDetailEdit.style.display = editing ? "none" : "block";
    jobDetailEditToggle.innerHTML = editing ? '<i class="fa-solid fa-pen"></i>' : '<i class="fa-solid fa-xmark"></i>';
    if (!editing) {
        document.getElementById("editJobName").value = currentJob.job_name || "";
        document.getElementById("editAddress").value = currentJob.address || "";
        document.getElementById("editClientName").value = currentJob.client_name || "";
        document.getElementById("editStartDate").value = currentJob.start_date || "";
        document.getElementById("editFault").value = currentJob.fault_desc || "";
        document.getElementById("editPhone").value = currentJob.phone || "";
        editJobStock = parseStockArray(currentJob.stock || '');
        renderStockChips('stockChipsEdit', editJobStock, i => editJobStock.splice(i,1));
    }
};
document.getElementById('editAddStockItemBtn').onclick = () => {
    const inp = document.getElementById('editStockItemInput');
    if (inp.value.trim()) { editJobStock.push(inp.value.trim()); inp.value = ''; renderStockChips('stockChipsEdit', editJobStock, i => editJobStock.splice(i,1)); }
};
saveEditButton.onclick = async () => {
    const updates = {
        job_name: document.getElementById("editJobName").value.trim(),
        address: document.getElementById("editAddress").value.trim(),
        client_name: document.getElementById("editClientName").value.trim(),
        start_date: document.getElementById("editStartDate").value || null,
        stock: editJobStock.join(', '),
        fault_desc: document.getElementById("editFault").value.trim(),
        phone: document.getElementById("editPhone").value.trim()
    };
    if (!updates.job_name) { alert("Job name required"); return; }
    saveEditButton.disabled = true;
    saveEditButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Saving...';
    const { data, error } = await db.from("Jobs").update(updates).eq("id", currentJob.id).select().single();
    saveEditButton.disabled = false;
    saveEditButton.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    if (error) { alert("Failed to save."); return; }
    currentJob = data;
    cacheJob(data);
    populateDetailView(data);
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
};


// === COMPLETE JOB (EMAIL FIRST, THEN COMPLETE) ===
completeJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as complete? A summary email will be sent first.")) return;

    if (activeWorkSession) {
        await handleClockOut();
    }
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

    const { data: logs } = await db.from("time_logs")
        .select("*")
        .eq("job_id", currentJob.id)
        .order("clocked_in_at", { ascending: true });
    const totalSeconds = logs?.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) || 0;
    const totalHours = (totalSeconds / 3600).toFixed(2);

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-NZ", { day:"numeric", month:"short" }) : "—";
    const fmtTime = (d) => new Date(d).toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" });
    const fmtDur = (s) => formatDuration(s);
    const tableHtml = logs && logs.length > 0
        ? `<table border="0" cellpadding="8" style="border-collapse:collapse; width:100%;">
            <thead><tr style="background:#f0f0f0;"><th>Type</th><th>User</th><th>Date</th><th>In</th><th>Out</th><th>Duration</th></tr></thead>
            <tbody>
                ${logs.map(log => `<tr>
                    <td>${log.is_travel ? "🚗 Travel" : "Work"}</td>
                    <td>${escapeHtml(log.user_name)}</td>
                    <td>${fmtDate(log.clocked_in_at)}</td>
                    <td>${fmtTime(log.clocked_in_at)}</td>
                    <td>${log.clocked_out_at ? fmtTime(log.clocked_out_at) : "—"}</td>
                    <td>${fmtDur(log.duration_seconds || 0)}</td>
                </tr>`).join("")}
            </tbody>
        </table>`
        : "No time sessions recorded.";

    const templateParams = {
        to_email: "ashleywork02@gmail.com",
        job_name: currentJob.job_name || "—",
        client_name: currentJob.client_name || "—",
        address: currentJob.address || "—",
        phone: currentJob.phone || "—",
        start_date: currentJob.start_date || "—",
        stock: currentJob.stock || "—",
        fault_desc: currentJob.fault_desc || "—",
        total_time: `${totalHours} hours (${totalSeconds} sec)`,
        time_sessions_table: tableHtml
    };

    completeJobButton.disabled = true;
    completeJobButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Sending email...';

    try {
        const response = await emailjs.send(
            "service_nlma6da",
            "template_y2ineka",
            templateParams
        );
        if (response.status === 200) {
            await db.from("Jobs").update({ status: "completed" }).eq("id", currentJob.id);
            alert('✅ Job completed and summary email sent.');
            loadJobs();
            closeJobDetail();
        } else {
            throw new Error('EmailJS returned unexpected status');
        }
    } catch (err) {
        console.error("Email error:", err);
        alert(`❌ Job NOT completed. Email failed: ${err.message || "Unknown error"}`);
    } finally {
        completeJobButton.disabled = false;
        completeJobButton.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Complete Job';
    }
});


// === UNCOMPLETE JOB ===
uncompleteJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as active again?")) return;
    await db.from("Jobs").update({ status: "active" }).eq("id", currentJob.id);
    loadJobs();
    closeJobDetail();
});


// === PHOTOS ===
function renderPhotoGrid() {
    photoGrid.innerHTML = '';
    capturedPhotos.forEach((src, idx) => {
        const div = document.createElement('div'); div.className = 'photoThumb';
        const img = document.createElement('img'); img.src = src;
        const remove = document.createElement('div'); remove.className = 'removePhoto'; remove.innerHTML = '<i class="fa-solid fa-times"></i>';
        remove.onclick = () => { capturedPhotos.splice(idx,1); renderPhotoGrid(); sendPhotosEmailBtn.style.display = capturedPhotos.length ? "inline-flex" : "none"; };
        div.appendChild(img); div.appendChild(remove); photoGrid.appendChild(div);
    });
    sendPhotosEmailBtn.style.display = capturedPhotos.length ? "inline-flex" : "none";
}

takePhotoBtn.addEventListener("click", () => {
    if (capturedPhotos.length >= 3) { alert("Maximum 3 photos."); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { capturedPhotos.push(ev.target.result); renderPhotoGrid(); };
            reader.readAsDataURL(file);
        }
    };
    input.click();
});

sendPhotosEmailBtn.addEventListener("click", async () => {
    if (!capturedPhotos.length) return;

    const files = await Promise.all(capturedPhotos.map(async (dataUrl, idx) => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], `job_photo_${idx + 1}.jpg`, { type: blob.type });
    }));

    if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
        try {
            await navigator.share({
                title: `${currentJob.job_name}`,
                text: `Job: ${currentJob.job_name}\nClient: ${currentJob.client_name}\nAddress: ${currentJob.address}`,
                files: files
            });
        } catch (err) {
            if (err.name !== "AbortError") {
                console.error("Share failed:", err);
                alert("Sharing failed. Please try again.");
            }
        }
    } else {
        alert("Your browser does not support sharing images directly.\nPlease use a mobile device (Android/iOS) or update your browser.");
    }
});

// ==================== USER TIMES REPORT (per-user, job + date filtered) ====================

// State for the modal
let userTimesRawLogs = [];          // logs for current scope (job + user), unfiltered by date
let userTimesFilteredLogs = [];     // after date-range filter
let userTimesRange = "all";         // 'all' | '7d' | '30d' | '365d'
let userTimesJobScope = "current";  // 'current' | 'all' | 'pick'
let userTimesPickedJobId = null;    // set when userTimesJobScope === 'pick'
let userTimesPage = 1;
const userTimesPerPage = 10;

// Cache of the job list for the picker (built from localStorage cache)
let userTimesJobCache = [];

// --- Helpers --------------------------------------------------------------

function rangeToMs(range) {
    if (range === "7d")   return 7   * 24 * 60 * 60 * 1000;
    if (range === "30d")  return 30  * 24 * 60 * 60 * 1000;
    if (range === "365d") return 365 * 24 * 60 * 60 * 1000;
    return null;
}

function displayNameForUser() {
    if (!currentUser) return "User";
    return currentUser.user_metadata?.display_name
        || (currentUser.email ? currentUser.email.split("@")[0] : "User");
}

function findJobById(jobId) {
    if (!jobId) return null;
    return userTimesJobCache.find(j => String(j.id) === String(jobId)) || null;
}

function currentJobLabel() {
    if (!currentJob) return "This job";
    return currentJob.job_name || "This job";
}

function scopeLabel() {
    if (userTimesJobScope === "all") return "All jobs";
    if (userTimesJobScope === "pick") {
        const j = findJobById(userTimesPickedJobId);
        return j ? (j.job_name || "Selected job") : "Selected job";
    }
    return currentJobLabel();
}

// Build a map of jobId -> job_name for the row rendering.
function buildJobNameMap() {
    const map = {};
    userTimesJobCache.forEach(j => { map[String(j.id)] = j.job_name || "Untitled"; });
    return map;
}

// --- Job picker -----------------------------------------------------------

function refreshJobCache() {
    // Prefer cached jobs from localStorage; fall back to a network fetch
    // if we've never populated it.
    const cached = getCachedAllJobs();
    if (cached && cached.length) {
        userTimesJobCache = cached.slice();
        return;
    }
    // Will be filled by the fetch in openUserTimesModal if empty.
}

function renderJobPickerList() {
    const listEl = document.getElementById("userTimesJobPickerList");
    const searchEl = document.getElementById("userTimesJobSearch");
    if (!listEl) return;

    const term = (searchEl?.value || "").trim().toLowerCase();
    const jobs = userTimesJobCache.filter(j =>
        !term || (j.job_name || "").toLowerCase().includes(term)
    );

    if (!jobs.length) {
        listEl.innerHTML = `<div class="userTimesJobPickerEmpty">${
            userTimesJobCache.length ? "No matching jobs." : "No jobs available."
        }</div>`;
        return;
    }

    listEl.innerHTML = jobs.map(job => {
        const isActive = userTimesJobScope === "pick"
            && String(userTimesPickedJobId) === String(job.id);
        const client = job.client_name ? ` · ${job.client_name}` : "";
        return `
            <button class="userTimesJobPickerItem ${isActive ? 'is-active' : ''}"
                    data-job-id="${job.id}">
                <span class="userTimesJobPickerItemName">${escapeHtml(job.job_name || "Untitled")}</span>
                <span class="userTimesJobPickerItemMeta">${escapeHtml(client.replace(/^ · /, "")) || ""}</span>
            </button>
        `;
    }).join("");

    listEl.querySelectorAll(".userTimesJobPickerItem").forEach(btn => {
        btn.addEventListener("click", () => {
            userTimesPickedJobId = btn.dataset.jobId;
            userTimesJobScope = "pick";
            updateJobTabsUI();
            closeJobPicker();
            fetchAndRenderUserTimes();
        });
    });
}

function openJobPicker() {
    const picker = document.getElementById("userTimesJobPicker");
    if (!picker) return;
    refreshJobCache();
    picker.classList.add("active");
    const searchEl = document.getElementById("userTimesJobSearch");
    if (searchEl) searchEl.value = "";
    renderJobPickerList();
    setTimeout(() => searchEl?.focus(), 50);
}

function closeJobPicker() {
    const picker = document.getElementById("userTimesJobPicker");
    if (picker) picker.classList.remove("active");
}

function updateJobTabsUI() {
    const currentTab = document.querySelector('#userTimesJobTabs .userTimesJobTab[data-job-scope="current"]');
    const allTab     = document.querySelector('#userTimesJobTabs .userTimesJobTab[data-job-scope="all"]');
    const pickTab    = document.getElementById("userTimesJobPickTab");

    // Show "This job" only when a job is open.
    if (currentTab) {
        currentTab.style.display = currentJob ? "" : "none";
    }

    [currentTab, allTab, pickTab].forEach(t => t && t.classList.remove("active", "is-picked"));

    if (userTimesJobScope === "current") {
        currentTab?.classList.add("active");
        if (pickTab) pickTab.innerHTML = `<i class="fa-solid fa-list"></i> Choose job…`;
    } else if (userTimesJobScope === "all") {
        allTab?.classList.add("active");
        if (pickTab) pickTab.innerHTML = `<i class="fa-solid fa-list"></i> Choose job…`;
    } else if (userTimesJobScope === "pick") {
        const j = findJobById(userTimesPickedJobId);
        const label = j ? (j.job_name || "Selected job") : "Selected job";
        if (pickTab) {
            pickTab.classList.add("is-picked");
            pickTab.innerHTML = `<i class="fa-solid fa-check"></i> <span>${escapeHtml(label)}</span>`;
        }
    }
}

// --- Data fetching --------------------------------------------------------

async function fetchAndRenderUserTimes() {
    if (!currentUser) return;

    const listEl = document.getElementById("userTimesList");
    const paginationEl = document.getElementById("userTimesPagination");
    listEl.innerHTML = '<p class="emptyState">Loading...</p>';
    paginationEl.innerHTML = "";

    // Build the query
    let query = db.from("time_logs")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("clocked_in_at", { ascending: false });

        if (userTimesJobScope === "current") {
            // If there's no current job (sidebar launch when no job was open),
            // gracefully fall through to "all jobs" instead of returning.
            if (!currentJob) {
                // No job open — treat as all jobs.
            } else {
                query = query.eq("job_id", currentJob.id);
            }
        } else if (userTimesJobScope === "pick") {
        if (!userTimesPickedJobId) return;
        query = query.eq("job_id", userTimesPickedJobId);
    }
    // 'all' → no job_id filter

    const { data, error } = await query;

    if (error) {
        listEl.innerHTML = '<p class="emptyState">Failed to load your times.</p>';
        return;
    }

    userTimesRawLogs = data || [];
    applyUserTimesRange();
}

// --- Filtering + rendering ------------------------------------------------

function applyUserTimesRange() {
    const now = Date.now();
    const windowMs = rangeToMs(userTimesRange);

    if (windowMs === null) {
        userTimesFilteredLogs = [...userTimesRawLogs];
    } else {
        const cutoff = now - windowMs;
        userTimesFilteredLogs = userTimesRawLogs.filter(log => {
            if (!log.clocked_in_at) return false;
            return new Date(log.clocked_in_at).getTime() >= cutoff;
        });
    }

    userTimesPage = 1;
    renderUserTimesModal();
}

function renderUserTimesModal() {
    const listEl = document.getElementById("userTimesList");
    const paginationEl = document.getElementById("userTimesPagination");
    const totalWorkEl = document.getElementById("userTimesTotalWork");
    const totalTravelEl = document.getElementById("userTimesTotalTravel");
    const subtitleEl = document.getElementById("userTimesSubtitle");

    // Subtitle: user + scope + (implicit date range in tabs)
    subtitleEl.innerHTML =
        `Logs for <b>${escapeHtml(displayNameForUser())}</b> · <b>${escapeHtml(scopeLabel())}</b>`;

    // Totals over the filtered set
    let workSec = 0;
    let travelSec = 0;
    userTimesFilteredLogs.forEach(log => {
        const sec = computeDurationSeconds(log);
        if (log.is_travel) travelSec += sec;
        else workSec += sec;
    });
    totalWorkEl.textContent = formatDuration(workSec);
    totalTravelEl.textContent = formatDuration(travelSec);

    if (!userTimesFilteredLogs.length) {
        const emptyMsg = userTimesRange === "all"
            ? "No logs in this scope."
            : "No logs in this date range.";
        listEl.innerHTML = `<p class="emptyState">${emptyMsg}</p>`;
        paginationEl.innerHTML = "";
        return;
    }

    const totalPages = Math.ceil(userTimesFilteredLogs.length / userTimesPerPage);
    if (userTimesPage > totalPages) userTimesPage = totalPages;
    if (userTimesPage < 1) userTimesPage = 1;

    const start = (userTimesPage - 1) * userTimesPerPage;
    const pageLogs = userTimesFilteredLogs.slice(start, start + userTimesPerPage);

    const jobNameMap = buildJobNameMap();
    const showJobName = userTimesJobScope !== "current";

    listEl.innerHTML = pageLogs.map(log => buildUserTimeRow(log, jobNameMap, showJobName)).join("");

    if (totalPages > 1) {
        paginationEl.innerHTML = `
            <div class="pagination-controls">
                <button class="pagination-btn" id="userTimesPrevBtn" ${userTimesPage === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <span class="page-indicator">Page ${userTimesPage} of ${totalPages}</span>
                <button class="pagination-btn" id="userTimesNextBtn" ${userTimesPage === totalPages ? 'disabled' : ''}>
                    Next <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
        document.getElementById("userTimesPrevBtn")?.addEventListener("click", () => {
            if (userTimesPage > 1) { userTimesPage--; renderUserTimesModal(); }
        });
        document.getElementById("userTimesNextBtn")?.addEventListener("click", () => {
            if (userTimesPage < totalPages) { userTimesPage++; renderUserTimesModal(); }
        });
    } else {
        paginationEl.innerHTML = "";
    }

    // Wire edit buttons inside the modal
    listEl.querySelectorAll('.timelog-editBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTimeLogEditModal(btn.dataset.logId);
        });
    });
}

function buildUserTimeRow(log, jobNameMap, showJobName) {
    const inTime = new Date(log.clocked_in_at);
    const outTime = log.clocked_out_at ? new Date(log.clocked_out_at) : null;
    const active = !log.clocked_out_at;

    const dateStr = inTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const inStr   = inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const outStr  = outTime ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

    const duration = computeDurationSeconds(log);
    const durStr = formatDuration(duration);

    const typeClass = log.is_travel ? 'travel' : 'work';
    const typeIcon  = log.is_travel ? 'fa-car' : 'fa-clock';
    const typeLabel = log.is_travel ? 'Travel' : 'Work';

    const jobName = showJobName
        ? (jobNameMap[String(log.job_id)] || "Unknown job")
        : null;

    return `
        <div class="timelog-row" data-log-id="${log.id}">
            <div class="timelog-row top">
                <div class="timelog-typeBadge ${typeClass}" title="${typeLabel}">
                    <i class="fa-solid ${typeIcon}"></i>
                </div>
                <div class="timelog-headline">
                    <span class="timelog-user">${escapeHtml(typeLabel)}</span>
                    <span class="timelog-date">${escapeHtml(dateStr)}</span>
                    ${jobName ? `<span class="timelog-jobname"><i class="fa-solid fa-briefcase"></i>${escapeHtml(jobName)}</span>` : ""}
                </div>
                <span class="timelog-durationPill ${active ? 'live' : ''}">${active ? '● ' : ''}${durStr}</span>
            </div>
            <div class="timelog-times">
                <span class="timelog-time"><i class="fa-solid fa-arrow-right-to-bracket"></i>${escapeHtml(inStr)}</span>
                <i class="fa-solid fa-arrow-right timelog-arrow"></i>
                <span class="timelog-time ${active ? 'active' : ''}">
                    <i class="fa-solid ${active ? 'fa-spinner fa-pulse' : 'fa-arrow-right-from-bracket'}"></i>
                    ${outStr ? escapeHtml(outStr) : 'Active'}
                </span>
            </div>
            <div class="timelog-actions">
                <button class="timelog-editBtn" data-log-id="${log.id}">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
            </div>
        </div>
    `;
}

// --- Modal open/close -----------------------------------------------------

async function openUserTimesModal(opts) {
    if (!currentUser) return;
    opts = opts || {};

    // Determine the default scope:
    //   - Inside a job (called from the detail panel) → "This job"
    //   - From the sidebar (no job open) → "All jobs"
    const hasJob = !!currentJob;
    const defaultScope = opts.defaultScope || (hasJob ? "current" : "all");

    // Preload the job list for the picker (localStorage cache first).
    userTimesJobCache = getCachedAllJobs();
    if (!userTimesJobCache.length) {
        // Nothing cached — fetch once. Won't block the UI too long.
        try {
            const { data } = await db.from("Jobs").select("id, job_name, client_name").order("created_at", { ascending: false });
            userTimesJobCache = data || [];
        } catch (e) { userTimesJobCache = []; }
    }

    // Reset state
    userTimesRange = "all";
    userTimesJobScope = defaultScope;
    userTimesPickedJobId = null;
    userTimesPage = 1;

    document.querySelectorAll("#userTimesRangeTabs .userTimesRangeTab").forEach(t => {
        t.classList.toggle("active", t.dataset.range === "all");
    });
    updateJobTabsUI();
    closeJobPicker();

    document.getElementById("userTimesModal").classList.add("active");

    await fetchAndRenderUserTimes();
}

function closeUserTimesModal() {
    const modal = document.getElementById("userTimesModal");
    if (modal) modal.classList.remove("active");
    closeJobPicker();
}

// --- Wiring ---------------------------------------------------------------

// "View My Times" button inside the job detail panel → default to this job
document.getElementById("openUserTimesBtn")?.addEventListener("click", () => {
    openUserTimesModal({ defaultScope: "current" });
});

// Sidebar "My Times" button → default to all jobs (or this job if one is open)
document.getElementById("sidebarUserTimesBtn")?.addEventListener("click", () => {
    closeNav();
    openUserTimesModal({ defaultScope: currentJob ? "current" : "all" });
});

document.getElementById("userTimesClose")?.addEventListener("click", closeUserTimesModal);
document.getElementById("userTimesModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("userTimesModal")) closeUserTimesModal();
});

// Job scope tabs
document.querySelectorAll("#userTimesJobTabs .userTimesJobTab").forEach(btn => {
    btn.addEventListener("click", () => {
        const scope = btn.dataset.jobScope;
        if (scope === "pick") {
            // Tapping "Choose job…" opens the picker. If already picking,
            // it toggles the picker closed.
            if (userTimesJobScope === "pick") {
                closeJobPicker();
                return;
            }
            openJobPicker();
            return;
        }
        // 'current' or 'all'
        userTimesJobScope = scope;
        userTimesPickedJobId = null;
        updateJobTabsUI();
        closeJobPicker();
        fetchAndRenderUserTimes();
    });
});

// Job picker — close button
document.getElementById("userTimesJobPickerClose")?.addEventListener("click", closeJobPicker);

// Job picker — live search
document.getElementById("userTimesJobSearch")?.addEventListener("input", renderJobPickerList);

// Date range tabs
document.querySelectorAll("#userTimesRangeTabs .userTimesRangeTab").forEach(btn => {
    btn.addEventListener("click", () => {
        userTimesRange = btn.dataset.range;
        document.querySelectorAll("#userTimesRangeTabs .userTimesRangeTab").forEach(b => {
            b.classList.toggle("active", b === btn);
        });
        applyUserTimesRange();
    });
});

// ==================== SERVICE WORKER & UPDATES ====================
// Deterministic update system. See build.js / sw.js / update-check.js.

window.__jobtrackNavigating = false;

function showUpdateBanner() {
    const banner = document.getElementById('appBanner');
    if (banner) banner.style.display = 'block';
}
window.showUpdateBanner = showUpdateBanner;

async function forceUpdate() {
    if (window.__jobtrackNavigating) return;
    window.__jobtrackNavigating = true;

    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(async (reg) => {
                try { await reg.update(); } catch (e) { /* offline is fine */ }

                if (reg.waiting) {
                    try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                }
                if (reg.installing) {
                    reg.installing.addEventListener('statechange', function onState() {
                        if (reg.installing && reg.installing.state === 'installed' && navigator.serviceWorker.controller) {
                            try { reg.installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                        }
                    });
                }
            }));
        }

        const url = new URL(window.location.href);
        url.searchParams.set('_v', String(Date.now()));
        window.location.replace(url.toString());
    } catch (err) {
        console.error('[forceUpdate] failed, falling back to reload:', err);
        window.__jobtrackNavigating = false;
        window.location.reload();
    }
}

document.getElementById('manual-update-btn')
    ?.addEventListener('click', forceUpdate);
window.addEventListener('jobtrack:force-update', forceUpdate);


async function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('SW registered');

        registration.update().catch(() => {});

        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
            const nw = registration.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                    nw.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            if (window.__jobtrackNavigating) return;
            window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'UPDATE_AVAILABLE') {
                showUpdateBanner();
            }
        });
    } catch (err) {
        console.error('SW registration failed:', err);
    }
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSW);
} else {
    registerSW();
}