import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

type NotificationOutboxRow = {
  id: string
  user_id: string | null
  channel: 'email' | 'sms'
  recipient: string
  template_key: string
  payload: Record<string, unknown> | null
  retry_count: number
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

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildNotificationEmail(row: NotificationOutboxRow): { subject: string; html: string } {
  const payload = row.payload ?? {}
  const role = String(payload.role ?? '').trim() || 'user'
  const previousRole = String(payload.previous_role ?? '').trim()
  const name = String(payload.name ?? '').trim() || 'there'
  const loginUrl = String(Deno.env.get('ADMIN_PORTAL_URL') ?? 'https://cropdoctor.bitpulse.dev/admin').trim()

  if (row.template_key === 'account_created') {
    return {
      subject: 'Your CropDoctor staff account is ready',
      html: `<p>Hello ${escapeHtml(name)},</p><p>Your account has been set up with <strong>${escapeHtml(role)}</strong> access.</p><p>You can sign in at: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p><p>If this wasn't expected, contact support immediately.</p>`,
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

async function sendResendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('EMAIL_FROM')

  if (!resendKey || !emailFrom) {
    throw new Error('Server misconfiguration: missing RESEND_API_KEY or EMAIL_FROM')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
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
    return json({ error: 'Only active admin/co-admin can dispatch notifications.' }, 403)
  }

  const { data: rows, error: loadError } = await adminClient
    .from('notification_outbox')
    .select('id,user_id,channel,recipient,template_key,payload,retry_count')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (loadError) {
    return json({ error: loadError.message ?? 'Failed to load notification outbox.' }, 500)
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of (rows ?? []) as NotificationOutboxRow[]) {
    if (row.channel !== 'email') {
      skipped += 1
      continue
    }

    const recipient = String(row.recipient ?? '').trim().toLowerCase()
    if (!recipient || !recipient.includes('@')) {
      failed += 1
      const retries = Number(row.retry_count ?? 0) + 1
      const status = retries >= 3 ? 'failed' : 'pending'
      await adminClient
        .from('notification_outbox')
        .update({
          status,
          retry_count: retries,
          last_error: 'Missing or invalid email recipient',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      continue
    }

    try {
      const email = buildNotificationEmail(row)
      await sendResendEmail({ to: recipient, subject: email.subject, html: email.html })
      sent += 1

      await adminClient
        .from('notification_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    } catch (error) {
      failed += 1
      const retries = Number(row.retry_count ?? 0) + 1
      const status = retries >= 3 ? 'failed' : 'pending'
      const message = error instanceof Error ? error.message : 'Unknown delivery error'

      await adminClient
        .from('notification_outbox')
        .update({
          status,
          retry_count: retries,
          last_error: String(message).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }
  }

  return json({
    processed: (rows ?? []).length,
    sent,
    failed,
    skipped,
  })
})
