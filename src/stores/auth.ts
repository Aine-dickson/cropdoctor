import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type MaybeError = { message?: string } | string | null

interface Profile {
    name?: string
    [key: string]: unknown
}

interface OrderInput {
    items: unknown[]
    total: number
    location: string
    payment: string
}

interface DetectionInput {
    disease: string
    plant: string
    confidence: number
}

interface ReviewInput {
    productId: number | string
    rating: number
    comment: string
}

interface MockSession {
    user: {
        id: string
        phone?: string
    }
}

export const useAuthStore = defineStore('auth', () => {
    const session = ref<Session | MockSession | null>(null)
    const profile = ref<Profile | null>(null)
    const loading = ref(true)

    const isLoggedIn = computed(() => !!session.value)
    const isGuest = computed(() => !session.value)
    const userId = computed(() => (session.value as { user?: { id?: string } } | null)?.user?.id ?? null)
    const displayName = computed(() => profile.value?.name ?? 'Guest')

    async function init() {
        if (!supabase) {
            loading.value = false
            return
        }

        const { data } = await supabase.auth.getSession()
        session.value = data.session ?? null
        if (session.value) await fetchProfile()

        supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, s: Session | null) => {
            session.value = s
            if (s) await fetchProfile()
            else profile.value = null
        })

        loading.value = false
    }

    async function fetchProfile() {
        if (!supabase || !userId.value) return
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId.value)
            .single()
        profile.value = (data as Profile | null) ?? null
    }

    async function saveProfile(updates: Record<string, unknown>) {
        if (!supabase || !userId.value) return { error: 'Not logged in' as const }
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId.value, ...updates, updated_at: new Date().toISOString() })
        if (!error) profile.value = { ...(profile.value ?? {}), ...updates }
        return { error }
    }

    async function sendOtp(phone: string): Promise<{ error: MaybeError }> {
        if (!supabase) {
            await delay(800)
            return { error: null }
        }
        const { error } = await supabase.auth.signInWithOtp({ phone })
        return { error }
    }

    async function verifyOtp(phone: string, token: string): Promise<{ error: MaybeError; isNew?: boolean }> {
        if (!supabase) {
            await delay(900)
            if (token !== '123456') return { error: { message: 'Invalid code. Use 123456 in mock mode.' } }
            session.value = { user: { id: 'mock-user-id', phone } }
            profile.value = null
            return { error: null, isNew: true }
        }
        const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
        if (error) return { error }
        session.value = data.session ?? null

        const sessionUserId = data.session?.user?.id
        if (!sessionUserId) return { error: { message: 'Could not resolve user session.' } }

        const { data: prof } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', sessionUserId)
            .single()

        const isNew = !prof
        if (!isNew) await fetchProfile()
        return { error: null, isNew }
    }

    async function signOut() {
        if (supabase) await supabase.auth.signOut()
        session.value = null
        profile.value = null
    }

    async function saveOrder(order: OrderInput) {
        if (!supabase || !userId.value) return
        await supabase.from('orders').insert({
            user_id: userId.value,
            items: order.items,
            total: order.total,
            location: order.location,
            payment: order.payment,
            status: 'placed',
        })
    }

    async function saveDetection(detection: DetectionInput) {
        if (!supabase || !userId.value) return
        await supabase.from('detections').insert({
            user_id: userId.value,
            disease: detection.disease,
            plant: detection.plant,
            confidence: detection.confidence,
        })
    }

    async function fetchOrders() {
        if (!supabase || !userId.value) return []
        const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId.value)
            .order('created_at', { ascending: false })
        return data ?? []
    }

    async function fetchDetections() {
        if (!supabase || !userId.value) return []
        const { data } = await supabase
            .from('detections')
            .select('*')
            .eq('user_id', userId.value)
            .order('created_at', { ascending: false })
        return data ?? []
    }

    async function submitReview(review: ReviewInput) {
        if (!supabase || !userId.value) return { error: 'Not logged in' as const }
        const { error } = await supabase.from('reviews').upsert({
            user_id: userId.value,
            product_id: review.productId,
            rating: review.rating,
            comment: review.comment,
        })
        return { error }
    }

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    return {
        session,
        profile,
        loading,
        isLoggedIn,
        isGuest,
        userId,
        displayName,
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
})