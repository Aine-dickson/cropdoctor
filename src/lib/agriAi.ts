const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || 'YOUR_ANTHROPIC_KEY'
const EDGE_API_BASE_URL = import.meta.env.VITE_EDGE_API_BASE_URL?.replace(/\/$/, '') || ''

export interface DiseaseEnrichment {
    summary: string
    steps: string[]
    relatedDiseases: string[]
    searchTerms: string[]
    aiUnavailable?: boolean
}

export interface SymptomDiagnosis extends DiseaseEnrichment {
    disease: string
    confidence: 'High' | 'Medium' | 'Low'
}

function fallbackEnrichment(disease: string): DiseaseEnrichment {
    return {
        summary: `${disease} can spread quickly in warm or wet conditions. Early action helps prevent major crop loss.`,
        steps: [
            'Remove heavily affected leaves and destroy them away from the garden.',
            'Apply a recommended fungicide or control treatment early and repeat as directed.',
            'Avoid overhead watering and keep leaves dry where possible.',
            'Improve spacing and airflow between plants.',
            'Rotate crops next season to reduce disease carry-over.',
        ],
        relatedDiseases: ['Early Blight', 'Downy Mildew', 'Leaf Spot'],
        searchTerms: [disease],
    }
}

function extractJson(raw: string) {
    return raw.replace(/```json|```/g, '').trim()
}

function normalizeSteps(input: unknown) {
    if (!Array.isArray(input)) return []
    return input.map((entry) => String(entry ?? '').trim()).filter(Boolean).slice(0, 6)
}

