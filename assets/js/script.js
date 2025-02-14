document.addEventListener("DOMContentLoaded", function(){
  // 現在のURLパスを取得し、ナビゲーションリンクに active クラスを付与
  const currentPath = window.location.pathname;  // 例: "/", "/profile/", "/live/" など
  const navLinks = document.querySelectorAll("nav ul li a");

  navLinks.forEach(function(link) {
    const linkPath = link.getAttribute("href");  // 例: "/", "/profile/", ...

    // Homeリンクは "/" に完全一致する場合のみ active
    if (linkPath === "/" && currentPath === "/") {
      link.classList.add("active");
    }
    // Home以外のリンクは、URLパスに含まれていれば active
    else if (linkPath !== "/" && currentPath.indexOf(linkPath) === 0) {
      link.classList.add("active");
    }
  });

  // ----- インタラクティブ・ドゥードゥルエフェクト (以下は変更なし) ----- //
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
