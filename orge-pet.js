// ===========================================
// --- OrgePet: tiny interactive mascot ---
// Lightweight Among Us-style pet in a corner.
// Assets: orge-pet/orge.svg, orge-squish.svg,
//         orge-pet.svg, orge-talk.svg,
//         orge-disabled.svg
// ===========================================

(function () {
    const INTERACTIONS_KEY = 'orgeyt-orgepet-interactions';
    const ENABLED_KEY = 'orgeyt-orgepet-enabled';
    const ASSET_BASE = 'orge-pet/';
    const ASSETS = {
        idle: ASSET_BASE + 'orge.svg',
        squish: ASSET_BASE + 'orge-squish.svg',
        pet: ASSET_BASE + 'orge-pet.svg',
        talk: ASSET_BASE + 'orge-talk.svg',
        disabled: ASSET_BASE + 'orge-disabled.svg'
    };

    const TALK_LINES = [
        (name) => `"${name}" it is then!`,
        (name) => `"${name}", eh? Nice one!`,
        (name) => `Let's try "${name}"!`,
        (name) => `Ooh, "${name}" — good pick!`,
        (name) => `"${name}"? Let's go!`,
        (name) => `Time for "${name}"!`
    ];

    const GREET_LINES = [
        'Hey! Welcome back!',
        'Yo! Good to see you!',
        'Hi there!',
        "What's up?",
        'Ready to browse?',
        'Orge reporting for duty!',
        'Missed you!',
        "Let's find a project!"
    ];

    const FAREWELL_LINES = [
        'But why???',
        'Nooooo!!',
        'What did i do wrong??',
        'Goodbye world...',
        "Its been fun...",
        'You EVIL!',
        'Welp, my time is up.',
        'AAUGH!',
        'Peace out.',
        "Im cooked, right?"
    ];

    let interactions = parseInt(localStorage.getItem(INTERACTIONS_KEY) || '0', 10) || 0;
    // Default ON unless explicitly set to 'false'
    let enabled = localStorage.getItem(ENABLED_KEY) !== 'false';
    let isPointerDown = false;
    let isPetting = false;
    let petMoveCount = 0;
    let lastPetInteractionAt = 0;
    let stateTimer = null;
    let speechTimer = null;
    let currentState = 'idle';
    let greatedThisSession = false;
    let isDisappearing = false;

    let rootEl = null;
    let imgEl = null;
    let speechEl = null;
    let counterEl = null;

    function saveInteractions() {
        try {
            localStorage.setItem(INTERACTIONS_KEY, String(interactions));
        } catch (_) {}
    }

    function saveEnabled() {
        try {
            localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
        } catch (_) {}
    }

    function bumpInteractions() {
        if (!enabled) return;
        interactions++;
        saveInteractions();
        updateCounterDisplay();
    }

    function updateCounterDisplay() {
        if (counterEl) {
            counterEl.textContent = 'Interactions: ' + interactions;
        }
    }

    function updateToggleButton() {
        const label = document.getElementById('orge-pet-toggle-label');
        const btn = document.getElementById('orge-pet-toggle-btn');
        if (label) {
            label.textContent = enabled ? 'Orge Pet: On' : 'Orge Pet: Off';
        }
        if (btn) {
            btn.classList.toggle('orge-pet-toggle-off', !enabled);
            btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
    }

    function clearStateTimer() {
        if (stateTimer) {
            clearTimeout(stateTimer);
            stateTimer = null;
        }
    }

    function setVisualState(state, durationMs) {
        if (!imgEl || isDisappearing) return;
        currentState = state;
        const src = ASSETS[state] || ASSETS.idle;
        if (imgEl.getAttribute('src') !== src) {
            imgEl.setAttribute('src', src);
        }
        imgEl.classList.remove('orge-pet-squish-anim', 'orge-pet-petting-anim', 'orge-pet-talk-anim', 'orge-pet-disabled-pose');
        if (state === 'squish') imgEl.classList.add('orge-pet-squish-anim');
        if (state === 'pet') imgEl.classList.add('orge-pet-petting-anim');
        if (state === 'talk') imgEl.classList.add('orge-pet-talk-anim');
        if (state === 'disabled') imgEl.classList.add('orge-pet-disabled-pose');

        clearStateTimer();
        if (durationMs && durationMs > 0) {
            stateTimer = setTimeout(() => {
                if (!isPetting && enabled && !isDisappearing) {
                    setVisualState('idle', 0);
                }
            }, durationMs);
        }
    }

    function showSpeech(text, durationMs) {
        if (!speechEl) return;
        speechEl.textContent = text;
        speechEl.classList.add('show');
        if (speechTimer) clearTimeout(speechTimer);
        speechTimer = setTimeout(() => {
            speechEl.classList.remove('show');
        }, durationMs || 2800);
    }

    function onPointerDown(e) {
        if (!enabled || isDisappearing) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        isPointerDown = true;
        isPetting = false;
        petMoveCount = 0;
        setVisualState('squish', 0);
    }

    function onPointerMove(e) {
        if (!enabled || !isPointerDown || isDisappearing) return;
        petMoveCount++;
        if (petMoveCount >= 3) {
            if (!isPetting) {
                isPetting = true;
                setVisualState('pet', 0);
                const now = Date.now();
                if (now - lastPetInteractionAt > 1200) {
                    lastPetInteractionAt = now;
                    bumpInteractions();
                }
            }
        }
    }

    function onPointerUp(e) {
        if (!enabled || !isPointerDown || isDisappearing) return;
        e.preventDefault();
        e.stopPropagation();
        const wasPetting = isPetting;
        isPointerDown = false;
        isPetting = false;
        petMoveCount = 0;

        if (wasPetting) {
            setVisualState('idle', 0);
        } else {
            bumpInteractions();
            setVisualState('squish', 350);
            setTimeout(() => {
                if (currentState === 'squish' && enabled) setVisualState('idle', 0);
            }, 350);
        }
    }

    function onPointerLeave() {
        if (!isPointerDown) return;
        isPointerDown = false;
        isPetting = false;
        petMoveCount = 0;
        if (enabled && !isDisappearing) setVisualState('idle', 0);
    }

    /** Called when a project is opened/selected. */
    function onProjectSelected(projectName) {
        if (!enabled || isDisappearing || !projectName) return;
        const name = String(projectName);
        const lineFn = TALK_LINES[Math.floor(Math.random() * TALK_LINES.length)];
        const text = lineFn(name);
        setVisualState('talk', 2600);
        showSpeech(text, 2800);
    }

    function greetOnVisit() {
        if (!enabled || greatedThisSession || isDisappearing) return;
        greatedThisSession = true;
        setTimeout(() => {
            if (!enabled || isDisappearing) return;
            const line = GREET_LINES[Math.floor(Math.random() * GREET_LINES.length)];
            setVisualState('talk', 3000);
            showSpeech(line, 3200);
        }, 900);
    }

    function hidePetImmediately() {
        if (!rootEl) return;
        rootEl.classList.add('orge-pet-hidden');
        rootEl.setAttribute('aria-hidden', 'true');
        if (speechEl) speechEl.classList.remove('show');
    }

    function showPetImmediately() {
        if (!rootEl) return;
        rootEl.classList.remove('orge-pet-hidden', 'orge-pet-fading-out');
        rootEl.setAttribute('aria-hidden', 'false');
        isDisappearing = false;
        setVisualState('idle', 0);
    }

    function disableWithFarewell() {
        if (isDisappearing) return;
        isDisappearing = true;
        isPointerDown = false;
        isPetting = false;
        clearStateTimer();

        const line = FAREWELL_LINES[Math.floor(Math.random() * FAREWELL_LINES.length)];
        // Force disabled sprite even while isDisappearing
        if (imgEl) {
            imgEl.setAttribute('src', ASSETS.disabled);
            imgEl.classList.remove('orge-pet-squish-anim', 'orge-pet-petting-anim', 'orge-pet-talk-anim');
            imgEl.classList.add('orge-pet-disabled-pose');
        }
        showSpeech(line, 2200);

        if (rootEl) {
            rootEl.classList.add('orge-pet-fading-out');
        }

        setTimeout(() => {
            hidePetImmediately();
            isDisappearing = false;
            if (rootEl) rootEl.classList.remove('orge-pet-fading-out');
        }, 2400);
    }

    function setEnabled(next) {
        const was = enabled;
        enabled = !!next;
        saveEnabled();
        updateToggleButton();

        if (enabled && !was) {
            showPetImmediately();
            setTimeout(() => {
                if (!enabled) return;
                setVisualState('talk', 2500);
                showSpeech("I'm back!", 2600);
            }, 200);
        } else if (!enabled && was) {
            disableWithFarewell();
        }
    }

    function toggleEnabled() {
        setEnabled(!enabled);
    }

    function buildDOM() {
        if (document.getElementById('orge-pet-root')) return;

        rootEl = document.createElement('div');
        rootEl.id = 'orge-pet-root';
        rootEl.className = 'orge-pet-root';
        rootEl.setAttribute('aria-label', 'Orge the mascot');
        rootEl.title = 'Click to squish · Hold & move to pet';

        speechEl = document.createElement('div');
        speechEl.className = 'orge-pet-speech';
        speechEl.setAttribute('aria-live', 'polite');

        imgEl = document.createElement('img');
        imgEl.className = 'orge-pet-img';
        imgEl.src = ASSETS.idle;
        imgEl.alt = 'Orge';
        imgEl.draggable = false;

        counterEl = document.createElement('div');
        counterEl.className = 'orge-pet-counter';
        counterEl.textContent = 'Interactions: ' + interactions;

        rootEl.appendChild(speechEl);
        rootEl.appendChild(imgEl);
        rootEl.appendChild(counterEl);
        document.body.appendChild(rootEl);

        rootEl.addEventListener('mousedown', onPointerDown);
        rootEl.addEventListener('mousemove', onPointerMove);
        rootEl.addEventListener('mouseup', onPointerUp);
        rootEl.addEventListener('mouseleave', onPointerLeave);

        rootEl.addEventListener('touchstart', (e) => {
            if (e.touches.length) onPointerDown(e);
        }, { passive: false });
        rootEl.addEventListener('touchmove', (e) => {
            if (isPointerDown) {
                e.preventDefault();
                onPointerMove(e);
            }
        }, { passive: false });
        rootEl.addEventListener('touchend', onPointerUp);
        rootEl.addEventListener('touchcancel', onPointerLeave);

        imgEl.addEventListener('dragstart', (e) => e.preventDefault());

        if (!enabled) {
            hidePetImmediately();
        }
    }

    function bindToggleButton() {
        const btn = document.getElementById('orge-pet-toggle-btn');
        if (!btn || btn.dataset.orgeBound === '1') return;
        btn.dataset.orgeBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleEnabled();
        });
        updateToggleButton();
    }

    function init() {
        buildDOM();
        updateCounterDisplay();
        bindToggleButton();
        setTimeout(bindToggleButton, 0);
        setTimeout(bindToggleButton, 500);

        window.OrgePet = {
            onProjectSelected,
            getInteractions: () => interactions,
            bumpInteractions,
            isEnabled: () => enabled,
            setEnabled,
            toggleEnabled,
            greetOnVisit
        };

        if (enabled) {
            greetOnVisit();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
