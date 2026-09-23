"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "bn" | "hi";

export interface TranslationDictionary {
  // Navbar
  navHome: string;
  navFeatures: string;
  navSatellite: string;
  navWeather: string;
  navAssistant: string;
  navHelp: string;
  navLogin: string;
  navDashboard: string;
  navAskBot: string;

  // Hero
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  btnExplore: string;
  btnLogin: string;
  btnAskBot: string;

  // 4 Things Explained
  sectionWhatWeDoBadge: string;
  sectionWhatWeDoTitle: string;
  sectionWhatWeDoSubtitle: string;
  featFieldWatchTitle: string;
  featFieldWatchDesc: string;
  featSoilHealthTitle: string;
  featSoilHealthDesc: string;
  featRainWeatherTitle: string;
  featRainWeatherDesc: string;
  featKrishiBotTitle: string;
  featKrishiBotDesc: string;
  learnMore: string;

  // 4 Ways Field
  section4WaysBadge: string;
  section4WaysTitle: string;
  viewFromAbove: string;
  viewFromAboveDesc: string;
  viewCloseup: string;
  viewCloseupDesc: string;
  viewOnGround: string;
  viewOnGroundDesc: string;
  viewWhenRains: string;
  viewWhenRainsDesc: string;

  // How it works
  sectionStepsBadge: string;
  sectionStepsTitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;
  btnTryKrishiBot: string;

  // Crops
  sectionCropsBadge: string;
  sectionCropsTitle: string;
  sectionCropsDesc: string;
  linkManageCrops: string;
  cropRice: string;
  cropWheat: string;
  cropOnion: string;
  cropTomato: string;
  cropSugarcane: string;

  // Bottom CTA
  bottomCtaTitle: string;
  bottomCtaDesc: string;
  bottomCtaBtnSign: string;
  bottomCtaBtnChat: string;
  bottomCtaLangFoot: string;

  // Footer
  footerTagline: string;
  footerRights: string;
}

