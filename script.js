// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_qbZRx_7dX4dg8niBS0TedA_grY5M0su";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// === STATE ===
let currentJob  = null;
let currentUser = null;

// === LOCAL STORAGE HELPERS ===
function cacheJob(job) {
    try {
        localStorage.setItem(`job_${job.id}`, JSON.stringify(job));
        console.log(`[cache] Saved job_${job.id} | clocked_in_at: ${job.clocked_in_at} | clocked_out_at: ${job.clocked_out_at}`);
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
    currentUser = null;
    currentJob  = null;
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
document.querySelectorAll(".newJobInput, #notesInput").forEach(input => {
    input.addEventListener("focus", () => {
        setTimeout(() => {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
    });
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
            jobCardsContainer.innerHTML = "";
            cachedJobs.forEach(job => jobCardsContainer.appendChild(buildJobCard(job)));
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
    jobCardsContainer.innerHTML = "";

    if (jobs.length === 0) {
        jobCardsContainer.innerHTML = `<p class="emptyState">No jobs yet. Tap above to create one.</p>`;
        return;
    }

    jobs.forEach(job => jobCardsContainer.appendChild(buildJobCard(job)));
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

// === CREATE JOB ===
newJobButton.addEventListener("click", async () => {
    const jobName    = document.getElementById("inputJobName").value.trim();
    const address    = document.getElementById("inputAddress").value.trim();
    const clientName = document.getElementById("inputClientName").value.trim();
    const startDate  = document.getElementById("startDate").value;
    const stock      = document.getElementById("inputStock").value.trim();
    const notes      = document.getElementById("notesInput").value.trim();

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
            notes:       notes,
            status:      "active"
        }])
        .select()
        .single();

    newJobButton.disabled = false;
    newJobButton.innerHTML = '<i class="fa-solid fa-check"></i> Create Job';

    if (error) {
        alert("Failed to save job. Please try again.");
        return;
    }

    cacheJob(data);

    document.getElementById("inputJobName").value    = "";
    document.getElementById("inputAddress").value    = "";
    document.getElementById("inputClientName").value = "";
    document.getElementById("startDate").value       = "";
    document.getElementById("inputStock").value      = "";
    document.getElementById("notesInput").value      = "";

    const empty = jobCardsContainer.querySelector(".emptyState");
    if (empty) empty.remove();

    jobCardsContainer.insertBefore(buildJobCard(data), jobCardsContainer.firstChild);
    closeForm();
});

// === OPEN JOB DETAIL ===
async function openJobDetail(jobId) {
    jobDetail.classList.add("active");
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';

    // Only use memory cache if same job AND not currently clocked in
    // If clocked in, always fetch fresh to guarantee accurate state
    if (currentJob && currentJob.id === jobId && !currentJob.clocked_in_at) {
        populateDetailView(currentJob);
        updateClockUI(currentJob);
        loadTimeLogs(currentJob.id);
        return;
    }

    // Show cached version instantly while fetching fresh from Supabase
    const cachedJob = getCachedJob(jobId);
    if (cachedJob) {
        currentJob = cachedJob;
        populateDetailView(cachedJob);
        updateClockUI(cachedJob);
        loadTimeLogs(cachedJob.id);
    } else {
        timeLogsContainer.innerHTML = `<p class="emptyState" style="font-size:0.78rem;">Loading...</p>`;
    }

    // Always fetch fresh from Supabase
    const { data: freshJob, error } = await db
        .from("Jobs")
        .select("*")
        .eq("id", jobId)
        .single();

    if (error || !freshJob) {
        if (!currentJob) {
            alert("Failed to load job details.");
            closeJobDetail();
        }
        return;
    }

    // Update everything with confirmed server data
    currentJob = freshJob;
    cacheJob(freshJob);
    populateDetailView(freshJob);
    updateClockUI(freshJob);
    loadTimeLogs(freshJob.id);

    // Keep job card in list in sync
    const card = jobCardsContainer.querySelector(`[data-id="${freshJob.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(freshJob), card);
}

// === CLOSE JOB DETAIL ===
function closeJobDetail() {
    jobDetail.classList.remove("active");
    // Do NOT null out currentJob — keep it in memory
}

jobDetailBack.addEventListener("click", closeJobDetail);

// === POPULATE DETAIL VIEW ===
function populateDetailView(job) {
    const status = getJobStatus(job);
    const { bg, color } = getStatusStyle(status);
    const isCompleted = job.status === "completed";

    document.getElementById("jobDetailTitle").textContent   = job.job_name;
    document.getElementById("detailJobName").textContent    = job.job_name    || "—";
    document.getElementById("detailAddress").textContent    = job.address     || "—";
    document.getElementById("detailClientName").textContent = job.client_name || "—";
    document.getElementById("detailStartDate").textContent  = job.start_date  || "—";
    document.getElementById("detailStock").textContent      = job.stock       || "—";
    document.getElementById("detailNotes").textContent      = job.notes       || "—";
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
function updateClockUI(job) {
    const totalSeconds = job.total_time_seconds || 0;

    if (job.clocked_in_at && !job.clocked_out_at) {
        clockButton.classList.add("clockedIn");
        clockButtonText.textContent = "Clock Out";
        clockStatus.textContent = `Clocked in at ${formatTime(new Date(job.clocked_in_at))}`;
    } else {
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";
        clockStatus.textContent = job.clocked_out_at
            ? `Last clocked out at ${formatTime(new Date(job.clocked_out_at))}`
            : "Not yet clocked in";
    }

    totalTimeDisplay.textContent = totalSeconds > 0
        ? `Total time on job: ${formatDuration(totalSeconds)}`
        : "";
}

// === HANDLE CLOCK OUT ===
async function handleClockOut() {
    const now            = new Date().toISOString();
    const clockInTime    = new Date(currentJob.clocked_in_at);
    const clockOutTime   = new Date(now);
    const sessionSeconds = Math.floor((clockOutTime - clockInTime) / 1000);
    const newTotal       = (currentJob.total_time_seconds || 0) + sessionSeconds;

    const displayName = currentUser?.user_metadata?.display_name
        || currentUser?.email?.split("@")[0]
        || "Unknown";

    // Capture clock-in time before we overwrite currentJob
    const clockedInAt = currentJob.clocked_in_at;

    // Update local state immediately
    const updatedJob = {
        ...currentJob,
        clocked_out_at:     now,
        total_time_seconds: newTotal
    };
    currentJob = updatedJob;
    cacheJob(updatedJob);
    updateClockUI(updatedJob);

    // Save session to time_logs
    await db.from("time_logs").insert([{
        job_id:           currentJob.id,
        user_id:          currentUser.id,
        user_name:        displayName,
        clocked_in_at:    clockedInAt,
        clocked_out_at:   now,
        duration_seconds: sessionSeconds
    }]);

    // Update job record in Supabase
    const { data, error } = await db
        .from("Jobs")
        .update({
            clocked_out_at:     now,
            total_time_seconds: newTotal
        })
        .eq("id", currentJob.id)
        .select()
        .single();

    if (!error && data) {
        currentJob = data;
        cacheJob(data);
        updateClockUI(data);
        loadTimeLogs(data.id);

        const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
        if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
    }

    return { error };
}

// === CLOCK BUTTON ===
clockButton.addEventListener("click", async () => {
    if (!currentJob) return;
    clockButton.disabled = true;

    if (currentJob.clocked_in_at && !currentJob.clocked_out_at) {
        // — CLOCK OUT —
        await handleClockOut();
    } else {
        // — CLOCK IN —
        const now = new Date().toISOString();

        // Update local state immediately — don't wait for Supabase
        const updatedJob = {
            ...currentJob,
            clocked_in_at:  now,
            clocked_out_at: null
        };
        currentJob = updatedJob;
        cacheJob(updatedJob);
        updateClockUI(updatedJob);

        // Rebuild card immediately
        const card = jobCardsContainer.querySelector(`[data-id="${updatedJob.id}"]`);
        if (card) jobCardsContainer.replaceChild(buildJobCard(updatedJob), card);

        // Sync to Supabase in background
        const { data, error } = await db
            .from("Jobs")
            .update({
                clocked_in_at:  now,
                clocked_out_at: null
            })
            .eq("id", currentJob.id)
            .select()
            .single();

        if (!error && data) {
            // Merge defensively — trust local clocked_in_at if Supabase returns null
            const mergedJob = {
                ...data,
                clocked_in_at:  data.clocked_in_at  ?? now,
                clocked_out_at: data.clocked_out_at !== undefined ? data.clocked_out_at : null
            };
            currentJob = mergedJob;
            cacheJob(mergedJob);
            updateClockUI(mergedJob);
        }
    }

    clockButton.disabled = false;
});

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
        document.getElementById("editNotes").value      = currentJob.notes       || "";

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
        notes:       document.getElementById("editNotes").value.trim(),
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
    updateClockUI(data);

    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);

    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
});

// === COMPLETE JOB ===
completeJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as complete?")) return;

    // Auto clock out if currently clocked in
    if (currentJob.clocked_in_at && !currentJob.clocked_out_at) {
        await handleClockOut();
    }

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
    updateClockUI(data);

    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
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
    updateClockUI(data);

    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) jobCardsContainer.replaceChild(buildJobCard(data), card);
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