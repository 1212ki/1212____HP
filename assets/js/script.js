document.addEventListener("DOMContentLoaded", function(){
  const currentPath = window.location.pathname;  // 例: "/contact/index.html"
  const navLinks = document.querySelectorAll("nav ul li a");

  navLinks.forEach(function(link) {
    // 例: link.getAttribute("href") => "../contact/"
    const linkHref = link.getAttribute("href");

    // 1. 相対パス -> 絶対URL に変換
    const absoluteURL = new URL(linkHref, window.location.href);
    // 例: absoluteURL.pathname => "/contact/"

    let linkPath = absoluteURL.pathname;

    // 2. もし "/contact/index.html" と "/contact/" のように微妙に違う場合に備えて
    //    "index.html" を除去し、末尾の "/" を揃えるなどの調整
    const normalize = (path) => {
      // index.html を除去
      path = path.replace(/index\.html$/, "");
      // 末尾に "/" がなければ足す（ルートの場合を除く）
      if (path !== "/" && !path.endsWith("/")) {
        path += "/";
      }
      return path;
    };

    const normCurrent = normalize(currentPath);
    const normLink = normalize(linkPath);

    // 3. 比較して一致すれば active クラスを付与
    if (normCurrent === normLink) {
      link.classList.add("active");
    }
  });

  // ドゥードゥルエフェクトはそのまま
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.addEventListener("click", function() {
      const overlay = document.createElement("div");
      overlay.className = "doodle-overlay";
      overlay.innerHTML = `<canvas id="doodleCanvas"></canvas>`;
      document.body.appendChild(overlay);

      const canvas = document.getElementById("doodleCanvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");

      let startTime = null;
      function drawDoodle(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
          ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
          ctx.strokeStyle = "rgba(191,103,77,0.7)";
          ctx.lineWidth = Math.random() * 3 + 1;
          ctx.stroke();
        }
        
        if (progress < 1500) {
          requestAnimationFrame(drawDoodle);
        } else {
          overlay.style.transition = "opacity 0.5s ease-out";
          overlay.style.opacity = "0";
          setTimeout(() => overlay.remove(), 500);
        }
      }
      requestAnimationFrame(drawDoodle);
    });
  }
});
