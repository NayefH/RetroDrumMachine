class SequencerEngine {
  constructor({ stepMs, onTransportChange }) {
    this.stepMs = stepMs;
    this.onTransportChange = onTransportChange;
    this.activeAudios = new Set();
    this.audioHooks = new Map();
    this.timeouts = [];
    this.scheduledSteps = [];
    this.pausedSteps = [];
    this.currentSequence = [];
    this.isLooping = true;
    this.isPlaying = false;
    this.isPaused = false;
  }

  setStepMs(stepMs) {
    if (Number.isFinite(stepMs) && stepMs > 0) {
      this.stepMs = stepMs;
    }
  }

  emitTransport() {
    this.onTransportChange({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
    });
  }

  clearScheduledTimeouts() {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts = [];
    this.scheduledSteps = [];
  }

  stop() {
    this.clearScheduledTimeouts();
    this.pausedSteps = [];
    this.currentSequence = [];

    this.activeAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeAudios.clear();
    this.audioHooks.clear();

    this.isPlaying = false;
    this.isPaused = false;
    this.emitTransport();
  }

  scheduleSequenceCycle(startDelayMs = 0) {
    this.currentSequence.forEach((entry, index) => {
      let soundSrc = null;
      let hooks = {};

      if (typeof entry === "string") {
        soundSrc = entry;
      } else if (entry && typeof entry === "object") {
        soundSrc = entry.soundSrc || null;
        hooks = entry.hooks || {};
      }

      if (!soundSrc) return;
      this.scheduleStep(soundSrc, startDelayMs + index * this.stepMs, hooks);
    });
  }

  maybeFinish() {
    if (this.isPaused) return;
    if (this.isPlaying && this.isLooping) return;
    if (this.scheduledSteps.length > 0) return;
    if (this.activeAudios.size > 0) return;
    this.stop();
  }

  playSound(soundSrc, hooks = {}) {
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
    audio.play();
  }

  scheduleStep(soundSrc, delayMs, hooks = {}) {
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

      if (
        this.isPlaying &&
        !this.isPaused &&
        this.isLooping &&
        this.currentSequence.length > 0 &&
        this.scheduledSteps.length === 0
      ) {
        this.scheduleSequenceCycle(this.stepMs);
      }

      this.maybeFinish();
    }, delayMs);

    this.timeouts.push(timeoutId);
  }

  playFromSounds(soundList, { loop = true } = {}) {
    if (!Array.isArray(soundList) || soundList.length === 0) return;
    const hasPlayableStep = soundList.some((entry) =>
      typeof entry === "string" ? Boolean(entry) : Boolean(entry?.soundSrc),
    );
    if (!hasPlayableStep) return;

    this.stop();
    this.currentSequence = [...soundList];
    this.isLooping = loop;
    this.isPlaying = true;
    this.emitTransport();
    this.scheduleSequenceCycle();
  }

  pause() {
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
    if (!this.isPaused) return;

    this.isPaused = false;
    this.isPlaying = true;

    this.activeAudios.forEach((audio) => {
      const hooks = this.audioHooks.get(audio);
      if (hooks && typeof hooks.onResume === "function") hooks.onResume();
      audio.play().catch(() => {
        this.activeAudios.delete(audio);
        this.audioHooks.delete(audio);
        this.maybeFinish();
      });
    });

    this.pausedSteps.forEach((step) => {
      this.scheduleStep(step.soundSrc, step.delayMs, step.hooks || {});
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
    this.sequenceBpm = 120;
    this.stepMs = (60 / this.sequenceBpm) * 1000;
    this.lastPlayed = null;
    this.savedPatterns = new Map();
    this.songQueue = [];
    this.examplePattern = [
      "sound/TR808/Kick Basic.wav",
      "sound/TR808/Hihat.wav",
      "sound/TR808/Snare Bright.wav",
      "sound/TR808/Hihat.wav",
      "sound/TR808/Kick Basic.wav",
      "sound/TR808/Clap.wav",
      "sound/TR808/Open Hat Long.wav",
      "sound/TR808/Snare Bright.wav",
    ];

    this.sequencer = new SequencerEngine({
      stepMs: this.stepMs,
      onTransportChange: ({ isPlaying, isPaused }) => {
        this.setPlayButtonState(isPlaying);
        this.setPauseButtonState(isPaused);
      },
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
    if (span) return span.textContent.trim().toUpperCase();
    return badge.textContent.trim().toUpperCase();
  }

  getSequenceBadges() {
    const allBadges = Array.from(
      document.querySelectorAll(".nes-badge, #badges-container .nes-btn"),
    );

    return this.sequenceLabels
      .map((label) =>
        allBadges.find((badge) => this.getBadgeLabel(badge) === label),
      )
      .filter(Boolean);
  }

  setSequenceBadgeState(badge, hasAssignedSound) {
    const target = badge.querySelector("span") || badge;
    target.classList.toggle("is-primary", !hasAssignedSound);
    target.classList.toggle("is-warning", hasAssignedSound);
  }

  createEmptyPattern() {
    return Array(this.sequenceLabels.length).fill(null);
  }

  readCurrentPatternFromUi() {
    return this.getSequenceBadges().map((badge) => badge.dataset.assignedSound || null);
  }

  applyPatternToUi(patternSteps) {
    const normalized = Array.isArray(patternSteps)
      ? patternSteps.slice(0, this.sequenceLabels.length)
      : this.createEmptyPattern();

    while (normalized.length < this.sequenceLabels.length) {
      normalized.push(null);
    }

    this.getSequenceBadges().forEach((badge, index) => {
      const sound = normalized[index];
      if (sound) {
        badge.dataset.assignedSound = sound;
      } else {
        delete badge.dataset.assignedSound;
      }
      this.setSequenceBadgeState(badge, Boolean(sound));
    });
  }

  getSelectedPatternId() {
    const select = document.querySelector("#pattern-select");
    return select ? select.value : "pattern-1";
  }

  ensurePatternExists(patternId) {
    if (!this.savedPatterns.has(patternId)) {
      this.savedPatterns.set(patternId, this.createEmptyPattern());
    }
  }

  saveSelectedPattern() {
    const patternId = this.getSelectedPatternId();
    this.savedPatterns.set(patternId, this.readCurrentPatternFromUi());
    this.updateSongOrderLabel();
  }

  applyExamplePattern() {
    const example = [...this.examplePattern];
    this.applyPatternToUi(example);
    const patternId = this.getSelectedPatternId();
    this.savedPatterns.set(patternId, example);
    this.updateSongOrderLabel();
  }

  loadSelectedPattern() {
    const patternId = this.getSelectedPatternId();
    this.ensurePatternExists(patternId);
    this.applyPatternToUi(this.savedPatterns.get(patternId));
  }

  queueSelectedPattern() {
    const patternId = this.getSelectedPatternId();
    this.ensurePatternExists(patternId);
    const pattern = this.savedPatterns.get(patternId) || [];
    const hasSound = pattern.some(Boolean);
    if (!hasSound) return;

    this.songQueue.push(patternId);
    this.updateSongOrderLabel();
  }

  clearSongQueue() {
    this.songQueue = [];
    this.updateSongOrderLabel();
  }

  updateSongOrderLabel() {
    const label = document.querySelector("#song-order-label");
    if (!label) return;

    if (this.songQueue.length === 0) {
      label.textContent = "Songfolge: leer";
      return;
    }

    const displayNames = this.songQueue.map((patternId) =>
      patternId.replace("pattern-", "P"),
    );
    label.textContent = `Songfolge: ${displayNames.join(" -> ")}`;
  }

  buildPlaybackSequence() {
    if (this.songQueue.length === 0) return this.readCurrentPatternFromUi();

    return this.songQueue.flatMap((patternId) => {
      this.ensurePatternExists(patternId);
      return this.savedPatterns.get(patternId) || this.createEmptyPattern();
    });
  }

  playConfiguredSong() {
    const sequence = this.buildPlaybackSequence();
    const hasSound = sequence.some(Boolean);
    if (!hasSound) return;

    this.sequencer.playFromSounds(sequence, { loop: true });
  }

  assignLastPlayedToSequenceBadge(badge, label) {
    if (this.sequenceLabels.includes(label) && this.lastPlayed) {
      badge.dataset.assignedSound = this.lastPlayed;
      this.setSequenceBadgeState(badge, true);
    }
  }

  wireTransportButtons() {
    const playButton = document.querySelector("#blue-btn");
    if (playButton) {
      playButton.addEventListener("click", () => this.playConfiguredSong());
    }

    const pauseButton = document.querySelector("#green-btn");
    if (pauseButton) {
      pauseButton.addEventListener("click", () => this.sequencer.togglePause());
    }
  }

  wireKeyboardToBadges() {
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      const match = Array.from(
        document.querySelectorAll(".nes-badge, #badges-container .nes-btn"),
      ).find((badge) => this.getBadgeLabel(badge)?.toLowerCase() === key);

      if (match) match.click();
    });
  }

  wireBadgeClickBehavior() {
    document
      .querySelectorAll(".nes-badge, #badges-container .nes-btn")
      .forEach((badge) => {
        badge.addEventListener("click", () => {
          if (badge.dataset.uiControl === "true") return;

          const badgeLabel = badge.querySelector("span") || badge;
          if (!badgeLabel) return;

          const label = this.getBadgeLabel(badge);
          this.assignLastPlayedToSequenceBadge(badge, label);

          const isSequenceBadge =
            label.length === 1 && label >= "A" && label <= "H";
          const hasAssignedSound = Boolean(badge.dataset.assignedSound);

          if (isSequenceBadge && !hasAssignedSound) return;
          if (isSequenceBadge) {
            this.setSequenceBadgeState(badge, true);
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

  setBpmFromInput() {
    const input = document.querySelector("#bpm-input");
    if (!input) return;

    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed)) return;
    const bpm = Math.max(40, Math.min(300, parsed));
    this.sequenceBpm = bpm;
    this.stepMs = (60 / this.sequenceBpm) * 1000;
    this.sequencer.setStepMs(this.stepMs);
    input.value = String(bpm);
  }

  wirePatternControls() {
    const saveBtn = document.querySelector("#save-pattern-btn");
    const loadBtn = document.querySelector("#load-pattern-btn");
    const exampleBtn = document.querySelector("#example-pattern-btn");
    const queueBtn = document.querySelector("#queue-pattern-btn");
    const clearBtn = document.querySelector("#clear-song-btn");

    if (saveBtn) saveBtn.addEventListener("click", () => this.saveSelectedPattern());
    if (loadBtn) loadBtn.addEventListener("click", () => this.loadSelectedPattern());
    if (exampleBtn) exampleBtn.addEventListener("click", () => this.applyExamplePattern());
    if (queueBtn) queueBtn.addEventListener("click", () => this.queueSelectedPattern());
    if (clearBtn) clearBtn.addEventListener("click", () => this.clearSongQueue());
  }

  wireBpmControl() {
    const applyBtn = document.querySelector("#apply-bpm-btn");
    const bpmInput = document.querySelector("#bpm-input");

    if (applyBtn) {
      applyBtn.addEventListener("click", () => this.setBpmFromInput());
    }

    if (bpmInput) {
      bpmInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        this.setBpmFromInput();
      });
    }
  }

  initializeDefaultPatterns() {
    const select = document.querySelector("#pattern-select");
    if (!select) return;

    Array.from(select.options).forEach((option) => {
      this.savedPatterns.set(option.value, this.createEmptyPattern());
    });
  }

  initializeUiBindings() {
    this.wireTransportButtons();
    this.wireKeyboardToBadges();
    this.wireBadgeClickBehavior();
    this.wirePatternControls();
    this.wireBpmControl();
  }

  initialize() {
    this.initializeDefaultPatterns();
    this.initializeUiBindings();
    this.initializeSoundMappings();
    this.updateSongOrderLabel();
    this.sequencer.setStepMs(this.stepMs);
  }
}

const app = new DrumMachineApp();
app.initialize();
