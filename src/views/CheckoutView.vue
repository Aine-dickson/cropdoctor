<template>
    <div class="view">
        <AppTopBar title="Checkout" :show-back="true" back-to="/cart" />

        <div class="page">
            <!-- Delivery -->
            <div class="section">
                <p class="section-label">Delivery details</p>
                <input class="field" v-model="form.name" placeholder="Full name" />
                <input class="field" v-model="form.phone" placeholder="Phone number" type="tel" />
                <input class="field" v-model="form.location" placeholder="Village / town / district" />
            </div>

            <!-- Payment -->
            <div class="section">
                <p class="section-label">Payment method</p>
                <div class="payment-list">
                    <label class="payment-opt" :class="{ selected: form.payment === 'mtn' }">
                        <input type="radio" v-model="form.payment" value="mtn" class="sr-only" />
                        <span class="pay-logo mtn">MTN</span>
                        <div class="pay-text">
                            <p class="pay-name">MTN Mobile Money</p>
                            <p class="pay-hint">Pay via *165#</p>
                        </div>
                        <span class="pay-check" v-if="form.payment === 'mtn'">✓</span>
                    </label>

                    <label class="payment-opt" :class="{ selected: form.payment === 'airtel' }">
                        <input type="radio" v-model="form.payment" value="airtel" class="sr-only" />
                        <span class="pay-logo airtel">Airtel</span>
                        <div class="pay-text">
                            <p class="pay-name">Airtel Money</p>
                            <p class="pay-hint">Pay via *185#</p>
                        </div>
                        <span class="pay-check" v-if="form.payment === 'airtel'">✓</span>
                    </label>

                    <label class="payment-opt" :class="{ selected: form.payment === 'cod' }">
                        <input type="radio" v-model="form.payment" value="cod" class="sr-only" />
                        <span class="pay-logo cod">💵</span>
                        <div class="pay-text">
                            <p class="pay-name">Cash on delivery</p>
                            <p class="pay-hint">Pay when goods arrive</p>
                        </div>
                        <span class="pay-check" v-if="form.payment === 'cod'">✓</span>
                    </label>
                </div>

                <input v-if="form.payment === 'mtn'" class="field" v-model="form.momoNumber"
                    placeholder="MTN number e.g. 0771234567" type="tel" />
                <input v-if="form.payment === 'airtel'" class="field" v-model="form.momoNumber"
                    placeholder="Airtel number e.g. 0751234567" type="tel" />
            </div>

            <!-- Order summary -->
            <div class="section">
                <p class="section-label">Order summary</p>
                <div class="summary-card">
                    <div class="mini-row" v-for="item in cart.items" :key="item.id">
                        <span>{{ item.emoji }} {{ item.name }} ×{{ item.qty }}</span>
                        <span>UGX {{ (item.price * item.qty).toLocaleString() }}</span>
                    </div>
                    <div class="mini-row muted"><span>Delivery</span><span>UGX {{ cart.DELIVERY_FEE.toLocaleString()
                    }}</span></div>
                    <div class="mini-row total"><span>Total</span><span>UGX {{ cart.total.toLocaleString() }}</span>
                    </div>
                </div>
            </div>

            <p v-if="formError" class="error-msg">{{ formError }}</p>
            <button class="btn-primary" :disabled="placing" @click="placeOrder">
                <span v-if="!placing">Place order</span>
                <span v-else class="dots"><span></span><span></span><span></span></span>
            </button>
        </div>
    </div>
</template>

