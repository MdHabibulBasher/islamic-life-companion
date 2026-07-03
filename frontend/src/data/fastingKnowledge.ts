// ============================================================================
// Islamic Fasting Knowledge Base
// ----------------------------------------------------------------------------
// Typed static reference data covering 13 sheets of fasting knowledge:
// occasions, weekly/white-day fasts, Ramadan fiqh, Ashura, Sha'ban, Shawwal,
// Dhul Hijjah, forbidden fasts, qada/kaffarah/fidyah, hadith index, Qur'an
// refs, and cross-madhhab scholarly opinions.
//
// UI pattern reference:
//   - frontend/src/services/islamicCalendarService.ts  (CATEGORY_META)
//   - frontend/src/pages/Calendar.tsx                  (ListView + EventDetailModal)
//
// This file is consumed by `frontend/src/pages/Fasting.tsx` to render the
// "Knowledge" tab (4th view in the segmented control).
// ============================================================================

import {
  BookOpen,
  CalendarDays,
  Star,
  Sun,
  Moon,
  Sunrise,
  Mountain,
  Cloud,
  BookText,
  Scale,
  Users,
  type LucideIcon,
} from 'lucide-react'

// ----------------------------------------------------------------------------
// Ruling color legend — mirrors CATEGORY_META in islamicCalendarService.ts
// ----------------------------------------------------------------------------
export type RulingKey =
  | 'fard'
  | 'wajib'
  | 'sunnah_muakkadah'
  | 'sunnah'
  | 'mustahabb'
  | 'kaffarah'
  | 'haram'
  | 'makrooh'
  | 'nafl'
  | 'contested'

export const RULING_META: Record<
  RulingKey,
  { label: string; color: string; description: string }
> = {
  fard: {
    label: 'Fard (Obligatory)',
    color: '#d4a017',
    description: 'Obligatory — sinful to abandon without a valid excuse',
  },
  wajib: {
    label: 'Wajib',
    color: '#b45309',
    description: 'Obligatory in specific circumstances (qada, vow, Hajj substitute)',
  },
  sunnah_muakkadah: {
    label: 'Sunnah Muakkadah',
    color: '#a855f7',
    description: 'Strongly emphasized recommended fast',
  },
  sunnah: {
    label: 'Sunnah',
    color: '#7c3aed',
    description: 'Recommended and rewarded, but not sinful to skip',
  },
  mustahabb: {
    label: 'Mustahabb',
    color: '#6366f1',
    description: 'Recommended, meritorious act',
  },
  kaffarah: {
    label: 'Kaffarah',
    color: '#dc2626',
    description: 'Severe expiation fast for a deliberate violation',
  },
  haram: {
    label: 'Haram (Prohibited)',
    color: '#b91c1c',
    description: 'Forbidden to fast on this day',
  },
  makrooh: {
    label: 'Makrooh (Disliked)',
    color: '#d97706',
    description: 'Discouraged but not strictly forbidden',
  },
  nafl: {
    label: 'Nafl (Voluntary)',
    color: '#0891b2',
    description: 'Voluntary supererogatory fast',
  },
  contested: {
    label: 'Contested',
    color: '#ea580c',
    description: 'Scholars differ on this ruling',
  },
}

const RULING_MAP: Array<[RegExp | string, RulingKey]> = [
  [/^fard/i, 'fard'],
  [/wajib/i, 'wajib'],
  [/sunnah muakkadah/i, 'sunnah_muakkadah'],
  [/sunnah/i, 'sunnah'],
  [/mustahabb/i, 'mustahabb'],
  [/kaffarah/i, 'kaffarah'],
  [/haram/i, 'haram'],
  [/makrooh|makruh/i, 'makrooh'],
  [/nafl|voluntary/i, 'nafl'],
]

export function parseRuling(category: string | null | undefined): RulingKey {
  if (!category) return 'sunnah'
  for (const [pattern, key] of RULING_MAP) {
    if (typeof pattern === 'string' ? category === pattern : pattern.test(category)) {
      return key
    }
  }
  return 'sunnah'
}

// ----------------------------------------------------------------------------
// Knowledge category registry — 13 browsable topic sheets
// ----------------------------------------------------------------------------
export type KnowledgeCategoryId =
  | 'annual'
  | 'weekly'
  | 'white'
  | 'ramadan'
  | 'muharram'
  | 'shaban'
  | 'shawwal'
  | 'dhulhijjah'
  | 'forbidden'
  | 'qada'
  | 'hadiths'
  | 'quran'
  | 'madhhabs'

export interface KnowledgeCategory {
  id: KnowledgeCategoryId
  label: string
  color: string
  icon: LucideIcon
  shortLabel: string
}

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  { id: 'annual',     label: 'Annual Occasions',      shortLabel: 'Annual',     color: '#059669', icon: CalendarDays },
  { id: 'weekly',     label: 'Weekly Fasts',          shortLabel: 'Weekly',     color: '#0891b2', icon: Sun },
  { id: 'white',      label: 'White Days',            shortLabel: 'White Days', color: '#6366f1', icon: Moon },
  { id: 'ramadan',    label: 'Ramadan Fiqh',          shortLabel: 'Ramadan',    color: '#d4a017', icon: Star },
  { id: 'muharram',   label: 'Muharram & Ashura',     shortLabel: 'Muharram',   color: '#7c3aed', icon: Star },
  { id: 'shaban',     label: "Sha'ban",               shortLabel: "Sha'ban",    color: '#0f766e', icon: Cloud },
  { id: 'shawwal',    label: 'Shawwal',               shortLabel: 'Shawwal',    color: '#10b981', icon: Sunrise },
  { id: 'dhulhijjah', label: 'Dhul Hijjah',           shortLabel: 'Dhul Hijjah',color: '#ea580c', icon: Mountain },
  { id: 'forbidden',  label: 'Forbidden / Disliked',  shortLabel: 'Forbidden',  color: '#b91c1c', icon: Star },
  { id: 'qada',       label: 'Qada / Kaffarah / Fidyah', shortLabel: 'Qada',    color: '#dc2626', icon: Scale },
  { id: 'hadiths',    label: 'Hadith Index',          shortLabel: 'Hadiths',    color: '#f0c75e', icon: BookOpen },
  { id: 'quran',      label: "Qur'an References",     shortLabel: "Qur'an",     color: '#fbbf24', icon: BookText },
  { id: 'madhhabs',   label: 'Madhhab Opinions',      shortLabel: 'Madhhabs',   color: '#a855f7', icon: Users },
]

// ----------------------------------------------------------------------------
// Universal topic shape (any knowledge row can be rendered through this)
// ----------------------------------------------------------------------------
export interface KnowledgeTopic {
  id: string
  title: string
  arabic?: string | null
  category: string
  ruling: RulingKey
  categoryId: KnowledgeCategoryId
  meta?: string | null              // Hijri month/day(s), duration, etc.
  why?: string | null               // reason / background
  virtue?: string | null            // virtue / reward
  rulingDetail?: string | null      // detailed fiqh ruling
  variantNote?: string | null       // scholarly nuance / variant
  hadithRef?: string | null         // "H007" or "H007, H025" etc.
  quranRef?: string | null          // "Q001"
  madhhabNote?: string | null       // pointer to MADxxx or note
  sources?: string | null
  narrator?: string | null
  referenceNumber?: string | null
  collection?: string | null
  grade?: string | null
  summary?: string | null
  surah?: string | null
  ayah?: string | null
  questionGroup?: string | null     // G01..G17
  madhhab?: string | null           // for madhhab opinion rows
  position?: string | null
  // Grouping for the madhhab opinion sheet
  question?: string | null
}

// ============================================================================
// 01 — Annual Occasions
// ============================================================================
interface AnnualRow {
  id: string
  occasionName: string
  arabic: string
  category: string
  hijriMonth: number
  hijriDays: string
  duration: string
  why: string
  virtue: string
  rulingDetail: string
  hadithRef: string | null
  quranRef: string | null
  madhhabNote: string | null
}
const ANNUAL_RAW: AnnualRow[] = [
  { id: 'AN001', occasionName: 'Ramadan', arabic: 'رمضان', category: 'Fard (Obligatory)', hijriMonth: 9, hijriDays: '1 to 29/30', duration: '29 or 30 days', why: "Commanded directly by Allah as the 4th Pillar of Islam; builds taqwa (God-consciousness) by following the pattern given to earlier nations.", virtue: 'Gates of Paradise opened, gates of Hell closed, devils chained; contains Laylat al-Qadr, better than 1000 months.', rulingDetail: 'Obligatory on every sane, adult, resident, healthy Muslim.', hadithRef: 'H001', quranRef: 'Q001', madhhabNote: 'Unanimous obligation across all four Sunni madhhabs and Shia fiqh.' },
  { id: 'AN002', occasionName: 'Day of Arafah', arabic: 'يوم عرفة', category: 'Sunnah Muakkadah (non-pilgrims)', hijriMonth: 12, hijriDays: '9', duration: '1 day', why: "Commemorates the pilgrims' standing (wuquf) at Arafat, the central pillar of Hajj; for non-pilgrims it is the single most rewarded voluntary fast of the year.", virtue: 'Expiates the sins of the past year and the coming year.', rulingDetail: 'Highly recommended for those NOT on Hajj. See sheet 13 for the madhhab divergence on whether pilgrims should fast it.', hadithRef: 'H002', quranRef: null, madhhabNote: 'See row MAD004 in Scholarly_Opinions sheet.' },
  { id: 'AN003', occasionName: 'First 9 Days of Dhul Hijjah', arabic: 'العشر الأوائل من ذي الحجة', category: 'Sunnah', hijriMonth: 12, hijriDays: '1-9', duration: '9 days', why: 'The Prophet described these as the days in which righteous deeds are most beloved to Allah, more so than any other days of the year.', virtue: 'Multiplied reward for any good deed, fasting included; day 9 (Arafah) carries the single greatest merit.', rulingDetail: 'Recommended for those not performing Hajj; the Prophet was reported to fast these nine days regularly.', hadithRef: 'H003', quranRef: null, madhhabNote: null },
  { id: 'AN004', occasionName: 'Eid al-Fitr', arabic: 'عيد الفطر', category: 'Haram to fast', hijriMonth: 10, hijriDays: '1', duration: '1 day', why: 'Day of celebration and communal feasting marking the end of Ramadan; fasting is forbidden to preserve the character of the day as a feast, not an act of self-denial.', virtue: 'N/A — prohibited fasting day', rulingDetail: 'Prohibited (haram) to fast, with no exceptions, by unanimous scholarly consensus (ijma).', hadithRef: 'H004', quranRef: null, madhhabNote: 'Ijma (consensus) across all madhhabs.' },
  { id: 'AN005', occasionName: 'Six Days of Shawwal', arabic: 'ست من شوال', category: 'Sunnah Muakkadah', hijriMonth: 10, hijriDays: '2-29/30 (any 6 days)', duration: '6 days, consecutive or spread', why: 'A voluntary follow-up fast that, combined with Ramadan, equals a full year\u2019s reward through the ten-fold multiplication of good deeds.', virtue: 'Ramadan (~10 months) + 6 days of Shawwal (~2 months) = reward of fasting an entire year.', rulingDetail: 'Recommended; majority view (Shafi\u02bei, Hanbali, Abu Hanifa) is Sunnah Muakkadah. See sheet 13 for full madhhab detail on consecutiveness and combining intentions.', hadithRef: 'H005', quranRef: null, madhhabNote: 'See rows MAD007\u2013MAD010 in Scholarly_Opinions sheet.' },
  { id: 'AN006', occasionName: 'Tasua (9th Muharram)', arabic: 'تاسوعاء', category: 'Sunnah', hijriMonth: 1, hijriDays: '9', duration: '1 day', why: 'The Prophet stated his intention to add this day to differentiate the Muslim observance from that of the Jewish community, who historically fasted only the 10th.', virtue: 'Paired with Ashura, represents the most complete and preferred way to observe the occasion.', rulingDetail: 'Recommended, paired with the 10th (Ashura). The Prophet passed away before implementing this himself, but scholars adopted it based on his stated intent.', hadithRef: 'H006', quranRef: null, madhhabNote: null },
  { id: 'AN007', occasionName: 'Day of Ashura (10th Muharram)', arabic: 'عاشوراء', category: 'Sunnah Muakkadah', hijriMonth: 1, hijriDays: '10', duration: '1 day', why: 'Commemorates Allah delivering Musa (Moses) and the Children of Israel from Pharaoh, who drowned in pursuit; Musa fasted in gratitude, and the Prophet said Muslims have a greater claim to Musa than others.', virtue: 'Expiates the sins of the preceding year.', rulingDetail: 'Strongly recommended; was obligatory before Ramadan fasting was prescribed, then became voluntary. Best practice pairs it with the 9th and/or 11th.', hadithRef: 'H007', quranRef: null, madhhabNote: 'Shia practice differs significantly; centers on mourning (Husayn\u2019s martyrdom at Karbala) rather than the Sunni fasting emphasis. See row MAD001.' },
  { id: 'AN008', occasionName: 'Fasting in Muharram (general)', arabic: 'صيام شهر محرم', category: 'Sunnah', hijriMonth: 1, hijriDays: 'Any days throughout', duration: 'Flexible', why: 'Muharram is one of the four sacred months, and the Prophet named it the best month for voluntary fasting after Ramadan.', virtue: 'General increase in reward for fasting throughout this sacred month.', rulingDetail: 'Not a single fixed fast — a general encouragement, with Ashura as its highlight.', hadithRef: 'H008', quranRef: null, madhhabNote: null },
  { id: 'AN009', occasionName: 'Fasting in Sha\u2019ban', arabic: 'صيام شعبان', category: 'Sunnah', hijriMonth: 8, hijriDays: 'Throughout, especially latter half', duration: 'Flexible', why: 'Aisha reported the Prophet fasted more in Sha\u2019ban than any month besides Ramadan, using it as spiritual preparation and a time when annual deeds are raised to Allah.', virtue: 'Spiritual preparation for Ramadan; deeds of the year are said to be raised to Allah during this month.', rulingDetail: 'Recommended; see sheet 5 (Shaban) and sheet 13 for the ikhtilaf on fasting after mid-Sha\u2019ban.', hadithRef: 'H009', quranRef: null, madhhabNote: 'See row MAD011.' },
  { id: 'AN010', occasionName: 'Fasting in Rajab', arabic: 'صيام رجب', category: 'Sunnah', hijriMonth: 7, hijriDays: 'Any days, esp. White Days 13-15', duration: 'Flexible', why: 'Rajab is one of the four sacred months named in the Quran, during which extra voluntary worship is encouraged.', virtue: 'General increase in reward tied to the sanctity of the month.', rulingDetail: 'No fast is specifically prescribed for Rajab beyond the general sacred-month recommendation. Caution: many circulating claims of specific numeric rewards for Rajab fasting are based on weak or fabricated narrations.', hadithRef: 'H010', quranRef: null, madhhabNote: null },
  { id: 'AN011', occasionName: 'Eid al-Adha', arabic: 'عيد الأضحى', category: 'Haram to fast', hijriMonth: 12, hijriDays: '10', duration: '1 day', why: "Day of sacrifice commemorating Ibrahim's willingness to sacrifice Ismail and Allah's mercy in providing a ram instead; a day of celebration, prayer, and communal feasting.", virtue: 'N/A — prohibited fasting day', rulingDetail: 'Prohibited (haram) to fast, with no exceptions, by unanimous consensus.', hadithRef: 'H004', quranRef: null, madhhabNote: 'Ijma across all madhhabs.' },
  { id: 'AN012', occasionName: 'Days of Tashreeq (11-13 Dhul Hijjah)', arabic: 'أيام التشريق', category: 'Haram to fast (narrow exception)', hijriMonth: 12, hijriDays: '11, 12, 13', duration: '3 days', why: 'These days follow Eid al-Adha and are dedicated to eating, drinking, and remembrance of Allah.', virtue: 'N/A — prohibited fasting days (except narrow Hajj exception)', rulingDetail: 'Prohibited except for pilgrims performing Hajj Tamattu\u2019/Qiran who cannot afford a sacrificial animal (3 days during Hajj + 7 after returning home, Quran 2:196).', hadithRef: 'H011', quranRef: 'Q002', madhhabNote: null },
  { id: 'AN013', occasionName: 'Nisfu Sha\u2019ban (mid-Sha\u2019ban, 15th)', arabic: 'نصف شعبان', category: 'Sunnah (contested)', hijriMonth: 8, hijriDays: '15 (and preceding night)', duration: '1 day', why: 'Popular tradition holds this night is associated with Allah\u2019s mercy and the annual raising of deeds; falls within the general White Days recommendation.', virtue: 'Contested — no authentic hadith prescribes a specific fixed prayer or singles out fasting this day beyond the general White Days practice.', rulingDetail: 'Fasting the 15th is valid under the general White Days (Ayyam al-Beed) Sunnah, not because of any Nisfu Sha\u2019ban-specific ruling. Ibn Baz stated there is no sound hadith establishing special virtue for this specific night.', hadithRef: 'H012', quranRef: null, madhhabNote: 'Scholars broadly agree the popular emphasis on this night exceeds what authentic evidence supports; see row MAD012.' },
]

