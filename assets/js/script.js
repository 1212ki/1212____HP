document.addEventListener("DOMContentLoaded", function(){
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll("nav ul li a");

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

    const normCurrent = normalize(currentPath);
    const normLink = normalize(linkPath);

    if (normCurrent === normLink) {
      link.classList.add("active");
    }
  });

  // ========== タイトルクリック時のパーティクルエフェクト ==========
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.style.cursor = "pointer";

    logo.addEventListener("click", function(e) {
      const rect = logo.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // 波紋エフェクト
      createRipple(centerX, centerY);

      // パーティクルエフェクト（音符・星・キラキラ）
      for (let i = 0; i < 30; i++) {
        setTimeout(() => {
          createParticle(centerX, centerY);
        }, i * 20);
      }

      // タイトル自体のアニメーション
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

    // ランダムな種類（音符、星、キラキラ）
    const types = ["♪", "♫", "✦", "✧", "◆", "●"];
    particle.textContent = types[Math.floor(Math.random() * types.length)];

    // ランダムな方向と距離
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

  // ========== スクロール時のフェードインアニメーション ==========
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

  // ニュースアイテムと各セクションにフェードイン適用
  document.querySelectorAll(".news-item, .live-event, .discography-item, .section-title").forEach(el => {
    el.classList.add("fade-in-element");
    observer.observe(el);
  });

  // ========== ナビゲーションのスムーズスクロール ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ========== ヘッダーのスクロール時変化 ==========
  const header = document.querySelector("header");
  let lastScroll = 0;

  window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header.classList.add("header-scrolled");
    } else {
      header.classList.remove("header-scrolled");
    }

    lastScroll = currentScroll;
  });

  // ========== ニュースカードのマウストラッキング（3D効果） ==========
  document.querySelectorAll(".news-item").forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateZ(0)";
    });
  });
});
