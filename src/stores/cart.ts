import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
    const items = ref<CartItem[]>([])
    const DELIVERY_FEE = 5000

    const count = computed(() => items.value.reduce((sum, item) => sum + item.qty, 0))
    const subtotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.qty, 0))
    const total = computed(() => subtotal.value + DELIVERY_FEE)

    function inCart(id: CartItem['id']) {
        return items.value.some((item) => item.id === id)
    }

    function add(product: ProductInput, qty = 1) {
        const existing = items.value.find((item) => item.id === product.id)
        if (existing) existing.qty += qty
        else items.value.push({ ...product, qty })
    }

    function setQty(id: CartItem['id'], qty: number) {
        const item = items.value.find((entry) => entry.id === id)
        if (item) item.qty = qty
    }

    function decrement(id: CartItem['id']) {
        const item = items.value.find((entry) => entry.id === id)
        if (!item) return
        if (item.qty > 1) item.qty -= 1
        else remove(id)
    }

    function remove(id: CartItem['id']) {
        items.value = items.value.filter((item) => item.id !== id)
    }

    function clear() {
        items.value = []
    }

    return { items, count, subtotal, total, DELIVERY_FEE, inCart, add, setQty, decrement, remove, clear }
})