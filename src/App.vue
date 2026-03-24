<template>
    <div class="crop-doctor">
        <!-- Background grain -->
        <div class="grain"></div>

        <header class="header">
            <div class="logo">
                <span class="logo-leaf">⬡</span>
                <span class="logo-text">CropDoctor</span>
            </div>
            <p class="tagline">AI-powered disease detection for your crops</p>
        </header>

        <main class="main">
            <!-- Upload Zone -->
            <section class="upload-zone" :class="{ dragging, hasImage: previewUrl }" @dragover.prevent="dragging = true"
                @dragleave="dragging = false" @drop.prevent="onDrop" @click="$refs.fileInput.click()">
                <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />

                <transition name="fade" mode="out-in">
                    <div v-if="!previewUrl" key="empty" class="upload-prompt">
                        <div class="upload-icon">
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <path d="M20 8v16M13 15l7-7 7 7" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M8 28v2a2 2 0 002 2h20a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" />
                            </svg>
                        </div>
                        <p class="upload-title">Drop a crop photo here</p>
                        <p class="upload-sub">or click to browse · JPG, PNG, WEBP</p>
                    </div>

                    <div v-else key="preview" class="preview-wrap">
                        <img :src="previewUrl" alt="Crop preview" class="preview-img" />
                        <button class="change-btn" @click.stop="reset">✕ Change photo</button>
                    </div>
                </transition>
            </section>

            <!-- Analyze Button -->
            <button class="analyze-btn" :disabled="!previewUrl || loading" @click="analyze">
                <span v-if="!loading">Analyze crop</span>
                <span v-else class="btn-loading">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </span>
            </button>

            <!-- Error -->
            <transition name="slide-up">
                <div v-if="error" class="error-card">
                    <span class="error-icon">⚠</span>
                    {{ error }}
                </div>
            </transition>

            <!-- Results -->
            <transition name="slide-up">
                <section v-if="result" class="result-section">

                    <!-- Detection card -->
                    <div class="detection-card">
                        <div class="detection-header">
                            <div>
                                <p class="detection-label">Detected disease</p>
                                <h2 class="detection-name">{{ result.disease }}</h2>
                                <p class="detection-plant">on {{ result.plant }}</p>
                            </div>
                            <div class="confidence-ring">
                                <svg viewBox="0 0 56 56" width="56" height="56">
                                    <circle cx="28" cy="28" r="22" fill="none" stroke="var(--ring-bg)"
                                        stroke-width="5" />
                                    <circle cx="28" cy="28" r="22" fill="none" stroke="var(--accent)" stroke-width="5"
                                        stroke-linecap="round" stroke-dasharray="138.2"
                                        :stroke-dashoffset="138.2 - (138.2 * result.confidence / 100)"
                                        transform="rotate(-90 28 28)" style="transition: stroke-dashoffset 1s ease" />
                                </svg>
                                <span class="confidence-num">{{ result.confidence }}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Advice card -->
                    <div class="advice-card">
                        <div class="advice-header">
                            <span class="advice-icon">⚕</span>
                            <h3 class="advice-title">Treatment advice</h3>
                        </div>

                        <p class="advice-summary">{{ result.advice.summary }}</p>

                        <ul class="advice-steps">
                            <li v-for="(step, i) in result.advice.steps" :key="i" class="advice-step">
                                <span class="step-num">{{ i + 1 }}</span>
                                <span>{{ step }}</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Report wrong detection -->
                    <div class="report-row">
                        <span class="report-label">Detection wrong?</span>
                        <button class="report-btn" @click="reportWrong = !reportWrong">
                            Flag this result
                        </button>
                    </div>

                    <transition name="slide-up">
                        <div v-if="reportWrong" class="report-card">
                            <p class="report-title">What disease is it actually?</p>
                            <select v-model="correction" class="report-select">
                                <option value="">— select correct disease —</option>
                                <option v-for="d in diseaseOptions" :key="d" :value="d">{{ d }}</option>
                                <option value="healthy">No disease / healthy plant</option>
                                <option value="other">Other (not in list)</option>
                            </select>
                            <button class="report-submit" :disabled="!correction" @click="submitReport">
                                Submit correction
                            </button>
                            <p v-if="reportSent" class="report-thanks">✓ Thanks — this helps improve the model.</p>
                        </div>
                    </transition>

                </section>
            </transition>
        </main>
    </div>
