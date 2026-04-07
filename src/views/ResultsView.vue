<template>
  <div class="view">
    <AppTopBar title="Results" :show-back="true" back-to="/" />

    <div v-if="!detection.result" class="page center-msg">
      <p>No results yet. <router-link to="/">Scan a crop</router-link></p>
    </div>

    <div v-else class="page">
      <div class="disease-card">
        <div class="disease-thumb">
          <img :src="detection.previewUrl" alt="Scanned crop" class="thumb-img" />
          <span class="sev-badge" :class="sevClass">{{ detection.result.severity }}</span>
        </div>
        <div class="disease-info">
          <p class="info-label">Detected disease</p>
          <h2 class="disease-name">{{ detection.result.disease }}</h2>
          <p class="disease-plant">on {{ detection.result.plant }}</p>
          <div class="conf-row">
            <div class="conf-track"><div class="conf-fill" :style="{ width: detection.result.confidence + '%' }"></div></div>
            <span class="conf-num">{{ detection.result.confidence }}%</span>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h3 class="section-title">What this means</h3>
        <p class="advice-summary">{{ detection.result.advice.summary }}</p>
        <ul class="advice-steps">
          <li v-for="(s, i) in detection.result.advice.steps" :key="i">
            <span class="step-num">{{ i + 1 }}</span><span>{{ s }}</span>
          </li>
        </ul>
      </div>

      <div class="bridge-card">
        <div class="bridge-head">
          <span class="bridge-icon">💊</span>
          <div>
            <h3 class="bridge-title">Recommended treatments</h3>
            <p class="bridge-sub">Products that treat {{ detection.result.disease }}</p>
          </div>
        </div>
        <div class="product-list">
          <div class="product-row" v-for="p in detection.result.products" :key="p.id" @click="router.push('/product/' + p.id)">
            <span class="top-pick" v-if="p.topPick">Top pick</span>
            <div class="product-emoji-wrap">{{ p.emoji }}</div>
            <div class="product-info">
              <p class="product-name">{{ p.name }}</p>
              <p class="product-type">{{ p.type }}</p>
              <p class="product-price">UGX {{ p.price.toLocaleString() }}</p>
            </div>
            <button class="btn-add" :class="{ added: cart.inCart(p.id) }" @click.stop="cart.add(p)">
              {{ cart.inCart(p.id) ? '✓ Added' : '+ Add' }}
            </button>
            <svg class="row-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <button v-if="cart.count > 0" class="btn-primary" @click="router.push('/cart')">
          View cart · {{ cart.count }} item{{ cart.count > 1 ? 's' : '' }} — UGX {{ cart.total.toLocaleString() }}
        </button>
      </div>

      <div class="feedback-row">
        <span class="feedback-label">Detection wrong?</span>
        <button class="btn-flag" @click="showFeedback = !showFeedback">Flag result</button>
      </div>
      <transition name="slide-down">
        <div v-if="showFeedback" class="feedback-form">
          <p class="feedback-q">What is it actually?</p>
          <select v-model="correction" class="select-field">
            <option value="">— select correct disease —</option>
            <option v-for="d in diseaseOptions" :key="d" :value="d">{{ d }}</option>
            <option value="healthy">No disease / healthy plant</option>
            <option value="other">Other</option>
          </select>
          <button class="btn-secondary" :disabled="!correction" @click="submitFeedback">Submit correction</button>
          <p v-if="feedbackSent" class="feedback-thanks">✓ Thank you — this helps us improve.</p>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useDetectionStore } from '@/stores/detection'
import { useCartStore } from '@/stores/cart'

const router    = useRouter()
const detection = useDetectionStore()
const cart      = useCartStore()
const showFeedback = ref(false)
const correction   = ref('')
const feedbackSent = ref(false)
const diseaseOptions = ['Late Blight','Early Blight','Leaf Spot','Powdery Mildew','Downy Mildew','Rust','Anthracnose','Root Rot','Bacterial Wilt','Mosaic Virus','Yellow Leaf Curl']

