import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

type Product = {
    id: number
    name: string
    price: number
    [key: string]: unknown
}

type CartItem = Product & {
    qty: number
}

export const useCartStore = defineStore('cart', () => {
    const items = ref<CartItem[]>([])
    const DELIVERY_FEE = 5000

    const count = computed(() => items.value.reduce((s, i) => s + i.qty, 0))
    const subtotal = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0))
    const total = computed(() => subtotal.value + DELIVERY_FEE)

    function inCart(id: number | string) { return items.value.some(i => i.id === Number(id)) }

    function add(product: Product, qty = 1) {
        const existing = items.value.find(i => i.id === product.id)
        if (existing) existing.qty += qty
        else items.value.push({ ...product, qty })
    }

    function setQty(id: number | string, qty: number) {
        const item = items.value.find(i => i.id === Number(id))
        if (item) item.qty = qty
    }

    function decrement(id: number | string) {
        const item = items.value.find(i => i.id === Number(id))
        if (!item) return
        if (item.qty > 1) item.qty--
        else remove(id)
    }

    function remove(id: number | string) {
        items.value = items.value.filter(i => i.id !== Number(id))
    }

    function clear() { items.value = [] }

    return { items, count, subtotal, total, DELIVERY_FEE, inCart, add, setQty, decrement, remove, clear }
})
