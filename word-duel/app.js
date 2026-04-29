// ── Word list (500+ common 4+ letter English words) ──────────────
const WORD_LIST = new Set([
  'able','about','above','abuse','acid','across','acted','active','actor','actual',
  'added','admit','adopt','adult','after','again','aged','agent','agree','ahead',
  'aide','aims','also','among','anger','angle','animal','ankle','another','anyone',
  'apart','apply','arch','area','arms','army','around','arrive','arts','asked',
  'assist','atlas','atom','aunt','auto','away','axis','back','ball','band',
  'bank','base','bath','bear','beat','been','bell','belt','best','bird',
  'bite','black','blame','blank','blast','blaze','bleed','bless','blind','block',
  'blood','blow','blue','boat','body','bold','bone','book','boot','born',
  'boss','both','bound','bowl','boys','brag','brain','brand','brave','bread',
  'break','breed','bribe','brick','bride','brief','bring','broke','brown','burn',
  'buzz','cage','calm','camp','card','care','cart','case','cash','cast',
  'cats','cave','cell','cent','chair','chance','chase','chat','chef','city',
  'clam','clap','claw','clay','clean','clear','clerk','click','clue','coal',
  'coat','code','coin','cold','come','cone','cool','corn','cost','coup',
  'cove','cram','crew','crop','crow','cube','cure','curl','cute','cycle',
  'dare','dark','dash','data','date','dawn','days','dead','deal','dear',
  'debt','deep','deny','desk','dial','dice','died','diet','dirt','disk',
  'dive','dock','does','dogs','dome','done','door','dose','dots','dough',
  'down','drag','draw','dream','drew','drop','drug','dual','dump','dune',
  'dusk','dust','each','earn','ease','east','easy','edge','else','emit',
  'epic','even','ever','evil','exam','exit','fail','fair','fake','fall',
  'fame','farm','fast','fate','fear','feat','feed','feel','feet','fell',
  'felt','fend','fern','file','fill','film','find','fine','fire','firm',
  'fish','fist','flag','flat','flew','flex','flip','flock','flow','foam',
  'fold','folk','fond','font','food','fool','foot','ford','fork','form',
  'fort','foul','four','free','frog','from','full','fund','fuse','gain',
  'game','gaze','gear','glow','glue','goal','gold','gone','good','grab',
  'grade','gram','grass','gray','grew','grid','grim','grip','grit','gust',
  'half','hall','halt','hand','hang','hard','harm','hate','have','head',
  'heal','heap','heat','heel','held','helm','help','here','hero','hide',
  'high','hill','hint','hold','hole','home','hook','hope','horn','host',
  'hour','hull','hunt','idea','idle','inch','iron','item','jail','join',
  'jump','just','keen','keep','king','kiss','knot','know','lack','lake',
  'lamp','land','last','late','lawn','lead','lean','leap','left','lend',
  'lens','less','life','lift','like','lime','line','link','list','live',
  'load','loan','loft','long','look','loop','lore','lose','loss','lost',
  'loud','love','luck','lure','made','mail','main','make','mall','many',
  'mark','mask','mass','mast','math','meal','meet','melt','memo','menu',
  'mere','mesh','mild','mile','mill','mime','mind','mint','miss','mist',
  'moon','more','most','move','much','muse','musk','name','near','neck',
  'need','nest','news','next','nice','nine','node','none','noon','norm',
  'nose','note','noun','null','oath','odds','open','oven','over','pace',
  'pack','page','pain','pair','pale','palm','park','part','pass','past',
  'path','pave','peak','pear','peer','pile','pipe','plan','play','plot',
  'plow','plus','poem','pole','poll','pond','pool','poor','pose','post',
  'pour','pray','prey','pull','pump','pure','push','race','rack','rain',
  'rake','ramp','rank','rare','rate','read','real','reap','rear','reel',
  'rely','rest','ride','ring','ripe','rise','risk','roam','roar','rock',
  'role','roll','roof','room','root','rope','rose','ruin','rule','rush',
  'safe','sage','sail','sake','salt','same','sand','save','scan','scar',
  'seal','seam','seat','seed','seek','self','sell','send','shed','ship',
  'shoe','shop','shot','show','shut','sick','side','sign','silk','sing',
  'sink','site','size','skip','slam','slip','slot','slow','snap','snow',
  'soak','soar','sock','soft','soil','sole','some','song','soon','sort',
  'soul','span','spar','spec','spin','spot','stem','step','stir','stop',
  'strap','stub','stun','such','suit','sung','sunk','surf','swim','tail',
  'tale','tall','tame','tape','task','team','tear','tell','tend','tent',
  'term','test','text','that','them','then','thud','tick','tide','tied',
  'tile','time','tint','tiny','tire','told','toll','tomb','tone','took',
  'tool','torn','tour','town','trap','tree','trim','trio','trip','true',
  'tune','turn','type','under','unit','upon','urge','used','user','vain',
  'vale','vast','veil','vein','verb','very','view','vine','void','vote',
  'wade','wage','wait','wake','walk','wall','ward','warn','warp','wash',
  'wave','weak','wear','weed','week','well','went','west','what','when',
  'whip','wide','wild','will','wind','wine','wing','wink','wise','wish',
  'with','woke','wolf','wood','word','wore','work','worm','worn','wrap',
  'wrist','yard','yarn','year','yell','your','zero','zone','zoom',
  // 5+ letter words
  'about','above','admit','adopt','adult','after','again','agree','ahead',
  'alarm','alert','alien','align','alley','allow','alone','along','alter',
  'angel','angry','annex','apart','apply','arena','argue','arise','armor',
  'array','aside','asset','atlas','attic','audio','audit','avoid','await',
  'awake','award','aware','awful','badly','bagel','being','below','bench',
  'bevel','birth','black','blade','blame','blank','blast','blaze','bleed',
  'bless','blind','block','bloom','blown','board','boast','bonus','boost',
  'booth','bound','brave','bread','break','breed','brick','bride','brief',
  'bring','broad','broke','brown','brush','build','built','bunch','burst',
  'buyer','cabin','candy','cargo','carry','catch','cause','cedar','chalk',
  'chaos','charge','charm','chart','chase','cheap','check','chess','chest',
  'chief','child','chill','choir','civic','civil','claim','class','clean',
  'clear','clerk','click','cliff','climb','cling','clock','close','cloth',
  'cloud','coach','coast','coast','color','comet','comic','count','court',
  'cover','crack','craft','crane','crash','crazy','cream','creek','crime',
  'crisp','cross','crowd','crown','crust','curve','dance','death','debug',
  'decay','delta','dense','depot','depth','digit','dirty','disco','diver',
  'dizzy','doubt','draft','drain','drawn','drift','drill','drink','drive',
  'drone','drove','drown','dryly','dying','early','earth','eight','elect',
  'empty','enemy','entry','equal','error','event','every','exact','extra',
  'faint','faith','false','fancy','fatal','fault','feast','fence','fever',
  'fiber','field','fifth','fifty','fight','finch','first','fixed','flame',
  'flask','flesh','float','flood','floor','floss','flush','focus','force',
  'forge','forth','found','frame','franc','frank','fresh','front','frost',
  'frozen','fuel','funky','fuzzy','glare','glass','gloom','glory','glove',
  'going','grace','grain','grant','graph','grasp','great','greed','green',
  'greet','grief','groan','gross','group','grove','grown','guard','guide',
  'guild','guise','gulch','gusto','handy','happy','harsh','haunt','haven',
  'heavy','hence','herbs','hippo','honey','honor','horse','hotel','house',
  'human','humid','image','imply','inbox','index','inner','input','inter',
  'intro','ivory','jewel','joint','judge','juice','juicy','karma','knack',
  'knife','knock','known','label','lance','large','laser','later','layer',
  'learn','lease','least','leave','lemon','level','light','lilac','limit',
  'linen','liver','local','lodge','logic','loose','lover','lower','lucid',
  'lucky','lunar','lying','magic','major','maple','march','match','media',
  'mercy','merit','metal','might','minor','mixed','model','money','month',
  'moral','motor','mouse','mouth','music','naive','nasty','ninja','noble',
  'noise','north','novel','nudge','nurse','nymph','occur','offer','often',
  'olive','onset','opera','orbit','order','other','outer','owner','ozone',
  'panel','paper','party','patch','pause','peace','pearl','penny','perch',
  'phase','phone','photo','piano','piece','pilot','pitch','pixel','pixel',
  'pizza','place','plain','plane','plank','plant','plate','plaza','pluck',
  'plumb','plume','plunge','point','poise','poker','polar','poppy','porch',
  'pound','power','press','price','pride','prime','prince','print','prize',
  'proof','prose','proud','prove','psalm','pulse','punch','queen','query',
  'quest','queue','quick','quiet','quota','quote','radar','radio','raise',
  'rally','ranch','range','rapid','reach','rebel','refer','reign','relax',
  'reply','rider','rifle','right','rigid','risky','rival','river','rocky',
  'rouge','rough','round','route','royal','rugby','ruler','rural','sadly',
  'saint','salad','sauce','scale','scene','scope','score','screw','scrub',
  'seize','sense','serve','seven','shade','shaft','shake','shall','shame',
  'shape','share','sharp','shelf','shell','shift','shine','shore','short',
  'shout','sight','since','sixth','sixty','skill','skull','slant','slash',
  'slate','slave','sleep','slice','slide','slope','smart','smell','smile',
  'smoke','solar','solid','solve','sorry','south','space','spare','spark',
  'spawn','speak','spell','spend','spice','spill','spine','spire','spite',
  'split','spoke','spoon','spray','squad','squat','stack','staff','stage',
  'stain','stair','stake','stale','stand','stark','start','state','stay',
  'steal','steam','steel','steep','steer','still','stock','stone','store',
  'storm','story','strap','stray','strip','stroll','stuck','study','stump',
  'style','sugar','super','surge','swamp','swear','sweet','swept','swift',
  'swing','swipe','sword','table','taint','taken','taste','teach','tense',
  'theme','thick','thing','think','thorn','those','three','throw','thumb',
  'tiger','tight','timer','tired','title','toast','token','total','touch',
  'tough','towel','tower','toxic','trace','track','trade','trail','train',
  'trait','trawl','treat','trend','trial','tribe','trick','tried','troop',
  'trout','truck','truly','trunk','trust','truth','twist','ultra','uncle',
  'unify','union','until','usual','utter','vague','valid','valor','value',
  'valve','video','vigor','viral','visit','vital','vocal','voice','voter',
  'vying','water','weird','whale','wheat','wheel','where','while','white',
  'whole','whose','width','witch','woman','world','worry','worse','worst',
  'worth','would','wrath','write','wrote','young','youth','zipper'
]);

