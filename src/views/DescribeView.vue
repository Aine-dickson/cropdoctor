<template>
  <div class="view">
    <AppTopBar title="Describe symptoms" :show-back="true" />

    <div class="page">
      <div class="hero">
        <p class="hero-sub">Describe what you see on your crops — leaves, stems, colour changes, spots. Claude will identify the likely disease and suggest treatments.</p>
      </div>

      <div class="input-card">
        <textarea
          class="describe-input"
          v-model="description"
          placeholder="e.g. My tomato leaves have brown spots with yellow rings around them. The spots are dry and spreading to other leaves. Started about 3 days ago after rain…"
          rows="5"
        ></textarea>
        <div class="char-count">{{ description.length }} / 500</div>
      </div>

      <!-- Examples -->
      <div class="examples" v-if="!description">
        <p class="examples-title">Example descriptions</p>
        <button
          class="example-chip"
          v-for="e in examples"
          :key="e"
          @click="description = e"
        >{{ e }}</button>
      </div>

      <button class="btn-primary" :disabled="description.length < 10 || analysing" @click="analyse">
        <span v-if="!analysing">Identify disease</span>
        <span v-else class="dots"><span></span><span></span><span></span></span>
      </button>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Result -->
      <transition name="slide-down">
        <div v-if="result" class="result-section">
          <div class="result-header">
            <span class="result-tag">Likely diagnosis</span>
            <h2 class="result-name">{{ result.disease }}</h2>
            <p class="result-confidence">{{ result.confidence }} confidence</p>
          </div>

          <div class="section-card">
            <h3 class="section-title">What this means</h3>
            <p class="advice-text">{{ result.advice }}</p>
          </div>

          <div class="bridge-card">
            <div class="bridge-head">
              <span>💊</span>
              <div>
                <h3 class="bridge-title">Recommended treatments</h3>
              </div>
            </div>
            <div class="product-list">
              <div
                class="product-row"
                v-for="p in result.medicines"
                :key="p.id"
                @click="router.push('/product/' + p.id)"
              >
                <div class="product-emoji-wrap">{{ p.emoji }}</div>
                <div class="product-info">
                  <p class="product-name">{{ p.name }}</p>
                  <p class="product-type">{{ p.type }}</p>
                  <p class="product-price">UGX {{ p.price.toLocaleString() }}</p>
                </div>
                <button class="btn-add" :class="{ added: cart.inCart(p.id) }" @click.stop="cart.add(p)">
                  {{ cart.inCart(p.id) ? '✓' : '+' }}
                </button>
              </div>
            </div>
            <button v-if="cart.count > 0" class="btn-primary" @click="router.push('/cart')">
              View cart · {{ cart.count }} item{{ cart.count > 1 ? 's' : '' }}
            </button>
          </div>

          <button class="btn-secondary" @click="result = null; description = ''">
            Describe another symptom
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppTopBar from '@/components/AppTopBar.vue'
import { useCartStore } from '@/stores/cart'

const router      = useRouter()
const cart        = useCartStore()
const description = ref('')
const analysing   = ref(false)
const result      = ref(null)
const error       = ref('')

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || 'YOUR_ANTHROPIC_KEY'

const catalogue = [
  { id: 1, name: 'Ridomil Gold 68WG',  emoji: '🟡', type: 'Systemic fungicide',   price: 28000, diseases: ['Late Blight','Downy Mildew'] },
  { id: 2, name: 'Copper Oxychloride', emoji: '🔵', type: 'Contact fungicide',    price: 12000, diseases: ['Late Blight','Early Blight','Leaf Spot','Rust'] },
  { id: 3, name: 'Mancozeb 80WP',      emoji: '🟤', type: 'Protective fungicide', price: 9500,  diseases: ['Late Blight','Early Blight'] },
  { id: 4, name: 'Amistar 250SC',      emoji: '🟣', type: 'Broad-spectrum',       price: 34000, diseases: ['Rust','Powdery Mildew','Late Blight','Early Blight'] },
  { id: 5, name: 'Dithane M-45',       emoji: '🟠', type: 'Multi-disease',        price: 11000, diseases: ['Leaf Spot','Anthracnose','Early Blight'] },
  { id: 6, name: 'Actara 25WG',        emoji: '⚪', type: 'Insecticide',          price: 22000, diseases: ['Mosaic Virus','Yellow Leaf Curl'] },
]

