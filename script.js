// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qbZRx_7dX4dg8niBS0TedA_grY5M0su";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === EMAILJS INIT ===
emailjs.init("ASqDA9Nflas4yZppr");

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
const travelOnBtn         = document.getElementById("travelOnBtn");
const travelOffBtn        = document.getElementById("travelOffBtn");
const takePhotoBtn        = document.getElementById("takePhotoBtn");
const photoGrid           = document.getElementById("photoGrid");
const sendPhotosEmailBtn  = document.getElementById("sendPhotosEmailBtn");

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
let travelActive = false;
let travelStartTime = null;
let capturedPhotos = [];

let newJobStock = [];
let editJobStock = [];
let detailStockArray = [];

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

// === STOCK HELPERS ===
function parseStockArray(stockStr) {
    if (!stockStr) return [];
    return stockStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function renderStockChips(containerId, stockArray, onRemoveCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    stockArray.forEach((item, index) => {
        const chip = document.createElement('span');
        chip.className = 'stockChip';
        chip.innerHTML = `
            ${escapeHtml(item)}
            <span class="removeChip" data-index="${index}"><i class="fa-solid fa-xmark"></i></span>
        `;
        container.appendChild(chip);
    });
    if (onRemoveCallback) {
        container.querySelectorAll('.removeChip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                onRemoveCallback(idx);
            });
        });
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
    newJobStock = [];
    renderStockChips('stockChipsCreate', newJobStock, removeNewJobStock);
    document.getElementById('inputStockItem').value = '';
}

function closeForm() {
    newJobForm.classList.remove("active");
}

addJob.addEventListener("click", openForm);
formClose.addEventListener("click", closeForm);

newJobForm.addEventListener("click", (e) => {
    if (e.target === newJobForm) closeForm();
});

// Create stock handling
document.getElementById('addStockItemBtn').addEventListener('click', () => {
    const input = document.getElementById('inputStockItem');
    const item = input.value.trim();
    if (item) {
        newJobStock.push(item);
        input.value = '';
        renderStockChips('stockChipsCreate', newJobStock, removeNewJobStock);
    }
});

function removeNewJobStock(index) {
    newJobStock.splice(index, 1);
    renderStockChips('stockChipsCreate', newJobStock, removeNewJobStock);
}

document.getElementById('inputStockItem').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addStockItemBtn').click();
    }
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

clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    currentSearchTerm = "";
    clearSearchButton.style.display = "none";
    const jobs = getCachedAllJobs();
    if (jobs.length) renderJobList(jobs);
    searchInput.focus();
});

// === JOB STATUS HELPER ===
function getJobStatus(job) {
    if (job.status === "completed") return "completed";
    if (job.start_date) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const start = new Date(job.start_date);
        start.setHours(0,0,0,0);
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
    jobCardsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton';
        jobCardsContainer.appendChild(skel);
    }

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

