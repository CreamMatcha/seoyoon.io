import { ui, defaultLang, showDefaultLang, type TranslationKey } from "./ui";
import { routes } from "./routes";
import { getCollection } from "astro:content";

//---------------------------------- EXPORTS ----------------------------------//
/**
 * Extracts language code from URL path
 * Example: "/ko/about" -> "ko", "/about" -> "en" (defaultLang)
 */
export function getLangFromUrl(url: URL) {
    const [, lang] = url.pathname.split("/");
    if (lang in ui) return lang as keyof typeof ui;
    return defaultLang;
}

/**
 * Returns translation function for specific language
 * Supports namespace:key format (e.g., "common:nav.home")
 * Falls back to defaultLang if translation not found
 */
export function useTranslations(lang: keyof typeof ui) {
    return function t(
        key: TranslationKey,
        params?: Record<string, string | number>
    ) {
        let namespace: string;
        let translationKey: string;

        // If no colon, assume "common" namespace
        if (!key.includes(":")) {
            namespace = "common";
            translationKey = key;
        } else {
            [namespace, translationKey] = key.split(":");
            if (!namespace || !translationKey) {
                return key;
            }
        }

        // Support nested object access with dot notation (e.g., "languages.en")
        const getNestedValue = (obj: any, path: string): any => {
            return path
                .split(".")
                .reduce((current, key) => current?.[key], obj);
        };

        const translation =
            getNestedValue(ui[lang]?.[namespace], translationKey) ||
            getNestedValue(ui[defaultLang]?.[namespace], translationKey) ||
            key;

        return params && typeof translation === "string"
            ? interpolateParams(translation, params)
            : translation;
    };
}

/**
 * Returns path translation function for specific language
 * Translates routes per the `routes` map for languages that use localized slugs
 */
export function useTranslatedPath(lang: keyof typeof ui) {
    return function translatePath(path: string, l: string = lang) {
        // Split path into segments
        const segments = path.split("/").filter((segment) => segment);

        // Translate each segment individually
        const translatedSegments = segments.map((segment) => {
            const hasTranslation =
                defaultLang !== l &&
                routes[l] !== undefined &&
                routes[l][segment] !== undefined;
            return hasTranslation ? routes[l][segment] : segment;
        });

        const translatedPath = "/" + translatedSegments.join("/");

        return !showDefaultLang && l === defaultLang
            ? translatedPath
            : `/${l}${translatedPath}`;
    };
}

/**
 * Switches current URL to target language while preserving content linking
 * Handles blog posts with different slugs per language
 */
export async function switchLanguageUrl(
    currentUrl: URL,
    targetLang: string
): Promise<string> {
    const pathname = currentUrl.pathname;
    const pathParts = pathname.split("/").filter((p) => p);

    // Remove current language prefix if exists
    const currentLang = getLangFromUrl(currentUrl);
    if (pathParts[0] === currentLang && currentLang !== defaultLang) {
        pathParts.shift();
    }

    // Handle root page
    if (pathParts.length === 0) {
        return targetLang === defaultLang ? "/" : `/${targetLang}/`;
    }

    const baseRoute = pathParts[0];
    const slug = pathParts[1];

    // Handle blog post with content linking
    if (slug && isBlogRoute(baseRoute)) {
        return await handleBlogPostTranslation(
            currentLang,
            targetLang,
            baseRoute,
            slug,
            currentUrl.pathname
        );
    }

    // Handle other routes by translating all route segments
    const translatedSegments = pathParts.map((segment) => {
        return translateRouteName(segment, targetLang);
    });

    const newPath = translatedSegments.join("/");
    return targetLang === defaultLang
        ? `/${newPath}`
        : `/${targetLang}/${newPath}`;
}

//---------------------------------- FUNCTIONS ----------------------------------//
/**
 * Replaces {{key}} placeholders in text with provided parameters
 */
function interpolateParams(
    text: string,
    params: Record<string, string | number>
): string {
    return Object.entries(params).reduce(
        (result, [key, value]) =>
            result.replace(new RegExp(`{{${key}}}`, "g"), String(value)),
        text
    );
}

/**
 * Builds content links automatically from blog posts with linkedContent frontmatter
 * Returns mapping of linkedContent -> { lang: "lang/slug" }
 */
export async function buildContentLinks(): Promise<
    Record<string, Record<string, string>>
> {
    const allPosts = await getCollection(
        "blog",
        (entry) => !entry.data.isDraft
    );
    const links: Record<string, Record<string, string>> = {};

    allPosts.forEach((post) => {
        const { linkedContent } = post.data;
        if (linkedContent) {
            const [lang] = post.id.split("/");

            if (!links[linkedContent]) {
                links[linkedContent] = {};
            }
            links[linkedContent][lang] = post.id;
        }
    });

    return links;
}

/**
 * Finds content group for given collection ID using dynamic content links
 */
async function findContentGroup(collectionId: string): Promise<string | null> {
    const dynamicLinks = await buildContentLinks();
    return (
        Object.entries(dynamicLinks).find(([, links]) =>
            Object.values(links).includes(collectionId)
        )?.[0] || null
    );
}

/**
 * Checks if route is a blog route in any language
 */
function isBlogRoute(route: string): boolean {
    return route === "blog";
}

/**
 * Converts language to collection ID format (defaultLang -> "en")
 */
function getLangCode(lang: string): string {
    return lang === defaultLang ? "en" : lang;
}

/**
 * Handles language switching for blog posts using content links mapping
 * Maps between different slugs per language via the `linkedContent` frontmatter field
 */
async function handleBlogPostTranslation(
    currentLang: string,
    targetLang: string,
    baseRoute: string,
    slug: string,
    fallbackPath: string
): Promise<string> {
    const currentPostId = `${getLangCode(currentLang)}/${slug}`;
    const contentGroup = await findContentGroup(currentPostId);

    if (contentGroup) {
        const dynamicLinks = await buildContentLinks();
        const targetPostId =
            dynamicLinks[contentGroup]?.[getLangCode(targetLang)];

        if (targetPostId) {
            const targetSlug = targetPostId.split("/")[1];
            const targetRouteName = translateRouteName(baseRoute, targetLang);
            const targetPath = `/${targetRouteName}/${targetSlug}`;

            return targetLang === defaultLang
                ? targetPath
                : `/${targetLang}${targetPath}`;
        }
    }

    return fallbackPath;
}

/**
 * Finds original route name from a translated route, via the `routes` map
 */
function getOriginalRouteName(routeName: string): string {
    for (const routeMap of Object.values(routes)) {
        const original = Object.entries(routeMap).find(
            ([, translated]) => translated === routeName
        )?.[0];
        if (original) return original;
    }
    return routeName;
}

/**
 * Translates route name to target language
 * Example: "blog" + "ko" -> "blog" (English slug reused; no localized routes for ko)
 */
function translateRouteName(routeName: string, targetLang: string): string {
    const originalRoute = getOriginalRouteName(routeName);
    return targetLang === defaultLang
        ? originalRoute
        : routes[targetLang]?.[originalRoute] || originalRoute;
}
