import { ref } from 'vue'
import type { Router } from 'vue-router'

const STORAGE_KEY = 'cropdr.navigationHistory'
const MAX_ENTRIES = 25

const stack = ref<string[]>(loadStack())

function loadStack() {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as unknown) : []
        return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
    } catch {
        return []
    }
}

function persistStack() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stack.value.slice(-MAX_ENTRIES)))
    } catch {
        // Ignore storage failures.
    }
}

export function recordNavigation(path: string) {
    if (!path) return
    const last = stack.value[stack.value.length - 1]
    if (last === path) return
    stack.value.push(path)
    if (stack.value.length > MAX_ENTRIES) stack.value = stack.value.slice(-MAX_ENTRIES)
    persistStack()
}

export function clearNavigationHistory() {
    stack.value = []
    persistStack()
}

export function canGoBack() {
    return stack.value.length > 1
}

export async function goBack(router: Router) {
    if (stack.value.length > 1) {
        stack.value.pop()
        const target = stack.value[stack.value.length - 1] || '/'
        persistStack()
        await router.push(target)
        return true
    }

    await router.push('/')
    return false
}