// ── Config ────────────────────────────────────────────────────────
const WSS_URL  = 'wss://l67yfgkb1j.execute-api.us-east-1.amazonaws.com/prod';
const SLUG     = 'word-duel';
const GAME_DURATION = 90; // seconds

// Weighted letter pool (English frequency-based, 12 letters)
// ETAOIN SHRDLU + common consonants — avoids Q/X/Z/J spam
const LETTER_POOL = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIOOOOOOONNNNNNSSSSSSRRRRRRTTTTTTLLLLLUUUUDDDDGGGGBBCCMMPPFFHHVVWWYYKK'.split('');

// ── State ─────────────────────────────────────────────────────────
let ws            = null;
let playerRole    = null;   // 'host' | 'guest'
let playerName    = '';
let opponentName  = '';
let currentRoomCode = null;
let gameLetters   = [];     // 12 uppercase chars
let timerInterval = null;
let timeLeft      = GAME_DURATION;
let myWord        = '';
let myLocked      = false;
let opponentWord  = null;   // null until opponent locks in
let opponentLocked = false;
let myLockTime    = null;
let opponentLockTime = null;
let gameStartTime = null;
let gameEnded     = false;

// ── Seeded letter generation ───────────────────────────────────────
function seededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    return ((s >>> 0) / 4294967296);
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateLetters(roomCode) {
  const rng = seededRandom(hashString(roomCode));
  const letters = [];
  for (let i = 0; i < 12; i++) {
    letters.push(LETTER_POOL[Math.floor(rng() * LETTER_POOL.length)]);
  }
  return letters;
}

