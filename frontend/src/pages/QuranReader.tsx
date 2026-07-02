import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, BookOpen, Share2, Bookmark, AlertCircle, Loader,
} from 'lucide-react'
import { quranService, type Surah, type SurahWithAyahs } from '../services/quranService'
import { GoldDivider } from '../components/IslamicOrnamentBG'

/* ============================================================================
 *  Quran Reader — deep-emerald edition
 * ----------------------------------------------------------------------------
 *  Visual language matches Dashboard / PrayerTracker:
 *   • Deep emerald page background (inherited from body)
 *   • Dark translucent cards (rgba 255/255/255/0.04) with gold borders
 *   • Gold leaf accents (--gold-mid → --gold-light → --gold-glow)
 *   • Manuscript cream text (--manuscript-cream)
 * ========================================================================= */

export const QuranReader: React.FC = () => {
  const [currentSurah, setCurrentSurah] = useState<number>(1)
  const [currentAyah, setCurrentAyah] = useState<number>(1)
  const [fontSize, setFontSize] = useState<number>(28)
  const [showSurahList, setShowSurahList] = useState<boolean>(false)
  const [ayahPage, setAyahPage] = useState<number>(0) // 0-based page index

  // ---- Real data from AlQuran.cloud via our backend ----
  const surahsQuery = useQuery<Surah[]>({
    queryKey: ['quran-surahs'],
    queryFn: () => quranService.getSurahs(),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const surahQuery = useQuery<SurahWithAyahs>({
    queryKey: ['quran-surah', currentSurah],
    queryFn: () => quranService.getSurahAyahs(currentSurah),
    staleTime: 24 * 60 * 60 * 1000,
  })

  // ---- Bookmark state ----
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string>>(new Set())

  const surahs = surahsQuery.data ?? []
  const surah = surahQuery.data
  const ayahs = surah?.ayahs ?? []

  // ---- Pagination: 7 ayahs per page ----
  const AYAHS_PER_PAGE = 7
  const totalPages = Math.max(1, Math.ceil(ayahs.length / AYAHS_PER_PAGE))
  const safePage = Math.min(ayahPage, totalPages - 1)
  const pageStart = safePage * AYAHS_PER_PAGE
  const pageEnd = Math.min(pageStart + AYAHS_PER_PAGE, ayahs.length)
  const pageAyahs = ayahs.slice(pageStart, pageEnd)

  const handleSurahChange = (surahNumber: number) => {
    setCurrentSurah(surahNumber)
    setCurrentAyah(1)
    setAyahPage(0)
    setShowSurahList(false)
  }

  const handleShare = async () => {
    const text = `${surah?.english_name ?? 'Quran'} — Surah ${currentSurah}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Islamic Life Companion', text })
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  // ---- Shared styles (dark translucent + gold, matching dashboard) ----
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--gold-mid, #d4a017)',
    borderRadius: '1rem',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -16px rgba(0,0,0,0.5)',
    color: 'var(--manuscript-cream, #fbf3df)',
  }

  const pillBase: React.CSSProperties = {
    padding: '0.5rem 0.875rem',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--manuscript-cream, #fbf3df)',
    border: '1px solid var(--gold-mid, #d4a017)',
    transition: 'all 0.15s',
    cursor: 'pointer',
  }

  const navButtonBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--manuscript-cream, #fbf3df)',
    border: '1px solid var(--gold-mid, #d4a017)',
    borderRadius: '0.75rem',
    padding: '0.5rem 1.25rem',
    fontWeight: 600,
    transition: 'all 0.15s',
    cursor: 'pointer',
  }

  const navButtonGold: React.CSSProperties = {
    ...navButtonBase,
    background:
      'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
    color: 'var(--emerald-deep, #064e3b)',
    border: '1px solid var(--gold-deep, #9a6b0e)',
  }

  if (surahsQuery.isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div style={{ ...cardStyle, padding: '1.5rem' }} className="flex items-center gap-2">
          <AlertCircle size={20} style={{ color: 'var(--missed, #e44244)' }} />
          <span style={{ color: 'var(--missed, #e44244)' }}>
            Failed to load the Quran. Please refresh the page.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 mb-6 mt-1">
        <div className="flex items-end gap-3 min-w-0">
          <span className="shrink-0 mb-1" style={{ color: 'var(--gold-mid, #d4a017)' }}>
            <BookOpen size={26} />
          </span>
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide leading-tight"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textShadow: '0 1px 0 rgba(0,0,0,0.45)',
              }}
            >
              Quran Reader
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.7 }}>
              Read, reflect, and bookmark your journey through the Book of Allah
            </p>
          </div>
          <span
            className="hidden sm:block flex-1 h-px mb-2 min-w-[40px]"
            style={{
              background:
                'linear-gradient(90deg, var(--gold-mid, #d4a017) 0%, transparent 80%)',
            }}
            aria-hidden
          />
        </div>
      </header>

      {/* ── Surah selector ──────────────────────────────────────────── */}
      <div className="relative mb-6">
        <div style={{ ...cardStyle, padding: 0, position: 'relative' }}>
          <div
            className="absolute top-0 left-6 right-6 h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(90deg, var(--gold-deep, #9a6b0e) 0%, var(--gold-mid, #d4a017) 25%, var(--gold-light, #f0c75e) 50%, var(--gold-mid, #d4a017) 75%, var(--gold-deep, #9a6b0e) 100%)',
            }}
          />
          <button
            onClick={() => setShowSurahList((v) => !v)}
            disabled={surahsQuery.isLoading}
            className="w-full p-4 text-left font-semibold flex justify-between items-center disabled:opacity-60"
            style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
          >
            {surahsQuery.isLoading ? (
              <span className="flex items-center gap-2">
                <Loader size={16} className="animate-spin" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Loading Surahs…
              </span>
            ) : (
              <>
                <span
                  className="text-lg"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: 'var(--gold-light, #f0c75e)' }}
                >
                  {surah?.english_name ?? surahs[currentSurah - 1]?.englishName}
                  <span style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.6 }} className="ml-2 text-sm">
                    ({currentSurah})
                  </span>
                </span>
                <span
                  className="text-sm px-3 py-1 rounded-lg"
                  style={{
                    color: 'var(--gold-deep, #9a6b0e)',
                    background:
                      'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
                    fontWeight: 600,
                  }}
                >
                  {surah?.number_of_ayahs ?? surahs[currentSurah - 1]?.numberOfAyahs} Ayahs
                </span>
              </>
            )}
          </button>
        </div>

        {showSurahList && (
          <div className="mt-2 max-h-96 overflow-y-auto z-20" style={{ ...cardStyle, padding: '0.5rem 0' }}>
            {surahs.map((s) => {
              const isActive = currentSurah === s.number
              return (
                <button
                  key={s.number}
                  onClick={() => handleSurahChange(s.number)}
                  className="w-full p-3 text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(212, 160, 23, 0.12)' : 'transparent',
                    color: 'var(--manuscript-cream, #fbf3df)',
                    borderBottom: '1px solid rgba(212, 160, 23, 0.15)',
                  }}
                >
                  <div className="flex justify-between items-center px-3">
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        color: isActive ? 'var(--gold-light, #f0c75e)' : 'var(--manuscript-cream, #fbf3df)',
                      }}
                    >
                      {s.number}. {s.englishName}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--gold-mid, #d4a017)' }}>
                      {s.numberOfAyahs}
                    </span>
                  </div>
                  <div className="text-xs px-3 mt-0.5" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.55 }}>
                    {s.revelationType} · {s.englishNameTranslation}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Main reading area — all ayahs ──────────────────────────── */}
      <div style={{ ...cardStyle, padding: '2rem 1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
        <div
          className="absolute top-0 left-6 right-6 h-[2px] rounded-full"
          style={{
            background:
              'linear-gradient(90deg, var(--gold-deep, #9a6b0e) 0%, var(--gold-mid, #d4a017) 25%, var(--gold-light, #f0c75e) 50%, var(--gold-mid, #d4a017) 75%, var(--gold-deep, #9a6b0e) 100%)',
          }}
        />
        {surahQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader size={32} className="animate-spin" style={{ color: 'var(--gold-mid, #d4a017)' }} />
          </div>
        ) : surahQuery.isError ? (
          <div className="text-center py-12" style={{ color: 'var(--missed, #e44244)' }}>
            Failed to load Surah.
          </div>
        ) : ayahs.length > 0 ? (
          <>
            {/* Surah title banner */}
            <div className="text-center mb-6">
              <div
                className="text-xs uppercase tracking-[0.18em] font-semibold mb-2"
                style={{ color: 'var(--gold-mid, #d4a017)' }}
              >
                Surah {currentSurah}
              </div>
              <h2
                className="text-2xl font-bold"
                style={{
                  color: 'var(--gold-light, #f0c75e)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {surah?.english_name}
              </h2>
              {surah?.revelation_type && (
                <p className="text-xs mt-1" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.55 }}>
                  {surah.revelation_type === 'Meccan' ? 'Meccan' : 'Medinan'} · {ayahs.length} Ayahs
                </p>
              )}
              <GoldDivider className="my-4" />
            </div>

            {/* Ayahs listed (7 per page) */}
            <div className="space-y-6">
              {pageAyahs.map((ayah) => {
                const aKey = `${currentSurah}:${ayah.numberInSurah}`
                const aBookmarked = bookmarkedKeys.has(aKey)
                return (
                  <div
                    key={ayah.number}
                    id={`ayah-${ayah.numberInSurah}`}
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: ayah.numberInSurah === currentAyah
                        ? 'rgba(212, 160, 23, 0.08)'
                        : 'transparent',
                      border: ayah.numberInSurah === currentAyah
                        ? '1px solid rgba(212, 160, 23, 0.25)'
                        : '1px solid transparent',
                    }}
                  >
                    {/* Ayah number badge + bookmark */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="flex items-center justify-center text-xs font-bold rounded-full"
                        style={{
                          width: 28,
                          height: 28,
                          background:
                            'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
                          color: 'var(--emerald-deep, #064e3b)',
                        }}
                      >
                        {ayah.numberInSurah}
                      </span>
                      <button
                        onClick={() =>
                          setBookmarkedKeys((prev) => {
                            const next = new Set(prev)
                            if (next.has(aKey)) next.delete(aKey)
                            else next.add(aKey)
                            return next
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: aBookmarked
                            ? 'var(--gold-light, #f0c75e)'
                            : 'var(--manuscript-cream, #fbf3df)',
                          opacity: aBookmarked ? 1 : 0.4,
                          padding: 4,
                        }}
                      >
                        <Bookmark size={14} fill={aBookmarked ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Arabic text */}
                    <div
                      className="leading-loose mb-4"
                      dir="rtl"
                      style={{
                        fontFamily: 'Amiri, "Scheherazade New", "Traditional Arabic", serif',
                        fontSize: `${fontSize}px`,
                        color: 'var(--manuscript-cream, #fbf3df)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {ayah.text}
                    </div>

                    {/* English translation */}
                    {ayah.translation && (
                      <div
                        className="text-base italic"
                        style={{
                          color: 'var(--manuscript-cream, #fbf3df)',
                          opacity: 0.82,
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                      >
                        &ldquo;{ayah.translation}&rdquo;
                      </div>
                    )}
                    {/* Bengali translation */}
                    {ayah.bengali && (
                      <div
                        className="text-sm mt-1"
                        dir="rtl"
                        style={{ color: 'var(--gold-light, #f0c75e)', opacity: 0.8, fontFamily: 'serif' }}
                      >
                        {ayah.bengali}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Ayah pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setAyahPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="flex items-center gap-1 disabled:opacity-40"
                  style={pillBase}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--gold-light, #f0c75e)' }}
                >
                  Page {safePage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setAyahPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="flex items-center gap-1 disabled:opacity-40"
                  style={pillBase}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <GoldDivider className="my-6" />

            {/* Controls */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setFontSize((s) => Math.max(18, s - 2))} style={pillBase}>
                A−
              </button>
              <button onClick={() => setFontSize((s) => Math.min(48, s + 2))} style={pillBase}>
                A+
              </button>
              <button onClick={handleShare} style={pillBase} className="flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Share Surah
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--gold-mid, #d4a017)' }}>
            No ayahs found.
          </div>
        )}
      </div>

      {/* ── Navigation (surah to surah) ────────────────────────────── */}
      <div className="flex gap-4 justify-center items-center">
        <button
          onClick={() => { if (currentSurah > 1) { setCurrentSurah(currentSurah - 1); setCurrentAyah(1); setAyahPage(0); } }}
          disabled={currentSurah === 1}
          className="flex items-center gap-2 disabled:opacity-40"
          style={navButtonBase}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Surah
        </button>

        <div className="flex items-center gap-2 px-6 py-2 rounded-xl" style={cardStyle}>
          <span
            className="font-semibold"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: 'var(--gold-light, #f0c75e)',
            }}
          >
            {currentSurah} / 114
          </span>
        </div>

        <button
          onClick={() => { if (currentSurah < 114) { setCurrentSurah(currentSurah + 1); setCurrentAyah(1); setAyahPage(0); } }}
          disabled={currentSurah === 114}
          className="flex items-center gap-2 disabled:opacity-40"
          style={navButtonGold}
        >
          Next Surah
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
