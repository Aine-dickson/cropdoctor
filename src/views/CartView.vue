<template>
    <div class="view">
        <AppTopBar title="Cart" :show-back="true" back-to="/results" />

        <div class="page">
            <div v-if="!cart.items.length" class="empty-state">
                <span class="empty-icon">🛒</span>
                <p class="empty-msg">Your cart is empty</p>
                <button class="btn-secondary" @click="router.push('/results')">Back to results</button>
            </div>

            <template v-else>
                <div class="cart-list">
                    <div class="cart-item" v-for="item in cart.items" :key="item.id">
                        <span class="item-emoji">{{ item.emoji }}</span>
                        <div class="item-info">
                            <p class="item-name">{{ item.name }}</p>
                            <p class="item-price">UGX {{ item.price.toLocaleString() }} each</p>
                        </div>
                        <div class="item-qty">
                            <button class="qty-btn" @click="cart.decrement(item.id)">−</button>
                            <span class="qty-num">{{ item.qty }}</span>
                            <button class="qty-btn" @click="item.qty++">+</button>
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
                <button class="btn-secondary" @click="router.push('/results')">Add more products</button>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useCartStore } from '@/stores/cart'

    const router = useRouter()
    const cart = useCartStore()
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
