<template>
    <div class="view">
        <AppTopBar title="Your cart" :show-back="true" />

        <div class="page">
            <div v-if="!cart.items.length" class="empty-state">
                <span class="empty-icon">🛒</span>
                <p class="empty-msg">Your cart is empty</p>
                <button class="btn-secondary" @click="goBack(router)">Back</button>
            </div>

            <template v-else>
                <div class="cart-list">
                    <div class="cart-item" v-for="item in cart.items" :key="item.id">
                        <span class="item-emoji">{{ item.emoji }}</span>
                        <div class="item-info">
                            <p class="item-name">{{ item.name }}</p>
                            <p class="item-price">UGX {{ item.price.toLocaleString() }} each</p>
                            <p class="item-stock" :class="stockClass(item.id)">{{ stockLabel(item.id) }}</p>
                        </div>
                        <div class="item-qty">
                            <button class="qty-btn" :disabled="item.qty <= 1"
                                @click="cart.decrement(item.id)">−</button>
                            <span class="qty-num">{{ item.qty }}</span>
                            <button class="qty-btn" :disabled="cart.availableQty(item.id) <= item.qty"
                                @click="cart.increment(item.id)">+</button>
                        </div>
                        <button class="remove-btn" @click="cart.remove(item.id)" aria-label="Remove">✕</button>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="summary-row"><span>Subtotal</span><span>UGX {{ cart.subtotal.toLocaleString() }}</span>
                    </div>
                    <div class="summary-row"><span>Delivery</span><span>UGX {{ cart.DELIVERY_FEE.toLocaleString()
                            }}</span></div>
                    <div class="summary-row total"><span>Total</span><span>UGX {{ cart.total.toLocaleString() }}</span>
                    </div>
                </div>

                <button class="btn-primary" @click="router.push('/checkout')">Proceed to checkout</button>
                <button class="btn-secondary" @click="goBack(router)">Add more products</button>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useCartStore } from '@/stores/cart'
    import { goBack } from '@/lib/navigationHistory'
    import { getMedicineStockLabel, getLowStockBadge } from '@/lib/medicineCatalog'

    const router = useRouter()
    const cart = useCartStore()

    function stockLabel(id) {
        return getMedicineStockLabel(id)
    }

    function stockClass(id) {
        return getLowStockBadge(id)
    }
</script>

<style scoped>
    .view {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--bg);
    }

    .page {
        flex: 1;
        padding: 20px 16px 100px;
        max-width: 480px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 80px 0;
    }

    .empty-icon {
        font-size: 52px;
    }

    .empty-msg {
        font-size: 16px;
        color: var(--muted);
    }

    .cart-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .cart-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        position: relative;
    }

    .item-emoji {
        font-size: 26px;
        flex-shrink: 0;
    }

    .item-info {
        flex: 1;
        min-width: 0;
    }

    .item-name {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .item-price {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
    }

    .item-stock {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        position: absolute;
        top: -6px;
        right: 8px;
    }

    .item-stock.in-stock {
        color: var(--accent);
    }

    .item-stock.low-stock {
        color: var(--warn);
    }

    .item-stock.out-of-stock {
        color: var(--danger);
    }

    .item-qty {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .qty-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid var(--accent);
        background: transparent;
        color: var(--accent);
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }

    .qty-btn:active {
        background: var(--accent);
        color: #fff;
    }

    .qty-btn:disabled {
        border-color: var(--border);
        color: var(--muted);
        background: var(--surface2);
        cursor: not-allowed;
    }

    .qty-num {
        font-size: 15px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
    }

    .remove-btn {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 15px;
        cursor: pointer;
        padding: 8px;
        -webkit-tap-highlight-color: transparent;
        flex-shrink: 0;
    }

    .summary-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .summary-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: var(--muted);
    }

    .summary-row.total {
        font-size: 17px;
        font-weight: 700;
        color: var(--text);
        padding-top: 12px;
        border-top: 1px solid var(--border);
        margin-top: 2px;
    }
</style>
