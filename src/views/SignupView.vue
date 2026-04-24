<template>
    <div class="view">
        <AppTopBar title="Create account" :show-back="true" :show-cart="false" back-to="/login" />

        <div class="page">
            <div class="signup-hero">
                <h2 class="signup-title">Almost done</h2>
                <p class="signup-sub">A few details to complete your profile</p>
            </div>

            <div v-if="!verification.sent" class="form-card">
                <div class="field-group">
                    <p class="field-label">Full name</p>
                    <input class="field" v-model="form.name" placeholder="e.g. Amelia Nakato" />
                </div>

                <div class="field-group">
                    <p class="field-label">Delivery address</p>
                    <input class="field" v-model="form.address" placeholder="Village / town / district" />
                </div>

                <div class="field-group">
                    <p class="field-label">Region</p>
                    <input class="field" v-model="form.region" placeholder="Central / Eastern / Northern / Western" />
                </div>

                <div v-if="!hasVerifiedIdentifier" class="field-group">
                    <p class="field-label">{{ isPhoneFlow ? 'Phone number' : 'Email address' }}</p>
                    <input class="field" v-model="form.identifier"
                        :placeholder="isPhoneFlow ? 'e.g. +256771234567' : 'you@example.com'"
                        :type="isPhoneFlow ? 'tel' : 'email'" :disabled="verification.busy"
                        @input="handleIdentifierInput" />
                    <button class="btn-secondary" :disabled="!isIdentifierValid || verification.busy"
                        @click="sendVerificationCode">
                        <span v-if="!verification.busy">Send code</span>
                        <span v-else class="dots"><span></span><span></span><span></span></span>
                    </button>
                </div>

                <p v-if="hasVerifiedIdentifier" class="field-hint">
                    Your {{ isPhoneFlow ? 'phone number' : 'email address' }} is already saved from verification.
                    You can update these details any time from your account.
                </p>

                <p v-if="error" class="error-msg">{{ error }}</p>

                <button v-if="hasVerifiedIdentifier" class="btn-primary" :disabled="!canSave || busy" @click="handleSave">
                    <span v-if="!busy">Save and continue</span>
                    <span v-else class="dots"><span></span><span></span><span></span></span>
                </button>
            </div>

            <div v-else class="form-card verification-card">
                <div class="verification-header">
                    <p class="verification-title">Enter verification code</p>
                    <p class="verification-subtitle">We sent a 6-digit code to {{ normalizedIdentifier }}</p>
                </div>

                <input class="field otp-input" v-model="verification.code" placeholder="000000" type="tel"
                    inputmode="numeric" maxlength="6"
                    @input="verification.code = verification.code.replace(/\D/g, '')" />

                <button class="btn-secondary" :disabled="verification.code.length < 6 || verification.busy"
                    @click="verifyIdentifier">
                    <span v-if="!verification.busy">Verify code</span>
                    <span v-else class="dots"><span></span><span></span><span></span></span>
                </button>

                <button class="btn-ghost resend-btn" :disabled="verification.busy" @click="sendVerificationCode">
                    Didn't receive it? Resend
                </button>

                <p v-if="error" class="error-msg">{{ error }}</p>
            </div>

            <button class="btn-ghost" @click="router.push('/account')">Skip for now</button>
        </div>
    </div>
</template>

