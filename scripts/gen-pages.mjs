// Dev-only: writes index.html (Arabic) and en.html (English) from one template so the two pages can never drift apart.
// Run:  node scripts/gen-pages.mjs      (no dependencies, no network). The site itself has no build step: the output is committed.
// Every fact below comes from the game repo (docs/game-design.md, src/game/copy.js, stats.js, clerkManifest.js, tuning.js, docs/design/estimation.md).
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const IG = 'https://www.instagram.com/maslaha_game'
const IG_OTHMAN = 'https://www.instagram.com/_othman_007_'
const IG_ADEL = 'https://www.instagram.com/adelgamal001'
const svg = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/></svg>'

// papers: [left %, size, delay s (negative = already falling), duration s, start angle, sideways px]
const PAPERS = [
  [6, 1, -2, 17, -20, 34], [20, 0.8, -9, 21, 14, -26], [36, 1.1, -5, 19, -8, 30], [52, 0.9, -13, 23, 24, -34],
  [67, 1, -7, 18, -30, 28], [82, 0.85, -15, 22, 10, -30], [93, 1.05, -3, 20, -14, 24], [45, 0.75, -11, 25, 28, -20],
]
const papers = PAPERS.map(([x, s, d, t, r, dx]) => `<i style="--x:${x}%;--s:${s};--d:${d}s;--t:${t}s;--r0:${r}deg;--dx:${dx}px"></i>`).join('')

