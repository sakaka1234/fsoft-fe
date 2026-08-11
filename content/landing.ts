/**
 * All landing page copy in one typed module, so section components stay
 * layout only. Icon choices live with the components that render them,
 * which keeps this file serializable and usable from client leaves too.
 *
 * Artwork comes from Popsy (illustrations.popsy.co), hand-drawn SVG in the
 * orange colorway that matches the accent token. Every file is 960x960 line
 * art, which is why illustrations always sit on the light --art-bg panel.
 */

/** Popsy illustration in the accent colorway. */
const art = (name: string) => `https://illustrations.popsy.co/orange/${name}.svg`;

export const hero = {
  titleLead: "Master English.",
  titleAccent: "Your way.",
  titleTail: "Powered by AI.",
  subtext:
    "An AI English platform that reads your level, adapts to your goals, and builds real speaking skills faster.",
  secondaryCta: { label: "See the platform", href: "#platform" },
  image: {
    src: art("communication"),
    alt: "Illustration of two people holding a conversation",
  },
} as const;

export const problem = {
  title: "English learning should be personal",
  lead: "Everyone learns English differently.",
  pains: [
    "Some learners struggle to speak at all.",
    "Some cannot follow native speakers.",
    "Some know the grammar but cannot communicate.",
    "Others simply do not know what to learn next.",
  ],
  answerTitle: "AI EMS changes that.",
  answerBody:
    "AI reads your learning progress, finds the gaps that hold you back, and builds an English experience around you instead of around a fixed syllabus.",
} as const;

export type PlatformFeature = {
  key: string;
  title: string;
  body: string;
  media?: { src: string; alt: string };
};

export const platform = {
  title: "One platform. Your complete English learning journey.",
  lead: "Six tools, all working from the same picture of your English.",
  features: [
    {
      key: "path",
      title: "Personalized learning path",
      body: "AI reads your level, goals, and results, then builds a path made for you.",
      media: {
        src: art("taking-notes"),
        alt: "Illustration of a learner writing out a study plan",
      },
    },
    {
      key: "tutor",
      title: "AI English tutor",
      body: "Ask questions, run conversations, get explanations and instant feedback.",
      media: {
        src: art("question-mark"),
        alt: "Illustration of a learner asking a question",
      },
    },
    {
      key: "speaking",
      title: "Speaking practice",
      body: "Real conversations with feedback on pronunciation, grammar, and fluency.",
      media: {
        src: art("microphone"),
        alt: "Illustration of a person speaking into a microphone",
      },
    },
    {
      key: "vocabulary",
      title: "Smart vocabulary",
      body: "Words that matter to you, with examples and spaced repetition.",
      media: {
        src: art("genius"),
        alt: "Illustration of a learner picking up a new idea",
      },
    },
    {
      key: "assessments",
      title: "Intelligent assessments",
      body: "Adaptive quizzes generated from your level and your weak areas.",
      media: {
        src: art("man-with-a-laptop"),
        alt: "Illustration of a learner taking a quiz on a laptop",
      },
    },
    {
      key: "analytics",
      title: "Learning analytics",
      body: "Speaking, listening, reading, writing, grammar, and vocabulary in one view.",
    },
  ] satisfies PlatformFeature[],
} as const;

export const tutor = {
  title: "Practice English anytime, without the pressure",
  lead: "Not everyone has someone to practice English with. Your AI tutor is always ready to talk.",
  promptsTitle: "Things you can ask",
  prompts: [
    "Let's practice ordering food at a restaurant.",
    "Correct my grammar when I make mistakes.",
    "Help me prepare for an English interview.",
    "Ask me questions about today's topic.",
  ],
  closing: "The AI does not just hand you the answer. It helps you learn from the mistake.",
  link: { label: "Browse conversation scenarios", href: "#speaking" },
  image: {
    src: art("customer-support"),
    alt: "Illustration of a tutor wearing a headset, ready to talk",
  },
} as const;

export const speaking = {
  title: "Speak more. Fear less.",
  lead: "Confidence comes from practice, so AI EMS builds realistic scenarios in the situations that actually matter to you.",
  scenarios: [
    {
      key: "everyday",
      title: "Everyday conversations",
      body: "Travel, food, hobbies, shopping, and the small talk of daily life.",
      image: {
        src: art("podcast"),
        alt: "Illustration of two people chatting casually",
      },
    },
    {
      key: "professional",
      title: "Professional English",
      body: "Meetings, presentations, interviews, and workplace conversations.",
      image: {
        src: art("keynote-presentation"),
        alt: "Illustration of someone presenting to colleagues",
      },
    },
    {
      key: "academic",
      title: "Academic English",
      body: "Seminars, presentations, assignments, and exam speaking parts.",
      image: {
        src: art("studying"),
        alt: "Illustration of a student studying at a desk",
      },
    },
    {
      key: "free",
      title: "Free conversation",
      body: "Pick any topic and let the AI guide the conversation naturally.",
      image: {
        src: art("video-call"),
        alt: "Illustration of a free-flowing video conversation",
      },
    },
  ],
} as const;

