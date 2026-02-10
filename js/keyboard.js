// UI and keyboard event listeners

// Toggle-Farben fuer die NES-Buttons (z. B. PLAY/PAUSE Optik).
document.querySelectorAll(".nes-btn").forEach((button) => {
  button.addEventListener("click", function () {
    // Sound-gesteuerte Elemente werden hier nicht visuell umgeschaltet.
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
  // Startet die Sequenz mit den aktuell zugewiesenen Sounds von A-H.
  playButton.addEventListener("click", playSequenceBadges);
}

const pauseButton = document.querySelector("#green-btn");
if (pauseButton) {
  pauseButton.addEventListener("click", toggleSequencePause);
}

// Erlaubt Keyboard-Steuerung fuer Badge-Labels (A-H, 1-8).
document.addEventListener("keydown", (e) => {
  // Verhindert mehrfaches Triggern beim Gedrueckthalten.
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
    // Tastendruck verhaelt sich wie ein Klick auf das passende Badge.
    match.click();
  }
});

// Klick-Logik fuer alle Badges (Zuweisung + visuelles Toggle).
document.querySelectorAll(".nes-badge").forEach((badge) => {
  badge.addEventListener("click", function () {
    if (this.dataset.soundToggle === "true") return;

    const badgeLabel = this.querySelector("span");
    if (!badgeLabel) return;

    const label = badgeLabel.textContent.trim().toUpperCase();
    // Klick auf A-H uebernimmt den zuletzt abgespielten Sound (falls vorhanden).
    assignLastPlayedToSequenceBadge(this, label);
    const isSequenceBadge = label.length === 1 && label >= "A" && label <= "H";
    const hasAssignedSound = Boolean(this.dataset.assignedSound);

    // A-H bleibt inaktiv, bis ein Sound zugewiesen wurde.
    if (isSequenceBadge && !hasAssignedSound) {
      return;
    }

    if (isSequenceBadge) {
      // A-H schaltet nur einmal auf aktiv und nicht wieder zurueck.
      if (badgeLabel.classList.contains("is-primary")) {
        badgeLabel.classList.remove("is-primary");
        badgeLabel.classList.add("is-warning");
      }
      return;
    }

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
