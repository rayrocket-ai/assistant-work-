/**
 * Single source of truth for the lead form flow and all bilingual copy.
 *
 * Every user-facing string is an object { en, fa } where `fa` is Dari
 * (Afghan Persian, right-to-left). The same config drives both the public
 * form (rendered dynamically on the client) and server-side validation, so
 * there is exactly one place to edit questions or translations.
 */

const t = (en, fa) => ({ en, fa });

// ---- Qualifying question sets, keyed by intent -----------------------------

const BUY_QUESTIONS = [
  {
    id: 'propertyType',
    type: 'buttons',
    required: true,
    label: t('What type of property?', 'چه نوع ملکی؟'),
    options: [
      { value: 'house', label: t('House', 'خانه') },
      { value: 'apartment', label: t('Apartment', 'آپارتمان') },
      { value: 'land', label: t('Land', 'زمین') },
      { value: 'commercial', label: t('Commercial', 'تجاری') },
      { value: 'other', label: t('Other', 'دیگر') },
    ],
  },
  {
    id: 'area',
    type: 'text',
    required: true,
    label: t('Which area or city?', 'کدام منطقه یا شهر؟'),
    placeholder: t('e.g. Kabul, Wazir Akbar Khan', 'مثلاً کابل، وزیر اکبر خان'),
  },
  {
    id: 'budget',
    type: 'select',
    required: true,
    label: t('Your budget (USD)', 'بودجه شما (دالر)'),
    options: [
      { value: 'under_25k', label: t('Under $25,000', 'کمتر از ۲۵٬۰۰۰ دالر') },
      { value: '25k_50k', label: t('$25,000 – $50,000', '۲۵٬۰۰۰ تا ۵۰٬۰۰۰ دالر') },
      { value: '50k_100k', label: t('$50,000 – $100,000', '۵۰٬۰۰۰ تا ۱۰۰٬۰۰۰ دالر') },
      { value: '100k_250k', label: t('$100,000 – $250,000', '۱۰۰٬۰۰۰ تا ۲۵۰٬۰۰۰ دالر') },
      { value: '250k_plus', label: t('$250,000+', 'بیشتر از ۲۵۰٬۰۰۰ دالر') },
      { value: 'unsure', label: t('Not sure yet', 'هنوز مطمئن نیستم') },
    ],
  },
  {
    id: 'financing',
    type: 'buttons',
    required: true,
    label: t('How will you pay?', 'نحوه پرداخت؟'),
    options: [
      { value: 'cash', label: t('Cash', 'نقد') },
      { value: 'loan', label: t('Bank loan', 'قرضه بانکی') },
      { value: 'need_help', label: t('Need financing help', 'به کمک برای تأمین مالی نیاز دارم') },
      { value: 'unsure', label: t('Not sure', 'مطمئن نیستم') },
    ],
  },
  {
    id: 'timeline',
    type: 'buttons',
    required: true,
    label: t('When do you want to buy?', 'چه زمانی می‌خواهید بخرید؟'),
    options: [
      { value: 'asap', label: t('As soon as possible', 'هرچه زودتر') },
      { value: '1_3m', label: t('1–3 months', '۱ تا ۳ ماه') },
      { value: '3_6m', label: t('3–6 months', '۳ تا ۶ ماه') },
      { value: '6m_plus', label: t('More than 6 months', 'بیشتر از ۶ ماه') },
      { value: 'browsing', label: t('Just browsing', 'فقط در حال جستجو') },
    ],
  },
  {
    id: 'notes',
    type: 'textarea',
    required: false,
    label: t('Anything else we should know?', 'چیز دیگری که باید بدانیم؟'),
    placeholder: t('Optional', 'اختیاری'),
  },
];

