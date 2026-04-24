const ANTHROPIC_HAIKU_MODEL = 'claude-3-5-haiku-latest'
const ANTHROPIC_SONNET_MODEL = 'claude-sonnet-4-20250514'
const LOW_CONFIDENCE_RETAKE = 40
const HEALTHY_STRONG_MIN = 75
const HEALTHY_COMPETING_MIN = 15
const HEALTHY_MARGIN_MIN = 15
const CANDIDATE_CLOSE_GAP = 8

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return corsResponse(null, 204)
        }

        if (request.method !== 'POST') {
            return corsResponse(jsonResponse({ error: 'Method not allowed' }, 405), 405)
        }

        const url = new URL(request.url)

        try {
            if (url.pathname === '/plant/health-assessment') {
                const body = await request.json()
                const imageBase64 = String(body.imageBase64 || '').trim()
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
                const body = await request.json()
                const disease = String(body.disease || '').trim()
                const plant = String(body.plant || '').trim()
                const confidence = typeof body.confidence === 'number' ? body.confidence : undefined
                const confidenceBand = String(body.confidenceBand || '').trim().toLowerCase()
                const diagnosisState = String(body.diagnosisState || '').trim().toLowerCase()
                const sameFamilyCluster = Boolean(body.sameFamilyCluster)
                if (!disease) {
                    return corsResponse(jsonResponse({ error: 'disease is required' }, 400), 400)
                }

                const result = await enrichDiseaseDiagnosis({ disease, plant, confidence, confidenceBand, diagnosisState, sameFamilyCluster }, env)
                return corsResponse(jsonResponse(result), 200)
            }

            if (url.pathname === '/ai/diagnose-symptoms') {
                const body = await request.json()
                const description = String(body.description || '').trim()
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

async function assessPlantHealth(imageBase64, env, options = {}) {
    const requestBody = {
        images: [`data:image/jpeg;base64,${imageBase64}`],
    }

    if (typeof options.latitude === 'number') requestBody.latitude = options.latitude
    if (typeof options.longitude === 'number') requestBody.longitude = options.longitude
    const normalizedDatetime = normalizeKindwiseDatetime(options.datetime)
    if (normalizedDatetime) requestBody.datetime = normalizedDatetime

    let response = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method: 'POST',
        headers: {
            'Api-Key': env.PLANT_ID_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    })

    if (!response.ok && requestBody.datetime) {
        const firstError = await response.text().catch(() => '')
        const datetimeRejected = /datetime.+not in iso format/i.test(firstError)

        if (datetimeRejected) {
            const retryBody = { ...requestBody }
            delete retryBody.datetime

            response = await fetch('https://crop.kindwise.com/api/v1/identification', {
                method: 'POST',
                headers: {
                    'Api-Key': env.PLANT_ID_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(retryBody),
            })
        } else {
            throw new Error(firstError || `Plant.id error: ${response.status}`)
        }
    }

    const responseText = await response.text().catch(() => '')
    console.log('[crop.health] /plant/health-assessment response', {
        status: response.status,
        ok: response.ok,
        body: responseText,
    })

    if (!response.ok) {
        throw new Error(responseText || `Plant.id error: ${response.status}`)
    }

    const data = responseText ? JSON.parse(responseText) : {}
    const cropTop = data?.result?.crop?.suggestions?.[0]
    const diseaseSuggestions = Array.isArray(data?.result?.disease?.suggestions) ? data.result.disease.suggestions : []
    const rankedSuggestions = rankDiseaseSuggestions(diseaseSuggestions)
    const topSuggestion = rankedSuggestions[0]
    const nonHealthySuggestions = rankedSuggestions.filter((entry) => !isHealthySuggestion(entry.name))
    const topDisease = nonHealthySuggestions[0]
    const secondDisease = nonHealthySuggestions[1]
    const topThree = nonHealthySuggestions.slice(0, 3)
    const clusteredTopThree = hasRelatedTopThree(topThree)
    const sameFamilyCluster = isSameFamilyPair(topDisease?.name, secondDisease?.name)

    const healthyTop = Boolean(topSuggestion) && isHealthySuggestion(topSuggestion.name)
    const healthyConfidence = healthyTop ? topSuggestion.confidence : 0
    const topDiseaseConfidence = topDisease?.confidence || 0
    const confidenceGap = healthyTop
        ? (topSuggestion && topDisease ? Math.max(0, topSuggestion.confidence - topDisease.confidence) : undefined)
        : (topDisease && secondDisease ? Math.max(0, topDisease.confidence - secondDisease.confidence) : undefined)

    const healthyUncertain = healthyTop && (
        healthyConfidence < HEALTHY_STRONG_MIN
        || (topDisease && topDisease.confidence >= HEALTHY_COMPETING_MIN && (confidenceGap ?? 0) < HEALTHY_MARGIN_MIN)
    )

    if (healthyTop && !healthyUncertain) {
        return {
            plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
            disease: 'Healthy plant',
            confidence: healthyConfidence || Math.round(((cropTop?.probability || 1) * 100)),
            severity: 'None',
            healthy: true,
            diagnosisState: 'healthy_strong',
            confidenceGap,
            sameFamilyCluster,
            healthyUncertain: false,
            topDiseases: topThree,
            possibleDiseases: [],
        }
    }

    if (healthyUncertain) {
        return {
            plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
            disease: 'Healthy plant',
            confidence: healthyConfidence,
            severity: 'Uncertain',
            healthy: false,
            uncertain: true,
            diagnosisState: 'healthy_uncertain',
            confidenceGap,
            sameFamilyCluster,
            healthyUncertain: true,
            topDiseases: topThree,
            possibleDiseases: pickLowConfidenceCandidates(diseaseSuggestions),
        }
    }

    const confidence = topDiseaseConfidence

    if (confidence < LOW_CONFIDENCE_RETAKE && !clusteredTopThree) {
        return {
            plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
            disease: topDisease?.name || 'Unknown disease',
            confidence,
            severity: 'Unknown',
            needsRetake: true,
            uncertain: true,
            diagnosisState: 'low_confidence_retake',
            message:
                'Scan confidence is too low to diagnose safely. Please take a clearer photo before trying again.',
            retakeTips: buildRetakeTips(),
            confidenceGap,
            sameFamilyCluster,
            healthyUncertain: false,
            possibleDiseases: pickLowConfidenceCandidates(diseaseSuggestions),
            topDiseases: topThree,
        }
    }

    const competingClose = Boolean(
        topDisease
        && secondDisease
        && secondDisease.confidence >= HEALTHY_COMPETING_MIN
        && (confidenceGap ?? 999) <= CANDIDATE_CLOSE_GAP,
    )

    const diagnosisState = competingClose
        ? (sameFamilyCluster ? 'disease_competing_same_family' : 'disease_competing_mixed')
        : 'disease_strong'

    return {
        plant: cropTop?.name || cropTop?.scientific_name || 'Unknown plant',
        disease: topDisease?.name || 'Unknown disease',
        confidence,
        severity: topDisease?.details?.severity || 'Medium',
        confidenceBand: confidence >= 80 ? 'strong' : confidence >= 60 ? 'moderate' : 'weak',
        uncertain: competingClose || confidence < 60,
        clusteredTopThree,
        diagnosisState,
        confidenceGap,
        sameFamilyCluster,
        healthyUncertain: false,
        topDiseases: topThree,
        possibleDiseases: competingClose ? pickLowConfidenceCandidates(diseaseSuggestions) : [],
    }
}

async function enrichDiseaseDiagnosis(input, env) {
    if (isHealthySuggestion(input.disease)) {
        return {
            summary: 'The plant appears healthy. No treatment advisory is needed.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [],
            healthy: true,
        }
    }

    const prompt = [
        'You are an agricultural advisor for Ugandan smallholder farmers.',
        'Respond ONLY with JSON, no markdown.',
        '{"summary":"2-3 sentences","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}',
        'Use simple practical language and low-cost actions.',
        input.diagnosisState === 'healthy_uncertain'
            ? 'Important: do not claim the plant is definitely healthy. State uncertainty clearly and recommend a photo retake plus short monitoring checks.'
            : 'Give practical treatment-ready guidance when confidence is acceptable.',
        input.diagnosisState === 'disease_competing_same_family'
            ? 'Important: top disease options are close and from a similar family. Explain overlap briefly and include simple differentiators farmers can observe.'
            : '',
        input.diagnosisState === 'disease_competing_mixed'
            ? 'Important: top disease options are close but mixed. Give branch-style checks (if symptom A then likely X, if symptom B then likely Y).'
            : '',
        `Plant: ${input.plant || 'Unknown'}`,
        `Disease: ${input.disease}`,
        `DiagnosisState: ${input.diagnosisState || 'unknown'}`,
        `SameFamilyCluster: ${input.sameFamilyCluster ? 'yes' : 'no'}`,
    ].join('\n')

    const model = selectEnrichmentModel(input)

    let parsed = {}
    try {
        const raw = await callAnthropic(prompt, env, 600, model)
        parsed = parseJson(raw)
    } catch {
        return {
            summary: 'System advisory is temporarily unavailable. Showing available treatments for this disease.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [input.disease],
            aiUnavailable: true,
        }
    }

    return {
        summary: stringOrFallback(parsed.summary, 'System analysis incomplete. Showing available treatments.'),
        steps: normalizeArray(parsed.steps, 5, []),
        relatedDiseases: normalizeArray(parsed.relatedDiseases, 5, []),
        searchTerms: normalizeArray(parsed.searchTerms, 5, [input.disease]),
    }
}

async function diagnoseSymptoms(description, env) {
    const prompt = [
        'You are an agricultural disease triage assistant for Ugandan farmers.',
        'Respond ONLY with JSON, no markdown.',
        '{"disease":"most likely disease name","confidence":"High|Medium|Low","summary":"2 sentence explanation","steps":["step1","step2","step3","step4"],"relatedDiseases":["d1","d2","d3"],"searchTerms":["term1","term2"]}',
        'Return concise practical guidance.',
        `Description: ${description}`,
    ].join('\n')

    let parsed = {}
    try {
        const raw = await callAnthropic(prompt, env, 700)
        parsed = parseJson(raw)
    } catch {
        return {
            disease: 'Unknown disease',
            confidence: 'Low',
            summary: 'System diagnosis is temporarily unavailable. Please try a photo scan instead or search for a known disease.',
            steps: [],
            relatedDiseases: [],
            searchTerms: [],
            aiUnavailable: true,
        }
    }
    const disease = String(parsed.disease || '').trim() || 'Unknown disease'
    const confidenceRaw = String(parsed.confidence || 'Low').trim().toLowerCase()
    const confidence = confidenceRaw === 'high' ? 'High' : confidenceRaw === 'medium' ? 'Medium' : 'Low'

    return {
        disease,
        confidence,
        summary: stringOrFallback(parsed.summary, 'System response incomplete.'),
        steps: normalizeArray(parsed.steps, 5, []),
        relatedDiseases: normalizeArray(parsed.relatedDiseases, 5, []),
        searchTerms: normalizeArray(parsed.searchTerms, 5, [disease]),
    }
}

async function callAnthropic(prompt, env, maxTokens, model = ANTHROPIC_SONNET_MODEL) {
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

    const data = await response.json()
    return stripCodeFences(data.content?.[0]?.text || '{}')
}

function parseJson(raw) {
    try {
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

function stripCodeFences(raw) {
    return String(raw).replace(/```json|```/g, '').trim()
}

function normalizeArray(input, limit, fallback) {
    if (!Array.isArray(input)) return fallback
    const values = input.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, limit)
    return values.length ? values : fallback
}

function stringOrFallback(value, fallback) {
    const text = String(value || '').trim()
    return text || fallback
}

function fallbackSummary(disease) {
    return `${disease} can spread quickly in warm or wet conditions. Early action helps prevent major crop loss.`
}

function normalizeKindwiseDatetime(value) {
    if (!value) return null
    const raw = String(value).trim()
    if (!raw) return null

    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return null

    // Kindwise expects second precision, e.g. 2026-04-14T16:04:24Z
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function isHealthySuggestion(value) {
    const text = String(value || '').trim().toLowerCase()
    return text.includes('healthy') || text.includes('no disease') || text === 'health' || text === 'healthy plant'
}

function buildRetakeTips() {
    return [
        'Shoot in natural daylight, not shade.',
        'Get within 20-30cm of the affected leaf or stem.',
        'Avoid wet leaves (raindrops can confuse detection).',
        'Capture the worst-affected area, not a healthy-looking part.',
    ]
}

function hasRelatedTopThree(topThree) {
    if (!Array.isArray(topThree) || topThree.length < 2) return false
    const families = topThree.map((entry) => diseaseFamily(entry.name)).filter(Boolean)
    const familyCounts = new Map()
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

function diseaseFamily(name) {
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

function diseaseTokens(name) {
    const stopwords = new Set(['disease', 'leaf', 'plant', 'crop', 'of', 'the', 'and'])
    const tokens = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token && token.length > 2 && !stopwords.has(token))
    return new Set(tokens)
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
        },
    })
}

function corsResponse(response, status = response?.status || 200) {
    const headers = new Headers(response ? response.headers : undefined)
    headers.set('access-control-allow-origin', '*')
    headers.set('access-control-allow-methods', 'POST, OPTIONS')
    headers.set('access-control-allow-headers', 'content-type')
    return new Response(response ? response.body : null, {
        status,
        headers,
    })
}

function selectEnrichmentModel(input) {
    const diagnosisState = String(input?.diagnosisState || '').toLowerCase()
    if (diagnosisState === 'healthy_uncertain' || diagnosisState === 'disease_competing_same_family' || diagnosisState === 'disease_competing_mixed') {
        return ANTHROPIC_SONNET_MODEL
    }

    const band = String(input?.confidenceBand || '').toLowerCase()
    if (band === 'strong') return ANTHROPIC_HAIKU_MODEL
    if (band === 'moderate' || band === 'weak') return ANTHROPIC_SONNET_MODEL

    const confidence = Number(input?.confidence)
    if (Number.isFinite(confidence) && confidence >= 80) return ANTHROPIC_HAIKU_MODEL
    return ANTHROPIC_SONNET_MODEL
}

function pickLowConfidenceCandidates(suggestions) {
    const ranked = (Array.isArray(suggestions) ? suggestions : [])
        .map((entry) => ({
            name: entry?.name || entry?.scientific_name || 'Unknown disease',
            confidence: Math.round((entry?.probability || 0) * 100),
        }))
        .filter((entry) => !isHealthySuggestion(entry.name))
        .sort((a, b) => b.confidence - a.confidence)

    if (!ranked.length) return []

    const top = ranked[0]
    const second = ranked[1]
    if (!second) return [top]

    const gap = Math.abs(top.confidence - second.confidence)
    return gap <= CANDIDATE_CLOSE_GAP ? [top, second] : [top]
}

function rankDiseaseSuggestions(suggestions) {
    return (Array.isArray(suggestions) ? suggestions : [])
        .map((entry) => ({
            ...entry,
            name: entry?.name || entry?.scientific_name || 'Unknown disease',
            confidence: Math.round((entry?.probability || 0) * 100),
        }))
        .sort((a, b) => b.confidence - a.confidence)
}

function isSameFamilyPair(nameA, nameB) {
    if (!nameA || !nameB) return false
    const familyA = diseaseFamily(nameA)
    const familyB = diseaseFamily(nameB)
    return Boolean(familyA && familyB && familyA === familyB)
}