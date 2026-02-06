//https://nostalgic-css.github.io/NES.css/#
//https://fonts.google.com/selection/embed
//////
// Button Toggles

let lastPlayed = null;

document.querySelectorAll(".nes-btn").forEach((button) => {
  button.addEventListener("click", function () {
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

  const volume = typeof options.volume === "number" ? options.volume : 1;
  audio.volume = Math.min(1, Math.max(0, volume));

  button.addEventListener("click", () => {
    audio.currentTime = 0;
    audio.play();
    let lastPlayed = soundSrc;
  });
}

// Example: map sounds to existing buttons
assignSoundToBadge("#badge-9", "sound/TR808/808.wav", { volume: 0.7 });

// Badge Toggles
document.querySelectorAll(".nes-badge").forEach((badge) => {
  badge.addEventListener("click", function () {
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
