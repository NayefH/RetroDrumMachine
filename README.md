# Retro Drum Machine

## Architektur (JavaScript)

Die Laufzeitlogik liegt in einer Datei: `js/app.js`.

Reihenfolge im Code:
1. State und Konstanten
2. UI-Helper
3. Transport-State (Play/Pause)
4. Sequencer-Engine
5. UI-Event-Wiring
6. Sound-Mapping (Pads 1-8)

## Event-Flow

### 1) Sound auswaehlen und Sequenz belegen
1. Klick auf Pad `1-8` spielt den jeweiligen Sound ab.
2. Dieser Sound wird als `lastPlayed` gespeichert.
3. Klick auf Sequenz-Badge `A-H` weist `lastPlayed` dem Badge zu (`data-assigned-sound`).

### 2) Sequenz starten
1. Klick auf `PLAY` sammelt alle zugewiesenen Sounds von `A-H` in fester Reihenfolge.
2. Steps werden im BPM-Raster geplant (`STEP_MS`).
3. Beim aktiven Playback wird der Play-Button-Status visuell gesetzt.

### 3) Sequenz pausieren und fortsetzen
1. Klick auf `PAUSE` waehrend Playback:
   - stoppt geplante Timeouts,
   - pausiert laufende Audio-Instanzen,
   - merkt verbleibende Delay-Zeiten.
2. Im Pause-Zustand wird der Pause-Button aktiv eingefaerbt.
3. Nochmal `PAUSE` setzt Playback fort:
   - pausierte Audios laufen weiter,
   - ausstehende Steps werden mit Restzeit neu geplant.

### 4) Sequenzende
1. Wenn keine geplanten Steps und keine aktiven Audios mehr vorhanden sind, wird Playback beendet.
2. Play- und Pause-Button werden auf inaktiv zurueckgesetzt.

## Wichtige Funktionen

- `playSequenceBadges()`
  Startet Sequenz-Playback aus den A-H Zuordnungen.
- `toggleSequencePause()`
  Wechselt zwischen Pause und Resume.
- `assignSoundToBadge(selector, soundSrc)`
  Verknuepft Pads `1-8` mit Audio und UI-State.
- `initializeUiBindings()`
  Registriert globale Button-, Keyboard- und Badge-Events.
- `initializeSoundMappings()`
  Legt Sounddateien fuer Pads `1-8` fest.

## Web-Referenzen (im Code kommentiert)

- `EventTarget.addEventListener`
  https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
- `HTMLElement.dataset`
  https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
- `Element.classList`
  https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
- `HTMLMediaElement.play()`
  https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
- `KeyboardEvent.key`
  https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
- `Performance.now()`
  https://developer.mozilla.org/docs/Web/API/Performance/now
