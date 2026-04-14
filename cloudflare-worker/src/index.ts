export interface Env {
    PLANT_ID_KEY: string
    ANTHROPIC_API_KEY: string
}

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

type PlantHealthAssessmentResponse = {
    plant: string
    disease: string
    confidence: number
    severity: string
    healthy?: boolean
}

type PlantHealthAssessmentRequest = {
    imageBase64?: string
    latitude?: number
    longitude?: number
    datetime?: string
}

type DiseaseEnrichmentResponse = {
    summary: string
    steps: string[]
    relatedDiseases: string[]
    searchTerms: string[]
}

type SymptomDiagnosisResponse = DiseaseEnrichmentResponse & {
    disease: string
    confidence: 'High' | 'Medium' | 'Low'
}

const ANTHROPIC_MODEL = 'claude-opus-4-6'

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === 'OPTIONS') {
            return corsResponse(null, 204)
        }

        if (request.method !== 'POST') {
            return corsResponse(
                jsonResponse({ error: 'Method not allowed' }, 405),
                405,
            )
        }

        const url = new URL(request.url)

        try {
            if (url.pathname === '/plant/health-assessment') {
                const body = await request.json<PlantHealthAssessmentRequest>()
                const imageBase64 = String(body.imageBase64 ?? '').trim()
                if (!imageBase64) {
                    return corsResponse(jsonResponse({ error: 'imageBase64 is required' }, 400), 400)
                }

                const result = await assessPlantHealth(imageBase64, env, {
                    latitude: body.latitude,
                    longitude: body.longitude,
                    datetime: body.datetime,
                })
                return corsResponse(jsonResponse(result), 200)
            }

            if (url.pathname === '/ai/enrich-disease') {
                const body = await request.json<{ disease?: string; plant?: string }>()
                const disease = String(body.disease ?? '').trim()
                const plant = String(body.plant ?? '').trim()
                if (!disease) {
                    return corsResponse(jsonResponse({ error: 'disease is required' }, 400), 400)
                }

                const result = await enrichDiseaseDiagnosis({ disease, plant }, env)
                return corsResponse(jsonResponse(result), 200)
            }

            if (url.pathname === '/ai/diagnose-symptoms') {
                const body = await request.json<{ description?: string }>()
                const description = String(body.description ?? '').trim()
                if (!description) {
                    return corsResponse(jsonResponse({ error: 'description is required' }, 400), 400)
                }

                const result = await diagnoseSymptoms(description, env)
                return corsResponse(jsonResponse(result), 200)
            }

            return corsResponse(jsonResponse({ error: 'Not found' }, 404), 404)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return corsResponse(jsonResponse({ error: message }, 500), 500)
        }
    },
}

