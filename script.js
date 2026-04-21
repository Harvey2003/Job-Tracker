// === SUPABASE INIT ===
const SUPABASE_URL = "https://dbiilqwpdzilpdqzetyx.supabase.co";      
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
const loginScreen        = document.getElementById("loginScreen");
const loginEmail         = document.getElementById("loginEmail");
const loginPassword      = document.getElementById("loginPassword");
const loginButton        = document.getElementById("loginButton");
const loginError         = document.getElementById("loginError");
const welcomeSub         = document.getElementById("welcomeSub");
const logoutButton       = document.getElementById("logoutButton");
const openCloseNav       = document.getElementById("openCloseNav");
const navBar             = document.getElementById("navBar");
const navOverlay         = document.getElementById("navOverlay");
const addJob             = document.getElementById("addJob");
const newJobForm         = document.getElementById("newJobForm");
const formClose          = document.getElementById("formClose");
const newJobButton       = document.getElementById("newJobButton");
const jobCardsContainer  = document.getElementById("jobCardsContainer");
const createJobSection   = document.getElementById("createJobSection");
const jobsSection        = document.getElementById("jobsSection");
const jobDetail          = document.getElementById("jobDetail");
const jobDetailBack      = document.getElementById("jobDetailBack");
const jobDetailEditToggle = document.getElementById("jobDetailEditToggle");
const jobDetailView      = document.getElementById("jobDetailView");
const jobDetailEdit      = document.getElementById("jobDetailEdit");
const clockButton        = document.getElementById("clockButton");
const clockButtonText    = document.getElementById("clockButtonText");
const clockStatus        = document.getElementById("clockStatus");
const totalTimeDisplay   = document.getElementById("totalTimeDisplay");
const completeJobButton  = document.getElementById("completeJobButton");
const saveEditButton     = document.getElementById("saveEditButton");

