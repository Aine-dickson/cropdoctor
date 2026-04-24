import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type MaybeError = { message?: string } | string | null

interface Profile {
    name?: string
    address?: string
    region?: string
    phone?: string
    email?: string
    [key: string]: unknown
}

interface OrderInput {
    items: Array<Record<string, unknown>>
    subtotal: number
    deliveryFee: number
    total: number
    location: string
    paymentMethod: 'mtn' | 'airtel' | 'cod'
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
    momoNumber?: string | null
    notes?: string | null
}

interface DetectionInput {
    disease: string
    plant: string
    confidence: number
    severity?: 'low' | 'medium' | 'high'
}

interface ReviewInput {
    productId: number | string
    rating: number
    comment: string
}

export const useAuthStore = defineStore('auth', () => {
    const otpChannel = import.meta.env.VITE_OTP_CHANNEL === 'phone' ? 'phone' : 'email'
    const session = ref<Session | null>(null)
    const profile = ref<Profile | null>(null)
    const loading = ref(true)

    const isLoggedIn = computed(() => !!session.value)
    const isGuest = computed(() => !session.value)
    const userId = computed(() => session.value?.user?.id ?? null)
    const displayName = computed(() => profile.value?.name ?? 'Guest')
    const contactType = computed(() => {
        if (otpChannel === 'phone') return 'phone'
        return 'email'
    })
    const contactValue = computed(() => {
        const sessionPhone = String(session.value?.user?.phone ?? '').trim()
        const sessionEmail = String(session.value?.user?.email ?? '').trim()
        const profilePhone = String(profile.value?.phone ?? '').trim()
        const profileEmail = String(profile.value?.email ?? '').trim()

        if (contactType.value === 'phone') return sessionPhone || profilePhone || ''
        return sessionEmail || profileEmail || ''
    })
    const contactLabel = computed(() => (contactValue.value ? (contactType.value === 'phone' ? 'Phone' : 'Email') : 'Contact'))

    async function init() {
        const { data } = await supabase.auth.getSession()
        session.value = data.session ?? null
        if (session.value) await fetchProfile()
        else profile.value = null

        supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, s: Session | null) => {
            session.value = s
            if (s) await fetchProfile()
            else profile.value = null
        })

        loading.value = false
    }

    async function fetchProfile() {
        if (!userId.value) return
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId.value)
            .maybeSingle()
        profile.value = (data as Profile | null) ?? null
    }

    async function saveProfile(updates: Record<string, unknown>) {
        if (!userId.value) return { error: 'Not logged in' as const }
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId.value, ...updates, updated_at: new Date().toISOString() })
        if (!error) profile.value = { ...(profile.value ?? {}), ...updates }
        console.log('saveProfile', { updates, error })
        return { error }
    }

    async function sendOtp(identifier: string, mode: 'login' | 'signup' = 'login'): Promise<{ error: MaybeError }> {
        const shouldCreateUser = mode === 'signup'
        const { error } =
            otpChannel === 'phone'
                ? await supabase.auth.signInWithOtp({
                    phone: identifier,
                    options: {
                        shouldCreateUser,
                    },
                })
                : await supabase.auth.signInWithOtp({
                    email: identifier,
                    options: {
                        shouldCreateUser,
                    },
                })
        return { error }
    }

    async function verifyOtp(
        identifier: string,
        token: string,
        mode: 'login' | 'signup' = 'login',
    ): Promise<{ error: MaybeError; isNew?: boolean }> {
        const { data, error } =
            otpChannel === 'phone'
                ? await supabase.auth.verifyOtp({ phone: identifier, token, type: 'sms' })
                : await supabase.auth.verifyOtp({ email: identifier, token, type: 'email' })
        if (error) return { error }
        session.value = data.session ?? null

        const sessionUserId = data.session?.user?.id
        if (!sessionUserId) return { error: { message: 'Could not resolve user session.' } }

        await fetchProfile()

        if (mode === 'signup') {
            return { error: null, isNew: true }
        }

        return { error: null, isNew: false }
    }

    async function signOut() {
        await supabase.auth.signOut()
        session.value = null
        profile.value = null
    }

    async function saveOrder(order: OrderInput) {
        if (!userId.value) return
        const items = order.items.map((item) => ({
            product_id: Number(item.product_id ?? item.id),
            name: String(item.name ?? ''),
            emoji: String(item.emoji ?? '🟡'),
            qty: Number(item.qty ?? 0),
            price: Number(item.price ?? 0),
        }))
        await supabase.from('orders').insert({
            user_id: userId.value,
            items,
            subtotal: order.subtotal,
            delivery_fee: order.deliveryFee,
            total: order.total,
            location: order.location,
            payment: order.paymentMethod,
            payment_method: order.paymentMethod,
            payment_status: order.paymentStatus,
            momo_number: order.momoNumber ?? null,
            status: 'placed',
            notes: order.notes ?? null,
        })
    }

    async function saveDetection(detection: DetectionInput) {
        if (!userId.value) return
        await supabase.from('detections').insert({
            user_id: userId.value,
            disease: detection.disease,
            plant: detection.plant,
            confidence: Math.max(0, Math.min(100, Math.round(detection.confidence))),
            severity: detection.severity,
        })
    }

    async function fetchOrders() {
        if (!userId.value) return []
        const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId.value)
            .order('created_at', { ascending: false })
        return data ?? []
    }

    async function fetchDetections() {
        if (!userId.value) return []
        const { data } = await supabase
            .from('detections')
            .select('*')
            .eq('user_id', userId.value)
            .order('created_at', { ascending: false })
        return data ?? []
    }

    async function submitReview(review: ReviewInput) {
        if (!userId.value) return { error: 'Not logged in' as const }
        const productId = Number(review.productId)
        if (!Number.isFinite(productId)) return { error: { message: 'Invalid product id' } }
        const { error } = await supabase.from('reviews').upsert(
            {
                user_id: userId.value,
                product_id: productId,
                rating: review.rating,
                comment: review.comment,
            },
            { onConflict: 'user_id,product_id' },
        )
        return { error }
    }

    return {
        session,
        profile,
        loading,
        isLoggedIn,
        isGuest,
        userId,
        displayName,
        contactType,
        contactValue,
        contactLabel,
        init,
        fetchProfile,
        saveProfile,
        sendOtp,
        verifyOtp,
        signOut,
        saveOrder,
        saveDetection,
        fetchOrders,
        fetchDetections,
        submitReview,
    }
}, {
    persist: {
        pick: ['profile'],
    },
})