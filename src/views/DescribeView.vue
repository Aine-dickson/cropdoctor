<template>
    <div class="view">
        <AppTopBar title="Describe symptoms" :show-back="true" />

        <div class="page">
            <div class="hero">
                <p class="hero-sub">Describe what you see on your crops — leaves, stems, colour changes, spots. CropDr.
                    will identify the likely disease and suggest treatments.</p>
            </div>

            <div class="input-card">
                <textarea class="describe-input" v-model="description"
                    placeholder="e.g. My tomato leaves have brown spots with yellow rings around them. The spots are dry and spreading to other leaves. Started about 3 days ago after rain…"
                    rows="5"></textarea>
                <div class="char-count">{{ description.length }} / 500</div>
            </div>

            <!-- Examples -->
            <div class="examples" v-if="!description">
                <p class="examples-title">Example descriptions</p>
                <button class="example-chip" v-for="e in examples" :key="e" @click="description = e">{{ e }}</button>
            </div>

            <button class="btn-primary" :disabled="description.length < 10 || analysing" @click="analyse">
                <span v-if="!analysing">Identify disease</span>
                <span v-else class="dots"><span></span><span></span><span></span></span>
            </button>

            <p v-if="error" class="error-msg">{{ error }}</p>

            <!-- Result -->
            <transition name="slide-down">
                <div v-if="result" class="result-section">
                    <div class="result-header">
                        <span class="result-tag">Likely diagnosis</span>
                        <h2 class="result-name">{{ result.disease }}</h2>
                        <p class="result-confidence">{{ result.confidence }} confidence</p>
                    </div>

                    <div class="section-card">
                        <h3 class="section-title">{{ result.aiUnavailable ? 'Diagnosis' : 'What this means' }}</h3>
                        <p class="advice-text">{{ result.advice }}</p>
                        <ul class="advice-steps" v-if="result.steps?.length && !result.aiUnavailable">
                            <li v-for="(step, i) in result.steps" :key="i">{{ i + 1 }}. {{ step }}</li>
                        </ul>
                    </div>

                    <div class="bridge-card">
                        <div class="bridge-head">
                            <span>💊</span>
                            <div>
                                <h3 class="bridge-title">Recommended treatments</h3>
                            </div>
                        </div>
                        <p v-if="!result.medicines?.length" class="empty-catalogue-msg">
                            We could not match this disease to a medicine in the current catalogue. Try Browse or Search
                            for related products.
                        </p>
                        <p v-else-if="!result.medicines.some((m) => m.inventoryCount > 0)" class="empty-catalogue-msg">
                            We found matching medicines, but they are currently out of stock.
                        </p>
                        <div class="product-list">
                            <div class="product-row" v-for="p in result.medicines" :key="p.id"
                                @click="router.push('/product/' + p.id)">
                                <span class="stock-pill" :class="stockClass(p.id)">{{ stockLabel(p.id) }}</span>
                                <div class="product-emoji-wrap">{{ p.emoji }}</div>
                                <div class="product-info">
                                    <p class="product-name">{{ p.name }}</p>
                                    <p class="product-type">{{ p.type }}</p>
                                    <p class="product-price">UGX {{ p.price.toLocaleString() }}</p>
                                </div>
                                <button class="btn-add"
                                    :class="{ added: cart.inCart(p.id), disabled: !isAvailable(p.id) }"
                                    :disabled="!isAvailable(p.id)" @click.stop="cart.add(p)">
                                    {{ isAvailable(p.id) ? (cart.inCart(p.id) ? '✓' : '+') : '×' }}
                                </button>
                            </div>
                        </div>
                        <button v-if="cart.count > 0" class="btn-primary" @click="router.push('/cart')">
                            View cart · {{ cart.count }} item{{ cart.count > 1 ? 's' : '' }}
                        </button>
                    </div>

                    <button class="btn-secondary" @click="result = null; description = ''">
                        Describe another symptom
                    </button>
                </div>
            </transition>
        </div>
    </div>
</template>

