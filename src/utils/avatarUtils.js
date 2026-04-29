/**
 * Shared user-display utilities for UserCellRenderer, UserTooltip and
 * UserDropdown.  Keeping them here means the module-level avatar cache is
 * shared across all three SFCs — the same name always produces the same SVG
 * data-URL, and the cache is never duplicated.
 */

// ---------------------------------------------------------------------------
// Default avatar (SVG data-URL, LRU-bounded)
// ---------------------------------------------------------------------------

const defaultAvatarCache = new Map();
const DEFAULT_AVATAR_CACHE_MAX = 500;
const DEFAULT_AVATAR_PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
];

function buildDefaultAvatarUrl(name) {
    const colorIndex = name.charCodeAt(0) % DEFAULT_AVATAR_PALETTE.length;
    const color = DEFAULT_AVATAR_PALETTE[colorIndex];
    const initial = name.charAt(0).toUpperCase();
    return (
        `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>` +
        `<circle cx='16' cy='16' r='16' fill='${encodeURIComponent(color)}'/>` +
        `<text x='16' y='22' font-size='16' text-anchor='middle' fill='white' font-weight='bold'>` +
        `${encodeURIComponent(initial)}</text></svg>`
    );
}

/**
 * Return a cached SVG data-URL avatar for the given display name.
 * Cache is bounded to DEFAULT_AVATAR_CACHE_MAX entries (LRU-evict oldest).
 */
export function getDefaultAvatarFor(name) {
    if (!name) name = '?';
    if (defaultAvatarCache.has(name)) return defaultAvatarCache.get(name);
    if (defaultAvatarCache.size >= DEFAULT_AVATAR_CACHE_MAX) {
        defaultAvatarCache.delete(defaultAvatarCache.keys().next().value);
    }
    const url = buildDefaultAvatarUrl(name);
    defaultAvatarCache.set(name, url);
    return url;
}

// ---------------------------------------------------------------------------
// User display helpers
// ---------------------------------------------------------------------------

/** Derive the display name from a user object. */
export function getUserName(user) {
    if (!user) return 'Unknown User';
    if (user.name) return user.name;
    if (user.firstname || user.lastname) {
        return [user.firstname, user.lastname].filter(Boolean).join(' ');
    }
    return user.email || user.id || 'Unknown User';
}

/** Derive the phone number string from a user object, or null. */
export function getUserPhone(user) {
    if (!user) return null;
    if (user.phone?.phone_number) return user.phone.phone_number;
    if (user.phone_number) return user.phone_number;
    return null;
}

/** Convenience: get a fallback avatar data-URL for a user object. */
export function getDefaultAvatar(user) {
    return getDefaultAvatarFor(getUserName(user));
}
