package com.example.flowmerceproject.FileStorage.util;

public enum StorageFolder {

    PRODUCT_IMAGES("products"),
    STORE_LOGOS("stores/logos"),
    STORE_BANNERS("stores/banners"),
    THEME_ASSETS("themes"),
    USER_PROFILES("users"),
    INVOICES("invoices"),
    STOREFRONT("storefront"),
    ATTACHMENTS("attachments"),  // notification attachments: PDFs, coupons, offers
    AI_ASSETS("ai-assets"),      // AI generated banners, reports, layouts
    UPLOADS("uploads");          // generic uploads via the /uploads endpoint

    private final String path;

    StorageFolder(String path) { this.path = path; }

    public String getPath() { return path; }
}