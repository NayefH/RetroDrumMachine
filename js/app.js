// Core state
// Merkt sich den zuletzt ueber 1-8 abgespielten Sound.
let lastPlayed = null;

// Constants
const SEQUENCE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const SEQUENCE_BPM = 130;
const STEP_MS = (60 / SEQUENCE_BPM) * 1000;

// Helpers
function getBadgeLabel(badge) {
  const span = badge.querySelector("span");
  if (!span) return null;
  return span.textContent.trim().toUpperCase();
}

function getSequenceBadges() {
  const allBadges = Array.from(document.querySelectorAll(".nes-badge"));

  // Liefert die Badges A-H immer in fester Reihenfolge.
  return SEQUENCE_LABELS.map((label) =>
    allBadges.find((badge) => getBadgeLabel(badge) === label),
  ).filter(Boolean);
}

function assignLastPlayedToSequenceBadge(badge, label) {
  // Nur A-H koennen eine Sequenz-Zuordnung erhalten.
  if (SEQUENCE_LABELS.includes(label) && lastPlayed) {
    // Die Zuordnung wird direkt am Badge gespeichert.
    badge.dataset.assignedSound = lastPlayed;
  }
}

function playSequenceBadges() {
  // Spielt nur Badges ab, die bereits einen Sound zugewiesen haben.
  const assignedSounds = getSequenceBadges()
    .map((badge) => badge.dataset.assignedSound)
    .filter(Boolean);

  assignedSounds.forEach((soundSrc, index) => {
    setTimeout(() => {
      const audio = new Audio(soundSrc);
      audio.currentTime = 0;
      audio.play();
    }, index * STEP_MS);
  });
}

// Sound mapping for control badges (1-8)
function assignSoundToBadge(buttonSelector, soundSrc) {
  const button = document.querySelector(buttonSelector);
  if (!button) return;

  const audio = new Audio(soundSrc);
  audio.preload = "auto";

  const getToggleTarget = () => {
    // Bei .nes-badge wird die Farbe am <span> geaendert, sonst am Element selbst.
    if (button.classList.contains("nes-badge")) {
      return button.querySelector("span");
    }
    return button;
  };

  const setToggleState = (isActive) => {
    const target = getToggleTarget();
    if (!target) return;

    target.classList.toggle("is-active", isActive);

    if (
      target.classList.contains("is-primary") ||
      target.classList.contains("is-warning")
    ) {
      target.classList.toggle("is-primary", !isActive);
      target.classList.toggle("is-warning", isActive);
      return;
    }

    if (
      target.classList.contains("is-success") ||
      target.classList.contains("is-error")
    ) {
      target.classList.toggle("is-success", !isActive);
      target.classList.toggle("is-error", isActive);
    }
  };

  button.addEventListener("click", () => {
    // Dieser Sound ist jetzt der letzte ausgewaehlte fuer A-H.
    lastPlayed = soundSrc;
    audio.currentTime = 0;
    audio.play();
  });

  audio.addEventListener("play", () => setToggleState(true));
  audio.addEventListener("pause", () => setToggleState(false));
  audio.addEventListener("ended", () => setToggleState(false));
}

assignSoundToBadge("#badge-9", "sound/TR808/808.wav");
assignSoundToBadge("#badge-10", "sound/TR808/Hihat.wav");
assignSoundToBadge("#badge-11", "sound/TR808/Kick Basic.wav");
assignSoundToBadge("#badge-12", "sound/TR808/Snare Bright.wav");
assignSoundToBadge("#badge-13", "sound/TR808/Cowbell.wav");
assignSoundToBadge("#badge-14", "sound/TR808/Clap.wav");
assignSoundToBadge("#badge-15", "sound/TR808/Open Hat Long.wav");
assignSoundToBadge("#badge-16", "sound/TR808/Tom High.wav");
