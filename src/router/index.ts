import { createRouter, createWebHashHistory, createWebHistory, type RouteRecordRaw } from 'vue-router'
import ScanView from '@/views/ScanView.vue'
import ResultsView from '@/views/ResultsView.vue'
import ProductView from '@/views/ProductView.vue'
import CartView from '@/views/CartView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import ConfirmView from '@/views/ConfirmView.vue'
import AccountView from '@/views/AccountView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'

const routes: RouteRecordRaw[] = [
    { path: '/', name: 'scan', component: ScanView },
    { path: '/results', name: 'results', component: ResultsView },
    { path: '/product/:id', name: 'product', component: ProductView },
    { path: '/cart', name: 'cart', component: CartView },
    { path: '/checkout', name: 'checkout', component: CheckoutView },
    { path: '/confirm', name: 'confirm', component: ConfirmView },
    { path: '/account', name: 'account', component: AccountView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/signup', name: 'signup', component: SignupView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
    history: createWebHashHistory(), // Use hash history for better compatibility with static hosting   
    routes,
    scrollBehavior: () => ({ top: 0 }),
})