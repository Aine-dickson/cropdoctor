export interface Env {
    PLANT_ID_KEY: string
    ANTHROPIC_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_ROLE_KEY: string
    RESEND_API_KEY: string
    EMAIL_FROM: string
    ADMIN_PORTAL_URL?: string
    NOTIFICATION_DISPATCH_TOKEN?: string
}

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

type PlantHealthAssessmentResponse = {
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

type DiseaseEnrichmentRequest = {
    disease: string
    plant?: string
    confidence?: number
    confidenceBand?: 'strong' | 'moderate' | 'weak' | string
}

type SymptomDiagnosisResponse = DiseaseEnrichmentResponse & {
    disease: string
    confidence: 'High' | 'Medium' | 'Low'
}

type NotificationOutboxRow = {
    id: string
    user_id: string | null
    channel: 'email' | 'sms'
    recipient: string
    template_key: string
    payload: Record<string, unknown> | null
    retry_count: number
}

const ANTHROPIC_HAIKU_MODEL = 'claude-3-5-haiku-latest'
const ANTHROPIC_SONNET_MODEL = 'claude-sonnet-4-20250514'

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
                const body = await request.json<DiseaseEnrichmentRequest>()
                const disease = String(body.disease ?? '').trim()
                const plant = String(body.plant ?? '').trim()
                const confidence = typeof body.confidence === 'number' ? body.confidence : undefined
                const confidenceBand = String(body.confidenceBand ?? '').trim().toLowerCase()
                if (!disease) {
                    return corsResponse(jsonResponse({ error: 'disease is required' }, 400), 400)
                }

                const result = await enrichDiseaseDiagnosis({ disease, plant, confidence, confidenceBand }, env)
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

            if (url.pathname === '/admin/notifications/dispatch') {
                if (!isDispatchAuthorized(request, env)) {
                    return corsResponse(jsonResponse({ error: 'Unauthorized' }, 401), 401)
                }

                const result = await processPendingNotifications(env)
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

    const responseText = await response.text().catch(() => '')
    console.log('[crop.health] /plant/health-assessment response', {
        status: response.status,
        ok: response.ok,
        body: responseText,
    })

    if (!response.ok) {
        throw new Error(responseText || `Plant.id error: ${response.status}`)
    }

    const data = (responseText ? JSON.parse(responseText) : {}) as {
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
    const diseaseSuggestions = Array.isArray(data.result?.disease?.suggestions) ? data.result.disease.suggestions : []
    const diseaseTop = diseaseSuggestions[0]
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

    const topThree = diseaseSuggestions.slice(0, 3).map((entry) => ({
        name: entry?.name || entry?.scientific_name || 'Unknown disease',
        confidence: Math.round((entry?.probability || 0) * 100),
    }))

    const confidence = Math.round((diseaseTop?.probability || 0) * 100)
    const clusteredTopThree = hasRelatedTopThree(topThree)

    if (confidence < 40 && !clusteredTopThree) {
        const possibleDiseases = pickLowConfidenceCandidates(diseaseSuggestions)
        return {
            plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
            disease: diseaseTop?.name || diseaseTop?.scientific_name || 'Unknown disease',
            confidence,
            severity: 'Unknown',
            needsRetake: true,
            message: 'Scan confidence is too low to diagnose safely. Please take a clearer photo before trying again.',
            retakeTips: buildRetakeTips(),
            possibleDiseases,
            topDiseases: topThree,
        }
    }

    return {
        plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
        disease: diseaseTop?.name || diseaseTop?.scientific_name || 'Unknown disease',
        confidence,
        severity: diseaseTop.details?.severity || 'Medium',
        confidenceBand: confidence >= 80 ? 'strong' : confidence >= 60 ? 'moderate' : 'weak',
        uncertain: confidence < 60,
        clusteredTopThree,
        topDiseases: topThree,
    }
}

async function enrichDiseaseDiagnosis(
    input: DiseaseEnrichmentRequest,
    env: Env,
): Promise<DiseaseEnrichmentResponse> {
    if (isHealthySuggestion(input.disease)) {
        return {
            summary: 'The plant appears healthy. No treatment advisory is needed.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [],
        }
    }

    const prompt = [
        'You are an agricultural advisor for Ugandan smallholder farmers.',
        'Respond ONLY with JSON, no markdown.',
        '{"summary":"2-3 sentences","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}',
        'Use simple practical language and low-cost actions.',
        `Plant: ${input.plant || 'Unknown'}`,
        `Disease: ${input.disease}`,
    ].join('\n')

    const model = selectEnrichmentModel(input)

    const raw = await callAnthropic(prompt, env, 600, model)
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

async function callAnthropic(prompt: string, env: Env, maxTokens: number, model = ANTHROPIC_SONNET_MODEL) {

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
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

function selectEnrichmentModel(input: DiseaseEnrichmentRequest) {
    const band = String(input?.confidenceBand ?? '').toLowerCase()
    if (band === 'strong') return ANTHROPIC_HAIKU_MODEL
    if (band === 'moderate' || band === 'weak') return ANTHROPIC_SONNET_MODEL

    const confidence = Number(input?.confidence)
    if (Number.isFinite(confidence) && confidence >= 80) return ANTHROPIC_HAIKU_MODEL
    return ANTHROPIC_SONNET_MODEL
}

function buildRetakeTips() {
    return [
        'Shoot in natural daylight, not shade.',
        'Get within 20-30cm of the affected leaf or stem.',
        'Avoid wet leaves (raindrops can confuse detection).',
        'Capture the worst-affected area, not a healthy-looking part.',
    ]
}

function hasRelatedTopThree(topThree: Array<{ name: string; confidence: number }>) {
    if (!Array.isArray(topThree) || topThree.length < 2) return false

    const families = topThree.map((entry) => diseaseFamily(entry.name)).filter(Boolean)
    const familyCounts = new Map<string, number>()
    families.forEach((family) => familyCounts.set(family, (familyCounts.get(family) || 0) + 1))
    const sameFamily = Array.from(familyCounts.values()).some((count) => count >= 2)
    if (sameFamily) return true

    const baseTokens = diseaseTokens(topThree[0].name)
    return topThree.slice(1).some((entry) => {
        const compareTokens = diseaseTokens(entry.name)
        for (const token of compareTokens) {
            if (baseTokens.has(token)) return true
        }
        return false
    })
}

function diseaseFamily(name: string) {
    const text = String(name || '').toLowerCase()
    const families = [
        'blight',
        'mildew',
        'spot',
        'rust',
        'rot',
        'wilt',
        'virus',
        'mosaic',
        'curl',
        'anthracnose',
        'canker',
        'scab',
    ]
    return families.find((family) => text.includes(family)) || ''
}

function diseaseTokens(name: string) {
    const stopwords = new Set(['disease', 'leaf', 'plant', 'crop', 'of', 'the', 'and'])
    const tokens = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token && token.length > 2 && !stopwords.has(token))
    return new Set(tokens)
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

function pickLowConfidenceCandidates(
    suggestions: Array<{ name?: string; scientific_name?: string; probability?: number }> | undefined,
) {
    const ranked = (Array.isArray(suggestions) ? suggestions : [])
        .map((entry) => ({
            name: entry?.name || entry?.scientific_name || 'Unknown disease',
            confidence: Math.round((entry?.probability || 0) * 100),
        }))
        .filter((entry) => !isHealthySuggestion(entry.name))

    if (!ranked.length) return []

    const top = ranked[0]
    const second = ranked[1]
    if (!second) return [top]

    const gap = Math.abs(top.confidence - second.confidence)
    const CLOSE_GAP_THRESHOLD = 8
    return gap <= CLOSE_GAP_THRESHOLD ? [top, second] : [top]
}

function isDispatchAuthorized(request: Request, env: Env) {
    const expected = String(env.NOTIFICATION_DISPATCH_TOKEN ?? '').trim()
    if (!expected) return false

    const headerToken = String(request.headers.get('x-admin-notify-token') ?? '').trim()
    const authHeader = String(request.headers.get('authorization') ?? '').trim()
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''

    return headerToken === expected || bearerToken === expected
}

async function processPendingNotifications(env: Env) {
    const rows = await fetchPendingNotifications(env, 50)
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const row of rows) {
        if (row.channel !== 'email') {
            skipped += 1
            continue
        }

        const recipient = String(row.recipient ?? '').trim().toLowerCase()
        if (!recipient || !recipient.includes('@')) {
            failed += 1
            await markNotificationFailed(env, row.id, row.retry_count, 'Missing or invalid email recipient')
            continue
        }

        try {
            const email = buildNotificationEmail(row, env)
            await sendResendEmail(env, {
                to: recipient,
                subject: email.subject,
                html: email.html,
            })
            sent += 1
            await markNotificationSent(env, row.id)
        } catch (error) {
            failed += 1
            const message = error instanceof Error ? error.message : 'Unknown delivery error'
            await markNotificationFailed(env, row.id, row.retry_count, message)
        }
    }

    return {
        processed: rows.length,
        sent,
        failed,
        skipped,
    }
}

async function fetchPendingNotifications(env: Env, limit: number) {
    const url = `${env.SUPABASE_URL}/rest/v1/notification_outbox?status=eq.pending&order=created_at.asc&limit=${limit}`
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'content-type': 'application/json',
        },
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Failed to load notification outbox: ${response.status}`)
    }

    return (await response.json()) as NotificationOutboxRow[]
}

async function markNotificationSent(env: Env, id: string) {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/notification_outbox?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
            retry_count: 0,
            last_error: null,
            updated_at: new Date().toISOString(),
        }),
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Failed to mark notification as sent (${id})`)
    }
}

