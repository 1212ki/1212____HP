document.addEventListener("DOMContentLoaded", function(){
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll("nav ul li a");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  navLinks.forEach(function(link) {
    const linkHref = link.getAttribute("href");
    const absoluteURL = new URL(linkHref, window.location.href);
    let linkPath = absoluteURL.pathname;

    const normalize = (path) => {
      path = path.replace(/index\.html$/, "");
      if (path !== "/" && !path.endsWith("/")) {
        path += "/";
      }
      return path;
    };

    let normCurrent = normalize(currentPath);
    if (normCurrent.startsWith("/ticket/")) normCurrent = "/live/";
    if (normCurrent.startsWith("/discography/") || normCurrent.startsWith("/youtube/")) normCurrent = "/music/";
    const normLink = normalize(linkPath);

    link.classList.remove("active");
    link.removeAttribute("aria-current");
    if (normCurrent === normLink || (normLink !== "/" && normCurrent.startsWith(normLink))) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  const header = document.querySelector("header");
  const navToggle = document.querySelector(".nav-toggle");

  if (navToggle && header) {
    const nav = document.getElementById("global-nav");
    const text = document.querySelector(".nav-toggle-text");
    const setMenu = (open, restoreFocus = false) => {
      const narrow = window.innerWidth <= 820;
      const expanded = narrow && open;
      header.classList.toggle("nav-open", expanded);
      navToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (text) text.textContent = expanded ? "閉じる" : "Menu";
      if (nav) nav.hidden = narrow && !expanded;
      if (restoreFocus) navToggle.focus();
    };
    setMenu(false);
    navToggle.addEventListener("click", () => {
      const wasOpen = header.classList.contains("nav-open");
      setMenu(!wasOpen, wasOpen);
    });

    document.querySelectorAll("nav a").forEach((link) => {
      link.addEventListener("click", () => {
        setMenu(false);
      });
    });

    window.addEventListener("resize", () => {
      setMenu(window.innerWidth <= 820 && header.classList.contains("nav-open"));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && header.classList.contains("nav-open")) setMenu(false, true);
    });
  }

  const logo = document.querySelector(".logo");
  if (logo && !reduceMotion) {
    logo.style.cursor = "pointer";

    logo.addEventListener("click", function() {
      const rect = logo.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      createRipple(centerX, centerY);

      for (let i = 0; i < 26; i++) {
        setTimeout(() => {
          createParticle(centerX, centerY);
        }, i * 18);
      }

      logo.classList.add("logo-pulse");
      setTimeout(() => logo.classList.remove("logo-pulse"), 600);
    });
  }

  function createRipple(x, y) {
    const ripple = document.createElement("div");
    ripple.className = "ripple-effect";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    document.body.appendChild(ripple);

    setTimeout(() => ripple.remove(), 1000);
  }

  function createParticle(x, y) {
    const particle = document.createElement("div");
    particle.className = "particle";

    const types = ["♪", "♫", "✦", "✧", "◆", "●"];
    particle.textContent = types[Math.floor(Math.random() * types.length)];

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 120;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;

    particle.style.left = x + "px";
    particle.style.top = y + "px";
    particle.style.setProperty("--endX", endX + "px");
    particle.style.setProperty("--endY", endY + "px");
    particle.style.setProperty("--rotation", (Math.random() * 720 - 360) + "deg");
    particle.style.fontSize = (12 + Math.random() * 16) + "px";

    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 1200);
  }

  const fadeTargets = document.getElementById("home-content") ? [] : document.querySelectorAll(
    ".news-item, .live-event, .discography-item, .section-title, .hero-band, .artist-photo, .video-container, .intro, .live-application, .channel-application"
  );

  fadeTargets.forEach(el => el.classList.add("fade-in-element"));

  if (reduceMotion) {
    fadeTargets.forEach(el => el.classList.add("fade-in-visible"));
  } else {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("fade-in-visible");
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    fadeTargets.forEach(el => observer.observe(el));
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    const musicRoot = document.getElementById("music-content");
    if (musicRoot && musicRoot.contains(anchor)) return;
    anchor.addEventListener("click", function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  if (header) {
    window.addEventListener("scroll", () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 100) {
        header.classList.add("header-scrolled");
      } else {
        header.classList.remove("header-scrolled");
      }
    });
  }

  // Intentionally no 3D tilt: keep cards calm and editorial.
});
