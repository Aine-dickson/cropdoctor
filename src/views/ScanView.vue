<template>
    <div class="view">
        <AppTopBar title="Scan crop" />

        <div class="page">
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
        </div>
    </div>
</template>

<script setup>
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import AppTopBar from '@/components/AppTopBar.vue'
    import { useDetectionStore } from '@/stores/detection'
    import { useAuthStore } from '@/stores/auth'

    const auth = useAuthStore()
    const router = useRouter()
    const detection = useDetectionStore()
    const fileInput = ref(null)
    const dragging = ref(false)

    function onFileChange(e) { loadFile(e.target.files[0]) }
    function onDrop(e) { dragging.value = false; loadFile(e.dataTransfer.files[0]) }

    function loadFile(file) {
        if (!file) return
        const url = URL.createObjectURL(file)
        const reader = new FileReader()
        reader.onload = e => detection.setImage(url, e.target.result.split(',')[1])
        reader.readAsDataURL(file)
    }

    function resetImage() { detection.setImage(null, null) }

    async function handleScan() {
        const ok = await detection.runScan()
        if (ok) router.push('/results')
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
