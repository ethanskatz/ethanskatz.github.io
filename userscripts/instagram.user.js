// ==UserScript==
// @name Custom Button
// @match *://instagram.com/*
// ==/UserScript==

const button = document.createElement("button");
button.textContent = "My Button";

button.style.position = "fixed";
button.style.bottom = "20px";
button.style.right = "20px";
button.style.padding = "10px 15px";
button.style.background = "#ff4d4d";
button.style.color = "white";
button.style.border = "none";
button.style.borderRadius = "6px";
button.style.cursor = "pointer";
button.style.zIndex = "9999";

button.onclick = () => {
    alert("Button clicked!");
};

document.body.appendChild(button);