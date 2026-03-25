import { defineStore } from 'pinia'
import { ref } from 'vue'

const PLANT_ID_KEY = import.meta.env.VITE_PLANT_ID_KEY || 'YOUR_PLANT_ID_KEY'
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || 'YOUR_ANTHROPIC_KEY'

type CatalogueItem = {
    id: number
    name: string
    emoji: string
    type: string
    price: number
    topPick: boolean
    treats: string
    application: string
    dosage: string
    supplier: string
    description: string
    diseases: string[]
}

type Advice = {
    summary: string
    steps: string[]
}

type DetectionCore = {
    plant: string
    disease: string
    confidence: number
    severity: string
}

type DetectionResult = DetectionCore & {
    advice: Advice
    products: CatalogueItem[]
}

const catalogue: CatalogueItem[] = [
    { id: 1, name: 'Ridomil Gold 68WG', emoji: '🟡', type: 'Systemic fungicide', price: 28000, topPick: true, treats: 'Late Blight, Downy Mildew', application: 'Foliar spray', dosage: '25g / 15L water', supplier: 'AgroUganda Ltd', description: 'Highly effective systemic fungicide that moves through the plant to kill Late Blight at the source. One of the most trusted treatments for Phytophthora infestans in East Africa.', diseases: ['Late Blight', 'Downy Mildew'] },
    { id: 2, name: 'Copper Oxychloride', emoji: '🔵', type: 'Contact fungicide', price: 12000, topPick: false, treats: 'Blight, Leaf Spot, Rust', application: 'Foliar spray', dosage: '30g / 15L water', supplier: 'FarmCare Uganda', description: 'Broad-spectrum contact fungicide. Best applied before infection spreads. Forms a protective barrier on leaves.', diseases: ['Late Blight', 'Early Blight', 'Leaf Spot', 'Rust'] },
    { id: 3, name: 'Mancozeb 80WP', emoji: '🟤', type: 'Protective fungicide', price: 9500, topPick: false, treats: 'Early & Late Blight', application: 'Foliar spray', dosage: '20g / 15L water', supplier: 'FarmCare Uganda', description: 'Preventive fungicide that protects healthy plant tissue from infection. Best used at first signs or as prevention.', diseases: ['Late Blight', 'Early Blight'] },
    { id: 4, name: 'Amistar 250SC', emoji: '🟣', type: 'Broad-spectrum', price: 34000, topPick: false, treats: 'Rust, Powdery Mildew, Blight', application: 'Foliar spray', dosage: '10ml / 15L water', supplier: 'Syngenta Uganda', description: 'Premium broad-spectrum fungicide with curative and preventive action against a wide range of crop diseases.', diseases: ['Rust', 'Powdery Mildew', 'Late Blight', 'Early Blight'] },
    { id: 5, name: 'Dithane M-45', emoji: '🟠', type: 'Multi-disease', price: 11000, topPick: false, treats: 'Leaf Spot, Anthracnose', application: 'Foliar spray', dosage: '25g / 15L water', supplier: 'AgroUganda Ltd', description: 'Effective against a wide range of fungal diseases. Low cost and widely available across Uganda.', diseases: ['Leaf Spot', 'Anthracnose', 'Early Blight'] },
    { id: 6, name: 'Actara 25WG', emoji: '⚪', type: 'Insecticide', price: 22000, topPick: false, treats: 'Whitefly (virus vector)', application: 'Foliar spray', dosage: '8g / 15L water', supplier: 'Syngenta Uganda', description: 'Controls whiteflies that spread Tomato Yellow Leaf Curl Virus. Use alongside fungicides for full protection.', diseases: ['Mosaic Virus', 'Yellow Leaf Curl'] },
]

export const useDetectionStore = defineStore('detection', () => {
    const previewUrl = ref<string | null>(null)
    const imageBase64 = ref<string | null>(null)
    const result = ref<DetectionResult | null>(null)
    const scanning = ref(false)
    const error = ref<string | null>(null)

    // Confirmed order snapshot
    const confirmedOrder = ref<DetectionResult | null>(null)
    const confirmedCart = ref<CatalogueItem[]>([])
    const confirmedTotal = ref(0)
    const orderRef = ref<string | null>(null)

    function setImage(url: string, base64: string) {
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
        return catalogue.find(p => p.id === Number(id))
    }

    async function runScan() {
        if (!imageBase64.value) return
        scanning.value = true
        error.value = null
        try {
            const det = await identifyDisease(imageBase64.value)
            const advice = await getAdvice(det.disease, det.plant)
            result.value = {
                ...det,
                advice,
                products: getProductsForDisease(det.disease),
            }
            return true
        } catch (e: unknown) {
            error.value = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
            return false
        } finally {
            scanning.value = false
        }
    }

    function getProductsForDisease(disease: string) {
        const matched = catalogue.filter(p =>
            p.diseases.some(d => disease.toLowerCase().includes(d.toLowerCase()))
        )
        return matched.length ? matched : catalogue.slice(0, 3)
    }

    async function identifyDisease(base64: string): Promise<DetectionCore> {
        if (PLANT_ID_KEY === 'YOUR_PLANT_ID_KEY') {
            await delay(1400)
            return { plant: 'Tomato', disease: 'Late Blight', confidence: 87, severity: 'High' }
        }
        const res = await fetch('https://plant.id/api/v3/health_assessment', {
            method: 'POST',
            headers: { 'Api-Key': PLANT_ID_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [`data:image/jpeg;base64,${base64}`], health: 'all' }),
        })
        if (!res.ok) throw new Error(`Plant.id error: ${res.status}`)
        const data: any = await res.json()
        const top = data.result?.disease?.suggestions?.[0]
        if (!top) throw new Error('No disease detected. Try a clearer photo.')
        return {
            plant: data.result?.classification?.suggestions?.[0]?.name || 'Unknown plant',
            disease: top.name,
            confidence: Math.round((top.probability || 0) * 100),
            severity: top.disease_details?.severity || 'Medium',
        }
    }

    async function getAdvice(disease: string, plant: string): Promise<Advice> {
        if (ANTHROPIC_KEY === 'YOUR_ANTHROPIC_KEY') {
            await delay(1200)
            return {
                summary: 'Late Blight is a fast-spreading fungal disease caused by Phytophthora infestans. It thrives in cool, wet weather and can destroy an entire crop within days if untreated.',
                steps: [
                    'Remove all visibly infected leaves and stems. Do not compost — burn or bury them.',
                    'Apply Ridomil Gold or copper-based fungicide every 7 days, especially before rain.',
                    'Water plants at the base only, in the morning, so leaves dry before nightfall.',
                    'Stake plants upright and prune dense foliage to improve air circulation.',
                    'Next season, rotate crops — avoid tomatoes or potatoes in the same bed.',
                ],
            }
        }
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514', max_tokens: 600,
                system: `Agricultural expert for Ugandan smallholder farmers. Respond ONLY with JSON, no markdown:
{"summary":"2-3 sentence explanation","steps":["step1","step2","step3","step4","step5"]}
Simple language, practical low-cost steps.`,
                messages: [{ role: 'user', content: `Plant: ${plant}\nDisease: ${disease}` }],
            }),
        })
        if (!res.ok) throw new Error(`Claude error: ${res.status}`)
        const data: any = await res.json()
        const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim()) as Partial<Advice>
        return {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
        }
    }

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    return {
        previewUrl, imageBase64, result, scanning, error,
        confirmedOrder, confirmedCart, confirmedTotal, orderRef,
        setImage, reset, runScan, getById,
    }
})
