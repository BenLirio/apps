// What Flavor of Burned Out Are You — app.js

const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
const SLUG = 'what-flavor-burned-out';

const QUESTIONS = [
  {
    text: "Your inbox has 847 unread emails. You feel:",
    options: [
      { label: "physically ill but weirdly proud", weight: { PC: 3, MS: 1 } },
      { label: "nothing. you can't feel anymore", weight: { ELB: 3, SLB: 1 } },
      { label: "the urge to archive everything and call it 'done'", weight: { PC: 2, SLB: 2 } },
      { label: "like this is fine, this is normal, you are normal", weight: { MS: 3, ELB: 1 } }
    ]
  },
  {
    text: "It is 11:47 PM. You are still 'working.' The reason is:",
    options: [
      { label: "revenge against the time stolen from you today", weight: { ELB: 3, SLB: 1 } },
      { label: "you forgot to eat dinner and now it's too late to stop", weight: { PC: 2, MS: 2 } },
      { label: "you've been on YouTube since 9pm and feel guilty", weight: { ELB: 2, SLB: 2 } },
      { label: "there is literally no other time", weight: { MS: 3, PC: 1 } }
    ]
  },
  {
    text: "Your last 'sick day' involved:",
    options: [
      { label: "answering exactly four Slacks 'just to check in'", weight: { PC: 3, MS: 1 } },
      { label: "watching all of a reality show you're ashamed of", weight: { ELB: 2, SLB: 2 } },
      { label: "taking the day off and spending it worrying about the day off", weight: { MS: 3, ELB: 1 } },
      { label: "what is a sick day", weight: { SLB: 3, PC: 1 } }
    ]
  },
  {
    text: "When someone says 'let's circle back' you:",
    options: [
      { label: "write it down in your notes with no intention of circling back", weight: { SLB: 3, ELB: 1 } },
      { label: "nod while dying inside", weight: { MS: 3, PC: 1 } },
      { label: "feel a specific type of tired that doesn't have a name yet", weight: { ELB: 3, SLB: 1 } },
      { label: "ask for a follow-up document immediately", weight: { PC: 3, MS: 1 } }
    ]
  },
  {
    text: "Your relationship with your phone after 6pm:",
    options: [
      { label: "you doom-scroll as a form of self-soothing", weight: { ELB: 3, SLB: 1 } },
      { label: "you check email on your phone instead of your laptop (different)", weight: { PC: 3, MS: 1 } },
      { label: "you keep it face-down and pretend it isn't there", weight: { SLB: 2, MS: 2 } },
      { label: "you refresh things and don't know why", weight: { MS: 2, ELB: 2 } }
    ]
  },
  {
    text: "You've recently felt guilty about:",
    options: [
      { label: "not responding fast enough to a message you've been 'thinking about'", weight: { PC: 2, MS: 2 } },
      { label: "how little you actually care right now", weight: { ELB: 3, SLB: 1 } },
      { label: "resting without achievement", weight: { PC: 3, ELB: 1 } },
      { label: "how long you stayed in a meeting without saying anything real", weight: { MS: 3, SLB: 1 } }
    ]
  },
  {
    text: "The most honest thing you've said about work recently was:",
    options: [
      { label: "'I'm fine' (you were not fine)", weight: { MS: 3, PC: 1 } },
      { label: "nothing, you've outsourced your feelings to vague gestures", weight: { ELB: 2, SLB: 2 } },
      { label: "'I just need to get through this week' (for the 11th week in a row)", weight: { PC: 2, SLB: 2 } },
      { label: "'honestly? I'm kind of checked out.' to a stranger.", weight: { SLB: 3, ELB: 1 } }
    ]
  },
  {
    text: "Your current coping mechanism:",
    options: [
      { label: "making more lists of tasks to feel like you're doing something", weight: { PC: 3, MS: 1 } },
      { label: "revenge bedtime procrastination (it's not self-care, it's reclamation)", weight: { ELB: 3, SLB: 1 } },
      { label: "scheduling 'focus blocks' you don't actually use", weight: { SLB: 2, MS: 2 } },
      { label: "existing in a continuous low-grade dread", weight: { MS: 3, ELB: 1 } }
    ]
  },
  {
    text: "If your burnout had a sound, it would be:",
    options: [
      { label: "a notification you've already marked as read once", weight: { PC: 2, MS: 2 } },
      { label: "a calendar invite with no description", weight: { MS: 3, SLB: 1 } },
      { label: "the outro music on a podcast you fell asleep to", weight: { ELB: 3, PC: 1 } },
      { label: "loading... loading... loading...", weight: { SLB: 3, ELB: 1 } }
    ]
  },
  {
    text: "What are you most afraid someone at work will notice?",
    options: [
      { label: "that you haven't actually done the thing yet", weight: { SLB: 3, PC: 1 } },
      { label: "that you have, in fact, already given up", weight: { ELB: 3, MS: 1 } },
      { label: "that you're working too hard and everyone knows it's compulsive", weight: { PC: 3, SLB: 1 } },
      { label: "that you're somehow still here, nodding", weight: { MS: 3, ELB: 1 } }
    ]
  }
];

