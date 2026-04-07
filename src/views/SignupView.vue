<template>
  <div class="view">
    <AppTopBar title="Create account" :show-back="true" :show-cart="false" back-to="/login" />

    <div class="page">
      <div class="signup-hero">
        <h2 class="signup-title">Almost done</h2>
        <p class="signup-sub">A few details to complete your profile</p>
      </div>

      <div class="form-card">
        <div class="field-group">
          <p class="field-label">Full name</p>
          <input class="field" v-model="form.name" placeholder="e.g. Amelia Nakato" />
        </div>

        <div class="field-group">
          <p class="field-label">Delivery address</p>
          <input class="field" v-model="form.address" placeholder="Village / town / district" />
        </div>

        <p class="field-hint">
          Your phone number is already saved from verification.
          You can update these details any time from your account.
        </p>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn-primary" :disabled="!form.name || !form.address || busy" @click="handleSave">
          <span v-if="!busy">Save and continue</span>
          <span v-else class="dots"><span></span><span></span><span></span></span>
        </button>
      </div>

      <button class="btn-ghost" @click="router.push('/account')">Skip for now</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth   = useAuthStore()
const busy   = ref(false)
const error  = ref('')

const form = ref({ name: '', address: '' })

async function handleSave() {
  busy.value  = true
  error.value = ''
  const { error: err } = await auth.saveProfile({
    name:    form.value.name,
    address: form.value.address,
    phone:   auth.session?.user?.phone ?? '',
  })
  busy.value = false
  if (err) { error.value = err.message ?? 'Could not save profile.'; return }
  router.push('/account')
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 32px 16px 80px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.signup-hero { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; }
.signup-title { font-family: 'Lora', serif; font-size: 24px; font-weight: 600; }
.signup-sub   { font-size: 14px; color: var(--muted); }
.form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
.field { width: 100%; font-family: 'Sora', sans-serif; font-size: 16px; background: var(--surface2); border: 2px solid var(--border); border-radius: 12px; padding: 16px 14px; color: var(--text); transition: border-color 0.2s; -webkit-appearance: none; }
.field:focus { outline: none; border-color: var(--accent); }
.field::placeholder { color: var(--muted); }
.field-hint { font-size: 12px; color: var(--muted); line-height: 1.6; background: var(--surface2); border-radius: 10px; padding: 10px 12px; }
.error-msg { font-size: 13px; color: var(--danger); text-align: center; }
.btn-ghost { background: none; border: none; font-family: 'Sora', sans-serif; font-size: 13px; color: var(--muted); cursor: pointer; text-align: center; padding: 8px; width: 100%; }
</style>
