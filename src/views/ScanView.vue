<template>
    <div class="view">
        <AppTopBar title="Scan crop" />

        <div class="page">
            <template v-if="retakeState">
                <div class="retake-card">
                    <p class="retake-eyebrow">Photo Retake needed</p>
                    <h2 class="retake-title">We need a clearer photo</h2>
                    <p class="retake-sub">
                        {{ retakeState.message || 'Confidence is too low for a safe diagnosis from this image.' }}
                    </p>

                    <div class="retake-context">
                        <p class="retake-plant">Detected plant: <strong class="capitalize">{{ retakeState.plant }}</strong></p>
                        <div v-if="retakeState.possibleDiseases?.length" class="possible-block">
                            <p class="possible-title">Possible disease{{ retakeState.possibleDiseases.length > 1 ? 's' : '' }}</p>
                            <div class="possible-list">
                                <div v-for="candidate in retakeState.possibleDiseases" :key="candidate.name" class="possible-item">
                                    <span class="capitalize">{{ candidate.name }}</span>
                                    <span>{{ candidate.confidence }}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="retake-help">
                        <p class="retake-help-title">How to retake</p>
                        <ul>
                            <li v-for="tip in retakeState.retakeTips || []" :key="tip">{{ tip }}</li>
                        </ul>
                    </div>

                    <button class="btn-primary" @click="startRetake">Retake photo</button>
                </div>
            </template>

            <template v-else>
                <div class="hero">
                    <h1 class="greeting-title">
                        {{ auth.isLoggedIn ? 'Hello, ' + auth.profile?.name?.split(' ')[0] + ' 👋' : 'Hello, Farmer 👋' }}
                    </h1>

                    <p class="hero-sub">Take or upload a photo — we'll identify the disease and recommend treatment.</p>
                </div>

                <!-- Upload zone -->
                <div class="upload-zone" :class="{ dragging, 'has-image': detection.previewUrl }"
                    @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop"
                    @click="fileInput.click()">
                    <input ref="fileInput" type="file" accept="image/*" class="sr-only" @change="onFileChange" />

                    <transition name="fade" mode="out-in">
                        <div v-if="!detection.previewUrl" key="empty" class="upload-empty">
                            <div class="upload-icon-wrap">
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                    <path
                                        d="M4 10a2 2 0 012-2h2.5l2-3h7l2 3H26a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V10z"
                                        stroke="currentColor" stroke-width="1.8" />
                                    <circle cx="16" cy="17" r="4.5" stroke="currentColor" stroke-width="1.8" />
                                </svg>
                            </div>
                            <p class="upload-cta">Tap to take or upload photo</p>
                            <p class="upload-hint">JPG · PNG · WEBP</p>
                        </div>

                        <div v-else key="preview" class="upload-preview">
                            <img :src="detection.previewUrl" alt="Crop photo" class="preview-img" />
                            <button class="retake-btn" @click.stop="resetImage">↺ Retake</button>
                        </div>
                    </transition>
                </div>

                <!-- CTA -->
                <button class="btn-primary" :disabled="!detection.previewUrl || detection.scanning" @click="handleScan">
                    <span v-if="!detection.scanning">Analyse crop</span>
                    <span v-else class="dots"><span></span><span></span><span></span></span>
                </button>

                <p v-if="scanNotice" class="notice-msg">{{ scanNotice }}</p>

                <p v-if="detection.error" class="error-msg">{{ detection.error }}</p>

                <!-- Tips -->
                <div class="tips">
                    <p class="tips-title">For best results</p>
                    <ul class="tips-list">
                        <li>📷 Good lighting, close-up of the affected leaf</li>
                        <li>🌿 Include both healthy and sick parts</li>
                        <li>🚫 Avoid blurry or dark photos</li>
                    </ul>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { computed, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useDetectionStore } from '@/stores/detection'
    import { useAuthStore } from '@/stores/auth'
    import { LocationPermissionError, getScanContext } from '@/composables/useScanContext'

    const auth = useAuthStore()
    const router = useRouter()
    const detection = useDetectionStore()
    const fileInput = ref(null)
    const dragging = ref(false)
    const scanNotice = ref('')
    const retakeState = computed(() => detection.result?.needsRetake ? detection.result : null)

    function onFileChange(e) { loadFile(e.target.files[0]) }
    function onDrop(e) { dragging.value = false; loadFile(e.dataTransfer.files[0]) }

    function loadFile(file) {
        if (!file) return
        const reader = new FileReader()
        reader.onload = e => detection.setImage(e.target.result, e.target.result.split(',')[1])
        reader.readAsDataURL(file)
    }

    function resetImage() { detection.setImage(null, null) }

    function startRetake() {
        detection.setImage(null, null)
        scanNotice.value = ''
    }

    async function handleScan() {
        scanNotice.value = ''

        try {
            const context = await getScanContext()
            const ok = await detection.runScan(context)
            if (ok && auth.isLoggedIn && detection.result) {
                const severity = detection.result.severity?.toLowerCase()
                await auth.saveDetection({
                    disease: detection.result.disease,
                    plant: detection.result.plant,
                    confidence: detection.result.confidence,
                    severity: severity === 'high' || severity === 'medium' || severity === 'low' ? severity : undefined,
                })
            }
            if (ok) router.push('/results')
        } catch (error) {
            if (error instanceof LocationPermissionError) {
                scanNotice.value = error.message
                return
            }

            detection.error = error instanceof Error ? error.message : 'Could not access location. Tap Analyse crop again.'
        }
    }
