// Retro Drum Machine - object oriented runtime

class SequencerEngine {
  constructor({ stepMs, onTransportChange }) {
    this.stepMs = stepMs;
    this.onTransportChange = onTransportChange;

    this.activeAudios = new Set();
    this.timeouts = [];
    this.scheduledSteps = [];
    this.pausedSteps = [];
    this.isPlaying = false;
    this.isPaused = false;
  }

  emitTransport() {
    if (typeof this.onTransportChange === "function") {
      this.onTransportChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
      });
    }
  }

  clearScheduledTimeouts() {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    this.scheduledSteps = [];
  }

  stop() {
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
    if (this.isPaused) return;
    if (this.scheduledSteps.length > 0) return;
    if (this.activeAudios.size > 0) return;
    this.stop();
  }

  playSound(soundSrc) {
    const audio = new Audio(soundSrc);

    const cleanup = () => {
      this.activeAudios.delete(audio);
      this.maybeFinish();
    };

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    audio.addEventListener("pause", () => {
      if (!this.isPaused) cleanup();
    });

    this.activeAudios.add(audio);
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => cleanup());
    }
  }

  scheduleStep(soundSrc, delayMs) {
    const targetTime = performance.now() + delayMs;
    const step = { soundSrc, targetTime };
    this.scheduledSteps.push(step);

    const timeoutId = setTimeout(() => {
      this.timeouts = this.timeouts.filter((id) => id !== timeoutId);
      this.scheduledSteps = this.scheduledSteps.filter(
        (candidate) => candidate !== step,
      );

      if (!this.isPlaying || this.isPaused) return;
      this.playSound(soundSrc);
      this.maybeFinish();
    }, delayMs);

    this.timeouts.push(timeoutId);
  }

  playFromSounds(soundList) {
    if (!Array.isArray(soundList) || soundList.length === 0) return;

    this.stop();
    this.isPlaying = true;
    this.emitTransport();

    soundList.forEach((soundSrc, index) => {
      this.scheduleStep(soundSrc, index * this.stepMs);
    });
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.isPlaying = false;
    this.isPaused = true;

    const now = performance.now();
    this.pausedSteps = this.scheduledSteps.map((step) => ({
      soundSrc: step.soundSrc,
      delayMs: Math.max(0, step.targetTime - now),
    }));

    this.clearScheduledTimeouts();
    this.activeAudios.forEach((audio) => audio.pause());
    this.emitTransport();
  }

  resume() {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.isPlaying = true;

    this.activeAudios.forEach((audio) => {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.activeAudios.delete(audio);
          this.maybeFinish();
        });
      }
    });

    this.pausedSteps.forEach((step) => {
      this.scheduleStep(step.soundSrc, step.delayMs);
    });
    this.pausedSteps = [];

    this.emitTransport();
    this.maybeFinish();
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
      return;
    }

    this.pause();
  }
}

class DrumMachineApp {
  constructor() {
    this.sequenceLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    this.sequenceBpm = 130;
    this.stepMs = (60 / this.sequenceBpm) * 1000;
    this.lastPlayed = null;

    this.sequencer = new SequencerEngine({
      stepMs: this.stepMs,
      onTransportChange: ({ isPlaying, isPaused }) => {
        this.setPlayButtonState(isPlaying);
        this.setPauseButtonState(isPaused);
      },
    });
  }

  wireButtonColorToggle(button) {
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
  }

  setButtonToggleClasses(button, isActive) {
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
    const span = badge.querySelector("span");
    if (!span) return null;
    return span.textContent.trim().toUpperCase();
  }

  getSequenceBadges() {
    const allBadges = Array.from(document.querySelectorAll(".nes-badge"));

    return this.sequenceLabels
      .map((label) =>
        allBadges.find((badge) => this.getBadgeLabel(badge) === label),
      )
      .filter(Boolean);
  }

  assignLastPlayedToSequenceBadge(badge, label) {
    if (this.sequenceLabels.includes(label) && this.lastPlayed) {
      badge.dataset.assignedSound = this.lastPlayed;
    }
  }

  playSequenceBadges() {
    const assignedSounds = this.getSequenceBadges()
      .map((badge) => badge.dataset.assignedSound)
      .filter(Boolean);

    this.sequencer.playFromSounds(assignedSounds);
  }

  wireTransportButtons() {
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
      this.lastPlayed = soundSrc;
      audio.currentTime = 0;
      audio.play();
    });

    audio.addEventListener("play", () => setToggleState(true));
    audio.addEventListener("pause", () => setToggleState(false));
    audio.addEventListener("ended", () => setToggleState(false));
  }

  initializeSoundMappings() {
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
    document.querySelectorAll(".nes-btn").forEach((button) => {
      this.wireButtonColorToggle(button);
    });
    this.wireTransportButtons();
    this.wireKeyboardToBadges();
    this.wireBadgeClickBehavior();
  }

  initialize() {
    this.initializeUiBindings();
    this.initializeSoundMappings();
  }
}

const app = new DrumMachineApp();
app.initialize();
