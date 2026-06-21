/**
 * Animation orchestrator + particle system + parallax
 */

'use strict';

/* ── DOM refs ─────────────────────────────────────────────── */
const loader        = document.getElementById('loader');
const loaderFill    = document.getElementById('loaderFill');
const panelCenter   = document.getElementById('panelCenter');
const imgCenter     = document.getElementById('imgCenter');
const centerLine    = document.getElementById('centerLine');
const welcomeText   = document.getElementById('welcomeText');
const subtitleRow   = document.getElementById('subtitleRow');
const particleCanvas = document.getElementById('particleCanvas');
const mouseLight    = document.getElementById('mouseLight');
const bottomBadge   = document.getElementById('bottomBadge');

const brackets = [
  document.getElementById('bTL'),
  document.getElementById('bTR'),
  document.getElementById('bBL'),
  document.getElementById('bBR'),
];

/* ── Mouse tracking ───────────────────────────────────────── */
let mouseX = window.innerWidth  / 2;
let mouseY = window.innerHeight / 2;
let targetX = mouseX;
let targetY = mouseY;

document.addEventListener('mousemove', e => {
  targetX = e.clientX;
  targetY = e.clientY;
});

/* Smooth mouse-light follow (lerped each frame) */
function updateMouseLight() {
  mouseX += (targetX - mouseX) * 0.1;
  mouseY += (targetY - mouseY) * 0.1;
  mouseLight.style.left = mouseX + 'px';
  mouseLight.style.top  = mouseY + 'px';
}

/* Parallax on panel based on mouse */
let panelsReady = false;
function applyParallax() {
  if (!panelsReady) return;

  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;
  const dx = (targetX - cx) / cx; // -1 … +1
  const dy = (targetY - cy) / cy;

  imgCenter.style.transform = `scale(1.06) translate(${dx * 8}px, ${dy * 6}px)`;
}

/* ── Particle System ──────────────────────────────────────── */
class Particle {
  constructor(W, H) {
    this.reset(W, H);
  }
  reset(W, H) {
    this.x    = Math.random() * W;
    this.y    = H + 10;
    this.r    = Math.random() * 1.5 + 0.5;
    this.vy   = -(Math.random() * 0.55 + 0.18);
    this.vx   = (Math.random() - 0.5) * 0.25;
    this.life = 0;
    this.max  = Math.random() * 220 + 80;
    this.a    = Math.random() * 0.4 + 0.15;
  }
}

class ParticleSystem {
  constructor(canvas, count = 120) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.count   = count;
    this.pool    = [];
    this.raf     = null;
    this.running = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  start() {
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());

    const { ctx, W, H, pool, count } = this;

    // Spawn
    while (pool.length < count) pool.push(new Particle(W, H));

