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
const loginScreen       = document.getElementById("loginScreen");
const loginEmail        = document.getElementById("loginEmail");
const loginPassword     = document.getElementById("loginPassword");
const loginButton       = document.getElementById("loginButton");
const loginError        = document.getElementById("loginError");
const welcomeSub        = document.getElementById("welcomeSub");
const logoutButton      = document.getElementById("logoutButton");
const openCloseNav      = document.getElementById("openCloseNav");
const navBar            = document.getElementById("navBar");
const navOverlay        = document.getElementById("navOverlay");
const addJob            = document.getElementById("addJob");
const newJobForm        = document.getElementById("newJobForm");
const formClose         = document.getElementById("formClose");
const newJobButton      = document.getElementById("newJobButton");
const jobCardsContainer = document.getElementById("jobCardsContainer");
const createJobSection  = document.getElementById("createJobSection");
const jobsSection       = document.getElementById("jobsSection");

// === AUTH STATE LISTENER ===
db.auth.onAuthStateChange((event, session) => {
    if (session) {
        showApp(session.user);
    } else {
        showLogin();
    }
});

// === SHOW LOGIN ===
function showLogin() {
    loginScreen.classList.add("active");
    loginEmail.value = "";
    loginPassword.value = "";
    loginError.textContent = "";
}

// === SHOW APP ===
function showApp(user) {
    loginScreen.classList.remove("active");
    const displayName = user.email.split("@")[0];
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

// Allow pressing Enter to submit login
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
});

createJobSection.addEventListener("click", () => {
    closeNav();
    openForm();
});

// === FORM OPEN / CLOSE ===
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

// === LOAD JOBS FROM SUPABASE ===
async function loadJobs() {
    jobCardsContainer.innerHTML = `<p class="emptyState">Loading jobs...</p>`;

    const { data: jobs, error } = await db
        .from("jobs")
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

// === BUILD JOB CARD ELEMENT ===
function buildJobCard(job) {
    const card = document.createElement("div");
    card.classList.add("jobCard");
    card.dataset.id = job.id;

    const isActive = job.status === "active";
    const badgeBg    = isActive ? "#dcfce7" : "#f3f4f6";
    const badgeColor = isActive ? "#16a34a" : "#6b7280";
    const statusText = capitalise(job.status);

    card.innerHTML = `
        <div class="jobCardHeader">
            <p class="jobName">${job.job_name}</p>
            <span class="statusBadge" style="background-color:${badgeBg}; color:${badgeColor};">
                ${statusText}
            </span>
        </div>
        <p class="jobSub">${job.client_name || "No client"} · ${job.start_date || "No date"}</p>
    `;

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
        .from("jobs")
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

    // Clear form fields
    document.getElementById("inputJobName").value  = "";
    document.getElementById("inputAddress").value  = "";
    document.getElementById("inputClientName").value = "";
    document.getElementById("startDate").value     = "";
    document.getElementById("inputStock").value    = "";
    document.getElementById("notesInput").value    = "";

    // Remove empty state if present
    const empty = jobCardsContainer.querySelector(".emptyState");
    if (empty) empty.remove();

    // Prepend new card to list
    jobCardsContainer.insertBefore(buildJobCard(data), jobCardsContainer.firstChild);

    closeForm();
});

// === HELPERS ===
function capitalise(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}