const SELL_QUESTIONS = [
  {
    id: 'propertyType',
    type: 'buttons',
    required: true,
    label: t('What type of property?', 'چه نوع ملکی؟'),
    options: [
      { value: 'house', label: t('House', 'خانه') },
      { value: 'apartment', label: t('Apartment', 'آپارتمان') },
      { value: 'land', label: t('Land', 'زمین') },
      { value: 'commercial', label: t('Commercial', 'تجاری') },
      { value: 'other', label: t('Other', 'دیگر') },
    ],
  },
  {
    id: 'area',
    type: 'text',
    required: true,
    label: t('Where is the property?', 'ملک کجا واقع است؟'),
    placeholder: t('e.g. Kabul, Wazir Akbar Khan', 'مثلاً کابل، وزیر اکبر خان'),
  },
  {
    id: 'askingPrice',
    type: 'text',
    required: false,
    label: t('Your asking price (USD)', 'قیمت پیشنهادی شما (دالر)'),
    placeholder: t('e.g. 120,000 (or leave blank)', 'مثلاً ۱۲۰٬۰۰۰ (یا خالی بگذارید)'),
  },
  {
    id: 'status',
    type: 'buttons',
    required: true,
    label: t('Current status of the property', 'وضعیت فعلی ملک'),
    options: [
      { value: 'vacant', label: t('Vacant', 'خالی') },
      { value: 'owner_occupied', label: t('I live in it', 'خودم در آن زندگی می‌کنم') },
      { value: 'rented', label: t('Rented out', 'اجاره داده شده') },
    ],
  },
  {
    id: 'timeline',
    type: 'buttons',
    required: true,
    label: t('How soon do you want to sell?', 'چه زمانی می‌خواهید بفروشید؟'),
    options: [
      { value: 'asap', label: t('As soon as possible', 'هرچه زودتر') },
      { value: '1_3m', label: t('1–3 months', '۱ تا ۳ ماه') },
      { value: '3_6m', label: t('3–6 months', '۳ تا ۶ ماه') },
      { value: 'flexible', label: t('Flexible', 'انعطاف‌پذیر') },
      { value: 'testing', label: t('Just testing the market', 'فقط بازار را می‌سنجم') },
    ],
  },
  {
    id: 'notes',
    type: 'textarea',
    required: false,
    label: t('Anything else we should know?', 'چیز دیگری که باید بدانیم؟'),
    placeholder: t('Optional', 'اختیاری'),
  },
];

const GENERAL_QUESTIONS = [
  {
    id: 'subject',
    type: 'text',
    required: true,
    label: t('What is your inquiry about?', 'پرسش شما در مورد چیست؟'),
    placeholder: t('e.g. rental, consultation, partnership', 'مثلاً اجاره، مشوره، همکاری'),
  },
  {
    id: 'message',
    type: 'textarea',
    required: true,
    label: t('Your message', 'پیام شما'),
    placeholder: t('Tell us how we can help', 'بگویید چطور می‌توانیم کمک کنیم'),
  },
];

// ---- Shared contact step (asked for every intent) --------------------------

const CONTACT_QUESTIONS = [
  {
    id: 'name',
    type: 'text',
    required: true,
    label: t('Your name', 'نام شما'),
    placeholder: t('Full name', 'نام کامل'),
  },
  {
    id: 'phone',
    type: 'tel',
    required: true,
    label: t('Phone number', 'شماره تماس'),
    placeholder: t('e.g. +93 700 000 000', 'مثلاً ۰۰۰ ۰۰۰ ۷۰۰ ۹۳+'),
  },
  {
    id: 'preferredContact',
    type: 'buttons',
    required: true,
    label: t('Best way to reach you', 'بهترین راه برای تماس با شما'),
    options: [
      { value: 'whatsapp', label: t('WhatsApp', 'واتساپ') },
      { value: 'call', label: t('Phone call', 'تماس تلفنی') },
      { value: 'telegram', label: t('Telegram', 'تلگرام') },
      { value: 'email', label: t('Email', 'ایمیل') },
    ],
  },
  {
    id: 'contactHandle',
    type: 'text',
    required: false,
    label: t('Your WhatsApp / Telegram / email', 'واتساپ / تلگرام / ایمیل شما'),
    placeholder: t('Optional but helps us reply faster', 'اختیاری، اما به پاسخ سریع‌تر کمک می‌کند'),
  },
];