async function assessPlantHealth(
    imageBase64: string,
    env: Env,
    options: { latitude?: number; longitude?: number; datetime?: string } = {},
): Promise<PlantHealthAssessmentResponse> {
    const requestBody: Record<string, unknown> = {
        images: [`data:image/jpeg;base64,${imageBase64}`],
        similar_images: false,
    }

    if (typeof options.latitude === 'number') requestBody.latitude = options.latitude
    if (typeof options.longitude === 'number') requestBody.longitude = options.longitude
    if (options.datetime) requestBody.datetime = options.datetime

    const response = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method: 'POST',
        headers: {
            'Api-Key': env.PLANT_ID_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Plant.id error: ${response.status}`)
    }

    const data = (await response.json()) as {
        access_token?: string
        result?: {
            crop?: {
                suggestions?: Array<{
                    name?: string
                    scientific_name?: string
                    probability?: number
                }>
            }
            disease?: {
                suggestions?: Array<{
                    name?: string
                    scientific_name?: string
                    probability?: number
                    details?: {
                        severity?: string
                    }
                }>
            }
        }
    }

    const cropTop = data.result?.crop?.suggestions?.[0]
    const diseaseTop = data.result?.disease?.suggestions?.[0]
    const healthyDetected = isHealthySuggestion(diseaseTop?.name || diseaseTop?.scientific_name) || !diseaseTop

    if (healthyDetected) {
        return {
            plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
            disease: 'Healthy plant',
            confidence: Math.round((cropTop?.probability || 1) * 100),
            severity: 'None',
            healthy: true,
        }
    }

    return {
        plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
        disease: diseaseTop.name || diseaseTop.scientific_name || 'Unknown disease',
        confidence: Math.round((diseaseTop.probability || 0) * 100),
        severity: diseaseTop.details?.severity || 'Medium',
    }
}

async function enrichDiseaseDiagnosis(
    input: { disease: string; plant?: string },
    env: Env,
): Promise<DiseaseEnrichmentResponse> {
    const prompt = [
        'You are an agricultural advisor for Ugandan smallholder farmers.',
        'Respond ONLY with JSON, no markdown.',
        '{"summary":"2-3 sentences","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}',
        'Use simple practical language and low-cost actions.',
        `Plant: ${input.plant || 'Unknown'}`,
        `Disease: ${input.disease}`,
    ].join('\n')

    const raw = await callAnthropic(prompt, env, 600)
    const parsed = parseJson(raw)

    return {
        summary: stringOrFallback(parsed.summary, fallbackSummary(input.disease)),
        steps: normalizeArray(parsed.steps, 5, fallbackSteps()),
        relatedDiseases: normalizeArray(parsed.relatedDiseases, 5, ['Early Blight', 'Downy Mildew', 'Leaf Spot']),
        searchTerms: normalizeArray(parsed.searchTerms, 5, [input.disease]),
    }
}

async function diagnoseSymptoms(description: string, env: Env): Promise<SymptomDiagnosisResponse> {
    const prompt = [
        'You are an agricultural disease triage assistant for Ugandan farmers.',
        'Respond ONLY with JSON, no markdown.',
        '{"disease":"most likely disease name","confidence":"High|Medium|Low","summary":"2 sentence explanation","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}',
        'Return concise practical guidance.',
        `Description: ${description}`,
    ].join('\n')

    const raw = await callAnthropic(prompt, env, 700)
    const parsed = parseJson(raw)
    const disease = String(parsed.disease ?? '').trim() || 'Unknown disease'
    const confidenceRaw = String(parsed.confidence ?? 'Low').trim().toLowerCase()
    const confidence: SymptomDiagnosisResponse['confidence'] = confidenceRaw === 'high' ? 'High' : confidenceRaw === 'medium' ? 'Medium' : 'Low'

    return {
        disease,
        confidence,
        summary: stringOrFallback(parsed.summary, fallbackSummary(disease)),
        steps: normalizeArray(parsed.steps, 5, fallbackSteps()),
        relatedDiseases: normalizeArray(parsed.relatedDiseases, 5, ['Early Blight', 'Downy Mildew', 'Leaf Spot']),
        searchTerms: normalizeArray(parsed.searchTerms, 5, [disease]),
    }
}

async function callAnthropic(prompt: string, env: Env, maxTokens: number) {

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: maxTokens,
            system: prompt,
            messages: [{ role: 'user', content: 'Return the JSON now.' }],
        }),
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Anthropic error: ${response.status}`)
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    return stripCodeFences(data.content?.[0]?.text ?? '{}')
}

function parseJson(raw: string): Record<string, unknown> {
    try {
        return JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {}
    }
}

function stripCodeFences(raw: string) {
    return raw.replace(/```json|```/g, '').trim()
}

function normalizeArray(input: unknown, limit: number, fallback: string[]) {
    if (!Array.isArray(input)) return fallback
    const values = input.map((entry) => String(entry ?? '').trim()).filter(Boolean).slice(0, limit)
    return values.length ? values : fallback
}

function stringOrFallback(value: unknown, fallback: string) {
    const text = String(value ?? '').trim()
    return text || fallback
}

function isHealthySuggestion(value: string | undefined) {
    const text = String(value ?? '').trim().toLowerCase()
    return text.includes('healthy') || text.includes('no disease') || text === 'health' || text === 'healthy plant'
}

function fallbackSummary(disease: string) {
    return `${disease} can spread quickly in warm or wet conditions. Early action helps prevent major crop loss.`
}

function fallbackSteps() {
    return [
        'Remove heavily affected leaves and destroy them away from the garden.',
        'Apply a recommended fungicide or control treatment early and repeat as directed.',
        'Avoid overhead watering and keep leaves dry where possible.',
        'Improve spacing and airflow between plants.',
        'Rotate crops next season to reduce disease carry-over.',
    ]
}

function jsonResponse(body: JSONValue, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
        },
    })
}

function corsResponse(response: Response, status = response.status) {
    const headers = new Headers(response.headers)
    headers.set('access-control-allow-origin', '*')
    headers.set('access-control-allow-methods', 'POST, OPTIONS')
    headers.set('access-control-allow-headers', 'content-type')
    return new Response(response.body, {
        status,
        headers,
    })
}