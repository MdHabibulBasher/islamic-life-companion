"""Islamic calendar events endpoints + admin/seed helpers.

The endpoint group exposes:

  GET   /events               list events (optional ?month= filter)
  GET   /events/{event_id}    one event
  POST  /events               create (admin only)
  PUT   /events/{event_id}    update (admin only)
  DELETE /events/{event_id}   delete (admin only)

On the first authenticated list, the database is seeded with a curated
catalog of well-known Hijri events (battles, revelations, prophetic
occasions, companions, treaties, sacred months) so every user lands on a
populated calendar.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.calendar import EventCategory, IslamicEvent
from app.models.user import User
from app.schemas.calendar import (
    IslamicEventCreate,
    IslamicEventResponse,
    IslamicEventUpdate,
)

router = APIRouter(prefix="/islamic-calendar", tags=["islamic-calendar"])


# ---------------------------------------------------------------------------
# Admin guard
# ---------------------------------------------------------------------------

def require_admin(current_user: User) -> None:
    """Raise 403 if the caller isn't an admin. Mutating endpoints call this
    as a dependency after :func:`get_current_user` so the user is already
    authenticated and on a per-request DB session.
    """
    if (current_user.role or "USER").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )


# ---------------------------------------------------------------------------
# Color palette per category
# ---------------------------------------------------------------------------
# The frontend uses the category's enum value as a stable key; the
# color_code on the event itself overrides the default for specific
# events (e.g. Laylat al-Qadr uses gold even though it's REVELATION).
# The defaults below are exported through the seed so the same palette
# is used everywhere.
CATEGORY_COLORS = {
    EventCategory.HOLIDAY:    "#059669",  # emerald — celebratory
    EventCategory.BATTLE:     "#B91C1C",  # deep red — martial
    EventCategory.REVELATION: "#D97706",  # amber — divine moment
    EventCategory.PROPHETIC:  "#0EA5E9",  # lapis blue — prophetic
    EventCategory.COMPANION:  "#7C3AED",  # purple — biographical
    EventCategory.TREATY:     "#0F766E",  # teal — diplomatic
    EventCategory.SPECIAL:    "#EAB308",  # gold — sacred / special
}


# ---------------------------------------------------------------------------
# Seed catalog
# ---------------------------------------------------------------------------
#
# Category totals (target):
#   Major Holidays    : 5  (Eid al-Fitr, Eid al-Adha, Day of Arafah, Ashura,
#                            Laylat al-Qadr — counted under REVELATION but
#                            surfaced as a holiday via the category color)
#   Ramadan           : 5
#   Major Battles     : 8
#   Prophetic         : 10
#   Companions        : 7
#   Treaties          : 5
#   Special dates     : 10
#
# All color codes override the category default only when we want the
# event to "look like" something else (e.g. Laylat al-Qadr shows up in
# emerald even though its category is REVELATION).


def _seed_default_events(db: Session) -> None:
    """Seed the curated catalog of well-known Hijri events.

    Idempotent — only inserts if the table is empty so re-runs are safe.
    Re-seeding can be forced by dropping all rows (admin tools only).
    """
    if db.query(IslamicEvent).first():
        return

    defaults: List[IslamicEvent] = [
        # ---- 1. MAJOR HOLIDAYS (5) ------------------------------------
        IslamicEvent(
            title_en="Islamic New Year",
            title_bn="ইসলামী নববর্ষ",
            hijri_month=1, hijri_day=1,
            category=EventCategory.HOLIDAY,
            description_en="First day of the Islamic lunar calendar (1 Muharram).",
            description_bn="হিজরী lunar ক্যালেন্ডারের প্রথম দিন (১ মুহাররম)।",
            color_code="#059669",
            sources="Sahih Muslim, Book of Fasting",
        ),
        IslamicEvent(
            title_en="Day of Ashura",
            title_bn="আশুরা",
            hijri_month=1, hijri_day=10,
            category=EventCategory.HOLIDAY,
            description_en="10th of Muharram — a day of fasting and remembrance of Prophet Musa (AS).",
            description_bn="১০ মুহাররম — রোজা ও স্মরণের দিন, মূসা (আ.) এর স্মরণে।",
            full_story_en="The Prophet ﷺ said: 'The best of fasts after Ramadan is fasting in the month of Muharram.' (Sahih Muslim). The 10th of Muharram is the day Allah saved Prophet Musa (AS) and the Children of Israel from Pharaoh. Jews of Madinah used to fast this day, and the Prophet ﷺ instructed Muslims to fast the 9th and 10th (or 10th and 11th) to differentiate from the People of the Book.",
            color_code="#059669",
            sources="Sahih Muslim 1163; Sahih al-Bukhari 2006",
        ),
        IslamicEvent(
            title_en="Eid al-Fitr",
            title_bn="ঈদুল ফিতর",
            hijri_month=10, hijri_day=1,
            category=EventCategory.HOLIDAY,
            description_en="Festival of breaking the fast at the end of Ramadan.",
            description_bn="রমজান শেষে সিয়াম ভাঙার উৎসব।",
            full_story_en="Eid al-Fitr marks the end of the month-long fast of Ramadan. The Prophet ﷺ instituted two Eids per year for the ummah — the days of 'id (festival). Muslims pay zakat al-fitr before the Eid prayer, wear their best clothes, and gather at the prayer ground to pray two rak'at. The day is a celebration of obedience, family, and gratitude.",
            color_code="#059669",
            sources="Sahih al-Bukhari 952; Sunan Abu Dawud 1132",
        ),
        IslamicEvent(
            title_en="Day of Arafah",
            title_bn="আরাফাতের দিন",
            hijri_month=12, hijri_day=9,
            category=EventCategory.HOLIDAY,
            description_en="9th of Dhul Hijjah — the day of standing at Arafat, the pinnacle of Hajj.",
            description_bn="জিলহজের ৯ তারিখ — আরাফাতে অবস্থানের দিন, হজের সর্বোচ্চ স্তম্ভ।",
            full_story_en="The Prophet ﷺ said: 'Hajj is Arafah.' (Sunan Abu Dawud 1949). Pilgrims gather on the plain of Arafat from noon until sunset in standing, supplicating, and making dua — the most important moment of Hajj. For those not on Hajj, fasting this day expiates the sins of the previous and coming year (Sahih Muslim 1162).",
            color_code="#059669",
            sources="Sahih Muslim 1162; Sunan Abu Dawud 1949",
        ),
        IslamicEvent(
            title_en="Eid al-Adha",
            title_bn="ঈদুল আযহা",
            hijri_month=12, hijri_day=10,
            category=EventCategory.HOLIDAY,
            description_en="Festival of sacrifice during Hajj, commemorating Prophet Ibrahim's (AS) willingness to sacrifice his son.",
            description_bn="হজের সময় কোরবানীর ঈদ, ইব্রাহিম (আ.) এর পুত্রকে কোরবানি করার সদিচ্ছার স্মরণে।",
            full_story_en="On this day, pilgrims complete the Hajj rites by stoning the Jamrat, sacrificing an animal, shaving their heads, and doing tawaf al-ifadah. Muslims worldwide who are not on Hajj follow the Prophet's ﷺ tradition (Sunnah) of sacrificing a livestock animal and distributing the meat to family, neighbors, and the poor — three equal shares. The day is also the culmination of the Eid prayers.",
            color_code="#059669",
            sources="Sahih al-Bukhari 5554; Sahih Muslim 1966",
        ),

        # ---- 2. RAMADAN (5) ---------------------------------------------
        IslamicEvent(
            title_en="Start of Ramadan",
            title_bn="রমজানের শুরু",
            hijri_month=9, hijri_day=1,
            category=EventCategory.SPECIAL,
            description_en="First day of the month of fasting — the most blessed month of the Islamic year.",
            description_bn="সিয়াম সাধনার মাস রমজানের প্রথম দিন — বছরের সবচেয়ে বরকতময় মাস।",
            full_story_en="The gates of Paradise are opened, the gates of Hellfire are closed, and the devils are chained. Whoever fasts this month with faith and seeking reward will have their past sins forgiven. (Sahih al-Bukhari 38). Muslims fast from dawn (Fajr) to sunset (Maghrib), abstain from food, drink, and marital relations, and increase acts of worship — Quran recitation, charity, tarawih prayers.",
            color_code="#D97706",
            sources="Sahih al-Bukhari 38; Sahih Muslim 1079",
        ),
        IslamicEvent(
            title_en="Battle of Badr (anniversary)",
            title_bn="বদর যুদ্ধ",
            hijri_month=9, hijri_day=17,
            category=EventCategory.SPECIAL,
            description_en="The first major battle of Islam, fought on the 17th of Ramadan in 2 AH (624 CE).",
            description_bn="ইসলামের প্রথম বড় যুদ্ধ, ২ হিজরীর ১৭ রমজানে (৬২৪ খ্রি.) সংঘটিত।",
            full_story_en="Despite being outnumbered three to one, 313 Muslims under the Prophet ﷺ defeated ~1,000 Quraysh at Badr. The battle established Islam as a political and military force in Arabia. Hamza (RA), Ali (RA), and Ubayda ibn al-Harith (RA) distinguished themselves; Abu Jahl — a chief enemy of Islam — was killed. Verses of Surah Al-Anfal were revealed concerning the battle.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 3952; Ibn Hisham, As-Seerah an-Nabawiyyah",
        ),
        IslamicEvent(
            title_en="Conquest of Makkah (anniversary)",
            title_bn="মক্কা বিজয়",
            hijri_month=9, hijri_day=20,
            category=EventCategory.PROPHETIC,
            description_en="The peaceful conquest of Makkah on 20 Ramadan, 8 AH (630 CE).",
            description_bn="৮ হিজরীর ২০ রমজানে (৬৩০ খ্রি.) মক্কার শান্তিপূর্ণ বিজয়।",
            full_story_en="Ten thousand Muslims entered Makkah without bloodshed. The Prophet ﷺ granted general amnesty to the Quraysh — even to those who had persecuted, tortured, and fought Muslims for 21 years. He entered the Ka'bah, removed the 360 idols, and recited Surah at-Tawbah. He declared: 'Go, for you are free.' This day marked the spiritual and political triumph of Islam in its birthplace.",
            color_code="#0EA5E9",
            sources="Sahih al-Bukhari 3344; Sahih Muslim 1780",
        ),
        IslamicEvent(
            title_en="Last Ramadan of the Prophet ﷺ",
            title_bn="নবী ﷺ এর শেষ রমজান",
            hijri_month=9, hijri_day=29,
            category=EventCategory.PROPHETIC,
            description_en="The 27th night — most scholars identify it with Laylat al-Qadr. The Prophet ﷺ spent his last Ramadan intensifying charity and worship.",
            description_bn="২৭তম রাত — অধিকাংশ আলেম এটিকে লাইলাতুল কদর হিসেবে চিহ্নিত করেন। নবী ﷺ তাঁর শেষ রমজানে দান ও ইবাদত বহু গুণে বাড়িয়ে দিয়েছিলেন।",
            color_code="#D97706",
            sources="Sahih al-Bukhari 1901; Sahih Muslim 2308",
        ),
        IslamicEvent(
            title_en="Laylat al-Qadr (recommended night)",
            title_bn="লাইলাতুল কদর (প্রচলিত রাত)",
            hijri_month=9, hijri_day=27,
            category=EventCategory.REVELATION,
            description_en="The Night of Power — better than a thousand months. The Quran was first revealed on this night.",
            description_bn="কদরের রাত — হাজার মাসের চেয়ে উত্তম। এই রাতেই প্রথমবার কুরআন নাযিল হয়েছিল।",
            full_story_en="'We sent it down on the Night of Power. But how will you know what the Night of Power is? Better is the Night of Power than a thousand months.' (Quran 97:1-3). The Prophet ﷺ said: 'Whoever stays up on Laylat al-Qadr with faith and seeking reward, all his previous sins will be forgiven.' (Sahih al-Bukhari 1901). The night is hidden among the last 10 odd nights of Ramadan so the believer strives throughout.",
            color_code="#D97706",
            sources="Quran 97 (Surah al-Qadr); Sahih al-Bukhari 1901; Sahih Muslim 760",
        ),

        # ---- 3. MAJOR BATTLES (8) ---------------------------------------
        IslamicEvent(
            title_en="Battle of Badr",
            title_bn="বদর যুদ্ধ",
            hijri_month=3, hijri_day=17,
            category=EventCategory.BATTLE,
            description_en="The first major battle of Islam, 17 Rabi' al-awwal, 2 AH (624 CE). 313 Muslims defeated ~1,000 Quraysh.",
            description_bn="ইসলামের প্রথম বড় যুদ্ধ, ২ হিজরীর ১৭ রবিউল আউয়াল (৬২৪ খ্রি.)। ৩১৩ মুসলিম ~১,০০০ কুরাইশকে পরাজিত করেন।",
            full_story_en="The Quraysh had been persecuting the Muslim community in Makkah and intercepting their trade caravans. The Muslims intercepted a Quraysh caravan led by Abu Sufyan; when the Quraysh sent an army to defend it, the Battle of Badr was fought. The Muslims, armed with faith and the divine promise of victory, defeated the polytheists. Forty-nine Quraysh leaders were killed, 70 captured, and 14 Muslims martyred — including the beloved Ummaya ibn Khalaf, Mus'ab ibn Umayr, and six of the Ansar. The Quran describes this in Surah Al-Anfal (8:5-9, 41-44).",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 3952-3958; Surah Al-Anfal",
        ),
        IslamicEvent(
            title_en="Battle of Uhud",
            title_bn="উহুদ যুদ্ধ",
            hijri_month=3, hijri_day=7,
            category=EventCategory.BATTLE,
            description_en="The second major battle, 7 Shawwal 3 AH (625 CE). The Muslims initially prevailed but were defeated after the archers left their post.",
            description_bn="দ্বিতীয় বড় যুদ্ধ, ৩ হিজরীর ৭ শাওয়াল (৬২৫ খ্রি.)। প্রথমে মুসলিমরা জয়ের পথে ছিলেন, কিন্তু তীরন্দাজরা পদত্যাগ করায় পরাজিত হন।",
            full_story_en="After Badr, the Quraysh swore revenge. Three thousand men under Abu Sufyan marched to Uhud, north of Madinah. The Prophet ﷺ initially preferred to defend the city but the young men insisted on fighting outside. 700 Muslims took the field, 50 archers posted on Mount Uhud with the explicit order: even if they see birds plucking the Muslims, do not leave your post. When the Muslims initially pushed the Quraysh, the archers abandoned the hill to collect spoils. Khalid ibn al-Walid (then a polytheist) led a cavalry charge into the unguarded flank. 70 Muslims were martyred, including Hamza ibn Abdul-Muttalib — the Prophet's uncle and 'Lion of Allah'. The Prophet himself was wounded.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4073-4079; Surah Al-Imran (3:121-179)",
        ),
        IslamicEvent(
            title_en="Battle of the Trench (Khandaq)",
            title_bn="খন্দকের যুদ্ধ (আহযাব)",
            hijri_month=5, hijri_day=2,
            category=EventCategory.BATTLE,
            description_en="Battle of the Confederates, 2 Shawwal 5 AH (627 CE). The Muslims, advised by Salman al-Farisi, dug a trench around Madinah.",
            description_bn="৫ হিজরীর ২ শাওয়াল (৬২৭ খ্রি.) আহযাবের যুদ্ধ। সালমান আল-ফারসীর পরামর্শে মদীনার চারপাশে খন্দক খনন করা হয়।",
            full_story_en="A coalition of ~10,000 from the Quraysh, Ghatafan, and other tribes besieged Madinah. The trench — a tactic unknown in Arabia, suggested by Salman al-Farisi (RA) — halted the cavalry. The siege lasted 27 days in bitter cold. The Quran describes this in Surah al-Ahzab (33:9-20). The confederates eventually withdrew after internal discord, and the Prophet ﷺ led a surprise counter-attack that defeated the Banu Qurayza.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4119; Sahih Muslim 4366; Surah al-Ahzab",
        ),
        IslamicEvent(
            title_en="Battle of Khaybar",
            title_bn="খাইবার যুদ্ধ",
            hijri_month=7, hijri_day=1,
            category=EventCategory.BATTLE,
            description_en="The conquest of the Khaybar fortress, 7 AH (628 CE). The Jewish strongholds north of Madinah fell after a fierce siege.",
            description_bn="৭ হিজরীতে (৬২৮ খ্রি.) খাইবার দুর্গ বিজয়। মদীনার উত্তরে ইহুদি শক্তিশালী দুর্গগুলো দীর্ঘ অবরোধের পর পতন হয়।",
            full_story_en="Khaybar's Jewish tribes had allied with the enemies of Islam and posed a continuous threat. The Prophet ﷺ marched with 1,400 men and conquered each of the seven fortresses. Ali ibn Abi Talib (RA) is celebrated for single-handedly tearing off the gate of the fort of al-Qamus — the feat that earned him the title Asadullah (Lion of Allah). The Treaty of Khaybar required the Jews to give half their annual produce to the Muslims in return for being allowed to remain on the land.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4197-4201; Sahih Muslim 4366",
        ),
        IslamicEvent(
            title_en="Battle of Mu'tah",
            title_bn="মূতা যুদ্ধ",
            hijri_month=8, hijri_day=12,
            category=EventCategory.BATTLE,
            description_en="The first major battle against the Byzantines, 8 AH (629 CE). Three Muslim commanders were martyred in succession before Khalid ibn al-Walid held the line.",
            description_bn="বাইজান্টাইনদের বিরুদ্ধে প্রথম বড় যুদ্ধ, ৮ হিজরী (৬২৯ খ্রি.)। খালিদ ইবনুল ওয়ালিদের নেতৃত্ব দেওয়ার আগে তিনজন মুসলিম কমান্ডার শহীদ হন।",
            full_story_en="The Prophet ﷺ sent al-Harith ibn Umayr with a letter to the Byzantine governor of Busra; he was killed by the Ghassanid chief. In response, the Prophet dispatched an army of 3,000 under Zayd ibn Harithah (his freed slave and adopted son), with Ja'far ibn Abi Talib as second-in-command and Abdullah ibn Rawahah as third. Zayd was martyred, then Ja'far took the banner and was also killed, then Abdullah. The standard was finally raised by Khalid ibn al-Walid — who, with nine sword strikes on his body and brilliant tactical withdrawals, saved the Muslim army from annihilation. He earned the title 'Saif Allah' (Sword of Allah).",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4262; Ibn Hisham, As-Seerah an-Nabawiyyah",
        ),
        IslamicEvent(
            title_en="Battle of Hunayn",
            title_bn="হুনাইন যুদ্ধ",
            hijri_month=10, hijri_day=6,
            category=EventCategory.BATTLE,
            description_en="Shortly after the conquest of Makkah, 6 Shawwal 8 AH (630 CE). The Hawazin tribe ambushed the Muslims, who initially retreated; then Allah's support turned the tide.",
            description_bn="মক্কা বিজয়ের পরপরই ৮ হিজরীর ৬ শাওয়াল (৬৩০ খ্রি.)। হাওয়াযিন গোত্র মুসলিমদের ওপর গেরিলা আক্রমণ চালায়; প্রথমে মুসলিমরা পিছিয়ে গেলেও আল্লাহর সাহায্যে জয়লাভ করেন।",
            full_story_en="The Hawazin, learning of Makkah's fall, gathered 20,000 warriors and a thousand camels as war booty. They ambushed the 12,000-strong Muslim army at the valley of Hunayn. The Muslims initially panicked; many fled. The Prophet ﷺ stood firm, called upon Allah, and said: 'I am the Prophet, this is no lie. I am the son of Abdul Muttalib.' Allah sent divine help — Surah at-Tawbah (9:25-26) was revealed about this. The Muslims rallied and won decisively.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4331-4334; Surah at-Tawbah 9:25-26",
        ),
        IslamicEvent(
            title_en="Battle of Tabuk",
            title_bn="তাবুক যুদ্ধ",
            hijri_month=9, hijri_day=1,
            category=EventCategory.BATTLE,
            description_en="The last major expedition of the Prophet ﷺ, 9 AH (630 CE). Marched north to confront the Byzantines but the enemy withdrew; the campaign consolidated Muslim rule over the northern tribes.",
            description_bn="নবী ﷺ এর শেষ বড় অভিযান, ৯ হিজরী (৬৩০ খ্রি.)। বাইজান্টাইনদের মোকাবেলায় উত্তরে অগ্রসর হন, তবে শত্রুরা পিছিয়ে যায়; এই অভিযান উত্তরের গোত্রগুলোর ওপর মুসলিম কর্তৃত্ব দৃঢ় করে।",
            full_story_en="The campaign was launched in the intense summer heat, which is why it is called 'Jaysh al-Usra' (the Army of Hardship). Many hypocrites stayed behind; Surah at-Tawbah (9:38-39) warns believers against reluctance to fight. The Byzantines withdrew without engaging. The expedition resulted in the acceptance of Islam by the Ghassanid, Dumat al-Jandal, and Tayy tribes, and the consolidation of Muslim authority over the entire Arabian Peninsula.",
            color_code="#B91C1C",
            sources="Sahih al-Bukhari 4423; Surah at-Tawbah 9:38-129",
        ),
        IslamicEvent(
            title_en="Battle of Yarmouk",
            title_bn="ইয়ারমুকের যুদ্ধ",
            hijri_month=6, hijri_day=11,
            category=EventCategory.BATTLE,
            description_en="Decisive battle between the Muslim Rashidun Caliphate and the Byzantines, 13 AH (636 CE). 25,000-40,000 Muslims defeated ~200,000 Byzantines in Syria.",
            description_bn="১৩ হিজরী (৬৩৬ খ্রি.) মুসলিম রাশেদুন খিলাফত ও বাইজান্টাইনদের মধ্যে সিদ্ধান্তমূলক যুদ্ধ। ২৫,০০০-৪০,০০০ মুসলিম সিরিয়ায় ~২,০০,০০০ বাইজান্টাইনকে পরাজিত করেন।",
            full_story_en="The Battle of Yarmouk was one of the most consequential battles in history. Under the command of Khalid ibn al-Walid, the Muslim Arab forces decisively defeated the Byzantine army of Heraclius and secured the entire Levant for Islam. The battle was fought in 6 days of intense combat, with both sides suffering massive casualties. The victory ended Byzantine rule outside Anatolia and opened the door to Muslim expansion into the wider Middle East.",
            color_code="#B91C1C",
            sources="Al-Waqidi, Kitab al-Maghazi; Al-Tabari, Tarikh",
        ),

        # ---- 4. PROPHETIC (10) -----------------------------------------
        IslamicEvent(
            title_en="Birth of the Prophet Muhammad ﷺ",
            title_bn="নবী মুহাম্মদ ﷺ এর জন্ম",
            hijri_month=3, hijri_day=12,
            category=EventCategory.PROPHETIC,
            description_en="Mawlid an-Nabi — the birthday of the Prophet ﷺ, 12 Rabi' al-awwal, 'the Year of the Elephant' (570 CE).",
            description_bn="ঈদে মিলাদুন্নবী — নবী ﷺ এর জন্মদিন, ১২ রবিউল আউয়াল, 'আমুল ফীল' (৫৭০ খ্রি.)।",
            full_story_en="Born in Makkah in the Year of the Elephant — the year Abraha's army marched on the Ka'bah and was repelled by birds (Surah al-Fil). His father Abdullah died before his birth; his mother Aminah died when he was six; he was raised first by his grandfather Abdul Muttalib, then by his uncle Abu Talib. The Prophet ﷺ would later say: 'I was sent as a Prophet when Adam was still between the spirit and the body.' (Tirmidhi).",
            color_code="#0EA5E9",
            sources="Ibn Hisham, As-Seerah an-Nabawiyyah; Tirmidhi 3628",
        ),
        IslamicEvent(
            title_en="First Revelation",
            title_bn="প্রথম ওহী",
            hijri_month=9, hijri_day=21,
            category=EventCategory.REVELATION,
            description_en="The first verses of the Quran were revealed to the Prophet ﷺ in the Cave of Hira, 21 Ramadan (610 CE).",
            description_bn="হেরা গুহায় নবী ﷺ এর ওপর কুরআনের প্রথম আয়াত নাযিল হয়, ২১ রমজান (৬১০ খ্রি.)।",
            full_story_en="The Angel Jibreel (Gabriel) appeared to the Prophet ﷺ in the Cave of Hira and commanded: 'Iqra!' ('Read!'). The Prophet ﷺ, who was unlettered, replied that he could not read. The angel embraced him tightly three times, then recited the first five verses of Surah Al-Alaq (96:1-5): 'Read in the name of your Lord who created...'. Khadijah (RA), his wife, was the first to believe in his prophethood — earning her the title 'al-Tahira' (the pure one).",
            color_code="#D97706",
            sources="Sahih al-Bukhari 4953; Surah al-Alaq 96:1-5",
        ),
        IslamicEvent(
            title_en="Prophethood Announced Publicly",
            title_bn="প্রচারের আদেশ (দাওয়াত-এ-জাহরি)",
            hijri_month=6, hijri_day=26,
            category=EventCategory.REVELATION,
            description_en="The Prophet ﷺ began his public call to Islam, 3 years after the first revelation. The verse 'And warn your closest kindred' (26:214) was revealed.",
            description_bn="প্রথম ওহীর ৩ বছর পর নবী ﷺ প্রকাশ্যে ইসলামের দাওয়াত শুরু করেন। 'আর তোমার নিকটতম আত্মীয়দের সতর্ক করো' (২৬:২১৪) আয়াত নাযিল হয়।",
            color_code="#D97706",
            sources="Sahih al-Bukhari 4970; Surah ash-Shu'ara 26:214",
        ),
        IslamicEvent(
            title_en="First Hijrah to Abyssinia",
            title_bn="প্রথম হিজরত (আবিসিনিয়া)",
            hijri_month=5, hijri_day=16,
            category=EventCategory.PROPHETIC,
            description_en="A group of 11 Muslims fled persecution in Makkah and took refuge in the Christian kingdom of Aksum (modern Ethiopia) under the just king Negus.",
            description_bn="১১ জন মুসলিম মক্কায় নির্যাতনের হাত থেকে বাঁচতে আধুনিক ইথিওপিয়ার আকসুমের ন্যায্য রাজা নেগাসের কাছে আশ্রয় নেন।",
            full_story_en="When the persecution in Makkah became unbearable, the Prophet ﷺ instructed a group led by Uthman ibn Affan and his wife Ruqayyah (the Prophet's daughter) to migrate to Abyssinia. The Negus, a Christian king, heard their case, listened to Surah Maryam recited by Ja'far ibn Abi Talib, and refused the Quraysh demand to extradite them — saying: 'Go, for you are safe in my kingdom.' Two more migrations followed. The Muslims lived under Christian protection for years before eventually joining the main hijrah to Madinah.",
            color_code="#0EA5E9",
            sources="Ibn Hisham, As-Seerah an-Nabawiyyah; Ibn Ishaq",
        ),
        IslamicEvent(
            title_en="Isra and Mi'raj",
            title_bn="ইসরা ও মি'রাজ",
            hijri_month=7, hijri_day=27,
            category=EventCategory.PROPHETIC,
            description_en="The Night Journey and Ascension. The Prophet ﷺ was taken from Makkah to Jerusalem (Al-Aqsa) and ascended through the seven heavens.",
            description_bn="রাতের যাত্রা ও আরোহণ। নবী ﷺ কে মক্কা থেকে জেরুজালেম (আল-আকসা) নিয়ে যাওয়া হয় এবং সাত আসমানের ওপরে উন্নীত করা হয়।",
            full_story_en="On the 27th of Rajab, the Prophet ﷺ was miraculously transported from Makkah to Al-Aqsa Mosque in Jerusalem, where he led the previous prophets in prayer. From there, he ascended through the seven heavens meeting Adam, Yahya (John), Yusuf, Idris, Musa, and Ibrahim (peace be upon them), reaching Sidrat al-Muntaha. Five daily prayers were prescribed during this journey. The event is mentioned in Surah al-Isra (17:1).",
            color_code="#0EA5E9",
            sources="Sahih al-Bukhari 3207; Sahih Muslim 162; Surah al-Isra 17:1",
        ),
        IslamicEvent(
            title_en="Pledge of Aqabah (First)",
            title_bn="প্রথম আকাবা শপথ",
            hijri_month=6, hijri_day=12,
            category=EventCategory.TREATY,
            description_en="First pledge of Aqabah, 12 Rabi' al-thani (621 CE). 12 men from Yathrib (Madinah) secretly pledged to follow the Prophet ﷺ.",
            description_bn="প্রথম আকাবা শপথ, ১২ রবিউস সানি (৬২১ খ্রি.)। ইয়াসরিব (মদীনা) থেকে ১২ জন গোপনে নবী ﷺ এর অনুসরণ করার শপথ নেন।",
            color_code="#0F766E",
            sources="Ibn Hisham, As-Seerah an-Nabawiyyah; Sahih Muslim",
        ),
        IslamicEvent(
            title_en="Pledge of Aqabah (Second)",
            title_bn="দ্বিতীয় আকাবা শপথ",
            hijri_month=3, hijri_day=8,
            category=EventCategory.TREATY,
            description_en="Second pledge of Aqabah, 13 years into prophethood (622 CE). 75 men and 2 women from Yathrib pledged to protect the Prophet ﷺ.",
            description_bn="দ্বিতীয় আকাবা শপথ, নবুওয়াতের ১৩তম বছরে (৬২২ খ্রি.)। ইয়াসরিব থেকে ৭৫ জন পুরুষ ও ২ জন নারী নবী ﷺ কে রক্ষা করার শপথ নেন।",
            full_story_en="A year after the first pledge, a larger delegation of 75 men and 2 women from Yathrib came and pledged to protect the Prophet ﷺ as they would their own families. Among them were the future ten promised Paradise (al-Ashra al-Mubasshirun). This pledge triggered the Quraysh to escalate their persecution, accelerating the need for the Hijrah. Mus'ab ibn Umayr was sent as the first envoy and teacher to Madinah before the migration.",
            color_code="#0F766E",
            sources="Ibn Hisham, As-Seerah an-Nabawiyyah",
        ),
        IslamicEvent(
            title_en="Hijrah to Madinah",
            title_bn="মদীনায় হিজরত",
            hijri_month=1, hijri_day=8,
            category=EventCategory.PROPHETIC,
            description_en="The migration of the Prophet ﷺ from Makkah to Madinah, 1 Rabi' al-awwal (or 8 Rabi' al-awwal), 622 CE — year 1 of the Islamic calendar.",
            description_bn="নবী ﷺ এর মক্কা থেকে মদীনায় হিজরত, ১ রবিউল আউয়াল (অথবা ৮ রবিউল আউয়াল), ৬২২ খ্রি. — ইসলামী ক্যালেন্ডারের ১ম বছর।",
            full_story_en="With the Quraysh plotting to assassinate him, the Prophet ﷺ left Makkah with Abu Bakr al-Siddiq. They hid in the Cave of Thawr for three days while the Quraysh searched. They then traveled to Yathrib (renamed Madinah, 'the city'), where the Muslim community and the Ansar (helpers) welcomed them. The Hijrah marks Year 1 of the Islamic calendar (set by Umar ibn al-Khattab in 638 CE).",
            color_code="#0EA5E9",
            sources="Sahih al-Bukhari 3653; Ibn Hisham",
        ),
        IslamicEvent(
            title_en="Death of the Prophet Muhammad ﷺ",
            title_bn="নবী মুহাম্মদ ﷺ এর ইন্তেকাল",
            hijri_month=3, hijri_day=12,
            category=EventCategory.PROPHETIC,
            description_en="The Prophet ﷺ passed away on 12 Rabi' al-awwal, 11 AH (632 CE), at the age of 63, in Madinah.",
            description_bn="১১ হিজরীর ১২ রবিউল আউয়াল (৬৩২ খ্রি.) ৬৩ বছর বয়সে নবী ﷺ মদীনায় ইন্তেকাল করেন।",
            full_story_en="After a short illness, the Prophet ﷺ delivered his final sermon on 9 Dhul Hijjah 10 AH (the Farewell Pilgrimage) and passed away in the apartment of Aisha (RA) on Monday, 12 Rabi' al-awwal 11 AH. His last words were: 'Ar-Rafiq al-A'la' (the highest companion — meaning Allah). Abu Bakr succeeded him as the first Caliph. The Quran says: 'Muhammad is not the father of any of your men, but the Messenger of Allah and the seal of the prophets' (33:40).",
            color_code="#0EA5E9",
            sources="Sahih al-Bukhari 4437; Sahih Muslim 1638",
        ),
        IslamicEvent(
            title_en="Farewell Pilgrimage (Hujjat al-Wada)",
            title_bn="বিদায় হজ",
            hijri_month=12, hijri_day=9,
            category=EventCategory.PROPHETIC,
            description_en="The Prophet's ﷺ final pilgrimage, 9 Dhul Hijjah 10 AH (632 CE). Over 100,000 companions accompanied him. He delivered his famous farewell sermon.",
            description_bn="নবী ﷺ এর শেষ হজ, ১০ হিজরীর ৯ জিলহজ (৬৩২ খ্রি.)। ১,০০,০০০ এরও বেশি সাহাবী তাঁর সাথে ছিলেন। তিনি তাঁর বিখ্যাত বিদায় ভাষণ দেন।",
            full_story_en="The Prophet ﷺ led over 100,000 companions on his final Hajj. On the Day of Arafah he delivered his farewell sermon, declaring: 'All Muslims are brothers. No Arab has superiority over a non-Arab except through taqwa (piety).' He emphasized the sanctity of life, property, and honor; the rights of women; and the imperative to hold fast to the Quran and his Sunnah. The final verse of the Quran — 'This day I have perfected your religion for you' (5:3) — was revealed on this day.",
            color_code="#0EA5E9",
            sources="Sahih Muslim 1679; Surah al-Ma'idah 5:3",
        ),

        # ---- 5. COMPANIONS (7) -----------------------------------------
        IslamicEvent(
            title_en="Death of Abu Bakr al-Siddiq (RA)",
            title_bn="আবু বকর সিদ্দীক (রা.) এর ইন্তেকাল",
            hijri_month=8, hijri_day=22,
            category=EventCategory.COMPANION,
            description_en="The first Caliph of Islam, 22 Jumada al-thani, 13 AH (634 CE). Served as Caliph for 2 years and 3 months.",
            description_bn="ইসলামের প্রথম খলিফা, ১৩ হিজরীর ২২ জুমাদাস সানি (৬৩৪ খ্রি.)। ২ বছর ৩ মাস খিলাফত পরিচালনা করেন।",
            full_story_en="Abu Bakr was the first adult male to accept Islam, the Prophet's ﷺ closest companion, the father of Aisha (RA), and the leader of the Muslim community from 632-634 CE. He suppressed the Ridda (apostasy) wars, began the compilation of the Quran into a single volume, and appointed Umar ibn al-Khattab as his successor. He died of natural causes and was buried next to the Prophet ﷺ.",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 3665; Al-Tabari, Tarikh",
        ),
        IslamicEvent(
            title_en="Death of Umar ibn al-Khattab (RA)",
            title_bn="উমর ইবনুল খাত্তাব (রা.) এর ইন্তেকাল",
            hijri_month=11, hijri_day=1,
            category=EventCategory.COMPANION,
            description_en="The second Caliph, 1 Dhul Hijjah, 23 AH (644 CE). Assassinated by a Persian slave. Served for 10 years.",
            description_bn="দ্বিতীয় খলিফা, ২৩ হিজরীর ১ জিলহজ (৬৪৪ খ্রি.)। একজন পারসিক ক্রীতদাস দ্বারা হত্যাকাণ্ডের শিকার। ১০ বছর খিলাফত পরিচালনা করেন।",
            full_story_en="Umar is one of the ten promised Paradise (al-Ashra al-Mubasshirun). Under his rule, the Muslim world expanded to include Egypt, Persia, the Levant, and parts of North Africa. He introduced the Hijri calendar, established the Diwan (state registry), and was famous for his justice — he would carry the Prophet's ﷺ rod and a whip, and even his own son would be punished. He appointed six companions to choose his successor, and was stabbed by Abu Lu'lu'a while leading Fajr prayer.",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 3700; Al-Tabari, Tarikh",
        ),
        IslamicEvent(
            title_en="Death of Uthman ibn Affan (RA)",
            title_bn="উসমান ইবনু আফফান (রা.) এর ইন্তেকাল",
            hijri_month=12, hijri_day=18,
            category=EventCategory.COMPANION,
            description_en="The third Caliph, 18 Dhul Hijjah, 35 AH (656 CE). Martyred during the siege of his house after a rebellion.",
            description_bn="তৃতীয় খলিফা, ৩৫ হিজরীর ১৮ জিলহজ (৬৫৬ খ্রি.)। তাঁর বাড়ি অবরোধের সময় শহীদ হন।",
            full_story_en="Uthman, son-in-law of the Prophet ﷺ (married to two of his daughters, Ruqayyah and Umm Kulthum), compiled the official Mushaf of the Quran that is used to this day. Under his Caliphate, the Islamic empire continued to expand — the conquest of North Africa and the Battle of the Masts. Rebels besieged his house while he was fasting and reciting the Quran; he was martyred and his blood stained the pages. His funeral was led by Marwan ibn al-Hakam; Ali ibn Abi Talib performed the burial.",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 3697; Al-Tabari, Tarikh",
        ),
        IslamicEvent(
            title_en="Death of Ali ibn Abi Talib (RA)",
            title_bn="আলী ইবনু আবি তালিব (রা.) এর ইন্তেকাল",
            hijri_month=1, hijri_day=21,
            category=EventCategory.COMPANION,
            description_en="The fourth Caliph, 21 Ramadan 40 AH (661 CE). Assassinated by the Kharijite Abd al-Rahman ibn Muljam while leading Fajr prayer.",
            description_bn="চতুর্থ খলিফা, ৪০ হিজরীর ২১ রমজান (৬৬১ খ্রি.)। ফজর নামাজে ইমামতিরত অবস্থায় খারিজি আব্দুর রহমান ইবনু মুলজাম কর্তৃক হত্যাকাণ্ডের শিকার।",
            full_story_en="Ali — cousin and son-in-law of the Prophet ﷺ, father of Hassan and Hussein — is honored as one of the ten promised Paradise and the fourth Rashidun Caliph. His Caliphate (656-661 CE) faced the first Fitna (civil war): the Battle of the Camel against Aisha (RA), the Battle of Siffin against Muawiyah, and the rise of the Kharijites. He was struck with a poisoned sword during Fajr prayer in the mosque of Kufa and died two days later. The Kharijite Ibn Muljam had been appointed by lottery to assassinate him.",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 3710; Al-Tabari, Tarikh",
        ),
        IslamicEvent(
            title_en="Death of Khadijah bint Khuwaylid (RA)",
            title_bn="খাদিজা বিনতে খুওয়াইলিদ (রা.) এর ইন্তেকাল",
            hijri_month=10, hijri_day=10,
            category=EventCategory.COMPANION,
            description_en="The first wife of the Prophet ﷺ, 10 Ramadan, 10 BH (620 CE, 3 years before Hijrah). She was the first person to accept Islam.",
            description_bn="নবী ﷺ এর প্রথম স্ত্রী, ১০ রমজান, ১০ বিহিজরি (৬২০ খ্রি., হিজরতের ৩ বছর পূর্বে)। তিনিই ইসলাম গ্রহণকারী প্রথম ব্যক্তি।",
            full_story_en="Khadijah, may Allah be pleased with her, was a wealthy and respected merchant of Makkah who hired the young Muhammad ﷺ and proposed marriage to him. She was 40 and he was 25. She was the first person to believe in his prophethood when he returned trembling from the Cave of Hira. She immediately removed her own clothing to cover him, called him 'the best of the people', and brought him to her cousin Waraqah ibn Nawfal who confirmed him as a Prophet. She stood by him through the years of boycott, starvation, and loss of his uncle Abu Talib and his son Qasim. The Prophet ﷺ later said: 'The best of the women of Paradise are Khadijah, Fatimah, Aisha, and Asiya.'",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 3813; Ibn Hisham",
        ),
        IslamicEvent(
            title_en="Death of Hamza ibn Abdul Muttalib (RA)",
            title_bn="হামযা ইবনু আবদুল মুত্তালিব (রা.) এর ইন্তেকাল",
            hijri_month=3, hijri_day=7,
            category=EventCategory.COMPANION,
            description_en="The Lion of Allah, martyred at the Battle of Uhud on 7 Shawwal, 3 AH. The Prophet ﷺ mourned him deeply and gave him the title 'Sayyid al-Shuhada' (Master of Martyrs).",
            description_bn="আল্লাহর সিংহ, ৩ হিজরীর ৭ শাওয়ালে উহুদ যুদ্ধে শহীদ। নবী ﷺ গভীরভাবে শোক প্রকাশ করেন এবং তাঁকে 'সাইয়্যিদুশ শুহাদা' (শহীদদের সর্দার) উপাধি দেন।",
            full_story_en="Hamza — the Prophet's ﷺ paternal uncle — was one of the earliest converts to Islam and a fierce defender of the Muslim community. The Prophet ﷺ himself gave him the title 'Asad Allah' (Lion of Allah) for his bravery. At the Battle of Uhud, when the Muslim line broke and the archers abandoned their post, the Quraysh cavalry (led by Khalid ibn al-Walid, then a polytheist) charged the exposed flank. Hind bint Utbah — wife of Abu Sufyan and the mother of Muawiyah — led a group of women who mutilated the bodies of the martyrs. Hamza was killed by the slave Wahshi ibn Harb, who was promised his freedom by Hind if he killed the Prophet or Hamza or Ali. The Prophet ﷺ said of Hamza: 'He is the best of martyrs before me.'",
            color_code="#7C3AED",
            sources="Sahih al-Bukhari 4073-4079",
        ),
        IslamicEvent(
            title_en="Martyrdom of Hussein ibn Ali (RA)",
            title_bn="হুসাইন ইবনু আলী (রা.) এর শাহাদাত",
            hijri_month=10, hijri_day=10,
            category=EventCategory.COMPANION,
            description_en="The Prophet's ﷺ grandson was martyred at the Battle of Karbala on 10 Muharram, 61 AH (680 CE) by the forces of Yazid I.",
            description_bn="নবী ﷺ এর নাতি ৬১ হিজরীর ১০ মুহাররম (৬৮০ খ্রি.) কারবালার যুদ্ধে ইয়াযিদ ১ এর বাহিনীর হাতে শহীদ হন।",
            full_story_en="Yazid ibn Muawiyah demanded that Hussein (RA) pledge allegiance. Hussein — grandson of the Prophet ﷺ through his daughter Fatimah and his son Ali — refused and traveled with his family and a small band of supporters to Kufa. On the plains of Karbala, they were surrounded by 4,000+ Umayyad soldiers under Ibn Ziyad. Cut off from water for 3 days, Hussein and 72 of his family and companions were killed in an asymmetric battle. The tragedy is commemorated annually as Ashura. Hussein is the third of the five infallibles in Twelver Shia Islam.",
            color_code="#7C3AED",
            sources="Al-Tabari, Tarikh; Al-Bayhaqi, Dala'il an-Nubuwwah",
        ),

        # ---- 6. TREATIES (5) -------------------------------------------
        IslamicEvent(
            title_en="Constitution of Madinah",
            title_bn="মদীনার সনদ (সংবিধান)",
            hijri_month=1, hijri_day=12,
            category=EventCategory.TREATY,
            description_en="The Prophet ﷺ established the first written constitution in history, between the Muhajirun, Ansar, and Jews of Madinah, 1 AH (622 CE).",
            description_bn="নবী ﷺ মুহাজির, আনসার ও মদীনার ইহুদিদের মধ্যে ইতিহাসের প্রথম লিখিত সংবিধান প্রতিষ্ঠা করেন, ১ হিজরী (৬২২ খ্রি.)।",
            full_story_en="The Sahifat al-Madinah (Constitution of Madinah) is often called the first written constitution in the world. It established Madinah as a single political community (ummah) under the Prophet ﷺ, with shared rights, responsibilities, and a system of conflict resolution. It recognized the Jewish tribes as part of the community, with freedom of religion and reciprocal defense obligations. It set a precedent for pluralistic governance that historians still study today.",
            color_code="#0F766E",
            sources="Ibn Ishaq, As-Sirah; Ibn Hisham",
        ),
        IslamicEvent(
            title_en="Treaty of Hudaybiyyah",
            title_bn="হুদাইবিয়ার সন্ধি",
            hijri_month=6, hijri_day=3,
            category=EventCategory.TREATY,
            description_en="The Treaty of Hudaybiyyah, 6 AH (628 CE). A 10-year peace agreement with the Quraysh that opened Makkah to Islam.",
            description_bn="হুদাইবিয়ার সন্ধি, ৬ হিজরী (৬২৮ খ্রি.)। কুরাইশদের সাথে ১০ বছরের শান্তি চুক্তি যা মক্কাকে ইসলামের জন্য উন্মুক্ত করে।",
            full_story_en="The Prophet ﷺ set out with 1,400 companions to perform Umrah, but the Quraysh blocked the way. After tense negotiations, the parties signed the Treaty of Hudaybiyyah: a 10-year truce, no fighting in the sacred months, and Muslims would return that year but perform Umrah the next. The companions called it a defeat, but the Prophet ﷺ called it a victory — Surah al-Fath (48:1) was revealed: 'Indeed, We have granted you a clear victory.' Within two years, the Quraysh violated the treaty, leading to the Conquest of Makkah, and Islam became the dominant faith in Arabia.",
            color_code="#0F766E",
            sources="Sahih al-Bukhari 2699; Sahih Muslim 1785; Surah al-Fath 48:1-29",
        ),
        IslamicEvent(
            title_en="Letter to the Roman / Persian Emperors",
            title_bn="রোম ও পারস্য সম্রাটদের কাছে পত্র",
            hijri_month=6, hijri_day=5,
            category=EventCategory.TREATY,
            description_en="The Prophet ﷺ sent letters to Heraclius (Byzantine), Khosrow II (Persian), Muqawqis (Egypt), and Negus (Abyssinia), inviting them to Islam.",
            description_bn="নবী ﷺ হিরাক্লিয়াস (বাইজান্টাইন), খসরু ২য় (পারস্য), মুকাওকিস (মিশর) ও নেগাস (আবিসিনিয়া) কে ইসলামের দাওয়াত সম্বলিত পত্র প্রেরণ করেন।",
            full_story_en="In 6 or 7 AH, after the conquest of Khaybar demonstrated Muslim power, the Prophet ﷺ sent envoys with letters to the rulers of the contemporary superpowers. Heraclius reportedly received the letter in his court at Homs, tested its authenticity through his officials, and even had Abu Sufyan (then a Quraysh leader in Byzantine-controlled territory) confirm Muhammad's character. The Persian Khosrow II tore up the letter; the Prophet ﷺ prayed for his kingdom's destruction — and within a few years, the Sassanid empire fell to the Muslim Arabs.",
            color_code="#0F766E",
            sources="Sahih al-Bukhari 2774; Sahih Muslim 1773",
        ),
        IslamicEvent(
            title_en="Constitution between Muslims and Christians of Najran",
            title_bn="নাজরানের খ্রিস্টানদের সাথে চুক্তি",
            hijri_month=6, hijri_day=14,
            category=EventCategory.TREATY,
            description_en="The Prophet ﷺ established a treaty with the Christian community of Najran, granting them religious freedom, protection of their churches, and exemption from military service in exchange for a tax.",
            description_bn="নবী ﷺ নাজরানের খ্রিস্টান সম্প্রদায়ের সাথে একটি চুক্তি স্থাপন করেন যা তাদের ধর্মীয় স্বাধীনতা, গির্জা রক্ষা ও করের বিনিময়ে সামরিক সেবা থেকে অব্যাহতি প্রদান করে।",
            full_story_en="A delegation of 60 Christians from Najran (in present-day Yemen) came to Madinah in 9 AH. They engaged the Prophet ﷺ in a famous theological debate — particularly about the nature of Jesus (AS). The verses of Surah Al-Imran 3:61 were revealed, inviting the mubahala (mutual cursing). The Christians declined and chose to remain Christian. The Prophet ﷺ then wrote a treaty preserved in Islamic history as one of the earliest examples of Muslim-Christian coexistence: their lives, churches, and properties were protected by the Muslim state, in exchange for jizyah (a tax for protection).",
            color_code="#0F766E",
            sources="Al-Tabari, Tarikh; Ibn Hisham",
        ),
        IslamicEvent(
            title_en="Peace of Jerusalem (Sulh of Bayt al-Maqdis)",
            title_bn="জেরুজালেমের সন্ধি (বাইতুল মাকদিস)",
            hijri_month=4, hijri_day=20,
            category=EventCategory.TREATY,
            description_en="The second Caliph Umar ibn al-Khattab entered Jerusalem peacefully in 15 AH (637 CE) and signed a treaty guaranteeing Christian holy sites, churches, and the right of worship.",
            description_bn="দ্বিতীয় খলিফা উমর ইবনুল খাত্তাব (রা.) ১৫ হিজরীতে (৬৩৭ খ্রি.) শান্তিপূর্ণভাবে জেরুজালেমে প্রবেশ করেন এবং খ্রিস্টানদের পবিত্র স্থান, গির্জা ও ধর্মীয় অধিকার নিশ্চিতকল্পে একটি সন্ধি স্বাক্ষর করেন।",
            full_story_en="When the Muslim army under Abu Ubayda ibn al-Jarrah and Khalid ibn al-Walid arrived at Jerusalem, the Patriarch Sophronius refused to surrender the city to anyone except the Caliph himself. Umar (RA) traveled from Madinah, accepted the keys, and signed a written treaty (al-Uhda al-Umariyya) that protected Christian holy sites, churches, the right of worship, and the lives and property of all non-Muslims. He was even offered the opportunity to pray inside the Church of the Holy Sepulchre but declined, fearing Muslims might later claim it as a mosque. The Treaty of Umar became a foundational document in Islamic law regarding the treatment of non-Muslims.",
            color_code="#0F766E",
            sources="Al-Tabari, Tarikh; Baladhuri, Futuh al-Buldan",
        ),

        # ---- 7. SPECIAL DATES (10) --------------------------------------
        IslamicEvent(
            title_en="Sacred Months Begin (Muharram)",
            title_bn="সম্মানিত মাস শুরু (মুহাররম)",
            hijri_month=1, hijri_day=1,
            category=EventCategory.SPECIAL,
            description_en="Muharram is the first of the four sacred months in Islam. Fighting is forbidden during these months.",
            description_bn="মুহাররম ইসলামের চারটি সম্মানিত মাসের প্রথম। এই মাসগুলোতে যুদ্ধ নিষিদ্ধ।",
            full_story_en="Allah says: 'Indeed, the number of months with Allah is twelve [in a year] — four of which are sacred.' (Quran 9:36). The four sacred months are: Muharram (1st), Rajab (7th), Dhul-Qi'dah (11th), and Dhul-Hijjah (12th). During these months, warfare, hunting, and other acts of aggression are forbidden. The sanctity predates Islam and was respected by the Arabs in the Jahiliyyah as a means of ensuring safe travel for trade and pilgrimage.",
            color_code="#EAB308",
            sources="Quran 9:36; Sahih al-Bukhari",
        ),
        IslamicEvent(
            title_en="Sacred Month of Rajab",
            title_bn="সম্মানিত মাস রজব",
            hijri_month=7, hijri_day=1,
            category=EventCategory.SPECIAL,
            description_en="Rajab is one of the four sacred months. The Isra and Mi'raj occurred in this month.",
            description_bn="রজব চারটি সম্মানিত মাসের একটি। এই মাসেই ইসরা ও মি'রাজ সংঘটিত হয়।",
            color_code="#EAB308",
            sources="Quran 9:36; Sahih al-Bukhari",
        ),
        IslamicEvent(
            title_en="Sacred Month of Dhul Qi'dah",
            title_bn="সম্মানিত মাস জ্বিল ক্বাদ",
            hijri_month=11, hijri_day=1,
            category=EventCategory.SPECIAL,
            description_en="Dhul Qi'dah is the third sacred month, traditionally a time of peace before Hajj.",
            description_bn="জ্বিল ক্বাদ তৃতীয় সম্মানিত মাস, হজের পূর্বে ঐতিহ্যগতভাবে শান্তির সময়।",
            color_code="#EAB308",
            sources="Quran 9:36",
        ),
        IslamicEvent(
            title_en="Sacred Month of Dhul Hijjah",
            title_bn="সম্মানিত মাস জ্বিল হজ্জ",
            hijri_month=12, hijri_day=1,
            category=EventCategory.SPECIAL,
            description_en="The fourth sacred month and the month of Hajj. The first 10 days are the most blessed of the year.",
            description_bn="চতুর্থ সম্মানিত মাস ও হজের মাস। প্রথম ১০ দিন বছরের সবচেয়ে বরকতময়।",
            full_story_en="The Prophet ﷺ said: 'There are no days in which righteous deeds are more beloved to Allah than these ten days.' (Sahih al-Bukhari 969). Muslims are encouraged to fast, give charity, recite takbirat, and perform good deeds. The 9th is the Day of Arafah, the 10th is Eid al-Adha, and the days after are the Days of Tashreeq.",
            color_code="#EAB308",
            sources="Sahih al-Bukhari 969; Quran 22:27-29",
        ),
        IslamicEvent(
            title_en="White Days (Ayyam al-Bid) — 13th",
            title_bn="সাদা দিবসসমূহ — ১৩",
            hijri_month=1, hijri_day=13,
            category=EventCategory.SPECIAL,
            description_en="The 13th, 14th, and 15th of each Hijri month are the 'White Days'. The Prophet ﷺ recommended fasting these days, like fasting three days a month.",
            description_bn="প্রতি হিজরী মাসের ১৩, ১৪ ও ১৫ তারিখ 'সাদা দিবস'। নবী ﷺ এই দিনগুলোতে রোজা রাখার সুপারিশ করেছেন, যেন মাসে তিন দিন রোজা রাখার সমান।",
            full_story_en="These days are called 'Ayyam al-Bid' because the moon is full and bright — 'bid' meaning white. The Prophet ﷺ said: 'Observe the fast of three days of every month, for indeed, fasting three days of every month is equal to fasting the whole year.' (Sahih al-Bukhari 1974). Many scholars specifically recommend fasting the 13th, 14th, and 15th.",
            color_code="#EAB308",
            sources="Sahih al-Bukhari 1974; Sahih Muslim 1160",
        ),
        IslamicEvent(
            title_en="White Days (Ayyam al-Bid) — 14th",
            title_bn="সাদা দিবসসমূহ — ১৪",
            hijri_month=1, hijri_day=14,
            category=EventCategory.SPECIAL,
            description_en="The 14th of each Hijri month — the middle of the three White Days. Recommended to fast.",
            description_bn="প্রতি হিজরী মাসের ১৪ তারিখ — সাদা দিবসের মধ্যটি। রোজা রাখার সুপারিশ।",
            color_code="#EAB308",
            sources="Sahih al-Bukhari 1974",
        ),
        IslamicEvent(
            title_en="White Days (Ayyam al-Bid) — 15th",
            title_bn="সাদা দিবসসমূহ — ১৫",
            hijri_month=1, hijri_day=15,
            category=EventCategory.SPECIAL,
            description_en="The 15th of each Hijri month — the last of the three White Days. Recommended to fast.",
            description_bn="প্রতি হিজরী মাসের ১৫ তারিখ — সাদা দিবসের শেষটি। রোজা রাখার সুপারিশ।",
            color_code="#EAB308",
            sources="Sahih al-Bukhari 1974",
        ),
        IslamicEvent(
            title_en="Six Days of Shawwal",
            title_bn="শাওয়ালের ছয় দিন",
            hijri_month=10, hijri_day=2,
            category=EventCategory.SPECIAL,
            description_en="The six days of Shawwal after Eid al-Fitr are a Sunnah fast recommended by the Prophet ﷺ. Whoever fasts them earns reward as if they fasted the whole year.",
            description_bn="ঈদুল ফিতরের পর শাওয়ালের ছয় দিন নবী ﷺ এর সুন্নাহ অনুযায়ী রোজা রাখা সুপারিশ। যে এগুলো রাখে, সে যেন পুরো বছর রোজা রাখার সমান সওয়াব পায়।",
            full_story_en="The Prophet ﷺ said: 'Whoever fasts Ramadan and then follows it with six days of Shawwal, it is as if he fasted the whole year.' (Sahih Muslim 1164). These can be fasted consecutively after Eid or distributed throughout the month. Many scholars note that since Ramadan is 30 days and the six days of Shawwal equal 36, the reward is multiplied tenfold by Allah — totaling 360 days, a full year.",
            color_code="#EAB308",
            sources="Sahih Muslim 1164",
        ),
        IslamicEvent(
            title_en="Mid-Sha'ban (Laylat al-Bara'ah)",
            title_bn="মধ্য-শাবান (লাইলাতুল বারাআহ)",
            hijri_month=8, hijri_day=15,
            category=EventCategory.SPECIAL,
            description_en="The 15th of Sha'ban. The Prophet ﷺ used to fast this day and the day before. Allah descends to the lowest heaven and forgives sinners.",
            description_bn="১৫ শাবান। নবী ﷺ এই দিন ও এর আগের দিন রোজা রাখতেন। আল্লাহ নিম্নতম আসমানে অবতরণ করেন এবং গুনাহগারদের ক্ষমা করেন।",
            full_story_en=(
                "Aisha (RA) reported: The Prophet ﷺ used to fast the 15th of "
                "Sha'ban more than any other day of the month, and he used "
                "to say — On the night of the 15th of Sha'ban, Allah "
                "descends to the lowest heaven and forgives more than the "
                "number of hairs on the sheep of the tribe of Kalb "
                "(Sunan al-Nasa'i). Many scholars recommend fasting on the "
                "13th, 14th, and 15th of Sha'ban as a sign of love for "
                "the Prophet's Sunnah."
            ),
            color_code="#EAB308",
            sources="Sunan al-Nasa'i 1361; Ibn Majah 1389",
        ),
        IslamicEvent(
            title_en="Standing at Arafah (Hajj Day)",
            title_bn="আরাফাতে অবস্থান",
            hijri_month=12, hijri_day=9,
            category=EventCategory.SPECIAL,
            description_en="The Day of Standing at Arafah during Hajj. The most important day of the pilgrimage. Also recommended for non-pilgrims to fast this day.",
            description_bn="হজের সময় আরাফাতে অবস্থানের দিন। হজের সবচেয়ে গুরুত্বপূর্ণ দিন। যারা হজে নেই তাদের জন্যও এই দিনে রোজা রাখা সুপারিশ।",
            full_story_en="See 'Day of Arafah' under Holidays. The standing at Arafah from noon to sunset is the most crucial pillar of Hajj. The Prophet ﷺ said: 'Whoever stands at Arafah and catches the night before (i.e. the night of Arafah) has completed his Hajj.' For non-pilgrims, fasting this day expiates the sins of the previous and coming year (Sahih Muslim 1162).",
            color_code="#EAB308",
            sources="Sahih Muslim 1162",
        ),
    ]

    db.add_all(defaults)
    db.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/events", response_model=List[IslamicEventResponse])
def list_events(
    month: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _seed_default_events(db)
    query = db.query(IslamicEvent)
    if month is not None:
        query = query.filter(IslamicEvent.hijri_month == month)
    return query.order_by(
        IslamicEvent.hijri_month.asc(), IslamicEvent.hijri_day.asc()
    ).all()


@router.get("/events/{event_id}", response_model=IslamicEventResponse)
def get_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(IslamicEvent).filter(IslamicEvent.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.post(
    "/events",
    response_model=IslamicEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    payload: IslamicEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    event = IslamicEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=IslamicEventResponse)
def update_event(
    event_id: int,
    payload: IslamicEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    event = db.query(IslamicEvent).filter(IslamicEvent.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    event = db.query(IslamicEvent).filter(IslamicEvent.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    db.delete(event)
    db.commit()
    return None
