// UI and keyboard event listeners

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

const playButton = document.querySelector("#blue-btn");
if (playButton) {
  playButton.addEventListener("click", playSequenceBadges);
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();

  const match = Array.from(document.querySelectorAll(".nes-badge")).find(
    (badge) => {
      const span = badge.querySelector("span");
      if (!span) return false;
      return span.textContent.trim().toLowerCase() === key;
    },
  );

  if (match) {
    match.click();
  }
});

document.querySelectorAll(".nes-badge").forEach((badge) => {
  badge.addEventListener("click", function () {
    if (this.dataset.soundToggle === "true") return;

    const badgeLabel = this.querySelector("span");
    if (!badgeLabel) return;

    const label = badgeLabel.textContent.trim().toUpperCase();
    assignLastPlayedToSequenceBadge(this, label);

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