    ctx.clearRect(0, 0, W, H);

    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life >= p.max || p.y < -10) {
        p.reset(W, H);
        continue;
      }

      const ratio   = p.life / p.max;
      const fade    = ratio < 0.1
        ? ratio / 0.1
        : ratio > 0.8
          ? (1 - ratio) / 0.2
          : 1;
      const opacity = p.a * fade;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${opacity.toFixed(3)})`;
      ctx.fill();
    }
  }
}

/* ── Master animation frame ───────────────────────────────── */
let particles;

function mainLoop() {
  requestAnimationFrame(mainLoop);
  updateMouseLight();
  applyParallax();
}

/* ── Delay helper ─────────────────────────────────────────── */
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ── Sequence ─────────────────────────────────────────────── */
async function runSequence() {

  // 1. Fake loader progress bar
  await delay(150);
  loaderFill.style.width = '100%';

  await delay(2500);
  loader.classList.add('out');

  // 2. Panel scales in
  await delay(180);
  panelCenter.classList.add('in');

  // 3. Center hairline grows
  await delay(600);
  centerLine.classList.add('in');
  panelsReady = true; // enable parallax

  // 4. WELCOME text rises up
  await delay(500);
  welcomeText.classList.add('in');

  // 5. Subtitle fades in
  await delay(700);
  subtitleRow.classList.add('in');

  // 6. Corner brackets appear
  await delay(400);
  brackets.forEach(b => b.classList.add('in'));

  // 7. Particle canvas & bottom badge
  await delay(200);
  particleCanvas.classList.add('in');
  particles.start();

  await delay(300);
  bottomBadge.classList.add('in');
}

/* ── Glitch pulse on WELCOME (subtle, periodic) ───────────── */
function scheduleGlitch() {
  const glitchInterval = 5000 + Math.random() * 4000;

  setTimeout(() => {
    // Tiny horizontal jitter
    welcomeText.style.transition = 'none';
    welcomeText.style.transform  = `translateX(${(Math.random() - 0.5) * 4}px) skewX(${(Math.random() - 0.5) * 0.6}deg)`;

    setTimeout(() => {
      welcomeText.style.transition = '';
      welcomeText.style.transform  = '';
      scheduleGlitch();
    }, 80);
  }, glitchInterval);
}

/* ── Resize handler ───────────────────────────────────────── */
window.addEventListener('resize', () => {
  if (particles) particles._resize();
});

/* ── Click / keypress replay ──────────────────────────────── */
let hasClicked = false;
function rippleOnClick(e) {
  if (!panelsReady || hasClicked) return;
  hasClicked = true;

  // flash the center line
  centerLine.style.background =
    'linear-gradient(to bottom, transparent, rgba(255,255,255,0.7) 30%, rgba(255,255,255,0.7) 70%, transparent)';
  setTimeout(() => {
    centerLine.style.background = '';
    hasClicked = false;
  }, 300);
}
document.addEventListener('click', rippleOnClick);

/* ── Boot ─────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  particles = new ParticleSystem(particleCanvas, 60);

  mainLoop();        // kick off the per-frame loop
  runSequence();     // orchestrate the entrance
  scheduleGlitch();  // subtle text glitch
});

function reveal() {
  var reveals = document.querySelectorAll(".reveal");

  for (var i = 0; i < reveals.length; i++) {
    var windowHeight = window.innerHeight;
    var elementTop = reveals[i].getBoundingClientRect().top;
    var elementVisible = 150;

    if (elementTop < windowHeight - elementVisible) {
      reveals[i].classList.add("active");
    } else {
      reveals[i].classList.remove("active");
    }
  }
}

window.addEventListener("scroll", reveal, {passive: true});

let lastScrollY = window.scrollY;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;

  if (currentScrollY > lastScrollY && currentScrollY > 50) {
    // user is scrolling down -> hide the navbar
    navbar.classList.add('navbar--hidden');
  } else {
    // user is scrolling up -> show the navbar
    navbar.classList.remove('navbar--hidden');
  }

  // update the scroll tracker position
  lastScrollY = currentScrollY;
});

// cinematic hero fade and parallax on scroll
const heroScene = document.getElementById('scene');

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const windowHeight = window.innerHeight;

  // only animate if the hero is still in view
  if (scrollY < windowHeight && heroScene) {
    // fade out based on scroll depth
    const opacityRatio = 1 - (scrollY / windowHeight) * 1.5;
    
    // push it down slightly to create a depth effect behind the services
    const yOffset = scrollY * 0.4;

    heroScene.style.opacity = Math.max(opacityRatio, 0);
    heroScene.style.transform = `translateY(${yOffset}px)`;
  }
});

// 3d kinetic tilt and dynamic reflection shine logic
const cards = document.querySelectorAll('.service-item');

cards.forEach(card => {
  const shine = card.querySelector('.shine');

  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position inside the card
    const y = e.clientY - rect.top;  // y position inside the card

    // calculate pointer position as a percentage for the css radial gradient
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);

    // find the middle coordinates of the card
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // calculate rotation degrees based on mouse distance from center
    // dividing by a higher number makes the tilt subtler and smoother
    const rotateX = -(y - centerY) / 8;
    const rotateY = (x - centerX) / 8;

    // apply the 3d rotation and a tiny pop forward on the z-axis
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
  });

  // reset card position smoothly when the cursor leaves the element
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
    card.style.transition = 'transform 0.5s ease';
  });

  // remove the transitional reset timing when mouse enters again so it is responsive
  card.addEventListener('mouseenter', () => {
    card.style.transition = 'none';
  });
});

// custom cursor logic
const cursor = document.getElementById('customCursor');
const interactiveElements = document.querySelectorAll('a, button, .service-item, .magnetic-btn');

document.addEventListener('mousemove', (e) => {
  // moves the cursor ring to the exact mouse coordinates
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
});

// add the expanding effect when hovering over links or cards
interactiveElements.forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hovering');
  });
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
  });
});

// magnetic effect for interactive items
const magneticItems = document.querySelectorAll('.nav-link, .navbar-logo, .magnetic-btn');

magneticItems.forEach(item => {
  item.addEventListener('mousemove', (e) => {
    const rect = item.getBoundingClientRect();
    
    // find the exact centerpoint of the link text
    const itemCenterX = rect.left + rect.width / 2;
    const itemCenterY = rect.top + rect.height / 2;
    
    // calculate how far away the mouse cursor is from the center
    const distanceX = e.clientX - itemCenterX;
    const distanceY = e.clientY - itemCenterY;
    
    // pull the item 30% of the distance toward the cursor
    item.style.transform = `translate(${distanceX * 0.3}px, ${distanceY * 0.3}px)`;
  });

  // snap back smoothly when mouse exits the boundary
  item.addEventListener('mouseleave', () => {
    item.style.transform = 'translate(0px, 0px)';
  });
});

// ── LEAF PARTICLE MATHEMATICS FOR FOOTER ──────────────────
class LeafParticle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    // randomize starting heights so they do not spawn in a single flat line
    this.y = Math.random() * canvas.height; 
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height + 20; // reset right beneath visible viewport boundary
    this.size = Math.random() * 8 + 5; // diverse sizing
    this.speedY = -(Math.random() * 0.7 + 0.3); // upward progression velocity
    this.speedX = Math.random() * 0.2 - 0.1; 
    this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.015 - 0.0075; // rotation speed
    this.swaySpeed = Math.random() * 0.015 + 0.005;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.opacity = Math.random() * 0.3 + 0.15; // translucent blending
  }

  update() {
    this.y += this.speedY;
    this.swayOffset += this.swaySpeed;
    this.x += this.speedX + Math.sin(this.swayOffset) * 0.4; // smooth sine sway
    this.angle += this.spin;

    // recycled back to bottom if it escapes off the top or sideways limits
    if (this.y < -20 || this.x < -20 || this.x > this.canvas.width + 20) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    
    // mathematical bezier paths to construct a sleek structural leaf shape
    ctx.moveTo(0, -this.size);
    ctx.bezierCurveTo(this.size * 0.6, -this.size * 0.4, this.size * 0.6, this.size * 0.4, 0, this.size);
    ctx.bezierCurveTo(-this.size * 0.6, this.size * 0.4, -this.size * 0.6, -this.size * 0.4, 0, -this.size);
    
    ctx.fillStyle = `rgba(0, 255, 0)`; // ${this.opacity}
    ctx.fill();
    
    // clean geometric center spine vein line
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(0, this.size);
    ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity * 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
}

// initialization process
const footerCanvas = document.getElementById('leafCanvas');
if (footerCanvas) {
  const footerCtx = footerCanvas.getContext('2d');
  let leaves = [];
  
  function resizeFooterCanvas() {
    const rect = footerCanvas.parentElement.getBoundingClientRect();
    footerCanvas.width = rect.width;
    footerCanvas.height = rect.height;
  }
  
  window.addEventListener('resize', resizeFooterCanvas);
  resizeFooterCanvas();
  
  // create the leaf array collection
  for (let i = 0; i < 25; i++) {
    leaves.push(new LeafParticle(footerCanvas));
  }
  
  function animateLeaves() {
    footerCtx.clearRect(0, 0, footerCanvas.width, footerCanvas.height);
    
    leaves.forEach(leaf => {
      leaf.update();
      leaf.draw(footerCtx);
    });
    
    requestAnimationFrame(animateLeaves);
  }
  
  animateLeaves();
}


/* ── Text Decryptor Animation ────────────────────────────── */
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+~`|}{[]:;?><,./-=";
const decryptElements = document.querySelectorAll(".decrypt-text");

const decryptObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      let iterations = 0;
      const element = entry.target;
      const finalWord = element.dataset.value;
      
      // prevent re-triggering if already animating
      if (element.dataset.animating === "true") return;
      element.dataset.animating = "true";

      const interval = setInterval(() => {
        element.innerText = finalWord
          .split("")
          .map((letter, index) => {
            if (index < iterations) {
              return finalWord[index];
            }
            return letters[Math.floor(Math.random() * letters.length)];
          })
          .join("");

        if (iterations >= finalWord.length) {
          clearInterval(interval);
          element.dataset.animating = "false";
        }
        iterations += 1 / 3; // Controls the speed of the decryption
      }, 30);
      
      decryptObserver.unobserve(element); // Only run once per page load
    }
  });
}, { threshold: 0.5 });

decryptElements.forEach(el => decryptObserver.observe(el));

/* ── Interactive Neural Cell Logic ───────────────────────── */
const neuralCell = document.querySelector('.neural-cell');

if (neuralCell) {
  document.addEventListener('mousemove', (e) => {
    const rect = neuralCell.getBoundingClientRect();
    
    // CALCULATE MOUSE POSITION PERCENTAGE RELATIVE TO ELEMENT
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // APPLY TO CSS VARIABLES
    neuralCell.style.setProperty('--mouse-x', `${x}%`);
    neuralCell.style.setProperty('--mouse-y', `${y}%`);
    
    // PUSH EFFECT: MOVE THE CELL SLIGHTLY TOWARD THE MOUSE
    const moveX = (x - 50) / 5;
    const moveY = (y - 50) / 5;
    neuralCell.style.transform = `translate(${moveX}px, ${moveY}px)`;
  });
}