// ── Word validation ────────────────────────────────────────────────
function canFormWord(word, letters) {
  if (word.length < 3) return false;
  const pool = [...letters];
  for (const ch of word.toUpperCase()) {
    const idx = pool.indexOf(ch);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

function isValidWord(word) {
  if (word.length < 3) return false;
  return canFormWord(word, gameLetters) && WORD_LIST.has(word.toLowerCase());
}

// ── UI helpers ────────────────────────────────────────────────────
function show(screenId) {
  ['screen-landing','screen-waiting','screen-game','screen-result']
    .forEach(id => {
      document.getElementById(id).style.display = (id === screenId) ? '' : 'none';
    });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = '';
}

function renderLetters() {
  const input = document.getElementById('word-input').value.toUpperCase();
  const pool = [...gameLetters];
  const usedIndices = new Set();

  // Track which pool letters are used by the input
  for (const ch of input) {
    const idx = pool.indexOf(ch, 0);
    if (idx !== -1) {
      usedIndices.add(idx);
      pool[idx] = null; // mark used
    }
  }

  const container = document.getElementById('letters-display');
  container.innerHTML = '';
  gameLetters.forEach((letter, i) => {
    const tile = document.createElement('div');
    tile.className = 'letter-tile' + (usedIndices.has(i) ? ' used' : '');
    tile.textContent = letter;
    container.appendChild(tile);
  });
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const display = document.getElementById('timer-display');
  if (!display) return;
  display.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  if (timeLeft <= 10) display.classList.add('urgent');
  else display.classList.remove('urgent');
}

// ── Game input handler ────────────────────────────────────────────
function onWordInput() {
  if (myLocked) return;
  const input = document.getElementById('word-input').value.replace(/[^a-zA-Z]/g,'');
  document.getElementById('word-input').value = input;

  renderLetters();

  const upper = input.toUpperCase();
  const status = document.getElementById('word-status');
  const lockBtn = document.getElementById('lock-btn');

  if (input.length === 0) {
    status.textContent = '\u00a0';
    status.className = 'word-status';
    lockBtn.disabled = true;
    return;
  }

  if (!canFormWord(upper, gameLetters)) {
    status.textContent = 'those letters aren\'t all in the pool';
    status.className = 'word-status invalid';
    lockBtn.disabled = true;
  } else if (input.length < 3) {
    status.textContent = 'at least 3 letters';
    status.className = 'word-status';
    lockBtn.disabled = true;
  } else if (!WORD_LIST.has(input.toLowerCase())) {
    status.textContent = 'not a word we know — try another';
    status.className = 'word-status invalid';
    lockBtn.disabled = true;
  } else {
    status.textContent = `\u2713 ${input.length} letters — can you go longer?`;
    status.className = 'word-status valid';
    lockBtn.disabled = false;
  }
}

// ── Lock in ───────────────────────────────────────────────────────
function lockIn() {
  const input = document.getElementById('word-input').value.trim();
  if (!isValidWord(input)) return;
  if (myLocked) return;

  myWord = input.toUpperCase();
  myLocked = true;
  myLockTime = Date.now() - gameStartTime;

  document.getElementById('lock-btn').disabled = true;
  document.getElementById('word-input').disabled = true;
  document.getElementById('lock-status').textContent = `locked in: ${myWord} (${myWord.length} letters)`;

  send({
    action: 'game_update',
    roomCode: currentRoomCode,
    state: { type: 'word_locked', word: myWord, lockTime: myLockTime }
  });

  if (opponentLocked) {
    endGame();
  }
}

// ── Timer ─────────────────────────────────────────────────────────
function startTimer() {
  timeLeft = GAME_DURATION;
  gameStartTime = Date.now();
  updateTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Time's up — lock in best word found so far or empty
      if (!myLocked) {
        const input = document.getElementById('word-input').value.trim();
        if (isValidWord(input)) {
          myWord = input.toUpperCase();
          myLockTime = GAME_DURATION * 1000;
        } else {
          myWord = '';
          myLockTime = GAME_DURATION * 1000;
        }
        myLocked = true;
        send({
          action: 'game_update',
          roomCode: currentRoomCode,
          state: { type: 'word_locked', word: myWord, lockTime: myLockTime }
        });
      }
      if (opponentLocked || opponentWord !== null) {
        endGame();
      } else {
        document.getElementById('lock-status').textContent = "time's up — waiting for opponent...";
      }
    }
  }, 1000);
}