// ============================================================================
// 02 — Weekly Fasts
// ============================================================================
interface WeeklyRow {
  id: string
  name: string
  arabic: string
  category: string
  dayRule: string
  narrator: string
  why: string
  virtue: string
  rulingDetail: string | null
  hadithRef: string | null
  quranRef: string | null
  variantNote: string | null
}
const WEEKLY_RAW: WeeklyRow[] = [
  { id: 'WK001', name: 'Monday Fasting', arabic: 'صيام الإثنين', category: 'Sunnah', dayRule: 'Every Monday', narrator: 'Abu Qatadah al-Ansari', why: 'The Prophet was asked specifically about Monday and explained its personal significance to him.', virtue: 'Monday marks the day the Prophet was born and the day revelation first came to him.', rulingDetail: null, hadithRef: 'H013', quranRef: null, variantNote: 'Primary variant: birth/revelation explanation (Sahih Muslim).' },
  { id: 'WK002', name: 'Thursday Fasting', arabic: 'صيام الخميس', category: 'Sunnah', dayRule: 'Every Thursday', narrator: 'Abu Hurairah', why: 'Paired with Monday as the two days deeds are presented to Allah; the Prophet preferred to be fasting when this presentation occurred.', virtue: 'Deeds are presented to Allah on this day; fasting while this happens is beloved to the Prophet\u2019s example.', rulingDetail: null, hadithRef: 'H014', quranRef: null, variantNote: "Core 'deeds presented' hadith variant (Tirmidhi 747, graded Hasan)." },
  { id: 'WK003', name: 'Monday & Thursday combined', arabic: 'صيام الإثنين والخميس', category: 'Sunnah Muakkadah', dayRule: 'Weekly, both days', narrator: 'Aisha', why: 'Aisha reported the Prophet was particularly keen and consistent about fasting both these days together as a standing habit.', virtue: "Combines the individual virtues of both days; represents the Prophet's most consistent weekly voluntary fasting pattern.", rulingDetail: null, hadithRef: 'H015', quranRef: null, variantNote: 'Tirmidhi 745, Nasai 2361, Ibn Majah 1739 — graded Sahih by al-Albani.' },
  { id: 'WK004', name: 'Forgiveness variant (Mon/Thu)', arabic: 'المغفرة يوم الإثنين والخميس', category: 'Sunnah (contextual)', dayRule: 'Weekly, both days', narrator: 'Abu Hurairah', why: 'A distinct hadith wording explains Allah forgives every believer on these days except those estranged from a fellow Muslim.', virtue: 'Gates of Paradise opened on Mondays and Thursdays; forgiveness withheld only for unresolved interpersonal grudges, encouraging reconciliation.', rulingDetail: null, hadithRef: 'H016', quranRef: null, variantNote: 'Distinct wording from the \u201cdeeds presented\u201d hadith — found in Sahih Muslim and Sunan Ibn Majah 1740.' },
  { id: 'WK005', name: 'Usamah ibn Zayd variant', arabic: 'حديث أسامة بن زيد', category: 'Sunnah', dayRule: 'Weekly, both days', narrator: 'Usamah ibn Zayd', why: "Usamah directly questioned the Prophet's fasting pattern (heavy fasting except two specific days), prompting an explicit explanation.", virtue: "Establishes Monday/Thursday as the Prophet's deliberate, named exception within an otherwise irregular fasting pattern.", rulingDetail: null, hadithRef: 'H017', quranRef: null, variantNote: 'Sunan an-Nasai 2358, Musnad Ahmad 21753 — graded Hasan.' },
  { id: 'WK006', name: 'Singling out Friday (prohibition)', arabic: 'إفراد يوم الجمعة', category: 'Makrooh', dayRule: 'Friday alone, not paired', narrator: 'Various (agreed upon)', why: 'The Prophet discouraged treating Friday, the weekly congregational day, as a special standalone fast day.', virtue: 'N/A — disliked practice', rulingDetail: 'Disliked (makrooh) to fast Friday alone; permissible if paired with Thursday or Saturday, or if it coincides with another recommended day (Arafah, Ashura, White Days).', hadithRef: 'H018', quranRef: null, variantNote: 'Common misconception addressed — the issue is singling it out, not fasting on it.' },
  { id: 'WK007', name: 'Three Days of Every Month', arabic: 'صيام ثلاثة أيام من كل شهر', category: 'Sunnah', dayRule: 'Any 3 days per Hijri month', narrator: 'Abu Hurairah / Abu Dharr', why: 'A flexible general practice mentioned by the Prophet as one of three enduring habits he recommended to Abu Hurairah.', virtue: 'Equivalent to fasting the whole month due to the ten-fold multiplication of reward for good deeds (lifetime fasting by proxy).', rulingDetail: null, hadithRef: 'H019', quranRef: null, variantNote: "Best fulfilled via White Days (13-15); Umm Salamah narration notes Prophet's preference for starting with Monday or Thursday." },
  { id: 'WK008', name: 'Weekly comparison ruling (Mon/Thu vs 3 days/month)', arabic: 'أيهما أفضل', category: 'Fiqh comparison', dayRule: 'N/A — comparative ruling', narrator: 'Scholarly synthesis', why: 'Scholars compared which practice is superior since Monday/Thursday fasting (8 days/month) numerically subsumes the 3-days recommendation.', virtue: "Fasting Mondays and Thursdays is considered better, since a person doing so has also fulfilled (and exceeded) the 3-day monthly recommendation.", rulingDetail: null, hadithRef: 'H019', quranRef: null, variantNote: 'Comparative fiqh ruling, not a distinct hadith — drawn from IslamQA scholarly synthesis of the above ahadith.' },
]

// ============================================================================
// 03 — White Days
// ============================================================================
interface WhiteRow {
  id: string
  name: string
  arabic: string
  category: string
  hijriDayRule: string
  recurrence: string
  why: string
  virtue: string
  rulingDetail: string | null
  hadithRef: string | null
  quranRef: string | null
  narrator: string | null
}
const WHITE_RAW: WhiteRow[] = [
  { id: 'WD001', name: 'White Days — core definition', arabic: 'أيام البيض', category: 'Sunnah', hijriDayRule: '13, 14, 15 of every Hijri month', recurrence: 'Monthly (12x per year)', why: 'Named for the nights of fullest, brightest moonlight; the Prophet regularly fasted these three days as a monthly practice.', virtue: 'Equivalent to fasting the entire month (3 days x 10-fold reward = 30 days\u2019 worth).', rulingDetail: null, hadithRef: 'H019', quranRef: null, narrator: 'Jareer ibn Abd-Allah' },
  { id: 'WD002', name: 'White Days — naming/definition hadith', arabic: 'تسمية أيام البيض', category: 'Sunnah', hijriDayRule: '13, 14, 15', recurrence: 'Monthly', why: 'Explicitly defines which three days count as Ayyam al-Beed and links them to the lifetime-fasting equivalence principle.', virtue: 'Fasting three days of each month is described as equivalent to fasting for a lifetime.', rulingDetail: null, hadithRef: 'H020', quranRef: null, narrator: 'Jareer ibn Abd-Allah (Nasai 2420, graded Sahih by al-Albani)' },
  { id: 'WD003', name: 'White Days — Abu Dharr instruction', arabic: 'حديث أبي ذر', category: 'Sunnah', hijriDayRule: '13, 14, 15', recurrence: 'Monthly', why: 'The Prophet gave Abu Dharr direct personal instruction to prioritize these specific days if fasting any part of the month.', virtue: "Positions White Days as the preferred/default choice when a person wants to fulfil the 'three days a month' Sunnah.", rulingDetail: null, hadithRef: 'H021', quranRef: null, narrator: 'Abu Dharr (Tirmidhi 761, Nasai)' },
  { id: 'WD004', name: 'White Days — flexibility on which days', arabic: 'مرونة أيام البيض', category: 'Sunnah (flexible variant)', hijriDayRule: 'Any 3 days, not strictly 13-15', recurrence: 'Monthly', why: 'A separate narration shows the Prophet did not insist on any particular three days, suggesting flexibility within the broader monthly practice.', virtue: 'Confirms the 3-day fast can be observed at the start, middle, or end of the month, consecutively or separately — though 13-15 remains preferred.', rulingDetail: null, hadithRef: 'H022', quranRef: null, narrator: "Aisha, via Mu'ahadah al-Adawiyyah (Sahih Muslim 1160)" },
  { id: 'WD005', name: 'White Days in Ramadan month itself', arabic: 'أيام البيض في رمضان', category: 'N/A — overridden', hijriDayRule: '13, 14, 15 of Ramadan', recurrence: 'N/A', why: "During Ramadan, these days are already obligatory fasting days (Fard), so the voluntary White Days category does not apply separately.", virtue: 'N/A — subsumed under Ramadan\u2019s Fard obligation', rulingDetail: null, hadithRef: null, quranRef: null, narrator: null },
  { id: 'WD006', name: 'White Days falling on Eid or Tashreeq', arabic: 'تعارض أيام البيض مع أيام محرمة', category: 'Edge case — prohibited override', hijriDayRule: '13-15 Dhul Hijjah (overlaps Tashreeq)', recurrence: 'Once/year edge case', why: 'In Dhul Hijjah, the 13th falls within the prohibited Days of Tashreeq (11-13), creating an overlap between the recommended and the forbidden.', virtue: 'N/A — prohibition takes precedence', rulingDetail: 'The prohibition on fasting during Tashreeq overrides the White Days recommendation for the 13th of Dhul Hijjah specifically; only the 14th and 15th remain fastable that month under the White Days rule.', hadithRef: 'H011', quranRef: null, narrator: null },
  { id: 'WD007', name: 'Combining White Days intention with Monday/Thursday', arabic: 'الجمع بين البيض والإثنين والخميس', category: 'Fiqh — combining intentions', hijriDayRule: '13-15, when they land on Mon/Thu', recurrence: 'Occasional overlap', why: 'When the White Days happen to fall on a Monday or Thursday, jurists discuss whether a single fast can carry both intentions.', virtue: 'Widely permitted (unlike the stricter Shawwal/Qada case) since both are voluntary (nafl) categories — see general combining-intentions principle.', rulingDetail: null, hadithRef: null, quranRef: null, narrator: 'General fiqh principle — scholars permit combining two voluntary (nafl) intentions in one fast, unlike combining nafl with wajib.' },
]

