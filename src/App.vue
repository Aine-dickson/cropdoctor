<template>
    <router-view />
</template>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

    /* ── Reset ── */
    *,
    *::before,
    *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    /* ── Tokens ── */
    :root {
        --bg: #f7f5ef;
        --surface: #ffffff;
        --surface2: #f0ede5;
        --border: #e2ddd4;
        --accent: #2d7a3a;
        --accent-lt: #e8f5ea;
        --accent-md: #4a9e57;
        --text: #1a1f1b;
        --muted: #6b7a6d;
        --danger: #c0392b;
        --warn: #e67e22;
    }

    html,
    body {
        font-family: 'Sora', sans-serif;
        background: var(--bg);
        color: var(--text);
        -webkit-font-smoothing: antialiased;
    }

    /* ── Global buttons (outlined by default, filled on active) ── */
    .btn-primary {
        width: 100%;
        padding: 17px;
        border-radius: 14px;
        background: transparent;
        color: var(--accent);
        border: 2px solid var(--accent);
        font-family: 'Sora', sans-serif;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: 0.01em;
        transition: background 0.15s, color 0.15s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }

    .btn-primary:active,
    .btn-primary.active {
        background: var(--accent);
        color: #fff;
    }

    .btn-primary:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .btn-secondary {
        width: 100%;
        padding: 15px;
        border-radius: 14px;
        background: transparent;
        color: var(--muted);
        border: 2px solid var(--border);
        font-family: 'Sora', sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }

    .btn-secondary:active {
        border-color: var(--accent);
        color: var(--accent);
    }

    .btn-secondary:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    /* ── Loading dots ── */
    .dots {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }

    .dots span {
        width: 7px;
        height: 7px;
        background: currentColor;
        border-radius: 50%;
        animation: dot-bounce 1s infinite;
    }

    .dots span:nth-child(2) {
        animation-delay: 0.15s;
    }

    .dots span:nth-child(3) {
        animation-delay: 0.30s;
    }

    @keyframes dot-bounce {

        0%,
        80%,
        100% {
            transform: translateY(0);
            opacity: 0.4;
        }

        40% {
            transform: translateY(-5px);
            opacity: 1;
        }
    }

    /* ── Fade transition ── */
    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.2s;
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }
</style>
