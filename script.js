document.addEventListener("DOMContentLoaded", function () {

    // === FULLSCREEN ===
    function requestFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
            el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    }

    // Only trigger fullscreen when running as installed PWA
    window.addEventListener("load", () => {
        if (window.matchMedia("(display-mode: standalone)").matches) {
            document.addEventListener("click", function triggerFullscreen() {
                requestFullscreen();
                document.removeEventListener("click", triggerFullscreen);
            }, { once: true });
        }
    });

    const openCloseNav = document.getElementById("openCloseNav");
    const navBar = document.getElementById("navBar");
    const navOverlay = document.getElementById("navOverlay");
    const addJob = document.getElementById("addJob");
    const jobLists = document.getElementById("jobLists");
    const jobsSection = document.getElementById("jobsSection");
    const newJobForm = document.getElementById("newJobForm");
    const formButton = document.getElementById("newJobButton");

    openCloseNav.addEventListener("click", function () {
        navBar.classList.toggle("open");
        navOverlay.classList.toggle("active");
    });

    navOverlay.addEventListener("click", function () {
        navBar.classList.remove("open");
        navOverlay.classList.remove("active");
    });

    addJob.addEventListener("click", function () {
        jobLists.style.display = "none";
        newJobForm.style.display = "grid";
    });

    jobsSection.addEventListener("click", function () {
        jobLists.style.display = "block";
        navBar.classList.remove("open");
        navOverlay.classList.remove("active");
        newJobForm.style.display = "none";
    });

    formButton.addEventListener("click", function () {
        newJobForm.style.display = "none";
        jobLists.style.display = "block";
    });


    const formClose = document.getElementById("formClose");

    formClose.addEventListener("click", function () {
        newJobForm.classList.remove("active");
    });

    // Close form when tapping overlay background
    newJobForm.addEventListener("click", function (e) {
        if (e.target === newJobForm) {
            newJobForm.classList.remove("active");
        }
    });


});