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

async function edgeJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!EDGE_API_BASE_URL) {
        throw new Error('Worker URL is missing. Set VITE_EDGE_API_BASE_URL for both local and production builds.')
    }

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

export async function assessPlantHealth(
    base64: string,
    context: { latitude?: number; longitude?: number; datetime?: string } = {},
): Promise<{
    plant: string
    disease: string
    confidence: number
    severity: string
}> {
    return edgeJson('/plant/health-assessment', {
        imageBase64: base64,
        latitude: context.latitude,
        longitude: context.longitude,
        datetime: context.datetime,
    })
}

export async function enrichDiseaseDiagnosis(input: { disease: string; plant?: string }): Promise<DiseaseEnrichment> {
    return edgeJson('/ai/enrich-disease', input)
}

export async function diagnoseSymptoms(description: string): Promise<SymptomDiagnosis> {
    return edgeJson('/ai/diagnose-symptoms', { description })
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
    return edgeJson('/plant/health-assessment', {
        imageBase64: base64,
        latitude: context.latitude,
        longitude: context.longitude,
        datetime: context.datetime,
    })
}