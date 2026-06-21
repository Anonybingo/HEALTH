//team

/* ── UPDATED TEAM MODAL LOGIC ────────────────────────────── */
const modal = document.getElementById('teamModal');
const grid = document.getElementById('teamGrid');
const openBtn = document.getElementById('teamTrigger'); // NOW TARGETING THE UNIQUE ID
const closeBtn = document.getElementById('closeTeamBtn');

const teamData = [
  {
    name: "DR. ALEX RIVERS",
    role: "CHIEF SURGEON",
    spec: "NEUROLOGY",
    exp: "15 YEARS",
    bio: "SPECIALIZING IN ADVANCED SYNAPTIC REPAIR AND NEURAL MAPPING.",
    image: "media/image1.png"
  },
  {
    name: "SARAH VANCE",
    role: "PHARMACIST",
    spec: "CLINICAL PHARMACOLOGY",
    exp: "8 YEARS",
    bio: "EXPERT IN BIO-SYNTHETIC COMPOUNDING AND LONGEVITY SUPPLEMENTS.",
    image: "media/image2.png"
  }
];

// SAFETY CHECK
if (openBtn) {
  openBtn.addEventListener('click', (e) => {
    e.preventDefault(); // PREVENT ANY JUMPING BEHAVIOR
    openTeamModal();
  });
} else {
  console.error("ERROR: COULD NOT FIND BUTTON WITH ID 'TEAMTRIGGER'");
}

function openTeamModal() {
  if (!modal) return;
  modal.style.display = 'flex';
  
  // POPULATE GRID
  grid.innerHTML = teamData.map(member => `
    <div class="member-card">
      <div class="member-photo"><img src="${member.image}" width="100%" height="auto" alt="Member photo"></div>
      <h3>${member.name}</h3>
      <p><strong>${member.role}</strong> | ${member.spec}</p>
      <p><small>EXP: ${member.exp}</small></p>
      <p>${member.bio}</p>
    </div>
  `).join('');
}

// CLOSE LOGIC
if (closeBtn) {
  closeBtn.addEventListener('click', closeTeamModal);
}

function closeTeamModal() {
  modal.style.display = 'none';
}

// CLICK OUTSIDE TO CLOSE
window.addEventListener('click', (e) => {
  if (e.target === modal) closeTeamModal();
});