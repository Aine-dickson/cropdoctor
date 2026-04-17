import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { clampMedicineQty, getMedicineStock } from '@/lib/medicineCatalog'

const STORAGE_KEY = 'cropdr.cartState'

interface CartItem {
    id: number | string
    name: string
    price: number
    qty: number
    [key: string]: unknown
}

interface ProductInput {
    id: number | string
    name: string
    price: number
    [key: string]: unknown
}

export const useCartStore = defineStore('cart', () => {
    const items = ref<CartItem[]>(loadPersistedItems())
    const DELIVERY_FEE = 5000

    const count = computed(() => items.value.reduce((sum, item) => sum + item.qty, 0))
    const subtotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.qty, 0))
    const total = computed(() => subtotal.value + DELIVERY_FEE)

    function inCart(id: CartItem['id']) {
        return items.value.some((item) => item.id === id)
    }

    function add(product: ProductInput, qty = 1) {
        const allowedQty = clampMedicineQty(product.id, qty)
        if (allowedQty <= 0) return false
        const existing = items.value.find((item) => item.id === product.id)
        if (existing) {
            existing.qty = clampMedicineQty(product.id, existing.qty + allowedQty)
            return true
        }
        items.value.push({ ...product, qty: allowedQty })
        return true
    }

    function setQty(id: CartItem['id'], qty: number) {
        const item = items.value.find((item) => item.id === id)
        if (item) item.qty = clampMedicineQty(id, qty)
    }

    function increment(id: CartItem['id']) {
        const item = items.value.find((entry) => entry.id === id)
        if (!item) return
        item.qty = clampMedicineQty(id, item.qty + 1)
    }

    function decrement(id: CartItem['id']) {
        const item = items.value.find((item) => item.id === id)
        if (!item) return
        if (item.qty > 1) item.qty -= 1
        else remove(id)
    }

    function availableQty(id: CartItem['id']) {
        return getMedicineStock(id)
    }

    function remove(id: CartItem['id']) {
        items.value = items.value.filter((item) => item.id !== id)
    }

    function clear() {
        items.value = []
    }

    watch(items, () => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
        } catch {
            // Ignore storage failures.
        }
    }, { deep: true })

    return { items, count, subtotal, total, DELIVERY_FEE, inCart, add, setQty, increment, decrement, remove, clear, availableQty }
})

function loadPersistedItems() {
    if (typeof window === 'undefined') return [] as CartItem[]
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return [] as CartItem[]
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return [] as CartItem[]
    }
}