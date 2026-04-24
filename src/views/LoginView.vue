<template>
    <div class="view">
        <AppTopBar :title="isPhoneFlow ? 'Verify phone' : 'Verify email'" :show-back="true" :show-cart="false"
            back-to="/account" />

        <div class="page">
            <div class="auth-hero">
                <div class="auth-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="4" y="14" width="20" height="12" rx="3" stroke="currentColor" stroke-width="1.8" />
                        <path d="M9 14v-4a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" />
                        <circle cx="14" cy="20" r="1.5" fill="currentColor" />
                    </svg>
                </div>
                <h2 class="auth-title">{{ isPhoneFlow ? 'Continue with your phone' : 'Continue with your email' }}</h2>
                <p class="auth-sub">
                    {{ isPhoneFlow ? 'We will send a one-time code to verify your number' : 'We will send a one - time code to verify your email' }}
                </p>
            </div>

            <!-- Step 1: Identifier -->
            <transition name="fade" mode="out-in">
                <div v-if="step === 'identifier'" key="identifier" class="form-card">
                    <template v-if="isPhoneFlow">
                        <p class="field-label">Phone number</p>
                        <div class="phone-row">
                            <span class="phone-prefix">+256</span>
                            <input class="field phone-field" v-model="identifier" placeholder="7X XXX XXXX" type="tel"
                                inputmode="numeric" maxlength="9" @input="identifier = identifier.replace(/\D/g, '')" />
                        </div>
                    </template>
                    <template v-else>
                        <p class="field-label">Email address</p>
                        <input class="field" v-model="identifier" placeholder="you@example.com" type="email"
                            autocomplete="email" />
                    </template>
                    <p v-if="notice" class="notice-msg">{{ notice }}</p>
                    <p v-if="error" class="error-msg">{{ error }}</p>
                    <button class="btn-primary" :disabled="!isIdentifierValid || busy" @click="handleSendOtp">
                        <span v-if="!busy">Send verification code</span>
                        <span v-else class="dots"><span></span><span></span><span></span></span>
                    </button>
                </div>

                <!-- Step 2: OTP -->
                <div v-else-if="step === 'otp'" key="otp" class="form-card">
                    <p class="otp-sent">Code sent to <strong>{{ displayIdentifier }}</strong></p>
                    <p class="field-label">Enter 6-digit code</p>
                    <input class="field otp-field" v-model="otp" placeholder="000000" type="tel" inputmode="numeric"
                        maxlength="6" @input="otp = otp.replace(/\D/g, '')" />
                    <p v-if="notice" class="notice-msg">{{ notice }}</p>
                    <p v-if="error" class="error-msg">{{ error }}</p>
                    <button class="btn-primary" :disabled="otp.length < 6 || busy" @click="handleVerify">
                        <span v-if="!busy">Verify code</span>
                        <span v-else class="dots"><span></span><span></span><span></span></span>
                    </button>
                    <button class="btn-ghost" :disabled="busy || resendCooldown > 0" @click="handleResendOtp">
                        {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code' }}
                    </button>
                    <button class="btn-ghost" @click="step = 'identifier'; otp = ''; error = ''">
                        ← Change {{ isPhoneFlow ? 'number' : 'email' }}
                    </button>
                </div>
            </transition>

            <div class="divider"><span>New here?</span></div>
            <button class="btn-secondary" @click="router.push('/signup')">Create account</button>
        </div>
    </div>
</template>

<script setup>
    import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useAuthStore } from '@/stores/auth'

    const route = useRoute()
    const router = useRouter()
    const auth = useAuthStore()

    const otpChannel = import.meta.env.VITE_OTP_CHANNEL === 'phone' ? 'phone' : 'email'
    const isPhoneFlow = otpChannel === 'phone'

    const step = ref('identifier')
    const identifier = ref('')
    const otp = ref('')
    const busy = ref(false)
    const error = ref('')
    const notice = ref('')
    const resendCooldown = ref(0)
    let resendTimer = null
    const isIdentifierValid = computed(() =>
        isPhoneFlow ? identifier.value.trim().length >= 9 : /.+@.+\..+/.test(identifier.value.trim()),
    )
    const normalizedIdentifier = computed(() => {
        const raw = identifier.value.trim()
        if (!isPhoneFlow) return raw.toLowerCase()
        if (raw.startsWith('+')) return raw
        if (raw.startsWith('256')) return `+${raw}`
        if (raw.startsWith('0')) return `+256${raw.slice(1)}`
        return `+256${raw}`
    })
    const displayIdentifier = computed(() => normalizedIdentifier.value)

    function clearResendTimer() {
        if (resendTimer) {
            clearInterval(resendTimer)
            resendTimer = null
        }
    }

    function startResendCooldown(seconds = 60) {
        clearResendTimer()
        resendCooldown.value = seconds
        resendTimer = setInterval(() => {
            if (resendCooldown.value <= 1) {
                resendCooldown.value = 0
                clearResendTimer()
                return
            }
            resendCooldown.value -= 1
        }, 1000)
    }

    onMounted(() => {
        const reason = String(route.query.reason ?? '')
        const incomingIdentifier = String(route.query.identifier ?? '').trim()
        const nextStep = String(route.query.step ?? '')

        if (incomingIdentifier) identifier.value = incomingIdentifier

        if (reason === 'existing-account') {
            notice.value = `This ${isPhoneFlow ? 'phone number' : 'email'} is already linked to an account. Please verify to continue logging in.`
        }

        if (nextStep === 'otp' && incomingIdentifier) {
            step.value = 'otp'
            startResendCooldown()
        }
    })

    onBeforeUnmount(() => {
        clearResendTimer()
    })

    async function handleResendOtp() {
        if (resendCooldown.value > 0) return
        busy.value = true
        error.value = ''
        const { error: err } = await auth.sendOtp(normalizedIdentifier.value, 'login')
        busy.value = false
        if (err) {
            const message = (typeof err === 'string' ? err : err?.message) ?? 'Could not send code.'
            error.value = /not\s*found|no\s*user|invalid\s*login|signups?\s*not\s*allowed\s*for\s*otp|user\s*already\s*registered/i.test(message)
                ? `No account found for this ${isPhoneFlow ? 'phone number' : 'email'}. Create an account instead.`
                : message
            return
        }
        otp.value = ''
        notice.value = 'A new verification code has been sent.'
        startResendCooldown()
        step.value = 'otp'
    }

    async function handleSendOtp() {
        busy.value = true
        error.value = ''
        notice.value = ''
        const { error: err } = await auth.sendOtp(normalizedIdentifier.value, 'login')
        busy.value = false
        if (err) {
            const message = (typeof err === 'string' ? err : err?.message) ?? 'Could not send code.'
            error.value = /not\s*found|no\s*user|invalid\s*login|signups?\s*not\s*allowed\s*for\s*otp|user\s*already\s*registered/i.test(message)
                ? `No account found for this ${isPhoneFlow ? 'phone number' : 'email'}. Create an account instead.`
                : message
            return
        }
        startResendCooldown()
        step.value = 'otp'
    }

    async function handleVerify() {
        busy.value = true
        error.value = ''
        notice.value = ''
        const { error: err, isNew } = await auth.verifyOtp(normalizedIdentifier.value, otp.value, 'login')
        busy.value = false
        if (err) {
            const message = (typeof err === 'string' ? err : err?.message) ?? 'Could not verify code.'
            error.value = /not\s*found|no\s*user|signups?\s*not\s*allowed\s*for\s*otp/i.test(message)
                ? `No account found for this ${isPhoneFlow ? 'phone number' : 'email'}. Create an account instead.`
                : message
            return
        }
        if (isNew) {
            error.value = `No account found for this ${isPhoneFlow ? 'phone number' : 'email'}. Create an account instead.`
            step.value = 'identifier'
            otp.value = ''
            return
        }
        router.push('/account')
    }