async function markNotificationFailed(env: Env, id: string, retryCount: number, errorMessage: string) {
    const retries = Number(retryCount ?? 0) + 1
    const status = retries >= 3 ? 'failed' : 'pending'

    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/notification_outbox?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            status,
            retry_count: retries,
            last_error: String(errorMessage || '').slice(0, 500),
            updated_at: new Date().toISOString(),
        }),
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Failed to mark notification as failed (${id})`)
    }
}

async function sendResendEmail(env: Env, params: { to: string; subject: string; html: string }) {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${env.RESEND_API_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [params.to],
            subject: params.subject,
            html: params.html,
        }),
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Resend failed with status ${response.status}`)
    }
}

function buildNotificationEmail(row: NotificationOutboxRow, env: Env) {
    const payload = row.payload ?? {}
    const role = String(payload.role ?? '').trim() || 'user'
    const previousRole = String(payload.previous_role ?? '').trim()
    const name = String(payload.name ?? '').trim() || 'there'
    const loginUrl = String(env.ADMIN_PORTAL_URL ?? 'https://cropdoctor.bitpulse.dev/admin').trim()

    if (row.template_key === 'account_created') {
        return {
            subject: 'Your CropDoctor staff account is ready',
            html: `<p>Hello ${escapeHtml(name)},</p><p>Your account has been set up with <strong>${escapeHtml(role)}</strong> access.</p><p>You can sign in at: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p><p>If this wasn\'t expected, contact support immediately.</p>`,
        }
    }

    if (row.template_key === 'role_elevated') {
        return {
            subject: 'Your CropDoctor access has been elevated',
            html: `<p>Hello ${escapeHtml(name)},</p><p>Your access has been updated from <strong>${escapeHtml(previousRole || 'farmer')}</strong> to <strong>${escapeHtml(role)}</strong>.</p><p>Sign in at: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`,
        }
    }

    if (row.template_key === 'role_switched') {
        return {
            subject: 'Your CropDoctor staff role has changed',
            html: `<p>Hello ${escapeHtml(name)},</p><p>Your role has changed from <strong>${escapeHtml(previousRole || 'staff')}</strong> to <strong>${escapeHtml(role)}</strong>.</p><p>Sign in at: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`,
        }
    }

    return {
        subject: 'CropDoctor account update',
        html: `<p>Hello ${escapeHtml(name)},</p><p>Your account details were updated.</p><p>Sign in at: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`,
    }
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}