// === STATE ===
let currentJob = null;

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
    loginScreen.classList.remove("active");
    welcomeSub.textContent = user.email.split("@")[0];
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
// Scrolls the focused input above the keyboard on mobile
document.querySelectorAll(".newJobInput, #notesInput").forEach(input => {
    input.addEventListener("focus", () => {
        setTimeout(() => {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
    });
});

// === LOAD JOBS ===
async function loadJobs() {
    jobCardsContainer.innerHTML = `<p class="emptyState">Loading jobs...</p>`;

    const { data: jobs, error } = await db
        .from("Jobs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        jobCardsContainer.innerHTML = `<p class="emptyState" style="color:#dc2626;">Failed to load jobs.</p>`;
        return;
    }

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

    const isActive   = job.status === "active";
    const badgeBg    = isActive ? "#dcfce7" : "#f3f4f6";
    const badgeColor = isActive ? "#16a34a" : "#6b7280";

    card.innerHTML = `
        <div class="jobCardHeader">
            <p class="jobName">${job.job_name}</p>
            <span class="statusBadge" style="background-color:${badgeBg}; color:${badgeColor};">
                ${capitalise(job.status)}
            </span>
        </div>
        <p class="jobSub">${job.client_name || "No client"} · ${job.start_date || "No date"}</p>
    `;

    card.addEventListener("click", () => openJobDetail(job));

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

// === JOB DETAIL ===
function openJobDetail(job) {
    currentJob = job;
    populateDetailView(job);
    updateClockUI(job);
    jobDetail.classList.add("active");
    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';

    // Hide complete button if already complete
    completeJobButton.style.display = job.status === "completed" ? "none" : "flex";
}

function closeJobDetail() {
    jobDetail.classList.remove("active");
    currentJob = null;
}

jobDetailBack.addEventListener("click", closeJobDetail);

function populateDetailView(job) {
    document.getElementById("jobDetailTitle").textContent  = job.job_name;
    document.getElementById("detailJobName").textContent   = job.job_name    || "—";
    document.getElementById("detailAddress").textContent   = job.address     || "—";
    document.getElementById("detailClientName").textContent = job.client_name || "—";
    document.getElementById("detailStartDate").textContent = job.start_date  || "—";
    document.getElementById("detailStock").textContent     = job.stock       || "—";
    document.getElementById("detailNotes").textContent     = job.notes       || "—";
    document.getElementById("detailStatus").textContent    = capitalise(job.status);
}

// === EDIT TOGGLE ===
jobDetailEditToggle.addEventListener("click", () => {
    const isEditing = jobDetailEdit.style.display === "block";

    if (isEditing) {
        // Switch back to view
        jobDetailView.style.display = "block";
        jobDetailEdit.style.display = "none";
        jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
    } else {
        // Populate edit fields
        document.getElementById("editJobName").value   = currentJob.job_name    || "";
        document.getElementById("editAddress").value   = currentJob.address     || "";
        document.getElementById("editClientName").value = currentJob.client_name || "";
        document.getElementById("editStartDate").value = currentJob.start_date  || "";
        document.getElementById("editStock").value     = currentJob.stock       || "";
        document.getElementById("editNotes").value     = currentJob.notes       || "";

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
    populateDetailView(data);

    // Update the card in the list
    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) {
        const newCard = buildJobCard(data);
        jobCardsContainer.replaceChild(newCard, card);
    }

    jobDetailView.style.display = "block";
    jobDetailEdit.style.display = "none";
    jobDetailEditToggle.innerHTML = '<i class="fa-solid fa-pen"></i>';
});

// === COMPLETE JOB ===
completeJobButton.addEventListener("click", async () => {
    if (!confirm("Mark this job as complete?")) return;

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
    populateDetailView(data);
    completeJobButton.style.display = "none";

    // Update card in list
    const card = jobCardsContainer.querySelector(`[data-id="${data.id}"]`);
    if (card) {
        jobCardsContainer.replaceChild(buildJobCard(data), card);
    }
});

// === CLOCK IN / OUT ===
function updateClockUI(job) {
    const totalSeconds = job.total_time_seconds || 0;

    if (job.clocked_in_at && !job.clocked_out_at) {
        // Currently clocked in
        clockButton.classList.add("clockedIn");
        clockButtonText.textContent = "Clock Out";
        const since = new Date(job.clocked_in_at);
        clockStatus.textContent = `Clocked in at ${formatTime(since)}`;
    } else {
        // Not clocked in
        clockButton.classList.remove("clockedIn");
        clockButtonText.textContent = "Clock In";

        if (job.clocked_out_at) {
            const out = new Date(job.clocked_out_at);
            clockStatus.textContent = `Last clocked out at ${formatTime(out)}`;
        } else {
            clockStatus.textContent = "Not yet clocked in";
        }
    }

    totalTimeDisplay.textContent = totalSeconds > 0
        ? `Total time on job: ${formatDuration(totalSeconds)}`
        : "";
}

clockButton.addEventListener("click", async () => {
    if (!currentJob) return;

    const now = new Date().toISOString();
    let updates = {};

    if (currentJob.clocked_in_at && !currentJob.clocked_out_at) {
        // Clock OUT
        const clockInTime  = new Date(currentJob.clocked_in_at);
        const clockOutTime = new Date(now);
        const sessionSeconds = Math.floor((clockOutTime - clockInTime) / 1000);
        const newTotal = (currentJob.total_time_seconds || 0) + sessionSeconds;

        updates = {
            clocked_out_at:      now,
            total_time_seconds:  newTotal
        };
    } else {
        // Clock IN
        updates = {
            clocked_in_at:  now,
            clocked_out_at: null
        };
    }

    clockButton.disabled = true;

    const { data, error } = await db
        .from("Jobs")
        .update(updates)
        .eq("id", currentJob.id)
        .select()
        .single();

    clockButton.disabled = false;

    if (error) {
        alert("Failed to update clock. Please try again.");
        return;
    }

    currentJob = data;
    updateClockUI(data);
});

// === HELPERS ===
function capitalise(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}