import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { assessPlantHealth, enrichDiseaseDiagnosis } from '@/lib/agriAi'
import { findMedicinesByDisease, getMedicineById, type MedicineProduct } from '@/lib/medicineCatalog'

const STORAGE_KEY = 'cropdr.detectionState'

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
    needsRetake?: boolean
    message?: string
    retakeTips?: string[]
    confidenceBand?: 'strong' | 'moderate' | 'weak'
    uncertain?: boolean
    clusteredTopThree?: boolean
    topDiseases?: Array<{ name: string; confidence: number }>
    possibleDiseases?: Array<{ name: string; confidence: number }>
    diagnosisState?:
    | 'healthy_strong'
    | 'healthy_uncertain'
    | 'disease_strong'
    | 'disease_competing_same_family'
    | 'disease_competing_mixed'
    | 'low_confidence_retake'
    confidenceGap?: number
    sameFamilyCluster?: boolean
    healthyUncertain?: boolean
    advice?: Advice
    products?: MedicineProduct[]
}

interface OrderSnapshot {
    [key: string]: unknown
}

export const useDetectionStore = defineStore('detection', () => {
    const persisted = loadPersistedState()
    const previewUrl = ref<string | null>(persisted.previewUrl)
    const imageBase64 = ref<string | null>(persisted.imageBase64)
    const result = ref<DetectionResult | null>(persisted.result)
    const scanning = ref(false)
    const error = ref<string | null>(persisted.error)

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

    watch([previewUrl, imageBase64, result, error], () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    previewUrl: previewUrl.value,
                    imageBase64: imageBase64.value,
                    result: result.value,
                    error: error.value,
                }),
            )
        } catch {
            // Ignore storage failures.
        }
    }, { deep: true })

    async function runScan(context: { latitude?: number; longitude?: number; datetime?: string } = {}) {
        if (!imageBase64.value) return
        scanning.value = true
        error.value = null

        try {
            const det = await identifyDisease(imageBase64.value, context)
            if (det.needsRetake) {
                error.value = null
                result.value = det
                return false
            }

            const healthyStrong = det.diagnosisState === 'healthy_strong'
            const healthyUncertain = det.diagnosisState === 'healthy_uncertain'
            const healthy = healthyStrong || (!det.diagnosisState && (Boolean(det.healthy) || isHealthyLabel(det.disease)))
            det.healthy = healthy
            if (healthyStrong) {
                det.disease = 'Healthy plant'
                det.severity = 'None'
            }

            if (healthyStrong) {
                det.advice = {
                    summary: 'The plant appears healthy. No treatment is needed.',
                    steps: [],
                }
                det.products = []
            } else if (healthyUncertain) {
                det.advice = {
                    summary: 'This looks likely healthy, but confidence is low and there are competing disease signals. Please retake a clearer photo and monitor the crop closely.',
                    steps: [],
                }
                det.products = []
                det.severity = 'Uncertain'
            } else {
                const enrichment = await enrichDiseaseDiagnosis({
                    disease: det.disease,
                    plant: det.plant,
                    confidence: det.confidence,
                    confidenceBand: det.confidenceBand,
                    diagnosisState: det.diagnosisState,
                    sameFamilyCluster: det.sameFamilyCluster,
                })
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
            needsRetake: assessment.needsRetake,
            message: assessment.message,
            retakeTips: assessment.retakeTips,
            confidenceBand: assessment.confidenceBand,
            uncertain: assessment.uncertain,
            clusteredTopThree: assessment.clusteredTopThree,
            topDiseases: assessment.topDiseases,
            possibleDiseases: assessment.possibleDiseases,
            diagnosisState: assessment.diagnosisState,
            confidenceGap: assessment.confidenceGap,
            sameFamilyCluster: assessment.sameFamilyCluster,
            healthyUncertain: assessment.healthyUncertain,
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

function loadPersistedState() {
    if (typeof window === 'undefined') {
        return { previewUrl: null, imageBase64: null, result: null, error: null }
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return { previewUrl: null, imageBase64: null, result: null, error: null }
        const parsed = JSON.parse(raw) as {
            previewUrl?: string | null
            imageBase64?: string | null
            result?: DetectionResult | null
            error?: string | null
        }
        return {
            previewUrl: typeof parsed.previewUrl === 'string' ? parsed.previewUrl : null,
            imageBase64: typeof parsed.imageBase64 === 'string' ? parsed.imageBase64 : null,
            result: parsed.result ?? null,
            error: typeof parsed.error === 'string' ? parsed.error : null,
        }
    } catch {
        return { previewUrl: null, imageBase64: null, result: null, error: null }
    }
}