export const progress = {
  title: "Your English. Measured.",
  lead: "AI EMS tracks every major English skill, then tells you what to improve next instead of leaving you with a score.",
  skills: [
    { label: "Speaking", value: 72 },
    { label: "Listening", value: 81 },
    { label: "Reading", value: 88 },
    { label: "Writing", value: 69 },
    { label: "Grammar", value: 76 },
    { label: "Vocabulary", value: 84 },
  ],
  snapshot: [
    { label: "Current level", value: "B1", unit: "Intermediate" },
    { label: "Words learned", value: "1,284", unit: "all time" },
    { label: "Speaking practice", value: "42", unit: "minutes this week" },
    { label: "Lessons completed", value: "36", unit: "this term" },
  ],
  recommendation: {
    label: "Recommended next",
    value: "Practice past tense conversations",
  },
  /* Sample data, not a product claim. Replace with live values when the
     dashboard API is wired up. */
  caption: "Example learner profile.",
} as const;

export const vocabulary = {
  title: "Stop memorizing. Start using English.",
  lead: "A word is yours once you have used it. AI EMS keeps pushing your words back into conversation until they stick.",
  statement: ["Learn words.", "Use them.", "Remember them."],
  words: [
    "negotiate",
    "commute",
    "deadline",
    "hesitate",
    "reschedule",
    "colleague",
    "itinerary",
    "persuade",
    "estimate",
    "follow up",
    "small talk",
    "boarding pass",
    "fluent",
    "curriculum",
  ],
  habits: [
    "Discover new vocabulary",
    "Learn words through real examples",
    "Practice words in conversation",
    "Review difficult words automatically",
    "Build around your own goals",
  ],
} as const;

export const path = {
  title: "A learning path built around you",
  lead: "Your English journey starts with understanding where you are right now.",
  steps: [
    {
      key: "assess",
      title: "Assess",
      body: "Take an AI assessment that places your current English level across every skill.",
    },
    {
      key: "analyze",
      title: "Analyze",
      body: "AI separates what you have mastered from the gaps that are slowing you down.",
    },
    {
      key: "personalize",
      title: "Personalize",
      body: "Your path is generated from your goals, your level, and the time you have.",
    },
    {
      key: "practice",
      title: "Practice",
      body: "Lessons, quizzes, conversations, and real-world scenarios, in the order you need them.",
    },
    {
      key: "improve",
      title: "Improve",
      body: "Every session feeds back in, and the path reshapes itself as your English grows.",
    },
  ],
} as const;

export const goals = {
  title: "From beginner to confident speaker",
  lead: "Your goal decides your path. School, work, travel, or everyday conversation, the experience adapts to it.",
  tabs: [
    {
      key: "beginners",
      label: "English for beginners",
      body: "Build a foundation in vocabulary, grammar, and the phrases that carry everyday conversation, at a pace that does not overwhelm you.",
      image: {
        src: art("woman-with-a-laptop"),
        alt: "Illustration of a beginner learning at a laptop",
      },
    },
    {
      key: "communication",
      label: "English for communication",
      body: "Move from correct sentences to real conversation, with the confidence to keep talking when you are not sure of the next word.",
      image: {
        src: art("success"),
        alt: "Illustration of a speaker celebrating a breakthrough",
      },
    },
    {
      key: "business",
      label: "Business English",
      body: "Sharpen the English you use at work: meetings, presentations, email, and the interviews that decide your next role.",
      image: {
        src: art("presentation"),
        alt: "Illustration of a work presentation in progress",
      },
    },
    {
      key: "exams",
      label: "Exam preparation",
      body: "Practice the exact question types your exam uses, with feedback aimed at the bands you are losing marks in.",
      image: {
        src: art("student-with-diploma"),
        alt: "Illustration of a student holding an exam certificate",
      },
    },
  ],
} as const;

export const confidence = {
  title: "Learn from your mistakes, not around them",
  body: "Traditional learning rewards memorizing rules. AI EMS rewards communicating, in a space where getting it wrong is part of the work rather than something to hide.",
  cycle: ["Speak.", "Make mistakes.", "Get feedback.", "Try again.", "Improve."],
  closing: "That is how fluency grows.",
} as const;

export const finalCta = {
  title: "Ready to improve your English?",
  body: "Stop wondering what to learn next. Let AI build the path, and spend your time practicing instead of planning.",
  note: "No credit card required.",
  image: {
    src: art("man-riding-a-rocket"),
    alt: "Illustration of a learner taking off on a rocket",
  },
} as const;

export const faq = {
  title: "Frequently asked questions",
  items: [
    {
      question: "What is AI English Management System?",
      answer:
        "An AI-powered platform that helps you improve your English through personalized learning paths, AI tutoring, speaking practice, assessments, and learning analytics in one place.",
    },
    {
      question: "What English skills can I practice?",
      answer:
        "Speaking, listening, reading, writing, grammar, and vocabulary. Every skill is tracked separately so you can see which one is holding the others back.",
    },
    {
      question: "Can I practice speaking with AI?",
      answer:
        "Yes. You can hold conversations in different real-world scenarios and receive feedback on pronunciation, vocabulary, grammar, and fluency.",
    },
    {
      question: "Does the platform adapt to my level?",
      answer:
        "Yes. AI analyzes your performance continuously and adjusts recommendations and activities as your English changes.",
    },
    {
      question: "Can beginners use the platform?",
      answer:
        "Yes. The experience adapts to every level, from your first sentences through to advanced fluency work.",
    },
    {
      question: "Can I use it to prepare for exams?",
      answer:
        "Yes. AI generates practice activities based on your target exam and the specific skills you need to lift.",
    },
  ],
} as const;
