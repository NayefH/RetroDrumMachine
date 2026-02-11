// Retro Drum Machine - zentrale Laufzeitdatei
// Diese Datei kombiniert die frueher getrennte App- und Keyboard-Logik.
// Aufbau:
// 1) Zustand und Konstanten
// 2) Allgemeine UI-Helfer
// 3) Transport-Status (Play/Pause)
// 4) Sequencer-Engine (Planung + Audio-Wiedergabe)
// 5) Event-Wiring fuer UI und Tastatur
// 6) Sound-Zuordnung fuer Pads 1-8

// 1) Zustand und Konstanten
// Merkt den zuletzt ueber die Control-Pads (1-8) abgespielten Sound.
// Dieser Wert wird genutzt, um Sequenz-Slots A-H zu belegen.
let lastPlayed = null;

// Feste Reihenfolge der Sequenz-Slots.
const SEQUENCE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
// Globale Geschwindigkeit der Sequenz in BPM.
const SEQUENCE_BPM = 130;
// Schrittlaenge in Millisekunden (Viertelnotenraster).
const STEP_MS = (60 / SEQUENCE_BPM) * 1000;

// Laufzeitdaten des Sequencers:
// - sequenceActiveAudios: aktuell klingende Audio-Instanzen
// - sequenceTimeouts: IDs geplanter setTimeout-Schritte
// - scheduledSequenceSteps: noch nicht ausgefuehrte Schritte mit Zielzeit
// - pausedSequenceSteps: beim Pausieren eingefrorene Restschritte
// - isSequencePlaying/isSequencePaused: Transport-Zustand fuer UI und Logik
const sequenceActiveAudios = new Set();
let sequenceTimeouts = [];
let scheduledSequenceSteps = [];
let pausedSequenceSteps = [];
let isSequencePlaying = false;
let isSequencePaused = false;

// 2) Allgemeine UI-Helfer
// Ref: MDN EventTarget.addEventListener
// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
// Schaltet bei normalen NES-Buttons die Farben um (z. B. primary <-> warning),
function wireButtonColorToggle(button) {
  button.addEventListener("click", function () {
    if (this.dataset.soundToggle === "true") return;

    // Ref: MDN Element.classList + DOMTokenList.toggle(force)
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
    // https://developer.mozilla.org/docs/Web/API/DOMTokenList/toggle
    // Primary = Blau, Success = Grün, Warning = Gelb, Error = Rot
    // Wird für Play und Pause verwendet

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
}

// Setzt den aktiven UI-Status fuer einen Button inklusive Farbklasse.
// Die Funktion unterstuetzt beide in der UI genutzten Farbpaarungen:
// primary/warning sowie success/error
// Primary = Blau, Success = Grün, Warning = Gelb, Error = Rot

function setButtonToggleClasses(button, isActive) {
  if (!button) return;

  button.classList.toggle("is-active", isActive);

  if (
    button.classList.contains("is-primary") ||
    button.classList.contains("is-warning")
  ) {
    button.classList.toggle("is-primary", !isActive);
    button.classList.toggle("is-warning", isActive);
    return;
  }

  if (
    button.classList.contains("is-success") ||
    button.classList.contains("is-error")
  ) {
    button.classList.toggle("is-success", !isActive);
    button.classList.toggle("is-error", isActive);
  }
}

// Liest das sichtbare Label eines Badges (z. B. "A", "B", "1", "2").
function getBadgeLabel(badge) {
  const span = badge.querySelector("span");
  if (!span) return null;
  return span.textContent.trim().toUpperCase();
}

// Liefert die Sequenz-Badges A-H immer in definierter Reihenfolge.
// Das ist wichtig, damit die Sequenz reproduzierbar bleibt.
function getSequenceBadges() {
  const allBadges = Array.from(document.querySelectorAll(".nes-badge"));

  return SEQUENCE_LABELS.map((label) =>
    allBadges.find((badge) => getBadgeLabel(badge) === label),
  ).filter(Boolean);
}

// Weist einem Sequenz-Badge (A-H) den zuletzt abgespielten Control-Sound zu.
// Die Zuordnung wird direkt im DOM per data-Attribut gespeichert.
function assignLastPlayedToSequenceBadge(badge, label) {
  if (SEQUENCE_LABELS.includes(label) && lastPlayed) {
    badge.dataset.assignedSound = lastPlayed;
  }
}

// 3) Transport-Status (Play/Pause-Buttons)
// Play ist visuell aktiv, solange die Sequenz laeuft.
function setPlayButtonState(isActive) {
  setButtonToggleClasses(document.querySelector("#blue-btn"), isActive);
}

// Pause ist visuell aktiv, solange die Sequenz pausiert ist.
function setPauseButtonState(isActive) {
  setButtonToggleClasses(document.querySelector("#green-btn"), isActive);
}

// Synchronisiert die UI-Buttons mit dem internen Transport-Zustand.
function updateTransportButtonStates() {
  setPlayButtonState(isSequencePlaying);
  setPauseButtonState(isSequencePaused);
}

// 4) Sequencer-Engine (Playback)
// Entfernt alle geplanten Sequenzschritte und leert die Planungslisten.
function clearScheduledSequenceTimeouts() {
  // Ref: MDN Window.setTimeout
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
  sequenceTimeouts.forEach((id) => clearTimeout(id));
  sequenceTimeouts = [];
  scheduledSequenceSteps = [];
}

// Beendet die Sequenz vollstaendig:
// - geplante Steps stoppen
// - laufende Audios abbrechen und zuruecksetzen
// - Transport-Status auf "inaktiv" setzen
function stopSequencePlayback() {
  clearScheduledSequenceTimeouts();
  pausedSequenceSteps = [];

  sequenceActiveAudios.forEach((audio) => {
    // Ref: MDN HTMLMediaElement.pause
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause
    audio.pause();
    audio.currentTime = 0;
  });
  sequenceActiveAudios.clear();

  isSequencePlaying = false;
  isSequencePaused = false;
  updateTransportButtonStates();
}

// Schliesst die Sequenz automatisch ab, wenn nichts mehr zu tun ist.
// Nur wenn:
// - nicht pausiert
// - keine geplanten Steps mehr
// - kein Audio mehr aktiv
function maybeFinishSequencePlayback() {
  if (isSequencePaused) return;
  if (scheduledSequenceSteps.length > 0) return;
  if (sequenceActiveAudios.size > 0) return;
  stopSequencePlayback();
}

// Startet genau einen Sequenz-Sound als neue Audio-Instanz.
// Ein lokales cleanup stellt sicher, dass die Instanz aus dem aktiven Set
// entfernt wird und ggf. Sequenz-Ende erkannt wird.
function playSequenceSound(soundSrc) {
  const audio = new Audio(soundSrc);

  const cleanup = () => {
    sequenceActiveAudios.delete(audio);
    maybeFinishSequencePlayback();
  };

  // Ref: MDN HTMLMediaElement events
  // play: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event
  // pause: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause_event
  // ended: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event
  audio.addEventListener("ended", cleanup);
  audio.addEventListener("error", cleanup);
  audio.addEventListener("pause", () => {
    if (!isSequencePaused) cleanup();
  });

  sequenceActiveAudios.add(audio);
  audio.currentTime = 0;

  // Ref: MDN HTMLMediaElement.play() Promise behavior
  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => cleanup());
  }
}

