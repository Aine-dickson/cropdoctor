import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

type CreateUserPayload = {
    name?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    region?: string | null
    role?: 'admin' | 'co_admin' | 'supplier' | 'farmer' | string
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'content-type': 'application/json; charset=utf-8',
        },
    })
}

function normalizeEmail(value: unknown): string | null {
    const email = String(value ?? '').trim().toLowerCase()
    return email || null
}

function normalizePhone(value: unknown): string | null {
    const phone = String(value ?? '').trim()
    return phone || null
}

function randomPassword(): string {
    const a = crypto.randomUUID().replace(/-/g, '')
    const b = crypto.randomUUID().replace(/-/g, '')
    return `${a}${b}`.slice(0, 32)
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return json({ error: 'Server misconfiguration.' }, 500)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
        return json({ error: 'Missing authorization header.' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const {
        data: { user: actor },
        error: actorError,
    } = await userClient.auth.getUser()

    if (actorError || !actor) {
        return json({ error: 'Unauthorized.' }, 401)
    }

    const { data: actorProfile, error: actorProfileError } = await adminClient
        .from('profiles')
        .select('id, role, is_active')
        .eq('id', actor.id)
        .single()

    if (
        actorProfileError
        || !actorProfile
        || actorProfile.is_active === false
        || !['admin', 'co_admin'].includes(String(actorProfile.role ?? ''))
    ) {
        return json({ error: 'Only active admin/co-admin can create users.' }, 403)
    }

    const payload = (await req.json().catch(() => ({}))) as CreateUserPayload

    const role = String(payload.role ?? 'farmer').trim().toLowerCase()
    const actorRole = String(actorProfile.role ?? '').trim().toLowerCase()
    const name = String(payload.name ?? '').trim()
    const email = normalizeEmail(payload.email)
    const phone = normalizePhone(payload.phone)
    const address = String(payload.address ?? '').trim()
    const region = String(payload.region ?? '').trim()

    if (!['admin', 'co_admin', 'supplier', 'farmer'].includes(role)) {
        return json({ error: 'Invalid role.' }, 400)
    }

    if (actorRole === 'co_admin' && (role === 'admin' || role === 'co_admin')) {
        return json({ error: 'Co-admin cannot create admin or co-admin accounts.' }, 403)
    }

    if (!phone) {
        return json({ error: 'Phone is required.' }, 400)
    }

    const strictRole = role === 'admin' || role === 'supplier'
    if (strictRole && (!email || !name || !address || !region)) {
        return json({ error: 'For admin/supplier, name, email, phone, address and region are required.' }, 400)
    }

    if (!email && !phone) {
        return json({ error: 'Email or phone is required.' }, 400)
    }

    if (email) {
        const { data: existingByEmail, error: emailLookupError } = await adminClient
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .limit(1)

        if (emailLookupError) {
            return json({ error: emailLookupError.message ?? 'Failed to validate email uniqueness.' }, 500)
        }

        if (Array.isArray(existingByEmail) && existingByEmail.length > 0) {
            return json({ error: 'Contradiction: email is already associated with another account.' }, 409)
        }
    }

    const { data: existingByPhone, error: phoneLookupError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .limit(1)

    if (phoneLookupError) {
        return json({ error: phoneLookupError.message ?? 'Failed to validate phone uniqueness.' }, 500)
    }

    if (Array.isArray(existingByPhone) && existingByPhone.length > 0) {
        return json({ error: 'Contradiction: phone is already associated with another account.' }, 409)
    }

    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email: email ?? undefined,
        phone: phone ?? undefined,
        password: randomPassword(),
        email_confirm: Boolean(email),
        phone_confirm: true,
        user_metadata: {
            name: name || null,
            created_by_admin: actor.id,
        },
    })

    if (createUserError || !createdUserData?.user) {
        const message = String(createUserError?.message ?? 'Failed to create auth user.')
        const normalizedMessage = message.toLowerCase()
        const status = normalizedMessage.includes('already') || normalizedMessage.includes('exists') ? 409 : 400
        return json({ error: `Contradiction: ${message}` }, status)
    }

    const createdAuthUser = createdUserData.user

    const { error: createProfileError } = await adminClient
        .from('profiles')
        .insert({
            id: createdAuthUser.id,
            name: name || null,
            phone,
            email,
            address: address || null,
            region: region || null,
            role,
            is_active: true,
        })

    if (createProfileError) {
        await adminClient.auth.admin.deleteUser(createdAuthUser.id).catch(() => null)
        return json({ error: createProfileError.message ?? 'Failed to create profile.' }, 400)
    }

    return json({
        id: createdAuthUser.id,
        role,
        email,
        phone,
        message: 'User created successfully.',
    })
})
