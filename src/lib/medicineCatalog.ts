import { reactive } from 'vue'

export interface MedicineProduct {
    id: number
    name: string
    emoji: string
    type: string
    price: number
    inventoryCount: number
    topPick?: boolean
    treats: string
    application?: string
    dosage?: string
    supplier?: string
    description?: string
    category?: string[]
    diseases: string[]
}

export const MEDICINE_CATALOGUE = reactive<MedicineProduct[]>([
    {
        id: 1,
        name: 'Ridomil Gold 68WG',
        emoji: '🟡',
        type: 'Systemic fungicide',
        price: 28000,
        inventoryCount: 12,
        topPick: true,
        treats: 'Late Blight, Downy Mildew',
        application: 'Foliar spray',
        dosage: '25g / 15L water',
        supplier: 'AgroUganda Ltd',
        description:
            'Highly effective systemic fungicide that moves through the plant to kill Late Blight at the source. One of the most trusted treatments for Phytophthora infestans in East Africa.',
        category: ['fungicide', 'systemic'],
        diseases: ['Late Blight', 'Downy Mildew'],
    },
    {
        id: 2,
        name: 'Copper Oxychloride',
        emoji: '🔵',
        type: 'Contact fungicide',
        price: 12000,
        inventoryCount: 0,
        topPick: false,
        treats: 'Blight, Leaf Spot, Rust',
        application: 'Foliar spray',
        dosage: '30g / 15L water',
        supplier: 'FarmCare Uganda',
        description:
            'Broad-spectrum contact fungicide. Best applied before infection spreads. Forms a protective barrier on leaves.',
        category: ['fungicide', 'contact'],
        diseases: ['Late Blight', 'Early Blight', 'Leaf Spot', 'Rust'],
    },
    {
        id: 3,
        name: 'Mancozeb 80WP',
        emoji: '🟤',
        type: 'Protective fungicide',
        price: 9500,
        inventoryCount: 8,
        topPick: false,
        treats: 'Early & Late Blight',
        application: 'Foliar spray',
        dosage: '20g / 15L water',
        supplier: 'FarmCare Uganda',
        description:
            'Preventive fungicide that protects healthy plant tissue from infection. Best used at first signs or as prevention.',
        category: ['fungicide', 'contact'],
        diseases: ['Late Blight', 'Early Blight'],
    },
    {
        id: 4,
        name: 'Amistar 250SC',
        emoji: '🟣',
        type: 'Broad-spectrum',
        price: 34000,
        inventoryCount: 5,
        topPick: false,
        treats: 'Rust, Powdery Mildew, Blight',
        application: 'Foliar spray',
        dosage: '10ml / 15L water',
        supplier: 'Syngenta Uganda',
        description:
            'Premium broad-spectrum fungicide with curative and preventive action against a wide range of crop diseases.',
        category: ['fungicide', 'systemic'],
        diseases: ['Rust', 'Powdery Mildew', 'Late Blight', 'Early Blight'],
    },
    {
        id: 5,
        name: 'Dithane M-45',
        emoji: '🟠',
        type: 'Multi-disease',
        price: 11000,
        inventoryCount: 2,
        topPick: false,
        treats: 'Leaf Spot, Anthracnose',
        application: 'Foliar spray',
        dosage: '25g / 15L water',
        supplier: 'AgroUganda Ltd',
        description:
            'Effective against a wide range of fungal diseases. Low cost and widely available across Uganda.',
        category: ['fungicide', 'contact'],
        diseases: ['Leaf Spot', 'Anthracnose', 'Early Blight'],
    },
    {
        id: 6,
        name: 'Actara 25WG',
        emoji: '⚪',
        type: 'Insecticide',
        price: 22000,
        inventoryCount: 6,
        topPick: false,
        treats: 'Whitefly (virus vector)',
        application: 'Foliar spray',
        dosage: '8g / 15L water',
        supplier: 'Syngenta Uganda',
        description:
            'Controls whiteflies that spread Tomato Yellow Leaf Curl Virus. Use alongside fungicides for full protection.',
        category: ['insecticide'],
        diseases: ['Mosaic Virus', 'Yellow Leaf Curl'],
    },
])

export function getMedicineById(id: number | string) {
    return MEDICINE_CATALOGUE.find((item) => item.id === Number(id))
}

export function getMedicineStock(id: number | string) {
    return getMedicineById(id)?.inventoryCount ?? 0
}

export function isMedicineInStock(id: number | string, qty = 1) {
    return getMedicineStock(id) >= qty
}

export function getMedicineStockLabel(id: number | string) {
    const stock = getMedicineStock(id)
    if (stock <= 0) return 'Out of stock'
    if (stock === 1) return 'Only 1 left'
    if (stock <= 3) return `Only ${stock} left`
    return `${stock} in stock`
}

export function clampMedicineQty(id: number | string, qty: number) {
    const stock = getMedicineStock(id)
    return Math.max(0, Math.min(qty, stock))
}

export function consumeMedicineStock(id: number | string, qty: number) {
    const product = getMedicineById(id)
    if (!product) return false
    if (qty <= 0 || product.inventoryCount < qty) return false
    product.inventoryCount -= qty
    return true
}

export function getLowStockBadge(id: number | string) {
    const stock = getMedicineStock(id)
    if (stock <= 0) return 'out-of-stock'
    if (stock <= 3) return 'low-stock'
    return 'in-stock'
}

export function findMedicinesByDisease(disease: string, extraTerms: string[] = []) {
    const terms = [disease, ...extraTerms].map((entry) => entry.toLowerCase())
    const matched = MEDICINE_CATALOGUE.filter((product) =>
        product.diseases.some((entry) =>
            terms.some((term) => term.includes(entry.toLowerCase()) || entry.toLowerCase().includes(term)),
        ),
    )
    return matched
}