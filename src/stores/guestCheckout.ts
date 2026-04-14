import { defineStore } from 'pinia'
import { ref } from 'vue'

interface GuestCheckoutContact {
    name: string
    phone: string
    location: string
    updatedAt: string
}

export const useGuestCheckoutStore = defineStore(
    'guestCheckout',
    () => {
        const contact = ref<GuestCheckoutContact | null>(null)

        function saveContact(input: { name: string; phone: string; location: string }) {
            contact.value = {
                name: input.name,
                phone: input.phone,
                location: input.location,
                updatedAt: new Date().toISOString(),
            }
        }

        function clearContact() {
            contact.value = null
        }

        return { contact, saveContact, clearContact }
    },
    {
        persist: true,
    },
)