<script setup>
    import { computed, onMounted, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useAuthStore } from '@/stores/auth'
    import { useGuestCheckoutStore } from '@/stores/guestCheckout'

    const router = useRouter()
    const auth = useAuthStore()
    const guestCheckout = useGuestCheckoutStore()
    const busy = ref(false)
    const error = ref('')
    const otpChannel = import.meta.env.VITE_OTP_CHANNEL === 'phone' ? 'phone' : 'email'
    const isPhoneFlow = otpChannel === 'phone'
    const verifiedIdentifier = computed(() =>
        (isPhoneFlow ? auth.session?.user?.phone : auth.session?.user?.email ?? '').trim(),
    )
    const hasVerifiedIdentifier = computed(() => !!verifiedIdentifier.value)
    const verification = ref({
        sent: false,
        verified: false,
        code: '',
        busy: false,
    })

    const form = ref({ name: '', address: '', region: '', identifier: '' })
    const isIdentifierValid = computed(() =>
        isPhoneFlow ? /^\+?\d{9,15}$/.test(form.value.identifier.trim()) : /.+@.+\..+/.test(form.value.identifier.trim()),
    )
    const normalizedIdentifier = computed(() => {
        const raw = form.value.identifier.trim()
        if (!isPhoneFlow) return raw.toLowerCase()
        return raw.startsWith('+') ? raw : `+${raw}`
    })
    const canSave = computed(() =>
        !!form.value.name.trim() &&
        !!form.value.address.trim() &&
        !!form.value.region.trim() &&
        (hasVerifiedIdentifier.value || verification.value.verified),
    )

    onMounted(() => {
        if (hasVerifiedIdentifier.value) return
        form.value.identifier = isPhoneFlow ? (guestCheckout.contact?.phone ?? '') : ''
    })

    function handleIdentifierInput() {
        verification.value.sent = false
        verification.value.verified = false
        verification.value.code = ''
    }

    function isNoAccountError(message) {
        return /not\s*found|no\s*user|invalid\s*login|signups?\s*not\s*allowed\s*for\s*otp/i.test(message)
    }

    async function sendVerificationCode() {
        error.value = ''
        verification.value.busy = true
        const identifier = normalizedIdentifier.value

        // Probe login-mode OTP first: success means the account already exists.
        const { error: probeErr } = await auth.sendOtp(identifier, 'login')
        if (!probeErr) {
            verification.value.busy = false
            form.value = { name: '', address: '', region: '', identifier: '' }
            verification.value.verified = false
            verification.value.code = ''
            verification.value.sent = false
            await router.push({
                path: '/login',
                query: {
                    reason: 'existing-account',
                    identifier,
                    step: 'otp',
                },
            })
            return
        }

        const probeMessage = (typeof probeErr === 'string' ? probeErr : probeErr?.message) ?? 'Could not check account status.'
        if (!isNoAccountError(probeMessage)) {
            verification.value.busy = false
            error.value = probeMessage
            return
        }

        const { error: signupErr } = await auth.sendOtp(identifier, 'signup')
        verification.value.busy = false
        if (signupErr) {
            const message = (typeof signupErr === 'string' ? signupErr : signupErr?.message) ?? 'Could not send code.'
            error.value = message
            return
        }
        verification.value.sent = true
    }

    async function verifyIdentifier() {
        error.value = ''
        verification.value.busy = true
        const { error: err } = await auth.verifyOtp(normalizedIdentifier.value, verification.value.code, 'signup')
        if (err) {
            verification.value.busy = false
            error.value = (typeof err === 'string' ? err : err?.message) ?? 'Invalid code.'
            return
        }

        const identifierToSave = normalizedIdentifier.value
        const updates = {
            name: form.value.name,
            address: form.value.address,
            region: form.value.region,
            ...(isPhoneFlow ? { phone: identifierToSave } : { email: identifierToSave }),
        }
        const { error: saveErr } = await auth.saveProfile(updates)
        verification.value.busy = false
        if (saveErr) {
            error.value = saveErr.message ?? 'Verification worked but we could not save your profile. Please try again.'
            return
        }

        verification.value.verified = true
        guestCheckout.clearContact()
        await router.push('/account')
    }
    async function handleSave() {
        busy.value = true
        error.value = ''
        const identifierToSave = hasVerifiedIdentifier.value ? verifiedIdentifier.value : normalizedIdentifier.value
        const updates = {
            name: form.value.name,
            address: form.value.address,
            region: form.value.region,
            ...(isPhoneFlow ? { phone: identifierToSave } : { email: identifierToSave }),
        }
        const { error: err } = await auth.saveProfile(updates)
        busy.value = false
        if (err) { error.value = err.message ?? 'Could not save profile.'; return }
        guestCheckout.clearContact()
        router.push('/account')
    }
</script>

<style scoped>
@reference '../main.css';
    .btn-secondary {
        @apply px-4 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 active:bg-green-900 transition-colors;
    }
    .btn-secondary:disabled {
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

    .signup-hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
    }

    .signup-title {
        font-family: 'Lora', serif;
        font-size: 24px;
        font-weight: 600;
    }

    .signup-sub {
        font-size: 14px;
        color: var(--muted);
    }

    .form-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .field-label {
        font-size: 12px;
        font-weight: 600;
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
        padding: 0.5rem 0.5rem;
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

    .field-hint {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.6;
        background: var(--surface2);
        border-radius: 10px;
        padding: 10px 12px;
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
    }

    .btn-ghost {
        background: none;
        border: none;
        font-family: 'Sora', sans-serif;
        font-size: 13px;
        color: var(--muted);
        cursor: pointer;
        text-align: center;
        padding: 8px;
        width: 100%;
    }

    .verification-card {
        background: linear-gradient(135deg, var(--surface) 0%, rgba(62, 207, 142, 0.05) 100%);
        display: flex;
        flex-direction: column;
        gap: 20px;
        align-items: center;
        text-align: center;
    }

    .verification-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .verification-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
    }

    .verification-subtitle {
        font-size: 13px;
        color: var(--muted);
        word-break: break-all;
    }

    .otp-input {
        font-size: 28px;
        font-weight: 600;
        letter-spacing: 8px;
        text-align: center;
        font-family: 'Courier New', monospace;
    }

    .otp-input::placeholder {
        letter-spacing: 8px;
    }

    .resend-btn {
        font-size: 12px;
        margin-top: 8px;
    }

</style>