// ── Start game ────────────────────────────────────────────────────
function startGame() {
  gameLetters = generateLetters(currentRoomCode);
  gameEnded = false;
  myWord = '';
  myLocked = false;
  opponentWord = null;
  opponentLocked = false;
  myLockTime = null;
  opponentLockTime = null;

  document.getElementById('vs-label').textContent = `${playerName}\nvs\n${opponentName}`;
  document.getElementById('word-input').value = '';
  document.getElementById('word-input').disabled = false;
  document.getElementById('word-status').textContent = '\u00a0';
  document.getElementById('lock-status').textContent = '\u00a0';
  document.getElementById('lock-btn').disabled = true;

  show('screen-game');
  renderLetters();
  startTimer();
}

// ── End game ──────────────────────────────────────────────────────
function endGame() {
  if (gameEnded) return;
  gameEnded = true;
  clearInterval(timerInterval);

  const myW  = myWord  || '';
  const oppW = opponentWord || '';

  let winner;
  if (myW.length > oppW.length) winner = 'me';
  else if (oppW.length > myW.length) winner = 'opponent';
  else if (myW.length === 0 && oppW.length === 0) winner = 'draw';
  else if (myLockTime !== null && opponentLockTime !== null && myLockTime < opponentLockTime) winner = 'me';
  else if (myLockTime !== null && opponentLockTime !== null && opponentLockTime < myLockTime) winner = 'opponent';
  else winner = 'draw';

  show('screen-result');

  const headline = document.getElementById('result-headline');
  if (winner === 'draw') {
    headline.textContent = 'dead even';
  } else if (winner === 'me') {
    headline.textContent = 'you win!';
    headline.style.color = 'var(--accent)';
  } else {
    headline.textContent = `${opponentName} wins`;
    headline.style.color = 'var(--fg)';
  }

  const cards = document.getElementById('result-cards');
  cards.innerHTML = '';

  const meCard = makeResultCard(playerName, myW, winner === 'me');
  const oppCard = makeResultCard(opponentName, oppW, winner === 'opponent');
  cards.appendChild(meCard);
  cards.appendChild(oppCard);

  const detail = document.getElementById('result-detail');
  if (winner === 'draw') detail.textContent = 'same length, same time. uncanny.';
  else if (winner === 'me') {
    detail.textContent = myW.length === 0
      ? 'honestly, just surviving is a win sometimes'
      : `${myW.length} letters vs ${oppW.length || 0}. the gap speaks for itself.`;
  } else {
    detail.textContent = oppW.length === 0
      ? 'they didn\'t even submit. a silent win is still a win.'
      : `${oppW.length} letters to your ${myW.length || 0}. brutal.`;
  }
}

