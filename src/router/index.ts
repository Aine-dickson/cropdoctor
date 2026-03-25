import { createRouter, createWebHashHistory } from 'vue-router'
import ScanView from '@/views/ScanView.vue'
import ResultsView from '@/views/ResultsView.vue'
import ProductView from '@/views/ProductView.vue'
import CartView from '@/views/CartView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import ConfirmView from '@/views/ConfirmView.vue'

const routes = [
    { path: '/', name: 'scan', component: ScanView },
    { path: '/results', name: 'results', component: ResultsView },
    { path: '/product/:id', name: 'product', component: ProductView },
    { path: '/cart', name: 'cart', component: CartView },
    { path: '/checkout', name: 'checkout', component: CheckoutView },
    { path: '/confirm', name: 'confirm', component: ConfirmView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
})
