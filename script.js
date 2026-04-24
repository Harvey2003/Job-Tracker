// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qbZRx_7dX4dg8niBS0TedA_grY5M0su";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === EMAILJS INIT ===
emailjs.init("YOUR_PUBLIC_KEY");   // Replace with your actual public key

// === SERVICE WORKER ===
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/Job-Tracker/service-worker.js")
        .then(() => console.log("SW registered"))
        .catch((err) => console.log("SW failed:", err));
}

// === FULLSCREEN (PWA only) ===
if (window.matchMedia("(display-mode: standalone)").matches) {
    document.addEventListener("click", function triggerFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        document.removeEventListener("click", triggerFullscreen);
    }, { once: true });
}

// === ELEMENTS ===
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
const createJobSection    = document.getElementById("createJobSection");
const jobsSection         = document.getElementById("jobsSection");
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

// === STATE ===
let currentJob        = null;
let currentUser       = null;
let activeSession     = null;
let currentSearchTerm = "";
let groupCollapsedState = {
    active: false,
    upcoming: false,
    completed: false
};

// === LOCAL STORAGE HELPERS ===
function cacheJob(job) {
    try {
        localStorage.setItem(`job_${job.id}`, JSON.stringify(job));
    } catch(e) {
        console.warn("localStorage write failed:", e);
    }
}

function getCachedJob(jobId) {
    try {
        const cached = localStorage.getItem(`job_${jobId}`);
        return cached ? JSON.parse(cached) : null;
    } catch(e) {
        return null;
    }
}

function cacheAllJobs(jobs) {
    try {
        jobs.forEach(job => cacheJob(job));
        localStorage.setItem("all_job_ids", JSON.stringify(jobs.map(j => j.id)));
    } catch(e) {
        console.warn("localStorage write failed:", e);
    }
}

function getCachedAllJobs() {
    try {
        const ids = JSON.parse(localStorage.getItem("all_job_ids") || "[]");
        return ids.map(id => getCachedJob(id)).filter(Boolean);
    } catch(e) {
        return [];
    }
}

// === AUTH ===
db.auth.onAuthStateChange((event, session) => {
    if (session) {
        showApp(session.user);
    } else {
        showLogin();
    }
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

// === LOGIN ===
loginButton.addEventListener("click", async () => {
    const email    = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    loginError.textContent = "";

    if (!email || !password) {
        loginError.textContent = "Please enter your email and password.";
        return;
    }

    loginButton.textContent = "Signing in...";
    loginButton.disabled = true;

    const { error } = await db.auth.signInWithPassword({ email, password });

    loginButton.disabled = false;
    loginButton.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In';

    if (error) {
        loginError.textContent = "Incorrect email or password.";
    }
});

loginPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginButton.click();
});

// === LOGOUT ===
logoutButton.addEventListener("click", async () => {
    await db.auth.signOut();
    currentUser  = null;
    currentJob   = null;
    activeSession = null;
    closeNav();
});

// === NAV ===
function closeNav() {
    navBar.classList.remove("open");
    navOverlay.classList.remove("active");
}

openCloseNav.addEventListener("click", () => {
    navBar.classList.toggle("open");
    navOverlay.classList.toggle("active");
});

navOverlay.addEventListener("click", closeNav);

jobsSection.addEventListener("click", () => {
    closeNav();
    closeJobDetail();
});

createJobSection.addEventListener("click", () => {
    closeNav();
    openForm();
});

// === FORM ===
function openForm() {
    newJobForm.classList.add("active");
}

function closeForm() {
    newJobForm.classList.remove("active");
}

addJob.addEventListener("click", openForm);
formClose.addEventListener("click", closeForm);

newJobForm.addEventListener("click", (e) => {
    if (e.target === newJobForm) closeForm();
});

// === KEYBOARD SCROLL FIX ===
document.querySelectorAll(".newJobInput, #inputFault").forEach(input => {
    input.addEventListener("focus", () => {
        setTimeout(() => {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
    });
});

// === SEARCH ===
searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    clearSearchButton.style.display = currentSearchTerm ? "flex" : "none";
    const jobs = getCachedAllJobs();
    if (jobs.length > 0) {
        renderJobList(jobs);
    } else {
        loadJobs();
    }
});

