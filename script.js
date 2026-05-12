// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qbZRx_7dX4dg8niBS0TedA_grY5M0su";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === EMAILJS INIT ===
emailjs.init("ASqDA9Nflas4yZppr");  // REPLACE WITH YOUR PUBLIC KEY

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
let activeWorkSession = null;   // active work log (clocked in, is_travel=false)
let activeTravelLog   = null;   // active travel log (is_travel=true, clocked_out_at=null)
let capturedPhotos    = [];
let currentSearchTerm = "";
let groupCollapsedState = { active: false, upcoming: false, completed: false };
let newJobStock = [];
let editJobStock = [];
let detailStockArray = [];

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
    card.innerHTML = `<div class="jobCardHeader"><p class="jobName">${escapeHtml(job.job_name)}</p><span class="statusBadge" style="background:${bg};color:${color}">${status}</span></div><p class="jobSub">${escapeHtml(job.client_name||'No client')} · ${job.start_date||'No date'}</p>`;
    card.onclick = () => openJobDetail(job.id);
    return card;
}

// === TRAVEL & CLOCK LOGIC (with persistence) ===
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
            // Stop travel
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
            // Start travel – ensure no active work session
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
    // If travel is active, stop it first (auto travel off)
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

    // Load active sessions from DB
    activeTravelLog = await fetchActiveTravelLog(jobId);
    activeWorkSession = await fetchActiveWorkSession(jobId);
    await updateTravelUI();
    updateClockUI();
    loadTimeLogs(jobId);

    // Reset photos
    capturedPhotos = [];
    renderPhotoGrid();
}
function closeJobDetail() {
    jobDetail.classList.remove("active");
    currentJob = null;
    activeWorkSession = null;
    activeTravelLog = null;
}
jobDetailBack.onclick = closeJobDetail;

function populateDetailView(job) {
    const status = getJobStatus(job);
    const { bg, color } = status === 'active' ? { bg: "#fef3c7", color: "#d97706" } : status === 'upcoming' ? { bg: "#dbeafe", color: "#2563eb" } : { bg: "#dcfce7", color: "#16a34a" };
    document.getElementById("jobDetailTitle").textContent = job.job_name;
    document.getElementById("detailJobName").textContent = job.job_name || "—";
    document.getElementById("detailPhone").textContent = job.phone || "—";
    document.getElementById("detailAddress").textContent = job.address || "—";
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
    timeLogsContainer.innerHTML = '<p class="emptyState">Loading...</p>';
    const { data, error } = await db.from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("clocked_in_at", { ascending: false });
    if (error || !data || !data.length) {
        timeLogsContainer.innerHTML = '<p class="emptyState">No time records yet.</p>';
        return;
    }
    timeLogsContainer.innerHTML = data.map(log => {
        const inTime = new Date(log.clocked_in_at);
        const outTime = log.clocked_out_at ? new Date(log.clocked_out_at) : null;
        const prefix = log.is_travel ? "🚗 Travel - " : "";
        let duration = log.duration_seconds;
        if (!outTime && !log.clocked_out_at && log.is_travel && activeTravelLog && activeTravelLog.id === log.id) {
            // currently active travel – compute live duration
            duration = Math.floor((new Date() - inTime) / 1000);
        }
        return `<div class="timeLogRow">
            <div><b>${prefix}${escapeHtml(log.user_name)}</b><br><small>${inTime.toLocaleDateString()}</small></div>
            <div>${inTime.toLocaleTimeString()} → ${outTime ? outTime.toLocaleTimeString() : "—"}</div>
            <div>${formatDuration(duration)}</div>
        </div>`;
    }).join('');
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

    // Clock out if work session active
    if (activeWorkSession) {
        await handleClockOut();
    }
    // Stop travel if active
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

    // Fetch latest time logs for email
    const { data: logs } = await db.from("time_logs")
        .select("*")
        .eq("job_id", currentJob.id)
        .order("clocked_in_at", { ascending: true });
    const totalSeconds = logs?.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) || 0;
    const totalHours = (totalSeconds / 3600).toFixed(2);

    // Build email HTML table
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
        // *** REPLACE WITH YOUR EMAILJS SERVICE & TEMPLATE IDs ***
        const response = await emailjs.send(
            "service_nlma6da",      // your service ID
            "template_y2ineka",     // your template ID
            templateParams
        );
        if (response.status === 200) {
            // Email sent – now mark job as completed
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

// === PHOTOS (send via email client) ===
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
sendPhotosEmailBtn.addEventListener("click", () => {
    if (!capturedPhotos.length) return;
    const subject = `${currentJob.client_name || 'Job'} - ${currentJob.address || 'No address'}`;
    const body = `Job: ${currentJob.job_name}\nClient: ${currentJob.client_name}\nAddress: ${currentJob.address}\n\nPhotos attached as data URLs (copy to view):\n${capturedPhotos.join('\n\n')}`;
    window.location.href = `mailto:ashleywork02@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    alert("Your email client will open. Please send the email manually.");
});