const SUPABASE_URL = 'https://dqcuhmuizrubbwwknuqj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jZdUZunU2wgPmfHParVx_w_M_i--ETX';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
let mode = 'login';

function setMode(m) {
  mode = m;
  $('tabLogin').setAttribute('aria-selected', m === 'login');
  $('tabRegister').setAttribute('aria-selected', m === 'register');
  $('nameField').hidden = m === 'login';
  $('authBtn').textContent = m === 'login' ? 'Log in' : 'Create account';
  $('authMsg').textContent = '';
}

function showApp(user) {
  $('auth').hidden = true;
  $('dash').hidden = false;
  $('who').hidden = false;
  $('whoName').textContent = (user.user_metadata && user.user_metadata.name) || user.email;
  if (!$('courses').children.length) addCourse();
  loadHistory();
}

function showAuth() {
  $('auth').hidden = false;
  $('dash').hidden = true;
  $('who').hidden = true;
}

function addCourse() {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="name"><label>Course</label><input class="c-name" placeholder="e.g. Calculus II"></div>
    <div><label>Latest score %</label><input class="c-grade" type="number" min="0" max="100"></div>
    <div><label>Goal % (optional)</label><input class="c-target" type="number" min="0" max="100"></div>
    <button class="link rm" type="button">Remove</button>`;
  row.querySelector('.rm').onclick = () => { if ($('courses').children.length > 1) row.remove(); };
  $('courses').appendChild(row);
}

// Safe rendering: text nodes only (no innerHTML), with short title lines highlighted.
function renderPlan(el, text) {
  el.textContent = '';
  text.split('\n').forEach((line) => {
    const t = line.trim();
    if (t && t.length < 60 && /:$|^[A-Z][^.!?]*$/.test(t)) {
      const s = document.createElement('span');
      s.className = 'h';
      s.textContent = line;
      el.append(s, '\n');
    } else {
      el.append(line + '\n');
    }
  });
}

async function loadHistory() {
  const { data } = await sb.from('plans').select('*').order('created_at', { ascending: false }).limit(10);
  const rows = data || [];
  $('historyBox').hidden = !rows.length;
  $('history').textContent = '';
  rows.forEach((h) => {
    const d = document.createElement('div');
    d.className = 'past';
    const small = document.createElement('small');
    small.textContent = new Date(h.created_at).toLocaleDateString() + ' - ' + h.hours_per_week + ' hrs/week - ' + h.courses.map((c) => c.name).join(', ');
    const p = document.createElement('div');
    p.className = 'plan';
    renderPlan(p, h.plan);
    d.append(small, p);
    $('history').appendChild(d);
  });
}

$('tabLogin').onclick = () => setMode('login');
$('tabRegister').onclick = () => setMode('register');
$('addCourse').onclick = addCourse;
$('logout').onclick = async () => { await sb.auth.signOut(); showAuth(); };

$('authBtn').onclick = async () => {
  const msg = $('authMsg');
  msg.className = 'msg';
  msg.textContent = '';
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || password.length < 8) { msg.textContent = 'Enter your email and a password of at least 8 characters.'; return; }
  if (mode === 'register') {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: $('name').value.trim() } } });
    if (error) { msg.textContent = error.message; return; }
    if (data.session) showApp(data.user);
    else { msg.className = 'msg ok'; msg.textContent = 'Check your email to confirm your account, then log in.'; }
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { msg.textContent = 'Email or password is incorrect.'; return; }
    showApp(data.user);
  }
};

$('planBtn').onclick = async () => {
  const courses = [...document.querySelectorAll('.row')].map((r) => ({
    name: r.querySelector('.c-name').value.trim(),
    grade: r.querySelector('.c-grade').value,
    target: r.querySelector('.c-target').value
  })).filter((c) => c.name && c.grade !== '');
  $('planMsg').textContent = '';
  if (!courses.length) { $('planMsg').textContent = 'Add a course name and your latest score.'; return; }
  const hoursPerWeek = Number($('hours').value);
  $('planBtn').disabled = true;
  $('planBtn').textContent = 'Building your plan...';
  const { data, error } = await sb.functions.invoke('bright-task', { body: { courses, hoursPerWeek, notes: $('notes').value } });
  if (error || !data || !data.plan) {
    $('planMsg').textContent = (data && data.error) || 'The planner could not be reached. Try again in a minute.';
  } else {
    renderPlan($('planText'), data.plan);
    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth' });
    await sb.from('plans').insert({ hours_per_week: hoursPerWeek, courses, plan: data.plan });
    loadHistory();
  }
  $('planBtn').disabled = false;
  $('planBtn').textContent = 'Build my study plan';
};

sb.auth.getSession().then(({ data }) => { if (data.session) showApp(data.session.user); });