const L = {
  ar: {
    lang: 'ar', dir: 'rtl', h1: 'قعدة مصلحة', file: 'index.html', other: 'en.html',
    title: 'قعدة مصلحة | لعبة بارتي مجانية عن ورق المصالح',
    desc: 'اتسابق مع صحابك تخلّص ورقك في المصلحة. وكمان استميشن، لعبة ورق شرق أوسطية. مجانية، من غير إعلانات، ومفيش ادفع عشان تكسب. قريب على iOS وأندرويد.',
    ogDesc: 'المكاتب قليلة. والناس كتير. والكل محتاج ختم. مجانية ومن غير إعلانات.',
    canonical: 'https://maslahagame.com/', ogTitle: 'قعدة مصلحة', fonts: ['baloo-arabic', 'lalezar-arabic', 'baloo-latin'],
    altLinks: '<link rel="alternate" hreflang="en" href="en.html">\n<link rel="alternate" hreflang="ar" href="index.html">',
    logoHref: 'index.html', logoText: 'قعدة مصلحة', navLabel: 'القائمة', igLabel: 'إنستجرام',
    nav: [['#how', 'بتتلعب إزاي'], ['#estimation', 'استميشن'], ['#ways', 'اكسب بطريقتك'], ['#play', 'تابعنا']],
    langLink: '<a class="lang" href="en.html" lang="en" hreflang="en">English</a>',
    h1sub: '<span class="ar" lang="en" dir="ltr">Qaadet Maslaha</span>',
    eyebrow: 'لعبة بارتي مجانية · من غير إعلانات · من 4 لـ 11 لاعب',
    tag: 'المكاتب قليلة. والناس كتير. والكل محتاج ختم.',
    lead: 'اتسابق مع صحابك تخلّص ورقك في مصلحة كلها طوابير وموظفين متنرفزين. والكسبان صاحب أعلى نقط، مش أول واحد يخلّص.',
    heroAlt: 'تلات لاعيبة بينطّوا على مكتب الموظف وفي إيدهم أختام',
    cta: 'تابعنا على إنستجرام وهنبلّغك يوم النزول', ctaGhost: 'شوف بتتلعب إزاي',
    stores: ['App Store · قريب', 'Google Play · قريب'],
    ticketSmall: 'رقمك', ticketNow: 'الدور على', stamp: 'مقبول؟',
    board: [
      'فتحي المقص بيبطّأ اللي حواليه', 'عبد الرحمن بيغرّقك استيكرات ونصايح', 'الحج ثلعوه بيجري ورا أقرب واحد',
      'الشحاتين بيجروا من الزلحاوي', 'الشحاتين مابيقربوش من أبلة صفاء', 'حمار جحا بيحجز لك مكانك',
      'نينجا الطابور بيعدّي من الزحمة', 'رأفت الهجام بيبدّل ورقه مع اللي يعدّي', 'عبده الكهربائي بيقطع النور على الكل',
      'آلاء بتدوّر لك على الملف الناقص',
    ],
    pledges: [
      ['ببلاش', 'مجانية', 'نزّلها وابدأ العب ببلاش. الشراء من جوه اللعبة اختياري.'],
      ['من غير<br>إعلانات', 'مفيش إعلانات خالص', 'مفيش إعلان بين الأدوار ولا في أي حتة. اللعبة وبس.'],
      ['عادلة', 'مفيش ادفع عشان تكسب', 'الفلوس مش بتشتري الفوز. الشخصيات متوازنة، والمهارة والحظ بيحسموا.'],
    ],
    stats: [[54, 'إجراء'], [216, 'موظف بمزاج'], [37, 'شخصية بقدرتها'], [11, 'لاعب في الأوضة']],
    how: {
      kicker: 'الخطوات', h2: 'بتتلعب إزاي؟', sub: 'ست خطوات، من أول ما تقعد لحد ما تعرف مين كسب.',
      steps: [
        { img: 'step-room', alt: 'لاعب داخل المصلحة ماسك ملفه وقدامه زحمة', h: 'اقعد القعدة',
          p: 'اعمل أوضة وابعت الكود لصحابك، أو ضيف بوتات. ولو حد فصل، بوت بياخد مكانه لحد ما يرجع.',
          chips: ['كود من 4 حروف', 'من 4 لـ 11 لاعب', 'ماتش قصير أو طويل'], ok: 'تمام' },
        { img: 'step-chars', alt: 'تلات شخصيات: جزار وطيار دليفري ورجل أعمال', h: 'اختار شخصيتك',
          p: 'كل شخصية ليها 13 نقطة على أربع ستات: قوة وسرعة وذكاء وشياكة. ومعاها قدرة واحدة بتكسر قاعدة.',
          chips: ['37 شخصية', 'قدرة واحدة لكل شخصية', 'ستات من 1 لـ 5'], ok: 'تمام' },
        { img: 'step-hazards', alt: 'شحاتين لازقين في لاعب والحج ثلعوه بيجري ورا حد', h: 'اجري على ورقك',
          p: 'ملفك فيه ورق (3 ورقات في الدور الأول)، وكل ورقة ليها شباك. دوّر عليها في المصلحة المتاهة. فيه شبابيك وهمية، وشحاتين بيلزقوا فيك، والحج ثلعوه بيجري ورا أقرب لاعب. والجري بياكل من طاقتك.',
          chips: ['ملف لكل لاعب', 'شبابيك وهمية', 'شحاتين وثلعوه'], ok: 'تمام' },
        { img: 'step-clerk', alt: 'موظف مسنود على إيده ورا الشباك وعلى المكتب ختم وشاي', h: 'خلّص الإجراء',
          p: 'فيه طابور على كل شباك، وكل واحد بيتخدم قدامك بيزوّد نرفزة الموظف. لما دورك ييجي، الموظف بيديك إجراء: لعبة قصيرة بمحاولات ووقت محدد. الرايق بيديك أكتر، والمتنرفز أقل. لو نجحت، ورقتك تتختم. والوقفة في الطابور بتاكل من صبرك.',
          chips: ['من 5 لـ 20 ثانية للمحاولة', 'من 1 لـ 5 محاولات', 'مزاج الموظف بيفرق'], ok: 'تمام' },
        { img: 'step-rest', alt: 'ركن استراحة فيه كراسي وغلاية شاي', h: 'استريح وبعدين الزعيم',
          p: 'اللي يخلّص ورقه يدخل الاستراحة، يرجّع جزء من طاقته وصبره، ويتفرج على الباقيين من المدرّج. وبعد آخر دور، الكل بيلعب تحدي الزعيم: 60 ثانية تعدّي فيها أكتر حواجز.',
          chips: ['استراحة بين الأدوار', 'إيموجي من المدرّج', 'تحدي الزعيم'], ok: 'تمام' },
        { img: 'step-result', alt: 'المصلحة وقت الغروب والناس خارجة منها', h: 'شوف مين كسب',
          p: 'النقط هي اللي بتحسم: أعلى مجموع في الأدوار كلها يكسب. وبتطلعلك إفادة رسمية فيها مركزك وأوسمة: أكتر معاملات، أقل محاولات، أكبر تحسن.',
          chips: ['النقط بتحسم', 'إفادة رسمية', '3 أوسمة'], ok: 'كسبت' },
      ],
      w: {
        code: 'كود الأوضة', roomCode: ['M', 'A', 'S', '7'],
        char: 'حمادة الجزار · 13 نقطة', st: ['قوة', 'سرعة', 'ذكاء', 'شياكة'],
        bars: ['طاقة', 'صبر'],
        mood: 'مزاج الموظف', moods: ['رايق', 'فايق', 'مزهّق', 'متنرفز', 'على آخره'],
        queue: 'مكانك في الطابور', go: 'دورك', stampT: 'تم',
        boss: 'تحدي الزعيم', sec: 'ث', gates: ['+1', '+1', '×2', '+1'],
        fax: 'إفادة رسمية', rank: 'المركز الأول',
      },
    },
    est: {
      kicker: 'استميشن', h2: 'وكمان استميشن',
      sub: 'لعبة ورق شرق أوسطية لأربعة لاعبين. كل واحد بياخد 13 كارت، ويقدّر عدد لمّاته ويحاول يعملها بالظبط، لا أكتر ولا أقل.',
      chips: ['4 لاعبين', 'ماتش 18 أو 10 أو 5 جولات', '5 مستويات بوتات', 'أونلاين مع صحابك بكود'],
      call: 'كول: 5 هارت',
    },
    ways: {
      kicker: 'الستات', h2: 'اكسب بطريقتك',
      sub: 'كل شخصية ليها 13 نقطة على أربع ستات، واللي عالي فيها هو طريقك للكسب. اختار الشخصية اللي تناسب أسلوبك.',
      cards: [
        { img: 'sabotage', label: 'في الممر', h: 'قوة عضلية', p: 'بتزق الأضعف وتقلل ضرر ثلعوه.', ex: 'مثال: حمادة الجزار' },
        { img: 'race', label: 'في السباق', h: 'سرعة', p: 'بتغيّر سرعة حركتك. توصل الأول وتسبق الزحمة.', ex: 'مثال: كيمو الدليفري' },
        { img: 'window2', label: 'في الخريطة', h: 'ذكاء', p: 'بتقلل كدب موظف الممر وبتكشفلك الشباك الوهمي من بعيد.', ex: 'مثال: أبلة صفاء' },
        { img: 'auction', label: 'على الشباك', h: 'شياكة', p: 'بتأثر على نرفزة الموظف. موظف أهدى يعني محاولات ووقت أكتر.', ex: 'مثال: باسم بيه' },
      ],
    },
    clerks: {
      kicker: 'الموظفين', h2: 'موظفين انت عارفهم',
      sub: 'كل إجراء ليه 4 موظفين، وكل موظف ليه 5 درجات مزاج. كل ما الموظف يتنرفز، محاولاتك أقل ووقتك أقصر.',
      chips: ['كل واحد بيتخدم قدامك بيزوّد نرفزته', 'الموظف بيفتكرك', 'وساعات يبقى غايب'],
      moods: ['رايق', 'فايق', 'مزهّق', 'متنرفز', 'على آخره'],
      alts: ['الموظف رايق ومكتبه مرتب', 'الموظف فايق وفيه شوية ورق على المكتب', 'الموظف مزهّق والورق بيزيد', 'الموظف متنرفز والورق كوم والشاي اتدلق', 'الموظف على آخره والورق مغطي المكتب'],
      bossH: 'وصلت آخر مصلحة؟',
      boss: 'يبقى عندك مقابلة مع آلاء عبد الهادي، سكرتيرة مدير المصلحة. بتبعتك للإجراء اللي إنت أضعف فيه، ومش هتدخل للمدير غير لما تعدّيه.',
    },
    chars: {
      kicker: 'شخصيتك', h2: 'اختار شخصيتك', alt: 'سيلفي زحمة لشخصيات المصلحة', cap: 'قعدة مصلحة',
      sub: '37 شخصية، كل واحدة ليها شغلانة محرجة وقدرة خاصة واحدة.',
      opts: [
        ['ابدأ بشخصيتين', 'أول ما تدخل معاك لحلوح هدية، تشتري بيها شخصيتين.'],
        ['قدرة واحدة لكل شخصية', 'بتكسر قاعدة واحدة بس. فتحي المقص بيبطّأ اللي حواليه، وحمار جحا بيحجز لك مكانك في الطابور.'],
        ['كمّل بلحلوح', 'لحلوح عملة بتتجمع من لعبك. تشتري بيها شخصيات جديدة.'],
      ],
    },
    custom: {
      kicker: 'وشّك وحبرنا', h2: 'شخصيتك بوشّك', soon: 'قريب',
      sub: 'عايز تلعب بنفسك؟ ابعتلنا صورتك على إنستجرام ونرسمك بستايل اللعبة، وتبقى شخصية في اللعبة للكل.',
      price: 'مرة واحدة، من جوه اللعبة', sub2: 'شكل بس، من غير أي ميزة في اللعب.',
      facts: ['رسم فريقنا', 'شكلك بستايلنا', 'من غير أي ميزة في اللعب'],
      cta: 'ابعتلنا على إنستجرام', aria: 'مثال: عثمان',
      photoAlt: 'عثمان', charAlt: 'عثمان — في اللعبة', cap: 'في اللعبة', turnAlt: 'شخصية عثمان من أربع زوايا', turn: 'جاهز للطابور، من كل الزوايا',
    },
    maker: {
      kicker: 'اللي ورا اللعبة', h2: 'مين ورا القعدة؟',
      p1: 'أنا عادل جمال، كريتيف دايركتور بقالي 16 سنة في الإعلانات. ومش مبرمج.',
      p2: 'كل ما ألعب لعبة أحس إن فيها حاجة ناقصة. فقلت: ما أعمل أنا اللعبة اللي نفسي ألعبها؟ الفكرة والقواعد والشخصيات والموظفين والنكت، كلها من تأليفي. والكود كله؟ ده شغل الـ AI. اشتغلنا كتف في كتف: أنا المخ، وهو العضلات 😄',
      facts: ['الفكرة والتصميم: عادل', 'الكود: AI', 'كتف في كتف'], follow: '@adelgamal001',
      seals: [['المخ', 'عادل'], ['العضلات', 'الـ AI']],
    },
    final: {
      kicker: 'يوم النزول', h2: 'عايز تلعبها أول واحد؟', sub: 'تابعنا على إنستجرام وهنبلّغك يوم النزول.', stamp: 'تابعنا',
    },
    footer: { by: '© 2026 قعدة مصلحة · من صنع', byName: 'عادل جمال', navLabel: 'معلومات اللعبة',
      links: [['privacy.html', 'الخصوصية'], ['terms.html', 'الشروط'], ['support.html', 'الدعم'], ['account-deletion.html', 'حذف البيانات']], ig: 'إنستجرام' },
  },
  en: {
    lang: 'en', dir: 'ltr', h1: 'Qaadet Maslaha', file: 'en.html', other: 'index.html',
    title: 'Qaadet Maslaha | A free party game about Egyptian paperwork',
    desc: 'Race your friends through Egyptian paperwork. Plus Estimation, a Middle Eastern card game. Free, no ads, no pay-to-win. Coming to iOS and Android.',
    ogDesc: 'Too few desks. Too many people. Everyone needs a stamp. Free, no ads, no pay-to-win.',
    canonical: 'https://maslahagame.com/en.html', ogTitle: 'Qaadet Maslaha', fonts: ['baloo-latin', 'lalezar-arabic', 'baloo-arabic'],
    altLinks: '<link rel="alternate" hreflang="ar" href="index.html">\n<link rel="alternate" hreflang="en" href="en.html">',
    logoHref: 'en.html', logoText: 'Qaadet Maslaha', navLabel: 'Main', igLabel: 'Instagram',
    nav: [['#how', 'How it plays'], ['#estimation', 'Estimation'], ['#ways', 'Win your way'], ['#play', 'Follow us']],
    langLink: '<a class="lang ar" href="index.html" lang="ar" hreflang="ar">عربي</a>',
    h1sub: '<span class="ar" lang="ar">قعدة مصلحة</span>',
    eyebrow: 'Free party game · No ads · 4–11 players',
    tag: 'Too few desks. Too many people. Everyone needs a stamp.',
    lead: 'Race your friends to get your papers stamped in an office full of queues and grumpy clerks. The winner has the most points, not the first one out.',
    heroAlt: 'Three players dive toward a clerk’s desk, rubber stamps in hand',
    cta: 'Follow us on Instagram and we’ll tell you launch day', ctaGhost: 'See how it plays',
    stores: ['App Store · soon', 'Google Play · soon'],
    ticketSmall: 'Your number', ticketNow: 'Now serving', stamp: 'APPROVED?',
    board: [
      'Fathy the barber slows everyone near him', 'Abdelrahman floods you with stickers and advice', 'Haj Thal3awa chases whoever is closest',
      'Beggars run away from El-Zalhawy', 'Beggars keep away from Miss Safaa', 'Goha’s donkey holds your place in line',
      'Queue Ninja walks straight through the crowd', 'Raafat the swindler swaps papers with passers-by', 'Abdo the electrician cuts the lights',
      'Alaa is looking for your missing file',
    ],
    pledges: [
      ['FREE', 'Free to play', 'Download it and start playing for free. Buying things inside the game is optional.'],
      ['NO<br>ADS', 'No ads. Ever.', 'No pop-ups between rounds, or anywhere else. Just the game.'],
      ['FAIR', 'No pay-to-win', 'Money doesn’t buy the win. Characters are balanced; skill and luck decide.'],
    ],
    stats: [[54, 'procedures'], [216, 'moody clerks'], [37, 'characters'], [11, 'players per room']],
    how: {
      kicker: 'The steps', h2: 'How it plays', sub: 'Six steps, from taking a seat to finding out who won.',
      steps: [
        { img: 'step-room', alt: 'A player walks into the office holding his file, a crowd behind him', h: 'Take a seat',
          p: 'Make a room and send the code to your friends, or add bots. If someone drops, a bot takes their seat until they’re back.',
          chips: ['4-letter code', '4–11 players', 'Short or long match'], ok: 'OK' },
        { img: 'step-chars', alt: 'Three characters: a butcher, a delivery rider and a businessman', h: 'Pick your character',
          p: 'Every character has 13 points across four stats: strength, speed, intellect and style. Each also has one ability that bends a single rule.',
          chips: ['37 characters', 'One ability each', 'Stats from 1 to 5'], ok: 'OK' },
        { img: 'step-hazards', alt: 'Beggars stuck to a player while Haj Thal3awa runs after someone', h: 'Run for your papers',
          p: 'Your file has papers (three in round one), and each paper has its own window. Find them in the maze of an office. There are fake windows, beggars who stick to you, and Haj Thal3awa chasing the closest player. Running drains your energy.',
          chips: ['A file per player', 'Fake windows', 'Beggars and Thal3awa'], ok: 'OK' },
        { img: 'step-clerk', alt: 'A clerk leaning on his hand behind the window, a stamp and tea on the desk', h: 'Finish the procedure',
          p: 'Every window has a queue, and each person served ahead of you makes the clerk grumpier. When your turn comes, the clerk gives you a procedure: a short game with limited attempts and time. A calm clerk gives you more, a grumpy one less. Win it and your paper gets stamped. Waiting in line drains your patience.',
          chips: ['5–20 seconds per attempt', '1 to 5 attempts', 'The clerk’s mood matters'], ok: 'OK' },
        { img: 'step-rest', alt: 'A rest corner with chairs and a tea kettle', h: 'Rest, then the boss',
          p: 'Whoever finishes their papers goes to the rest area, wins back some energy and patience, and watches the others from the stands. After the last round, everyone plays the boss challenge: 60 seconds to pass as many obstacles as you can.',
          chips: ['Rest between rounds', 'Emoji from the stands', 'Boss challenge'], ok: 'OK' },
        { img: 'step-result', alt: 'The office at sunset with people leaving', h: 'See who won',
          p: 'Points decide: the highest total over all the rounds wins. You get an official statement with your rank and medals: most papers, fewest attempts, biggest climb.',
          chips: ['Points decide', 'Official statement', '3 medals'], ok: 'WON' },
      ],
      w: {
        code: 'Room code', roomCode: ['M', 'A', 'S', '7'],
        char: 'Hamada the Butcher · 13 points', st: ['Strength', 'Speed', 'Intellect', 'Style'],
        bars: ['Energy', 'Patience'],
        mood: 'Clerk mood', moods: ['Calm', 'Alert', 'Fed up', 'Irritated', 'At the limit'],
        queue: 'Your place in line', go: 'You’re up', stampT: 'OK',
        boss: 'Boss challenge', sec: 's', gates: ['+1', '+1', '×2', '+1'],
        fax: 'Official statement', rank: '1st place',
      },
    },
    est: {
      kicker: 'Estimation', h2: 'And Estimation, too',
      sub: 'A Middle Eastern trick-taking card game for four. Everyone gets 13 cards, estimates how many tricks they’ll win, and tries to hit that number exactly. No more, no less.',
      chips: ['4 players', 'Matches of 18, 10 or 5 rounds', '5 bot levels', 'Online with friends by code'],
      call: 'Call: 5 Hearts',
    },
    ways: {
      kicker: 'The stats', h2: 'Win your way',
      sub: 'Every character has 13 points spread over four stats, and what’s high is your way to win. Pick the character that fits how you play.',
      cards: [
        { img: 'sabotage', label: 'In the hallway', h: 'Strength', p: 'Pushes weaker players aside and cuts the damage from Haj Thal3awa.', ex: 'Try: Hamada the Butcher' },
        { img: 'race', label: 'In the race', h: 'Speed', p: 'Changes how fast you move. Get there first and beat the crowd.', ex: 'Try: Kimo the Delivery Rider' },
        { img: 'window2', label: 'On the map', h: 'Intellect', p: 'Makes the hallway clerk lie less and shows you fake windows from far away.', ex: 'Try: Miss Safaa' },
        { img: 'auction', label: 'At the window', h: 'Style', p: 'Changes how irritated the clerks get with you. A calmer clerk means more attempts and time.', ex: 'Try: Basem Bey' },
      ],
    },
    clerks: {
      kicker: 'The clerks', h2: 'Clerks you already know',
      sub: 'Every procedure has four clerks, and each clerk has five moods. The grumpier the clerk, the fewer your attempts and the shorter your time.',
      chips: ['Everyone served ahead of you makes them grumpier', 'They remember you', 'Some days they don’t show up'],
      moods: ['Calm', 'Alert', 'Fed up', 'Irritated', 'At the limit'],
      alts: ['A calm clerk with a tidy desk', 'An alert clerk with a few papers on the desk', 'A fed-up clerk with papers piling up', 'An irritated clerk, papers heaped and tea spilled', 'A clerk at the limit, papers covering the desk'],
      bossH: 'Reached the last office?',
      boss: 'Then you have an appointment with Alaa Abdel-Hady, the director’s secretary. She sends you to the procedure you’re weakest at, and you don’t get in to see the director until you pass it.',
    },
    chars: {
      kicker: 'Your character', h2: 'Pick your character', alt: 'A crowded group selfie of quirky office characters', cap: 'قعدة مصلحة',
      sub: '37 characters, each with an embarrassing job title and one special ability.',
      opts: [
        ['Start with two', 'You get free Lahloh the first time in, enough to buy two characters.'],
        ['One ability each', 'It bends a single rule. Fathy the Barber slows everyone near him, and Goha’s donkey holds your place in line.'],
        ['Keep going with Lahloh', 'Lahloh is a coin you collect by playing. Use it to buy new characters.'],
      ],
    },
    custom: {
      kicker: 'Your face. Our ink.', h2: 'Your character, your face', soon: 'SOON',
      sub: 'Want to play as yourself? Send us your photo on Instagram and we’ll draw you in the game’s style, as a character everyone can play.',
      price: 'One time, from inside the game', sub2: 'Looks only. No advantage in play.',
      facts: ['Drawn by our team', 'Your look, our style', 'No gameplay advantage'],
      cta: 'Message us on Instagram', aria: 'Example: Othman',
      photoAlt: 'Othman', charAlt: 'Othman — in the game', cap: 'In the game', turnAlt: 'Othman’s character from four angles', turn: 'Ready to queue, from every angle',
    },
    maker: {
      kicker: 'About the maker', h2: 'Who’s behind it?',
      p1: 'I’m Adel Gamal, a creative director with 16 years in advertising. Not a programmer.',
      p2: 'Every game I play feels like it’s missing something. So I thought: why not make the one I actually want to play? The idea, the rules, the characters, the clerks, the jokes: all mine. The code? All AI. We worked shoulder to shoulder: I’m the brains, it’s the muscle 😄',
      facts: ['Idea &amp; design: Adel', 'Code: AI', 'Shoulder to shoulder'], follow: 'Follow @adelgamal001',
      seals: [['The brains', 'Adel'], ['The muscle', 'The AI']],
    },
    final: {
      kicker: 'Launch day', h2: 'Want to be first in line?', sub: 'Follow us on Instagram and we’ll tell you launch day.', stamp: 'FOLLOW US',
    },
    footer: { by: '© 2026 Qaadet Maslaha · Made by', byName: 'Adel Gamal', navLabel: 'Game information',
      links: [['privacy-en.html', 'Privacy'], ['terms-en.html', 'Terms'], ['support-en.html', 'Support'], ['account-deletion-en.html', 'Data deletion']], ig: 'Instagram' },
  },
}