const ARCHETYPES = {
  PC: {
    id: 'PC',
    name: 'The Productive Corpse',
    prognosis: 'Clinical presentation: outputs at full capacity while registering zero internally. Subject exhibits high task completion, extreme inbox hygiene, and a faint smell of over-functioning. Has not taken a full breath since Q3. Prognosis: continues to produce deliverables indefinitely, at the cost of personhood.',
    fallback_treatment: 'Recommended: one full hour of doing literally nothing. Not yoga. Nothing. If this triggers anxiety, that is the diagnosis confirming itself.'
  },
  MS: {
    id: 'MS',
    name: 'The Meeting Survivor',
    prognosis: 'Clinical presentation: attends all meetings. Contributes to most meetings. Has not been moved by a meeting in fourteen months. Exhibits symptoms of performative presence: nodding, typing, "sounds good." Core personality last detected in 2023. Prognosis: will remain available for standup.',
    fallback_treatment: 'Recommended: decline one calendar invite per week with no explanation. Start small. Work up to blocking Tuesdays entirely.'
  },
  SLB: {
    id: 'SLB',
    name: 'The Soft Launch of a Breakdown',
    prognosis: 'Clinical presentation: technically fine. Technically still employed. Technically responding to messages within 48 hours. Everything is "in progress." Nothing is progressing. Subject is professionally present and emotionally in a different city. Prognosis: will remain technically fine until suddenly, spectacularly, not.',
    fallback_treatment: 'Recommended: tell one person the real answer when they ask how you are. Not a coworker. Someone who can handle it.'
  },
  ELB: {
    id: 'ELB',
    name: 'The Eternal Lunch Break',
    prognosis: 'Clinical presentation: checked out but not checked off. Expertise in looking busy while processing the existential weight of the modern work contract. Doom-scrolls as a philosophical act. Has perfected the art of "I\'ll do it after this video." Prognosis: will be very well-rested for a future era when they care again.',
    fallback_treatment: 'Recommended: identify one task that would feel genuinely satisfying to finish. Do that one. Nothing else. Build from there or don\'t.'
  }
};

// Seeded hash — same answers always produce same result
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

let currentQuestion = 0;
const answers = [];
const scores = { PC: 0, MS: 0, SLB: 0, ELB: 0 };
let selectedOption = null;

function startQuiz() {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('quiz-screen').style.display = 'block';
  renderQuestion(0);
}

