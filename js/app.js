//https://nostalgic-css.github.io/NES.css/#
//https://fonts.google.com/selection/embed
//////
// Button Toggles

let lastPlayed = null;

document.querySelectorAll(".nes-btn").forEach((button) => {
  button.addEventListener("click", function () {
    if (this.dataset.soundToggle === "true") return;
    if (
      this.classList.contains("is-primary") ||
      this.classList.contains("is-warning")
    ) {
      this.classList.toggle("is-primary");
      this.classList.toggle("is-warning");
      return;
    }

    if (
      this.classList.contains("is-success") ||
      this.classList.contains("is-error")
    ) {
      this.classList.toggle("is-success");
      this.classList.toggle("is-error");
    }
  });
});

// Button Sound Mapping
function assignSoundToBadge(buttonSelector, soundSrc, options = {}) {
  const button = document.querySelector(buttonSelector);
  if (!button) return;

  const audio = new Audio(soundSrc);
  audio.preload = "auto";

  // Optional Lautstaerke 0..1, Standard ist 1
  const volume = typeof options.volume === "number" ? options.volume : 1;
  audio.volume = Math.min(1, Math.max(0, volume));

  // Markiert dieses Element als "Sound-gesteuert"
  button.dataset.soundToggle = "true";

  // Bei Badges toggeln wir das <span>, bei Buttons das Element selbst
  const getToggleTarget = () => {
    if (button.classList.contains("nes-badge")) {
      return button.querySelector("span");
    }
    return button;
  };

  // Aktiviert/Deaktiviert die Toggle-Klasse je nach Sound-Status
  const setToggleState = (isActive) => {
    const target = getToggleTarget();
    if (!target) return;

    if (
      target.classList.contains("is-primary") ||
      target.classList.contains("is-warning")
    ) {
      // Primary/Warning Paar
      target.classList.toggle("is-primary", !isActive);
      target.classList.toggle("is-warning", isActive);
      return;
    }

    if (
      target.classList.contains("is-success") ||
      target.classList.contains("is-error")
    ) {
      // Success/Error Paar
      target.classList.toggle("is-success", !isActive);
      target.classList.toggle("is-error", isActive);
    }
  };

  // Klick startet den Sound neu
  button.addEventListener("click", () => {
    audio.currentTime = 0;
    audio.play();
  });

  // Toggle ist nur aktiv, solange der Sound laeuft
  audio.addEventListener("play", () => setToggleState(true));
  audio.addEventListener("pause", () => setToggleState(false));
  audio.addEventListener("ended", () => setToggleState(false));
}

assignSoundToBadge("#badge-9", "sound/TR808/808.wav", { volume: 0.7 });

// Badge Toggles
document.querySelectorAll(".nes-badge").forEach((badge) => {
  badge.addEventListener("click", function () {
    if (this.dataset.soundToggle === "true") return;
    const badgeLabel = this.querySelector("span");
    if (!badgeLabel) return;

    if (
      badgeLabel.classList.contains("is-primary") ||
      badgeLabel.classList.contains("is-warning")
    ) {
      badgeLabel.classList.toggle("is-primary");
      badgeLabel.classList.toggle("is-warning");
      return;
    }

    if (
      badgeLabel.classList.contains("is-success") ||
      badgeLabel.classList.contains("is-error")
    ) {
      badgeLabel.classList.toggle("is-success");
      badgeLabel.classList.toggle("is-error");
    }
  });
});
