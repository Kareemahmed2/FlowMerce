'use client'

import {
  loadPersistedStore,
  onboardingToPayload,
  patchPersistedStore,
  payloadToOnboarding,
  savePersistedStore,
} from '@/lib/local-store/store'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { INITIAL_STATE, STEPS, generateStoreUrl } from './constants'
import type { OnboardingState } from './types'
import { StepAI } from './StepAI'
import { StepBrand } from './StepBrand'
import { StepCatalog } from './StepCatalog'
import { StepDesign } from './StepDesign'
import { StepPublish } from './StepPublish'
import { styles } from './wizard-styles'
import { useMerchantAuth } from '@/store/auth-store'
import { merchantService } from '@/services/merchant.service'
import { storeService } from '@/services/store.service'
import { storefrontService } from '@/services/storefront.service'
import { categoryService } from '@/services/category.service'
import { productService } from '@/services/product.service'
import { ACTIVE_STORE_ID_KEY } from '@/components/merchant/dashboard/MerchantBackendSync'

const STEP_TITLES = [
  'Set up your brand',
  'Build your catalog',
  'Design your storefront',
  'AI design review',
  'Publish your store',
]

const STEP_SUBS = [
  'Your brand is the first impression.',
  'Organize your products into categories.',
  'Choose colors that reflect your brand.',
  'Let AI evaluate your design choices.',
  'Review everything and go live.',
]

interface PublishProgress {
  /** Human-readable label of the current step ("Creating store…", etc.). */
  label: string
  /** Optional progress fraction (0..1) for the products bulk-create loop. */
  fraction?: number
}

