import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzRPZ5HFE95Gge_PPjglx9SJVMwBIYyKo",
  authDomain: "design-control.firebaseapp.com",
  projectId: "design-control",
  storageBucket: "design-control.firebasestorage.app",
  messagingSenderId: "924894268278",
  appId: "1:924894268278:web:542d4933750845d45e0857",
  measurementId: "G-W38F1MGP2J"
};
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const AI_MODEL = 'gemini-3.5-flash-lite';
const CATS = ['veggies', 'dairy', 'meats', 'bakery', 'clean'];
const SYS = 'أنت مساعد ذكي داخل تطبيق "بيت العز" لأسرة مصرية (أحمد وأريام). رد دايماً بالعامية المصرية، بشكل مختصر وواضح ومرتب.';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user = () => localStorage.getItem('app_user') || 'أحمد (الزوج)';
const toast = m => {
  try {
    $('toastMsg').textContent = m;
    const t = $('toast');
    t.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => t.classList.add('opacity-0', 'pointer-events-none'), 3500);
  } catch (e) { alert(m); }
};

try {
  const db = getDatabase(getApps().length ? getApp() : initializeApp(firebaseConfig));

  // ---- live copies of the data (context for the AI) ----
  const D = { grocery: [], monthly: [], recipes: [], meals: [] };
  Object.keys(D).forEach(k => onValue(ref(db, k), s => { D[k] = Object.values(s.val() || {}); }));
  const activeTab = () => ['grocery', 'monthly', 'meals', 'notes', 'recipes'].find(t => $('tab-' + t) && !$('tab-' + t).classList.contains('hidden'));

  // ---- Gemini ----
  function setKey() {
    const k = prompt('الصق مفتاح Gemini API (من aistudio.google.com/apikey):', localStorage.getItem('gemini_key') || '');
    if (k !== null) { localStorage.setItem('gemini_key', k.trim()); toast('تم حفظ المفتاح 🔑'); }
  }

  async function gemini(parts, json) {
    let key = localStorage.getItem('gemini_key');
    if (!key) { setKey(); key = localStorage.getItem('gemini_key'); if (!key) throw new Error('محتاج مفتاح Gemini'); }
    const body = { systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts }] };
    if (json) body.generationConfig = { responseMimeType: 'application/json' };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || ('خطأ ' + r.status));
    return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  }

  function fileToB64(file, max = 1400) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = img.width * s; c.height = img.height * s;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---- UI ----
  const fab = document.createElement('button');
  fab.id = 'aiFab';
  fab.textContent = '✨';
  fab.title = 'مساعد الذكاء الاصطناعي';
  fab.style.cssText = 'position:fixed;left:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:55;width:48px;height:48px;border-radius:50%;border:0;font-size:22px;color:#fff;background:linear-gradient(135deg,#FFB800,#FF5E00);box-shadow:0 6px 16px rgba(255,94,0,.4)';
  document.body.appendChild(fab);

  const sheet = document.createElement('div');
  sheet.className = 'hidden fixed inset-0 bg-black/50 flex items-end justify-center';
  sheet.style.zIndex = 60;
  sheet.innerHTML = `
  <div class="bg-white w-full max-w-[480px] rounded-t-3xl p-4 space-y-3 max-h-[88vh] overflow-y-auto" style="padding-bottom:calc(1rem + env(safe-area-inset-bottom,0px))">
    <div class="flex items-center justify-between">
      <b class="text-sm text-gray-800">✨ مساعد بيت العز</b>
      <div class="flex gap-4 text-gray-400"><button id="aiKeyBtn">🔑</button><button id="aiClose">✕</button></div>
    </div>
    <div class="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
      <button data-t="scan" class="ai-tab py-2 rounded-xl">📷 تسجيل طلبات</button>
      <button data-t="analyze" class="ai-tab py-2 rounded-xl">📊 تحليل</button>
      <button data-t="cook" class="ai-tab py-2 rounded-xl">🍳 وصفات</button>
    </div>

    <div data-p="scan" class="space-y-2.5">
      <input type="file" id="aiFile" accept="image/*" class="hidden">
      <button id="aiPick" class="w-full py-3 rounded-2xl border-2 border-dashed border-orange-300 text-brand-orange text-xs font-bold">📷 صوّر أو اختار صورة الفاتورة</button>
      <img id="aiImg" class="hidden rounded-xl max-h-40 mx-auto" alt="">
      <textarea id="aiNote" rows="2" placeholder="أو اكتب/الصق القائمة هنا (مثال: رز 2 كيلو، زيت، سكر...)" class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-brand-orange resize-none"></textarea>
      <select id="aiTarget" class="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-gray-200 bg-gray-50">
        <option value="grocery">سجّلها في: طلبات البيت</option>
        <option value="w1">سجّلها في: طلبات الشهر - الأسبوع 1</option>
        <option value="w2">سجّلها في: طلبات الشهر - الأسبوع 2</option>
        <option value="w3">سجّلها في: طلبات الشهر - الأسبوع 3</option>
        <option value="w4">سجّلها في: طلبات الشهر - الأسبوع 4</option>
      </select>
      <button id="aiRun" class="w-full bg-brand-orange text-white font-extrabold text-sm py-3 rounded-2xl active:scale-95 disabled:opacity-60">استخرج الطلبات</button>
      <div id="aiPrev"></div>
    </div>

    <div data-p="analyze" class="space-y-2.5 hidden">
      <div class="flex flex-wrap gap-1.5" data-chips="analyze"></div>
      <textarea id="aiQ_analyze" rows="2" placeholder="اسأل عن طلبات الشهر أو المشتريات..." class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-brand-orange resize-none"></textarea>
      <button data-ask="analyze" class="w-full bg-brand-orange text-white font-extrabold text-sm py-3 rounded-2xl active:scale-95 disabled:opacity-60">اسأل</button>
      <div id="aiOut_analyze" class="text-xs leading-relaxed text-gray-700"></div>
    </div>

    <div data-p="cook" class="space-y-2.5 hidden">
      <div class="flex flex-wrap gap-1.5" data-chips="cook"></div>
      <textarea id="aiQ_cook" rows="2" placeholder="مثال: عايزين أكلة سريعة بالفراخ..." class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-brand-orange resize-none"></textarea>
      <button data-ask="cook" class="w-full bg-brand-orange text-white font-extrabold text-sm py-3 rounded-2xl active:scale-95 disabled:opacity-60">اسأل</button>
      <div id="aiOut_cook" class="text-xs leading-relaxed text-gray-700"></div>
      <button id="aiToCart" class="hidden w-full bg-orange-50 border border-orange-200 text-brand-orange font-bold text-xs py-2.5 rounded-2xl">🛒 حوّل المكونات دي لقائمة طلبات</button>
    </div>
  </div>`;
  document.body.appendChild(sheet);

  const CHIPS = {
    analyze: ['حلل طلبات الشهر', 'إيه اللي بيتكرر وممكن نوفره؟', 'إيه اللي لسه ماتجابش؟', 'قسّم الطلبات حسب النوع'],
    cook: ['اقترح غدا النهاردة من وصفاتنا', 'إيه الوصفات اللي مكوناتها قريبة من اللي في السلة؟', 'اعملي جدول وجبات للأسبوع', 'رتب لي الوصفات المحفوظة حسب السهولة']
  };
  Object.entries(CHIPS).forEach(([m, arr]) => {
    sheet.querySelector(`[data-chips="${m}"]`).innerHTML = arr.map(c =>
      `<button class="ai-chip text-[11px] font-bold bg-orange-50 text-brand-orange px-2.5 py-1.5 rounded-full" data-m="${m}">${c}</button>`).join('');
  });

  function showTab(t) {
    sheet.querySelectorAll('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p !== t));
    sheet.querySelectorAll('.ai-tab').forEach(b => {
      b.className = 'ai-tab py-2 rounded-xl ' + (b.dataset.t === t ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-600');
    });
  }

  fab.onclick = () => {
    const t = activeTab();
    showTab(t === 'recipes' || t === 'meals' ? 'cook' : 'scan');
    $('aiTarget').value = t === 'monthly' ? 'w' + Math.min(4, Math.ceil(new Date().getDate() / 7)) : 'grocery';
    sheet.classList.remove('hidden');
  };
  $('aiClose').onclick = () => sheet.classList.add('hidden');
  sheet.onclick = e => { if (e.target === sheet) sheet.classList.add('hidden'); };
  $('aiKeyBtn').onclick = setKey;
  sheet.querySelectorAll('.ai-tab').forEach(b => b.onclick = () => showTab(b.dataset.t));
  sheet.querySelectorAll('.ai-chip').forEach(b => b.onclick = () => { $('aiQ_' + b.dataset.m).value = b.textContent; });

  // ---- 1) invoice / text -> items -> preview -> save at once ----
  let imgB64 = null, pending = [];
  $('aiPick').onclick = () => $('aiFile').click();
  $('aiFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    imgB64 = await fileToB64(f);
    $('aiImg').src = 'data:image/jpeg;base64,' + imgB64;
    $('aiImg').classList.remove('hidden');
  };

  async function extractItems(text, image) {
    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
    parts.push({ text:
      'استخرج بنود المشتريات/الطلبات من الصورة أو النص التالي. رجّع JSON فقط بالشكل: ' +
      '{"items":[{"name":"اسم الغرض بالعربي بشكل بسيط بدون أسعار","qty":"الكمية لو موجودة وإلا فاضي","category":"veggies|dairy|meats|bakery|clean"}]}. ' +
      'veggies=خضار وفاكهة، dairy=بقالة وألبان، meats=لحوم ودواجن وأسماك، bakery=مخبوزات، clean=نظافة. تجاهل الإجماليات والضرائب والأسعار.\n' +
      (text ? 'النص/الملاحظة:\n' + text : '') });
    const raw = await gemini(parts, true);
    const obj = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return (obj.items || []).filter(i => i && i.name);
  }

  function renderPreview() {
    const box = $('aiPrev');
    if (!pending.length) { box.innerHTML = '<p class="text-xs text-gray-400 text-center">مفيش بنود اتلقت</p>'; return; }
    box.innerHTML = `
      <div class="space-y-1.5">
        ${pending.map((it, i) => `
          <label class="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs">
            <input type="checkbox" data-i="${i}" ${it.on ? 'checked' : ''} class="w-4 h-4 accent-brand-orange">
            <span class="font-bold text-gray-800 flex-1">${esc(it.name)}</span>
            ${it.qty ? `<span class="text-[10px] bg-yellow-50 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">${esc(it.qty)}</span>` : ''}
          </label>`).join('')}
      </div>
      <button id="aiSave" class="w-full mt-2 bg-green-600 text-white font-extrabold text-sm py-3 rounded-2xl active:scale-95">تسجيل ${pending.filter(i => i.on).length} بند ✓</button>`;
    box.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { pending[c.dataset.i].on = c.checked; renderPreview(); });
    $('aiSave').onclick = saveItems;
  }

  function saveItems() {
    const target = $('aiTarget').value;
    const items = pending.filter(i => i.on);
    const dev = localStorage.getItem('app_device_id');
    items.forEach((it, i) => {
      const base = { name: String(it.name).trim(), checked: false, addedBy: user() + ' 🤖', senderDeviceId: dev, createdAt: Date.now() + i };
      if (target === 'grocery') set(push(ref(db, 'grocery')), { ...base, category: CATS.includes(it.category) ? it.category : 'dairy', urgent: false });
      else set(push(ref(db, 'monthly')), { ...base, qty: it.qty || '', week: +target.slice(1) });
    });
    pending = [];
    $('aiPrev').innerHTML = '';
    $('aiNote').value = ''; $('aiImg').classList.add('hidden'); imgB64 = null; $('aiFile').value = '';
    toast(`تم تسجيل ${items.length} بند ✅`);
    sheet.classList.add('hidden');
  }

  async function runExtract(text, image) {
    const btn = $('aiRun');
    btn.disabled = true; btn.textContent = 'جاري القراءة... ⏳';
    try { pending = (await extractItems(text, image)).map(i => ({ ...i, on: true })); renderPreview(); }
    catch (e) { toast('تعذر التحليل: ' + e.message); }
    btn.disabled = false; btn.textContent = 'استخرج الطلبات';
  }
  $('aiRun').onclick = () => {
    const note = $('aiNote').value.trim();
    if (!imgB64 && !note) return toast('ارفع صورة أو اكتب قائمة الأول');
    runExtract(note, imgB64);
  };

  // ---- 2) analysis + 3) recipes assistant ----
  let lastCook = '';
  function contextFor(mode) {
    const m = D.monthly.map(i => ({ الاسم: i.name, الكمية: i.qty || '', الأسبوع: i.week, اتجاب: !!i.checked, بواسطة: i.addedBy }));
    const g = D.grocery.map(i => ({ الاسم: i.name, النوع: i.category, اتجاب: !!i.checked, عاجل: !!i.urgent, بواسطة: i.addedBy }));
    if (mode === 'analyze') return `طلبات الشهر (4 أسابيع): ${JSON.stringify(m)}\nطلبات البيت الحالية: ${JSON.stringify(g)}`;
    const r = D.recipes.map(x => ({ الاسم: x.title, ملاحظات: x.notes || '', المنصة: x.url }));
    const ml = D.meals.map(x => ({ الاسم: x.title, اليوم: x.day, المكونات: x.ingredients || [], موافق: (x.upVotes || []).length, رفض: (x.downVotes || []).length }));
    return `الوصفات المحفوظة: ${JSON.stringify(r)}\nجدول الوجبات والتصويت: ${JSON.stringify(ml)}\nاللي في سلة الطلبات حالياً: ${JSON.stringify(g)}`;
  }
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[\*\-]\s+/gm, '• ').replace(/\n/g, '<br>');

  sheet.querySelectorAll('[data-ask]').forEach(btn => btn.onclick = async () => {
    const mode = btn.dataset.ask;
    const q = $('aiQ_' + mode).value.trim();
    if (!q) return toast('اكتب سؤالك أو اختار اقتراح');
    const out = $('aiOut_' + mode);
    btn.disabled = true; out.textContent = 'بفكر... ⏳';
    try {
      const ans = await gemini([{ text: `بيانات التطبيق:\n${contextFor(mode)}\n\nالسؤال: ${q}\n\nاعتمد على البيانات دي فقط، ولو مفيش داتا كفاية قول كده بصراحة.` }], false);
      out.innerHTML = fmt(ans);
      if (mode === 'cook') { lastCook = ans; $('aiToCart').classList.remove('hidden'); }
    } catch (e) { out.textContent = 'تعذر الرد: ' + e.message; }
    btn.disabled = false;
  });

  $('aiToCart').onclick = () => {
    showTab('scan');
    $('aiTarget').value = 'grocery';
    runExtract('استخرج المكونات اللي محتاجين نشتريها من الاقتراح ده:\n' + lastCook, null);
  };
} catch (e) {
  console.error('AI addon failed', e);
  alert('مشكلة في تحميل المساعد الذكي: ' + (e.message || e));
}
