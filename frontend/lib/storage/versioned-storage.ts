/**
 * Versioned localStorage abstraction.
 *
 * Solves two problems:
 *  1. Schema evolution — when a stored DTO gains a required field, old data
 *     would fail shape validation without a migration path.
 *  2. Corruption resilience — malformed JSON or unexpected shapes silently fall
 *     back to the domain's defaultValue() instead of crashing.
 *
 * ## Wire format
 * All data is wrapped in:  { "__v": <number>, "data": <payload> }
 *
 * ## Migration
 * When readVersioned() finds __v < currentVersion, it calls the optional
 * migrate() function with the raw data and the stored version number.
 * migrate() returns the migrated payload or null (→ fallback to defaultValue).
 *
 * ## Unversioned legacy data
 * Data written before this system was introduced has no "__v" key.
 * readVersioned() treats it as version 0 and passes it to migrate() if provided.
 * This ensures a clean one-time migration for all existing users.
 *
 * ## Usage
 * ```ts
 * const schema = versionedSchema({
 *   key: 'flowmerce_wishlist_mystore',
 *   version: 1,
 *   validator: (v): v is WishlistItemResponse[] => Array.isArray(v),
 *   defaultValue: () => [],
 *   migrate: (raw, fromV) => {
 *     if (fromV === 0 && Array.isArray(raw)) return raw.filter(isValidItem)
 *     return null
 *   },
 * })
 *
 * const items = readVersioned(schema)   // always returns T
 * writeVersioned(schema, items)
 * ```
 */

// ── On-disk shape ──────────────────────────────────────────────────────────────

interface VersionedPayload<T> {
  readonly __v: number
  readonly data: T
}

function isVersionedPayload<T>(v: unknown): v is VersionedPayload<T> {
  return (
    typeof v === 'object' &&
    v !== null &&
    '__v' in v &&
    'data' in v &&
    typeof (v as Record<string, unknown>).__v === 'number'
  )
}

// ── Schema definition ──────────────────────────────────────────────────────────

export interface StorageSchema<T> {
  /** localStorage key (including any slug-scoping). */
  readonly key: string
  /** Current version number. Increment when the shape changes. */
  readonly version: number
  /** Shape guard — called after parsing to validate structure. */
  readonly validator: (value: unknown) => value is T
  /** Called when stored version differs from current version.
   *  Return T on success, null to fall back to defaultValue(). */
  readonly migrate?: (raw: unknown, fromVersion: number) => T | null
  /** Returned when the key is missing, corrupted, or migration fails. */
  readonly defaultValue: () => T
}

/** Convenience factory — keeps schema definitions tidy at call sites. */
export function versionedSchema<T>(schema: StorageSchema<T>): StorageSchema<T> {
  return schema
}

// ── Core read / write ──────────────────────────────────────────────────────────

/**
 * Read a versioned value from localStorage.
 * Always returns a valid T (defaultValue on any error).
 */
export function readVersioned<T>(schema: StorageSchema<T>): T {
  if (typeof window === 'undefined') return schema.defaultValue()

  try {
    const raw = localStorage.getItem(schema.key)
    if (!raw) return schema.defaultValue()

    const parsed: unknown = JSON.parse(raw)

    if (isVersionedPayload(parsed)) {
      if (parsed.__v === schema.version) {
        // Current version — validate and return
        return schema.validator(parsed.data) ? parsed.data : schema.defaultValue()
      }
      // Different version — attempt migration
      if (schema.migrate) {
        const migrated = schema.migrate(parsed.data, parsed.__v)
        if (migrated !== null && schema.validator(migrated)) return migrated
      }
      return schema.defaultValue()
    }

    // Legacy (unversioned) data — treat as version 0
    if (schema.migrate) {
      const migrated = schema.migrate(parsed, 0)
      if (migrated !== null && schema.validator(migrated)) return migrated
    }

    // If data happens to be valid at current version (unlikely but defensive)
    if (schema.validator(parsed)) return parsed

    return schema.defaultValue()
  } catch {
    return schema.defaultValue()
  }
}

/**
 * Write a versioned value to localStorage.
 */
export function writeVersioned<T>(schema: StorageSchema<T>, data: T): void {
  if (typeof window === 'undefined') return
  const payload: VersionedPayload<T> = { __v: schema.version, data }
  localStorage.setItem(schema.key, JSON.stringify(payload))
}

/**
 * Remove a versioned entry from localStorage.
 */
export function clearVersioned(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}
