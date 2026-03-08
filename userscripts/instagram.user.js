// ==UserScript==
// @name Follower Diff
// @match *://www.instagram.com/*
// @run-at document-end
// ==/UserScript==

function addButton() {

    // Prevent duplicates
    if (document.getElementById("my-custom-button")) return;

    // Find profile header area
    const header = document.querySelector("header");

    if (!header) return;

    const btn = document.createElement("button");
    btn.id = "my-custom-button";
    btn.innerText = "My Button";

    btn.style.marginLeft = "10px";
    btn.style.padding = "6px 12px";
    btn.style.borderRadius = "8px";
    btn.style.border = "none";
    btn.style.background = "#ff3040";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "bold";

    btn.onclick = () => {
        const username = window.location.pathname.split("/")[1];
        alert("Username: " + username);
    };

    header.appendChild(btn);
}

// Instagram is a SPA, so watch for navigation
setInterval(addButton, 1500);