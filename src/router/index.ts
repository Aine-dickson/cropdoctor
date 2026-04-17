import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { usePlatform } from '@/composables/usePlatform'

import ScanView from '@/views/ScanView.vue'
import HomeView from '@/views/HomeView.vue'
import ResultsView from '@/views/ResultsView.vue'
import ProductView from '@/views/ProductView.vue'
import CartView from '@/views/CartView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import ConfirmView from '@/views/ConfirmView.vue'
import AccountView from '@/views/AccountView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'
import SearchView from '@/views/SearchView.vue'
import BrowseView from '@/views/BrowseView.vue'
import DescribeView from '@/views/DescribeView.vue'
import { recordNavigation } from '@/lib/navigationHistory'

const { isTauri } = usePlatform()

const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: isTauri.value ? ScanView : HomeView },
    { path: '/scan', name: 'scan', component: ScanView },
    { path: '/results', name: 'results', component: ResultsView },
    { path: '/product/:id', name: 'product', component: ProductView },
    { path: '/cart', name: 'cart', component: CartView },
    { path: '/checkout', name: 'checkout', component: CheckoutView },
    { path: '/confirm', name: 'confirm', component: ConfirmView },
    { path: '/account', name: 'account', component: AccountView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/signup', name: 'signup', component: SignupView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/browse', name: 'browse', component: BrowseView },
    { path: '/describe', name: 'describe', component: DescribeView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
    recordNavigation(to.fullPath)
})

export default router