import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "@/i18n/locales/en-US";
import koKR from "@/i18n/locales/ko-KR";
import zhCN from "@/i18n/locales/zh-CN";

export type AppLocale = "zh-CN" | "en-US" | "ko-KR";

const LOCALE_STORAGE_KEY = "infinite-canvas:locale";

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": { translation: zhCN },
        "en-US": { translation: enUS },
        "ko-KR": { translation: koKR },
    },
    lng: (localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale) || "zh-CN",
    fallbackLng: { default: ["zh-CN"], "ko-KR": ["en-US"] },
    supportedLngs: ["zh-CN", "en-US", "ko-KR"],
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export function changeAppLocale(locale: AppLocale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return i18n.changeLanguage(locale);
}

export default i18n;
