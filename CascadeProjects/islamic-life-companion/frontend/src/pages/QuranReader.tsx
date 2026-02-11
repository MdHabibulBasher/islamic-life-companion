import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Volume2, Share2, Bookmark } from 'lucide-react';
import { LoadingSpinner } from '../components';
import { Button } from '../components/Form';

interface Surah {
  number: number;
  name: string;
  ayahCount: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

export const QuranReader: React.FC = () => {
  const [currentSurah, setCurrentSurah] = useState<number>(1);
  const [currentAyah, setCurrentAyah] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(18);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showSurahList, setShowSurahList] = useState<boolean>(false);
  // const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sample Surahs (in production, fetch from API)
  const surahs: Surah[] = [
    { number: 1, name: 'Al-Fatiha', ayahCount: 7, revelationType: 'Meccan' },
    { number: 2, name: 'Al-Baqarah', ayahCount: 286, revelationType: 'Madinan' },
    { number: 3, name: 'Ali Imran', ayahCount: 200, revelationType: 'Madinan' },
    { number: 4, name: 'An-Nisa', ayahCount: 176, revelationType: 'Madinan' },
    { number: 5, name: 'Al-Ma\'idah', ayahCount: 120, revelationType: 'Madinan' },
    { number: 6, name: 'Al-An\'am', ayahCount: 165, revelationType: 'Meccan' },
    { number: 7, name: 'Al-A\'raf', ayahCount: 206, revelationType: 'Meccan' },
    { number: 8, name: 'Al-Anfal', ayahCount: 75, revelationType: 'Madinan' },
    { number: 9, name: 'At-Taubah', ayahCount: 129, revelationType: 'Madinan' },
    { number: 10, name: 'Yunus', ayahCount: 109, revelationType: 'Meccan' },
  ];

  // Sample Ayahs for current Surah (in production, fetch from API)
  const ayahs: Ayah[] = [
    { number: 1, numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
    { number: 2, numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
    { number: 3, numberInSurah: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
    { number: 4, numberInSurah: 4, text: 'مَالِكِ يَوْمِ الدِّينِ' },
    { number: 5, numberInSurah: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ' },
    { number: 6, numberInSurah: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ' },
    { number: 7, numberInSurah: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' },
  ];

  const currentSurahData = surahs[currentSurah - 1];
  const bookmarkKey = `${currentSurah}-${currentAyah}`;

  const handleSurahChange = (surahNumber: number) => {
    setCurrentSurah(surahNumber);
    setCurrentAyah(1);
    setShowSurahList(false);
  };

  const handleToggleBookmark = () => {
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(bookmarkKey)) {
      newBookmarks.delete(bookmarkKey);
    } else {
      newBookmarks.add(bookmarkKey);
    }
    setBookmarks(newBookmarks);
  };

  const handleShare = async () => {
    const text = `${currentSurahData.name} - Ayah ${currentAyah}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Islamic Life Companion',
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const handlePreviousAyah = () => {
    if (currentAyah > 1) {
      setCurrentAyah(currentAyah - 1);
    } else if (currentSurah > 1) {
      setCurrentSurah(currentSurah - 1);
      setCurrentAyah(surahs[currentSurah - 2].ayahCount);
    }
  };

  const handleNextAyah = () => {
    if (currentAyah < currentSurahData.ayahCount) {
      setCurrentAyah(currentAyah + 1);
    } else if (currentSurah < surahs.length) {
      setCurrentSurah(currentSurah + 1);
      setCurrentAyah(1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <h1 className="text-3xl font-bold">Quran Reader</h1>
          </div>
          
          {/* Surah Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSurahList(!showSurahList)}
              className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left font-semibold flex justify-between items-center"
            >
              <span>{currentSurahData.name} ({currentSurahData.number})</span>
              <span className="text-sm text-slate-300">{currentSurahData.ayahCount} Ayahs</span>
            </button>

            {showSurahList && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-20">
                {surahs.map((surah) => (
                  <button
                    key={surah.number}
                    onClick={() => handleSurahChange(surah.number)}
                    className={`w-full p-3 text-left hover:bg-slate-600 border-b border-slate-600 transition ${
                      currentSurah === surah.number ? 'bg-slate-600' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{surah.name}</span>
                      <span className="text-sm text-slate-300">{surah.ayahCount}</span>
                    </div>
                    <div className="text-xs text-slate-400">{surah.revelationType}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-slate-800 rounded-lg p-8 mb-6 shadow-xl">
          {!currentSurahData ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Ayah Display */}
              <div className="text-center mb-8">
                <div className="text-sm text-slate-400 mb-4">
                  {currentSurahData.name} - Ayah {currentAyah}
                </div>
                <div
                  className="text-4xl leading-relaxed font-arabic text-emerald-300 mb-6"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {ayahs[currentAyah - 1]?.text || 'Ayah not found'}
                </div>
                
                {/* Translation */}
                <div className="text-lg text-slate-300 italic mb-8 font-serif">
                  "In the name of Allah, the Most Gracious, the Most Merciful. All praise is due to Allah..."
                </div>

                {/* Transliteration */}
                <div className="text-sm text-slate-400 mb-8">
                  Bismillah ar-Rahman ar-Rahim
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <button
                  onClick={() => setFontSize(Math.max(16, fontSize - 2))}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition"
                >
                  A- Font
                </button>
                <button
                  onClick={() => setFontSize(fontSize + 2)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition"
                >
                  A+ Font
                </button>
                <button
                  onClick={handleToggleBookmark}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                    bookmarks.has(bookmarkKey)
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {bookmarks.has(bookmarkKey) ? 'Bookmarked' : 'Bookmark'}
                </button>
                <button
                  onClick={handleShare}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Audio
                </button>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4 justify-center mb-6">
          <Button
            onClick={handlePreviousAyah}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-800 rounded-lg">
            <span className="font-semibold">
              {currentAyah} / {currentSurahData.ayahCount}
            </span>
          </div>

          <Button
            onClick={handleNextAyah}
            variant="primary"
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Bookmarks Section */}
        {bookmarks.size > 0 && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-emerald-400" />
              Your Bookmarks ({bookmarks.size})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(bookmarks).map((bookmark) => {
                const [surahNum, ayahNum] = bookmark.split('-').map(Number);
                const surah = surahs[surahNum - 1];
                return (
                  <button
                    key={bookmark}
                    onClick={() => {
                      setCurrentSurah(surahNum);
                      setCurrentAyah(ayahNum);
                    }}
                    className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition"
                  >
                    <div className="font-semibold">{surah?.name}</div>
                    <div className="text-sm text-slate-400">Ayah {ayahNum}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
