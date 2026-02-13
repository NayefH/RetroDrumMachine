// Retro Drum Machine - object oriented
class SequencerEngine {
  constructor({ stepMs, onTransportChange }) {
    // Timing pro Step und Callback für UI-Status (Play/Pause Buttons).
    // Dauer eines Sequencer-Schritts in Millisekunden.
    this.stepMs = stepMs;
    // UI-Callback, um Play/Pause-Status nach außen zu melden.
    this.onTransportChange = onTransportChange;

    // Laufzeitstatus der Sequenz.
    // Alle aktuell laufenden Audio-Instanzen.
    this.activeAudios = new Set();
    // Zuordnung Audio-Instanz
    this.audioHooks = new Map();
    // IDs aller geplanten setTimeout-Aufrufe.
    this.timeouts = [];
    // Noch nicht ausgelöste Steps des aktuellen Durchlaufs.
    this.scheduledSteps = [];
    // Zwischengespeicherte Rest-Steps für Pause/Resume.
    this.pausedSteps = [];
    // Aktuelles Pattern als Liste von Sounds/Step-Einträgen.
    this.currentSequence = [];
    // Steuert, ob das Pattern nach Ende automatisch neu startet.
    this.isLooping = true;
    // true, wenn Sequencer aktiv läuft.
    this.isPlaying = false;
    // true, wenn Sequencer pausiert ist.
    this.isPaused = false;
  }

  emitTransport() {
    console.log("SequencerEngine.emitTransport");
    // Meldet den aktuellen Transportzustand an die UI-Schicht.

    this.onTransportChange({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
    });
  }

  clearScheduledTimeouts() {
    console.log("SequencerEngine.clearScheduledTimeouts");
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
    this.currentSequence = [];

    this.activeAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeAudios.clear();

    this.isPlaying = false;
    this.isPaused = false;
    this.emitTransport();
  }

  scheduleSequenceCycle(startDelayMs = 0) {
    console.log("SequencerEngine.scheduleSequenceCycle");
    // Plant einen kompletten Durchlauf der aktuell geladenen Sequenz.
    // startDelayMs erlaubt, den nächsten Durchlauf exakt auf dem Grid zu starten.
    // Beispiel: Bei stepMs=300 und startDelayMs=300 startet Step 1 erst in 300ms.
    this.currentSequence.forEach((entry, index) => {
      let soundSrc = null;
      let hooks = {};

      if (typeof entry === "string") {
        // Kurzform: Eintrag ist direkt der Dateipfad zum Sound.
        soundSrc = entry;
      } else if (entry && typeof entry === "object") {
        // Langform: Eintrag enthält Sound + optionale Callback-Hooks.
        soundSrc = entry.soundSrc;
        if (entry.hooks) hooks = entry.hooks;
      }

      // Ungültige/Leereinträge werden übersprungen.
      if (!soundSrc) return;
      // Jeder Step wird relativ zum Zyklus-Start geplant.
      this.scheduleStep(soundSrc, startDelayMs + index * this.stepMs, hooks);
    });
  }

  maybeFinish() {
    console.log("SequencerEngine.maybeFinish");
    // Auto-Stop nur, wenn wirklich nichts mehr aktiv/geplant ist.
    if (this.isPaused) return;
    // Im Loop-Modus stoppen wir hier nie.
    // Der nächste Zyklus wird vorher schon in scheduleStep eingeplant.
    if (this.isPlaying && this.isLooping) return;
    // Solange noch Steps geplant sind, darf nicht gestoppt werden.
    if (this.scheduledSteps.length > 0) return;
    // Solange noch Audios laufen, darf nicht gestoppt werden.
    if (this.activeAudios.size > 0) return;
    // Nur wenn nichts mehr läuft/geplant ist: sauber stoppen.
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
  }

  scheduleStep(soundSrc, delayMs, hooks = {}) {
    console.log("SequencerEngine.scheduleStep");
    // Plant einen Sound für die Zukunft und merkt Zielzeit fürs Pausieren.
    // Absolute Zielzeit dieses Steps (wichtig für korrektes Resume).
    const targetTime = performance.now() + delayMs;
    // Metadaten-Objekt für einen geplanten Step.
    const step = { soundSrc, targetTime, hooks };
    // Step wird registriert, damit Pause/Resume und Finish-Checks korrekt sind.
    this.scheduledSteps.push(step);

    const timeoutId = setTimeout(() => {
      // Beim Auslösen wird dieser Timeout/Step aus den Tracking-Listen entfernt.
      this.timeouts = this.timeouts.filter((id) => id !== timeoutId);
      this.scheduledSteps = this.scheduledSteps.filter(
        (candidate) => candidate !== step,
      );

      // Falls zwischenzeitlich gestoppt oder pausiert wurde: nichts mehr abspielen.
      if (!this.isPlaying || this.isPaused) return;
      this.playSound(soundSrc, hooks);

      // Wenn dieser Step der letzte geplante war, den nächsten Zyklus sofort einreihen.
      // So bleibt das Timing rastergenau und es entsteht kein Gap zwischen den Loops.
      if (
        this.isPlaying &&
        !this.isPaused &&
        this.isLooping &&
        this.currentSequence.length > 0 &&
        this.scheduledSteps.length === 0
      ) {
        // Der neue Zyklus startet genau ein Step-Intervall nach dem letzten Trigger.
        this.scheduleSequenceCycle(this.stepMs);
      }

      // Prüft, ob gestoppt werden soll (nur relevant außerhalb des Loop-Modus).
      this.maybeFinish();
    }, delayMs);

    // Timeout-ID merken, damit stop()/pause() geplante Steps abbrechen kann.
    this.timeouts.push(timeoutId);
  }

