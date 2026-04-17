import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { MedicineProduct } from '@/lib/medicineCatalog'

type SearchType = 'auto' | 'disease' | 'drug'

type SearchDiseaseResult = {
    type: 'disease'
    disease: string
    advice: string
    medicines: MedicineProduct[]
    relatedDiseases: string[]
    aiUnavailable?: boolean
}

type SearchDrugAlternative = {
    product: MedicineProduct
    diffLabel: string
    diffClass: string
}

type SearchDrugResult = {
    type: 'drug'
    exact: MedicineProduct
    alternatives: SearchDrugAlternative[]
}

type SearchNoneResult = { type: 'none' }

export type SearchResults = SearchDiseaseResult | SearchDrugResult | SearchNoneResult

type PersistedSearchState = {
    query: string
    searchType: SearchType
    results: SearchResults | null
    error: string
}

const STORAGE_KEY = 'cropdr.searchState'

function loadPersistedState(): PersistedSearchState {
    if (typeof window === 'undefined') {
        return { query: '', searchType: 'auto', results: null, error: '' }
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return { query: '', searchType: 'auto', results: null, error: '' }
        const parsed = JSON.parse(raw) as Partial<PersistedSearchState>
        return {
            query: typeof parsed.query === 'string' ? parsed.query : '',
            searchType: parsed.searchType === 'disease' || parsed.searchType === 'drug' ? parsed.searchType : 'auto',
            results: parsed.results ?? null,
            error: typeof parsed.error === 'string' ? parsed.error : '',
        }
    } catch {
        return { query: '', searchType: 'auto', results: null, error: '' }
    }
}

export const useSearchStore = defineStore('search', () => {
    const persisted = loadPersistedState()
    const query = ref(persisted.query)
    const searchType = ref<SearchType>(persisted.searchType)
    const results = ref<SearchResults | null>(persisted.results)
    const error = ref(persisted.error)
    const searching = ref(false)

    const hasResults = computed(() => Boolean(results.value))

    function clear() {
        query.value = ''
        results.value = null
        error.value = ''
        searching.value = false
    }

    watch([query, searchType, results, error], () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    query: query.value,
                    searchType: searchType.value,
                    results: results.value,
                    error: error.value,
                }),
            )
        } catch {
            // Ignore storage failures.
        }
    }, { deep: true })

    return { query, searchType, results, error, searching, hasResults, clear }
})