// Clear search
clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    currentSearchTerm = "";
    clearSearchButton.style.display = "none";
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    searchInput.focus();
});

// Dismiss keyboard on Enter
searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        searchInput.blur();
    }
});

// === JOB STATUS HELPER ===
function getJobStatus(job) {
    if (job.status === "completed") return "completed";
    if (job.start_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(job.start_date);
        start.setHours(0, 0, 0, 0);
        if (start > today) return "upcoming";
    }
    return "active";
}

function getStatusStyle(status) {
    switch (status) {
        case "active":    return { bg: "#fef3c7", color: "#d97706" };
        case "upcoming":  return { bg: "#dbeafe", color: "#2563eb" };
        case "completed": return { bg: "#dcfce7", color: "#16a34a" };
        default:          return { bg: "#f3f4f6", color: "#6b7280" };
    }
}

// === LOAD JOBS ===
async function loadJobs() {
    jobCardsContainer.innerHTML = `<p class="emptyState">Loading jobs...</p>`;

    const { data: jobs, error } = await db
        .from("Jobs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error || !jobs) {
        const cachedJobs = getCachedAllJobs();
        if (cachedJobs.length > 0) {
            renderJobList(cachedJobs);
            jobCardsContainer.insertAdjacentHTML("afterbegin", `
                <p class="emptyState" style="color:#f59e0b; margin-bottom:2vw;">
                    <i class="fa-solid fa-wifi-slash"></i> Offline — showing cached data
                </p>
            `);
        } else {
            jobCardsContainer.innerHTML = `<p class="emptyState" style="color:#f87171;">Failed to load jobs.</p>`;
        }
        return;
    }

    cacheAllJobs(jobs);
    renderJobList(jobs);
}

// === RENDER JOB LIST (with collapsible groups) ===
function renderJobList(jobs) {
    const filtered = jobs.filter(job => {
        if (!currentSearchTerm) return true;
        const name = (job.job_name || "").toLowerCase();
        const address = (job.address || "").toLowerCase();
        const client = (job.client_name || "").toLowerCase();
        return name.includes(currentSearchTerm) || address.includes(currentSearchTerm) || client.includes(currentSearchTerm);
    });

    const groups = {
        active: [],
        upcoming: [],
        completed: []
    };

    filtered.forEach(job => {
        const status = getJobStatus(job);
        if (status === "active") groups.active.push(job);
        else if (status === "upcoming") groups.upcoming.push(job);
        else if (status === "completed") groups.completed.push(job);
    });

    jobCardsContainer.innerHTML = "";

    const buildGroup = (title, jobsArray, icon, groupKey) => {
        if (jobsArray.length === 0) return;

        const header = document.createElement("div");
        header.className = "statusGroupHeader";
        header.dataset.group = groupKey;
        if (groupCollapsedState[groupKey]) header.classList.add("collapsed");

        header.innerHTML = `
            <span class="statusGroupTitle">
                <i class="fa-solid ${icon}" style="margin-right: 8px; font-size:0.85rem;"></i>${title}
                <span class="statusGroupCount">${jobsArray.length}</span>
            </span>
            <i class="fa-solid fa-chevron-down groupChevron"></i>
        `;

        header.addEventListener("click", (e) => {
            e.stopPropagation();
            const isCollapsed = header.classList.toggle("collapsed");
            groupCollapsedState[groupKey] = isCollapsed;

            // Find all job cards belonging to this group and toggle visibility
            let next = header.nextElementSibling;
            while (next && !next.classList.contains("statusGroupHeader")) {
                if (next.classList.contains("jobCard")) {
                    next.classList.toggle("group-collapsed", isCollapsed);
                }
                next = next.nextElementSibling;
            }
        });

        jobCardsContainer.appendChild(header);

        jobsArray.forEach(job => {
            const card = buildJobCard(job);
            if (groupCollapsedState[groupKey]) card.classList.add("group-collapsed");
            jobCardsContainer.appendChild(card);
        });
    };

    buildGroup("Active", groups.active, "fa-play", "active");
    buildGroup("Upcoming", groups.upcoming, "fa-calendar", "upcoming");
    buildGroup("Completed", groups.completed, "fa-check-circle", "completed");

    if (filtered.length === 0) {
        jobCardsContainer.innerHTML = `<p class="emptyState">No jobs match your search.</p>`;
    }
}

