(function () {
  "use strict";
  const destination = document.body.dataset.musicDestination;
  if (destination !== "release" && destination !== "video") return;
  const target = new URL(`../music/#${destination}`, window.location.href);
  window.location.replace(target.href);
})();
