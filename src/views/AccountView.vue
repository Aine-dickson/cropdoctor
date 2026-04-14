<template>
    <div class="view">
        <AppTopBar title="Account" :show-back="false" :show-cart="true" />

        <div class="page">

            <!-- ── GUEST STATE ── -->
            <template v-if="auth.isGuest">
                <div class="guest-hero">
                    <div class="avatar-placeholder">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                            <circle cx="18" cy="14" r="6" stroke="currentColor" stroke-width="1.8" />
                            <path d="M6 30c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor"
                                stroke-width="1.8" stroke-linecap="round" />
                        </svg>
                    </div>
                    <h2 class="guest-title">You're browsing as a guest</h2>
                    <p class="guest-sub">Create an account to track orders, save your address, and see your scan
                        history.</p>
                </div>

                <div class="benefits-card">
                    <div class="benefit-row" v-for="b in benefits" :key="b.icon">
                        <span class="benefit-icon">{{ b.icon }}</span>
                        <div>
                            <p class="benefit-title">{{ b.title }}</p>
                            <p class="benefit-desc">{{ b.desc }}</p>
                        </div>
                    </div>
                </div>

                <button class="btn-primary" @click="router.push('/signup')">Create account</button>
                <button class="btn-secondary" @click="router.push('/login')">I already have an account</button>
            </template>

            <!-- ── LOGGED IN STATE ── -->
            <template v-else>
                <!-- Profile header -->
                <div class="profile-header">
                    <div class="avatar">
                        <span class="avatar-initials">{{ initials }}</span>
                    </div>
                    <div class="profile-info">
                        <h2 class="profile-name">{{ auth.profile?.name || 'Farmer' }}</h2>
                        <p class="profile-phone">+256 {{ auth.session?.user?.phone?.replace('+256', '') }}</p>
                        <p class="profile-address" v-if="auth.profile?.address">{{ auth.profile.address }}</p>
                    </div>
                    <button class="edit-btn" @click="editing = true">Edit</button>
                </div>

                <!-- Edit form -->
                <transition name="slide-down">
                    <div v-if="editing" class="edit-card">
                        <div class="field-group">
                            <p class="field-label">Full name</p>
                            <input class="field" v-model="editForm.name" placeholder="Full name" />
                        </div>
                        <div class="field-group">
                            <p class="field-label">Delivery address</p>
                            <input class="field" v-model="editForm.address" placeholder="Village / town / district" />
                        </div>
                        <div class="edit-actions">
                            <button class="btn-secondary" @click="cancelEdit">Cancel</button>
                            <button class="btn-primary" style="flex:1" :disabled="saving" @click="handleSave">
                                <span v-if="!saving">Save changes</span>
                                <span v-else class="dots"><span></span><span></span><span></span></span>
                            </button>
                        </div>
                    </div>
                </transition>

                <!-- Stats -->
                <div class="stats-row">
                    <div class="stat-cell">
                        <span class="stat-num">{{ orders.length }}</span>
                        <span class="stat-label">Orders</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-cell">
                        <span class="stat-num">{{ detections.length }}</span>
                        <span class="stat-label">Scans</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-cell">
                        <span class="stat-num">{{ uniqueDiseases }}</span>
                        <span class="stat-label">Diseases cured</span>
                    </div>
                </div>

                <!-- Order history -->
                <div class="section">
                    <p class="section-label">Recent orders</p>
                    <div v-if="loadingHistory" class="loading-row">
                        <span class="dots"><span></span><span></span><span></span></span>
                    </div>
                    <div v-else-if="!orders.length" class="empty-section">
                        No orders yet
                    </div>
                    <div v-else class="history-list">
                        <div class="history-item" v-for="o in orders" :key="o.id">
                            <div class="history-info">
                                <p class="history-title">Order #{{ o.id.slice(0, 8).toUpperCase() }}</p>
                                <p class="history-meta">{{ formatDate(o.created_at) }} · {{ o.items?.length ?? 0 }}
                                    item(s)</p>
                            </div>
                            <div class="history-right">
                                <p class="history-total">UGX {{ (o.total || 0).toLocaleString() }}</p>
                                <span class="status-pill" :class="o.status">{{ o.status }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Scan history -->
                <div class="section">
                    <p class="section-label">Scan history</p>
                    <div v-if="loadingHistory" class="loading-row">
                        <span class="dots"><span></span><span></span><span></span></span>
                    </div>
                    <div v-else-if="!detections.length" class="empty-section">
                        No scans recorded yet
                    </div>
                    <div v-else class="history-list">
                        <div class="history-item" v-for="d in detections" :key="d.id">
                            <div class="scan-dot" :class="d.severity?.toLowerCase()"></div>
                            <div class="history-info">
                                <p class="history-title">{{ d.disease }}</p>
                                <p class="history-meta">{{ d.plant }} · {{ formatDate(d.created_at) }}</p>
                            </div>
                            <span class="conf-pill">{{ d.confidence }}%</span>
                        </div>
                    </div>
                </div>

                <!-- Sign out -->
                <button class="btn-danger" @click="handleSignOut">Sign out</button>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { ref, computed, onMounted, watch } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useAuthStore } from '@/stores/auth'

    const router = useRouter()
    const auth = useAuthStore()

    const editing = ref(false)
    const saving = ref(false)
    const loadingHistory = ref(false)
    const orders = ref([])
    const detections = ref([])

    const editForm = ref({ name: '', address: '' })

    const initials = computed(() => {
        const name = auth.profile?.name || 'F'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    })

    const uniqueDiseases = computed(() => new Set(detections.value.map(d => d.disease)).size)

    const benefits = [
        { icon: '📦', title: 'Track your orders', desc: 'See order status and history in one place' },
        { icon: '🔬', title: 'Scan history', desc: 'Review past detections and treatments' },
        { icon: '📍', title: 'Save your address', desc: 'Faster checkout every time' },
        { icon: '⭐', title: 'Leave product reviews', desc: 'Help other farmers choose the right treatment' },
    ]

    function cancelEdit() {
        editForm.value = { name: auth.profile?.name || '', address: auth.profile?.address || '' }
        editing.value = false
    }

    async function handleSave() {
        saving.value = true
        await auth.saveProfile(editForm.value)
        saving.value = false
        editing.value = false
    }

    async function handleSignOut() {
        await auth.signOut()
        router.push('/')
    }

    function formatDate(iso) {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    async function loadHistory() {
        if (auth.isGuest) return
        loadingHistory.value = true
        const [o, d] = await Promise.all([auth.fetchOrders(), auth.fetchDetections()])
        orders.value = o
        detections.value = d
        loadingHistory.value = false
    }

    onMounted(() => {
        if (auth.profile) {
            editForm.value = { name: auth.profile.name || '', address: auth.profile.address || '' }
        }
        loadHistory()
    })

    watch(() => auth.isLoggedIn, (v) => { if (v) loadHistory() })
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
        gap: 16px;
    }

    /* Guest */
    .guest-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px 0 8px;
        text-align: center;
    }

    .avatar-placeholder {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--surface2);
        border: 2px solid var(--border);
        color: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .guest-title {
        font-family: 'Lora', serif;
        font-size: 22px;
        font-weight: 600;
    }

    .guest-sub {
        font-size: 14px;
        color: var(--muted);
        line-height: 1.6;
        max-width: 300px;
    }

    .benefits-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .benefit-row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
    }

    .benefit-icon {
        font-size: 22px;
        flex-shrink: 0;
        width: 32px;
        text-align: center;
    }

    .benefit-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 2px;
    }

    .benefit-desc {
        font-size: 12px;
        color: var(--muted);
    }

    /* Profile header */
    .profile-header {
        display: flex;
        align-items: center;
        gap: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 18px;
    }

    .avatar {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .avatar-initials {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
    }

    .profile-info {
        flex: 1;
        min-width: 0;
    }

    .profile-name {
        font-size: 17px;
        font-weight: 600;
    }

    .profile-phone {
        font-size: 13px;
        color: var(--muted);
        margin-top: 2px;
    }

    .profile-address {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .edit-btn {
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: var(--accent);
        background: var(--accent-lt);
        border: 2px solid var(--accent);
        border-radius: 10px;
        padding: 8px 14px;
        cursor: pointer;
        flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
    }

    .edit-btn:active {
        background: var(--accent);
        color: #fff;
    }

    /* Edit form */
    .edit-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .field-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--muted);
    }

    .field {
        width: 100%;
        font-family: 'Sora', sans-serif;
        font-size: 16px;
        background: var(--surface2);
        border: 2px solid var(--border);
        border-radius: 12px;
        padding: 14px;
        color: var(--text);
        -webkit-appearance: none;
        transition: border-color 0.2s;
    }

    .field:focus {
        outline: none;
        border-color: var(--accent);
    }

    .field::placeholder {
        color: var(--muted);
    }

    .edit-actions {
        display: flex;
        gap: 10px;
    }

    /* Stats */
    .stats-row {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        display: flex;
        align-items: center;
    }

    .stat-cell {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 18px 8px;
        gap: 4px;
    }

    .stat-num {
        font-size: 26px;
        font-weight: 700;
        color: var(--accent);
        font-family: 'Lora', serif;
    }

    .stat-label {
        font-size: 11px;
        color: var(--muted);
        text-align: center;
    }

    .stat-divider {
        width: 1px;
        height: 40px;
        background: var(--border);
    }

    /* Sections */
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

    .empty-section {
        font-size: 13px;
        color: var(--muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
    }

    .loading-row {
        display: flex;
        justify-content: center;
        padding: 20px;
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .history-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
    }

    .history-info {
        flex: 1;
        min-width: 0;
    }

    .history-title {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .history-meta {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
    }

    .history-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        flex-shrink: 0;
    }

    .history-total {
        font-size: 13px;
        font-weight: 600;
        color: var(--accent);
    }

    .scan-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        background: var(--border);
    }

    .scan-dot.high {
        background: var(--danger);
    }

    .scan-dot.medium {
        background: var(--warn);
    }

    .scan-dot.low {
        background: var(--accent);
    }

    .conf-pill {
        font-size: 11px;
        font-weight: 700;
        background: var(--accent-lt);
        color: var(--accent);
        border-radius: 20px;
        padding: 3px 9px;
        flex-shrink: 0;
    }

    .status-pill {
        font-size: 10px;
        font-weight: 700;
        border-radius: 20px;
        padding: 2px 8px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .status-pill.placed {
        background: #e8f5ea;
        color: var(--accent);
    }

    .status-pill.delivered {
        background: #e8f5ea;
        color: var(--accent);
    }

    .status-pill.pending {
        background: #fef3e2;
        color: var(--warn);
    }

    .status-pill.cancelled {
        background: #fde8e8;
        color: var(--danger);
    }

    .btn-danger {
        width: 100%;
        padding: 15px;
        border-radius: 14px;
        background: transparent;
        color: var(--danger);
        border: 2px solid rgba(192, 57, 43, 0.4);
        font-family: 'Sora', sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: background 0.15s;
    }

    .btn-danger:active {
        background: #fde8e8;
    }

    .slide-down-enter-active {
        transition: all 0.25s ease;
    }

    .slide-down-enter-from {
        opacity: 0;
        transform: translateY(-8px);
    }
</style>
