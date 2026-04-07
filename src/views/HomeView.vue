<template>
  <div class="view">
    <!-- Top bar: logo + account -->
    <header class="home-topbar">
      <div class="brand">
        <span class="brand-hex">⬡</span>
        <span class="brand-name">CropDoctor</span>
      </div>
      <button
        class="account-btn"
        :class="{ 'logged-in': auth.isLoggedIn }"
        @click="router.push('/account')"
      >
        <svg v-if="auth.isGuest" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="1.7"/>
          <path d="M3 19c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
        <span v-else class="account-initial">{{ auth.displayName[0].toUpperCase() }}</span>
      </button>
    </header>

    <div class="page">
      <!-- Greeting -->
      <div class="greeting">
        <h1 class="greeting-title">
          {{ auth.isLoggedIn ? 'Hello, ' + auth.profile?.name?.split(' ')[0] + ' 👋' : 'Hello, Farmer 👋' }}
        </h1>
        <p class="greeting-sub">How can we help your crops today?</p>
      </div>

      <!-- Inline search bar -->
      <div class="search-bar" @click="router.push('/search')">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M12.5 12.5l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span class="search-placeholder">Search disease or medicine…</span>
      </div>

      <!-- Entry cards -->
      <div class="entry-grid">
        <div class="entry-card primary" @click="router.push('/')">
          <div class="entry-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="7" width="22" height="17" rx="3" stroke="currentColor" stroke-width="1.7"/>
              <circle cx="14" cy="15" r="4" stroke="currentColor" stroke-width="1.7"/>
              <path d="M10 7V5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="entry-title">Scan a crop</p>
          <p class="entry-desc">Take a photo — AI identifies the disease instantly</p>
        </div>

        <div class="entry-card" @click="router.push('/describe')">
          <div class="entry-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" stroke-width="1.7"/>
              <path d="M8 10h12M8 14h9M8 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="entry-title">Describe symptoms</p>
          <p class="entry-desc">Explain what you see — no photo needed</p>
        </div>

        <div class="entry-card" @click="router.push('/search')">
          <div class="entry-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="13" cy="13" r="8" stroke="currentColor" stroke-width="1.7"/>
              <path d="M19 19l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="entry-title">Search by name</p>
          <p class="entry-desc">Know the disease or drug? Search directly</p>
        </div>

        <div class="entry-card" @click="router.push('/browse')">
          <div class="entry-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.7"/>
              <rect x="15" y="3" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.7"/>
              <rect x="3" y="15" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.7"/>
              <rect x="15" y="15" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.7"/>
            </svg>
          </div>
          <p class="entry-title">Browse medicines</p>
          <p class="entry-desc">Full catalogue — filter by type or crop</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth   = useAuthStore()
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }

.home-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding-top: calc(14px + env(safe-area-inset-top, 0));
}
.brand { display: flex; align-items: center; gap: 7px; }
.brand-hex  { color: var(--accent); font-size: 20px; }
.brand-name { font-family: 'Lora', serif; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }

.account-btn {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1.5px solid var(--border); background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--muted);
  -webkit-tap-highlight-color: transparent;
}
.account-btn.logged-in { background: var(--accent); border-color: var(--accent); color: #fff; }
.account-btn:active { border-color: var(--accent); }
.account-initial { font-size: 16px; font-weight: 700; color: #fff; }

.page { flex: 1; padding: 24px 16px 100px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

.greeting-title { font-family: 'Lora', serif; font-size: 26px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 4px; }
.greeting-sub   { font-size: 14px; color: var(--muted); }

.search-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 2px solid var(--border);
  border-radius: 14px; padding: 14px 16px;
  cursor: pointer; color: var(--muted);
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s;
}
.search-bar:active { border-color: var(--accent); }
.search-placeholder { font-size: 15px; color: var(--muted); }

.entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.entry-card {
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: 18px; padding: 18px 14px;
  cursor: pointer; display: flex; flex-direction: column; gap: 10px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: border-color 0.15s, background 0.15s;
}
.entry-card:active { border-color: var(--accent); background: var(--accent-lt); }
.entry-card.primary { border-color: var(--accent); background: var(--accent-lt); grid-column: span 2; flex-direction: row; align-items: center; gap: 16px; }
.entry-card.primary .entry-desc { flex: 1; }

.entry-icon { color: var(--accent); flex-shrink: 0; }
.entry-title { font-size: 14px; font-weight: 600; color: var(--text); }
.entry-desc  { font-size: 12px; color: var(--muted); line-height: 1.5; }
</style>
