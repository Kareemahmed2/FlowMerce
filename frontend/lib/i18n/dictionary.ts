/**
 * Bilingual UI dictionary (English / Arabic).
 *
 * Keys are dot-namespaced by area (common.*, nav.*, dashboard.*, ...).
 * Pages pull strings via `t('key')` from the LanguageProvider so the whole
 * app stays consistent and fully translatable. Add keys here as pages are
 * redesigned — never hardcode user-facing copy in components.
 */

export type Locale = 'en' | 'ar'

export const LOCALES: Locale[] = ['en', 'ar']

export const dictionary: Record<Locale, Record<string, string>> = {
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.loading': 'Loading…',
    'common.viewAll': 'View all',
    'common.export': 'Export',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.language': 'Language',

    // Dashboard navigation
    'nav.overview': 'Overview',
    'nav.orders': 'Orders',
    'nav.products': 'Products',
    'nav.inventory': 'Inventory',
    'nav.payments': 'Payments',
    'nav.wallet': 'Wallet',
    'nav.customers': 'Customers',
    'nav.design': 'Design',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.viewLiveStore': 'View Live Store',
    'nav.logout': 'Log Out',

    // Dashboard
    'dashboard.title': 'Merchant Overview',
    'dashboard.subtitle': 'Review your sales performance and operational metrics.',
    'dashboard.totalRevenue': 'Total Revenue',
    'dashboard.activeOrders': 'Active Orders',
    'dashboard.totalProducts': 'Total Products',
    'dashboard.newCustomers': 'New Customers',
    'dashboard.salesTrends': 'Sales Trends',
    'dashboard.recentOrders': 'Recent Orders',

    // Order status
    'status.pending': 'Pending',
    'status.shipped': 'Shipped',
    'status.delivered': 'Delivered',
    'status.cancelled': 'Cancelled',
    'status.processing': 'Processing',
  },
  ar: {
    // Common
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.search': 'بحث',
    'common.loading': 'جارٍ التحميل…',
    'common.viewAll': 'عرض الكل',
    'common.export': 'تصدير',
    'common.back': 'رجوع',
    'common.next': 'التالي',
    'common.confirm': 'تأكيد',
    'common.language': 'اللغة',

    // Dashboard navigation
    'nav.overview': 'نظرة عامة',
    'nav.orders': 'الطلبات',
    'nav.products': 'المنتجات',
    'nav.inventory': 'المخزون',
    'nav.payments': 'المدفوعات',
    'nav.wallet': 'المحفظة',
    'nav.customers': 'العملاء',
    'nav.design': 'التصميم',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    'nav.viewLiveStore': 'عرض المتجر',
    'nav.logout': 'تسجيل الخروج',

    // Dashboard
    'dashboard.title': 'نظرة عامة على المتجر',
    'dashboard.subtitle': 'راجع أداء مبيعاتك ومؤشرات التشغيل.',
    'dashboard.totalRevenue': 'إجمالي الإيرادات',
    'dashboard.activeOrders': 'الطلبات النشطة',
    'dashboard.totalProducts': 'إجمالي المنتجات',
    'dashboard.newCustomers': 'عملاء جدد',
    'dashboard.salesTrends': 'اتجاهات المبيعات',
    'dashboard.recentOrders': 'أحدث الطلبات',

    // Order status
    'status.pending': 'قيد الانتظار',
    'status.shipped': 'تم الشحن',
    'status.delivered': 'تم التوصيل',
    'status.cancelled': 'ملغي',
    'status.processing': 'قيد المعالجة',
  },
}
