// Retro Drum Machine - object oriented runtime

class SequencerEngine {
  constructor({ stepMs, onTransportChange }) {
    // Timing pro Step und Callback für UI-Status (Play/Pause Buttons).
    this.stepMs = stepMs;
    this.onTransportChange = onTransportChange;

    // Laufzeitstatus der Sequenz.
    this.activeAudios = new Set();
    this.audioHooks = new Map();
    this.timeouts = [];
    this.scheduledSteps = [];
    this.pausedSteps = [];
    this.isPlaying = false;
    this.isPaused = false;
  }

  emitTransport() {
    // Meldet den aktuellen Transportzustand an die UI-Schicht.
    if (typeof this.onTransportChange === "function") {
      this.onTransportChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
      });
    }
  }

  clearScheduledTimeouts() {
    // Stoppt alle geplanten Steps und leert die Planungsdaten.
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    this.scheduledSteps = [];
  }

  stop() {
    console.log("SequencerEngine.stop");
    // Beendet Sequenz vollständig (geplante Steps + laufende Audios).
    this.clearScheduledTimeouts();
    this.pausedSteps = [];

    this.activeAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeAudios.clear();

    this.isPlaying = false;
    this.isPaused = false;
    this.emitTransport();
  }

  maybeFinish() {
    // Auto-Stop nur, wenn wirklich nichts mehr aktiv/geplant ist.
    if (this.isPaused) return;
    if (this.scheduledSteps.length > 0) return;
    if (this.activeAudios.size > 0) return;
    this.stop();
  }

  playSound(soundSrc, hooks = {}) {
    console.log("SequencerEngine.playSound");
    // Jede Wiedergabe läuft über eine eigene Audio-Instanz.
    const audio = new Audio(soundSrc);
    let didCleanup = false;

    const cleanup = () => {
      if (didCleanup) return;
      didCleanup = true;
      if (typeof hooks.onEnd === "function") hooks.onEnd();
      this.activeAudios.delete(audio);
      this.audioHooks.delete(audio);
      this.maybeFinish();
    };

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    audio.addEventListener("pause", () => {
      if (!this.isPaused) cleanup();
      if (this.isPaused && typeof hooks.onPause === "function") hooks.onPause();
    });

    this.activeAudios.add(audio);
    this.audioHooks.set(audio, hooks);
    if (typeof hooks.onStart === "function") hooks.onStart();
    audio.currentTime = 0;

    const playPromise = audio.play();

    //Falls das Abspielen fehlschlägt (z. B. Autoplay blockiert), wird cleanup() aufgerufen, um aufzuräumen
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => cleanup());
    }
  }

  scheduleStep(soundSrc, delayMs, hooks = {}) {
    // Plant einen Sound für die Zukunft und merkt Zielzeit fürs Pausieren.
    const targetTime = performance.now() + delayMs;
    const step = { soundSrc, targetTime, hooks };
    this.scheduledSteps.push(step);

    const timeoutId = setTimeout(() => {
      this.timeouts = this.timeouts.filter((id) => id !== timeoutId);
      this.scheduledSteps = this.scheduledSteps.filter(
        (candidate) => candidate !== step,
      );

      if (!this.isPlaying || this.isPaused) return;
      this.playSound(soundSrc, hooks);
      this.maybeFinish();
    }, delayMs);

    this.timeouts.push(timeoutId);
  }

  playFromSounds(soundList) {
    console.log("SequencerEngine.playFromSounds");
    // Startet neue Sequenz von vorn und ersetzt eventuell laufende Sequenz.
    if (!Array.isArray(soundList) || soundList.length === 0) return;

    this.stop();
    this.isPlaying = true;
    this.emitTransport();

    soundList.forEach((entry, index) => {
      const soundSrc = typeof entry === "string" ? entry : entry?.soundSrc;
      const hooks = typeof entry === "object" && entry ? entry.hooks || {} : {};
      if (!soundSrc) return;
      this.scheduleStep(soundSrc, index * this.stepMs, hooks);
    });
  }

  pause() {
    console.log("SequencerEngine.pause");
    // Friert Sequenz ein: Restzeiten merken, aktive Audios pausieren.
    if (!this.isPlaying || this.isPaused) return;

    this.isPlaying = false;
    this.isPaused = true;

    const now = performance.now();
    this.pausedSteps = this.scheduledSteps.map((step) => ({
      soundSrc: step.soundSrc,
      delayMs: Math.max(0, step.targetTime - now),
      hooks: step.hooks,
    }));

    this.clearScheduledTimeouts();
    this.activeAudios.forEach((audio) => audio.pause());
    this.emitTransport();
  }

  resume() {
    console.log("SequencerEngine.resume");
    // Setzt pausierte Audios/Steps mit den gemerkten Restzeiten fort.
    if (!this.isPaused) return;

    this.isPaused = false;
    this.isPlaying = true;

    this.activeAudios.forEach((audio) => {
      const hooks = this.audioHooks.get(audio);
      if (hooks && typeof hooks.onResume === "function") hooks.onResume();
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.activeAudios.delete(audio);
          this.audioHooks.delete(audio);
          this.maybeFinish();
        });
      }
    });

    this.pausedSteps.forEach((step) => {
      this.scheduleStep(step.soundSrc, step.delayMs, step.hooks || {});
    });
    this.pausedSteps = [];

    this.emitTransport();
    this.maybeFinish();
  }

  togglePause() {
    console.log("SequencerEngine.togglePause");
    // Komfortfunktion für denselben Button: Pause <-> Resume.
    if (this.isPaused) {
      this.resume();
      return;
    }

    this.pause();
  }
}