function renderQuestion(idx) {
  const q = QUESTIONS[idx];
  document.getElementById('q-counter').textContent = `SYMPTOM ${idx + 1} OF ${QUESTIONS.length}`;
  document.getElementById('progress-bar').style.width = `${(idx / QUESTIONS.length) * 100}%`;
  document.getElementById('question-text').textContent = q.text;

  const list = document.getElementById('options-list');
  list.innerHTML = '';
  selectedOption = null;

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.label;
    btn.setAttribute('data-index', i);
    btn.onclick = () => selectOption(btn, opt, idx);
    list.appendChild(btn);
  });
}

function selectOption(btn, opt, qIdx) {
  // Deselect all
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedOption = opt;

  // Apply weights
  Object.entries(opt.weight).forEach(([key, val]) => {
    scores[key] = (scores[key] || 0) + val;
  });

  answers.push({ q: qIdx, label: opt.label });

  // Delay slightly for tactile feel
  setTimeout(() => {
    if (currentQuestion < QUESTIONS.length - 1) {
      currentQuestion++;
      renderQuestion(currentQuestion);
    } else {
      revealResult();
    }
  }, 280);
}

function pickArchetype() {
  // Deterministic: use hash of serialized answers as tiebreaker
  const answerKey = answers.map(a => a.label).join('|');
  const seed = hash(answerKey);

  let maxScore = -1;
  let winner = null;
  const keys = Object.keys(scores);

  // Sort to ensure stable iteration, then use seed for ties
  keys.sort((a, b) => scores[b] - scores[a]);

  // Find winner; if tied, pick by seed
  const topScore = scores[keys[0]];
  const tied = keys.filter(k => scores[k] === topScore);
  winner = tied[seed % tied.length];

  return ARCHETYPES[winner];
}

const LOADING_MESSAGES = [
  'cross-referencing your symptoms with the DSM-5 (unlicensed edition)...',
  'consulting the committee of people who have also given up...',
  'running your results through the official burnout spectrum...',
  'reviewing your file with great concern and mild recognition...',
  'generating your personalized diagnosis with limited empathy...',
];

function revealResult() {
  document.getElementById('quiz-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'block';

  const msgEl = document.getElementById('loading-msg');
  msgEl.textContent = LOADING_MESSAGES[hash(answers.map(a => a.label).join('')) % LOADING_MESSAGES.length];

  const archetype = pickArchetype();

  setTimeout(async () => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    document.getElementById('share').style.display = 'block';

    document.getElementById('result-name').textContent = archetype.name;
    document.getElementById('result-prognosis').textContent = archetype.prognosis;

    // Update progress bar to 100%
    document.getElementById('progress-bar').style.width = '100%';

    // AI treatment plan — show loading state
    document.getElementById('treatment-loading').style.display = 'block';

    const treatment = await generateTreatment(archetype, answers);
    document.getElementById('treatment-loading').style.display = 'none';
    document.getElementById('treatment-text').textContent = treatment;
    document.getElementById('treatment-wrap').style.display = 'block';
  }, 1400);
}

async function generateTreatment(archetype, userAnswers) {
  const messages = [
    {
      role: 'system',
      content: 'You are a deadpan fake clinician writing a one-line "treatment plan" for a burnout archetype. Write exactly one sentence in a fake-clinical voice. Under 30 words. No emojis. No exclamation marks. Sound like a doctor who has also given up.'
    },
    {
      role: 'user',
      content: `Patient diagnosis: ${archetype.name}\nSymptoms selected: ${userAnswers.map(a => a.label).join('; ')}`
    }
  ];

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SLUG, messages, max_tokens: 80 })
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    const text = (data.content || '').trim();
    return text || archetype.fallback_treatment;
  } catch (_) {
    return archetype.fallback_treatment;
  }
}

function share() {
  const archetype = pickArchetype();
  const text = `I just got diagnosed as "${archetype.name}" on the burnout quiz. The prognosis is not good.`;
  if (navigator.share) {
    navigator.share({ title: document.title, text, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Link copied! Share your diagnosis.'));
  }
}