// === RENDER JOB LIST ===
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
            <p class="jobName">${escapeHtml(job.job_name)}</p>
            <span class="statusBadge" style="background-color:${bg}; color:${color};">
                ${capitalise(status)}
            </span>
        </div>
        <p class="jobSub">${escapeHtml(job.client_name || "No client")} · ${job.start_date || "No date"}</p>
    `;

    card.addEventListener("click", () => openJobDetail(job.id));
    return card;
}

// === CREATE JOB ===
newJobButton.addEventListener("click", async () => {
    const jobName         = document.getElementById("inputJobName").value.trim();
    const faultDescription = document.getElementById("inputFault").value.trim();
    const clientName      = document.getElementById("inputClientName").value.trim();
    const address         = document.getElementById("inputAddress").value.trim();
    const phone           = document.getElementById("inputPhone").value.trim();
    const startDate       = document.getElementById("startDate").value;
    const stock           = newJobStock.join(', ');

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
    document.getElementById("inputFault").value      = "";
    document.getElementById("inputPhone").value      = "";
    newJobStock = [];
    renderStockChips('stockChipsCreate', [], null);
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

// === TRAVEL UI UPDATE ===
function updateTravelUI() {
    if (travelActive) {
        travelOnBtn.classList.add("activeTravel");
        travelOffBtn.classList.remove("activeTravel");
        if (!activeSession) {
            clockStatus.textContent = "🚗 Travel mode ON (not clocked in)";
        }
    } else {
        travelOnBtn.classList.remove("activeTravel");
        travelOffBtn.classList.add("activeTravel");
        if (!activeSession) {
            clockStatus.textContent = "Travel mode OFF";
        }
    }
}

// === TRAVEL BUTTONS ===
travelOnBtn.addEventListener("click", async () => {
    if (!currentJob) return;
    if (activeSession) {
        alert("Please clock out before starting travel.");
        return;
    }
    travelActive = true;
    travelStartTime = new Date();
    updateTravelUI();
});

travelOffBtn.addEventListener("click", async () => {
    if (!currentJob) return;
    if (activeSession) {
        alert("Cannot turn off travel while clocked in. Clock out first.");
        return;
    }
    if (travelActive && travelStartTime) {
        // Record travel time as a special log entry
        const travelDuration = Math.floor((new Date() - travelStartTime) / 1000);
        if (travelDuration > 0) {
            const displayName = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "User";
            await db.from("time_logs").insert([{
                job_id: currentJob.id,
                user_id: currentUser.id,
                user_name: displayName,
                clocked_in_at: travelStartTime.toISOString(),
                clocked_out_at: new Date().toISOString(),
                duration_seconds: travelDuration,
                is_travel: true
            }]);
            loadTimeLogs(currentJob.id);
        }
    }
    travelActive = false;
    travelStartTime = null;
    updateTravelUI();
});

// === CLOCK IN/OUT ===
async function handleClockIn() {
    if (travelActive) {
        alert("Please turn Travel OFF before clocking in.");
        return;
    }
    
    const now = new Date().toISOString();
    const displayName = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "User";

    const { data, error } = await db
        .from("time_logs")
        .insert([{
            job_id:           currentJob.id,
            user_id:          currentUser.id,
            user_name:        displayName,
            clocked_in_at:    now,
            clocked_out_at:   null,
            duration_seconds: 0,
            is_travel:        false
        }])
        .select()
        .single();

    if (error || !data) {
        alert("Clock in failed: " + (error?.message || "no data returned"));
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
    } else {
        currentJob = { ...currentJob, total_time_seconds: newTotal };
        cacheJob(currentJob);
    }

    activeSession = null;
    updateClockUI(null);
    loadTimeLogs(currentJob.id);
}

function updateClockUI(session) {
    if (session) {
        clockButton.classList.add("clockedIn");
        clockButtonText.textContent = "Clock Out";
        clockStatus.textContent = `Clocked in at ${formatTime(new Date(session.clocked_in_at))}`;
    } else {
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";
        clockStatus.textContent = travelActive ? "🚗 Travel mode ON" : "Not clocked in";
    }

    totalTimeDisplay.textContent = (currentJob?.total_time_seconds || 0) > 0
        ? `Total time on job: ${formatDuration(currentJob.total_time_seconds)}`
        : "";
}

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

// === PHOTO FEATURE ===
function renderPhotoGrid() {
    photoGrid.innerHTML = '';
    capturedPhotos.forEach((photo, idx) => {
        const div = document.createElement('div');
        div.className = 'photoThumb';
        const img = document.createElement('img');
        img.src = photo;
        const removeBtn = document.createElement('div');
        removeBtn.className = 'removePhoto';
        removeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        removeBtn.onclick = () => {
            capturedPhotos.splice(idx, 1);
            renderPhotoGrid();
            sendPhotosEmailBtn.style.display = capturedPhotos.length ? "inline-flex" : "none";
        };
        div.appendChild(img);
        div.appendChild(removeBtn);
        photoGrid.appendChild(div);
    });
    sendPhotosEmailBtn.style.display = capturedPhotos.length ? "inline-flex" : "none";
}

takePhotoBtn.addEventListener("click", () => {
    if (capturedPhotos.length >= 3) {
        alert("Maximum 3 photos allowed per job.");
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                capturedPhotos.push(ev.target.result);
                renderPhotoGrid();
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
});

sendPhotosEmailBtn.addEventListener("click", async () => {
    if (capturedPhotos.length === 0) return;
    
    const subject = `${currentJob.client_name || 'Job'} - ${currentJob.address || 'No address'}`;
    const attachments = capturedPhotos.map((base64, i) => ({
        name: `photo_${i+1}.jpg`,
        data: base64.split(',')[1]
    }));
    
    const templateParams = {
        to_email: "ashleywork02@gmail.com",
        subject: subject,
        message: `Job: ${currentJob.job_name}\nClient: ${currentJob.client_name}\nAddress: ${currentJob.address}\nPhone: ${currentJob.phone || 'N/A'}\n\n${capturedPhotos.length} photos attached.`,
        attachments: attachments
    };
    
    try {
        sendPhotosEmailBtn.disabled = true;
        sendPhotosEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Sending...';
        
        // EmailJS doesn't support attachments directly, so we'll send a link or just notify
        // For photos, we'll send a separate email with image data
        alert("Photos captured. For demo, photos are stored locally. In production, upload to cloud storage first.");
        
        sendPhotosEmailBtn.innerHTML = '<i class="fa-regular fa-envelope"></i> Send Photos';
        sendPhotosEmailBtn.disabled = false;
    } catch (err) {
        console.error('Email error:', err);
        alert(`Failed to send photos: ${err.message}`);
        sendPhotosEmailBtn.disabled = false;
        sendPhotosEmailBtn.innerHTML = '<i class="fa-regular fa-envelope"></i> Send Photos';
    }
});

// === OPEN JOB DETAIL ===
async function openJobDetail(jobId) {
    jobDetail.classList.add("active");
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
    document.getElementById('addStockInlineForm').style.display = 'none';
    document.getElementById('addStockInlineBtn').style.display = 'inline-flex';

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
    
    // Reset travel and photo states
    travelActive = false;
    travelStartTime = null;
    capturedPhotos = [];
    renderPhotoGrid();
    updateTravelUI();
    
    activeSession = await checkActiveSession(jobId);
    updateClockUI(activeSession);
    loadTimeLogs(jobId);
}

function closeJobDetail() {
    jobDetail.classList.remove("active");
    currentJob = null;
    activeSession = null;
    travelActive = false;
    capturedPhotos = [];
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
    document.getElementById("detailFault").textContent      = job.fault_desc  || "—";
    document.getElementById("detailStatus").innerHTML       = `
        <span class="statusBadge" style="background-color:${bg}; color:${color};">
            ${capitalise(status)}
        </span>
    `;

    const stockArray = parseStockArray(job.stock || '');
    detailStockArray = [...stockArray];
    const stockContainer = document.getElementById('stockChipsView');
    stockContainer.innerHTML = '';
    if (stockArray.length > 0) {
        stockArray.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'stockChip';
            chip.textContent = item;
            stockContainer.appendChild(chip);
        });
    }

    if (isCompleted) {
        document.getElementById('addStockInlineBtn').style.display = 'none';
        document.getElementById('addStockInlineForm').style.display = 'none';
        document.getElementById("clockSection").style.display = "none";
        document.getElementById("photosSection").style.display = "none";
    } else {
        document.getElementById('addStockInlineBtn').style.display = 'inline-flex';
        document.getElementById('addStockInlineForm').style.display = 'none';
        document.getElementById("clockSection").style.display = "block";
        document.getElementById("photosSection").style.display = "block";
    }

    completeJobButton.style.display   = isCompleted ? "none"  : "flex";
    uncompleteJobButton.style.display = isCompleted ? "flex"  : "none";
}

// === INLINE ADD STOCK ===
document.getElementById('addStockInlineBtn').addEventListener('click', () => {
    document.getElementById('addStockInlineForm').style.display = 'flex';
    document.getElementById('addStockInlineBtn').style.display = 'none';
});

document.getElementById('cancelAddStockBtn').addEventListener('click', () => {
    document.getElementById('addStockInlineForm').style.display = 'none';
    document.getElementById('addStockInlineBtn').style.display = 'inline-flex';
});

document.getElementById('addStockInlineConfirmBtn').addEventListener('click', async () => {
    const input = document.getElementById('newStockItemInput');
    const item = input.value.trim();
    if (!item || !currentJob) return;

    detailStockArray.push(item);
    const newStockStr = detailStockArray.join(', ');

    const { error } = await db
        .from("Jobs")
        .update({ stock: newStockStr })
        .eq("id", currentJob.id);

    if (!error) {
        currentJob.stock = newStockStr;
        cacheJob(currentJob);
        populateDetailView(currentJob);
        input.value = '';
        document.getElementById('addStockInlineForm').style.display = 'none';
        document.getElementById('addStockInlineBtn').style.display = 'inline-flex';
    } else {
        alert("Failed to add stock item.");
    }
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
        const isTravel = log.is_travel ? "🚗 " : "";

        const row = document.createElement("div");
        row.classList.add("timeLogRow");
        row.innerHTML = `
            <div class="timeLogLeft">
                <div class="timeLogName">${isTravel}${name}</div>
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
        document.getElementById("editFault").value      = currentJob.fault_desc  || "";
        document.getElementById("editPhone").value      = currentJob.phone       || "";

        editJobStock = parseStockArray(currentJob.stock || '');
        renderStockChips('stockChipsEdit', editJobStock, removeEditJobStock);
        document.getElementById('editStockItemInput').value = '';

        jobDetailView.style.display = "none";
        jobDetailEdit.style.display = "block";
        jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }
});

document.getElementById('editAddStockItemBtn').addEventListener('click', () => {
    const input = document.getElementById('editStockItemInput');
    const item = input.value.trim();
    if (item) {
        editJobStock.push(item);
        input.value = '';
        renderStockChips('stockChipsEdit', editJobStock, removeEditJobStock);
    }
});

function removeEditJobStock(index) {
    editJobStock.splice(index, 1);
    renderStockChips('stockChipsEdit', editJobStock, removeEditJobStock);
}

// === SAVE EDIT ===
saveEditButton.addEventListener("click", async () => {
    const updates = {
        job_name:    document.getElementById("editJobName").value.trim(),
        address:     document.getElementById("editAddress").value.trim(),
        client_name: document.getElementById("editClientName").value.trim(),
        start_date:  document.getElementById("editStartDate").value || null,
        stock:       editJobStock.join(', '),
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

    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
});

// === COMPLETE JOB ===
completeJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as complete?")) return;

    if (activeSession) {
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
    updateClockUI(null);
    loadJobs();
    closeJobDetail();
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
    loadJobs();
    closeJobDetail();
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