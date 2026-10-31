import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './types';

const en = {
  'nav.explore': 'Explore',
  'nav.map': 'Map',
  'nav.plan': 'Plan a trip',
  'nav.services': 'Hotels & Services',
  'nav.rooms': 'Travel Rooms',
  'nav.community': 'Community',
  'nav.assistant': 'Assistant',
  'nav.dashboard': 'My trips',
  'nav.admin': 'Admin',
  'nav.login': 'Sign in',
  'nav.register': 'Create account',
  'nav.logout': 'Sign out',
  'home.title': 'Discover Uttar Pradesh, plan smarter, travel together',
  'home.subtitle': 'Heritage cities, sacred ghats and wild Terai forests — with verified-first travel info, honest budgets and group coordination.',
  'home.searchPlaceholder': 'Search monuments, cities or places…',
  'home.featured': 'Featured destinations',
  'home.cities': 'Explore by city',
  'home.planCta': 'Plan a day-by-day trip in under a minute',
  'home.planCtaSub': 'Tell us your dates, budget and interests. Tripzee builds an itinerary with travel times, food stops and a transparent cost estimate.',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.viewAll': 'View all',
  'common.directions': 'Directions',
  'common.nearby': 'Nearby',
  'common.reviews': 'Reviews',
  'common.notVerified': 'Not verified yet',
  'common.verified': 'Verified',
  'common.estimate': 'Estimate',
  'common.demoData': 'Demo catalogue',
  'common.listen': 'Listen',
  'common.stop': 'Stop',
  'dest.history': 'History',
  'dest.culture': 'Cultural significance',
  'dest.practical': 'Practical information',
  'dest.hours': 'Opening hours',
  'dest.fee': 'Entry fee',
  'dest.duration': 'Typical visit',
  'dest.bestTime': 'Best time to visit',
  'dest.accessibility': 'Accessibility',
  'dest.guidelines': 'Visitor guidelines',
  'dest.official': 'Official website',
  'dest.tickets': 'Tickets',
  'dest.sources': 'Sources',
  'dest.nearbyPlaces': 'Nearby attractions',
  'planner.title': 'AI trip planner',
  'assistant.title': 'Travel assistant',
  'assistant.placeholder': 'Ask about places, history, best time to visit…',
  'offline.banner': 'You are offline. Saved itineraries are available; maps, search and live data need a connection.',
} as const;

export type MessageKey = keyof typeof en;

const hi: Partial<Record<MessageKey, string>> = {
  'nav.explore': 'खोजें',
  'nav.map': 'मानचित्र',
  'nav.plan': 'यात्रा योजना',
  'nav.services': 'होटल और सेवाएँ',
  'nav.rooms': 'ट्रैवल रूम',
  'nav.community': 'समुदाय',
  'nav.assistant': 'सहायक',
  'nav.dashboard': 'मेरी यात्राएँ',
  'nav.admin': 'एडमिन',
  'nav.login': 'साइन इन',
  'nav.register': 'खाता बनाएँ',
  'nav.logout': 'साइन आउट',
  'home.title': 'उत्तर प्रदेश खोजें, समझदारी से योजना बनाएँ, साथ घूमें',
  'home.subtitle': 'विरासत शहर, पवित्र घाट और तराई के जंगल — सत्यापित जानकारी, ईमानदार बजट और समूह यात्रा के साथ।',
  'home.searchPlaceholder': 'स्मारक, शहर या जगह खोजें…',
  'home.featured': 'प्रमुख स्थल',
  'home.cities': 'शहर के अनुसार खोजें',
  'home.planCta': 'एक मिनट में दिन-वार यात्रा योजना बनाएँ',
  'home.planCtaSub': 'तारीख़ें, बजट और रुचियाँ बताएँ। Tripzee यात्रा समय, भोजन और पारदर्शी ख़र्च अनुमान के साथ योजना बनाता है।',
  'common.search': 'खोजें',
  'common.loading': 'लोड हो रहा है…',
  'common.retry': 'फिर से कोशिश करें',
  'common.save': 'सहेजें',
  'common.saved': 'सहेजा गया',
  'common.cancel': 'रद्द करें',
  'common.delete': 'हटाएँ',
  'common.edit': 'संपादित करें',
  'common.viewAll': 'सभी देखें',
  'common.directions': 'रास्ता',
  'common.nearby': 'आसपास',
  'common.reviews': 'समीक्षाएँ',
  'common.notVerified': 'अभी सत्यापित नहीं',
  'common.verified': 'सत्यापित',
  'common.estimate': 'अनुमान',
  'common.demoData': 'डेमो सूची',
  'common.listen': 'सुनें',
  'common.stop': 'रोकें',
  'dest.history': 'इतिहास',
  'dest.culture': 'सांस्कृतिक महत्व',
  'dest.practical': 'व्यावहारिक जानकारी',
  'dest.hours': 'खुलने का समय',
  'dest.fee': 'प्रवेश शुल्क',
  'dest.duration': 'घूमने में लगने वाला समय',
  'dest.bestTime': 'घूमने का अच्छा समय',
  'dest.accessibility': 'सुगम्यता',
  'dest.guidelines': 'आगंतुक दिशानिर्देश',
  'dest.official': 'आधिकारिक वेबसाइट',
  'dest.tickets': 'टिकट',
  'dest.sources': 'स्रोत',
  'dest.nearbyPlaces': 'आसपास के आकर्षण',
  'planner.title': 'AI यात्रा योजनाकार',
  'assistant.title': 'यात्रा सहायक',
  'assistant.placeholder': 'जगहों, इतिहास, घूमने के समय के बारे में पूछें…',
  'offline.banner': 'आप ऑफ़लाइन हैं। सहेजी गई योजनाएँ उपलब्ध हैं; मानचित्र और लाइव जानकारी के लिए इंटरनेट चाहिए।',
};

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
  /** Pick the Hindi variant of a content field when available. */
  pick: (enText: string, hiText?: string | null) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem('tz:locale') as Locale) || 'en');
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('tz:locale', l);
    setLocaleState(l);
  }, []);
  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t: (key) => (locale === 'hi' ? hi[key] ?? en[key] : en[key]),
      pick: (enText, hiText) => (locale === 'hi' && hiText ? hiText : enText),
    }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