</script>

<style scoped>
    .view {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--bg);
    }

    .page {
        flex: 1;
        padding: 24px 16px 100px;
        max-width: 480px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .hero-title {
        font-family: 'Lora', serif;
        font-size: 28px;
        font-weight: 600;
        line-height: 1.15;
        letter-spacing: -0.02em;
        margin-bottom: 8px;
    }

    .hero-sub {
        font-size: 14px;
        color: var(--muted);
        line-height: 1.6;
    }

    /* Upload zone */
    .upload-zone {
        border: 2.5px dashed var(--accent);
        border-radius: 20px;
        background: var(--accent-lt);
        cursor: pointer;
        min-height: 240px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: background 0.2s, border-color 0.2s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }

    .upload-zone.dragging {
        background: #cce8d0;
        border-color: var(--accent);
    }

    .upload-zone.has-image {
        border-style: solid;
        border-color: var(--border);
        background: var(--surface);
        min-height: unset;
    }

    .upload-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 40px 20px;
    }

    .upload-icon-wrap {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: var(--surface);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
        border: 2px solid rgba(45, 122, 58, 0.2);
    }

    .upload-cta {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
    }

    .upload-hint {
        font-size: 12px;
        color: var(--muted);
    }

    .upload-preview {
        position: relative;
        width: 100%;
    }

    .preview-img {
        width: 100%;
        max-height: 320px;
        object-fit: cover;
        display: block;
        border-radius: 18px;
    }

    .retake-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
    }

    .error-msg {
        font-size: 13px;
        color: var(--danger);
        text-align: center;
    }

    .notice-msg {
        font-size: 13px;
        color: var(--text);
        text-align: center;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        line-height: 1.55;
    }

    .retake-card {
        background: linear-gradient(180deg, #fff7f0 0%, #fff 100%);
        border: 1px solid #f1d8bf;
        border-radius: 20px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .retake-eyebrow {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #b06b2f;
        font-weight: 700;
    }

    .retake-title {
        font-family: 'Lora', serif;
        font-size: 24px;
        line-height: 1.15;
    }

    .retake-sub {
        font-size: 14px;
        color: #6f4d33;
        line-height: 1.6;
    }

    .retake-context {
        background: #fff;
        border: 1px solid #f0e1d3;
        border-radius: 14px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .retake-plant {
        font-size: 13px;
        color: #4f3825;
    }

    .possible-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #8a6647;
        margin-bottom: 8px;
    }

    .possible-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .possible-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 9px 10px;
        border-radius: 10px;
        background: #faf3ec;
        font-size: 13px;
        color: #5a3e28;
    }

    .retake-help {
        background: #fff;
        border: 1px solid #f0e1d3;
        border-radius: 14px;
        padding: 12px;
    }

    .retake-help-title {
        font-size: 12px;
        font-weight: 700;
        color: #7a5535;
        margin-bottom: 8px;
    }

    .retake-help ul {
        margin: 0;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: #6a4a31;
        font-size: 13px;
        line-height: 1.5;
    }

    /* Tips */
    .tips {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
    }

    .tips-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 10px;
    }

    .tips-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tips-list li {
        font-size: 13px;
        color: var(--muted);
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
    }
</style>
