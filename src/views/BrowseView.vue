<template>
  <div class="view">
    <AppTopBar title="Browse medicines" :show-back="true" />

    <div class="page">
      <!-- Filter pills -->
      <div class="filters">
        <button
          class="pill"
          :class="{ active: activeFilter === f.key }"
          v-for="f in filters"
          :key="f.key"
          @click="activeFilter = f.key"
        >{{ f.label }}</button>
      </div>

      <!-- Product grid -->
      <div class="product-list">
        <div
          class="product-card"
          v-for="p in filtered"
          :key="p.id"
          @click="router.push('/product/' + p.id)"
        >
          <div class="card-top">
            <span class="card-emoji">{{ p.emoji }}</span>
            <span class="type-pill">{{ p.type }}</span>
          </div>
          <p class="card-name">{{ p.name }}</p>
          <p class="card-treats">Treats: {{ p.treats }}</p>
          <div class="card-footer">
            <p class="card-price">UGX {{ p.price.toLocaleString() }}</p>
            <button class="btn-add" :class="{ added: cart.inCart(p.id) }" @click.stop="cart.add(p)">
              {{ cart.inCart(p.id) ? '✓' : '+' }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="!filtered.length" class="empty-msg">No products match this filter.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useCartStore } from '@/stores/cart'

const router = useRouter()
const cart   = useCartStore()
const activeFilter = ref('all')

const filters = [
  { key: 'all',        label: 'All' },
  { key: 'fungicide',  label: 'Fungicide' },
  { key: 'systemic',   label: 'Systemic' },
  { key: 'contact',    label: 'Contact' },
  { key: 'insecticide',label: 'Insecticide' },
]

const catalogue = [
  { id: 1, name: 'Ridomil Gold 68WG',  emoji: '🟡', type: 'Systemic fungicide',   price: 28000, treats: 'Late Blight, Downy Mildew',      category: ['fungicide','systemic'],   diseases: ['Late Blight','Downy Mildew'] },
  { id: 2, name: 'Copper Oxychloride', emoji: '🔵', type: 'Contact fungicide',    price: 12000, treats: 'Blight, Leaf Spot, Rust',         category: ['fungicide','contact'],    diseases: ['Late Blight','Early Blight','Leaf Spot','Rust'] },
  { id: 3, name: 'Mancozeb 80WP',      emoji: '🟤', type: 'Protective fungicide', price: 9500,  treats: 'Early & Late Blight',             category: ['fungicide','contact'],    diseases: ['Late Blight','Early Blight'] },
  { id: 4, name: 'Amistar 250SC',      emoji: '🟣', type: 'Broad-spectrum',       price: 34000, treats: 'Rust, Powdery Mildew, Blight',    category: ['fungicide','systemic'],   diseases: ['Rust','Powdery Mildew','Late Blight','Early Blight'] },
  { id: 5, name: 'Dithane M-45',       emoji: '🟠', type: 'Multi-disease',        price: 11000, treats: 'Leaf Spot, Anthracnose',          category: ['fungicide','contact'],    diseases: ['Leaf Spot','Anthracnose','Early Blight'] },
  { id: 6, name: 'Actara 25WG',        emoji: '⚪', type: 'Insecticide',          price: 22000, treats: 'Whitefly (virus vector)',          category: ['insecticide'],            diseases: ['Mosaic Virus','Yellow Leaf Curl'] },
]

const filtered = computed(() => {
  if (activeFilter.value === 'all') return catalogue
  return catalogue.filter(p => p.category.includes(activeFilter.value))
})
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 16px 16px 100px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.filters { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.filters::-webkit-scrollbar { display: none; }
.pill { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 20px; border: 2px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
.pill.active { border-color: var(--accent); color: var(--accent); background: var(--accent-lt); }
.pill:active { border-color: var(--accent); color: var(--accent); }
.product-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.product-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 18px; padding: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 8px; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.product-card:active { border-color: var(--accent); background: var(--accent-lt); }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; }
.card-emoji { font-size: 28px; }
.type-pill { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; background: var(--surface2); color: var(--muted); padding: 3px 7px; border-radius: 20px; border: 1px solid var(--border); text-align: right; max-width: 80px; }
.card-name   { font-size: 14px; font-weight: 600; line-height: 1.3; }
.card-treats { font-size: 11px; color: var(--muted); line-height: 1.4; flex: 1; }
.card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.card-price  { font-size: 14px; font-weight: 700; color: var(--accent); }
.btn-add { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; width: 36px; height: 36px; border-radius: 10px; border: 2px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
.btn-add.added, .btn-add:active { background: var(--accent); color: #fff; }
.empty-msg { text-align: center; font-size: 14px; color: var(--muted); padding: 40px 0; }
</style>
