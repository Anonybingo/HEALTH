// team/team.js

/* ── Scroll reveal ───────────────────────────────────────────────── */
function reveal() {
  document.querySelectorAll(".reveal").forEach((el) => {
    el.classList.toggle("active", el.getBoundingClientRect().top < window.innerHeight - 120);
  });
}
window.addEventListener("scroll", reveal, { passive: true });
reveal();

/* ── Navbar hide-on-scroll ───────────────────────────────────────── */
let lastScrollY = window.scrollY;
const navbar = document.querySelector(".navbar");
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (navbar) navbar.classList.toggle("navbar--hidden", y > lastScrollY && y > 50);
  lastScrollY = y;
}, { passive: true });

/* ── Member card shine effect (mousemove → CSS vars) ────────────── */
document.querySelectorAll(".member-card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  });
});

/* ── Footer leaf particles ───────────────────────────────────────── */
class Leaf {
  constructor(c) { this.c = c; this.reset(); this.y = Math.random() * c.height; }
  reset() {
    this.x = Math.random() * this.c.width; this.y = this.c.height + 20;
    this.size = Math.random() * 8 + 5; this.speedY = -(Math.random() * 0.7 + 0.3);
    this.speedX = Math.random() * 0.2 - 0.1; this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.015 - 0.0075;
    this.swaySpeed = Math.random() * 0.015 + 0.005;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.opacity = Math.random() * 0.3 + 0.15;
  }
  update() {
    this.y += this.speedY; this.swayOffset += this.swaySpeed;
    this.x += this.speedX + Math.sin(this.swayOffset) * 0.4; this.angle += this.spin;
    if (this.y < -20 || this.x < -20 || this.x > this.c.width + 20) this.reset();
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.bezierCurveTo(this.size*.6,-this.size*.4,this.size*.6,this.size*.4,0,this.size);
    ctx.bezierCurveTo(-this.size*.6,this.size*.4,-this.size*.6,-this.size*.4,0,-this.size);
    ctx.fillStyle = "rgba(0,255,0)"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-this.size); ctx.lineTo(0,this.size);
    ctx.strokeStyle = `rgba(0,0,0,${this.opacity*.3})`; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }
}

const fc = document.getElementById("leafCanvas");
if (fc) {
  const ctx = fc.getContext("2d"); const leaves = [];
  const resize = () => { const r=fc.parentElement.getBoundingClientRect(); fc.width=r.width; fc.height=r.height; };
  window.addEventListener("resize", resize, { passive: true }); resize();
  for (let i=0;i<25;i++) leaves.push(new Leaf(fc));
  (function anim(){ ctx.clearRect(0,0,fc.width,fc.height); leaves.forEach(l=>{l.update();l.draw(ctx);}); requestAnimationFrame(anim); })();
}