function makeResultCard(name, word, isWinner) {
  const card = document.createElement('div');
  card.className = 'result-card' + (isWinner ? ' winner' : '');
  card.innerHTML = `
    <div class="player-name">${name}${isWinner ? ' <span class="crown">\uD83D\uDC51</span>' : ''}</div>
    <div class="player-word">${word || '(no word)'}</div>
    <div class="word-length">${word ? word.length + ' letters' : '0 letters'}</div>
  `;
  return card;
}

// ── WebSocket ─────────────────────────────────────────────────────
function openWS(onOpen) {
  ws = new WebSocket(WSS_URL);
  ws.onopen  = onOpen;
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => {
    if (document.getElementById('screen-game').style.display !== 'none' ||
        document.getElementById('screen-waiting').style.display !== 'none') {
      clearInterval(timerInterval);
      show('screen-result');
      document.getElementById('result-headline').textContent = 'connection dropped';
      document.getElementById('result-detail').textContent = 'your opponent vanished into the void. it happens.';
      document.getElementById('result-cards').innerHTML = '';
    }
  };
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// ── Actions ───────────────────────────────────────────────────────
function createRoom() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) { showError('a name would help — they need to know who beat them'); return; }
  document.getElementById('error-msg').style.display = 'none';

  const roomCode = generateRoomCode();
  currentRoomCode = roomCode;
  playerRole = 'host';

  openWS(() => {
    send({ action: 'create_room', slug: SLUG, playerName, roomCode });
  });
}