// === BUILD JOB CARD ===
function buildJobCard(job) {
    const card = document.createElement("div");
    card.classList.add("jobCard");
    card.dataset.id = job.id;

    const status = getJobStatus(job);
    const { bg, color } = getStatusStyle(status);

    card.innerHTML = `
        <div class="jobCardHeader">
            <p class="jobName">${job.job_name}</p>
            <span class="statusBadge" style="background-color:${bg}; color:${color};">
                ${capitalise(status)}
            </span>
        </div>
        <p class="jobSub">${job.client_name || "No client"} · ${job.start_date || "No date"}</p>
    `;

    card.addEventListener("click", () => openJobDetail(job.id));
    return card;
}

function refreshJobListFromCache() {
    const jobs = getCachedAllJobs();
    if (jobs.length > 0) renderJobList(jobs);
}

// === CREATE JOB ===
newJobButton.addEventListener("click", async () => {
    const jobName    = document.getElementById("inputJobName").value.trim();
    const faultDescription = document.getElementById("inputFault").value.trim();
    const clientName = document.getElementById("inputClientName").value.trim();
    const address    = document.getElementById("inputAddress").value.trim();
    const phone      = document.getElementById("inputPhone").value.trim();
    const startDate  = document.getElementById("startDate").value;
    const stock      = document.getElementById("inputStock").value.trim();

    if (!jobName) {
        alert("Please enter a job name.");
        return;
    }

    newJobButton.textContent = "Saving...";
    newJobButton.disabled = true;

    const { data, error } = await db
        .from("Jobs")
        .insert([{
            job_name:    jobName,
            address:     address,
            client_name: clientName,
            start_date:  startDate || null,
            stock:       stock,
            fault_desc:  faultDescription,
            status:      "active",
            phone:       phone
        }])
        .select()
        .single();

    newJobButton.disabled = false;
    newJobButton.innerHTML = '<i class="fa-solid fa-check"></i> Create Job';

    if (error) {
        alert("Failed to save job. Please try again.");
        return;
    }

    const currentJobs = getCachedAllJobs();
    currentJobs.unshift(data);
    cacheAllJobs(currentJobs);
    renderJobList(currentJobs);

    document.getElementById("inputJobName").value    = "";
    document.getElementById("inputAddress").value    = "";
    document.getElementById("inputClientName").value = "";
    document.getElementById("startDate").value       = "";
    document.getElementById("inputStock").value      = "";
    document.getElementById("inputFault").value      = "";
    document.getElementById("inputPhone").value      = "";

    closeForm();
});

// === CHECK ACTIVE SESSION ===
async function checkActiveSession(jobId) {
    const { data, error } = await db
        .from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", currentUser.id)
        .is("clocked_out_at", null)
        .order("clocked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("checkActiveSession error:", error);
        return null;
    }
    return data;
}

// === OPEN JOB DETAIL ===
async function openJobDetail(jobId) {
    jobDetail.classList.add("active");
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';

    const cachedJob = getCachedJob(jobId);
    if (cachedJob) {
        currentJob = cachedJob;
        populateDetailView(cachedJob);
    } else {
        timeLogsContainer.innerHTML = `<p class="emptyState" style="font-size:0.78rem;">Loading...</p>`;
    }

    const { data: freshJob, error: jobError } = await db
        .from("Jobs")
        .select("*")
        .eq("id", jobId)
        .single();

    if (jobError || !freshJob) {
        if (!currentJob) {
            alert("Failed to load job details.");
            closeJobDetail();
        }
        return;
    }

    currentJob = freshJob;
    cacheJob(freshJob);
    populateDetailView(freshJob);

    const card = jobCardsContainer.querySelector(`[data-id="${freshJob.id}"]`);
    if (card) {
        const newCard = buildJobCard(freshJob);
        jobCardsContainer.replaceChild(newCard, card);
    }

    activeSession = await checkActiveSession(jobId);
    updateClockUI(activeSession);
    loadTimeLogs(jobId);
}