export function MerchantOnboarding() {
  const router = useRouter()
  const auth = useMerchantAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingState>(INITIAL_STATE)
  const [published, setPublished] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Publish flow state
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null)
  const [publishError, setPublishError] = useState('')
  const [finalStoreUrl, setFinalStoreUrl] = useState('')

  useEffect(() => {
    // Wait for auth to hydrate — storeId is what tells us whether this account
    // actually owns a backend store yet.
    if (!auth.isHydrated) return
    const p = loadPersistedStore()
    if (p) {
      // The draft is keyed globally in localStorage, not per-account. If it claims
      // "published" but this account has no backend store, it's a leftover from a
      // different account that previously used this browser — discard it instead
      // of redirecting straight to someone else's "store is live" screen.
      if (p.published && !auth.storeId) {
        setHydrated(true)
        return
      }
      setData(payloadToOnboarding(p))
      // Clamp to valid range — guards against stale localStorage from older
      // versions that had more steps (e.g. before the payment step was removed).
      setCurrentStep(Math.min(p.currentStep, STEPS.length - 1))
      setPublished(p.published)
    }
    setHydrated(true)
  }, [auth.isHydrated, auth.storeId])

  useEffect(() => {
    if (!hydrated) return
    const existing = loadPersistedStore()
    savePersistedStore(
      onboardingToPayload(data, currentStep, published, existing?.planLabel ?? 'Local')
    )
  }, [data, currentStep, published, hydrated])

  const updateBrand = useCallback((v: OnboardingState['brand']) => {
    setData((d) => ({ ...d, brand: v }))
  }, [])
  const updateCategories = useCallback((v: OnboardingState['categories']) => {
    setData((d) => ({ ...d, categories: v }))
  }, [])
  const updateColors = useCallback((v: OnboardingState['colors']) => {
    setData((d) => ({ ...d, colors: v }))
  }, [])
  const updateAI = useCallback((v: string) => {
    setData((d) => ({ ...d, aiSuggestions: v }))
  }, [])

  const canAdvance = () => {
    switch (currentStep) {
      case 0: return !!data.brand.name.trim()
      case 1: return data.categories.length > 0
      default: return true
    }
  }

  const handlePublish = async () => {
    // Auth guard — must have a valid JWT before calling any backend endpoint.
    const headers = auth.getAuthHeader()
    if (!headers.Authorization) {
      setPublishError(
        'You are not logged in. Please log in first, then return to this page to publish your store.'
      )
      // Give the user 2 seconds to read the message, then redirect to login.
      setTimeout(() => router.push('/login'), 2500)
      return
    }

    // Live mode: drive the full backend flow with progress feedback.
    setPublishing(true)
    setPublishError('')

    try {
      // 1. Merchant profile — 409 means profile already exists, treat as success
      setPublishProgress({ label: 'Saving business profile…' })
      const profileR = await merchantService.createProfile(
        { businessName: data.brand.name || 'My Business' },
        headers
      )
      if (!profileR.ok && profileR.status !== 409) throw new Error(profileR.error)

      // 2. Create store — 409 means store already exists, fetch the existing one
      setPublishProgress({ label: 'Creating store…' })
      const url = generateStoreUrl(data.brand.name || 'my-store')
      let storeId: number
      const storeR = await storeService.createStore(
        { storeName: data.brand.name || 'My Store', storeUrl: url, description: undefined },
        headers
      )
      if (storeR.ok) {
        storeId = storeR.data.storeId
      } else if (storeR.status === 409) {
        // Store already created on a previous attempt — reuse it
        const existingR = await storeService.getMyStores(headers)
        if (!existingR.ok || existingR.data.length === 0) throw new Error('Could not retrieve existing store.')
        storeId = existingR.data[0].storeId
      } else {
        throw new Error(storeR.error)
      }

      // createStore has no logo field — the uploaded logo URL only gets attached
      // to the store via this follow-up call. Skip local-only blob:/data: URLs
      // (upload failed or never finished) since the backend can't fetch those.
      const logoUrl = data.brand.logoPreview
      if (logoUrl && !logoUrl.startsWith('blob:') && !logoUrl.startsWith('data:')) {
        const brandR = await storeService.updateBrand(
          storeId,
          { brandName: data.brand.name || 'My Store', logoUrl },
          headers
        )
        if (!brandR.ok) throw new Error(brandR.error)
      }

      // 3. Initialise storefront — 409 means already initialised, that's fine
      setPublishProgress({ label: 'Initialising storefront…' })
      const sfR = await storefrontService.initStorefront(
        storeId,
        {
          background: data.colors.background || '#FFFFFF',
          header:     data.colors.header     || '#1A1A2E',
          footer:     data.colors.footer     || '#16213E',
          accent:     data.colors.accent     || '#E94560',
          text:       data.colors.text       || '#1A1A1A',
          card:       data.colors.card       || '#F9F9F9',
        },
        headers
      )
      if (!sfR.ok && sfR.status !== 409) throw new Error(sfR.error)

      // 4. Resolve wizard categories to backend categories.
      //    Try global categories first; for any unmatched name, create a
      //    store-specific category so products always have a real categoryId.
      setPublishProgress({ label: 'Setting up categories…' })
      const catsR = await categoryService.getAll()
      const globalCats = catsR.ok ? catsR.data : []
      const catLookup = new Map<string, number>()
      for (const c of globalCats) catLookup.set(c.name.toLowerCase(), c.categoryId)

      const wizardToBackendCat = new Map<number, number | null>()
      for (const c of data.categories) {
        const globalMatch = catLookup.get(c.name.toLowerCase()) ?? null
        if (globalMatch !== null) {
          wizardToBackendCat.set(c.id, globalMatch)
        } else {
          // No global category with this name — create a store-specific one
          const createR = await categoryService.createStoreCategory(
            storeId,
            { name: c.name },
            headers
          )
          if (createR.ok) {
            wizardToBackendCat.set(c.id, createR.data.categoryId)
          } else if (createR.status === 409) {
            // Already exists from a previous attempt — fetch store categories to find it
            const existingR = await categoryService.getStoreCategories(storeId, headers)
            const found = existingR.ok
              ? existingR.data.find((ec) => ec.name.toLowerCase() === c.name.toLowerCase())
              : null
            wizardToBackendCat.set(c.id, found?.categoryId ?? null)
          } else {
            wizardToBackendCat.set(c.id, null)
          }
        }
      }

      // 5. Bulk-create products — skip duplicates (409) silently
      const allProducts = data.categories.flatMap((c) =>
        c.products.map((p) => ({ product: p, categoryId: wizardToBackendCat.get(c.id) ?? null }))
      )
      let createdCount = 0
      for (const { product, categoryId } of allProducts) {
        setPublishProgress({
          label: `Creating products… ${createdCount + 1} of ${allProducts.length}`,
          fraction: allProducts.length > 0 ? createdCount / allProducts.length : 1,
        })
        const productR = await productService.create(
          storeId,
          {
            name: product.name,
            description: product.description,
            basePrice: parseFloat(product.price) || 0,
            categoryId: categoryId ?? undefined,
            initialQuantity: product.stock ?? 0,
            lowStockThreshold: 5,
          },
          headers
        )
        if (!productR.ok && productR.status !== 409) {
          throw new Error(`Failed to create "${product.name}": ${productR.error}`)
        }

        // create() has no images field — uploaded photos only get attached via this
        // follow-up call, and only once we have a real productId. Skip on 409 (product
        // already existed from a previous attempt, so it likely already has its media)
        // and skip local-only blob:/data: URLs the backend can't fetch.
        if (productR.ok) {
          const realImages = product.images.filter(
            (img) => !img.startsWith('blob:') && !img.startsWith('data:')
          )
          for (const mediaUrl of realImages) {
            await productService.addMedia(storeId, productR.data.productId, { mediaUrl }, headers)
          }
        }
        createdCount++
      }

      // 6. Publish the store + the storefront template (two separate "published"
      //    flags on the backend — both must flip or the public page 404s).
      setPublishProgress({ label: 'Publishing storefront…' })
      const pubR = await storeService.publishStore(storeId, headers)
      if (!pubR.ok) throw new Error(pubR.error)
      const sfPubR = await storefrontService.publishStorefront(storeId, headers)
      if (!sfPubR.ok && sfPubR.status !== 409) throw new Error(sfPubR.error)

      // 7. Persist storeId everywhere the dashboard reads from.
      auth.patchStoreId(storeId)
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_STORE_ID_KEY, String(storeId))
      }
      patchPersistedStore({
        storeUrl: url,
        published: true,
        brand: { name: data.brand.name || 'My Store', logoPreview: data.brand.logoPreview },
      })

      // Done — flip into the success screen.
      setFinalStoreUrl(url)
      setData((d) => ({ ...d, published: true, storeUrl: url }))
      setPublished(true)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
      setPublishProgress(null)
    }
  }

  if (published) {
    const slug = finalStoreUrl || generateStoreUrl(data.brand.name || 'my-store')
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    const storeHref = isDev
      ? `${window.location.origin}/store/${slug}`
      : `https://${slug}.flowmerce.io`
    return (
      <div style={styles.successScreen}>
        <div style={styles.successIcon}>▷</div>
        <h2 style={styles.successTitle}>Your store is live!</h2>
        <a
          href={storeHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...styles.successUrl,
            textDecoration: 'underline',
            cursor: 'pointer',
            wordBreak: 'break-all',
          }}
        >
          {storeHref}
        </a>
        <p style={styles.hint}>
          Click the link above to open your store, or share it with your customers.
        </p>
        <button type="button" style={styles.primaryBtn} onClick={() => router.push('/dashboard')}>
          Go to Dashboard →
        </button>
      </div>
    )
  }

  return (
    <div style={styles.wizard}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <span style={styles.sidebarLogo}>◈</span>
          <span style={styles.sidebarTitle}>FlowMerce</span>
        </div>
        <div style={styles.stepList}>
          {STEPS.map((step, i) => {
            const status =
              i < currentStep ? 'done' : i === currentStep ? 'active' : 'upcoming'
            return (
              <div
                key={step.id}
                style={{
                  ...styles.stepItem,
                  ...(status === 'active'
                    ? styles.stepItemActive
                    : status === 'done'
                      ? styles.stepItemDone
                      : {}),
                }}
              >
                <div
                  style={{
                    ...styles.stepIconWrap,
                    ...(status === 'active'
                      ? styles.stepIconActive
                      : status === 'done'
                        ? styles.stepIconDone
                        : {}),
                  }}
                >
                  {status === 'done' ? '✓' : step.icon}
                </div>
                <div>
                  <p style={styles.stepLabel}>{step.label}</p>
                  <p style={styles.stepNum}>
                    Step {i + 1} of {STEPS.length}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div style={styles.progressWrap}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${(currentStep / (STEPS.length - 1)) * 100}%`,
              }}
            />
          </div>
          <p style={styles.progressLabel}>
            {Math.round((currentStep / (STEPS.length - 1)) * 100)}% complete
          </p>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.stepHeader}>
          <span style={styles.stepHeaderIcon}>{STEPS[currentStep].icon}</span>
          <div>
            <h1 style={styles.stepHeaderTitle}>{STEP_TITLES[currentStep]}</h1>
            <p style={styles.stepHeaderSub}>{STEP_SUBS[currentStep]}</p>
          </div>
        </div>

        <div style={{
          ...styles.stepBody,
          // AI step fills full width; other steps get a comfortable centered max-width
          padding: currentStep === 3 ? 0 : '20px 24px',
        }}>
          {/* Wrapper: narrow for simple forms, full-width for complex layouts */}
          <div style={currentStep === 3 ? { height: '100%' } : { maxWidth: 680, margin: '0 auto' }}>
            {currentStep === 0 && <StepBrand data={data.brand} onChange={updateBrand} />}
            {currentStep === 1 && (
              <StepCatalog categories={data.categories} onChange={updateCategories} />
            )}
            {currentStep === 2 && <StepDesign colors={data.colors} onChange={updateColors} />}
            {currentStep === 3 && (
              <StepAI
                brandData={data.brand}
                categories={data.categories}
                colors={data.colors}
                onSuggestionsReceived={updateAI}
                onColorsChange={updateColors}
              />
            )}
            {currentStep === 4 && (
              <StepPublish
                brandData={data.brand}
                categories={data.categories}
                colors={data.colors}
              />
            )}
          </div>
        </div>

        <div style={styles.navBar}>
          {currentStep > 0 && (
            <button type="button" style={styles.backBtn} onClick={() => setCurrentStep((s) => s - 1)}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              style={{
                ...styles.nextBtn,
                ...(!canAdvance() ? styles.nextBtnDisabled : {}),
              }}
              onClick={() => canAdvance() && setCurrentStep((s) => s + 1)}
              disabled={!canAdvance()}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              style={{
                ...styles.publishBtn,
                ...(publishing ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
              }}
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? 'Publishing…' : '▷ Publish Store'}
            </button>
          )}
        </div>

        {/* Publish-error banner */}
        {publishError && (
          <div
            role="alert"
            style={{
              margin: '16px 32px',
              padding: '12px 16px',
              borderRadius: 10,
              background: '#FCEBEB',
              color: '#A32D2D',
              border: '1px solid #f7c1c1',
              fontSize: 13,
            }}
          >
            <strong>Publish failed:</strong> {publishError}
            <br />
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              Click <strong>Publish Store</strong> again to retry. Anything already created on the
              server will be reused.
            </span>
          </div>
        )}
      </div>

      {/* Progress overlay during publish */}
      {publishing && publishProgress && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 14, 12, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '32px 40px',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              minWidth: 340,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '3px solid #e9ecef',
                borderTopColor: '#0F0E0C',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#0F0E0C' }}>
              Publishing your store
            </p>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{publishProgress.label}</p>
            {typeof publishProgress.fraction === 'number' && (
              <div
                style={{
                  marginTop: 14,
                  height: 4,
                  background: '#ede8df',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(publishProgress.fraction * 100)}%`,
                    background: '#0F0E0C',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </div>
  )
}