  playFromSounds(soundList, { loop = true } = {}) {
    console.log("SequencerEngine.playFromSounds");
    // Startet neue Sequenz von vorn und ersetzt eventuell laufende Sequenz.
    // soundList: Belegung der Steps für einen kompletten Durchlauf.
    // loop: aktiviert/deaktiviert automatisches Wiederholen.
    if (!Array.isArray(soundList) || soundList.length === 0) return;

    // Vorherigen Lauf komplett beenden (inkl. geplanter Timeouts/Audios).
    this.stop();
    // Pattern als aktive Sequenz speichern, damit der Loop dieselben Steps nutzt.
    this.currentSequence = [...soundList];
    // Loop standardmäßig aktiv; kann per Option abgeschaltet werden.
    this.isLooping = loop;
    this.isPlaying = true;
    this.emitTransport();
    // Ersten Durchlauf ohne Start-Offset planen.
    this.scheduleSequenceCycle();
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
      if (playPromise) {
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
    // Komfortfunktion für denselben Button: Pause <-> Resume oder so
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
    // Feste Reihenfolge der Sequencer-Slots im UI.
    this.sequenceLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    // Tempo in Beats per Minute.
    this.sequenceBpm = 300;
    // Umrechnung BPM -> Millisekunden pro Step.
    this.stepMs = (60 / this.sequenceBpm) * 1000;
    // Zuletzt manuell gespielter Sound (für Zuweisung auf A-H).
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
    console.log("DrumMachineApp.wireButtonColorToggle");
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
    console.log("DrumMachineApp.setButtonToggleClasses");
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
    console.log("DrumMachineApp.setPlayButtonState");
    this.setButtonToggleClasses(document.querySelector("#blue-btn"), isActive);
  }

  setPauseButtonState(isActive) {
    console.log("DrumMachineApp.setPauseButtonState");
    this.setButtonToggleClasses(document.querySelector("#green-btn"), isActive);
  }

  getBadgeLabel(badge) {
    console.log("DrumMachineApp.getBadgeLabel");
    // Liest sichtbares Label robust fuer .nes-badge (span) und .nes-btn (Text).
    const span = badge.querySelector("span");
    if (span) return span.textContent.trim().toUpperCase();
    return badge.textContent.trim().toUpperCase();
  }

  getSequenceBadges() {
    console.log("DrumMachineApp.getSequenceBadges");
    // Liefert A-H in fixer Reihenfolge für reproduzierbare Sequenzen.
    const allBadges = Array.from(
      document.querySelectorAll(".nes-badge, #badges-container .nes-btn"),
    );

    return this.sequenceLabels
      .map((label) =>
        allBadges.find((badge) => this.getBadgeLabel(badge) === label),
      )
      .filter(Boolean);
  }

  assignLastPlayedToSequenceBadge(badge, label) {
    console.log("DrumMachineApp.assignLastPlayedToSequenceBadge");
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

  /////////////////////////////////////////Initialisierung:

  wireTransportButtons() {
    console.log("DrumMachineApp.wireTransportButtons");
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
    console.log("DrumMachineApp.wireKeyboardToBadges");
    // Tastatur verhält sich wie Klick auf entsprechendes Badge.
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      const match = Array.from(
        document.querySelectorAll(".nes-badge, #badges-container .nes-btn"),
      ).find((badge) => this.getBadgeLabel(badge)?.toLowerCase() === key);

      if (match) {
        match.click();
      }
    });
  }

  wireBadgeClickBehavior() {
    console.log("DrumMachineApp.wireBadgeClickBehavior");
    // A-H: Slot-Zuweisung + Aktivierung, 1-8: visueller Toggle.
    document
      .querySelectorAll(".nes-badge, #badges-container .nes-btn")
      .forEach((badge) => {
        badge.addEventListener("click", () => {
          const badgeLabel = badge.querySelector("span") || badge;
          if (!badgeLabel) return;

          const label = this.getBadgeLabel(badge);
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
    console.log("DrumMachineApp.assignSoundToBadge");
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
