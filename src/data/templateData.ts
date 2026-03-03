// Template groups — each has a BG (Unsplash) + overlay PNG
export interface TemplateGroup {
    id: string;
    name: string;
    bgUrl: string;          // Unsplash photo URL
    overlayUrl: string;     // local PNG in /templates/
    thumbnailBg: string;    // smaller Unsplash for thumbnail
}

export const TEMPLATE_GROUPS: TemplateGroup[] = [
    {
        id: 'sunset-eagle',
        name: 'Sunset Eagle',
        bgUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
        overlayUrl: '/templates/overlay_eagle.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
    },
    {
        id: 'ocean-jellyfish',
        name: 'Deep Ocean',
        bgUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80',
        overlayUrl: '/templates/overlay_jellyfish.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=60',
    },
    {
        id: 'night-cat',
        name: 'Night Cat',
        bgUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
        overlayUrl: '/templates/overlay_cat.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=60',
    },
    {
        id: 'forest-deer',
        name: 'Forest Stag',
        bgUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80',
        overlayUrl: '/templates/overlay_deer.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=60',
    },
    {
        id: 'cosmic-butterfly',
        name: 'Cosmic Butterfly',
        bgUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
        overlayUrl: '/templates/overlay_butterfly.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=60',
    },
    {
        id: 'savanna-lion',
        name: 'Golden Lion',
        bgUrl: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1920&q=80',
        overlayUrl: '/templates/overlay_lion.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400&q=60',
    },
    {
        id: 'arctic-wolf',
        name: 'Arctic Wolf',
        bgUrl: 'https://images.unsplash.com/photo-1478012237172-32a39e10140a?w=1920&q=80',
        overlayUrl: '/templates/overlay_wolf.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1478012237172-32a39e10140a?w=400&q=60',
    },
    {
        id: 'urban-rose',
        name: 'Urban Rose',
        bgUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80',
        overlayUrl: '/templates/overlay_rose.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=60',
    },
    {
        id: 'garden-orchid',
        name: 'Garden Orchid',
        bgUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1920&q=80',
        overlayUrl: '/templates/overlay_orchid.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&q=60',
    },
    {
        id: 'tropical-palm',
        name: 'Tropical Palm',
        bgUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
        overlayUrl: '/templates/overlay_palm.png',
        thumbnailBg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=60',
    },
];

// Load an image from a URL
export const loadImage = (url: string, crossOrigin = true): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