// ---- Top-level config ------------------------------------------------------

const config = {
  brand: {
    name: t('Real Estate Leads', 'معاملات املاک'),
    tagline: t(
      'Tell us what you need and our team will reach out.',
      'به ما بگویید چه می‌خواهید، تیم ما با شما تماس می‌گیرد.'
    ),
  },
  intents: [
    {
      id: 'buy',
      emoji: '🏠',
      label: t('I want to buy', 'می‌خواهم بخرم'),
      sub: t('Find a property to purchase', 'یافتن ملک برای خرید'),
      questions: BUY_QUESTIONS,
    },
    {
      id: 'sell',
      emoji: '💰',
      label: t('I want to sell', 'می‌خواهم بفروشم'),
      sub: t('List your property with us', 'ثبت ملک شما نزد ما'),
      questions: SELL_QUESTIONS,
    },
    {
      id: 'general',
      emoji: '💬',
      label: t('General inquiry', 'پرسش عمومی'),
      sub: t('Ask us anything else', 'هر پرسش دیگری'),
      questions: GENERAL_QUESTIONS,
    },
  ],
  contactQuestions: CONTACT_QUESTIONS,
  ui: {
    chooseLanguage: t('Language', 'زبان'),
    english: t('English', 'انگلیسی'),
    dari: t('دری', 'دری'),
    intro: t('How can we help you today?', 'امروز چطور می‌توانیم کمک کنیم؟'),
    contactHeading: t('Your contact details', 'معلومات تماس شما'),
    next: t('Next', 'بعدی'),
    back: t('Back', 'قبلی'),
    submit: t('Submit', 'ارسال'),
    submitting: t('Sending…', 'در حال ارسال…'),
    required: t('This field is required', 'این بخش الزامی است'),
    thanksHeading: t('Thank you!', 'تشکر از شما!'),
    thanksBody: t(
      'We received your details and will contact you soon.',
      'معلومات شما را دریافت کردیم و به زودی با شما تماس می‌گیریم.'
    ),
    another: t('Submit another', 'ارسال درخواست دیگر'),
    errorGeneric: t(
      'Something went wrong. Please try again.',
      'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.'
    ),
    step: t('Step', 'مرحله'),
    of: t('of', 'از'),
  },
};

// ---- Server-side helpers (kept here so form + scoring share definitions) ----

/** Return the flat list of questions a given intent must answer (contact + qualifying). */
function questionsForIntent(intentId) {
  const intent = config.intents.find((i) => i.id === intentId);
  if (!intent) return null;
  return [...config.contactQuestions, ...intent.questions];
}

/**
 * Heuristic lead score for real estate leads → 'hot' | 'warm' | 'cold'.
 * Buyers/sellers with a near-term timeline and clear budget/financing rank hottest.
 */
function scoreLead(intentId, answers) {
  let score = 0;
  if (intentId === 'general') return 'warm';

  const timeline = answers.timeline;
  if (timeline === 'asap' || timeline === '1_3m') score += 2;
  else if (timeline === '3_6m') score += 1;
  else if (timeline === 'browsing' || timeline === 'testing') score -= 1;

  if (intentId === 'buy') {
    if (answers.financing === 'cash') score += 2;
    else if (answers.financing === 'loan') score += 1;
    if (answers.budget && answers.budget !== 'unsure') score += 1;
    if (['100k_250k', '250k_plus'].includes(answers.budget)) score += 1;
  }

  if (intentId === 'sell') {
    if (answers.askingPrice && String(answers.askingPrice).trim()) score += 1;
    if (answers.status === 'vacant') score += 1;
  }

  if (score >= 4) return 'hot';
  if (score >= 2) return 'warm';
  return 'cold';
}

module.exports = { config, questionsForIntent, scoreLead };