function joinRoom() {
  playerName = document.getElementById('player-name').value.trim();
  const code  = document.getElementById('join-code').value.trim().toUpperCase();
  if (!playerName) { showError('add your name — show them who\'s coming for them'); return; }
  if (code.length !== 6) { showError('need a 6-character room code'); return; }
  document.getElementById('error-msg').style.display = 'none';

  currentRoomCode = code;
  playerRole = 'guest';

  openWS(() => {
    send({ action: 'join_room', roomCode: code, playerName });
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// ── Message handler ───────────────────────────────────────────────
function handleMessage(msg) {
  if (msg.type === 'room_created') {
    document.getElementById('room-code-display').textContent = msg.roomCode;
    currentRoomCode = msg.roomCode;
    show('screen-waiting');

  } else if (msg.type === 'player_joined') {
    opponentName = msg.guestName;
    startGame();

  } else if (msg.type === 'joined_room') {
    opponentName = msg.hostName;
    currentRoomCode = msg.roomCode;
    startGame();

  } else if (msg.type === 'game_update') {
    const state = msg.state;
    if (state && state.type === 'word_locked') {
      opponentWord = state.word || '';
      opponentLockTime = state.lockTime;
      opponentLocked = true;
      if (!myLocked) {
        document.getElementById('lock-status').textContent = `${opponentName} locked in — finish up!`;
      } else {
        endGame();
      }
      if (timeLeft <= 0) {
        endGame();
      }
    }

  } else if (msg.type === 'opponent_disconnected') {
    clearInterval(timerInterval);
    show('screen-result');
    document.getElementById('result-headline').textContent = 'opponent left';
    document.getElementById('result-detail').textContent = 'they rage-quit. you win by default.';
    document.getElementById('result-cards').innerHTML = '';

  } else if (msg.type === 'error') {
    const errorCopy = {
      room_not_found: 'that code doesn\'t exist — check it and try again',
      room_full: 'room is full — ask them to start a new one'
    };
    showError(errorCopy[msg.message] || 'something went wrong');
  }
}

// ── Share ─────────────────────────────────────────────────────────
function shareChallenge() {
  const text = `I played Word Duel — can you beat me? ${location.href}`;
  if (navigator.share) {
    navigator.share({ title: 'Word Duel', text, url: location.href });
  } else {
    navigator.clipboard.writeText(text).then(() => alert('Copied! Send it to a friend.'));
  }
}
