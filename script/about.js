// script/about.js
// Modal removed — "DISCOVER OUR TEAM" now links to the team page.
// The teamModal div in index.html can also be deleted (see note below).

const teamBtn = document.getElementById("teamTrigger");
if (teamBtn) {
  teamBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "team/team.html";
  });
}

/* ── Text Decryptor Animation ────────────────────────────────────── */
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+~`|}{[]:;?><,./-=";
const decryptElements = document.querySelectorAll(".decrypt-text");

const decryptObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const element  = entry.target;
    const finalWord = element.dataset.value;
    if (element.dataset.animating === "true") return;
    element.dataset.animating = "true";

    let iterations = 0;
    const interval = setInterval(() => {
      element.innerText = finalWord
        .split("")
        .map((letter, index) => {
          if (index < iterations) return finalWord[index];
          return letters[Math.floor(Math.random() * letters.length)];
        })
        .join("");

      if (iterations >= finalWord.length) {
        clearInterval(interval);
        element.dataset.animating = "false";
      }
      iterations += 1 / 3;
    }, 30);

    decryptObserver.unobserve(element);
  });
}, { threshold: 0.5 });

decryptElements.forEach((el) => decryptObserver.observe(el));

/* ── Interactive Neural Cell ─────────────────────────────────────── */
const neuralCell = document.querySelector(".neural-cell");
if (neuralCell) {
  document.addEventListener("mousemove", (e) => {
    const rect = neuralCell.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    neuralCell.style.setProperty("--mouse-x", `${x}%`);
    neuralCell.style.setProperty("--mouse-y", `${y}%`);
    neuralCell.style.transform = `translate(${(x - 50) / 5}px, ${(y - 50) / 5}px)`;
  });
}