function closeJobDetail() {
    jobDetail.classList.remove("active");
}

jobDetailBack.addEventListener("click", closeJobDetail);

// === POPULATE DETAIL VIEW ===
function populateDetailView(job) {
    const status = getJobStatus(job);
    const { bg, color } = getStatusStyle(status);
    const isCompleted = job.status === "completed";

    document.getElementById("jobDetailTitle").textContent   = job.job_name;
    document.getElementById("detailJobName").textContent    = job.job_name    || "—";
    document.getElementById("detailPhone").textContent      = job.phone       || "—";
    document.getElementById("detailAddress").textContent    = job.address     || "—";
    document.getElementById("detailClientName").textContent = job.client_name || "—";
    document.getElementById("detailStartDate").textContent  = job.start_date  || "—";
    document.getElementById("detailStock").textContent      = job.stock       || "—";
    document.getElementById("detailFault").textContent      = job.fault_desc  || "—";
    document.getElementById("detailStatus").innerHTML       = `
        <span class="statusBadge" style="background-color:${bg}; color:${color};">
            ${capitalise(status)}
        </span>
    `;

    completeJobButton.style.display   = isCompleted ? "none"  : "flex";
    uncompleteJobButton.style.display = isCompleted ? "flex"  : "none";
    document.getElementById("clockSection").style.display = isCompleted ? "none" : "flex";
}

// === CLOCK UI ===
function updateClockUI(session) {
    const totalSeconds = currentJob?.total_time_seconds || 0;

    if (session && session.clocked_in_at) {
        clockButton.classList.add("clockedIn");
        clockButtonText.textContent = "Clock Out";
        clockStatus.textContent = `Clocked in at ${formatTime(new Date(session.clocked_in_at))}`;
    } else {
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";
        clockStatus.textContent = "Not clocked in";
    }

    totalTimeDisplay.textContent = totalSeconds > 0
        ? `Total time on job: ${formatDuration(totalSeconds)}`
        : "";
}

// === CLOCK BUTTON ===
clockButton.addEventListener("click", async () => {
    if (!currentJob) return;
    clockButton.disabled = true;

    if (activeSession) {
        await handleClockOut();
    } else {
        await handleClockIn();
    }

    clockButton.disabled = false;
});

async function handleClockIn() {
    const now         = new Date().toISOString();
    const displayName = currentUser?.user_metadata?.display_name
        || currentUser?.email?.split("@")[0]
        || "Unknown";

    const { data, error } = await db
        .from("time_logs")
        .insert([{
            job_id:           currentJob.id,
            user_id:          currentUser.id,
            user_name:        displayName,
            clocked_in_at:    now,
            clocked_out_at:   null,
            duration_seconds: 0
        }])
        .select()
        .single();

    if (error || !data) {
        alert("Clock in failed: " + (error?.message || "no data returned"));
        clockButton.disabled = false;
        return;
    }

    activeSession = data;
    updateClockUI(activeSession);
}