const translations: Record<Language, TranslationDictionary> = {
  en: {
    navHome: "Home",
    navFeatures: "Features",
    navSatellite: "Satellite",
    navWeather: "Weather",
    navAssistant: "AI Assistant",
    navHelp: "Help",
    navLogin: "Log In",
    navDashboard: "Dashboard",
    navAskBot: "Ask KrishiBot",

    heroBadge: "For every farmer in India",
    heroTitle1: "See what your field",
    heroTitle2: "needs — today.",
    heroSubtitle: "Satellite photos, live weather, precision irrigation, and AI advice — all for your own field. Available in English, বাংলা, and हिंदी.",
    btnExplore: "Explore Features",
    btnLogin: "Sign In / Login",
    btnAskBot: "💬 Ask KrishiBot",

    sectionWhatWeDoBadge: "Essential Agriculture Tools",
    sectionWhatWeDoTitle: "Four things, explained simply.",
    sectionWhatWeDoSubtitle: "Open the app and see your field. Everything is written in plain language, in your chosen tongue.",
    featFieldWatchTitle: "Field Watch",
    featFieldWatchDesc: "See exactly which part of your field needs attention right now.",
    featSoilHealthTitle: "Soil Health",
    featSoilHealthDesc: "Nutrient and moisture profile from farmer inputs & SoilGrids data.",
    featRainWeatherTitle: "Rain & Weather",
    featRainWeatherDesc: "Hyper-local 10-day forecasts with smart irrigation timing.",
    featKrishiBotTitle: "Ask KrishiBot",
    featKrishiBotDesc: "Ask farming questions in Bengali, Hindi, or English.",
    learnMore: "Learn more",

    section4WaysBadge: "Satellite & Soil Analytics",
    section4WaysTitle: "Your field, seen four ways.",
    viewFromAbove: "From above",
    viewFromAboveDesc: "Satellite view of your field",
    viewCloseup: "Today, close-up",
    viewCloseupDesc: "Crop health close-up",
    viewOnGround: "On the ground",
    viewOnGroundDesc: "Soil data from farmer & SoilGrids",
    viewWhenRains: "When it rains",
    viewWhenRainsDesc: "Weather overlay map",

    sectionStepsBadge: "Simple Workflow",
    sectionStepsTitle: "Four easy steps.",
    step1Title: "Mark your field",
    step1Desc: "Tap once to draw your farm boundary on the map.",
    step2Title: "We check it",
    step2Desc: "Satellites scan your field every 5 days and our AI analyses crop health instantly.",
    step3Title: "You get advice",
    step3Desc: "Receive simple, actionable alerts in Bengali, Hindi, or English.",
    step4Title: "Grow better",
    step4Desc: "Follow the guidance, track yields over seasons, and watch your income rise.",
    btnTryKrishiBot: "Try KrishiBot — AI Farming Assistant",

    sectionCropsBadge: "Currently Supported Crops",
    sectionCropsTitle: "Specialised models for your key crops.",
    sectionCropsDesc: "Hyper-tuned algorithms for Rice, Wheat, Onion, Tomato, and Sugarcane covering sowing to harvest.",
    linkManageCrops: "Sign in to manage your crops",
    cropRice: "Rice",
    cropWheat: "Wheat",
    cropOnion: "Onion",
    cropTomato: "Tomato",
    cropSugarcane: "Sugarcane",

    bottomCtaTitle: "A greener, stronger India starts with informed farmers.",
    bottomCtaDesc: "Satellite data, AI guidance, and weather intelligence — all in one place, for Rice, Wheat, Onion, Tomato, and Sugarcane.",
    bottomCtaBtnSign: "Sign In to Your Field",
    bottomCtaBtnChat: "💬 Chat with KrishiBot",
    bottomCtaLangFoot: "🌿 Available in Bengali (বাংলা), Hindi (हिंदी), and English",

    footerTagline: "Empowering Indian farmers with satellite intelligence, AI-driven advice, and real-time crop insights — in your own language.",
    footerRights: "© 2025 FasalSetu. Built with ❤️ for Indian farmers.",
  },

  bn: {
    navHome: "হোম",
    navFeatures: "বৈশিষ্ট্য",
    navSatellite: "স্যাটেলাইট",
    navWeather: "আবহাওয়া",
    navAssistant: "কৃষিবট এআই",
    navHelp: "সহায়তা",
    navLogin: "লগইন",
    navDashboard: "ড্যাশবোর্ড",
    navAskBot: "কৃষিবটকে জিজ্ঞাসা করুন",

    heroBadge: "ভারতের প্রতিটি কৃষকের জন্য",
    heroTitle1: "জানুন আপনার ফসলের কী",
    heroTitle2: "প্রয়োজন — আজই।",
    heroSubtitle: "উপগ্রহ চিত্র, লাইভ আবহাওয়া, আধুনিক সেচ এবং কৃত্রিম বুদ্ধিমত্তা — আপনার নিজের জমির জন্য। বাংলা, হিন্দি ও ইংরেজিতে উপলব্ধ।",
    btnExplore: "বৈশিষ্ট্যসমূহ দেখুন",
    btnLogin: "সাইন ইন / লগইন",
    btnAskBot: "💬 কৃষিবটকে জিজ্ঞাসা করুন",

    sectionWhatWeDoBadge: "কৃষি সহায়ক প্রযুক্তি",
    sectionWhatWeDoTitle: "সহজ ভাষায় চারটি মূল সেবা।",
    sectionWhatWeDoSubtitle: "অ্যাপটি খুলুন এবং নিজের জমি দেখুন। সবকিছু সহজ ভাষায়, আপনার পছন্দের মাতৃভাষায় লেখা।",
    featFieldWatchTitle: "জমি পর্যবেক্ষণ",
    featFieldWatchDesc: "আপনার জমির কোন অংশে এখনই যত্ন প্রয়োজন তা নিখুঁতভাবে চিহ্নিত করুন।",
    featSoilHealthTitle: "মাটির স্বাস্থ্য",
    featSoilHealthDesc: "কৃষকের তথ্য ও সয়েলগ্রিডস গ্লোবাল ডেটার মাধ্যমে মাটির সঠিক রিপোর্ট।",
    featRainWeatherTitle: "বৃষ্টি ও আবহাওয়া",
    featRainWeatherDesc: "১০ দিনের স্থানীয় পূর্বাভাস ও সেচের সঠিক সময় নির্দেশিকা।",
    featKrishiBotTitle: "কৃষিবট এআই",
    featKrishiBotDesc: "বাংলা, হিন্দি বা ইংরেজিতে ফসলের রোগবালাই ও চাষের পরামর্শ পান।",
    learnMore: "আরও জানুন",

    section4WaysBadge: "উপগ্রহ ও মাটির বিশ্লেষণ",
    section4WaysTitle: "আপনার জমি, চারটি ভিন্ন রূপে।",
    viewFromAbove: "মহাকাশ থেকে",
    viewFromAboveDesc: "আপনার জমির উপগ্রহ চিত্র",
    viewCloseup: "ফসলের নিবিড় দৃশ্য",
    viewCloseupDesc: "ফসলের বৃদ্ধি ও স্বাস্থ্যের অবস্থা",
    viewOnGround: "মাটির স্তর",
    viewOnGroundDesc: "কৃষকের তথ্য ও সয়েলগ্রিডস ভিত্তিক মাটির রিপোর্ট",
    viewWhenRains: "বৃষ্টির সময়",
    viewWhenRainsDesc: "আবহাওয়া ও বৃষ্টিপাতের রূপরেখা",

    sectionStepsBadge: "সহজ ব্যবহারের ধাপ",
    sectionStepsTitle: "সহজ চারটি পদক্ষেপ।",
    step1Title: "জমি চিহ্নিত করুন",
    step1Desc: "মানচিত্রে আঙুল দিয়ে আপনার জমির সীমানা আঁকুন।",
    step2Title: "আমরা পর্যবেক্ষণ করি",
    step2Desc: "প্রতি ৫ দিনে স্যাটেলাইট আপনার জমি স্ক্যান করে এবং এআই স্বাস্থ্যের রিপোর্ট তৈরি করে।",
    step3Title: "পরামর্শ পান",
    step3Desc: "সহজ বাংলা ভাষায় প্রয়োজনীয় সতর্কতা ও পরামর্শ পান।",
    step4Title: "ফলন বৃদ্ধি করুন",
    step4Desc: "সঠিক নির্দেশ মেনে চলুন, খরচ কমান এবং মৌসুম শেষে লাভ বাড়ান।",
    btnTryKrishiBot: "কৃষিবট এআই ব্যবহার করুন",

    sectionCropsBadge: "সমর্থিত প্রধান ফসল",
    sectionCropsTitle: "আপনার প্রধান ফসলের জন্য বিশেষ প্রযুক্তি।",
    sectionCropsDesc: "ধান, গম, পেঁয়াজ, টমেটো এবং আখের বপন থেকে তোলা পর্যন্ত বিশেষজ্ঞ মডেল।",
    linkManageCrops: "ফসল ব্যবস্থাপনার জন্য লগইন করুন",
    cropRice: "ধান (Rice)",
    cropWheat: "গম (Wheat)",
    cropOnion: "পেঁয়াজ (Onion)",
    cropTomato: "টমেটো (Tomato)",
    cropSugarcane: "আখ (Sugarcane)",

    bottomCtaTitle: "সচেতন কৃষকের হাত ধরেই গড়ে উঠবে সমৃদ্ধ ভারত।",
    bottomCtaDesc: "উপগ্রহ চিত্র, এআই সহায়তা ও আবহাওয়া পূর্বাভাস — ধান, গম, পেঁয়াজ, টমেটো এবং আখের জন্য সব এক প্ল্যাটফর্মে।",
    bottomCtaBtnSign: "আপনার জমিতে লগইন করুন",
    bottomCtaBtnChat: "💬 কৃষিবটের সাথে কথা বলুন",
    bottomCtaLangFoot: "🌿 বাংলা, হিন্দি এবং ইংরেজিতে উপলব্ধ",

    footerTagline: "স্যাটেলাইট বুদ্ধিমত্তা এবং এআই পরামর্শের মাধ্যমে ভারতীয় কৃষকদের ক্ষমতায়ন।",
    footerRights: "© ২০২৫ ফসলসেতু। ভারতীয় কৃষকদের জন্য সস্নেহে নির্মিত।",
  },

  hi: {
    navHome: "होम",
    navFeatures: "सुविधाएं",
    navSatellite: "सैटेलाइट",
    navWeather: "मौसम",
    navAssistant: "कृषिबॉट एआई",
    navHelp: "सहायता",
    navLogin: "लॉगिन",
    navDashboard: "डैशबोर्ड",
    navAskBot: "कृषिबॉट से पूछें",

    heroBadge: "भारत के प्रत्येक किसान के लिए",
    heroTitle1: "देखें आपके खेत को क्या",
    heroTitle2: "चाहिए — आज ही।",
    heroSubtitle: "सैटेलाइट तस्वीरें, लाइव मौसम, सटीक सिंचाई और एआई सलाह — सब आपके अपने खेत के लिए। हिंदी, बांग्ला और अंग्रेजी में उपलब्ध।",
    btnExplore: "सुविधाएं देखें",
    btnLogin: "साइन इन / लॉगिन",
    btnAskBot: "💬 कृषिबॉट से पूछें",

    sectionWhatWeDoBadge: "ज़रूरी कृषि साधन",
    sectionWhatWeDoTitle: "चार ज़रूरी बातें, आसान शब्दों में।",
    sectionWhatWeDoSubtitle: "ऐप खोलें और अपना खेत देखें। सब कुछ आसान और आपकी अपनी भाषा में लिखा है।",
    featFieldWatchTitle: "खेत निगरानी",
    featFieldWatchDesc: "तुरंत देखें कि आपके खेत के किस हिस्से को देखभाल की ज़रूरत है।",
    featSoilHealthTitle: "मिट्टी की सेहत",
    featSoilHealthDesc: "किसान जानकारी और सॉइल-ग्रिड्स डेटा से तैयार मिट्टी की सटीक प्रोफाइल।",
    featRainWeatherTitle: "बारिश और मौसम",
    featRainWeatherDesc: "10 दिनों का सटीक स्थानीय मौसम पूर्वानुमान और सही सिंचाई समय।",
    featKrishiBotTitle: "कृषिबॉट एआई",
    featKrishiBotDesc: "हिंदी, बांग्ला या अंग्रेजी में खेती, रोग और खाद से जुड़े सवाल पूछें।",
    learnMore: "और जानें",

    section4WaysBadge: "सैटेलाइट और मृदा विश्लेषण",
    section4WaysTitle: "आपका खेत, चार अलग-अलग नज़रियों से।",
    viewFromAbove: "ऊपर से देखें",
    viewFromAboveDesc: "आपके खेत की सैटेलाइट तस्वीर",
    viewCloseup: "फसल का नज़दीकी रूप",
    viewCloseupDesc: "फसल का स्वास्थ्य और बढ़वार",
    viewOnGround: "ज़मीनी स्तर",
    viewOnGroundDesc: "किसान डेटा और सॉइल-ग्रिड्स आधारित मिट्टी की रिपोर्ट",
    viewWhenRains: "बारिश के समय",
    viewWhenRainsDesc: "मौसम और वर्षा की स्थिति",

    sectionStepsBadge: "आसान प्रक्रिया",
    sectionStepsTitle: "चार आसान चरण।",
    step1Title: "खेत का नक्शा बनाएं",
    step1Desc: "नक्शे पर अपने खेत की सीमा बनाएं।",
    step2Title: "हम निगरानी करते हैं",
    step2Desc: "सैटेलाइट हर 5 दिन में खेत स्कैन करता है और एआई तुरंत सेहत जांचता है।",
    step3Title: "आपको सलाह मिलती है",
    step3Desc: "अपनी भाषा में सरल और उपयोगी सलाह पाएं।",
    step4Title: "बेहतर फसल पाएं",
    step4Desc: "सुझावों का पालन करें, खर्च घटाएं और हर सीजन में मुनाफा बढ़ाएं।",
    btnTryKrishiBot: "कृषिबॉट — एआई कृषि सहायक आज़माएं",

    sectionCropsBadge: "समर्थित फसलें",
    sectionCropsTitle: "आपकी मुख्य फसलों के लिए विशेष मॉडल।",
    sectionCropsDesc: "चावल, गेहूं, प्याज, टमाटर और गन्ने के लिए बुवाई से कटाई तक समर्पित तकनीक।",
    linkManageCrops: "फसलों को प्रबंधित करने के लिए साइन इन करें",
    cropRice: "चावल (Rice)",
    cropWheat: "गेहूं (Wheat)",
    cropOnion: "प्याज (Onion)",
    cropTomato: "टमाटर (Tomato)",
    cropSugarcane: "गन्ना (Sugarcane)",

    bottomCtaTitle: "सशक्त किसान से ही बनेगा समृद्ध भारत।",
    bottomCtaDesc: "सैटेलाइट डेटा, एआई मार्गदर्शन और मौसम की जानकारी — चावल, गेहूं, प्याज, टमाटर और गन्ने के लिए एक ही जगह।",
    bottomCtaBtnSign: "अपने खेत में लॉगिन करें",
    bottomCtaBtnChat: "💬 कृषिबॉट से बात करें",
    bottomCtaLangFoot: "🌿 बांग्ला, हिंदी और अंग्रेजी में उपलब्ध",

    footerTagline: "सैटेलाइट तकनीक और एआई सलाह से भारतीय किसानों का सशक्तिकरण।",
    footerRights: "© 2025 फसलसेतु। भारतीय किसानों के लिए समर्पित।",
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fasalsetu_lang") as Language;
      if (saved && (saved === "en" || saved === "bn" || saved === "hi")) {
        setLangState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("fasalsetu_lang", newLang);
    } catch {
      // ignore
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