<script setup>
    import { onMounted, ref, watch } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useCartStore } from '@/stores/cart'
    import { useDetectionStore } from '@/stores/detection'
    import { useAuthStore } from '@/stores/auth'
    import { useGuestCheckoutStore } from '@/stores/guestCheckout'
    import { consumeMedicineStock } from '@/lib/medicineCatalog'

    const router = useRouter()
    const cart = useCartStore()
    const detection = useDetectionStore()
    const auth = useAuthStore()
    const guestCheckout = useGuestCheckoutStore()
    const placing = ref(false)
    const formError = ref('')

    const form = ref({ name: '', phone: '', location: '', payment: 'mtn', momoNumber: '' })

    function normalizeUgPhone(value) {
        const raw = (value ?? '').trim()
        if (!raw) return ''
        if (raw.startsWith('+256')) return `0${raw.slice(4)}`
        return raw
    }

    function prefillCheckoutForm() {
        const profileName = String(auth.profile?.name ?? '').trim()
        const profileAddress = String(auth.profile?.address ?? '').trim()
        const sessionPhone = normalizeUgPhone(auth.session?.user?.phone)
        const profilePhone = normalizeUgPhone(String(auth.profile?.phone ?? ''))
        const guestName = String(guestCheckout.contact?.name ?? '').trim()
        const guestPhone = String(guestCheckout.contact?.phone ?? '').trim()
        const guestLocation = String(guestCheckout.contact?.location ?? '').trim()

        if (!form.value.name) form.value.name = profileName || guestName
        if (!form.value.phone) form.value.phone = sessionPhone || profilePhone || guestPhone
        if (!form.value.location) form.value.location = profileAddress || guestLocation
    }

    onMounted(() => {
        prefillCheckoutForm()
    })

    watch(
        () => [auth.isLoggedIn, auth.profile, auth.session?.user?.phone],
        () => {
            prefillCheckoutForm()
        },
        { deep: true },
    )

    async function placeOrder() {
        const { name, phone, location, payment, momoNumber } = form.value
        if (!name || !phone || !location) { formError.value = 'Please fill in all delivery details.'; return }
        if ((payment === 'mtn' || payment === 'airtel') && !momoNumber) { formError.value = 'Please enter your mobile money number.'; return }
        const stockIssue = cart.items.find((item) => cart.availableQty(item.id) < item.qty)
        if (stockIssue) {
            const remaining = cart.availableQty(stockIssue.id)
            formError.value = remaining > 0
                ? `${stockIssue.name} only has ${remaining} left in stock. Please update your cart.`
                : `${stockIssue.name} is out of stock. Please remove it or choose another product.`
            return
        }
        formError.value = ''
        placing.value = true

        await new Promise(r => setTimeout(r, 1600))

        guestCheckout.saveContact({ name, phone, location })

        if (auth.isLoggedIn) {
            await auth.saveOrder({
                items: JSON.parse(JSON.stringify(cart.items)),
                total: cart.total,
                location,
                payment,
            })
        }

        cart.items.forEach((item) => consumeMedicineStock(item.id, item.qty))

        detection.orderRef = 'CD-' + Math.random().toString(36).slice(2, 8).toUpperCase()
        detection.confirmedOrder = { ...form.value }
        detection.confirmedCart = JSON.parse(JSON.stringify(cart.items))
        detection.confirmedTotal = cart.subtotal

        cart.clear()
        placing.value = false
        router.push('/confirm')
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
        gap: 20px;
    }

    .section {
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

    .field {
        width: 100%;
        font-family: 'Sora', sans-serif;
        font-size: 16px;
        background: var(--surface);
        border: 2px solid var(--border);
        border-radius: 12px;
        padding: 16px 14px;
        color: var(--text);
        transition: border-color 0.2s;
        appearance: none;
        -webkit-appearance: none;
    }

    .field:focus {
        outline: none;
        border-color: var(--accent);
    }

    .field::placeholder {
        color: var(--muted);
    }

    .payment-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .payment-opt {
        display: flex;
        align-items: center;
        gap: 14px;
        background: var(--surface);
        border: 2px solid var(--border);
        border-radius: 14px;
        padding: 16px;
        cursor: pointer;
        min-height: 68px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: border-color 0.15s, background 0.15s;
    }

    .payment-opt.selected {
        border-color: var(--accent);
        background: var(--accent-lt);
    }

    .pay-logo {
        width: 48px;
        height: 34px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        flex-shrink: 0;
    }

    .pay-logo.mtn {
        background: #ffcc00;
        color: #000;
    }

    .pay-logo.airtel {
        background: #e40000;
        color: #fff;
    }

    .pay-logo.cod {
        background: var(--surface2);
        font-size: 20px;
        border: 1px solid var(--border);
    }

    .pay-name {
        font-size: 14px;
        font-weight: 600;
    }

    .pay-hint {
        font-size: 12px;
        color: var(--muted);
        margin-top: 1px;
    }

    .pay-check {
        margin-left: auto;
        color: var(--accent);
        font-size: 18px;
        font-weight: 700;
    }

    .summary-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .mini-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--text);
    }

    .mini-row.muted {
        color: var(--muted);
    }

    .mini-row.total {
        font-size: 16px;
        font-weight: 700;
        padding-top: 10px;
        border-top: 1px solid var(--border);
        margin-top: 2px;
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
    }
</style>
