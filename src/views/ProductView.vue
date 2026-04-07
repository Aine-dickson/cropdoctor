<template>
  <div class="view">
    <AppTopBar :title="product?.name || 'Product'" :show-back="true" back-to="/results" />

    <div v-if="!product" class="page center-msg">
      <p>Product not found. <router-link to="/results">Back to results</router-link></p>
    </div>

    <div v-else class="page">
      <div class="hero-band">
        <span class="hero-emoji">{{ product.emoji }}</span>
        <span v-if="product.topPick" class="hero-badge">Top pick</span>
      </div>

      <div class="body-card">
        <div class="header-row">
          <div>
            <p class="product-tag">{{ product.type }}</p>
            <h2 class="product-title">{{ product.name }}</h2>
          </div>
          <p class="product-price">UGX {{ product.price.toLocaleString() }}</p>
        </div>

        <p class="product-desc">{{ product.description }}</p>

        <div class="meta-grid">
          <div class="meta-cell"><p class="meta-label">Treats</p><p class="meta-val">{{ product.treats }}</p></div>
          <div class="meta-cell"><p class="meta-label">Application</p><p class="meta-val">{{ product.application }}</p></div>
          <div class="meta-cell"><p class="meta-label">Dosage</p><p class="meta-val">{{ product.dosage }}</p></div>
          <div class="meta-cell"><p class="meta-label">Supplier</p><p class="meta-val">{{ product.supplier }}</p></div>
        </div>

        <div class="qty-row">
          <span class="qty-label">Quantity</span>
          <div class="qty-control">
            <button class="qty-btn" @click="qty = Math.max(1, qty - 1)">−</button>
            <span class="qty-num">{{ qty }}</span>
            <button class="qty-btn" @click="qty++">+</button>
          </div>
          <span class="qty-sub">UGX {{ (product.price * qty).toLocaleString() }}</span>
        </div>

        <button class="btn-primary" @click="handleAdd">
          {{ cart.inCart(product.id) ? `Update cart` : `Add to cart` }}
        </button>
        <button class="btn-secondary" @click="router.back()">Back to results</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useDetectionStore } from '@/stores/detection'
import { useCartStore } from '@/stores/cart'

const route     = useRoute()
const router    = useRouter()
const detection = useDetectionStore()
const cart      = useCartStore()
const qty       = ref(1)

const product = computed(() => detection.getById(route.params.id))

function handleAdd() {
  cart.setQty(product.value.id, qty.value) || cart.add(product.value, qty.value)
  router.push('/results')
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 0 0 100px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 0; }
.center-msg { padding: 40px 16px; align-items: center; justify-content: center; font-size: 15px; color: var(--muted); }
.center-msg a { color: var(--accent); }
.hero-band { position: relative; background: var(--accent-lt); height: 180px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(45,122,58,0.15); }
.hero-emoji { font-size: 80px; line-height: 1; }
.hero-badge { position: absolute; top: 16px; right: 16px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
.body-card { background: var(--surface); border-top: 0; padding: 22px 16px; display: flex; flex-direction: column; gap: 18px; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.product-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 4px; font-weight: 600; }
.product-title { font-family: 'Lora', serif; font-size: 22px; font-weight: 600; line-height: 1.2; }
.product-price { font-size: 20px; font-weight: 700; color: var(--accent); white-space: nowrap; }
.product-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.meta-cell { background: var(--surface2); border-radius: 12px; padding: 12px; border: 1px solid var(--border); }
.meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 4px; }
.meta-val { font-size: 13px; font-weight: 500; line-height: 1.3; }
.qty-row { display: flex; align-items: center; gap: 12px; }
.qty-label { font-size: 14px; font-weight: 500; }
.qty-control { display: flex; align-items: center; gap: 14px; margin-left: auto; }
.qty-btn { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--accent); background: transparent; color: var(--accent); font-size: 20px; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.qty-btn:active { background: var(--accent); color: #fff; }
.qty-num { font-size: 18px; font-weight: 600; min-width: 28px; text-align: center; }
.qty-sub { font-size: 16px; font-weight: 700; color: var(--accent); }
</style>