async function edgeJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!EDGE_API_BASE_URL) throw new Error('Edge API base URL not configured')

    const res = await fetch(`${EDGE_API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const message = await res.text().catch(() => '')
        throw new Error(message || `Edge API error: ${res.status}`)
    }

    return (await res.json()) as T
}

async function callAnthropic(system: string, userContent: string, maxTokens = 600) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userContent }],
        }),
    })

    if (!res.ok) throw new Error(`Claude error: ${res.status}`)
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    return extractJson(data.content?.[0]?.text ?? '{}')
}

export async function assessPlantHealth(
    base64: string,
    context: { latitude?: number; longitude?: number; datetime?: string } = {},
): Promise<{
    plant: string
    disease: string
    confidence: number
    severity: string
}> {
    if (EDGE_API_BASE_URL) {
        return edgeJson('/plant/health-assessment', {
            imageBase64: base64,
            latitude: context.latitude,
            longitude: context.longitude,
            datetime: context.datetime,
        })
    }

    const PLANT_ID_KEY = import.meta.env.VITE_PLANT_ID_KEY || 'YOUR_PLANT_ID_KEY'
    if (PLANT_ID_KEY === 'YOUR_PLANT_ID_KEY') {
        await new Promise((resolve) => setTimeout(resolve, 1400))
        return { plant: 'Tomato', disease: 'Late Blight', confidence: 87, severity: 'High' }
    }

    const res = await fetch('https://plant.id/api/v3/health_assessment', {
        method: 'POST',
        headers: { 'Api-Key': PLANT_ID_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [`data:image/jpeg;base64,${base64}`], health: 'all' }),
    })

    if (!res.ok) throw new Error(`Plant.id error: ${res.status}`)

    const data = (await res.json()) as {
        result?: {
            disease?: { suggestions?: Array<{ name: string; probability?: number; disease_details?: { severity?: string } }> }
            classification?: { suggestions?: Array<{ name?: string }> }
        }
    }

    const top = data.result?.disease?.suggestions?.[0]
    if (!top) throw new Error('No disease detected. Try a clearer photo.')

    return {
        plant: data.result?.classification?.suggestions?.[0]?.name || 'Unknown plant',
        disease: top.name,
        confidence: Math.round((top.probability || 0) * 100),
        severity: top.disease_details?.severity || 'Medium',
    }
}

export async function enrichDiseaseDiagnosis(input: { disease: string; plant?: string }): Promise<DiseaseEnrichment> {
    if (EDGE_API_BASE_URL) {
        return edgeJson('/ai/enrich-disease', input)
    }

    if (ANTHROPIC_KEY === 'YOUR_ANTHROPIC_KEY') {
        await new Promise((resolve) => setTimeout(resolve, 900))
        return {
            summary: 'System advisory is not available. Showing available treatments for this disease.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [input.disease],
            aiUnavailable: true,
        }
    }

    const raw = await callAnthropic(
        'You are an agricultural advisor for Ugandan smallholder farmers. Respond ONLY with JSON, no markdown: {"summary":"2-3 sentences","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}. Use simple practical language and low-cost actions.',
        `Plant: ${input.plant ?? 'Unknown'}\nDisease: ${input.disease}`,
        600,
    )

    let parsed: Record<string, unknown>
    try {
        parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {
            summary: 'System advisory is temporarily unavailable. Showing available treatments for this disease.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [input.disease],
            aiUnavailable: true,
        }
    }

    const summary = String(parsed.summary ?? '').trim() || 'System advisory is temporarily unavailable. Showing available treatments.'
    const steps = normalizeSteps(parsed.steps)
    const relatedDiseases = normalizeSteps(parsed.relatedDiseases)
    const searchTerms = normalizeSteps(parsed.searchTerms)

    return {
        summary,
        steps: steps.length ? steps : [],
        relatedDiseases,
        searchTerms: searchTerms.length ? searchTerms : [input.disease],
    }
}

export async function diagnoseSymptoms(description: string): Promise<SymptomDiagnosis> {
    if (EDGE_API_BASE_URL) {
        return edgeJson('/ai/diagnose-symptoms', { description })
    }

    if (ANTHROPIC_KEY === 'YOUR_ANTHROPIC_KEY') {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        return {
            disease: 'Unknown disease',
            confidence: 'Low',
            summary: 'System diagnosis is not available. Please describe the symptoms or use a photo scan instead.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [],
            aiUnavailable: true,
        }
    }

    const raw = await callAnthropic(
        'You are an agricultural disease triage assistant for Ugandan farmers. Respond ONLY with JSON, no markdown: {"disease":"most likely disease name","confidence":"High|Medium|Low","summary":"2 sentence explanation","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}.',
        description,
        700,
    )

    let parsed: Record<string, unknown>
    try {
        parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {
            disease: 'Unknown disease',
            confidence: 'Low',
            ...fallbackEnrichment('crop disease'),
        }
    }

    const disease = String(parsed.disease ?? '').trim() || 'Unknown disease'
    const confidenceRaw = String(parsed.confidence ?? 'Low').trim().toLowerCase()
    const confidence = confidenceRaw === 'high' ? 'High' : confidenceRaw === 'medium' ? 'Medium' : 'Low'
    const summary = String(parsed.summary ?? '').trim() || fallbackEnrichment(disease).summary
    const steps = normalizeSteps(parsed.steps)
    const relatedDiseases = normalizeSteps(parsed.relatedDiseases)
    const searchTerms = normalizeSteps(parsed.searchTerms)

    return {
        disease,
        confidence,
        summary,
        steps: steps.length ? steps : fallbackEnrichment(disease).steps,
        relatedDiseases,
        searchTerms: searchTerms.length ? searchTerms : [disease],
    }
}

export async function assessPlantHealthWithContext(
    base64: string,
    context: { latitude?: number; longitude?: number; datetime?: string } = {},
): Promise<{
    plant: string
    disease: string
    confidence: number
    severity: string
}> {
    if (EDGE_API_BASE_URL) {
        return edgeJson('/plant/health-assessment', {
            imageBase64: base64,
            latitude: context.latitude,
            longitude: context.longitude,
            datetime: context.datetime,
        })
    }

    return assessPlantHealth(base64)
}