</script>

<style scoped>
@reference '../main.css';
    .btn-primary {
        @apply px-4 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 active:bg-green-900 transition-colors;
    }
    .btn-primary:disabled {
        @apply text-slate-800 border-2 border-slate-600 bg-white cursor-not-allowed;
    }
    .view {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--bg);
    }

    .page {
        flex: 1;
        padding: 32px 16px 80px;
        max-width: 480px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .auth-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 16px 0 8px;
    }

    .auth-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--accent-lt);
        color: var(--accent);
        border: 2px solid rgba(45, 122, 58, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .auth-title {
        font-family: 'Lora', serif;
        font-size: 24px;
        font-weight: 600;
    }

    .auth-sub {
        font-size: 14px;
        color: var(--muted);
        text-align: center;
    }

    .form-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .field-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--muted);
    }

    .phone-row {
        display: flex;
        align-items: center;
        gap: 0;
    }

    .phone-prefix {
        background: var(--surface2);
        border: 2px solid var(--border);
        border-right: none;
        border-radius: 12px 0 0 12px;
        padding: 16px 12px;
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        flex-shrink: 0;
    }

    .phone-field {
        border-radius: 0 12px 12px 0 !important;
        flex: 1;
    }

    .field {
        width: 100%;
        font-family: 'Sora', sans-serif;
        font-size: 16px;
        background: var(--surface2);
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

    .otp-field {
        text-align: center;
        letter-spacing: 0.3em;
        font-size: 22px;
        font-weight: 600;
    }

    .otp-sent {
        font-size: 13px;
        color: var(--muted);
        text-align: center;
    }

    .otp-sent strong {
        color: var(--text);
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
    }

    .notice-msg {
        font-size: 13px;
        color: var(--text);
        text-align: center;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 12px;
    }

    .mock-hint {
        font-size: 12px;
        color: var(--muted);
        text-align: center;
        background: var(--surface2);
        border-radius: 8px;
        padding: 8px;
    }

    .mock-hint strong {
        color: var(--accent);
    }

    .btn-ghost {
        background: none;
        border: none;
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        color: var(--muted);
        cursor: pointer;
        text-align: center;
        padding: 4px;
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--muted);
        font-size: 12px;
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border);
    }
</style>