</template>

<script setup>
    import { ref } from 'vue'

    // ─── API keys (replace with your own or use env vars) ───────────────────────
    const PLANT_ID_KEY = import.meta.env.VITE_PLANT_ID_KEY || 'YOUR_PLANT_ID_KEY'
    const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || 'YOUR_ANTHROPIC_KEY'

    // ─── State ───────────────────────────────────────────────────────────────────
    const fileInput = ref(null)
    const previewUrl = ref(null)
    const imageBase64 = ref(null)
    const dragging = ref(false)
    const loading = ref(false)
    const error = ref(null)
    const result = ref(null)
    const reportWrong = ref(false)
    const correction = ref('')
    const reportSent = ref(false)

    const diseaseOptions = [
        'Late Blight', 'Early Blight', 'Leaf Spot', 'Powdery Mildew',
        'Downy Mildew', 'Rust', 'Anthracnose', 'Root Rot',
        'Bacterial Wilt', 'Mosaic Virus', 'Yellow Leaf Curl',
    ]

    // ─── File handling ────────────────────────────────────────────────────────────
    function onFileChange(e) {
        const file = e.target.files[0]
        if (file) loadFile(file)
    }

    function onDrop(e) {
        dragging.value = false
        const file = e.dataTransfer.files[0]
        if (file) loadFile(file)
    }

    function loadFile(file) {
        previewUrl.value = URL.createObjectURL(file)
        result.value = null
        error.value = null
        reportWrong.value = false
        reportSent.value = false

        const reader = new FileReader()
        reader.onload = (e) => {
            imageBase64.value = e.target.result.split(',')[1]
        }
        reader.readAsDataURL(file)
    }

    function reset() {
        previewUrl.value = null
        imageBase64.value = null
        result.value = null
        error.value = null
        reportWrong.value = false
        reportSent.value = false
    }

    // ─── Analysis pipeline ────────────────────────────────────────────────────────
    async function analyze() {
        if (!imageBase64.value) return
        loading.value = true
        error.value = null
        result.value = null

        try {
            // Step 1: Plant.id — identify disease
            const detection = await identifyDisease(imageBase64.value)

            // Step 2: Claude — generate advice
            const advice = await getAdvice(detection.disease, detection.plant)

            result.value = { ...detection, advice }
        } catch (err) {
            error.value = err.message || 'Something went wrong. Please try again.'
        } finally {
            loading.value = false
        }
    }

    // ─── Plant.id call ────────────────────────────────────────────────────────────
    async function identifyDisease(base64) {
        // ── MOCK (remove when you have a real key) ──────────────────────────────
        if (PLANT_ID_KEY === 'YOUR_PLANT_ID_KEY') {
            await delay(1200)
            return {
                plant: 'Tomato',
                disease: 'Late Blight',
                confidence: 87,
            }
        }
        // ── Real Plant.id v3 call ───────────────────────────────────────────────
        const res = await fetch('https://plant.id/api/v3/health_assessment', {
            method: 'POST',
            headers: {
                'Api-Key': PLANT_ID_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                images: [`data:image/jpeg;base64,${base64}`],
                health: 'all',
            }),
        })
        if (!res.ok) throw new Error(`Plant.id error: ${res.status}`)
        const data = await res.json()

        const top = data.result?.disease?.suggestions?.[0]
        if (!top) throw new Error('No disease detected. Try a clearer photo.')

        return {
            plant: data.result?.classification?.suggestions?.[0]?.name || 'Unknown plant',
            disease: top.name,
            confidence: Math.round((top.probability || 0) * 100),
        }
    }

    // ─── Claude call ──────────────────────────────────────────────────────────────
    async function getAdvice(disease, plant) {
        // ── MOCK (remove when you have a real key) ──────────────────────────────
        if (ANTHROPIC_KEY === 'YOUR_ANTHROPIC_KEY') {
            await delay(1400)
            return {
                summary: `Late Blight is a serious fungal disease caused by Phytophthora infestans. It spreads rapidly in cool, wet conditions and can destroy an entire crop within days if left untreated.`,
                steps: [
                    'Remove and destroy all visibly infected leaves and stems immediately — do not compost them.',
                    'Apply a copper-based fungicide or chlorothalonil every 7 days, especially before rain.',
                    'Improve air circulation by pruning dense foliage and staking plants upright.',
                    'Water at the base of plants in the morning so leaves dry before nightfall.',
                    'Rotate crops — avoid planting tomatoes or potatoes in the same spot next season.',
                ],
            }
        }
        // ── Real Claude call ────────────────────────────────────────────────────
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 600,
                system: `You are an agricultural expert helping smallholder farmers in Uganda.
  A crop has been diagnosed with a plant disease. Respond ONLY with a JSON object — no markdown, no backticks.
  Format:
  {
    "summary": "2-3 sentence plain-language explanation of the disease and how it spreads",
    "steps": ["step 1", "step 2", "step 3", "step 4", "step 5"]
  }
  Keep language simple. Steps should be practical, low-cost, and actionable.`,
                messages: [
                    {
                        role: 'user',
                        content: `Plant: ${plant}\nDisease: ${disease}\n\nProvide treatment advice.`,
                    },
                ],
            }),
        })
        if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
        const data = await res.json()
        const text = data.content?.[0]?.text || '{}'
        return JSON.parse(text.replace(/```json|```/g, '').trim())
    }

    // ─── Report wrong detection ───────────────────────────────────────────────────
    async function submitReport() {
        // TODO: send { detected: result.value.disease, correct: correction.value } to Supabase
        console.log('Report submitted:', {
            detected: result.value.disease,
            correct: correction.value,
            plant: result.value.plant,
            timestamp: new Date().toISOString(),
        })
        reportSent.value = true
        reportWrong.value = false
    }

    const delay = (ms) => new Promise((r) => setTimeout(r, ms))