async function handleClockOut() {
    const now            = new Date().toISOString();
    const clockInTime    = new Date(activeSession.clocked_in_at);
    const sessionSeconds = Math.floor((new Date(now) - clockInTime) / 1000);
    const newTotal       = (currentJob.total_time_seconds || 0) + sessionSeconds;

    const { error: logError } = await db
        .from("time_logs")
        .update({
            clocked_out_at:   now,
            duration_seconds: sessionSeconds
        })
        .eq("id", activeSession.id);

    if (logError) {
        console.error("Clock out log update failed:", logError);
        clockButton.disabled = false;
        return;
    }

    const { data: updatedJob, error: jobError } = await db
        .from("Jobs")
        .update({ total_time_seconds: newTotal })
        .eq("id", currentJob.id)
        .select()
        .single();

    if (!jobError && updatedJob) {
        currentJob = updatedJob;
        cacheJob(updatedJob);
        const card = jobCardsContainer.querySelector(`[data-id="${updatedJob.id}"]`);
        if (card) jobCardsContainer.replaceChild(buildJobCard(updatedJob), card);
    } else {
        currentJob = { ...currentJob, total_time_seconds: newTotal };
        cacheJob(currentJob);
    }

    activeSession = null;
    updateClockUI(null);
    loadTimeLogs(currentJob.id);
}

async function handleClockOutForComplete() {
    const now            = new Date().toISOString();
    const clockInTime    = new Date(activeSession.clocked_in_at);
    const sessionSeconds = Math.floor((new Date(now) - clockInTime) / 1000);
    const newTotal       = (currentJob.total_time_seconds || 0) + sessionSeconds;

    await db.from("time_logs").update({
        clocked_out_at:   now,
        duration_seconds: sessionSeconds
    }).eq("id", activeSession.id);

    await db.from("Jobs").update({ total_time_seconds: newTotal }).eq("id", currentJob.id);
    currentJob    = { ...currentJob, total_time_seconds: newTotal };
    activeSession = null;
}

