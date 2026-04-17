<template>
    <div class="view">
        <AppTopBar title="Search" :show-back="true" />

        <div class="page">
            <!-- Search input -->
            <div class="search-wrap">
                <div class="search-row">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.6" />
                        <path d="M12.5 12.5l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                    </svg>
                    <input ref="inputEl" class="search-input" v-model="query"
                        placeholder="Disease name or medicine name…" @input="onInput" @keydown.enter="runSearch" />
                    <button v-if="query" class="clear-btn" @click="clear">✕</button>
                </div>

                <!-- Type pills -->
                <div class="type-pills">
                    <button class="pill" :class="{ active: searchType === 'auto' }"
                        @click="searchType = 'auto'">Auto</button>
                    <button class="pill" :class="{ active: searchType === 'disease' }"
                        @click="searchType = 'disease'">Disease</button>
                    <button class="pill" :class="{ active: searchType === 'drug' }"
                        @click="searchType = 'drug'">Medicine</button>
                </div>
            </div>

            <!-- Idle state -->
            <div v-if="!query && !results" class="idle-state">
                <p class="idle-title">Try searching for</p>
                <div class="suggestion-list">
                    <button class="suggestion" v-for="s in suggestions" :key="s" @click="query = s; runSearch()">
                        {{ s }}
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-else-if="searching" class="loading-state">
                <span class="dots"><span></span><span></span><span></span></span>
                <p>Searching…</p>
            </div>

            <!-- Error -->
            <p v-else-if="error" class="error-msg">{{ error }}</p>

            <!-- ── DISEASE RESULTS ── -->
            <template v-else-if="results?.type === 'disease'">
                <div class="result-header">
                    <span class="result-tag disease-tag">Disease</span>
                    <h2 class="result-name">{{ results.disease }}</h2>
                </div>

                <!-- Advice -->
                <div class="section-card">
                    <h3 class="section-title">{{ results.aiUnavailable ? 'Available treatments' : 'What this disease does' }}</h3>
                    <p class="advice-text">{{ results.advice }}</p>
                </div>

                <!-- Medicines -->
                <div class="bridge-card">
                    <div class="bridge-head">
                        <span>💊</span>
                        <div>
                            <h3 class="bridge-title">Treatments for {{ results.disease }}</h3>
                            <p class="bridge-sub">{{ results.medicines.length }} products found</p>
                        </div>
                    </div>
                    <p v-if="!results.medicines.length" class="empty-catalogue-msg">
                        We could not find a direct medicine match in the current catalogue. Try a related disease,
                        Browse, or use a specific medicine name.
                    </p>
                    <p v-else-if="!results.medicines.some((m) => m.inventoryCount > 0)" class="empty-catalogue-msg">
                        We found matching medicines, but they are currently out of stock.
                    </p>
                    <div class="product-list">
                        <div class="product-row" v-for="p in results.medicines" :key="p.id"
                            @click="router.push('/product/' + p.id)">
                            <span class="stock-pill" :class="stockClass(p.id)">{{ getMedicineStockLabel(p.id) }}</span>
                            <div class="product-emoji-wrap">{{ p.emoji }}</div>
                            <div class="product-info">
                                <p class="product-name">{{ p.name }}</p>
                                <p class="product-type">{{ p.type }}</p>
                                <p class="product-price">UGX {{ p.price.toLocaleString() }}</p>
                            </div>
                            <button class="btn-add"
                                :class="{ added: cart.inCart(p.id), disabled: !isMedicineInStock(p.id) }"
                                :disabled="!isMedicineInStock(p.id)" @click.stop="cart.add(p)">
                                {{ isMedicineInStock(p.id) ? (cart.inCart(p.id) ? '✓' : '+') : '×' }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Related diseases -->
                <div class="section-card" v-if="results.relatedDiseases?.length">
                    <h3 class="section-title">Related diseases</h3>
                    <div class="related-list">
                        <button class="related-chip" v-for="d in results.relatedDiseases" :key="d"
                            @click="query = d; runSearch()">{{ d }}</button>
                    </div>
                </div>
            </template>

            <!-- ── DRUG RESULTS ── -->
            <template v-else-if="results?.type === 'drug'">
                <!-- Exact match -->
                <div class="result-header">
                    <span class="result-tag drug-tag">Medicine</span>
                    <h2 class="result-name">{{ results.exact.name }}</h2>
                    <p class="result-sub">{{ results.exact.type }} · UGX {{ results.exact.price.toLocaleString() }}</p>
                </div>

                <div class="section-card">
                    <p class="advice-text">{{ results.exact.description }}</p>
                    <p class="stock-note" :class="stockClass(results.exact.id)">{{
                        getMedicineStockLabel(results.exact.id) }}</p>
                    <div class="exact-actions">
                        <button class="btn-primary" @click="router.push('/product/' + results.exact.id)">View
                            product</button>
                        <button class="btn-add wide"
                            :class="{ added: cart.inCart(results.exact.id), disabled: !isMedicineInStock(results.exact.id) }"
                            :disabled="!isMedicineInStock(results.exact.id)" @click="cart.add(results.exact)">
                            {{ isMedicineInStock(results.exact.id) ? (cart.inCart(results.exact.id) ? '✓ Added' : '+ Add to cart') : 'Out of stock' }}
                        </button>
                    </div>
                </div>

                <!-- Alternatives -->
                <div class="section-card" v-if="results.alternatives?.length">
                    <h3 class="section-title">Alternatives</h3>
                    <div class="alt-list">
                        <div class="alt-row" v-for="a in results.alternatives" :key="a.product.id"
                            @click="router.push('/product/' + a.product.id)">
                            <span class="stock-pill" :class="stockClass(a.product.id)">{{
                                getMedicineStockLabel(a.product.id) }}</span>
                            <div class="product-emoji-wrap sm">{{ a.product.emoji }}</div>
                            <div class="alt-info">
                                <p class="product-name">{{ a.product.name }}</p>
                                <p class="product-type">{{ a.product.type }}</p>
                            </div>
                            <div class="alt-right">
                                <span class="diff-tag" :class="a.diffClass">{{ a.diffLabel }}</span>
                                <p class="product-price">UGX {{ a.product.price.toLocaleString() }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- No results -->
            <div v-else-if="results?.type === 'none'" class="empty-state">
                <p class="empty-title">No results for "{{ query }}"</p>
                <p class="empty-sub">Try a different spelling or describe the symptoms instead.</p>
                <button class="btn-secondary" @click="router.push('/describe')">Describe symptoms</button>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { nextTick, onMounted, ref } from 'vue'
    import { storeToRefs } from 'pinia'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useCartStore } from '@/stores/cart'
    import { enrichDiseaseDiagnosis } from '@/lib/agriAi'
    import { findMedicinesByDisease, MEDICINE_CATALOGUE, getMedicineStockLabel, isMedicineInStock, getLowStockBadge } from '@/lib/medicineCatalog'
    import { useSearchStore } from '@/stores/search'

    const router = useRouter()
    const cart = useCartStore()
    const search = useSearchStore()
    const { query, searchType, searching, results, error } = storeToRefs(search)
    const inputEl = ref(null)

    const suggestions = [
        'Late Blight', 'Powdery Mildew', 'Ridomil Gold', 'Rust',
        'Mancozeb', 'Tomato disease', 'Leaf spots',
    ]

    let debounceTimer = null
    function onInput() {
        clearTimeout(debounceTimer)
        if (!query.value.trim()) { results.value = null; return }
        debounceTimer = setTimeout(runSearch, 600)
    }

    function clear() { search.clear() }

    function stockClass(id) {
        return getLowStockBadge(id)
    }

    async function runSearch() {
        if (!query.value.trim()) return
        searching.value = true
        error.value = ''
        results.value = null

        try {
            const type = searchType.value === 'auto' ? await classify(query.value) : searchType.value
            if (type === 'disease') {
                results.value = await searchByDisease(query.value)
            } else {
                results.value = await searchByDrug(query.value)
            }
        } catch (e) {
            error.value = e.message || 'Search failed. Please try again.'
        } finally {
            searching.value = false
        }
    }

    // ── Classify query as disease or drug ────────────────────────────────────────
    async function classify(q) {
        // Quick local check first
        const lq = q.toLowerCase()
        const isDrug = MEDICINE_CATALOGUE.some(p => p.name.toLowerCase().includes(lq))
        if (isDrug) return 'drug'
        return 'disease'
    }

    // ── Search by disease ─────────────────────────────────────────────────────────
    async function searchByDisease(q) {
        const ai = await enrichDiseaseDiagnosis({
            disease: q,
            confidence: undefined,
            confidenceBand: undefined,
        })
        const medicines = findMedicinesByDisease(q, ai.searchTerms)
        return {
            type: 'disease',
            disease: q,
            advice: ai.summary,
            medicines,
            relatedDiseases: ai.relatedDiseases ?? [],
            aiUnavailable: ai.aiUnavailable,
        }
    }

    // ── Search by drug ────────────────────────────────────────────────────────────
    async function searchByDrug(q) {
        const lq = q.toLowerCase()
        const exact = MEDICINE_CATALOGUE.find(p => p.name.toLowerCase().includes(lq))
        if (!exact) return { type: 'none' }

        // Build alternatives: same disease overlap, not the exact product
        const alts = MEDICINE_CATALOGUE
            .filter(p => p.id !== exact.id && p.diseases.some(d => exact.diseases.includes(d)))
            .map(p => {
                const priceDiff = p.price - exact.price
                let diffLabel, diffClass
                if (priceDiff < -3000) { diffLabel = 'Cheaper'; diffClass = 'cheaper' }
                else if (priceDiff > 3000) { diffLabel = 'Pricier'; diffClass = 'pricier' }
                else { diffLabel = 'Similar price'; diffClass = 'similar' }

                // Override with functional diff if known
                if (p.type.includes('Systemic') && !exact.type.includes('Systemic')) diffLabel = 'More systemic'
                if (p.type.includes('Broad') && !exact.type.includes('Broad')) diffLabel = 'Broader range'
                if (p.type.includes('Protective') && exact.type.includes('Systemic')) diffLabel = 'Preventive'

                return { product: p, diffLabel, diffClass }
            })

        await delay(400)
        return { type: 'drug', exact, alternatives: alts }
    }

    onMounted(() => nextTick(() => inputEl.value?.focus()))

    const delay = ms => new Promise(r => setTimeout(r, ms))
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

    .search-wrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .search-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--surface);
        border: 2px solid var(--accent);
        border-radius: 14px;
        padding: 14px 16px;
    }

    .search-icon {
        color: var(--accent);
        flex-shrink: 0;
    }

    .search-input {
        flex: 1;
        font-family: 'Sora', sans-serif;
        font-size: 16px;
        border: none;
        background: none;
        color: var(--text);
        outline: none;
    }

    .search-input::placeholder {
        color: var(--muted);
    }

    .clear-btn {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 15px;
        cursor: pointer;
        padding: 2px 4px;
        flex-shrink: 0;
    }

    .type-pills {
        display: flex;
        gap: 8px;
    }

    .pill {
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 7px 16px;
        border-radius: 20px;
        border: 2px solid var(--border);
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: all 0.15s;
    }

    .pill.active {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-lt);
    }

    .pill:active {
        border-color: var(--accent);
        color: var(--accent);
    }

    .idle-state {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .idle-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
    }

    .suggestion-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .suggestion {
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        padding: 8px 14px;
        border-radius: 20px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .suggestion:active {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-lt);
    }

    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 40px;
        color: var(--muted);
        font-size: 14px;
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
        padding: 16px;
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
        padding: 3px 10px;
        border-radius: 20px;
        align-self: flex-start;
    }

    .disease-tag {
        background: #fef3e2;
        color: var(--warn);
    }

    .drug-tag {
        background: var(--accent-lt);
        color: var(--accent);
    }

    .result-name {
        font-family: 'Lora', serif;
        font-size: 24px;
        font-weight: 600;
    }

    .result-sub {
        font-size: 13px;
        color: var(--muted);
    }

    .section-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
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

    .bridge-card {
        background: var(--surface);
        border: 2px solid var(--accent);
        border-radius: 18px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .bridge-head {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 22px;
    }

    .bridge-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 2px;
    }

    .bridge-sub {
        font-size: 12px;
        color: var(--muted);
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

    .empty-catalogue-msg {
        font-size: 13px;
        line-height: 1.55;
        color: var(--muted);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
    }

    .product-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .product-row {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        position: relative;
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

    .product-emoji-wrap.sm {
        width: 36px;
        height: 36px;
        font-size: 16px;
        border-radius: 8px;
    }

    .product-info {
        flex: 1;
        min-width: 0;
    }

    .product-name {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .product-type {
        font-size: 11px;
        color: var(--muted);
        margin-top: 1px;
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

    .btn-add.wide {
        width: auto;
        padding: 0 16px;
        height: 44px;
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

    .stock-note {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 2px;
    }

    .stock-note.in-stock {
        color: var(--accent);
    }

    .stock-note.low-stock {
        color: var(--warn);
    }

    .stock-note.out-of-stock {
        color: var(--danger);
    }

    .exact-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .related-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .related-chip {
        font-family: 'Sora', sans-serif;
        font-size: 12px;
        padding: 6px 14px;
        border-radius: 20px;
        border: 1.5px solid var(--border);
        background: var(--surface2);
        color: var(--text);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .related-chip:active {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-lt);
    }

    .alt-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .alt-row {
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

    .alt-row:active {
        background: var(--accent-lt);
        border-color: var(--accent);
    }

    .alt-info {
        flex: 1;
        min-width: 0;
    }

    .alt-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        flex-shrink: 0;
    }

    .diff-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
    }

    .diff-tag.cheaper {
        background: #e8f5ea;
        color: var(--accent);
    }

    .diff-tag.pricier {
        background: #fde8e8;
        color: var(--danger);
    }

    .diff-tag.similar {
        background: var(--surface2);
        color: var(--muted);
        border: 1px solid var(--border);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 40px 0;
        text-align: center;
    }

    .empty-title {
        font-size: 16px;
        font-weight: 600;
    }

    .empty-sub {
        font-size: 13px;
        color: var(--muted);
        max-width: 280px;
    }
</style>