const sevClass = computed(() => {
  const s = detection.result?.severity?.toLowerCase()
  return s === 'high' ? 'sev-high' : s === 'medium' ? 'sev-med' : 'sev-low'
})

function submitFeedback() {
  console.log('Feedback:', { detected: detection.result.disease, correct: correction.value })
  feedbackSent.value = true
  showFeedback.value = false
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 20px 16px 100px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.center-msg { align-items: center; justify-content: center; font-size: 15px; color: var(--muted); }
.center-msg a { color: var(--accent); }
.disease-card { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 18px; }
.disease-thumb { position: relative; flex-shrink: 0; }
.thumb-img { width: 82px; height: 82px; border-radius: 14px; object-fit: cover; display: block; }
.sev-badge { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
.sev-high { background: #fde8e8; color: var(--danger); }
.sev-med  { background: #fef3e2; color: var(--warn); }
.sev-low  { background: var(--accent-lt); color: var(--accent); }
.disease-info { flex: 1; min-width: 0; }
.info-label   { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 4px; }
.disease-name { font-family: 'Lora', serif; font-size: 22px; font-weight: 600; line-height: 1.1; margin-bottom: 2px; }
.disease-plant { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
.conf-row   { display: flex; align-items: center; gap: 8px; }
.conf-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.conf-fill  { height: 100%; background: var(--accent); border-radius: 3px; transition: width 1s ease; }
.conf-num   { font-size: 12px; font-weight: 600; color: var(--accent); white-space: nowrap; }
.section-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 18px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.advice-summary { font-size: 13.5px; line-height: 1.65; color: var(--muted); margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.advice-steps { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.advice-steps li { display: flex; gap: 10px; font-size: 13px; line-height: 1.5; align-items: flex-start; }
.step-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--accent-lt); color: var(--accent); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.bridge-card { background: var(--surface); border: 2px solid var(--accent); border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.bridge-head { display: flex; align-items: flex-start; gap: 12px; }
.bridge-icon  { font-size: 24px; }
.bridge-title { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
.bridge-sub   { font-size: 12px; color: var(--muted); }
.product-list { display: flex; flex-direction: column; gap: 10px; }
.product-row { position: relative; display: flex; align-items: center; gap: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 14px; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: background 0.15s, border-color 0.15s; }
.product-row:active { background: var(--accent-lt); border-color: var(--accent); }
.top-pick { position: absolute; top: -8px; left: 12px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
.product-emoji-wrap { width: 46px; height: 46px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.product-info  { flex: 1; min-width: 0; }
.product-name  { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-type  { font-size: 11px; color: var(--muted); margin-top: 1px; }
.product-price { font-size: 13px; font-weight: 600; color: var(--accent); margin-top: 3px; }
.btn-add { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; padding: 0 12px; height: 44px; border-radius: 10px; border: 2px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; white-space: nowrap; flex-shrink: 0; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.btn-add.added, .btn-add:active { background: var(--accent); color: #fff; }
.row-chevron { color: var(--muted); flex-shrink: 0; }
.feedback-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--border); }
.feedback-label { font-size: 12px; color: var(--muted); }
.btn-flag { font-family: 'Sora', sans-serif; font-size: 12px; color: var(--danger); background: none; border: 1px solid rgba(192,57,43,0.3); border-radius: 8px; padding: 8px 14px; cursor: pointer; }
.feedback-form { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.feedback-q { font-size: 13px; font-weight: 500; }
.select-field { font-family: 'Sora', sans-serif; font-size: 14px; background: var(--surface2); border: 1.5px solid var(--border); border-radius: 10px; padding: 13px 12px; color: var(--text); width: 100%; -webkit-appearance: none; }
.feedback-thanks { font-size: 12px; color: var(--accent); }
.slide-down-enter-active { transition: all 0.25s ease; }
.slide-down-enter-from { opacity: 0; transform: translateY(-8px); }
</style>