// Plant einen Sequenzschritt in der Zukunft und merkt sich dessen Zielzeit.
// Beim Pausieren kann dadurch die Restzeit bis zum Schritt berechnet werden.
function scheduleSequenceStep(soundSrc, delayMs) {
  // Ref: MDN Performance.now (stable high-resolution timing)
  // https://developer.mozilla.org/docs/Web/API/Performance/now
  const targetTime = performance.now() + delayMs;
  const step = { soundSrc, targetTime };
  scheduledSequenceSteps.push(step);

  const timeoutId = setTimeout(() => {
    sequenceTimeouts = sequenceTimeouts.filter((id) => id !== timeoutId);
    scheduledSequenceSteps = scheduledSequenceSteps.filter(
      (candidate) => candidate !== step,
    );

    if (!isSequencePlaying || isSequencePaused) return;
    playSequenceSound(soundSrc);
    maybeFinishSequencePlayback();
  }, delayMs);

  sequenceTimeouts.push(timeoutId);
}

// Startet eine neue Sequenz aus einer Soundliste.
// Vorheriges Playback wird bewusst gestoppt, damit kein Ueberlappen entsteht.
function startSequencePlaybackFromSounds(soundList) {
  if (soundList.length === 0) return;

  stopSequencePlayback();
  isSequencePlaying = true;
  updateTransportButtonStates();

  soundList.forEach((soundSrc, index) => {
    scheduleSequenceStep(soundSrc, index * STEP_MS);
  });
}

// Liest die aktuelle A-H-Belegung aus und startet das Sequenz-Playback.
function playSequenceBadges() {
  const assignedSounds = getSequenceBadges()
    .map((badge) => badge.dataset.assignedSound)
    .filter(Boolean);

  startSequencePlaybackFromSounds(assignedSounds);
}

// Pausiert laufende Sequenz:
// - aktive Audios werden pausiert
// - geplante Schritte werden geloescht
// - Restzeiten der Schritte werden zwischengespeichert
function pauseSequencePlayback() {
  if (!isSequencePlaying || isSequencePaused) return;

  isSequencePlaying = false;
  isSequencePaused = true;

  const now = performance.now();
  pausedSequenceSteps = scheduledSequenceSteps.map((step) => ({
    soundSrc: step.soundSrc,
    delayMs: Math.max(0, step.targetTime - now),
  }));

  clearScheduledSequenceTimeouts();
  sequenceActiveAudios.forEach((audio) => audio.pause());
  updateTransportButtonStates();
}