// === LOAD TIME LOGS ===
async function loadTimeLogs(jobId) {
    timeLogsContainer.innerHTML = `<p class="emptyState" style="font-size:0.78rem;">Loading sessions...</p>`;

    const { data: logs, error } = await db
        .from("time_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("clocked_in_at", { ascending: false });

    if (error || !logs || logs.length === 0) {
        timeLogsContainer.innerHTML = `<p class="emptyState" style="font-size:0.78rem;">No sessions logged yet.</p>`;
        return;
    }

    timeLogsContainer.innerHTML = "";
    logs.forEach(log => {
        const inTime  = new Date(log.clocked_in_at);
        const outTime = log.clocked_out_at ? new Date(log.clocked_out_at) : null;
        const name    = log.user_name || "Unknown";

        const row = document.createElement("div");
        row.classList.add("timeLogRow");
        row.innerHTML = `
            <div class="timeLogLeft">
                <div class="timeLogName">${name}</div>
                <div class="timeLogDate">${formatDate(inTime)}</div>
            </div>
            <div class="timeLogTimes">
                <span><i class="fa-solid fa-arrow-right-to-bracket"></i> ${formatTime(inTime)}</span>
                <span><i class="fa-solid fa-arrow-right-from-bracket"></i> ${outTime ? formatTime(outTime) : "—"}</span>
            </div>
            <div class="timeLogDuration">${formatDuration(log.duration_seconds || 0)}</div>
        `;
        timeLogsContainer.appendChild(row);
    });
}

// === EDIT TOGGLE ===
jobDetailEditToggle.addEventListener("click", () => {
    const isEditing = jobDetailEdit.style.display === "block";

    if (isEditing) {
        jobDetailView.style.display = "block";
        jobDetailEdit.style.display = "none";
        jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
    } else {
        document.getElementById("editJobName").value    = currentJob.job_name    || "";
        document.getElementById("editAddress").value    = currentJob.address     || "";
        document.getElementById("editClientName").value = currentJob.client_name || "";
        document.getElementById("editStartDate").value  = currentJob.start_date  || "";
        document.getElementById("editStock").value      = currentJob.stock       || "";
        document.getElementById("editFault").value      = currentJob.fault_desc  || "";
        document.getElementById("editPhone").value      = currentJob.phone       || "";

        jobDetailView.style.display = "none";
        jobDetailEdit.style.display = "block";
        jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }
});

// === SAVE EDIT ===
saveEditButton.addEventListener("click", async () => {
    const updates = {
        job_name:    document.getElementById("editJobName").value.trim(),
        address:     document.getElementById("editAddress").value.trim(),
        client_name: document.getElementById("editClientName").value.trim(),
        start_date:  document.getElementById("editStartDate").value || null,
        stock:       document.getElementById("editStock").value.trim(),
        fault_desc:  document.getElementById("editFault").value.trim(),
        phone:       document.getElementById("editPhone").value.trim()
    };

    if (!updates.job_name) {
        alert("Job name cannot be empty.");
        return;
    }

    saveEditButton.textContent = "Saving...";
    saveEditButton.disabled = true;

    const { data, error } = await db
        .from("Jobs")
        .update(updates)
        .eq("id", currentJob.id)
        .select()
        .single();

    saveEditButton.disabled = false;
    saveEditButton.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';

    if (error) {
        alert("Failed to save changes.");
        return;
    }

    currentJob = data;
    cacheJob(data);
    populateDetailView(data);
    updateClockUI(activeSession);

    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
    refreshJobListFromCache();

    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
});

// === COMPLETE JOB (with email) ===
completeJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as complete and send summary email?")) return;

    // If clocked in, clock out first
    if (activeSession) {
        await handleClockOutForComplete();
    }

    // Update job status to 'completed'
    const { data, error } = await db
        .from("Jobs")
        .update({ status: "completed" })
        .eq("id", currentJob.id)
        .select()
        .single();

    if (error) {
        alert("Failed to complete job.");
        return;
    }

    currentJob = data;
    cacheJob(data);
    populateDetailView(data);
    updateClockUI(null);

    // Update the job card in the list
    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
    refreshJobListFromCache();

    // --- SEND EMAIL via EmailJS ---
    try {
        completeJobButton.disabled = true;
        completeJobButton.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Sending email...';

        // Fetch time logs for the table
        const { data: logs } = await db
            .from("time_logs")
            .select("*")
            .eq("job_id", currentJob.id)
            .order("clocked_in_at", { ascending: false });

        const totalSeconds = logs?.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) || 0;
        const totalHours = (totalSeconds / 3600).toFixed(2);

        // Short formatting functions
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-NZ", { day:"numeric", month:"short" }) : "—";
        const fmtTime = (d) => new Date(d).toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" });
        const fmtDur = (s) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };

        // Build the time sessions table as an HTML string
        const tableHtml = logs && logs.length > 0
            ? `<table border="0" cellpadding="8" style="border-collapse:collapse;">
                <thead><tr style="background:#f0f0f0;">
                    <th>User</th><th>Date</th><th>In</th><th>Out</th><th>Duration</th>
                </tr></thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${log.user_name || "—"}</td>
                            <td>${fmtDate(log.clocked_in_at)}</td>
                            <td>${fmtTime(log.clocked_in_at)}</td>
                            <td>${log.clocked_out_at ? fmtTime(log.clocked_out_at) : "—"}</td>
                            <td>${fmtDur(log.duration_seconds || 0)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>`
            : "No time sessions recorded.";

        // Prepare template parameters (must match template placeholders)
        const templateParams = {
            to_email: "ashleywork02@gmail.com",   // recipient email
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

        const response = await emailjs.send(
            "service_nlma6da",    // replace with your Service ID
            "template_y2ineka",   // replace with your Template ID
            templateParams
        );

        if (response.status === 200) {
            alert('✅ Job marked complete and summary email sent.');
        } else {
            throw new Error('EmailJS returned an unexpected status');
        }
    } catch (err) {
        console.error('Email error:', err);
        alert(`⚠️ Job completed, but email failed: ${err.message}`);
    } finally {
        completeJobButton.disabled = false;
        completeJobButton.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Complete Job';
    }
});

// === UNCOMPLETE JOB ===
uncompleteJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as active again?")) return;

    const { data, error } = await db
        .from("Jobs")
        .update({ status: "active" })
        .eq("id", currentJob.id)
        .select()
        .single();

    if (error) {
        alert("Failed to reactivate job.");
        return;
    }

    currentJob = data;
    cacheJob(data);
    populateDetailView(data);
    updateClockUI(activeSession);

    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
    refreshJobListFromCache();
});

// === HELPERS ===
function capitalise(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
    return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}