function page(c) {
  const w = c.how.w
  const imgSize = { 'step-room': [960, 540], 'step-chars': [960, 540], 'step-hazards': [960, 540], 'step-clerk': [960, 552], 'step-rest': [960, 679], 'step-result': [960, 717] }
  const widgets = [
    `<div class="wgt code" aria-hidden="true"><small>${w.code}</small><b>${w.roomCode.map((l) => `<span>${l}</span>`).join('')}</b><i class="joiners"><u></u><u></u><u></u><u></u></i></div>`,
    `<div class="wgt cstat" aria-hidden="true"><small>${w.char}</small>${[5, 2, 3, 3].map((n, i) => `<div class="sr" style="--n:${n};--k:${i}"><span>${w.st[i]}</span><i></i></div>`).join('')}</div>`,
    `<div class="wgt file" aria-hidden="true"><i></i><i></i><i></i></div><div class="bars" aria-hidden="true"><div class="bar nrg"><span>${w.bars[0]}</span><i></i></div><div class="bar pat"><span>${w.bars[1]}</span><i></i></div></div>`,
    `<div class="wgt visit" aria-hidden="true"><small>${w.mood}</small><b class="moodtxt">${w.moods.map((m) => `<span>${m}</span>`).join('')}</b><i class="tries"><u></u><u></u><u></u><u></u></i></div><div class="wgt queue" aria-hidden="true"><small>${w.queue}</small><b class="qn" data-go="${w.go}">3</b></div><div class="deskpaper" aria-hidden="true"></div><i class="bigstamp2" data-t="${w.stampT}" aria-hidden="true"></i>`,
    `<div class="wgt bchal" aria-hidden="true"><small>${w.boss}</small><b class="cd">60<small>${w.sec}</small></b><em class="bids">${w.gates.map((g) => `<u>${g}</u>`).join('')}</em></div>`,
    `<div class="wgt fax" aria-hidden="true"><small>${w.fax}</small><b>${w.rank}</b><i class="meds"><img src="img/medal-papers.webp" width="34" height="34" alt=""><img src="img/medal-attempts.webp" width="34" height="34" alt=""><img src="img/medal-climb.webp" width="34" height="34" alt=""></i></div>`,
  ]
  const steps = c.how.steps.map((s, i) => {
    const [iw, ih] = imgSize[s.img]
    return `    <li class="stepx reveal">
      <i class="inkline" aria-hidden="true"></i>
      <div class="stepx-pic"><img src="img/${s.img}.webp" width="${iw}" height="${ih}" alt="${s.alt}" loading="lazy">${widgets[i]}<span class="okx" aria-hidden="true">${s.ok}</span></div>
      <div class="stepx-txt"><span class="stepx-no">0${i + 1}</span><h3>${s.h}</h3><p>${s.p}</p><div class="chipsx">${s.chips.map((x) => `<span>${x}</span>`).join('')}</div></div>
    </li>`
  }).join('\n')
  const cards = ['QC', 'JD', 'KH', 'KD', 'QS'].map((id) => `      <div class="pc"><div class="pf"><img class="fr" src="img/est/${id}.webp" width="379" height="530" alt="" loading="lazy"><img class="bk" src="img/est/back.webp" width="379" height="530" alt="" loading="lazy"></div></div>`).join('\n')
  const ways = c.ways.cards.map((k) => `    <div class="card"><div class="pic"><img src="img/${k.img}.webp" alt="" loading="lazy"></div><div class="txt"><span class="suit">${k.label}</span><h3>${k.h}</h3><p>${k.p}</p><em>${k.ex}</em></div></div>`).join('\n')
  const ladder = c.clerks.moods.map((m, i) => `      <li class="rung reveal"><img src="img/mood-${i + 1}.webp" width="360" height="637" alt="${c.clerks.alts[i]}" loading="lazy"><span class="no" aria-hidden="true">${i + 1}</span><b>${m}</b></li>`).join('\n')
  const board = c.board.map((t) => `<span>${t}</span>`).join('')
  const pledges = c.pledges.map(([seal, b, s]) => `  <div class="pledge reveal"><span class="seal2" aria-hidden="true">${seal}</span><div><b>${b}</b><span>${s}</span></div></div>`).join('\n')
  const stats = c.stats.map(([n, t]) => `<div class="stat reveal"><b data-to="${n}">${n}</b><span>${t}</span></div>`).join('')
  const nav = c.nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')
  const opts = c.chars.opts.map(([b, s], i) => `      <div class="opt"><span class="ic">${i + 1}</span><div><b>${b}</b><span>${s}</span></div></div>`).join('\n')
  const dirAttr = c.dir === 'rtl' ? ' dir="rtl"' : ' dir="ltr"'
  return `<!doctype html>
<html lang="${c.lang}"${dirAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#cfe0ea">
<meta name="referrer" content="no-referrer">
<title>${c.title}</title>
<meta name="description" content="${c.desc}">
<meta property="og:title" content="${c.ogTitle}">
<meta property="og:description" content="${c.ogDesc}">
<link rel="canonical" href="${c.canonical}">
<meta property="og:image" content="https://maslahagame.com/img/race.webp">
${c.fonts.map((f) => `<link rel="preload" href="fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="stylesheet" href="home.css">
${c.altLinks}
</head>
<body>

<header class="nav"><div class="wrap">
  <a class="logo" href="${c.logoHref}"><span class="seal" aria-hidden="true">ق.م</span>${c.logoText}</a>
  <nav aria-label="${c.navLabel}"><a class="navig" href="${IG}" rel="noopener noreferrer" aria-label="${c.igLabel}">${svg}</a>${nav}${c.langLink}</nav>
</div></header>
<div class="qprog" aria-hidden="true"><i></i></div>

<main id="content">
<div class="hero"><div class="papers" aria-hidden="true">${papers}</div><div class="wrap">
  <div>
    <span class="eyebrow"><span class="dot"></span>${c.eyebrow}</span>
    <h1>${c.h1}${c.h1sub}</h1>
    <p class="tag">${c.tag}</p>
    <p class="lead">${c.lead}</p>
    <div class="cta-row">
      <a class="btn" href="${IG}" rel="noopener noreferrer">${svg}${c.cta}</a>
      <a class="btn ghost" href="#how">${c.ctaGhost}</a>
    </div>
    <div class="stores"><span class="store">${c.stores[0]}</span><span class="store">${c.stores[1]}</span></div>
  </div>
  <div class="art">
    <div class="frame"><img src="img/race.webp" width="900" height="1200" alt="${c.heroAlt}" fetchpriority="high"></div>
    <div class="ticket" aria-hidden="true"><small>${c.ticketSmall}</small><b data-roll="047">047</b><div class="perf">${c.ticketNow} <span id="num" data-roll="012">012</span></div></div>
    <div class="stampmark" aria-hidden="true">${c.stamp}</div>
  </div>
</div></div>

<div class="board" aria-hidden="true"><div class="track">
  ${board}
  ${board}
</div></div>

<div class="promise"><div class="wrap">
${pledges}
</div></div>

<div class="stats"><div class="wrap">${stats}</div></div>

<section id="how" class="how"><div class="wrap">
  <p class="kicker">${c.how.kicker}</p>
  <h2>${c.how.h2}</h2>
  <p class="sub">${c.how.sub}</p>
  <ol class="flow">
${steps}
  </ol>
</div></section>

<section id="estimation" class="est">
  <div class="bg" style="background-image:url(img/cafe.webp)" aria-hidden="true"></div>
  <div class="wrap">
    <div class="reveal">
      <p class="kicker">${c.est.kicker}</p>
      <h2>${c.est.h2}</h2>
      <p class="sub">${c.est.sub}</p>
      <div class="chips">${c.est.chips.map((x) => `<span>${x}</span>`).join('')}</div>
    </div>
    <div class="fan" aria-hidden="true" dir="ltr">
${cards}
      <span class="call" dir="${c.dir}">${c.est.call}</span>
    </div>
  </div>
</section>

<section id="ways" class="ways"><div class="wrap">
  <p class="kicker">${c.ways.kicker}</p>
  <h2>${c.ways.h2}</h2>
  <p class="sub">${c.ways.sub}</p>
  <div class="hand reveal">
${ways}
  </div>
</div></section>

<section id="clerks" class="clerks"><div class="wrap">
  <div class="reveal">
    <p class="kicker">${c.clerks.kicker}</p>
    <h2>${c.clerks.h2}</h2>
    <p class="sub">${c.clerks.sub}</p>
    <div class="moods">${c.clerks.chips.map((x) => `<span class="mood">${x}</span>`).join('')}</div>
  </div>
  <ol class="ladder">
${ladder}
  </ol>
  <div class="boss reveal"><div class="door" aria-hidden="true"></div><div><b>${c.clerks.bossH}</b>${c.clerks.boss}</div></div>
</div></section>

<section class="chars"><div class="wrap">
  <figure class="polaroid reveal"><img src="img/selfie.webp" width="900" height="1200" alt="${c.chars.alt}" loading="lazy"><figcaption${c.lang === 'en' ? ' class="ar" lang="ar"' : ''}>${c.chars.cap}</figcaption></figure>
  <div class="reveal">
    <p class="kicker">${c.chars.kicker}</p>
    <h2>${c.chars.h2}</h2>
    <p class="sub">${c.chars.sub}</p>
    <div class="opts">
${opts}
    </div>
  </div>
</div></section>

<section id="custom" class="custom"><div class="wrap">
  <div class="reveal">
    <p class="kicker">${c.custom.kicker}</p>
    <h2>${c.custom.h2} <span class="soon">${c.custom.soon}</span></h2>
    <p class="sub">${c.custom.sub}</p>
    <span class="price">${c.custom.price}</span>
    <p class="sub">${c.custom.sub2}</p>
    <div class="facts-row">${c.custom.facts.map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="cta-row" style="margin-top:24px"><a class="btn" href="${IG}" rel="noopener noreferrer">${svg}${c.custom.cta}</a></div>
  </div>
  <div class="case reveal" aria-label="${c.custom.aria}">
    <figure><img src="img/othman-photo.webp" width="720" height="960" alt="${c.custom.photoAlt}" loading="lazy"><figcaption><a href="${IG_OTHMAN}" rel="noopener noreferrer" dir="ltr">@_othman_007_</a></figcaption></figure>
    <span class="arrow" aria-hidden="true">→</span>
    <figure><img src="img/othman-char.webp" width="720" height="960" alt="${c.custom.charAlt}" loading="lazy"><figcaption>${c.custom.cap}</figcaption></figure>
    <div class="turn"><img src="img/othman-turn.webp" width="1100" height="629" alt="${c.custom.turnAlt}" loading="lazy"><span>${c.custom.turn}</span></div>
  </div>
</div></section>

<section id="maker" class="maker"><div class="wrap">
  <div class="seals reveal" aria-hidden="true">${c.maker.seals.map(([b, s]) => `<div class="seal3"><b>${b}</b><span>${s}</span></div>`).join('')}</div>
  <div class="reveal">
    <p class="kicker">${c.maker.kicker}</p>
    <h2>${c.maker.h2}</h2>
    <p class="sub">${c.maker.p1}</p>
    <p class="sub">${c.maker.p2}</p>
    <div class="facts-row">${c.maker.facts.map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="cta-row" style="margin-top:24px"><a class="btn ghost" href="${IG_ADEL}" rel="noopener noreferrer">${svg}<span dir="ltr">${c.maker.follow}</span></a></div>
  </div>
</div></section>

<section id="play" class="final"><div class="wrap">
  <p class="kicker">${c.final.kicker}</p>
  <h2>${c.final.h2}</h2>
  <p class="sub">${c.final.sub}</p>
  <a class="bigstamp" href="${IG}" rel="noopener noreferrer">${c.final.stamp}</a>
  <a class="handle" href="${IG}" rel="noopener noreferrer" dir="ltr">@maslaha_game</a>
</div></section>
</main>

<footer><div class="wrap">
  <small>${c.footer.by} <a href="${IG_ADEL}" rel="noopener noreferrer">${c.footer.byName}</a></small>
  <nav aria-label="${c.footer.navLabel}">${c.footer.links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="${IG}" rel="noopener noreferrer">${c.footer.ig}</a></nav>
</div></footer>

<script src="home.js" defer></script>
</body>
</html>
`
}

for (const c of Object.values(L)) writeFileSync(join(root, c.file), page(c))
console.log('wrote index.html and en.html')
