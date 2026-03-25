<template>
    <div class="view">
        <AppTopBar title="Order confirmed" :show-cart="false" />

        <div class="page">
            <div class="confirm-hero">
                <div class="check-circle">✓</div>
                <h2 class="confirm-title">Order placed!</h2>
                <p class="confirm-ref">{{ detection.orderRef }}</p>
            </div>

            <div class="confirm-msg-card" v-if="detection.confirmedOrder">
                <p class="confirm-msg">
                    Your medicines will be delivered to
                    <strong>{{ detection.confirmedOrder.location }}</strong>.
                    <span v-if="detection.confirmedOrder.payment !== 'cod'">
                        You will receive a payment prompt on <strong>{{ detection.confirmedOrder.momoNumber }}</strong>.
                    </span>
                    <span v-else>Pay the delivery agent in cash on arrival.</span>
                </p>
            </div>

            <div class="order-summary" v-if="detection.confirmedCart.length">
                <p class="section-label">Items ordered</p>
                <div class="summary-card">
                    <div class="mini-row" v-for="item in detection.confirmedCart" :key="item.id">
                        <span>{{ item.emoji }} {{ item.name }} ×{{ item.qty }}</span>
                        <span>UGX {{ (item.price * item.qty).toLocaleString() }}</span>
                    </div>
                    <div class="mini-row total">
                        <span>Total paid</span>
                        <span>UGX {{ (detection.confirmedTotal + detection.confirmedCart.length ? confirmedGrandTotal :
                            0).toLocaleString() }}</span>
                    </div>
                </div>
            </div>

            <button class="btn-primary" @click="handleScanAnother">Scan another crop</button>
            <button class="btn-secondary" @click="handleScanAnother">Back to home</button>
        </div>
    </div>
</template>

<script setup>
    import { computed } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useDetectionStore } from '@/stores/detection'

    const router = useRouter()
    const detection = useDetectionStore()

    const confirmedGrandTotal = computed(() =>
        detection.confirmedTotal + 5000
    )

    function handleScanAnother() {
        detection.reset()
        router.push('/')
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
        padding: 40px 16px 100px;
        max-width: 480px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: center;
    }

    .confirm-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
    }

    .check-circle {
        width: 76px;
        height: 76px;
        border-radius: 50%;
        background: var(--accent);
        color: #fff;
        font-size: 34px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes pop {
        from {
            transform: scale(0);
            opacity: 0;
        }

        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    .confirm-title {
        font-family: 'Lora', serif;
        font-size: 28px;
        font-weight: 600;
    }

    .confirm-ref {
        font-size: 13px;
        color: var(--muted);
        letter-spacing: 0.06em;
    }

    .confirm-msg-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
        width: 100%;
    }

    .confirm-msg {
        font-size: 14px;
        color: var(--muted);
        line-height: 1.7;
        text-align: center;
    }

    .confirm-msg strong {
        color: var(--text);
    }

    .order-summary {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
    }

    .summary-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
    }

    .mini-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--text);
    }

    .mini-row.total {
        font-size: 16px;
        font-weight: 700;
        padding-top: 10px;
        border-top: 1px solid var(--border);
        margin-top: 2px;
    }
</style>