const examples = [
  'My maize leaves have white powdery coating on top. Spreading fast.',
  'Tomato leaves yellowing from bottom up with small brown spots.',
  'Bean pods have rust-coloured spots. Leaves also affected.',
]

async function analyse() {
  analysing.value = true
  error.value     = ''
  result.value    = null

  try {
    if (ANTHROPIC_KEY === 'YOUR_ANTHROPIC_KEY') {
      await new Promise(r => setTimeout(r, 1400))
      result.value = {
        disease:    'Early Blight (Alternaria solani)',
        confidence: 'High',
        advice:     'Early Blight causes dark brown lesions with concentric rings, usually starting on older lower leaves. It thrives in warm, humid weather and spreads through rain splash. Remove infected leaves immediately and apply fungicide.',
        medicines:  catalogue.slice(1, 4),
      }
      return
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 400,
        system: `Ugandan crop disease expert. A farmer describes symptoms. Respond ONLY with JSON:
{"disease":"most likely disease name","confidence":"High|Medium|Low","advice":"2 sentence plain explanation","diseaseKeywords":["keyword1","keyword2"]}`,
        messages: [{ role: 'user', content: description.value }],
      }),
    })
    const data = await res.json()
    const ai   = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())

    const medicines = catalogue.filter(p =>
      p.diseases.some(d =>
        ai.diseaseKeywords?.some(k => d.toLowerCase().includes(k.toLowerCase())) ||
        ai.disease.toLowerCase().includes(d.toLowerCase())
      )
    )

    result.value = {
      disease:    ai.disease,
      confidence: ai.confidence,
      advice:     ai.advice,
      medicines:  medicines.length ? medicines : catalogue.slice(0, 3),
    }
  } catch (e) {
    error.value = e.message || 'Could not analyse description. Please try again.'
  } finally {
    analysing.value = false
  }
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.page { flex: 1; padding: 16px 16px 100px; max-width: 480px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.hero-sub { font-size: 14px; color: var(--muted); line-height: 1.65; }
.input-card { background: var(--surface); border: 2px solid var(--accent); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.describe-input { font-family: 'Sora', sans-serif; font-size: 15px; border: none; background: none; color: var(--text); resize: none; outline: none; line-height: 1.6; width: 100%; }
.describe-input::placeholder { color: var(--muted); }
.char-count { font-size: 11px; color: var(--muted); text-align: right; }
.examples { display: flex; flex-direction: column; gap: 8px; }
.examples-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.example-chip { font-family: 'Sora', sans-serif; font-size: 12px; text-align: left; padding: 10px 14px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; line-height: 1.5; -webkit-tap-highlight-color: transparent; }
.example-chip:active { border-color: var(--accent); color: var(--text); background: var(--accent-lt); }
.error-msg { font-size: 13px; color: var(--danger); text-align: center; }
.result-section { display: flex; flex-direction: column; gap: 14px; }
.result-header { display: flex; flex-direction: column; gap: 4px; }
.result-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: #fef3e2; color: var(--warn); padding: 3px 10px; border-radius: 20px; align-self: flex-start; }
.result-name { font-family: 'Lora', serif; font-size: 22px; font-weight: 600; line-height: 1.2; }
.result-confidence { font-size: 12px; color: var(--muted); }
.section-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.section-title { font-size: 14px; font-weight: 600; }
.advice-text { font-size: 13.5px; color: var(--muted); line-height: 1.65; }
.bridge-card { background: var(--surface); border: 2px solid var(--accent); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.bridge-head { display: flex; align-items: center; gap: 10px; font-size: 22px; }
.bridge-title { font-size: 15px; font-weight: 600; }
.product-list { display: flex; flex-direction: column; gap: 10px; }
.product-row { display: flex; align-items: center; gap: 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.product-row:active { background: var(--accent-lt); border-color: var(--accent); }
.product-emoji-wrap { width: 44px; height: 44px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.product-info  { flex: 1; min-width: 0; }
.product-name  { font-size: 13px; font-weight: 600; }
.product-type  { font-size: 11px; color: var(--muted); }
.product-price { font-size: 13px; font-weight: 600; color: var(--accent); margin-top: 3px; }
.btn-add { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; width: 36px; height: 36px; border-radius: 10px; border: 2px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
.btn-add.added, .btn-add:active { background: var(--accent); color: #fff; }
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-enter-from   { opacity: 0; transform: translateY(-10px); }
</style>
