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

// Keyboard: druecke die Taste, die auf dem Badge steht
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();

  const match = Array.from(document.querySelectorAll(".nes-badge")).find(
    (badge) => {
      const span = badge.querySelector("span");
      if (!span) return false;
      const label = span.textContent.trim().toLowerCase();
      return label === key;
    },
  );

  if (!match) return;
  match.click();
  11;
});

assignSoundToBadge("#badge-9", "sound/TR808/808.wav", { volume: 0.7 });
assignSoundToBadge("#badge-10", "sound/TR808/Hihat.wav", { volume: 0.7 });
assignSoundToBadge("#badge-11", "sound/TR808/Kick Basic.wav", { volume: 0.7 });
assignSoundToBadge("#badge-12", "sound/TR808/Snare Bright.wav", {
  volume: 0.7,
});
assignSoundToBadge("#badge-13", "sound/TR808/Cowbell.wav", {
  volume: 0.7,
});
assignSoundToBadge("#badge-14", "sound/TR808/Clap.wav", {
  volume: 0.7,
});
assignSoundToBadge("#badge-15", "sound/TR808/Open Hat Long.wav", {
  volume: 0.7,
});

assignSoundToBadge("#badge-16", "sound/TR808/Tom High.wav", {
  volume: 0.7,
});

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