// Setzt pausierte Sequenz fort:
// - pausierte Audios spielen weiter
// - verbleibende Schritte werden mit Restzeit neu geplant
function resumeSequencePlayback() {
  if (!isSequencePaused) return;

  isSequencePaused = false;
  isSequencePlaying = true;

  sequenceActiveAudios.forEach((audio) => {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        sequenceActiveAudios.delete(audio);
        maybeFinishSequencePlayback();
      });
    }
  });

  pausedSequenceSteps.forEach((step) => {
    scheduleSequenceStep(step.soundSrc, step.delayMs);
  });
  pausedSequenceSteps = [];

  updateTransportButtonStates();
  maybeFinishSequencePlayback();
}

// Komfortfunktion fuer den Pause-Button:
// bei Pause -> Resume, sonst -> Pause.
function toggleSequencePause() {
  if (isSequencePaused) {
    resumeSequencePlayback();
    return;
  }

  pauseSequencePlayback();
}

// 5) Globales Event-Wiring
// Verbindet Play/Pause-Buttons mit der Transport-Logik.
// Beide Buttons werden als sound-gesteuert markiert, damit der generische
// Klick-Toggle nicht in den Zustand eingreift.
function wireTransportButtons() {
  const playButton = document.querySelector("#blue-btn");
  if (playButton) {
    playButton.dataset.soundToggle = "true";
    playButton.addEventListener("click", playSequenceBadges);
  }

  const pauseButton = document.querySelector("#green-btn");
  if (pauseButton) {
    pauseButton.dataset.soundToggle = "true";
    pauseButton.addEventListener("click", toggleSequencePause);
  }
}

// Verknuepft Tastatureingaben mit Badge-Klicks:
// - "a" bis "h" fuer Sequenz-Slots
// - "1" bis "8" fuer Control-Pads
function wireKeyboardToBadges() {
  // Ref: MDN KeyboardEvent.key / KeyboardEvent.repeat
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
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
}

// Badge-Klicklogik:
// - A-H: nimmt lastPlayed als Zuordnung an
// - A-H ohne Zuordnung bleiben inaktiv
// - 1-8: nur visuelle Toggle-Farbe
function wireBadgeClickBehavior() {
  document.querySelectorAll(".nes-badge").forEach((badge) => {
    badge.addEventListener("click", function () {
      const badgeLabel = this.querySelector("span");
      if (!badgeLabel) return;

      const label = badgeLabel.textContent.trim().toUpperCase();
      assignLastPlayedToSequenceBadge(this, label);
      const isSequenceBadge =
        label.length === 1 && label >= "A" && label <= "H";
      const hasAssignedSound = Boolean(this.dataset.assignedSound);

      if (isSequenceBadge && !hasAssignedSound) {
        return;
      }

      if (isSequenceBadge) {
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
}

// 6) Sound-Zuordnung fuer Pads 1-8
// Verbindet ein Badge mit einer festen Audiodatei und synchronisiert die
// visuelle Aktivitaet ueber play/pause/ended-Events.
function assignSoundToBadge(buttonSelector, soundSrc) {
  const button = document.querySelector(buttonSelector);
  if (!button) return;

  const audio = new Audio(soundSrc);
  audio.preload = "auto";

  const getToggleTarget = () => {
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
    lastPlayed = soundSrc;
    audio.currentTime = 0;
    audio.play();
  });

  audio.addEventListener("play", () => setToggleState(true));
  audio.addEventListener("pause", () => setToggleState(false));
  audio.addEventListener("ended", () => setToggleState(false));
}

// Initialisiert einmalig alle UI-Listener.
function initializeUiBindings() {
  document.querySelectorAll(".nes-btn").forEach(wireButtonColorToggle);
  wireTransportButtons();
  wireKeyboardToBadges();
  wireBadgeClickBehavior();
}

// Registriert die acht Control-Sounds.
function initializeSoundMappings() {
  assignSoundToBadge("#badge-9", "sound/TR808/808.wav");
  assignSoundToBadge("#badge-10", "sound/TR808/Hihat.wav");
  assignSoundToBadge("#badge-11", "sound/TR808/Kick Basic.wav");
  assignSoundToBadge("#badge-12", "sound/TR808/Snare Bright.wav");
  assignSoundToBadge("#badge-13", "sound/TR808/Cowbell.wav");
  assignSoundToBadge("#badge-14", "sound/TR808/Clap.wav");
  assignSoundToBadge("#badge-15", "sound/TR808/Open Hat Long.wav");
  assignSoundToBadge("#badge-16", "sound/TR808/Tom High.wav");
}

// Einstiegspunkt der Runtime.
initializeUiBindings();
initializeSoundMappings();
