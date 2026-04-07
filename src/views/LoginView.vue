<template>
  <div class="view">
    <AppTopBar title="Sign in" :show-back="true" :show-cart="false" back-to="/account" />

    <div class="page">
      <div class="auth-hero">
        <div class="auth-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="14" width="20" height="12" rx="3" stroke="currentColor" stroke-width="1.8"/>
            <path d="M9 14v-4a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="14" cy="20" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <h2 class="auth-title">Welcome back</h2>
        <p class="auth-sub">Enter your phone number to continue</p>
      </div>

      <!-- Step 1: Phone -->
      <transition name="fade" mode="out-in">
        <div v-if="step === 'phone'" key="phone" class="form-card">
          <p class="field-label">Phone number</p>
          <div class="phone-row">
            <span class="phone-prefix">+256</span>
            <input
              ref="phoneInput"
              class="field phone-field"
              v-model="phoneLocal"
              placeholder="7X XXX XXXX"
              type="tel"
              inputmode="numeric"
              maxlength="9"
              @input="phoneLocal = phoneLocal.replace(/\D/g, '')"
            />
          </div>
          <p v-if="error" class="error-msg">{{ error }}</p>
          <button class="btn-primary" :disabled="phoneLocal.length < 9 || busy" @click="handleSendOtp">
            <span v-if="!busy">Send verification code</span>
            <span v-else class="dots"><span></span><span></span><span></span></span>
          </button>
          <p class="mock-hint" v-if="isMock">Mock mode — any number works</p>
        </div>

        <!-- Step 2: OTP -->
        <div v-else-if="step === 'otp'" key="otp" class="form-card">
          <p class="otp-sent">Code sent to <strong>+256 {{ phoneLocal }}</strong></p>
          <p class="field-label">Enter 6-digit code</p>
          <input
            class="field otp-field"
            v-model="otp"
            placeholder="123456"
            type="tel"
            inputmode="numeric"
            maxlength="6"
            @input="otp = otp.replace(/\D/g, '')"
          />
          <p v-if="error" class="error-msg">{{ error }}</p>
          <button class="btn-primary" :disabled="otp.length < 6 || busy" @click="handleVerify">
            <span v-if="!busy">Verify code</span>
            <span v-else class="dots"><span></span><span></span><span></span></span>
          </button>
          <button class="btn-ghost" @click="step = 'phone'; otp = ''; error = ''">
            ← Change number
          </button>
          <p class="mock-hint" v-if="isMock">Mock code: <strong>123456</strong></p>
        </div>
      </transition>

      <div class="divider"><span>Don't have an account?</span></div>
      <button class="btn-secondary" @click="router.push('/signup')">Create account</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

const router  = useRouter()
const auth    = useAuthStore()
const isMock  = !supabase

const step       = ref('phone')
const phoneLocal = ref('')
const otp        = ref('')
const busy       = ref(false)
const error      = ref('')

async function handleSendOtp() {
  busy.value  = true
  error.value = ''
  const phone = '+256' + phoneLocal.value
  const { error: err } = await auth.sendOtp(phone)
  busy.value = false
  if (err) { error.value = err.message; return }
  step.value = 'otp'
}

async function handleVerify() {
  busy.value  = true
  error.value = ''
  const phone = '+256' + phoneLocal.value
  const { error: err, isNew } = await auth.verifyOtp(phone, otp.value)
  busy.value = false
  if (err) { error.value = err.message; return }
  if (isNew) router.push('/signup')
  else       router.push('/account')
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 32px 16px 80px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.auth-hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 0 8px; }
.auth-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--accent-lt); color: var(--accent); border: 2px solid rgba(45,122,58,0.2); display: flex; align-items: center; justify-content: center; }
.auth-title { font-family: 'Lora', serif; font-size: 24px; font-weight: 600; }
.auth-sub { font-size: 14px; color: var(--muted); text-align: center; }
.form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
.phone-row { display: flex; align-items: center; gap: 0; }
.phone-prefix { background: var(--surface2); border: 2px solid var(--border); border-right: none; border-radius: 12px 0 0 12px; padding: 16px 12px; font-size: 16px; font-weight: 600; color: var(--text); flex-shrink: 0; }
.phone-field { border-radius: 0 12px 12px 0 !important; flex: 1; }
.field { width: 100%; font-family: 'Sora', sans-serif; font-size: 16px; background: var(--surface2); border: 2px solid var(--border); border-radius: 12px; padding: 16px 14px; color: var(--text); transition: border-color 0.2s; -webkit-appearance: none; }
.field:focus { outline: none; border-color: var(--accent); }
.field::placeholder { color: var(--muted); }
.otp-field { text-align: center; letter-spacing: 0.3em; font-size: 22px; font-weight: 600; }
.otp-sent { font-size: 13px; color: var(--muted); text-align: center; }
.otp-sent strong { color: var(--text); }
.error-msg { font-size: 13px; color: var(--danger); text-align: center; }
.mock-hint { font-size: 12px; color: var(--muted); text-align: center; background: var(--surface2); border-radius: 8px; padding: 8px; }
.mock-hint strong { color: var(--accent); }
.btn-ghost { background: none; border: none; font-family: 'Sora', sans-serif; font-size: 13px; color: var(--muted); cursor: pointer; text-align: center; padding: 4px; }
.divider { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
</style>
