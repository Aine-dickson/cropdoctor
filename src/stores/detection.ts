import { defineStore } from 'pinia'
import { ref } from 'vue'
import { assessPlantHealth, enrichDiseaseDiagnosis } from '@/lib/agriAi'
import { findMedicinesByDisease, getMedicineById, type MedicineProduct } from '@/lib/medicineCatalog'

interface Advice {
    summary: string
    steps: string[]
    aiUnavailable?: boolean
}

interface DetectionResult {
    plant: string
    disease: string
    confidence: number
    severity: string
    healthy?: boolean
    advice?: Advice
    products?: MedicineProduct[]
}

interface OrderSnapshot {
    [key: string]: unknown
}

export const useDetectionStore = defineStore('detection', () => {
    const previewUrl = ref<string | null>(null)
    const imageBase64 = ref<string | null>(null)
    const result = ref<DetectionResult | null>(null)
    const scanning = ref(false)
    const error = ref<string | null>(null)

    const confirmedOrder = ref<OrderSnapshot | null>(null)
    const confirmedCart = ref<MedicineProduct[]>([])
    const confirmedTotal = ref(0)
    const orderRef = ref<string | null>(null)

    function setImage(url: string | null, base64: string | null) {
        previewUrl.value = url
        imageBase64.value = base64
        result.value = null
        error.value = null
    }

    function reset() {
        previewUrl.value = null
        imageBase64.value = null
        result.value = null
        error.value = null
        scanning.value = false
        confirmedOrder.value = null
        confirmedCart.value = []
        confirmedTotal.value = 0
        orderRef.value = null
    }

    function getById(id: number | string) {
        return getMedicineById(id)
    }

    async function runScan(context: { latitude?: number; longitude?: number; datetime?: string } = {}) {
        if (!imageBase64.value) return
        scanning.value = true
        error.value = null

        try {
            const det = await identifyDisease(imageBase64.value, context)
            const healthy = Boolean(det.healthy) || isHealthyLabel(det.disease)
            det.healthy = healthy
            det.disease = healthy ? 'Healthy plant' : det.disease
            det.severity = healthy ? 'None' : det.severity

            if (healthy) {
                det.advice = {
                    summary: 'The plant appears healthy. No treatment is needed.',
                    steps: [],
                }
                det.products = []
            } else {
                const enrichment = await enrichDiseaseDiagnosis({ disease: det.disease, plant: det.plant })
                det.advice = {
                    summary: enrichment.summary,
                    steps: enrichment.steps,
                    aiUnavailable: enrichment.aiUnavailable,
                }
                det.products = getProductsForDisease(det.disease, enrichment.searchTerms)
            }
            result.value = det
            return true
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
            return false
        } finally {
            scanning.value = false
        }
    }

    function getProductsForDisease(disease: string, searchTerms: string[] = []) {
        return findMedicinesByDisease(disease, searchTerms)
    }

    function isHealthyLabel(value: string | undefined) {
        const text = String(value ?? '').trim().toLowerCase()
        return text.includes('healthy') || text.includes('no disease') || text === 'health'
    }

    async function identifyDisease(
        base64: string,
        context: { latitude?: number; longitude?: number; datetime?: string } = {},
    ): Promise<DetectionResult> {
        const assessment = await assessPlantHealth(base64, context)
        const healthy = Boolean(assessment.healthy) || isHealthyLabel(assessment.disease)

        return {
            plant: assessment.plant,
            disease: healthy ? 'Healthy plant' : assessment.disease,
            confidence: assessment.confidence,
            severity: healthy ? 'None' : assessment.severity,
            healthy,
        }
    }

    return {
        previewUrl,
        imageBase64,
        result,
        scanning,
        error,
        confirmedOrder,
        confirmedCart,
        confirmedTotal,
        orderRef,
        setImage,
        reset,
        runScan,
        getById,
    }
})
