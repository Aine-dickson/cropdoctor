import { computed, ref } from 'vue'

declare global {
    interface Window {
        __TAURI__?: unknown
    }
}

const isTauriRef = ref(true)
let resolved = true

export function usePlatform() {
    if (!resolved) {
        resolved = true
        isTauriRef.value = typeof window !== 'undefined' && !!window.__TAURI__
    }

    return {
        isTauri: isTauriRef,
        isBrowser: computed(() => !isTauriRef.value),
    }
}
