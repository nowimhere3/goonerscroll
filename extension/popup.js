const KEY = "goonerscroll_enabled";

document.addEventListener("DOMContentLoaded", async () => {
  const t = document.getElementById("toggle");
  const v = await chrome.storage.local.get(KEY);
  t.checked = !!v[KEY];

  t.addEventListener("change", async () => {
    await chrome.storage.local.set({ [KEY]: t.checked });
    chrome.runtime.sendMessage({ type: "GS_ENABLED_CHANGED", enabled: t.checked });
  });
});