class DrumMachineApp {
  constructor() {
    // Sequencer-Konfiguration + App-Zustand.
    this.sequenceLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    this.sequenceBpm = 130;
    this.stepMs = (60 / this.sequenceBpm) * 1000;
    this.lastPlayed = null;

    this.sequencer = new SequencerEngine({
      stepMs: this.stepMs,
      onTransportChange: ({ isPlaying, isPaused }) => {
        // UI-Buttons folgen immer dem echten Engine-Zustand.
        this.setPlayButtonState(isPlaying);
        this.setPauseButtonState(isPaused);
      },
    });
  }

  wireButtonColorToggle(button) {
    // Generischer Farb-Toggle für normale NES-Buttons.
    button.addEventListener("click", function () {
      // Sound-gesteuerte Buttons (Play/Pause) werden separat verwaltet.

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

  setButtonToggleClasses(button, isActive) {
    // Setzt aktive/inaktive Farbpaare konsistent (primary/warning, success/error).
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

  setPlayButtonState(isActive) {
    this.setButtonToggleClasses(document.querySelector("#blue-btn"), isActive);
  }

  setPauseButtonState(isActive) {
    this.setButtonToggleClasses(document.querySelector("#green-btn"), isActive);
  }

  getBadgeLabel(badge) {
    // Liest sichtbares Badge-Label (z.B. A-H oder 1-8)
    const span = badge.querySelector("span");
    if (!span) return null;
    return span.textContent.trim().toUpperCase();
  }

  getSequenceBadges() {
    // Liefert A-H in fixer Reihenfolge für reproduzierbare Sequenzen.
    const allBadges = Array.from(document.querySelectorAll(".nes-badge"));

    return this.sequenceLabels
      .map((label) =>
        allBadges.find((badge) => this.getBadgeLabel(badge) === label),
      )
      .filter(Boolean);
  }

  assignLastPlayedToSequenceBadge(badge, label) {
    // Speichert Slot-Zuordnung direkt am DOM-Element (data-assigned-sound).
    if (this.sequenceLabels.includes(label) && this.lastPlayed) {
      badge.dataset.assignedSound = this.lastPlayed;
    }
  }

  playSequenceBadges() {
    console.log("DrumMachineApp.playSequenceBadges");
    // Liest A-H-Belegung aus dem DOM und startet Sequencer.
    const assignedSounds = this.getSequenceBadges()
      .map((badge) => badge.dataset.assignedSound)
      .filter(Boolean);

    this.sequencer.playFromSounds(assignedSounds);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////

  wireTransportButtons() {
    // Verknüpft Play/Pause Buttons mit Sequencer-Funktionen.
    const playButton = document.querySelector("#blue-btn");
    if (playButton) {
      playButton.dataset.soundToggle = "true";
      playButton.addEventListener("click", () => this.playSequenceBadges());
    }

    const pauseButton = document.querySelector("#green-btn");
    if (pauseButton) {
      pauseButton.dataset.soundToggle = "true";
      pauseButton.addEventListener("click", () => this.sequencer.togglePause());
    }
  }

  wireKeyboardToBadges() {
    // Tastatur verhält sich wie Klick auf entsprechendes Badge.
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

  wireBadgeClickBehavior() {
    // A-H: Slot-Zuweisung + Aktivierung, 1-8: visueller Toggle.
    document.querySelectorAll(".nes-badge").forEach((badge) => {
      badge.addEventListener("click", () => {
        const badgeLabel = badge.querySelector("span");
        if (!badgeLabel) return;

        const label = badgeLabel.textContent.trim().toUpperCase();
        this.assignLastPlayedToSequenceBadge(badge, label);

        const isSequenceBadge =
          label.length === 1 && label >= "A" && label <= "H";
        const hasAssignedSound = Boolean(badge.dataset.assignedSound);

        if (isSequenceBadge && !hasAssignedSound) return;

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

  assignSoundToBadge(buttonSelector, soundSrc) {
    // Verknüpft ein Control-Badge mit einem festen Sound.
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
      // Spiegelt Audiozustand visuell in den Badge/Button-Farben.
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
      // Letzten gespielten Sound merken, damit A-H ihn übernehmen können.
      this.lastPlayed = soundSrc;
      // Rewind auf 0, damit jeder Klick den Sound sauber von vorn startet.
      audio.currentTime = 0;
      // Startet die Wiedergabe; die Visualisierung reagiert ueber die Audio-Events unten.
      audio.play();
    });

    // Buttons werden wieder grün, wenn der Sound fertig abgespielt ist.
    audio.addEventListener("play", () => setToggleState(true));
    audio.addEventListener("pause", () => setToggleState(false));
    audio.addEventListener("ended", () => setToggleState(false));
  }

  initializeSoundMappings() {
    console.log("DrumMachineApp.initializeSoundMappings");
    // Feste Zuordnung der Control-Pads 1-8 zu Samples.
    this.assignSoundToBadge("#badge-9", "sound/TR808/808.wav");
    this.assignSoundToBadge("#badge-10", "sound/TR808/Hihat.wav");
    this.assignSoundToBadge("#badge-11", "sound/TR808/Kick Basic.wav");
    this.assignSoundToBadge("#badge-12", "sound/TR808/Snare Bright.wav");
    this.assignSoundToBadge("#badge-13", "sound/TR808/Cowbell.wav");
    this.assignSoundToBadge("#badge-14", "sound/TR808/Clap.wav");
    this.assignSoundToBadge("#badge-15", "sound/TR808/Open Hat Long.wav");
    this.assignSoundToBadge("#badge-16", "sound/TR808/Tom High.wav");
  }

  initializeUiBindings() {
    console.log("DrumMachineApp.initializeUiBindings");
    // Einmaliges Verdrahten aller UI-Events.
    document.querySelectorAll(".nes-btn").forEach((button) => {
      this.wireButtonColorToggle(button);
    });

    //Play und Pause verbinden:
    this.wireTransportButtons();

    //Tastatur zu den Buttons verbinden:
    this.wireKeyboardToBadges();

    this.wireBadgeClickBehavior();
  }

  initialize() {
    console.log("DrumMachineApp.initialize");
    // Einstiegspunkt: erst UI, dann Sound-Mappings.
    this.initializeUiBindings();
    this.initializeSoundMappings();
  }
}

const app = new DrumMachineApp();
app.initialize();