</script>

<style scoped>
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    :root {
        --bg: #0e1a0f;
        --surface: #162018;
        --surface2: #1d2b1e;
        --border: rgba(255, 255, 255, 0.07);
        --accent: #7ecb6f;
        --accent-dim: rgba(126, 203, 111, 0.12);
        --text: #e8f0e8;
        --text-muted: #6b8a6c;
        --red: #e07070;
        --ring-bg: rgba(126, 203, 111, 0.15);
    }

    .crop-doctor {
        font-family: 'DM Sans', sans-serif;
        background: var(--bg);
        min-height: 100vh;
        color: var(--text);
        position: relative;
        overflow-x: hidden;
    }

    /* Grain texture */
    .grain {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        opacity: 0.035;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        background-size: 180px;
    }

    .header {
        position: relative;
        z-index: 1;
        text-align: center;
        padding: 48px 24px 32px;
        border-bottom: 1px solid var(--border);
    }

    .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 8px;
    }

    .logo-leaf {
        font-size: 22px;
        color: var(--accent);
        line-height: 1;
    }

    .logo-text {
        font-family: 'Instrument Serif', serif;
        font-size: 26px;
        letter-spacing: -0.02em;
        color: var(--text);
    }

    .tagline {
        font-size: 13px;
        color: var(--text-muted);
        font-weight: 300;
        letter-spacing: 0.02em;
    }

    .main {
        position: relative;
        z-index: 1;
        max-width: 560px;
        margin: 0 auto;
        padding: 36px 20px 80px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* Upload zone */
    .upload-zone {
        border: 1.5px dashed rgba(126, 203, 111, 0.35);
        border-radius: 16px;
        background: var(--surface);
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        overflow: hidden;
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .upload-zone:hover,
    .upload-zone.dragging {
        border-color: var(--accent);
        background: var(--accent-dim);
    }

    .upload-zone.hasImage {
        border-style: solid;
        border-color: rgba(126, 203, 111, 0.2);
    }

    .upload-prompt {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 40px;
        color: var(--text-muted);
    }

    .upload-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--surface2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent);
        margin-bottom: 4px;
    }

    .upload-title {
        font-size: 15px;
        font-weight: 500;
        color: var(--text);
    }

    .upload-sub {
        font-size: 12px;
        color: var(--text-muted);
    }

    .preview-wrap {
        position: relative;
        width: 100%;
    }

    .preview-img {
        width: 100%;
        max-height: 340px;
        object-fit: cover;
        display: block;
        border-radius: 14px;
    }

    .change-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
        backdrop-filter: blur(4px);
        transition: background 0.2s;
    }

    .change-btn:hover {
        background: rgba(0, 0, 0, 0.8);
    }

    /* Analyze button */
    .analyze-btn {
        width: 100%;
        padding: 15px;
        background: #7ecb6f;
        color: #0a1a0a;
        border: 2px solid #a8e09c;
        border-radius: 12px;
        font-family: 'DM Sans', sans-serif;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
        letter-spacing: 0.01em;
    }

    .analyze-btn:hover:not(:disabled) {
        background: #92d985;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(126, 203, 111, 0.3);
    }

    .analyze-btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
        border-color: transparent;
    }

    .btn-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }

    .dot {
        width: 7px;
        height: 7px;
        background: #0e1a0f;
        border-radius: 50%;
        animation: bounce 1s infinite;
    }

    .dot:nth-child(2) {
        animation-delay: 0.15s;
    }

    .dot:nth-child(3) {
        animation-delay: 0.3s;
    }

    @keyframes bounce {

        0%,
        80%,
        100% {
            transform: translateY(0);
            opacity: 0.5;
        }

        40% {
            transform: translateY(-5px);
            opacity: 1;
        }
    }

    /* Error */
    .error-card {
        background: rgba(224, 112, 112, 0.1);
        border: 1px solid rgba(224, 112, 112, 0.25);
        border-radius: 10px;
        padding: 14px 16px;
        font-size: 13px;
        color: var(--red);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .error-icon {
        font-size: 16px;
    }

    /* Result section */
    .result-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    /* Detection card */
    .detection-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 22px;
    }

    .detection-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }

    .detection-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
        margin-bottom: 6px;
    }

    .detection-name {
        font-family: 'Instrument Serif', serif;
        font-size: 26px;
        line-height: 1.1;
        color: var(--text);
        letter-spacing: -0.01em;
    }

    .detection-plant {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 4px;
    }

    .confidence-ring {
        position: relative;
        flex-shrink: 0;
    }

    .confidence-num {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 500;
        color: var(--accent);
    }

    /* Advice card */
    .advice-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 22px;
    }

    .advice-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
    }

    .advice-icon {
        font-size: 16px;
    }

    .advice-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
        letter-spacing: 0.01em;
    }

    .advice-summary {
        font-size: 14px;
        line-height: 1.65;
        color: var(--text-muted);
        margin-bottom: 18px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--border);
    }

    .advice-steps {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .advice-step {
        display: flex;
        gap: 12px;
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--text);
    }

    .step-num {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--accent-dim);
        color: var(--accent);
        font-size: 11px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
    }

    /* Report row */
    .report-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 0;
    }

    .report-label {
        font-size: 12px;
        color: var(--text-muted);
    }

    .report-btn {
        font-family: 'DM Sans', sans-serif;
        font-size: 12px;
        color: var(--red);
        background: none;
        border: 1px solid rgba(224, 112, 112, 0.25);
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .report-btn:hover {
        background: rgba(224, 112, 112, 0.08);
    }

    /* Report card */
    .report-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .report-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
    }

    .report-select {
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        background: var(--surface2);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 12px;
        width: 100%;
        appearance: none;
        cursor: pointer;
    }

    .report-submit {
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        font-weight: 500;
        background: var(--surface2);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px;
        cursor: pointer;
        transition: border-color 0.2s;
        align-self: flex-start;
        padding-inline: 20px;
    }

    .report-submit:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--accent);
    }

    .report-submit:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .report-thanks {
        font-size: 12px;
        color: var(--accent);
    }

    /* Transitions */
    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.25s;
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }

    .slide-up-enter-active {
        transition: all 0.3s ease;
    }

    .slide-up-enter-from {
        opacity: 0;
        transform: translateY(12px);
    }
</style>