<script setup>
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useCartStore } from '@/stores/cart'
    import { diagnoseSymptoms } from '@/lib/agriAi'
    import { findMedicinesByDisease, getMedicineStockLabel, isMedicineInStock, getLowStockBadge } from '@/lib/medicineCatalog'

    const router = useRouter()
    const cart = useCartStore()
    const description = ref('')
    const analysing = ref(false)
    const result = ref(null)
    const error = ref('')

    const examples = [
        'My maize leaves have white powdery coating on top. Spreading fast.',
        'Tomato leaves yellowing from bottom up with small brown spots.',
        'Bean pods have rust-coloured spots. Leaves also affected.',
    ]

    function stockLabel(id) {
        return getMedicineStockLabel(id)
    }

    function stockClass(id) {
        return getLowStockBadge(id)
    }

    function isAvailable(id) {
        return isMedicineInStock(id)
    }

    async function analyse() {
        analysing.value = true
        error.value = ''
        result.value = null

        try {
            const ai = await diagnoseSymptoms(description.value)
            const medicines = findMedicinesByDisease(ai.disease, ai.searchTerms)

            result.value = {
                disease: ai.disease,
                confidence: ai.confidence,
                advice: ai.summary,
                steps: ai.steps,
                medicines,
                aiUnavailable: ai.aiUnavailable,
            }
        } catch (e) {
            error.value = e.message || 'Could not analyse description. Please try again.'
        } finally {
            analysing.value = false
        }
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
        padding: 16px 16px 100px;
        max-width: 480px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .hero-sub {
        font-size: 14px;
        color: var(--muted);
        line-height: 1.65;
    }

    .input-card {
        background: var(--surface);
        border: 2px solid var(--accent);
        border-radius: 18px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .describe-input {
        font-family: 'Sora', sans-serif;
        font-size: 15px;
        border: none;
        background: none;
        color: var(--text);
        resize: none;
        outline: none;
        line-height: 1.6;
        width: 100%;
    }

    .describe-input::placeholder {
        color: var(--muted);
    }

    .char-count {
        font-size: 11px;
        color: var(--muted);
        text-align: right;
    }

    .examples {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .examples-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
    }

    .example-chip {
        font-family: 'Sora', sans-serif;
        font-size: 12px;
        text-align: left;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        color: var(--muted);
        cursor: pointer;
        line-height: 1.5;
        -webkit-tap-highlight-color: transparent;
    }

    .example-chip:active {
        border-color: var(--accent);
        color: var(--text);
        background: var(--accent-lt);
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
    }

    .result-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .result-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .result-tag {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #fef3e2;
        color: var(--warn);
        padding: 3px 10px;
        border-radius: 20px;
        align-self: flex-start;
    }

    .result-name {
        font-family: 'Lora', serif;
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
    }

    .result-confidence {
        font-size: 12px;
        color: var(--muted);
    }

    .section-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title {
        font-size: 14px;
        font-weight: 600;
    }

    .advice-text {
        font-size: 13.5px;
        color: var(--muted);
        line-height: 1.65;
    }

    .advice-steps {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .advice-steps li {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.55;
    }

    .bridge-card {
        background: var(--surface);
        border: 2px solid var(--accent);
        border-radius: 18px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .empty-catalogue-msg {
        font-size: 13px;
        line-height: 1.55;
        color: var(--muted);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
    }

    .stock-pill {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 3px 7px;
        border-radius: 20px;
        white-space: nowrap;
        position: absolute;
        top: -6px;
        right: 8px;
    }

    .stock-pill.in-stock {
        background: var(--accent-lt);
        color: var(--accent);
    }

    .stock-pill.low-stock {
        background: #fef3e2;
        color: var(--warn);
    }

    .stock-pill.out-of-stock {
        background: #fde8e8;
        color: var(--danger);
    }

    .bridge-head {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 22px;
    }

    .bridge-title {
        font-size: 15px;
        font-weight: 600;
    }

    .product-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .product-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .product-row:active {
        background: var(--accent-lt);
        border-color: var(--accent);
    }

    .product-emoji-wrap {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
    }

    .product-info {
        flex: 1;
        min-width: 0;
    }

    .product-name {
        font-size: 13px;
        font-weight: 600;
    }

    .product-type {
        font-size: 11px;
        color: var(--muted);
    }

    .product-price {
        font-size: 13px;
        font-weight: 600;
        color: var(--accent);
        margin-top: 3px;
    }

    .btn-add {
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        font-weight: 600;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 2px solid var(--accent);
        background: transparent;
        color: var(--accent);
        cursor: pointer;
        flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
    }

    .btn-add.added,
    .btn-add:active {
        background: var(--accent);
        color: #fff;
    }

    .btn-add.disabled {
        border-color: var(--border);
        color: var(--muted);
        background: var(--surface2);
        cursor: not-allowed;
    }

    .slide-down-enter-active {
        transition: all 0.3s ease;
    }

    .slide-down-enter-from {
        opacity: 0;
        transform: translateY(-10px);
    }
</style>
