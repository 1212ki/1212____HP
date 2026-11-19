(function () {
  "use strict";
  let frame = null;
  let restoreSession = null;
  let host = null;
  let trigger = null;
  let originalParent = null;
  let originalNext = null;

  function close(options) {
    const restoreFocus = !options || options.restoreFocus !== false;
    if (frame) {
      frame.src = "about:blank";
      frame.remove();
      frame = null;
    }
    if (restoreSession) {
      const restore = restoreSession;
      restoreSession = null;
      restore(restoreFocus);
    }
    if (host) {
      host.hidden = true;
      if (originalParent) originalParent.insertBefore(host, originalNext);
    }
    if (trigger) {
      trigger.classList.remove("site-button--secondary");
      trigger.classList.add("site-button--play");
      trigger.parentNode.classList.remove("home-release-actions--playing");
      trigger.textContent = "聴く";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("data-testid", "home-listen");
      if (restoreFocus) trigger.focus();
    }
    host = null;
    trigger = null;
    originalParent = null;
    originalNext = null;
  }

  function createFrame(id, title) {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&controls=1&rel=0`;
    iframe.title = `${String(title || "")} — YouTube player`;
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    return iframe;
  }

  function open(container, button, videoId, title) {
    close({ restoreFocus: false });
    const id = String(videoId || "").trim();
    if (!container || !button || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    host = container;
    trigger = button;
    originalParent = host.parentNode;
    originalNext = host.nextSibling;
    const actions = trigger.parentNode;
    actions.parentNode.insertBefore(host, actions);
    actions.classList.add("home-release-actions--playing");
    trigger.classList.remove("site-button--play");
    trigger.classList.add("site-button--secondary");
    frame = createFrame(id, title);
    host.appendChild(frame);
    host.hidden = false;
    trigger.textContent = "閉じる";
    trigger.setAttribute("aria-controls", host.id);
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("data-testid", "home-close");
  }

  function openMusic(options) {
    close({ restoreFocus: false });
    if (!options) return;
    const { host: container, trigger: button, closeButton, mode, title } = options;
    const id = String(options.youtubeId || "").trim();
    if (!container || !button || !closeButton || !["release", "video"].includes(mode) || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const wasHidden = button.hidden;
    const closeWasHidden = closeButton.hidden;
    const label = button.textContent;
    const testId = button.getAttribute("data-testid");
    const expanded = button.getAttribute("aria-expanded");
    const controls = button.getAttribute("aria-controls");
    const wasPlay = button.classList.contains("site-button--play");
    const wasSecondary = button.classList.contains("site-button--secondary");
    restoreSession = restoreFocus => {
      container.hidden = true;
      button.hidden = wasHidden;
      closeButton.hidden = closeWasHidden;
      button.setAttribute("aria-expanded", expanded === null ? "false" : expanded);
      if (controls === null) button.removeAttribute("aria-controls");
      else button.setAttribute("aria-controls", controls);
      if (mode === "release") {
        button.textContent = label;
        if (testId === null) button.removeAttribute("data-testid");
        else button.setAttribute("data-testid", testId);
        if (wasPlay) button.classList.add("site-button--play");
        else button.classList.remove("site-button--play");
        if (wasSecondary) button.classList.add("site-button--secondary");
        else button.classList.remove("site-button--secondary");
      }
      if (restoreFocus) button.focus();
    };
    frame = createFrame(id, title);
    container.appendChild(frame);
    container.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", container.id);
    if (mode === "release") {
      button.textContent = "閉じる";
      button.setAttribute("data-testid", "music-close");
      button.classList.remove("site-button--play");
      button.classList.add("site-button--secondary");
    } else {
      button.hidden = true;
      closeButton.hidden = false;
    }
  }

  window.HomePlayer = { open, close };
  window.MusicPlayer = { open: openMusic, close };
  window.addEventListener("pagehide", () => close({ restoreFocus: false }));
})();
