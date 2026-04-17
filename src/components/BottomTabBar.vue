<template>
    <nav class="bottom-bar">
        <button class="tab" :class="{ active: route.path === '/' }" @click="router.push('/')">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="4" stroke="currentColor" stroke-width="1.7" />
                <path d="M4 18a8 8 0 0114 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                <path d="M11 3v2M11 17v2M3 11H1M21 11h-2" stroke="currentColor" stroke-width="1.4"
                    stroke-linecap="round" opacity=".5" />
            </svg>
            <span>Scan</span>
        </button>

        <button class="tab" :class="{ active: route.path === '/search' }" @click="router.push('/search')">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.7" />
                <path d="M15 15l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <span>Search</span>
        </button>

        <button class="tab" :class="{ active: route.path === '/browse' }" @click="router.push('/browse')">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7" />
                <rect x="12" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7" />
                <rect x="2" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7" />
                <rect x="12" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <span>Browse</span>
        </button>

        <button class="tab" :class="{ active: route.path === '/describe' }" @click="router.push('/describe')">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.7" />
                <path d="M7 8h8M7 12h6M7 16h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>Describe</span>
        </button>

        <button class="tab"
            :class="{ active: route.path.startsWith('/account') || route.path === '/login' || route.path === '/signup' }"
            @click="router.push('/account')">
            <template v-if="auth.isLoggedIn">
                <span class="avatar-tab" :class="{ active: isAccountActive }">{{ auth.displayName[0].toUpperCase()
                    }}</span>
            </template>
            <template v-else>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="8" r="4" stroke="currentColor" stroke-width="1.7" />
                    <path d="M3 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" stroke-width="1.7"
                        stroke-linecap="round" />
                </svg>
            </template>
            <span>Account</span>
        </button>
    </nav>
</template>

<script setup>
    import { computed } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import { useAuthStore } from '@/stores/auth'

    const route = useRoute()
    const router = useRouter()
    const auth = useAuthStore()

    const isAccountActive = computed(() => route.path.startsWith('/account') || route.path === '/login' || route.path === '/signup')
</script>

<style scoped>
    .bottom-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 200;
        display: flex;
        background: var(--surface);
        border-top: 1px solid var(--border);
        padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 10px 4px 8px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--muted);
        font-family: 'Sora', sans-serif;
        font-size: 10px;
        font-weight: 500;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: color 0.15s;
    }

    .tab.active {
        color: var(--accent);
    }

    .tab:active {
        color: var(--accent);
    }

    .avatar-tab {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #b7bcc3;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .avatar-tab.active {
        background: var(--accent);
    }
</style>