// ============================================================================
// 04 — Ramadan All Topics
// ============================================================================
interface RamadanRow {
  id: string
  topicGroup: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const RAMADAN_RAW: RamadanRow[] = [
  { id: 'RM001', topicGroup: 'Obligation',  topic: 'Fasting Ramadan is Fard', detail: 'Fourth Pillar of Islam; commanded directly in the Quran.', ruling: 'Fard (obligatory)', hadithRef: 'H001', quranRef: 'Q001' },
  { id: 'RM002', topicGroup: 'Conditions',  topic: 'Who must fast — being Muslim', detail: 'Non-Muslims are not obligated to fast Ramadan.', ruling: 'Condition of obligation', hadithRef: null, quranRef: null },
  { id: 'RM003', topicGroup: 'Conditions',  topic: 'Who must fast — puberty (bulugh)', detail: 'Children below puberty are not obligated; many families encourage gradual partial fasting for practice.', ruling: 'Condition of obligation', hadithRef: null, quranRef: null },
  { id: 'RM004', topicGroup: 'Conditions',  topic: 'Who must fast — sanity (aql)', detail: 'Those mentally incapable (majnun) are not required to fast; severe dementia/psychosis is a full exemption without qada or mandatory fidyah on the person themselves.', ruling: 'Condition of obligation', hadithRef: null, quranRef: null },
  { id: 'RM005', topicGroup: 'Conditions',  topic: 'Who must fast — physical capability', detail: 'One must be healthy and able; illness that makes fasting harmful removes the obligation temporarily or permanently.', ruling: 'Condition of obligation', hadithRef: null, quranRef: null },
  { id: 'RM006', topicGroup: 'Conditions',  topic: 'Who must fast — residency', detail: 'A traveler (musafir) has a concession to delay fasting; see RM030\u2013RM032 for travel detail.', ruling: 'Condition of obligation', hadithRef: null, quranRef: null },
  { id: 'RM007', topicGroup: 'Conditions',  topic: 'Purity from menstruation/postnatal bleeding', detail: 'Women in these states must not fast during them, and must make up (qada) the missed days later.', ruling: 'Prohibited to fast during; qada obligatory', hadithRef: null, quranRef: null },
  { id: 'RM008', topicGroup: 'Intention',   topic: 'Niyyah requirement for Ramadan', detail: 'The intention to fast must be made before Fajr each day (or, per some scholars, one intention covering the whole month suffices).', ruling: 'Obligatory (Fard fast); no fast counts without prior intention.', hadithRef: 'H023', quranRef: null },
  { id: 'RM009', topicGroup: 'Intention',   topic: 'Niyyah is in the heart, not verbal', detail: 'Intention is a heart-state; verbalizing it aloud is not required and considered an innovation (bid\u2019ah) by many scholars if treated as obligatory.', ruling: 'Recommended practice note', hadithRef: null, quranRef: null },
  { id: 'RM010', topicGroup: 'Intention',   topic: 'Niyyah timing — nightly renewal vs single monthly intention', detail: 'Some scholars require renewing intention nightly; others (notably in Maliki fiqh) allow one intention at the start of Ramadan to cover the whole month.', ruling: 'Scholarly difference — see sheet 13', hadithRef: null, quranRef: null },
  { id: 'RM011', topicGroup: 'Intention',   topic: 'Niyyah for voluntary (nafl) fasts', detail: 'For non-obligatory fasts, intention can be made any time during the day, as long as nothing has yet been eaten or done to invalidate the fast.', ruling: 'More flexible than obligatory fasts', hadithRef: null, quranRef: null },
  { id: 'RM012', topicGroup: 'Invalidators', topic: 'Deliberate eating or drinking', detail: "Intentionally consuming food or drink during fasting hours breaks the fast and requires qada; if done to deliberately violate Ramadan's sanctity without excuse, kaffarah applies.", ruling: 'Invalidates fast', hadithRef: 'H024', quranRef: null },
  { id: 'RM013', topicGroup: 'Invalidators', topic: 'Eating/drinking forgetfully', detail: 'If a person forgets they are fasting and eats or drinks, the fast remains valid; they simply stop once they remember.', ruling: 'Does NOT invalidate fast', hadithRef: 'H025', quranRef: null },
  { id: 'RM014', topicGroup: 'Invalidators', topic: 'Sexual intercourse during fasting hours', detail: 'Fully invalidates the fast and is the classical trigger for the severe kaffarah (60 consecutive days fasting or feeding 60 poor people).', ruling: 'Invalidates fast + Kaffarah required', hadithRef: 'H026', quranRef: null },
  { id: 'RM015', topicGroup: 'Invalidators', topic: 'Intentional vomiting', detail: "Deliberately inducing vomiting breaks the fast (in Hanafi fiqh, specifically if the amount is a 'mouthful' or more); requires qada only, not kaffarah.", ruling: 'Invalidates fast; qada (not kaffarah)', hadithRef: 'H027', quranRef: null },
  { id: 'RM016', topicGroup: 'Invalidators', topic: 'Unintentional/involuntary vomiting', detail: 'Vomiting that happens involuntarily (illness, motion sickness) does not break the fast, regardless of amount, as long as it is not swallowed back.', ruling: 'Does NOT invalidate fast', hadithRef: 'H027', quranRef: null },
  { id: 'RM017', topicGroup: 'Invalidators', topic: 'Nutritional injections / IV drips', detail: 'Injections or IV solutions providing actual nutrition (functioning as food/drink substitutes) invalidate the fast; non-nutritional medical injections (vaccines, insulin, local anaesthetic) do not.', ruling: 'Nutritional = invalidates; non-nutritional = does not', hadithRef: null, quranRef: null },
  { id: 'RM018', topicGroup: 'Invalidators', topic: 'Oral medication', detail: 'Swallowing pills or oral liquid medication during fasting hours breaks the fast since it involves swallowing something into the stomach.', ruling: 'Invalidates fast', hadithRef: null, quranRef: null },
  { id: 'RM019', topicGroup: 'Invalidators', topic: 'Small amounts of blood (gum bleed, nosebleed, blood test)', detail: 'Minor incidental bleeding, gum bleeds, nosebleeds, or blood drawn for medical analysis do not invalidate the fast.', ruling: 'Does NOT invalidate fast', hadithRef: null, quranRef: null },
  { id: 'RM020', topicGroup: 'Invalidators', topic: 'Wet dream / involuntary discharge', detail: 'A wet dream during sleep does not invalidate the fast since the person had no conscious intention or action.', ruling: 'Does NOT invalidate fast', hadithRef: null, quranRef: null },
  { id: 'RM021', topicGroup: 'Invalidators', topic: 'Swallowing saliva', detail: "Swallowing one's own saliva does not break the fast under any madhhab.", ruling: 'Does NOT invalidate fast', hadithRef: null, quranRef: null },
  { id: 'RM022', topicGroup: 'Invalidators', topic: 'Miswak / toothbrush use', detail: 'Using a miswak (tooth-stick) is confirmed permissible; brushing teeth is allowed provided nothing is swallowed — the Prophet himself used miswak while fasting.', ruling: 'Does NOT invalidate fast', hadithRef: 'H028', quranRef: null },
  { id: 'RM023', topicGroup: 'Invalidators', topic: 'Rinsing mouth during wudu — accidental swallow', detail: 'If a small amount of water is accidentally swallowed while rinsing the mouth during ablution (not intentional or excessive), the fast remains valid.', ruling: 'Does NOT invalidate fast (if accidental)', hadithRef: null, quranRef: null },
  { id: 'RM024', topicGroup: 'Invalidators', topic: 'Perfume, deodorant, lotion, modest makeup', detail: 'Topical application of scents or cosmetics does not invalidate the fast.', ruling: 'Does NOT invalidate fast', hadithRef: null, quranRef: null },
  { id: 'RM025', topicGroup: 'Invalidators', topic: 'Inhaling dust, smoke, or an unintentional insect', detail: 'Involuntarily inhaling dust, smoke, or swallowing something like a fly does not break the fast since there is no deliberate act.', ruling: 'Does NOT invalidate fast', hadithRef: null, quranRef: null },
  { id: 'RM026', topicGroup: 'Invalidators', topic: 'Deliberate smoking (Shafi\u02bei view)', detail: 'Per Shafi\u02bei fiqh (Hasyiyatul Jamal), deliberately inhaled smoke such as tobacco invalidates the fast, distinct from ambient cooking smoke.', ruling: 'Invalidates fast (Shafi\u02bei view)', hadithRef: null, quranRef: null },
  { id: 'RM027', topicGroup: 'Invalidators', topic: 'Suppositories (Hanafi view)', detail: 'Hanafi fiqh holds that suppositories reach the internal cavity and thus invalidate the fast, requiring qada.', ruling: 'Invalidates fast (Hanafi view)', hadithRef: null, quranRef: null },
  { id: 'RM028', topicGroup: 'Invalidators', topic: 'Menstruation/postnatal bleeding starting mid-fast', detail: "If menstruation begins even shortly before Maghrib, the entire day's fast becomes invalid and must be made up.", ruling: 'Invalidates fast; qada required', hadithRef: null, quranRef: null },
  { id: 'RM029', topicGroup: 'Invalidators', topic: 'Breaking fast under extreme hunger/thirst (fear of death)', detail: 'If genuine fear of death from hunger or thirst arises, breaking the fast to the minimum extent needed for safety is permitted, followed by qada.', ruling: 'Permitted exception; qada required', hadithRef: null, quranRef: null },
  { id: 'RM030', topicGroup: 'Exemptions',   topic: 'Travel (safar) — general concession', detail: 'A traveler is not obligated to fast but may choose to; the missed days are made up later.', ruling: 'Qada required, no fidyah', hadithRef: 'H029', quranRef: 'Q003' },
  { id: 'RM031', topicGroup: 'Exemptions',   topic: 'Travel distance threshold', detail: 'A journey must exceed roughly 80-90 km and be for a permissible purpose (not a sinful journey) for the travel concession to apply.', ruling: 'Threshold for exemption eligibility', hadithRef: null, quranRef: null },
  { id: 'RM032', topicGroup: 'Exemptions',   topic: 'Travel — departure timing condition', detail: "The journey must commence before dawn for the day's concession to apply; if travel begins after dawn, breaking the fast that day requires qada without kaffarah, but is not permitted at the outset.", ruling: 'Conditional exemption', hadithRef: null, quranRef: null },
  { id: 'RM033', topicGroup: 'Exemptions',   topic: 'Illness — temporary/recoverable', detail: 'Short-term illness (fever, flu, infection) where fasting could worsen the condition or delay recovery is exempted; missed days are made up upon recovery.', ruling: 'Qada required, no fidyah', hadithRef: null, quranRef: 'Q003' },
  { id: 'RM034', topicGroup: 'Exemptions',   topic: 'Illness — chronic/permanent', detail: 'Chronic illness with no expectation of recovery removes the obligation to fast entirely; fidyah (feeding a poor person per missed day) substitutes.', ruling: 'Fidyah required, no qada expected', hadithRef: null, quranRef: 'Q004' },
  { id: 'RM035', topicGroup: 'Exemptions',   topic: 'Elderly — frailty exemption', detail: 'Elderly Muslims who cannot fast without serious difficulty are exempt; not required to make up the fast but should give fidyah.', ruling: 'Fidyah required, no qada expected', hadithRef: null, quranRef: 'Q004' },
  { id: 'RM036', topicGroup: 'Exemptions',   topic: 'Pregnancy — no hardship', detail: 'If no hardship is present, a pregnant woman is expected to fast normally.', ruling: 'Full obligation applies', hadithRef: null, quranRef: null },
  { id: 'RM037', topicGroup: 'Exemptions',   topic: 'Pregnancy/nursing — fearing harm', detail: "If fasting risks harm to the mother or child, she may break her fast; scholars differ on whether qada alone or qada+fidyah applies depending on whose health is the concern — see sheet 13 for full madhhab breakdown.", ruling: 'Qada required; fidyah contested by school — see MAD005/MAD006', hadithRef: 'H030', quranRef: 'Q004' },
  { id: 'RM038', topicGroup: 'Exemptions',   topic: 'Fidyah calculation basis', detail: 'Fidyah is typically calculated as one mudd (~0.51 liters) of the local staple food per missed day, or its monetary equivalent depending on madhhab.', ruling: 'Feed one poor person per missed day', hadithRef: null, quranRef: 'Q004' },
  { id: 'RM039', topicGroup: 'Exemptions',   topic: 'Fidyah paid then health recovers', detail: 'If fidyah was paid believing a condition was permanent, but the person later recovers, they must then make up the missed days; the earlier fidyah is counted as voluntary charity (sadaqah).', ruling: 'Qada becomes due upon recovery', hadithRef: null, quranRef: null },
  { id: 'RM040', topicGroup: 'Exemptions',   topic: "Paying fidyah on behalf of a deceased relative", detail: 'If a deceased person had missed fasts due to illness they were never able to make up, a family member can pay fidyah on their behalf to settle the obligation.', ruling: 'Permitted', hadithRef: null, quranRef: null },
  { id: 'RM041', topicGroup: 'Exemptions',   topic: 'Fidyah vs Kaffarah — key distinction', detail: 'Fidyah compensates for a valid inability to fast (illness, age); Kaffarah atones for deliberately and unjustifiably breaking a fast. They are not interchangeable.', ruling: 'Conceptual distinction', hadithRef: null, quranRef: null },
  { id: 'RM042', topicGroup: 'Exemptions',   topic: 'Delaying qada without excuse until next Ramadan', detail: 'Majority view (Maliki, Shafi\u02bei, Hanbali): delaying makeup fasts without valid excuse until the next Ramadan arrives adds a fidyah obligation on top of the still-required qada.', ruling: 'Qada + fidyah (majority view)', hadithRef: null, quranRef: null },
  { id: 'RM043', topicGroup: 'Etiquette',   topic: 'Suhoor (pre-dawn meal) recommendation', detail: 'Eating suhoor before Fajr is encouraged as a Sunnah practice that provides blessing (barakah) for the day\u2019s fast.', ruling: 'Mustahabb (recommended)', hadithRef: 'H031', quranRef: null },
  { id: 'RM044', topicGroup: 'Etiquette',   topic: 'Delaying suhoor', detail: 'It is recommended to eat suhoor as late as possible before Fajr, rather than early in the night.', ruling: 'Mustahabb (recommended)', hadithRef: 'H031', quranRef: null },
  { id: 'RM045', topicGroup: 'Etiquette',   topic: 'Hastening iftar (breaking fast)', detail: 'Breaking the fast promptly at Maghrib (sunset), rather than delaying it, is a confirmed Sunnah practice.', ruling: 'Mustahabb (recommended)', hadithRef: 'H031', quranRef: null },
  { id: 'RM046', topicGroup: 'Etiquette',   topic: 'Breaking fast with dates', detail: "Following the Prophet's example, breaking one's fast with dates (or water if dates are unavailable) before the fuller meal is recommended.", ruling: 'Mustahabb (recommended)', hadithRef: null, quranRef: null },
  { id: 'RM047', topicGroup: 'Etiquette',   topic: 'Guarding speech and behavior', detail: 'Lying, backbiting, and anger do not technically invalidate the fast but significantly reduce its spiritual reward.', ruling: 'Reduces reward, does not invalidate', hadithRef: 'H032', quranRef: null },
  { id: 'RM048', topicGroup: 'Etiquette',   topic: 'Increased Quran recitation', detail: 'Ramadan is strongly associated with increased Quran recitation, following the tradition that the Quran was first revealed in this month.', ruling: 'Highly recommended practice', hadithRef: null, quranRef: 'Q005' },
  { id: 'RM049', topicGroup: 'Etiquette',   topic: 'Increased charity (sadaqah)', detail: "The Prophet was reported to be at his most generous during Ramadan, especially during Jibril's nightly Quran review sessions.", ruling: 'Highly recommended practice', hadithRef: null, quranRef: null },
  { id: 'RM050', topicGroup: 'Laylat al-Qadr', topic: 'Night of Power — general timing', detail: 'Falls within the last ten nights of Ramadan, most commonly associated with the odd-numbered nights.', ruling: 'N/A — spiritual occasion, not a fast', hadithRef: null, quranRef: 'Q006' },
  { id: 'RM051', topicGroup: 'Laylat al-Qadr', topic: '27th night emphasis', detail: 'Popular tradition and many scholars particularly emphasize the 27th night, though the exact night is deliberately left unspecified in most narrations to encourage seeking it across all last-ten nights.', ruling: 'Contested specific night', hadithRef: null, quranRef: 'Q006' },
  { id: 'RM052', topicGroup: 'Laylat al-Qadr', topic: 'Virtue of Laylat al-Qadr', detail: 'Worship performed on this single night is described as better than worship performed over 1,000 months (over 83 years).', ruling: 'N/A — spiritual occasion', hadithRef: null, quranRef: 'Q006' },
  { id: 'RM053', topicGroup: 'Laylat al-Qadr', topic: 'I\u2019tikaf (spiritual retreat) connection', detail: "The Prophet's practice of secluding himself in the mosque (i'tikaf) during the last ten nights is directly connected to seeking Laylat al-Qadr.", ruling: 'Sunnah practice', hadithRef: null, quranRef: null },
  { id: 'RM054', topicGroup: 'Zakat al-Fitr', topic: 'Obligation of Zakat al-Fitr', detail: 'A charity obligation distinct from fasting itself, due before Eid al-Fitr prayer, owed on behalf of oneself and dependents.', ruling: 'Wajib (obligatory), separate from the fast itself', hadithRef: null, quranRef: null },
  { id: 'RM055', topicGroup: 'Zakat al-Fitr', topic: 'Timing of Zakat al-Fitr payment', detail: "Must be paid before the Eid al-Fitr prayer; paying it after the prayer downgrades it from Zakat to ordinary charity in most scholarly views.", ruling: 'Time-bound obligation', hadithRef: null, quranRef: null },
  { id: 'RM056', topicGroup: 'Qada',        topic: 'Qada window — before next Ramadan', detail: 'Missed obligatory days must be made up any time before the following Ramadan begins; delaying without excuse beyond that adds fidyah per majority view.', ruling: 'Wajib within the year', hadithRef: null, quranRef: 'Q003' },
  { id: 'RM057', topicGroup: 'Qada',        topic: 'Qada — consecutive or spread out?', detail: 'Majority view permits spreading missed days across the year until the next Ramadan, rather than requiring them consecutively.', ruling: 'Flexible scheduling permitted', hadithRef: 'H033', quranRef: null },
  { id: 'RM058', topicGroup: 'Qada',        topic: "Aisha's practice of delaying qada to Sha\u2019ban", detail: "Aisha reported she would sometimes be unable to make up missed Ramadan fasts until Sha\u2019ban of the following year, due to being occupied attending to the Prophet.", ruling: 'Precedent for flexible qada timing', hadithRef: 'H033', quranRef: null },
]

// ============================================================================
// 05 — Muharram & Ashura
// ============================================================================
interface MuharramRow {
  id: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const MUHARRAM_RAW: MuharramRow[] = [
  { id: 'MU001', topic: 'Ashura — original obligatory status', detail: 'Before Ramadan fasting was prescribed, fasting Ashura was obligatory upon Muslims.', ruling: 'Historically Wajib, now Sunnah', hadithRef: 'H034', quranRef: null },
  { id: 'MU002', topic: 'Ashura — abrogation to voluntary status', detail: 'Once Ramadan fasting became obligatory, Ashura\u2019s obligatory status was abrogated; the Prophet then said whoever wishes may fast it and whoever wishes may leave it.', ruling: 'Sunnah (voluntary)', hadithRef: 'H035', quranRef: null },
  { id: 'MU003', topic: 'Pre-Islamic Quraysh practice', detail: 'The Quraysh tribe fasted on Ashura even before Islam, during the Jahiliyyah (pre-Islamic period); the Prophet continued this practice after prophethood.', ruling: 'Historical background', hadithRef: 'H036', quranRef: null },
  { id: 'MU004', topic: 'Musa/Pharaoh deliverance narrative', detail: 'Core justification: commemorates Allah delivering Musa and the Israelites from Pharaoh, who drowned in pursuit; the Prophet said Muslims have a greater claim to Musa than the Jewish community observing the day.', ruling: 'Primary religious basis', hadithRef: 'H007', quranRef: null },
  { id: 'MU005', topic: 'Differentiation from other faith communities', detail: 'The instruction to also fast the 9th (Tasua) stems explicitly from wanting Muslim practice to differ visibly from Jewish and Christian observance of the same date.', ruling: 'Basis for Tasua recommendation', hadithRef: 'H006', quranRef: null },
  { id: 'MU006', topic: "Ibn al-Qayyim's three levels of completeness", detail: 'Scholarly classification: (1) Most complete — fasting 9th, 10th, and 11th together; (2) Best/preferred — fasting 9th and 10th; (3) Minimum — fasting only the 10th.', ruling: 'Graded recommendation levels', hadithRef: null, quranRef: null },
  { id: 'MU007', topic: 'Fasting only the 10th (minimum option)', detail: "Permitted but considered less complete than pairing with the 9th; some scholars still recommend adding the 11th if the 9th was missed due to moon-sighting uncertainty.", ruling: 'Valid minimum, not the ideal', hadithRef: null, quranRef: null },
  { id: 'MU008', topic: 'Virtue — expiation of prior year\u2019s sins', detail: 'Fasting Ashura is reported to expiate the minor sins of the preceding year, by scholarly consensus on the hadith\u2019s meaning.', ruling: 'Expiatory virtue', hadithRef: 'H007', quranRef: null },
  { id: 'MU009', topic: "Muawiyah's clarifying khutbah", detail: 'Muawiyah bin Abu Sufyan explicitly clarified from the pulpit that fasting Ashura is not obligatory, while noting his own personal practice of fasting it.', ruling: 'Historical clarification of non-obligatory status', hadithRef: 'H037', quranRef: null },
  { id: 'MU010', topic: 'Shia observance — fundamentally different focus', detail: 'For Shia Muslims, Ashura centers on mourning the martyrdom of Husayn ibn Ali at Karbala rather than the Sunni fasting-based commemoration; fasting on this day has generally been discouraged or considered impermissible in mainstream Shia practice.', ruling: 'Sectarian divergence — not a fasting occasion in Shia practice', hadithRef: null, quranRef: null },
  { id: 'MU011', topic: 'Ashura — regional date variance', detail: "Because Muharram\u2019s start depends on moon sighting, Ashura can fall on different Gregorian dates in different countries within the same Hijri year (e.g., a one-day offset between Saudi-aligned and Morocco-aligned sighting).", ruling: 'Practical/logistical note, not a ruling difference', hadithRef: null, quranRef: null },
  { id: 'MU012', topic: 'Muharram as best month for voluntary fasting after Ramadan', detail: 'The Prophet explicitly named Muharram as the best month for fasting after the obligatory month of Ramadan.', ruling: 'General virtue of the month', hadithRef: 'H008', quranRef: null },
  { id: 'MU013', topic: 'Muharram as one of the four sacred months', detail: "Muharram is named alongside Rajab, Dhul Qa\u2019dah, and Dhul Hijjah as one of the four months in which Allah has prohibited warfare and encouraged extra devotion.", ruling: 'Sacred month status', hadithRef: null, quranRef: 'Q007' },
  { id: 'MU014', topic: 'Ashura fasting — contextual sensitivity note', detail: 'Some scholars caution that in regions where fasting Ashura could visually align with, or be mistaken for, sectarian mourning rituals, care and clarity of intention is advised, though the fast itself remains a valid Sunnah act.', ruling: 'Contextual practical note', hadithRef: null, quranRef: null },
]

// ============================================================================
// 06 — Sha'ban
// ============================================================================
interface ShabanRow {
  id: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const SHABAN_RAW: ShabanRow[] = [
  { id: 'SH001', topic: "Sha\u2019ban — most-fasted month besides Ramadan", detail: "Aisha reported she never saw the Prophet fast more in any month than in Sha\u2019ban, nor fast a complete month besides Ramadan.", ruling: 'Sunnah — highly recommended', hadithRef: 'H038', quranRef: null },
  { id: 'SH002', topic: "Reconciling 'fasted all of Sha\u2019ban' vs 'fasted most of it'", detail: "Scholars (Ibn Hajar, al-Tibi) reconcile apparently conflicting narrations by noting Arabic usage allows 'fasted the whole month' to mean 'fasted most of it'; also explained as varying by year to avoid people assuming full-month fasting is obligatory like Ramadan.", ruling: 'Scholarly reconciliation of hadith wording', hadithRef: 'H039', quranRef: null },
  { id: 'SH003', topic: 'Deeds raised to Allah annually in Sha\u2019ban', detail: 'A distinct hadith explains Sha\u2019ban is the month in which deeds for the year are raised up to Allah, and the Prophet liked to be fasting when this happened — paralleling the weekly Monday/Thursday presentation.', ruling: 'Basis for the month\u2019s virtue', hadithRef: 'H040', quranRef: null },
  { id: 'SH004', topic: "Sha\u2019ban as 'the neglected month'", detail: "The Prophet described Sha\u2019ban as a month many people neglect since it sits between the more well-known Rajab (sacred month) and Ramadan; worship performed in it is noted as requiring extra patience precisely because it goes unnoticed by most.", ruling: 'Contextual virtue — reward for consistency amid neglect', hadithRef: 'H040', quranRef: null },
  { id: 'SH005', topic: "Sha\u2019ban as preparation / 'warm-up' for Ramadan", detail: "Scholars describe Sha\u2019ban\u2019s function as gradually training the body and soul for the intensity of Ramadan, avoiding an abrupt transition.", ruling: 'Spiritual/practical rationale', hadithRef: null, quranRef: null },
  { id: 'SH006', topic: 'Connecting Sha\u2019ban directly to Ramadan', detail: 'A separate narration states Sha\u2019ban was the most beloved month to the Prophet for fasting, and that he would connect (link) it directly with Ramadan without a gap.', ruling: 'Sunnah practice — continuous fasting into Ramadan', hadithRef: 'H041', quranRef: null },
  { id: 'SH007', topic: 'Prohibition on fasting 1-2 days immediately before Ramadan', detail: "The Prophet forbade fasting a day or two immediately preceding Ramadan specifically to distinguish the voluntary Sha\u2019ban fast from the obligatory Ramadan fast — UNLESS it coincides with a person\u2019s already-habitual fasting pattern (e.g. their regular Monday/Thursday).", ruling: 'Makrooh (disliked) unless habitual pattern applies', hadithRef: 'H042', quranRef: null },
  { id: 'SH008', topic: "'Do not fast after mid-Sha\u2019ban' hadith", detail: "A hadith from Abu Hurairah states not to fast once Sha\u2019ban reaches its midpoint; scholars who hold this applies only restrict it to those starting a NEW fasting habit after mid-month without prior connection to earlier fasting.", ruling: 'Contested — see sheet 13 for full madhhab-level ikhtilaf', hadithRef: 'H043', quranRef: null },
  { id: 'SH009', topic: "Aisha's qada delay into Sha\u2019ban", detail: "Aisha reported she would owe missed Ramadan fasts and be unable to make them up until Sha\u2019ban, due to being occupied attending to the Prophet — establishing precedent that qada may be validly delayed within the year.", ruling: 'Precedent for flexible qada timing (also cross-referenced at RM058)', hadithRef: 'H033', quranRef: null },
  { id: 'SH010', topic: 'Nisfu Sha\u2019ban (15th night) — mercy and forgiveness narrations', detail: 'Multiple narrations describe Allah looking upon creation on the middle night of Sha\u2019ban and forgiving believers, with some versions excluding those harboring idolatry or unresolved grudges against others.', ruling: 'Debated authenticity — see SH011', hadithRef: 'H044', quranRef: null },
  { id: 'SH011', topic: "Nisfu Sha\u2019ban — no authentic basis for special prayer", detail: "Sheikh Ibn Baz was asked whether the 15th night of Sha\u2019ban has a special prescribed prayer and answered there is no sound hadith establishing this; narrations claiming special virtue for this specific night are weak or fabricated.", ruling: 'No specific ritual established — general White Days fasting on the 15th remains valid separately', hadithRef: 'H045', quranRef: null },
  { id: 'SH012', topic: 'Hanafi legal categorization of recommended fasting months', detail: 'Al-Fatawa al-Hindiyyah (Hanafi legal text) lists three categories of especially recommended voluntary fasting: Muharram, Rajab, and Sha\u2019ban/Ashura.', ruling: 'Hanafi school classification', hadithRef: null, quranRef: null },
  { id: 'SH013', topic: 'Maliki classification of the three encouraged months', detail: 'Imam Hattab (Maliki) in Mawahib al-Jalil similarly names Muharram, Rajab, and Sha\u2019ban as the three months in which fasting is especially encouraged.', ruling: 'Maliki school classification', hadithRef: null, quranRef: null },
]

// ============================================================================
// 07 — Shawwal
// ============================================================================
interface ShawwalRow {
  id: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const SHAWWAL_RAW: ShawwalRow[] = [
  { id: 'SW001', topic: 'Six Days of Shawwal — core hadith', detail: 'Whoever fasts Ramadan and follows it with six days of Shawwal, it is as if they fasted the entire year (via the ten-fold reward multiplication: Ramadan ~10 months + 6 days ~2 months = 12 months).', ruling: 'Sunnah Muakkadah (majority: Shafi\u02bei, Hanbali, Abu Hanifa)', hadithRef: 'H005', quranRef: null },
  { id: 'SW002', topic: 'Alternate wording — \u2018Dahr\u2019 (a lifetime)', detail: "A related narration (Muslim) uses the wording that fasting Ramadan followed by six days of Shawwal equates to fasting 'the Dahr' — a lifetime / perpetually.", ruling: 'Supporting hadith variant', hadithRef: 'H046', quranRef: null },
  { id: 'SW003', topic: 'Consecutive vs. spread across the month', detail: 'Majority of scholars: not required to be consecutive; may be fasted back-to-back immediately after Eid or scattered throughout Shawwal, whichever suits the person.', ruling: 'Both methods valid — flexible', hadithRef: null, quranRef: null },
  { id: 'SW004', topic: 'Preference for immediate/consecutive fasting', detail: "Imam Nawawi (Shafi\u02bei) and Ibn al-Mubarak preferred fasting the six days consecutively right after Eid, citing the virtue of 'hastening to do good' — though the core reward is attained by other methods too.", ruling: 'Preferred but not required (Shafi\u02bei-leaning preference)', hadithRef: null, quranRef: null },
  { id: 'SW005', topic: 'Some Hanafi narrations calling it disliked', detail: 'There are narrations from Abu Hanifa suggesting dislike of the practice; scholars clarify this relates only to treating the six days as if they were a religious DUTY, not to voluntarily fasting them, which remains commendable.', ruling: 'Clarified — not a true prohibition, concern was about mistaken obligation', hadithRef: null, quranRef: null },
  { id: 'SW006', topic: 'Maliki caution for public figures', detail: 'Some Maliki scholars expressed caution (karahah/disliked) specifically for prominent public figures fasting these six days immediately, consecutively, and publicly right after Eid — fearing onlookers might mistakenly believe the days are obligatory, like an extension of Ramadan.', ruling: 'Narrow Maliki caution, not a general prohibition', hadithRef: null, quranRef: null },
  { id: 'SW007', topic: 'Combining intention with qada (Shafi\u02bei permits)', detail: "Shafi\u02bei scholars hold two views; the stronger conclusion permits combining the intention of making up missed Ramadan days WITH the six-days-of-Shawwal intention in a single fast, by analogy to combining obligatory and Sunnah ghusl (e.g. Friday ghusl).", ruling: 'Permissible per Shafi\u02bei (majority conclusion) — see MAD007', hadithRef: 'H047', quranRef: null },
  { id: 'SW008', topic: 'Other schools requiring separate intentions', detail: 'Other juristic schools/scholars do not allow combining the qada intention with the Shawwal intention, holding that each is a distinct act of worship (one obligatory, one voluntary) requiring its own independent intention.', ruling: 'Not permissible — two separate intentions required (contrasting view) — see MAD008', hadithRef: null, quranRef: null },
  { id: 'SW009', topic: 'Reward when combining differs from fasting separately', detail: "Even scholars who permit combining intentions note that the FULL individual reward of intending Shawwal specifically (from the start) is greater than the reward gained when Shawwal is attained only as a byproduct of a qada-primary intention.", ruling: 'Nuance — permitted but with reduced specific reward', hadithRef: null, quranRef: null },
  { id: 'SW010', topic: 'Priority order — qada first, or Shawwal first?', detail: 'Since obligatory acts (qada) generally take precedence over voluntary ones (Shawwal), the safest and most commonly recommended course is completing missed Ramadan days first, then fasting the six days of Shawwal.', ruling: 'Best practice recommendation, not a strict requirement', hadithRef: null, quranRef: null },
  { id: 'SW011', topic: 'Delaying qada beyond Shawwal is still permitted', detail: 'Because the qada window extends until the next Ramadan, many scholars hold it permissible to fast the six days of Shawwal first and delay qada, provided qada is still completed before the next Ramadan arrives.', ruling: 'Permitted — qada window is the whole year, not just Shawwal', hadithRef: null, quranRef: null },
  { id: 'SW012', topic: 'Person who missed the ENTIRE month of Ramadan', detail: "A person who missed fasting the whole month of Ramadan (not just some days) and makes it all up in Shawwal does NOT fall under the specific Shawwal hadith\u2019s reward category, since they never 'fasted Ramadan and followed it with six days' — they fasted Ramadan retroactively.", ruling: 'Exception — full reward category does not apply', hadithRef: null, quranRef: null },
  { id: 'SW013', topic: 'Combining Shawwal intention with Monday/Thursday or White Days', detail: 'Scholars encourage strategically stacking the six-days-of-Shawwal intention with other recurring voluntary fasts (weekly Monday/Thursday, or the monthly White Days) that happen to fall within Shawwal, multiplying benefit from the same fasting days.', ruling: 'Permitted and encouraged (voluntary + voluntary combination)', hadithRef: null, quranRef: null },
  { id: 'SW014', topic: 'Eid al-Fitr (1 Shawwal) excluded from the six days', detail: 'The six days must be counted from the 2nd of Shawwal onward, since fasting on Eid al-Fitr itself (1 Shawwal) is prohibited by unanimous consensus.', ruling: 'Structural exclusion — see AN004', hadithRef: 'H004', quranRef: null },
  { id: 'SW015', topic: 'Deadline — must complete within Shawwal itself', detail: 'Unlike Ramadan qada (which has a year-long window), the majority hold the six-days-of-Shawwal reward is specific to the month of Shawwal and cannot be fulfilled in a later month if missed.', ruling: 'Time-bound to the month of Shawwal only', hadithRef: null, quranRef: null },
  { id: 'SW016', topic: 'Menstruating woman unable to complete within Shawwal', detail: 'A woman who intended to fast the six days but was prevented by menstruation before completing them, and could not finish before Shawwal ended, is considered excused — her sincere intention is credited.', ruling: 'Excused — intention counted despite incompletion', hadithRef: null, quranRef: null },
  { id: 'SW017', topic: 'Wisdom — sign of an accepted Ramadan', detail: 'A traditional interpretation holds that being granted the ability (tawfiq) to continue voluntary fasting right after Ramadan is itself considered a sign that the preceding Ramadan fast was accepted by Allah.', ruling: 'Spiritual interpretation, not a legal ruling', hadithRef: null, quranRef: null },
]

// ============================================================================
// 08 — Dhul Hijjah & Arafah
// ============================================================================
interface DhulHijjahRow {
  id: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const DHULHIJJAH_RAW: DhulHijjahRow[] = [
  { id: 'DH001', topic: 'First ten days — superiority hadith', detail: 'The Prophet said there are no days in which righteous deeds are more beloved to Allah than these (first ten) days of Dhul Hijjah — understood by scholars to exceed even the last ten nights of Ramadan in this specific respect (breadth of deed-types), while Laylat al-Qadr retains its own unique singular virtue.', ruling: 'Foundational virtue of the whole ten-day period', hadithRef: 'H003', quranRef: null },
  { id: 'DH002', topic: "Companions' surprise — even better than jihad?", detail: 'When companions asked if these ten days\u2019 deeds even surpass jihad in Allah\u2019s cause, the Prophet affirmed yes — except for a man who goes out with his wealth and life and returns with neither (i.e., is martyred).', ruling: 'Extends the virtue explicitly beyond ordinary good deeds', hadithRef: 'H048', quranRef: null },
  { id: 'DH003', topic: 'Quranic oath by these ten nights', detail: "Surah al-Fajr opens with Allah swearing an oath by 'ten nights', which the majority of commentators (including Ibn Abbas) identify as the first ten nights/days of Dhul Hijjah.", ruling: 'Quranic textual basis for the period\u2019s sanctity', hadithRef: null, quranRef: 'Q008' },
  { id: 'DH004', topic: 'Day of Arafah — core virtue (non-pilgrims)', detail: 'Fasting on the Day of Arafah expiates the sins of the past year and the coming year, per the Prophet\u2019s explicit statement when asked about it directly.', ruling: 'Mustahabb (highly recommended) for non-pilgrims', hadithRef: 'H002', quranRef: null },
  { id: 'DH005', topic: 'Pilgrim NOT fasting — Shafi\u02bei position', detail: "Imam Shafi\u02bei explicitly stated in al-Mukhtasar that it is mustahabb (recommended) for a pilgrim actually present at Arafat NOT to fast, based on the hadith of Umm al-Fadl.", ruling: 'Recommended NOT to fast (Shafi\u02bei) — see MAD004', hadithRef: 'H049', quranRef: null },
  { id: 'DH006', topic: "Umm al-Fadl's milk hadith", detail: 'Companions were uncertain whether the Prophet was fasting on Arafah during his Farewell Hajj; Umm al-Fadl sent him milk, which he drank while delivering the sermon at Arafah, settling the matter — confirming he did not fast that day while on Hajj.', ruling: 'Primary evidentiary hadith for the pilgrim exception', hadithRef: 'H050', quranRef: null },
  { id: 'DH007', topic: 'Rationale for pilgrims not fasting', detail: "Scholars explain the reasoning as twofold: (1) fasting would create undue hardship during the day\u2019s intense worship (wuquf/standing), and (2) the virtue of fasting Arafah can be attained in a future year, whereas the unique opportunity of physically standing at Arafat making du\u2019a may occur only once in a lifetime for most people — so the once-in-a-lifetime opportunity takes precedence.", ruling: 'Explanatory rationale, not itself a separate ruling', hadithRef: null, quranRef: null },
  { id: 'DH008', topic: 'Hanafi position — pilgrim MAY fast if not weakened', detail: 'In the Hanafi madhhab, a pilgrim performing Hajj may fast on Arafah if it will not weaken them from properly engaging in the day\u2019s worship and supplication; if it would weaken them, it becomes disliked (makruh) rather than recommended either way.', ruling: 'Conditionally permitted (Hanafi) — see MAD004', hadithRef: null, quranRef: null },
  { id: 'DH009', topic: "Ibn Uthaymin's synthesis across the views", detail: "Shaykh Ibn Uthaymin clarified that fasting Arafah is makruh (disliked) specifically for a pilgrim IF it would weaken them for the day\u2019s worship, but if it would not weaken them, combining the two acts of worship (fasting + standing at Arafah) is not problematic — reconciling the apparent difference between strict prohibition and conditional permission.", ruling: 'Nuanced synthesis position', hadithRef: null, quranRef: null },
  { id: 'DH010', topic: "Timing basis — by Arafah's local standing, not fixed date", detail: "Some scholars hold that non-pilgrims should time their Arafah fast to coincide with the actual day pilgrims are standing at Arafat (as determined by the Saudi/Hajj authorities), rather than mechanically by their own local moon-sighting-determined 9th of Dhul Hijjah, since these can occasionally diverge by a day.", ruling: 'Contested — see MAD013', hadithRef: null, quranRef: null },
  { id: 'DH011', topic: 'What to do if Arafah clashes with local Eid', detail: "If the day pilgrims stand at Arafah coincides with what would already be Eid al-Adha (10th) in a person\u2019s own country due to differing moon sightings, that person has effectively missed the ideal Arafah fast window for that year; they may still fast the 8th of Dhul Hijjah locally (which is within the broader first-nine-days virtue) with the intention of following the spirit of the occasion.", ruling: 'Practical accommodation for calendar mismatches', hadithRef: null, quranRef: null },
  { id: 'DH012', topic: 'Sacred verse revealed on Arafah', detail: "The verse declaring the religion of Islam complete and perfected ('This day I have perfected for you your religion...') was revealed on the Day of Arafah, during the Prophet's Farewell Pilgrimage.", ruling: 'Historical/textual significance of the day', hadithRef: null, quranRef: 'Q009' },
  { id: 'DH013', topic: 'Day of Arafah — freedom from Hellfire', detail: 'A distinct hadith states there is no day on which Allah frees more people from the Fire than on the Day of Arafah, during which He draws close to those present and boasts about them to the angels.', ruling: 'Additional virtue, distinct from the sin-expiation hadith', hadithRef: 'H051', quranRef: null },
  { id: 'DH014', topic: 'Days of Tashreeq — definition and purpose', detail: 'The 11th-13th of Dhul Hijjah, immediately following Eid al-Adha, are explicitly described by the Prophet as days of eating, drinking, and the remembrance of Allah — not fasting.', ruling: 'Prohibited fasting days (narrow Hajj exception — see AN012)', hadithRef: 'H011', quranRef: null },
  { id: 'DH015', topic: 'Takbeerat al-Tashreeq', detail: "These days are also marked by increased ritual glorification of Allah (takbeer) after each prayer, distinct from the fasting prohibition but part of the same designated period\u2019s character as a time of remembrance and celebration rather than austerity.", ruling: 'Related practice, not itself about fasting', hadithRef: null, quranRef: null },
  { id: 'DH016', topic: 'Hajj Tamattu\u2019/Qiran fasting substitute for sacrifice', detail: "A pilgrim performing Hajj Tamattu\u2019 or Qiran who cannot afford a sacrificial animal must fast 3 days during Hajj (ideally completed before the 10th, though some scholars permit fasting into the Tashreeq days specifically for this purpose) plus 7 days after returning home — 10 days total, explicitly legislated in the Quran.", ruling: 'Wajib substitute obligation — the sole exception to the Tashreeq fasting prohibition', hadithRef: null, quranRef: 'Q002' },
  { id: 'DH017', topic: 'Timing of the 3 Hajj-period days relative to Arafah', detail: "Scholars discuss whether the 3-day fast (for those unable to afford a sacrifice) may include the Day of Arafah itself; the stronger view discourages fasting specifically ON Arafah even for this obligatory substitute fast if it would weaken the pilgrim, preferring the days just before Arafah instead.", ruling: 'Practical sequencing guidance', hadithRef: null, quranRef: null },
]

// ============================================================================
// 09 — Forbidden / Disliked Fasting
// ============================================================================
interface ForbiddenRow {
  id: string
  topic: string
  category: string
  detail: string
  hadithRef: string | null
  quranRef: string | null
}
const FORBIDDEN_RAW: ForbiddenRow[] = [
  { id: 'FD001', topic: 'Eid al-Fitr (1 Shawwal)', category: 'Haram (Prohibited)', detail: 'Fasting is explicitly forbidden by the Prophet on this day; unanimous consensus (ijma) across all madhhabs with no exceptions.', hadithRef: 'H004', quranRef: null },
  { id: 'FD002', topic: 'Eid al-Adha (10 Dhul Hijjah)', category: 'Haram (Prohibited)', detail: 'Fasting is explicitly forbidden by the Prophet on this day; unanimous consensus across all madhhabs with no exceptions.', hadithRef: 'H004', quranRef: null },
  { id: 'FD003', topic: 'Days of Tashreeq (11-13 Dhul Hijjah)', category: 'Haram (Prohibited, narrow exception)', detail: 'Prohibited for the general population; the sole exception is a pilgrim performing Hajj Tamattu\u2019/Qiran without means for a sacrificial animal.', hadithRef: 'H011', quranRef: 'Q002' },
  { id: 'FD004', topic: 'Singling out Friday alone', category: 'Makrooh (Disliked)', detail: 'Disliked to fast Friday by itself, not paired with the day before or after; permissible if combined with Thursday/Saturday or if it coincides with an already-recommended day (Arafah, Ashura, White Days).', hadithRef: 'H018', quranRef: null },
  { id: 'FD005', topic: 'Singling out Saturday alone (contested)', category: 'Makrooh (Disliked, contested)', detail: "A separate, debated hadith discourages singling out Saturday specifically for voluntary fasting, citing its significance to the Jewish community; scholars are divided on this hadith\u2019s authenticity and practical application.", hadithRef: 'H052', quranRef: null },
  { id: 'FD006', topic: 'Day of Doubt (Yawm al-Shakk, 29-30 Sha\u2019ban)', category: 'Makrooh (Disliked)', detail: "Disliked to fast this day specifically with the intention of 'being cautious' in case Ramadan has begun; permitted if it coincides with a person\u2019s already-habitual voluntary fast pattern, or if making up a missed Ramadan day.", hadithRef: 'H042', quranRef: null },
  { id: 'FD007', topic: 'Fasting 1-2 days immediately before Ramadan without habit', category: 'Makrooh (Disliked)', detail: "The Prophet forbade beginning a new fast a day or two directly before Ramadan starts, specifically to keep the voluntary Sha\u2019ban fast visually distinct from the obligatory Ramadan fast — unless it matches a person\u2019s regular ongoing pattern.", hadithRef: 'H042', quranRef: null },
  { id: 'FD008', topic: 'Perpetual fasting (Sawm al-Dahr)', category: 'Makrooh (Disliked) / disputed Haram in some narrations', detail: "Continuously fasting every single day of the year without any break (including the two Eid days) is discouraged; one narration has the Prophet saying whoever fasts perpetually has 'not fasted' in the intended sense, since it fails to distinguish sacred fasting from ordinary life and cannot avoid the two prohibited Eid days without contradiction.", hadithRef: 'H053', quranRef: null },
  { id: 'FD009', topic: 'A menstruating or postnatally-bleeding woman fasting', category: 'Haram (Prohibited)', detail: 'It is prohibited for a woman to fast during active menstruation or postnatal bleeding; if she does fast anyway, the fast is invalid and must be made up regardless.', hadithRef: null, quranRef: null },
  { id: 'FD010', topic: 'A wife fasting voluntarily without husband\u2019s permission (contested)', category: 'Makrooh (Disliked, contextual)', detail: "One hadith states a woman should not fast voluntarily while her husband is present without his permission, out of consideration for his rights; scholars differ on how strictly and broadly to apply this outside of clear marital-rights conflicts.", hadithRef: 'H054', quranRef: null },
  { id: 'FD011', topic: 'Fasting that endangers health or life', category: 'Haram (Prohibited) in genuine danger cases', detail: 'Where fasting would create genuine, credible risk to life or serious health (confirmed illness, extreme physical strain, medical necessity), continuing the fast rather than breaking it becomes impermissible, since preserving life takes precedence.', hadithRef: null, quranRef: 'Q003' },
  { id: 'FD012', topic: 'A guest fasting voluntarily against the host\u2019s wish to feed them (contested)', category: 'Makrooh (Disliked, contextual)', detail: 'Some scholars note it is disliked for a guest to observe a voluntary fast in a way that visibly troubles or offends a host who has prepared food for them, based on hospitality etiquette principles rather than a direct fasting-specific hadith.', hadithRef: null, quranRef: null },
  { id: 'FD013', topic: 'Vowing to fast standing in the sun / self-harming vow fasts', category: 'Haram (Prohibited practice)', detail: "The Prophet ordered a woman to stop a vow that included standing exposed in the sun without shade while fasting, since it constituted self-harm rather than legitimate worship; the fasting portion of such a vow could stand, but the harmful physical conditions attached to it must be abandoned.", hadithRef: 'H055', quranRef: null },
]

// ============================================================================
// 10 — Qada / Kaffarah / Fidyah / Nadhr
// ============================================================================
interface QadaRow {
  id: string
  category: string
  topic: string
  detail: string
  ruling: string
  hadithRef: string | null
  quranRef: string | null
}
const QADA_RAW: QadaRow[] = [
  { id: 'QK001', category: 'Qada',    topic: 'Qada — definition and basis', detail: 'Making up an equal number of missed obligatory fasting days, owed by anyone who broke or missed a Ramadan fast for a valid excuse (illness, travel, menstruation, pregnancy/nursing with genuine concern).', ruling: 'Wajib (obligatory)', hadithRef: null, quranRef: 'Q003' },
  { id: 'QK002', category: 'Qada',    topic: 'Qada window', detail: "Must be completed any time before the following Ramadan begins — roughly an eleven-month window.", ruling: 'Time-bound obligation', hadithRef: null, quranRef: null },
  { id: 'QK003', category: 'Qada',    topic: 'Qada — consecutive requirement?', detail: 'Majority view permits spreading missed days across the year rather than requiring them consecutively; can be done all at once or one day at a time as convenient.', ruling: 'Flexible scheduling permitted (majority)', hadithRef: 'H033', quranRef: null },
  { id: 'QK004', category: 'Qada',    topic: 'Consequence of delaying qada without excuse past next Ramadan', detail: 'Majority view (Maliki, Shafi\u02bei, Hanbali): if delayed without valid excuse until the next Ramadan arrives, a fidyah obligation is added on top of the still-required qada.', ruling: 'Qada + Fidyah (majority view) — see MAD014', hadithRef: null, quranRef: null },
  { id: 'QK005', category: 'Qada',    topic: 'Hanafi view on delayed qada penalty', detail: 'The Hanafi school generally does not impose an additional fidyah penalty purely for delaying qada past the next Ramadan, holding that only the qada itself remains owed regardless of delay.', ruling: 'Qada only, no added fidyah for delay (Hanafi)', hadithRef: null, quranRef: null },
  { id: 'QK006', category: 'Qada',    topic: 'Qada owed by a deceased person', detail: "If a person dies while still owing qada fasts they were able to make up but did not, their heirs/family may fast on their behalf or arrange for fidyah to be given for each day, per various scholarly opinions on posthumous fulfilment.", ruling: 'Debated mechanism, generally recommended to settle via family action', hadithRef: 'H056', quranRef: null },
  { id: 'QK007', category: 'Kaffarah', topic: 'Kaffarah for deliberately breaking a Ramadan fast (sexual intercourse)', detail: "The classical trigger case: a man who had intercourse with his wife during a Ramadan fasting day was ordered by the Prophet through an escalating sequence: free a slave, then (unable) fast 60 consecutive days, then (unable) feed 60 poor people.", ruling: 'Kaffarah — sequential obligation, not a free choice between options', hadithRef: 'H026', quranRef: null },
  { id: 'QK008', category: 'Kaffarah', topic: 'Kaffarah sequence — is it strictly ordered or a free choice?', detail: 'Sunni majority (Hanafi, Shafi\u02bei, Hanbali) hold the three options are strictly sequential (must attempt each in order, moving to the next only if genuinely unable); Maliki school treats it as more of a free choice among the three from the outset.', ruling: 'Scholarly difference on sequencing — see MAD015', hadithRef: null, quranRef: null },
  { id: 'QK009', category: 'Kaffarah', topic: 'Kaffarah does not apply to excused breaking', detail: 'Kaffarah is specifically for deliberate, unjustified violation; it does not apply to breaking a fast due to illness, travel, pregnancy, or other genuine hardship — those situations require only qada (or fidyah if permanent).', ruling: 'Scope limitation — critical distinction', hadithRef: null, quranRef: null },
  { id: 'QK010', category: 'Kaffarah', topic: 'Does eating/drinking (not intercourse) trigger the same severe kaffarah?', detail: "Scholars differ: Hanafi and Hanbali generally extend the same 60-day/60-person kaffarah to deliberate eating or drinking without excuse, by analogy; Shafi\u02bei and some Maliki views restrict the severe kaffarah specifically to intercourse, treating deliberate eating/drinking as requiring only qada plus sincere repentance.", ruling: 'Scholarly difference — see MAD016', hadithRef: null, quranRef: null },
  { id: 'QK011', category: 'Kaffarah', topic: 'Kaffarah does not apply to voluntary (nafl) fasts', detail: "If a person intentionally breaks a voluntary fast, there is no sin and no kaffarah required, since the fast was not obligatory in the first place — though completing voluntary fasts once begun is still preferred.", ruling: 'No kaffarah for broken nafl fasts', hadithRef: null, quranRef: null },
  { id: 'QK012', category: 'Kaffarah', topic: 'One kaffarah per violation, or one per day?', detail: 'If a person violates the fast (e.g. via intercourse) on multiple separate days of Ramadan, the majority view holds a separate kaffarah is owed for each day violated, not one kaffarah covering the whole month.', ruling: 'Multiple kaffarahs for multiple days (majority)', hadithRef: null, quranRef: null },
  { id: 'QK013', category: 'Fidyah',   topic: 'Fidyah — definition and basis', detail: 'A charitable payment (feeding one poor person per missed day) substituting for fasting when a person is permanently or long-term unable to fast — old age, chronic illness with no expected recovery.', ruling: 'Wajib substitute for those permanently unable', hadithRef: null, quranRef: 'Q004' },
  { id: 'QK014', category: 'Fidyah',   topic: 'Fidyah calculation — amount per day', detail: 'Classically one mudd (~0.51 liters) of the local staple food (wheat, rice, dates) per missed day; contemporary charities often convert this to a cash equivalent covering one full meal or two, varying by country/organization.', ruling: 'Amount varies by school and local conversion practice', hadithRef: null, quranRef: null },
  { id: 'QK015', category: 'Fidyah',   topic: 'Shafi\u02bei requirement — food itself, not cash value', detail: 'In Shafi\u02bei fiqh, it is not permissible to give the monetary value of the food; the actual food itself must be given, unlike the Hanafi position.', ruling: 'Food-in-kind required (Shafi\u02bei)', hadithRef: null, quranRef: null },
  { id: 'QK016', category: 'Fidyah',   topic: 'Hanafi permission for cash equivalent', detail: 'Hanafi scholars explicitly permit giving the monetary value of the food instead of the food itself, offering more practical flexibility.', ruling: 'Cash equivalent permitted (Hanafi)', hadithRef: null, quranRef: null },
  { id: 'QK017', category: 'Fidyah',   topic: 'Hanbali view on fidyah for permanent inability — recommended, not obligatory', detail: 'Uniquely among the four schools, the Hanbali madhhab holds that fidyah for permanent illness/old age is mustahabb (recommended) rather than strictly wajib (obligatory) — the other three schools concur it is wajib in this case.', ruling: 'Recommended only, not strictly obligatory (Hanbali) — see MAD017', hadithRef: null, quranRef: null },
  { id: 'QK018', category: 'Fidyah',   topic: 'Fidyah for pregnant/nursing women — full madhhab divergence', detail: 'See dedicated madhhab breakdown at MAD005 and MAD006 — this is one of the most contested fidyah questions across all four schools, with each reaching a different combination of qada-only vs. qada+fidyah depending on whether the concern is for the mother or the child.', ruling: 'Cross-reference to Scholarly_Opinions sheet', hadithRef: 'H030', quranRef: 'Q004' },
  { id: 'QK019', category: 'Fidyah',   topic: 'Fidyah recipient requirements', detail: 'Fidyah must go specifically to feeding the poor and needy (masakin); it cannot be redirected to general charitable causes like mosque construction or infrastructure — the Quranic text specifies \u201cfeeding a poor person\u201d directly.', ruling: 'Restricted use requirement', hadithRef: null, quranRef: 'Q004' },
  { id: 'QK020', category: 'Fidyah',   topic: 'Paying fidyah in advance, at the start of Ramadan', detail: "If a person knows with certainty their medical condition or age will prevent fasting the entire month, they may pay the full month\u2019s fidyah upfront at Ramadan\u2019s start rather than day by day.", ruling: 'Permitted advance payment', hadithRef: null, quranRef: null },
  { id: 'QK021', category: 'Nadhr',    topic: 'Nadhr — definition and basis', detail: "A voluntary vow made by a Muslim (e.g. 'If Allah grants me X, I will fast Y days') which becomes binding and obligatory once the vowed condition is fulfilled.", ruling: 'Wajib once the condition is met', hadithRef: null, quranRef: 'Q010' },
  { id: 'QK022', category: 'Nadhr',    topic: 'Nadhr must specify something permissible', detail: "A vow to fast is only valid and binding if the underlying act is itself permissible; vows involving prohibited or self-harming conditions (e.g. fasting while standing exposed in the sun) must have the harmful condition removed while the basic fasting portion may still stand.", ruling: 'Validity condition on the vow\u2019s content', hadithRef: 'H055', quranRef: null },
  { id: 'QK023', category: 'Nadhr',    topic: 'Unspecified/general vow to fast', detail: 'If a person vows generally to fast without specifying which days, scholars generally hold this obligates at minimum one day of fasting, fulfilling the vow\u2019s linguistic minimum.', ruling: 'Minimum interpretation — one day', hadithRef: null, quranRef: null },
  { id: 'QK024', category: 'Nadhr',    topic: 'Vow to fast on a day that is later prohibited (e.g. lands on Eid)', detail: 'If a specific-day vow happens to coincide with a day fasting is prohibited (such as Eid), the person does not fast that day but instead makes up the vowed fast on an alternative day, since the general prohibition on Eid fasting overrides the personal vow.', ruling: 'Prohibition on that specific day overrides; vow fulfilled on a substitute day', hadithRef: null, quranRef: null },
  { id: 'QK025', category: 'Nadhr',    topic: 'Breaking a vow to fast without fulfilling it', detail: 'If a person fails to fulfil a valid vow to fast, they owe kaffarat al-yamin (oath expiation: feeding/clothing 10 needy people, freeing a slave, or — if unable to do any of these — fasting three days) as a substitute, per scholarly analogy to oath-breaking.', ruling: 'Kaffarat al-yamin as substitute for an unfulfilled vow', hadithRef: null, quranRef: 'Q011' },
  { id: 'QK026', category: 'Kaffarah (other)', topic: 'Expiation for breaking an oath (kaffarat al-yamin)', detail: 'Fasting three days is the lowest-priority option for atoning for a broken oath, used only if the person cannot afford to feed ten needy people, clothe them, or free a slave.', ruling: 'Fasting only if unable to feed/clothe 10 poor or free a slave', hadithRef: null, quranRef: 'Q011' },
  { id: 'QK027', category: 'Kaffarah (other)', topic: 'Expiation for zihar', detail: 'Zihar is a pre-Islamic divorce-like declaration (a husband likening his wife to a forbidden relative); expiation follows a sequential order — free a slave, or fast two consecutive months, or feed sixty poor people.', ruling: 'Sequential expiation — fasting is the middle option if freeing a slave is not possible', hadithRef: null, quranRef: 'Q012' },
  { id: 'QK028', category: 'Kaffarah (other)', topic: 'Expiation for accidental killing', detail: "A Muslim who unintentionally causes another\u2019s death owes atonement alongside blood money (diyyah) to the victim\u2019s family — free a slave, or (if unable) fast two consecutive months.", ruling: 'Sequential expiation, distinct from criminal/civil liability aspects', hadithRef: null, quranRef: 'Q013' },
  { id: 'QK029', category: 'Wajib (other)', topic: 'Fasting substitute for Hajj Tamattu\u2019/Qiran without a sacrifice', detail: '3 days during Hajj + 7 days after returning home (10 total), for a pilgrim performing Tamattu\u2019 or Qiran who cannot financially afford a sacrificial animal — directly legislated in the Quran, not analogized from another ruling.', ruling: 'Wajib substitute for the sacrifice, not a kaffarah in the punitive sense', hadithRef: null, quranRef: 'Q002' },
]

// ============================================================================
// 11 — Hadith Index
// ============================================================================
interface HadithIndexRow {
  id: string
  narrator: string
  collection: string
  referenceNumber: string
  grade: string
  summary: string
  topicTag: string
}
const HADITH_RAW: HadithIndexRow[] = [
  { id: 'H001', narrator: 'General consensus',         collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 8, Muslim 16',     grade: 'Sahih (agreed upon)', summary: 'The five pillars of Islam are named, including fasting the month of Ramadan.', topicTag: 'Ramadan obligation' },
  { id: 'H002', narrator: 'Abu Qatadah al-Ansari',     collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1162',             grade: 'Sahih',                summary: 'The Prophet was asked about fasting the Day of Arafah and explained it expiates sins of the past and coming year.', topicTag: 'Arafah virtue' },
  { id: 'H003', narrator: 'Ibn Abbas',                 collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 969',             grade: 'Sahih',                summary: 'The Prophet stated no righteous deeds are more beloved to Allah than those done in these (first ten) days of Dhul Hijjah.', topicTag: 'First 10 days Dhul Hijjah' },
  { id: 'H004', narrator: 'Various companions',        collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1990, Muslim 1137',grade: 'Sahih (agreed upon)', summary: 'The Prophet forbade fasting on the Day of Fitr and the Day of Adha.', topicTag: 'Eid prohibition' },
  { id: 'H005', narrator: 'Abu Ayyub al-Ansari',       collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1164',             grade: 'Sahih',                summary: 'Whoever fasts Ramadan then follows it with six days of Shawwal has fasted as though for a full year.', topicTag: 'Shawwal virtue' },
  { id: 'H006', narrator: 'Ibn Abbas',                 collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1134',             grade: 'Sahih',                summary: "The Prophet noted companions\u2019 observation that Jews and Christians venerated the 10th of Muharram, and stated his intention to also fast the 9th the following year, to differentiate practice.", topicTag: 'Tasua origin' },
  { id: 'H007', narrator: 'Ibn Abbas',                 collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 3397, Muslim 1130',grade: 'Sahih (agreed upon)', summary: 'Upon finding the Jewish community of Madinah fasting the day Musa was saved from Pharaoh, the Prophet said Muslims have a greater claim to Musa and ordered Muslims to fast it too.', topicTag: 'Ashura origin / Musa narrative' },
  { id: 'H008', narrator: 'Abu Hurairah',              collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1163',             grade: 'Sahih',                summary: 'The Prophet described Muharram as the best month for voluntary fasting after Ramadan.', topicTag: 'Muharram virtue' },
  { id: 'H009', narrator: 'Aisha / Usamah ibn Zayd',   collection: 'Sahih al-Bukhari / Sunan an-Nasa\u02bei', referenceNumber: 'Bukhari 1969, Nasai 2357',grade: 'Sahih',          summary: 'The Prophet fasted more in Sha\u2019ban than in any month besides Ramadan.', topicTag: "Sha'ban virtue" },
  { id: 'H010', narrator: 'General scholarly note',    collection: 'Various weak/unverified chains',  referenceNumber: 'N/A',                      grade: 'Weak / not established',summary: "Numerous popular claims attach specific numeric rewards to Rajab fasting; scholars caution these generally trace to weak or fabricated narrations rather than authentic sources.", topicTag: 'Rajab (caution note)' },
  { id: 'H011', narrator: 'Abu Hurairah',              collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1141',             grade: 'Sahih',                summary: 'The Prophet described the Days of Tashreeq as days of eating, drinking, and remembrance of Allah, not fasting.', topicTag: 'Tashreeq prohibition' },
  { id: 'H012', narrator: 'Shaykh Ibn Baz (fatwa)',    collection: 'Fatawa Ibn Baz',                 referenceNumber: 'N/A — fatwa',             grade: 'Scholarly opinion',    summary: 'Ibn Baz stated there is no sound hadith establishing a specific prescribed prayer or fixed virtue uniquely for the 15th night of Sha\u2019ban.', topicTag: "Nisfu Sha'ban (caution note)" },
  { id: 'H013', narrator: 'Abu Qatadah al-Ansari',     collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1162',             grade: 'Sahih',                summary: 'Asked about fasting Monday specifically, the Prophet explained it was the day of his birth and the day revelation first came to him.', topicTag: 'Monday fasting' },
  { id: 'H014', narrator: 'Abu Hurairah',              collection: 'Sunan al-Tirmidhi',              referenceNumber: 'Tirmidhi 747',            grade: 'Hasan',                summary: 'Deeds are presented to Allah on Monday and Thursday, and the Prophet liked to be fasting when his deeds were presented.', topicTag: 'Monday & Thursday — deeds presented' },
  { id: 'H015', narrator: 'Aisha',                     collection: 'Sunan al-Tirmidhi / Sunan an-Nasa\u02bei / Sunan Ibn Majah', referenceNumber: 'Tirmidhi 745, Nasai 2361, Ibn Majah 1739',grade: 'Sahih (per al-Albani)',summary: "The Prophet was particularly keen and consistent about fasting on Mondays and Thursdays.", topicTag: 'Monday & Thursday — consistency' },
  { id: 'H016', narrator: 'Abu Hurairah',              collection: 'Sahih Muslim / Sunan Ibn Majah',  referenceNumber: 'Muslim, Ibn Majah 1740',  grade: 'Sahih',                summary: 'On Mondays and Thursdays Allah forgives every believer who does not associate partners with Him, except one who holds a grudge against a fellow Muslim.', topicTag: 'Monday & Thursday — forgiveness' },
  { id: 'H017', narrator: 'Usamah ibn Zayd',           collection: 'Sunan an-Nasa\u02bei / Musnad Ahmad', referenceNumber: 'Nasai 2358, Ahmad 21753',grade: 'Hasan',                  summary: "Usamah asked the Prophet why he fasted so consistently on two particular days each week; the Prophet named Monday and Thursday as the days deeds are presented to Allah.", topicTag: "Monday & Thursday — Usamah's question" },
  { id: 'H018', narrator: 'Various companions',        collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1985, Muslim 1144',grade: 'Sahih (agreed upon)', summary: 'The Prophet instructed not to single out Friday for fasting unless also fasting the day before or after it.', topicTag: 'Friday fasting prohibition' },
  { id: 'H019', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1981, Muslim 721', grade: 'Sahih (agreed upon)', summary: 'The Prophet advised Abu Hurairah to maintain three enduring habits, including fasting three days of every month.', topicTag: 'Three days monthly' },
  { id: 'H020', narrator: 'Jarir ibn Abdullah',        collection: 'Sunan an-Nasa\u02bei',               referenceNumber: 'Nasai 2420',              grade: 'Sahih (per al-Albani)',summary: 'Fasting three days of every month is described as equivalent to fasting for a lifetime, with the White Days identified as the 13th, 14th, and 15th.', topicTag: 'White Days definition' },
  { id: 'H021', narrator: 'Abu Dharr',                 collection: 'Sunan al-Tirmidhi / Sunan an-Nasa\u02bei', referenceNumber: 'Tirmidhi 761',         grade: 'Sahih',                summary: 'The Prophet instructed Abu Dharr that if he fasts any part of a month, he should prioritize the 13th, 14th, and 15th.', topicTag: 'White Days — Abu Dharr instruction' },
  { id: 'H022', narrator: "Aisha (via Mu'ahadah al-Adawiyyah)", collection: 'Sahih Muslim',         referenceNumber: 'Muslim 1160',             grade: 'Sahih',                summary: "Confirms the Prophet fasted three days monthly without a fixed preference for which specific days, though he generally began with Monday or Thursday.", topicTag: 'White Days — flexibility' },
  { id: 'H023', narrator: 'Hafsa',                     collection: 'Sunan Abu Dawud / Sunan al-Tirmidhi', referenceNumber: 'Abu Dawud 2454, Tirmidhi 730',grade: 'Sahih (in mawquf/marfu form per scholars)', summary: "Whoever does not settle their intention to fast before dawn has no valid fast (for the obligatory fast).", topicTag: 'Niyyah requirement' },
  { id: 'H024', narrator: 'General principle',         collection: 'Quran 2:187 / scholarly consensus', referenceNumber: 'N/A — Quranic basis',    grade: 'N/A',                  summary: 'Deliberate eating or drinking during fasting hours is established as invalidating the fast, based on the Quranic command to eat and drink only until dawn.', topicTag: 'Deliberate eating/drinking' },
  { id: 'H025', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1933, Muslim 1155',grade: 'Sahih (agreed upon)', summary: 'Whoever forgetfully eats or drinks while fasting should complete their fast, since it is Allah who fed and gave them drink.', topicTag: 'Forgetful eating/drinking' },
  { id: 'H026', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1936, Muslim 1111',grade: 'Sahih (agreed upon)', summary: 'A man told the Prophet he was \u2018ruined\u2019 after having intercourse with his wife while fasting Ramadan; the Prophet ordered a sequential expiation (free a slave, then 60 days\u2019 fasting, then feeding 60 poor people).', topicTag: 'Intercourse / Kaffarah origin' },
  { id: 'H027', narrator: 'Abu Hurairah',              collection: "Sunan al-Tirmidhi / collected by 'the five'", referenceNumber: 'Tirmidhi 720',         grade: 'Hasan',                summary: 'One overcome by involuntary vomiting owes no makeup fast, but one who deliberately induces vomiting must make up that day.', topicTag: 'Vomiting ruling' },
  { id: 'H028', narrator: 'Various',                   collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 1931',            grade: 'Sahih',                summary: 'The Prophet is reported to have used the miswak (tooth-stick) while fasting.', topicTag: 'Miswak permissibility' },
  { id: 'H029', narrator: 'General principle',         collection: 'Sunan Abu Dawud',                 referenceNumber: 'Abu Dawud 2408',          grade: 'Sahih',                summary: 'Allah has relieved the traveler of half the prayer and relieved the traveler, and the pregnant/nursing woman, of the obligation to fast.', topicTag: 'Travel concession basis' },
  { id: 'H030', narrator: 'Anas ibn Malik al-Ka\u2019bi',collection: 'Sunan al-Tirmidhi / Sunan Ibn Majah', referenceNumber: 'Tirmidhi 715, Ibn Majah 1667',grade: 'Sahih',         summary: 'Allah has relieved the traveler of half the prayer, and relieved the traveler and the pregnant or nursing woman of fasting.', topicTag: 'Pregnancy/nursing exemption basis' },
  { id: 'H031', narrator: 'Anas ibn Malik',            collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1923, Muslim 1095',grade: 'Sahih (agreed upon)', summary: 'The Prophet encouraged eating suhoor, describing blessing in it, and encouraged hastening to break the fast at sunset.', topicTag: 'Suhoor/Iftar etiquette' },
  { id: 'H032', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 1903',            grade: 'Sahih',                summary: "Whoever does not abandon false speech and acting upon it, Allah has no need of their abstention from food and drink.", topicTag: 'Guarding speech while fasting' },
  { id: 'H033', narrator: 'Aisha (via Abu Salamah)',   collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1950, Muslim 1146',grade: 'Sahih (agreed upon)', summary: "Aisha reported she would owe fasts from Ramadan and be unable to make them up until Sha\u2019ban, due to being occupied attending to the Prophet.", topicTag: 'Qada delay precedent' },
  { id: 'H034', narrator: 'Aisha',                     collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 2002, Muslim 1125',grade: 'Sahih (agreed upon)', summary: 'The Quraysh fasted Ashura in the pre-Islamic period, and the Prophet continued this before Ramadan fasting was legislated, at which point Ashura became optional.', topicTag: 'Ashura — original obligation' },
  { id: 'H035', narrator: 'Muawiyah ibn Abi Sufyan / Aisha', collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 2003, Muslim 1129',grade: 'Sahih (agreed upon)', summary: 'Once Ramadan was made obligatory, the earlier obligation to fast Ashura was lifted, and the Prophet said whoever wishes may fast it and whoever wishes may not.', topicTag: 'Ashura — abrogation' },
  { id: 'H036', narrator: 'Aisha',                     collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 1892',            grade: 'Sahih',                summary: 'The Quraysh tribe fasted Ashura during the pre-Islamic period (Jahiliyyah), a practice the Prophet continued.', topicTag: 'Ashura — pre-Islamic origin' },
  { id: 'H037', narrator: 'Qasim Abu Abdur-Rahman',    collection: 'Sunan Ibn Majah',                referenceNumber: 'Ibn Majah 1735 (context)',grade: 'Sahih',                summary: 'Muawiyah addressed the people from the pulpit before Ramadan, clarifying the calendar/fasting rules of the time, including Ashura\u2019s non-obligatory status.', topicTag: "Ashura — Muawiyah's clarification" },
  { id: 'H038', narrator: 'Aisha (via Abu Salamah)',   collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1969, Muslim 1156',grade: 'Sahih (agreed upon)', summary: 'Aisha said she never saw the Prophet fast a complete month besides Ramadan, and never saw him fast more in any month than in Sha\u2019ban.', topicTag: "Sha'ban — most fasted month" },
  { id: 'H039', narrator: 'Aisha',                     collection: 'Sahih Muslim (with scholarly commentary)', referenceNumber: 'Muslim 746 (base narration)',grade: 'Sahih (reconciliation is scholarly)', summary: "Reconciles apparently conflicting reports of 'fasted all Sha\u2019ban' versus 'fasted most of it', concluding the Prophet varied by year to avoid people assuming full-month fasting was obligatory.", topicTag: "Sha'ban — reconciliation" },
  { id: 'H040', narrator: 'Usamah ibn Zayd',           collection: 'Sunan an-Nasa\u02bei / Musnad Ahmad', referenceNumber: 'Nasai / Ahmad',          grade: 'Hasan',                summary: 'Usamah asked why the Prophet fasted so much in Sha\u2019ban; the Prophet explained it is a neglected month between Rajab and Ramadan in which deeds are raised to Allah.', topicTag: "Sha'ban — neglected month / deeds raised" },
  { id: 'H041', narrator: 'Aisha',                     collection: 'Sunan (collection varies)',      referenceNumber: 'Sunan (Sha\u2019ban-Ramadan connection)',grade: 'Sahih',             summary: "Sha\u2019ban was the most beloved month to the Prophet for fasting, and he would connect it directly with Ramadan.", topicTag: "Sha'ban — connecting to Ramadan" },
  { id: 'H042', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1914, Muslim 1082',grade: 'Sahih (agreed upon)', summary: 'The Prophet forbade fasting a day or two immediately before Ramadan except for someone with an already-habitual fasting pattern that happens to fall then.', topicTag: 'Pre-Ramadan fasting prohibition' },
  { id: 'H043', narrator: 'Abu Hurairah',              collection: 'Sunan Abu Dawud / Sunan al-Tirmidhi', referenceNumber: 'Abu Dawud 2337, Tirmidhi 738',grade: "Da'if (weak) per some scholars; disputed", summary: 'A hadith stating not to fast once Sha\u2019ban reaches its midpoint; authenticity and scope are debated among scholars.', topicTag: 'Mid-Sha\u2019ban fasting dispute' },
  { id: 'H044', narrator: 'Abu Musa al-Ash\u2019ari / Abu Tha\u2019labah', collection: 'Sunan Ibn Majah',   referenceNumber: 'Ibn Majah 1390',          grade: "Da'if to Hasan (disputed by scholars)", summary: 'Allah looks upon creation on the middle night of Sha\u2019ban and forgives believers, excepting those who associate partners with Him or harbor unresolved hatred.', topicTag: "Nisfu Sha'ban mercy narration" },
  { id: 'H045', narrator: 'Shaykh Ibn Baz (fatwa)',    collection: 'Fatawa Ibn Baz',                 referenceNumber: 'N/A — fatwa',             grade: 'Scholarly opinion',    summary: "Confirms no sound hadith establishes a special prescribed prayer specifically for the 15th night of Sha\u2019ban.", topicTag: "Nisfu Sha'ban — no special prayer" },
  { id: 'H046', narrator: 'Thawban',                   collection: 'Sunan Ibn Majah (Shawwal context)', referenceNumber: 'Ibn Majah',              grade: 'Sahih (per cited grading)', summary: 'Whoever fasts Ramadan and six days of Shawwal after Eid al-Fitr has completed a full year of fasting reward.', topicTag: 'Shawwal — alternate wording' },
  { id: 'H047', narrator: 'Scholarly analogy (Shafi\u02bei fiqh)', collection: "Shafi\u02bei fiqh texts (not a direct hadith)", referenceNumber: 'N/A — fiqh analogy',grade: 'Scholarly reasoning', summary: "Combining the qada intention with the Shawwal intention is reasoned by analogy to combining obligatory ghusl with the Sunnah Friday ghusl.", topicTag: 'Shawwal — combining intentions analogy' },
  { id: 'H048', narrator: 'Ibn Abbas',                 collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 969',             grade: 'Sahih',                summary: 'When companions asked if deeds in the first ten days of Dhul Hijjah even surpass jihad, the Prophet affirmed yes, except for one who is martyred.', topicTag: 'First 10 days — surpasses jihad' },
  { id: 'H049', narrator: 'Umm al-Fadl',               collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1989, Muslim 1123',grade: 'Sahih (agreed upon)', summary: "The basis Imam Shafi\u02bei cited for pilgrims not fasting Arafah — see H050 for the specific narrative.", topicTag: 'Arafah — pilgrim non-fasting basis' },
  { id: 'H050', narrator: 'Umm al-Fadl',               collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1989, Muslim 1123',grade: 'Sahih (agreed upon)', summary: "Companions doubted whether the Prophet was fasting at Arafah; Umm al-Fadl sent him milk, which he drank while delivering the sermon, confirming he was not fasting.", topicTag: "Arafah — Umm al-Fadl's milk" },
  { id: 'H051', narrator: 'Aisha',                     collection: 'Sahih Muslim',                   referenceNumber: 'Muslim 1348',             grade: 'Sahih',                summary: 'There is no day on which Allah frees more people from the Fire than the Day of Arafah, on which He draws near and boasts of those present to the angels.', topicTag: 'Arafah — freedom from Hellfire' },
  { id: 'H052', narrator: 'Various (disputed)',        collection: 'Sunan Abu Dawud / Sunan al-Tirmidhi', referenceNumber: 'Abu Dawud 2421, Tirmidhi 744',grade: "Da'if to Hasan (scholars disagree)", summary: 'A disputed narration discouraging singling out Saturday for voluntary fasting, citing its significance to the Jewish community.', topicTag: 'Saturday fasting dispute' },
  { id: 'H053', narrator: 'Abdullah ibn Amr',          collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 1976, Muslim 1159',grade: 'Sahih (agreed upon)', summary: "The Prophet told Abdullah ibn Amr that one who fasts every single day perpetually has, in effect, 'not fasted' in the intended religious sense.", topicTag: 'Perpetual fasting discouraged' },
  { id: 'H054', narrator: 'Abu Hurairah',              collection: 'Sahih al-Bukhari / Sahih Muslim', referenceNumber: 'Bukhari 5195, Muslim 1026',grade: 'Sahih (agreed upon)', summary: "A woman should not fast voluntarily while her husband is present without his permission, out of consideration for his rights.", topicTag: "Wife's voluntary fasting — husband's permission" },
  { id: 'H055', narrator: 'Ibn Abbas',                 collection: 'Sahih al-Bukhari',               referenceNumber: 'Bukhari 6704',            grade: 'Sahih',                summary: 'The Prophet ordered a woman to abandon a vow that included standing exposed in the sun, instructing her to shade herself, sit, and complete her fast, since the harmful condition was not legitimate worship.', topicTag: 'Harmful vow conditions' },
  { id: 'H056', narrator: 'General scholarly discussion', collection: 'Various fiqh texts',           referenceNumber: 'N/A — fiqh discussion',  grade: 'Scholarly reasoning',  summary: 'Discussion of mechanisms (family fasting on behalf of the deceased, or fidyah) for settling qada fasts left unfulfilled at death.', topicTag: 'Qada owed by deceased' },
]

// ============================================================================
// 12 — Qur'an References
// ============================================================================
interface QuranIndexRow {
  id: string
  surah: string
  ayah: string
  topic: string
  summary: string
}
const QURAN_RAW: QuranIndexRow[] = [
  { id: 'Q001', surah: 'Al-Baqarah',  ayah: '2:183',  topic: 'Ramadan obligation',          summary: 'Fasting is prescribed for believers as it was prescribed for those before them, so that they may attain God-consciousness (taqwa).' },
  { id: 'Q002', surah: 'Al-Baqarah',  ayah: '2:196',  topic: 'Hajj Tamattu\u2019 fasting substitute', summary: 'A pilgrim unable to afford a sacrificial animal should fast three days during Hajj and seven days after returning home.' },
  { id: 'Q003', surah: 'Al-Baqarah',  ayah: '2:184-185', topic: 'Travel/illness exemption and qada', summary: 'One who is ill or traveling should make up an equal number of days later; Allah intends ease, not hardship, for believers.' },
  { id: 'Q004', surah: 'Al-Baqarah',  ayah: '2:184',  topic: 'Fidyah basis',                summary: 'Those who can only fast with extreme difficulty may compensate by feeding a needy person for each day not fasted.' },
  { id: 'Q005', surah: 'Al-Baqarah',  ayah: '2:185',  topic: 'Quran\u2019s revelation in Ramadan', summary: 'The month of Ramadan is identified as the month in which the Quran was revealed as guidance for humanity.' },
  { id: 'Q006', surah: 'Al-Qadr',     ayah: '97:1-5', topic: 'Laylat al-Qadr virtue',       summary: 'The Night of Decree is described as better than a thousand months, a night of peace until the break of dawn.' },
  { id: 'Q007', surah: 'At-Tawbah',   ayah: '9:36',   topic: 'Four sacred months',          summary: 'References the twelve months ordained by Allah, of which four are sacred, within which extra reverence is due.' },
  { id: 'Q008', surah: 'Al-Fajr',     ayah: '89:1-2', topic: 'Ten nights oath (Dhul Hijjah)', summary: 'Allah swears an oath by the dawn and by ten nights, understood by most commentators as the first ten nights of Dhul Hijjah.' },
  { id: 'Q009', surah: 'Al-Ma\u02beidah', ayah: '5:3',   topic: 'Religion perfected on Arafah', summary: "Declares that the religion has been perfected and Allah's favor completed, with Islam approved as the way of life — revealed on the Day of Arafah." },
  { id: 'Q010', surah: 'Al-Hajj',     ayah: '22:29',  topic: 'Fulfilling vows',             summary: 'References completing prescribed rites and fulfilling vows made as part of worship.' },
  { id: 'Q011', surah: 'Al-Ma\u02beidah', ayah: '5:89',  topic: 'Oath expiation (kaffarat al-yamin)', summary: 'Expiation for a broken oath is feeding ten needy people, clothing them, freeing a slave, or — if unable — fasting three days.' },
  { id: 'Q012', surah: 'Al-Mujadila', ayah: '58:3-4', topic: 'Zihar expiation',             summary: 'Sets out the sequential expiation required for zihar: freeing a slave, or fasting two consecutive months, or feeding sixty poor people.' },
  { id: 'Q013', surah: 'An-Nisa',     ayah: '4:92',   topic: 'Accidental killing expiation', summary: "Prescribes freeing a believing slave or, if unable, fasting two consecutive months as atonement, alongside blood money owed to the victim\u2019s family." },
]

// ============================================================================
// 13 — Madhhab Opinions
// ============================================================================
interface MadhhabRow {
  id: string
  questionGroup: string
  question: string
  madhhab: string
  position: string
  sourceRef: string
}
const MADHHAB_RAW: MadhhabRow[] = [
  { id: 'MAD001',    questionGroup: 'G01', question: 'Observance of Ashura',                                    madhhab: 'Sunni (all 4 schools)',     position: 'Ashura is a recommended (Sunnah Muakkadah) voluntary fast commemorating Musa\u2019s deliverance from Pharaoh; best paired with the 9th and/or 11th.', sourceRef: 'See MU001\u2013MU009' },
  { id: 'MAD002',    questionGroup: 'G01', question: 'Observance of Ashura',                                    madhhab: 'Shia',                      position: 'Ashura centers on mourning the martyrdom of Husayn ibn Ali at Karbala; fasting on this specific day has generally been discouraged or considered impermissible in mainstream Shia practice, a fundamentally different emphasis from the Sunni fasting-based commemoration.', sourceRef: 'See MU010' },
  { id: 'MAD003',    questionGroup: 'G02', question: 'Niyyah for the Ramadan fast — timing',                    madhhab: 'Maliki',                    position: 'A single intention made at the start of Ramadan is sufficient to cover the entire month; it need not be renewed nightly.', sourceRef: 'See RM010' },
  { id: 'MAD004a',   questionGroup: 'G02', question: 'Niyyah for the Ramadan fast — timing',                    madhhab: 'Hanafi, Shafi\u02bei, Hanbali', position: 'The intention should be renewed for each individual day of the fast, made before Fajr each night.', sourceRef: 'See RM010' },
  { id: 'MAD004',    questionGroup: 'G03', question: 'Should a pilgrim at Arafat fast on the Day of Arafah?',   madhhab: 'Shafi\u02bei',                position: 'Mustahabb (recommended) for the pilgrim present at Arafat NOT to fast, based on the hadith of Umm al-Fadl and to preserve strength for du\u2019a.', sourceRef: 'See DH005, H049, H050' },
  { id: 'MAD004b',   questionGroup: 'G03', question: 'Should a pilgrim at Arafat fast on the Day of Arafah?',   madhhab: 'Maliki, Hanbali',            position: "Concur with the Shafi\u02bei position that it is not recommended for the pilgrim to fast, prioritizing the once-in-a-lifetime standing and supplication over the fast\u2019s reward, which is attainable in future years.", sourceRef: 'See DH007' },
  { id: 'MAD004c',   questionGroup: 'G03', question: 'Should a pilgrim at Arafat fast on the Day of Arafah?',   madhhab: 'Hanafi',                    position: "A pilgrim MAY fast on Arafah if it will not weaken them for the day\u2019s worship; if it would weaken them, it becomes disliked (makruh) rather than simply neutral.", sourceRef: 'See DH008' },
  { id: 'MAD005',    questionGroup: 'G04', question: 'Pregnant/nursing woman who breaks her fast — qada vs fidyah', madhhab: 'Hanafi',                  position: "Only qada (making up the fast) is obligatory; paying fidyah is Sunnah (recommended) but not required, regardless of whether the concern is for her own health or the child\u2019s.", sourceRef: 'See RM037, QK018' },
  { id: 'MAD006',    questionGroup: 'G04', question: 'Pregnant/nursing woman who breaks her fast — qada vs fidyah', madhhab: 'Shafi\u02bei, Hanbali',         position: 'Both qada AND fidyah are obligatory if she feared for the health of the fetus/nursing child specifically; if she feared only for her own health (or for both herself and the child), only qada is required, without fidyah.', sourceRef: 'See RM037, QK018' },
  { id: 'MAD006b',   questionGroup: 'G04', question: 'Pregnant/nursing woman who breaks her fast — qada vs fidyah', madhhab: 'Maliki',                  position: 'Distinguishes pregnancy from nursing: a nursing mother who breaks her fast owes both qada and fidyah; a pregnant woman owes qada only, without fidyah.', sourceRef: 'See RM037, QK018' },
  { id: 'MAD007',    questionGroup: 'G05', question: 'Combining the Shawwal fast intention with making up missed Ramadan days', madhhab: 'Shafi\u02bei',     position: "Two views exist within the school; the stronger conclusion permits combining both intentions in a single fast, by analogy to combining obligatory ghusl with the Sunnah Friday ghusl — though the full individual Shawwal reward is somewhat reduced compared to a standalone Shawwal-only intention.", sourceRef: 'See SW007, SW009, H047' },
  { id: 'MAD008',    questionGroup: 'G05', question: 'Combining the Shawwal fast intention with making up missed Ramadan days', madhhab: 'Hanafi, Maliki, Hanbali (general)', position: "Each is treated as a distinct, separate act of worship (one obligatory, one voluntary) requiring its own independent intention; combining them into a single fast with one intention is not correct, since the Shawwal hadith presupposes Ramadan has already been completed.", sourceRef: 'See SW008' },
  { id: 'MAD009',    questionGroup: 'G06', question: 'Should the Six Days of Shawwal be fasted consecutively?', madhhab: "Shafi\u02bei (Imam Nawawi's preference)", position: "Preferred to fast the six days consecutively immediately after Eid al-Fitr, citing the virtue of hastening to do good deeds.", sourceRef: 'See SW004' },
  { id: 'MAD010',    questionGroup: 'G06', question: 'Should the Six Days of Shawwal be fasted consecutively?', madhhab: 'Hanafi, Hanbali',           position: "No difference between fasting consecutively or spread throughout the month, since the hadith specifying consecutive fasting is considered excessively weak by these scholars; however, delaying to the point of risking missing the days entirely should be avoided.", sourceRef: 'See SW003' },
  { id: 'MAD011',    questionGroup: 'G07', question: 'Is it disliked to begin a new fast after mid-Sha\u2019ban?', madhhab: 'Majority (across schools)', position: "The prohibition in the 'do not fast after mid-Sha\u2019ban' hadith applies specifically to someone STARTING a new voluntary fasting habit after the midpoint without any prior connection to earlier fasting days; it does not apply to someone continuing an already-established pattern (e.g. regular Monday/Thursday fasting, or making up missed Ramadan days).", sourceRef: 'See SH008, H043' },
  { id: 'MAD011b',   questionGroup: 'G07', question: 'Is it disliked to begin a new fast after mid-Sha\u2019ban?', madhhab: 'Minority scholarly position', position: "Some scholars treat the hadith\u2019s authenticity as sufficiently disputed (da\u2019if) that they do not apply the restriction at all, permitting voluntary fasting throughout all of Sha\u2019ban without distinction.", sourceRef: 'See H043' },
  { id: 'MAD012',    questionGroup: 'G08', question: 'Does the 15th night of Sha\u2019ban (Nisfu Sha\u2019ban) carry unique, specific virtue?', madhhab: 'Broad scholarly consensus', position: "No authentic hadith establishes a specific prescribed prayer, ritual, or fixed virtue uniquely for this night beyond the general White Days (13th\u201315th) fasting recommendation that applies to every Hijri month; narrations claiming special Nisfu Sha\u2019ban virtue are generally weak or fabricated.", sourceRef: 'See SH010, SH011, H044, H045' },
  { id: 'MAD012b',   questionGroup: 'G08', question: 'Does the 15th night of Sha\u2019ban (Nisfu Sha\u2019ban) carry unique, specific virtue?', madhhab: 'Popular/cultural practice', position: "Widespread popular tradition across many Muslim cultures continues to treat this night with special significance for mercy, forgiveness, and reflection, despite the weak evidentiary basis — scholars generally do not consider engaging in extra worship on this night itself problematic, only the attribution of specific fixed rituals or numeric rewards to it.", sourceRef: 'See SH010, SH011' },
  { id: 'MAD013',    questionGroup: 'G09', question: 'Should non-pilgrims time their Arafah fast by local moon-sighting or by the Hajj authorities\u2019 declared Day of Arafah?', madhhab: 'View A (contested, gaining traction)', position: "Non-pilgrims should fast on the actual day pilgrims are standing at Arafat (as determined by Saudi/Hajj authorities), since the fast is intrinsically linked to that specific historical/geographic event, not merely to a calendar position.", sourceRef: 'See DH010' },
  { id: 'MAD013b',   questionGroup: 'G09', question: 'Should non-pilgrims time their Arafah fast by local moon-sighting or by the Hajj authorities\u2019 declared Day of Arafah?', madhhab: 'View B (traditional majority practice)', position: "Each locality should fast according to its own local moon-sighting-determined 9th of Dhul Hijjah, consistent with the general principle that each region follows its own sighting for all Hijri-calendar-based worship.", sourceRef: 'See DH010, DH011' },
  { id: 'MAD014',    questionGroup: 'G10', question: 'Is fidyah owed in addition to qada if makeup fasts are delayed without excuse past the next Ramadan?', madhhab: 'Maliki, Shafi\u02bei, Hanbali', position: 'Yes — delaying qada without valid excuse until the following Ramadan arrives adds a fidyah obligation on top of the still-required qada.', sourceRef: 'See QK004' },
  { id: 'MAD014b',   questionGroup: 'G10', question: 'Is fidyah owed in addition to qada if makeup fasts are delayed without excuse past the next Ramadan?', madhhab: 'Hanafi', position: 'No additional fidyah penalty is imposed purely for the delay; only the original qada remains owed, regardless of how long it is delayed.', sourceRef: 'See QK005' },
  { id: 'MAD015',    questionGroup: 'G11', question: 'Is the Ramadan-violation kaffarah (free a slave / fast 60 days / feed 60 poor) a strict sequence or a free choice?', madhhab: 'Hanafi, Shafi\u02bei, Hanbali', position: 'The three options are strictly sequential — a person must genuinely be unable to fulfil the first before moving to the second, and unable to fulfil the second before moving to the third.', sourceRef: 'See QK008' },
  { id: 'MAD015b',   questionGroup: 'G11', question: 'Is the Ramadan-violation kaffarah (free a slave / fast 60 days / feed 60 poor) a strict sequence or a free choice?', madhhab: 'Maliki', position: 'Treats the three options more as a free choice available to the person from the outset, rather than a mandatory sequence that must be attempted in strict order.', sourceRef: 'See QK008' },
  { id: 'MAD016',    questionGroup: 'G12', question: 'Does deliberate eating or drinking (without excuse) trigger the same severe 60-day/60-person kaffarah as intercourse?', madhhab: 'Hanafi, Hanbali', position: 'Yes — by analogy to intercourse, deliberate eating or drinking without excuse during an obligatory Ramadan fast also triggers the full sequential kaffarah.', sourceRef: 'See QK010' },
  { id: 'MAD016b',   questionGroup: 'G12', question: 'Does deliberate eating or drinking (without excuse) trigger the same severe 60-day/60-person kaffarah as intercourse?', madhhab: 'Shafi\u02bei, some Maliki views', position: 'The severe kaffarah is restricted specifically to intercourse; deliberate eating or drinking without excuse requires only qada plus sincere repentance (tawbah), not the full 60-day/60-person expiation.', sourceRef: 'See QK010' },
  { id: 'MAD017',    questionGroup: 'G13', question: 'Is fidyah for the permanently unable (chronically ill, elderly) strictly obligatory (wajib) or merely recommended (mustahabb)?', madhhab: 'Hanafi, Maliki, Shafi\u02bei', position: 'Fidyah in this case is wajib (obligatory) — the person who cannot ever expect to fast again must pay fidyah for each missed day.', sourceRef: 'See QK017' },
  { id: 'MAD017b',   questionGroup: 'G13', question: 'Is fidyah for the permanently unable (chronically ill, elderly) strictly obligatory (wajib) or merely recommended (mustahabb)?', madhhab: 'Hanbali', position: 'Uniquely among the four schools, fidyah in this specific case is considered mustahabb (recommended) rather than strictly wajib (obligatory).', sourceRef: 'See QK017' },
  { id: 'MAD018',    questionGroup: 'G14', question: 'Must fidyah be given as actual food, or can its cash monetary value be given instead?', madhhab: 'Shafi\u02bei', position: 'The actual food itself (one mudd of the local staple) must be given; the monetary value is not an acceptable substitute.', sourceRef: 'See QK015' },
  { id: 'MAD018b',   questionGroup: 'G14', question: 'Must fidyah be given as actual food, or can its cash monetary value be given instead?', madhhab: 'Hanafi', position: 'The monetary cash equivalent of the required food amount is explicitly permitted as an alternative to giving the food itself, offering greater practical flexibility.', sourceRef: 'See QK016' },
  { id: 'MAD019',    questionGroup: 'G15', question: 'Does a person who travels constantly (e.g. a professional driver) retain the traveler\u2019s fasting concession?', madhhab: 'Shafi\u02bei', position: "Adds a specific condition that the traveler should not be someone who travels habitually/continuously as their normal way of life; such a person is not entitled to the standard travel concession in the same way an occasional traveler is.", sourceRef: 'See RM031' },
  { id: 'MAD019b',   questionGroup: 'G15', question: 'Does a person who travels constantly (e.g. a professional driver) retain the traveler\u2019s fasting concession?', madhhab: 'Hanafi, Hanbali, Maliki', position: "The general travel concession applies based on the objective distance and conditions of a given journey, without a specific added exception for habitual travelers as a category.", sourceRef: 'See RM031' },
  { id: 'MAD020',    questionGroup: 'G16', question: 'Does deliberately inhaling smoke (e.g. tobacco) invalidate the fast?', madhhab: 'Shafi\u02bei', position: 'Deliberately inhaled smoke, such as tobacco, invalidates the fast, distinct from incidental smoke exposure (e.g. from cooking) which does not.', sourceRef: 'See RM026' },
  { id: 'MAD020b',   questionGroup: 'G16', question: 'Does deliberately inhaling smoke (e.g. tobacco) invalidate the fast?', madhhab: 'Contemporary cross-madhhab consensus', position: "Most contemporary scholars across schools now classify deliberate smoking as invalidating the fast, reasoning by analogy that inhaled smoke reaching the throat/lungs functions similarly to swallowed substances, alongside separate rulings that smoking itself is discouraged or prohibited on health grounds independent of fasting.", sourceRef: 'See RM026' },
  { id: 'MAD021',    questionGroup: 'G17', question: 'Do rectal/vaginal suppositories invalidate the fast?', madhhab: 'Hanafi', position: 'Suppositories reach the internal body cavity and are therefore classified as invalidating the fast, requiring qada.', sourceRef: 'See RM027' },
  { id: 'MAD021b',   questionGroup: 'G17', question: 'Do rectal/vaginal suppositories invalidate the fast?', madhhab: 'Some contemporary Shafi\u02bei/Hanbali views', position: 'Some contemporary scholars distinguish based on whether the substance reaches the stomach and provides nourishment versus being purely localized treatment, treating some non-nutritive suppositories more leniently than the strict Hanafi position.', sourceRef: 'See RM027' },
]

// ============================================================================
// Group knowledge into the universal KnowledgeTopic shape per category
// ============================================================================
function annualTopics(): KnowledgeTopic[] {
  return ANNUAL_RAW.map((r) => ({
    id: r.id,
    title: r.occasionName,
    arabic: r.arabic,
    category: r.category,
    ruling: parseRuling(r.category),
    categoryId: 'annual',
    meta: `${r.hijriDays} ${HIJRI_MONTHS[r.hijriMonth - 1] ?? ''} · ${r.duration}`,
    why: r.why,
    virtue: r.virtue,
    rulingDetail: r.rulingDetail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
    madhhabNote: r.madhhabNote,
  }))
}

function weeklyTopics(): KnowledgeTopic[] {
  return WEEKLY_RAW.map((r) => ({
    id: r.id,
    title: r.name,
    arabic: r.arabic,
    category: r.category,
    ruling: parseRuling(r.category),
    categoryId: 'weekly',
    meta: r.dayRule,
    why: r.why,
    virtue: r.virtue,
    rulingDetail: r.rulingDetail,
    variantNote: r.variantNote,
    narrator: r.narrator,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function whiteTopics(): KnowledgeTopic[] {
  return WHITE_RAW.map((r) => ({
    id: r.id,
    title: r.name,
    arabic: r.arabic,
    category: r.category,
    ruling: parseRuling(r.category),
    categoryId: 'white',
    meta: `${r.hijriDayRule} · ${r.recurrence}`,
    why: r.why,
    virtue: r.virtue,
    rulingDetail: r.rulingDetail,
    variantNote: r.narrator,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function ramadanTopics(): KnowledgeTopic[] {
  return RAMADAN_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.ruling,
    ruling: parseRuling(r.ruling),
    categoryId: 'ramadan',
    meta: r.topicGroup,
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function muharramTopics(): KnowledgeTopic[] {
  return MUHARRAM_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.ruling,
    ruling: parseRuling(r.ruling),
    categoryId: 'muharram',
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function shabanTopics(): KnowledgeTopic[] {
  return SHABAN_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.ruling,
    ruling: parseRuling(r.ruling),
    categoryId: 'shaban',
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function shawwalTopics(): KnowledgeTopic[] {
  return SHAWWAL_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.ruling,
    ruling: parseRuling(r.ruling),
    categoryId: 'shawwal',
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function dhulHijjahTopics(): KnowledgeTopic[] {
  return DHULHIJJAH_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.ruling,
    ruling: parseRuling(r.ruling),
    categoryId: 'dhulhijjah',
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function forbiddenTopics(): KnowledgeTopic[] {
  return FORBIDDEN_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.category,
    ruling: parseRuling(r.category),
    categoryId: 'forbidden',
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function qadaTopics(): KnowledgeTopic[] {
  return QADA_RAW.map((r) => ({
    id: r.id,
    title: r.topic,
    category: r.category,
    ruling: parseRuling(r.ruling),
    categoryId: 'qada',
    meta: r.category,
    rulingDetail: r.detail,
    hadithRef: r.hadithRef,
    quranRef: r.quranRef,
  }))
}

function hadithTopics(): KnowledgeTopic[] {
  return HADITH_RAW.map((r) => ({
    id: r.id,
    title: `${r.collection} — ${r.referenceNumber}`,
    category: r.grade,
    ruling: r.grade.toLowerCase().includes('sahih')
      ? 'sunnah'
      : r.grade.toLowerCase().includes('da\u2019if') || r.grade.toLowerCase().includes('weak')
      ? 'contested'
      : r.grade.toLowerCase().includes('hasan')
      ? 'sunnah_muakkadah'
      : 'sunnah',
    categoryId: 'hadiths',
    meta: r.topicTag,
    narrator: r.narrator,
    collection: r.collection,
    referenceNumber: r.referenceNumber,
    grade: r.grade,
    summary: r.summary,
  }))
}

function quranTopics(): KnowledgeTopic[] {
  return QURAN_RAW.map((r) => ({
    id: r.id,
    title: `${r.surah} ${r.ayah}`,
    arabic: null,
    category: r.topic,
    ruling: 'fard',
    categoryId: 'quran',
    meta: r.topic,
    surah: r.surah,
    ayah: r.ayah,
    summary: r.summary,
  }))
}

function madhhabTopics(): KnowledgeTopic[] {
  return MADHHAB_RAW.map((r) => ({
    id: r.id,
    title: `${r.questionGroup} — ${r.question}`,
    category: r.madhhab,
    ruling: 'contested',
    categoryId: 'madhhabs',
    questionGroup: r.questionGroup,
    question: r.question,
    madhhab: r.madhhab,
    position: r.position,
    sources: r.sourceRef,
  }))
}

const HIJRI_MONTHS = [
  'Muharram', "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
]

// All topics grouped by category
export const TOPICS_BY_CATEGORY: Record<KnowledgeCategoryId, KnowledgeTopic[]> = {
  annual:      annualTopics(),
  weekly:      weeklyTopics(),
  white:       whiteTopics(),
  ramadan:     ramadanTopics(),
  muharram:    muharramTopics(),
  shaban:      shabanTopics(),
  shawwal:     shawwalTopics(),
  dhulhijjah:  dhulHijjahTopics(),
  forbidden:   forbiddenTopics(),
  qada:        qadaTopics(),
  hadiths:     hadithTopics(),
  quran:       quranTopics(),
  madhhabs:    madhhabTopics(),
}

export const ALL_TOPICS: KnowledgeTopic[] = KNOWLEDGE_CATEGORIES.flatMap(
  (c) => TOPICS_BY_CATEGORY[c.id]
)

// ============================================================================
// Lookup maps: Hadith, Qur'an, Madhhab groups
// ============================================================================
export const HADITH_INDEX: Record<string, HadithIndexRow> = Object.fromEntries(
  HADITH_RAW.map((h) => [h.id, h])
)
export const QURAN_REFS: Record<string, QuranIndexRow> = Object.fromEntries(
  QURAN_RAW.map((q) => [q.id, q])
)
export const MADHHAB_GROUPS: Record<string, MadhhabRow[]> = (() => {
  const map: Record<string, MadhhabRow[]> = {}
  for (const m of MADHHAB_RAW) {
    if (!map[m.questionGroup]) map[m.questionGroup] = []
    map[m.questionGroup].push(m)
  }
  return map
})()

// Parse a ref string like "H007, H025" or "H001" into codes
export function parseRefCodes(ref: string | null | undefined, prefix: 'H' | 'Q' | 'MAD'): string[] {
  if (!ref) return []
  const out: string[] = []
  const pattern = new RegExp(`\\b${prefix}\\d{3}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = pattern.exec(ref)) !== null) {
    out.push(m[0])
  }
  return out
}

// ============================================================================
// Helpers: get category meta by id
// ============================================================================
export function getCategoryMeta(id: KnowledgeCategoryId): KnowledgeCategory {
  const found = KNOWLEDGE_CATEGORIES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown knowledge category: ${id}`)
  return found
}

// ============================================================================
// Calendar lookup: occasions for a specific Hijri (month, day)
// ============================================================================
// Many knowledge rows carry a Hijri (month, day) coordinate. This helper
// walks the relevant sheets and returns the matching occasions, deduped,
// and limited to the most relevant row per source.
export function getOccasionsForHijriDay(
  hijriMonth: number,
  hijriDay: number
): KnowledgeTopic[] {
  const matches: KnowledgeTopic[] = []
  const seen = new Set<string>()

  const push = (t: KnowledgeTopic) => {
    if (seen.has(t.id)) return
    seen.add(t.id)
    matches.push(t)
  }

  // Annual occasions (sheet 01)
  for (const r of ANNUAL_RAW) {
    if (r.hijriMonth !== hijriMonth) continue
    // hijriDays may be "1 to 29/30", "1-9", "9", "2-29/30 (any 6 days)", "11, 12, 13", "15 (and preceding night)", etc.
    if (matchesDay(r.hijriDays, hijriDay)) {
      push(annualTopics().find((t) => t.id === r.id)!)
    }
  }

  // White Days (sheet 03)
  for (const r of WHITE_RAW) {
    if (matchesDay(r.hijriDayRule, hijriDay)) {
      push(whiteTopics().find((t) => t.id === r.id)!)
    }
  }

  // Forbidden fasts (sheet 09) — Eid / Tashreeq / Nisfu Sha'ban
  for (const r of FORBIDDEN_RAW) {
    if (r.id === 'FD001' && hijriMonth === 10 && hijriDay === 1) {
      push(forbiddenTopics().find((t) => t.id === r.id)!)
    } else if (r.id === 'FD002' && hijriMonth === 12 && hijriDay === 10) {
      push(forbiddenTopics().find((t) => t.id === r.id)!)
    } else if (r.id === 'FD003' && hijriMonth === 12 && hijriDay >= 11 && hijriDay <= 13) {
      push(forbiddenTopics().find((t) => t.id === r.id)!)
    }
  }

  // Ramadan (sheet 04) — any day in Hijri month 9
  if (hijriMonth === 9) {
    for (const r of RAMADAN_RAW) {
      // Skip non-conditions sub-rows; surface the headline ones that match
      // the day of Ramadan.
      if (
        r.id === 'RM001' || // Ramadan is Fard
        r.id === 'RM008' || // Niyyah
        r.id === 'RM043' || // Suhoor
        r.id === 'RM044' || // Delaying suhoor
        r.id === 'RM045' || // Hastening iftar
        r.id === 'RM046' || // Dates for iftar
        r.id === 'RM047' || // Guarding speech
        r.id === 'RM048' || // Increased Quran recitation
        r.id === 'RM049'    // Increased charity
      ) {
        if (hijriDay <= 29) {
          push(ramadanTopics().find((t) => t.id === r.id)!)
        }
      }
      // Laylat al-Qadr — last ten nights (any of days 21-30)
      if (
        (r.id === 'RM050' || r.id === 'RM051' || r.id === 'RM052' || r.id === 'RM053') &&
        hijriDay >= 21 && hijriDay <= 30
      ) {
        push(ramadanTopics().find((t) => t.id === r.id)!)
      }
    }
  }

  // Dhul Hijjah (sheet 08) — first 9 days, Arafah, Tashreeq
  if (hijriMonth === 12) {
    for (const r of DHULHIJJAH_RAW) {
      // First 9 days
      if (hijriDay >= 1 && hijriDay <= 9 && r.id === 'DH001') {
        push(dhulHijjahTopics().find((t) => t.id === r.id)!)
      }
      // Day 9 = Arafah
      if (hijriDay === 9 && (r.id === 'DH004' || r.id === 'DH005' || r.id === 'DH006' || r.id === 'DH007' || r.id === 'DH008' || r.id === 'DH009' || r.id === 'DH010' || r.id === 'DH011' || r.id === 'DH012' || r.id === 'DH013')) {
        push(dhulHijjahTopics().find((t) => t.id === r.id)!)
      }
      // Days 11-13 = Tashreeq
      if (hijriDay >= 11 && hijriDay <= 13 && (r.id === 'DH014' || r.id === 'DH015' || r.id === 'DH016' || r.id === 'DH017')) {
        push(dhulHijjahTopics().find((t) => t.id === r.id)!)
      }
    }
  }

  // Muharram (sheet 05) — Ashura / Tasua / general
  if (hijriMonth === 1) {
    for (const r of MUHARRAM_RAW) {
      if (hijriDay === 9 && r.id === 'MU005') {
        push(muharramTopics().find((t) => t.id === r.id)!)
      }
      if (hijriDay === 10 && (r.id === 'MU001' || r.id === 'MU002' || r.id === 'MU004' || r.id === 'MU006' || r.id === 'MU007' || r.id === 'MU008' || r.id === 'MU009' || r.id === 'MU010')) {
        push(muharramTopics().find((t) => t.id === r.id)!)
      }
    }
  }

  // Sha'ban — Nisfu Sha'ban (15th)
  if (hijriMonth === 8 && hijriDay === 15) {
    push(shabanTopics().find((t) => t.id === 'SH010')!)
    push(shabanTopics().find((t) => t.id === 'SH011')!)
  }

  // Shawwal — 6 days + Eid al-Fitr (covered above)
  if (hijriMonth === 10 && hijriDay >= 2) {
    push(shawwalTopics().find((t) => t.id === 'SW001')!)
  }

  return matches
}

// Parse "1 to 29/30", "1-9", "9", "2-29/30 (any 6 days)", "11, 12, 13", etc.
function matchesDay(rule: string, day: number): boolean {
  const s = rule.toLowerCase()
  // Comma-separated list: "11, 12, 13"
  if (s.includes(',')) {
    const parts = s.split(',').map((p) => Number(p.trim().split(/\s+/)[0]))
    return parts.includes(day)
  }
  // Range: "1-9", "11-13", "2-29/30"
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) {
    const lo = Number(range[1])
    const hi = Number(range[2].split('/')[0])
    return day >= lo && day <= hi
  }
  // Range with "to": "1 to 29/30"
  const toRange = s.match(/(\d+)\s+to\s+(\d+)/)
  if (toRange) {
    const lo = Number(toRange[1])
    const hi = Number(toRange[2].split('/')[0])
    return day >= lo && day <= hi
  }
  // Single number: "9", "10"
  const num = Number(s)
  if (!Number.isNaN(num)) return num === day
  return false
}

// ============================================================================
// Color helpers
// ============================================================================
export function gradeColor(grade: string | null | undefined): string {
  if (!grade) return '#d4a017'
  const g = grade.toLowerCase()
  if (g.includes('sahih') && !g.includes('da\u2019if')) return '#10b981' // emerald
  if (g.includes('hasan')) return '#0891b2' // cyan
  if (g.includes('da\u2019if') || g.includes('weak')) return '#dc2626' // red
  if (g.includes('disputed')) return '#d97706' // amber
  if (g.includes('scholarly opinion') || g.includes('fatwa')) return '#a855f7' // purple
  return '#d4a017' // gold default
}
