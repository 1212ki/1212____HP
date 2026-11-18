(function () {
  "use strict";
  let frame = null;
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
    frame = document.createElement("iframe");
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&controls=1&rel=0`;
    frame.title = `${String(title || "")} — YouTube player`;
    frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    host.appendChild(frame);
    host.hidden = false;
    trigger.textContent = "閉じる";
    trigger.setAttribute("aria-controls", host.id);
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("data-testid", "home-close");
  }

  window.HomePlayer = { open, close };
  window.addEventListener("pagehide", () => close({ restoreFocus: false }));
})();
