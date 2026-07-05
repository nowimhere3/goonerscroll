const KEY = "goonerscroll_enabled";

chrome.runtime.onInstalled.addListener(async () => {
  const v = await chrome.storage.local.get(KEY);
  if (typeof v[KEY] === "undefined") await chrome.storage.local.set({ [KEY]: false });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GS_ENABLED_CHANGED") {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && /^https?:/.test(tab.url || "")) {
          chrome.tabs.sendMessage(tab.id, { type: "GOONERSCROLL_TOGGLE", enabled: !!msg.enabled }).catch(() => {});
        }
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "GS_NAVIGATE" && sender.tab?.id) {
    chrome.tabs.update(sender.tab.id, { url: msg.url }, () => sendResponse({ ok: true }));
    return true;
  }
});
