const KEY = "goonerscroll_enabled";
const HOST_ID = "goonerscroll-shadow-host";

function inject() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      #bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#161616;color:#fff;padding:10px;border-top:2px solid #2d2d2d;font-family:Arial}
    </style>
    <div id="bar">GoonerScroll Overlay is ON (wiring next step)</div>
  `;
}

function remove() {
  document.getElementById(HOST_ID)?.remove();
}

async function apply() {
  const v = await chrome.storage.local.get(KEY);
  v[KEY] ? inject() : remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "GOONERSCROLL_TOGGLE") msg.enabled ? inject() : remove();
});

apply();
