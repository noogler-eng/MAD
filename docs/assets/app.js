// Shared behaviour: copy buttons on code blocks, active nav highlighting.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".code-block").forEach((block) => {
    const btn = block.querySelector(".copy-btn");
    const codeEl = block.querySelector("pre code");
    if (!btn || !codeEl) return;
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(codeEl.innerText).then(() => {
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 1500);
      });
    });
  });

  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.split("#")[0] === current) {
      link.classList.add("active");
    }
  });
});
