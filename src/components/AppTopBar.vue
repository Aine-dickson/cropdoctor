<template>
  <header class="topbar">
    <div class="topbar-left">
      <button v-if="showBack" class="icon-btn" @click="handleBack" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div v-else class="brand" @click="router.push('/')">
        <span class="brand-hex">⬡</span>
        <span class="brand-name">CropDoctor</span>
      </div>
    </div>

    <div class="topbar-center">
      <transition name="title-fade" mode="out-in">
        <span class="page-title" :key="title">{{ title }}</span>
      </transition>
    </div>

    <div class="topbar-right">
      <!-- Cart -->
      <button
        v-if="showCart && cart.count > 0"
        class="icon-btn cart-btn"
        @click="router.push('/cart')"
        aria-label="View cart"
      >
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <path d="M3 3h2l.6 2.5M7.5 14.5h9l2-8H6.1M7.5 14.5L5.6 5.5M7.5 14.5l-2 4.5M16.5 14.5l1.5 4.5M9.5 19a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="cart-count">{{ cart.count }}</span>
      </button>

      <!-- Account -->
      <button
        v-else-if="showAccount"
        class="icon-btn account-btn"
        :class="{ 'logged-in': auth.isLoggedIn }"
        @click="router.push('/account')"
        aria-label="Account"
      >
        <svg v-if="auth.isGuest" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="1.7"/>
          <path d="M3 19c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
        <span v-else class="account-initial">{{ auth.displayName[0].toUpperCase() }}</span>
      </button>

      <div v-else class="icon-btn-spacer"></div>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  title:       { type: String,  default: '' },
  showBack:    { type: Boolean, default: false },
  showCart:    { type: Boolean, default: true },
  showAccount: { type: Boolean, default: true },
  backTo:      { type: String,  default: null },
})

const router = useRouter()
const cart   = useCartStore()
const auth   = useAuthStore()

function handleBack() {
  if (props.backTo) router.push(props.backTo)
  else router.back()
}
</script>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  height: 60px; padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding-top: env(safe-area-inset-top, 0);
}
.topbar-left, .topbar-right { width: 44px; display: flex; align-items: center; }
.topbar-right { justify-content: flex-end; }
.topbar-center { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0 8px; }
.page-title { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.brand-hex  { color: var(--accent); font-size: 18px; line-height: 1; }
.brand-name { font-family: 'Lora', serif; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); }
.icon-btn {
  position: relative; width: 44px; height: 44px; border-radius: 50%;
  border: 1.5px solid var(--border); background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: border-color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.icon-btn:active { border-color: var(--accent); background: var(--accent-lt); color: var(--accent); }
.cart-btn { border-color: var(--accent); background: var(--accent-lt); color: var(--accent); }
.cart-count { position: absolute; top: -3px; right: -3px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; width: 17px; height: 17px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--surface); }
.account-btn.logged-in { border-color: var(--accent); background: var(--accent); color: #fff; }
.account-initial { font-size: 15px; font-weight: 700; color: #fff; }
.icon-btn-spacer { width: 44px; height: 44px; }
.title-fade-enter-active, .title-fade-leave-active { transition: opacity 0.15s; }
.title-fade-enter-from, .title-fade-leave-to { opacity: 0; }
</style>
