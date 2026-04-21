document.addEventListener("DOMContentLoaded", function () {

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/Job-Tracker/service-worker.js")
                .then(() => console.log("Service Worker registered"))
                .catch((err) => console.log("Service Worker failed:", err));
        });
    }


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