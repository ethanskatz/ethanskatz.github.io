// ==UserScript==
// @name Follower Diff Improved
// @match *://www.instagram.com/*
// @run-at document-end
// ==/UserScript==

(() => {
    "use strict";

    const CONFIG = {
        API_DELAY_MIN: 50,
        API_DELAY_MAX: 180,
        PAGE_SIZE: 50,
        BUTTON_ID: "fdiff-button",
        PANEL_ID: "fdiff-panel",
        STYLE_ID: "fdiff-style",
        APP_ID: "936619743392459",
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function log(...args) {
        console.log("[FollowerDiff]", ...args);
    }

    function getCurrentProfileUsername() {
        const parts = location.pathname.split("/").filter(Boolean);
        return parts[0] || null;
    }

    function injectStyles() {
        if (document.getElementById(CONFIG.STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = CONFIG.STYLE_ID;
        style.textContent = `
            #${CONFIG.BUTTON_ID} {
                margin-left: 10px;
                padding: 8px 12px;
                border-radius: 10px;
                border: none;
                background: #ff3040;
                color: white;
                cursor: pointer;
                font-weight: 700;
                font-size: 14px;
            }

            #${CONFIG.BUTTON_ID}:disabled {
                opacity: 0.65;
                cursor: wait;
            }

            #${CONFIG.PANEL_ID} {
                position: fixed;
                top: 0;
                right: 0;
                width: 360px;
                height: 100vh;
                background: #fff;
                z-index: 999999;
                box-shadow: -4px 0 16px rgba(0,0,0,0.15);
                padding: 16px;
                overflow-y: auto;
                font-family: Arial, sans-serif;
                color: #111;
            }

            #${CONFIG.PANEL_ID} .fdiff-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }

            #${CONFIG.PANEL_ID} .fdiff-title {
                font-size: 18px;
                font-weight: 700;
                margin: 0;
            }

            #${CONFIG.PANEL_ID} .fdiff-close {
                border: none;
                background: transparent;
                font-size: 20px;
                cursor: pointer;
                line-height: 1;
            }

            #${CONFIG.PANEL_ID} .fdiff-subtitle {
                font-size: 13px;
                color: #666;
                margin-bottom: 12px;
            }

            #${CONFIG.PANEL_ID} .fdiff-tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }

            #${CONFIG.PANEL_ID} .fdiff-tab {
                border: 1px solid #ddd;
                background: #f6f6f6;
                padding: 8px 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
            }

            #${CONFIG.PANEL_ID} .fdiff-tab.active {
                background: #111;
                color: #fff;
                border-color: #111;
            }

            #${CONFIG.PANEL_ID} .fdiff-meta {
                font-size: 12px;
                color: #666;
                margin-bottom: 10px;
            }

            #${CONFIG.PANEL_ID} .fdiff-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            #${CONFIG.PANEL_ID} .fdiff-user {
                display: block;
                padding: 8px 10px;
                border-radius: 8px;
                text-decoration: none;
                color: #111;
                background: #fafafa;
                border: 1px solid #eee;
            }

            #${CONFIG.PANEL_ID} .fdiff-user:hover {
                background: #f1f1f1;
            }

            #${CONFIG.PANEL_ID} .fdiff-empty,
            #${CONFIG.PANEL_ID} .fdiff-error {
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
            }

            #${CONFIG.PANEL_ID} .fdiff-empty {
                background: #f7f7f7;
                color: #444;
            }

            #${CONFIG.PANEL_ID} .fdiff-error {
                background: #fff2f2;
                color: #a40000;
                border: 1px solid #f2cccc;
            }
        `;
        document.head.appendChild(style);
    }

    async function fetchJSON(url) {
        const response = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: {
                "X-IG-App-ID": CONFIG.APP_ID,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while fetching ${url}`);
        }

        return await response.json();
    }

    async function getUserId(username) {
        const lower = username.toLowerCase();
        const url =
            `https://www.instagram.com/api/v1/web/search/topsearch/` +
            `?context=blended&query=${encodeURIComponent(lower)}&include_reel=false`;

        const data = await fetchJSON(url);
        const exactMatch = data.users?.find(
            (entry) => entry?.user?.username?.toLowerCase() === lower
        );

        return exactMatch?.user?.pk || null;
    }

    async function fetchFriendshipList(type, userId, nextMaxId = "") {
        const base =
            `https://www.instagram.com/api/v1/friendships/${userId}/${type}/?count=${CONFIG.PAGE_SIZE}`;
        const url = nextMaxId ? `${base}&max_id=${encodeURIComponent(nextMaxId)}` : base;

        const data = await fetchJSON(url);

        const users = Array.isArray(data.users) ? data.users : [];
        const next = data.next_max_id || null;

        if (!next) return users;

        await sleep(randomInt(CONFIG.API_DELAY_MIN, CONFIG.API_DELAY_MAX));
        const rest = await fetchFriendshipList(type, userId, next);
        return users.concat(rest);
    }

    async function getFollowers(userId) {
        return fetchFriendshipList("followers", userId);
    }

    async function getFollowing(userId) {
        return fetchFriendshipList("following", userId);
    }

    function normalizeUsernames(users) {
        return [...new Set(
            users
                .map((u) => u?.username?.toLowerCase?.())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
    }

    async function compareFollowers(username) {
        if (!username || typeof username !== "string" || !username.trim()) {
            throw new Error("Please enter a valid username.");
        }

        log(`Looking up user ID for "${username}"...`);
        const userId = await getUserId(username);

        if (!userId) {
            throw new Error(`Could not find a user with username "${username}".`);
        }

        log(`Loading followers/following for user ID ${userId}...`);
        const [followersRaw, followingRaw] = await Promise.all([
            getFollowers(userId),
            getFollowing(userId),
        ]);

        const followers = normalizeUsernames(followersRaw);
        const following = normalizeUsernames(followingRaw);

        const followerSet = new Set(followers);
        const followingSet = new Set(following);

        const peopleYouDontFollowBack = followers.filter((u) => !followingSet.has(u));
        const peopleNotFollowingYouBack = following.filter((u) => !followerSet.has(u));
        const mutuals = following.filter((u) => followerSet.has(u));

        const result = {
            username,
            userId,
            followers,
            following,
            peopleYouDontFollowBack,
            peopleNotFollowingYouBack,
            mutuals,
            fetchedAt: new Date().toLocaleString(),
            counts: {
                followers: followers.length,
                following: following.length,
                peopleYouDontFollowBack: peopleYouDontFollowBack.length,
                peopleNotFollowingYouBack: peopleNotFollowingYouBack.length,
                mutuals: mutuals.length,
            },
        };

        log("Finished comparison.", result);
        return result;
    }

    function removePanel() {
        document.getElementById(CONFIG.PANEL_ID)?.remove();
    }

    function renderUserList(container, users) {
        container.innerHTML = "";

        if (!users.length) {
            const empty = document.createElement("div");
            empty.className = "fdiff-empty";
            empty.textContent = "No users in this category.";
            container.appendChild(empty);
            return;
        }

        const list = document.createElement("div");
        list.className = "fdiff-list";

        users.forEach((user) => {
            const link = document.createElement("a");
            link.className = "fdiff-user";
            link.href = `https://www.instagram.com/${user}/`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `@${user}`;
            list.appendChild(link);
        });

        container.appendChild(list);
    }

    function showPanel(data) {
        removePanel();

        const panel = document.createElement("div");
        panel.id = CONFIG.PANEL_ID;

        const header = document.createElement("div");
        header.className = "fdiff-header";

        const title = document.createElement("h3");
        title.className = "fdiff-title";
        title.textContent = `Follower Diff: @${data.username}`;

        const close = document.createElement("button");
        close.className = "fdiff-close";
        close.textContent = "✕";
        close.addEventListener("click", removePanel);

        header.appendChild(title);
        header.appendChild(close);

        const subtitle = document.createElement("div");
        subtitle.className = "fdiff-subtitle";
        subtitle.textContent = "Compare followers and following.";

        const meta = document.createElement("div");
        meta.className = "fdiff-meta";
        meta.textContent =
            `Followers: ${data.counts.followers} • ` +
            `Following: ${data.counts.following} • ` +
            `Fetched: ${data.fetchedAt}`;

        const tabs = document.createElement("div");
        tabs.className = "fdiff-tabs";

        const content = document.createElement("div");

        const tabDefs = [
            {
                key: "peopleNotFollowingYouBack",
                label: `Not following you back (${data.counts.peopleNotFollowingYouBack})`,
            },
            {
                key: "peopleYouDontFollowBack",
                label: `You don't follow back (${data.counts.peopleYouDontFollowBack})`,
            },
            {
                key: "mutuals",
                label: `Mutuals (${data.counts.mutuals})`,
            },
        ];

        function activateTab(key, btn) {
            tabs.querySelectorAll(".fdiff-tab").forEach((el) => el.classList.remove("active"));
            btn.classList.add("active");
            renderUserList(content, data[key]);
        }

        tabDefs.forEach((tabDef, index) => {
            const btn = document.createElement("button");
            btn.className = "fdiff-tab";
            btn.textContent = tabDef.label;
            btn.addEventListener("click", () => activateTab(tabDef.key, btn));
            tabs.appendChild(btn);

            if (index === 0) {
                btn.classList.add("active");
                renderUserList(content, data[tabDef.key]);
            }
        });

        panel.appendChild(header);
        panel.appendChild(subtitle);
        panel.appendChild(meta);
        panel.appendChild(tabs);
        panel.appendChild(content);

        document.body.appendChild(panel);
    }

    function findButtonContainer() {
        return document.querySelector("header section") || document.querySelector("header");
    }

    function ensureButton() {
        injectStyles();

        const existing = document.getElementById(CONFIG.BUTTON_ID);
        const container = findButtonContainer();
        const username = getCurrentProfileUsername();

        if (!container || !username) return;
        if (existing) return;

        const btn = document.createElement("button");
        btn.id = CONFIG.BUTTON_ID;
        btn.textContent = "Compare";

        btn.addEventListener("click", async () => {
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = "Loading...";

            try {
                const profileUsername = getCurrentProfileUsername();
                if (!profileUsername) {
                    throw new Error("Could not determine the profile username from the URL.");
                }

                const data = await compareFollowers(profileUsername);
                showPanel(data);
            } catch (error) {
                removePanel();

                const panel = document.createElement("div");
                panel.id = CONFIG.PANEL_ID;

                const header = document.createElement("div");
                header.className = "fdiff-header";

                const title = document.createElement("h3");
                title.className = "fdiff-title";
                title.textContent = "Follower Diff Error";

                const close = document.createElement("button");
                close.className = "fdiff-close";
                close.textContent = "✕";
                close.addEventListener("click", removePanel);

                header.appendChild(title);
                header.appendChild(close);

                const errorBox = document.createElement("div");
                errorBox.className = "fdiff-error";
                errorBox.textContent = error?.message || "Unknown error occurred.";

                panel.appendChild(header);
                panel.appendChild(errorBox);
                document.body.appendChild(panel);

                console.error("[FollowerDiff]", error);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        container.appendChild(btn);
    }

    function observePageChanges() {
        const observer = new MutationObserver(() => {
            ensureButton();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        ensureButton();
    }

    observePageChanges();
})();