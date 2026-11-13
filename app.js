/* INICIO DO ARQUIVO app.js */
const STORAGE_KEY = 'autofiltros_pro_v3';
const THEME_KEY = 'autofiltros_theme';
const CROSS_REFERENCE = window.CROSS_REFERENCE || {};
const DEFAULT_DATA = window.DEFAULT_DATA || [];
const FIELDS = ['oleo','ar','cabine','combustivel','cambio'];
const FIELD_LABELS = {oleo:'Óleo', ar:'Ar', cabine:'Cabine', combustivel:'Combustível', cambio:'Câmbio'};

let data = [];
let currentView = 'veiculos';
let sortState = {field:null, dir:1};
let activeChip = 'todos';
let activeEquivBrand = 'todos';
let searchTerm = '';
let compatSearchTerm = '';
let equivSearchTerm = '';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function normalize(t){
  return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function normalizeCode(code){
  return String(code||'').toUpperCase().replace(/\s+/g,'');
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function highlight(text, term){
  if(!term || !text) return escapeHtml(text);
  const re = new RegExp('('+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
  return escapeHtml(text).replace(re,'<mark>$1</mark>');
}
function toast(msg, type='info'){
  const icons = {success:'✓', error:'✕', info:'ℹ'};
  const el = document.createElement('div');
  el.className = 'toast '+type;
  el.innerHTML = '<span class="toast-icon">'+(icons[type]||'ℹ')+'</span><span>'+escapeHtml(msg)+'</span>';
  $('#toastContainer').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(30px)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300);},3000);
}
function getEquivalents(code){
  const key = normalizeCode(code);
  if(CROSS_REFERENCE[key]) return CROSS_REFERENCE[key];
  const parts = key.split(/[\/,;]/).map(s=>s.trim()).filter(Boolean);
  for(const part of parts){
    if(CROSS_REFERENCE[part]) return CROSS_REFERENCE[part];
  }
  return null;
}
function brandClass(brand){
  const b = brand.toUpperCase();
  if(b === 'MANN') return 'mann';
  if(b === 'FRAM') return 'fram';
  if(b === 'TECFIL') return 'tecfil';
  if(b === 'MAHLE') return 'mahle';
  if(b === 'WEGA') return 'wega';
  if(b === 'HENGST') return 'hengst';
  return 'outros';
}
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ data = JSON.parse(raw); }
    else { data = DEFAULT_DATA.map(x=>({...x})); save(); }
  }catch(e){ data = DEFAULT_DATA.map(x=>({...x})); }
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}
function buildCompatIndex(){
  const index = new Map();
  data.forEach(v=>{
    FIELDS.forEach(f=>{
      const code = (v[f]||'').trim();
      if(!code) return;
      const parts = code.split(/[\/,;]/).map(s=>s.trim()).filter(Boolean);
      parts.forEach(p=>{
        if(!index.has(p)) index.set(p, []);
        index.get(p).push({veiculo:v.veiculo, campo:f, id:v.id});
      });
    });
  });
  return index;
}
function getFilteredData(){
  let rows = [...data];
  if(activeChip === 'favoritos') rows = rows.filter(v=>v.favorito);
  else if(activeChip === 'cambio') rows = rows.filter(v=>(v.cambio||'').trim());
  else if(activeChip === 'fiat') rows = rows.filter(v=>/fiat|toro|renegade|compass|pulse|cronos/i.test(v.veiculo));
  else if(activeChip === 'vw') rows = rows.filter(v=>/vw|volks|polo|virtus|nivus|amarok|gol|voyage|saveiro|tcross/i.test(v.veiculo));
  else if(activeChip === 'honda') rows = rows.filter(v=>/honda|civic|hrv|fit|city/i.test(v.veiculo));
  else if(activeChip === 'toyota') rows = rows.filter(v=>/toyota|corolla|hilux|sw4/i.test(v.veiculo));
  if(searchTerm){
    const t = normalize(searchTerm);
    rows = rows.filter(v=>{
      const hay = normalize([v.veiculo,v.oleo,v.ar,v.cabine,v.combustivel,v.cambio].join(' '));
      return hay.includes(t);
    });
  }
  if(sortState.field){
    rows.sort((a,b)=>{
      const av = normalize(a[sortState.field]||'');
      const bv = normalize(b[sortState.field]||'');
      if(av < bv) return -1*sortState.dir;
      if(av > bv) return 1*sortState.dir;
      return 0;
    });
  }
  return rows;
}
function renderTable(){
  const rows = getFilteredData();
  const idx = buildCompatIndex();
  const tbody = $('#tableBody');
  const term = searchTerm;
  $('#tableInfo').innerHTML = 'Exibindo <strong>'+rows.length+'</strong> de <strong>'+data.length+'</strong> veículos';
  $('#tabCount').textContent = data.length;
  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">🔎</div><h3>Nenhum resultado</h3><p>'+(searchTerm ? 'Nada encontrado para "'+escapeHtml(searchTerm)+'"' : 'Adicione veículos para começar')+'</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(v=>{
    const cell = (code) => {
      if(!code || !code.trim()) return '<span class="filter-code empty">—</span>';
      const parts = code.split(/[\/,;]/).map(s=>s.trim()).filter(Boolean);
      return parts.map(p=>{
        const shared = (idx.get(p)||[]).length;
        const badge = shared>1 ? '<span class="shared" title="Usado por '+shared+' veículos">'+shared+'</span>' : '';
        const flag = getEquivalents(p) ? '<span class="equiv-flag" title="Possui equivalências">⇄</span>' : '';
        return '<span class="filter-code" data-code="'+escapeHtml(p)+'" title="Clique para ver compatibilidade e equivalentes">'+highlight(p,term)+badge+flag+'</span>';
      }).join(' / ');
    };
    return '<tr><td class="vehicle-cell"><button class="fav-btn '+(v.favorito?'on':'')+'" data-fav="'+v.id+'" title="Favoritar">'+(v.favorito?'★':'☆')+'</button>'+highlight(v.veiculo,term)+'</td><td>'+cell(v.oleo)+'</td><td>'+cell(v.ar)+'</td><td>'+cell(v.cabine)+'</td><td>'+cell(v.combustivel)+'</td><td>'+cell(v.cambio)+'</td><td style="text-align:center;white-space:nowrap"><button class="icon-btn" style="width:28px;height:28px;font-size:12px" data-edit="'+v.id+'" title="Editar">✎</button><button class="icon-btn" style="width:28px;height:28px;font-size:12px;color:var(--danger)" data-del="'+v.id+'" title="Excluir">✕</button></td></tr>';
  }).join('');
  tbody.querySelectorAll('.filter-code[data-code]').forEach(el=>{
    el.addEventListener('click', ()=>openCompatModal(el.dataset.code));
  });
  tbody.querySelectorAll('[data-fav]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const v = data.find(x=>x.id===el.dataset.fav);
      if(!v) return;
      v.favorito = !v.favorito;
      save(); renderTable(); renderFavoritos(); updateTabBadges();
      toast(v.favorito ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'success');
    });
  });
  tbody.querySelectorAll('[data-edit]').forEach(el=>{
    el.addEventListener('click', ()=>openFormModal(data.find(x=>x.id===el.dataset.edit)));
  });
  tbody.querySelectorAll('[data-del]').forEach(el=>{
    el.addEventListener('click', ()=>confirmDelete(el.dataset.del));
  });
}
function renderFavoritos(){
  const favs = data.filter(v=>v.favorito);
  const idx = buildCompatIndex();
  const tbody = $('#favBody');
  $('#tabFav').textContent = favs.length;
  $('#favInfo').innerHTML = '<strong>'+favs.length+'</strong> veículo(s) favoritado(s)';
  if(!favs.length){
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon">⭐</div><h3>Nenhum favorito ainda</h3><p>Clique na estrela ☆ ao lado do veículo para favoritar</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = favs.map(v=>{
    const cell = (code)=>{
      if(!code||!code.trim()) return '<span class="filter-code empty">—</span>';
      const parts = code.split(/[\/,;]/).map(s=>s.trim()).filter(Boolean);
      return parts.map(p=>{
        const shared = (idx.get(p)||[]).length;
        const badge = shared>1 ? '<span class="shared">'+shared+'</span>' : '';
        const flag = getEquivalents(p) ? '<span class="equiv-flag">⇄</span>' : '';
        return '<span class="filter-code" data-code="'+escapeHtml(p)+'">'+escapeHtml(p)+badge+flag+'</span>';
      }).join(' / ');
    };
    return '<tr><td class="vehicle-cell"><button class="fav-btn on">★</button>'+escapeHtml(v.veiculo)+'</td><td>'+cell(v.oleo)+'</td><td>'+cell(v.ar)+'</td><td>'+cell(v.cabine)+'</td><td>'+cell(v.combustivel)+'</td><td>'+cell(v.cambio)+'</td></tr>';
  }).join('');
  tbody.querySelectorAll('.filter-code[data-code]').forEach(el=>{
    el.addEventListener('click', ()=>openCompatModal(el.dataset.code));
  });
}
function renderCompat(){
  const idx = buildCompatIndex();
  const term = normalize(compatSearchTerm);
  const container = $('#compatContainer');
  const entries = [...idx.entries()]
    .filter(([code, list])=> !term || normalize(code).includes(term) || list.some(x=>normalize(x.veiculo).includes(term)))
    .filter(([code, list])=> list.length > 1)
    .sort((a,b)=> b[1].length - a[1].length);
  $('#tabCompat').textContent = entries.length;
  if(!entries.length){
    container.innerHTML = '<div class="empty"><div class="empty-icon">🔗</div><h3>Nenhum filtro compartilhado</h3><p>'+(compatSearchTerm ? 'Nenhum código corresponde à busca' : 'Nenhum código é usado por 2+ veículos ainda')+'</p></div>';
    return;
  }
  container.innerHTML = '<div class="compat-grid">'+entries.map(([code, list])=>{
    const cats = [...new Set(list.map(x=>x.campo))];
    return '<div class="compat-card"><div class="compat-card-header"><div class="compat-code">'+highlight(code, compatSearchTerm)+'</div><div class="compat-count">'+list.length+' usos</div></div><div class="compat-category">'+cats.map(c=>FIELD_LABELS[c]).join(' • ')+'</div><div class="compat-vehicles">'+list.map(x=>'<div class="compat-vehicle"><span>'+highlight(x.veiculo, compatSearchTerm)+'</span><span class="cat-tag">'+FIELD_LABELS[x.campo]+'</span></div>').join('')+'</div></div>';
  }).join('')+'</div>';
}
function renderEquivalencias(){
  const container = $('#equivContainer');
  const term = normalize(equivSearchTerm);
  const entries = Object.entries(CROSS_REFERENCE);
  const filtered = entries.filter(([origCode, brands])=>{
    if(!term) return true;
    if(normalize(origCode).includes(term)) return true;
    return Object.entries(brands).some(([marca, codigo])=>{
      return normalize(codigo).includes(term) || normalize(marca).includes(term);
    });
  });
  const byBrand = activeEquivBrand === 'todos'
    ? filtered
    : filtered.filter(([origCode, brands])=> brands[activeEquivBrand]);
  $('#tabEquiv').textContent = entries.length;
  if(!byBrand.length){
    container.innerHTML = '<div class="empty"><div class="empty-icon">🔄</div><h3>Nenhuma equivalência encontrada</h3><p>'+(equivSearchTerm ? 'Tente outro código ou marca' : 'Cadastre equivalências no objeto CROSS_REFERENCE')+'</p></div>';
    return;
  }
  container.innerHTML = '<div class="compat-grid">'+byBrand.map(([origCode, brands])=>{
    return '<div class="compat-card"><div class="compat-card-header"><div class="compat-code">'+highlight(origCode, equivSearchTerm)+'</div><div class="compat-count">'+Object.keys(brands).length+' marcas</div></div><div class="compat-category">Equivalentes disponíveis</div><div class="equiv-brands">'+Object.entries(brands).map(([marca, codigo])=>'<span class="brand-tag '+brandClass(marca)+'" title="Clique para copiar" onclick="copyText(\''+escapeHtml(codigo)+'\')" style="cursor:pointer">'+escapeHtml(marca)+': '+escapeHtml(codigo)+'</span>').join('')+'</div></div>';
  }).join('')+'</div>';
}
function renderDashboard(){
  const idx = buildCompatIndex();
  const totalVehicles = data.length;
  const totalUnique = idx.size;
  const totalFavs = data.filter(v=>v.favorito).length;
  const sharedFilters = [...idx.entries()].filter(([c,l])=>l.length>1);
  const totalEquiv = Object.keys(CROSS_REFERENCE).length;
  $('#dashStats').innerHTML =
    '<div class="stat-card"><div class="stat-label">Veículos Cadastrados</div><div class="stat-value accent">'+totalVehicles+'</div><div class="stat-detail">'+totalFavs+' favoritado(s)</div></div>' +
    '<div class="stat-card"><div class="stat-label">Códigos Únicos</div><div class="stat-value">'+totalUnique+'</div><div class="stat-detail">'+FIELDS.reduce((a,f)=>a+data.filter(v=>v[f]).length,0)+' aplicações</div></div>' +
    '<div class="stat-card"><div class="stat-label">Filtros Compartilhados</div><div class="stat-value">'+sharedFilters.length+'</div><div class="stat-detail">usados em 2+ veículos</div></div>' +
    '<div class="stat-card"><div class="stat-label">Equivalências Cadastradas</div><div class="stat-value">'+totalEquiv+'</div><div class="stat-detail">códigos com cross-ref</div></div>';
  const top8 = [...idx.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,8);
  const maxTop = top8[0]?.[1].length || 1;
  $('#topFiltersChart').innerHTML = top8.length ? top8.map(([code,list])=>
    '<div class="bar-item"><div class="bar-header"><span class="code">'+escapeHtml(code)+'</span><span class="cnt">'+list.length+' veículo(s)</span></div><div class="bar-track"><div class="bar-fill" style="width:'+(list.length/maxTop)*100+'%"></div></div></div>'
  ).join('') : '<div class="empty"><p>Sem dados</p></div>';
  const catCount = FIELDS.map(f=>({f, count:data.filter(v=>v[f]&&v[f].trim()).length}));
  const maxCat = Math.max(...catCount.map(c=>c.count), 1);
  $('#catDistribution').innerHTML = catCount.map(c=>
    '<div class="bar-item"><div class="bar-header"><span>'+FIELD_LABELS[c.f]+'</span><span class="cnt">'+c.count+' cadastrado(s)</span></div><div class="bar-track"><div class="bar-fill warn" style="width:'+(c.count/maxCat)*100+'%"></div></div></div>'
  ).join('');
}
function openCompatModal(code){
  const idx = buildCompatIndex();
  const list = idx.get(code) || [];
  const equivalents = getEquivalents(code);
  const modal = $('#modal');
  let html = '<div class="modal-header"><div class="modal-title">Compatibilidade do Filtro<div class="modal-subtitle">Código: <strong style="color:var(--primary);font-family:monospace">'+escapeHtml(code)+'</strong></div></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn btn-primary btn-sm" onclick="copyText(\''+escapeHtml(code)+'\')">📋 Copiar código</button><span class="btn btn-ghost btn-sm" style="cursor:default">'+list.length+' veículo(s)</span></div>';
  if(list.length){
    html += '<div class="compat-list">'+list.map(x=>'<div class="compat-list-item"><div class="name">'+escapeHtml(x.veiculo)+'</div><div class="cat">'+FIELD_LABELS[x.campo]+'</div></div>').join('')+'</div>';
  } else {
    html += '<p style="color:var(--text-muted);font-size:13px">Este código não está vinculado a nenhum veículo cadastrado.</p>';
  }
  if(equivalents){
    html += '<div class="equiv-section"><div class="equiv-title"><span>🔄</span> Equivalentes em outras marcas</div><div class="equiv-grid">'+Object.entries(equivalents).map(([marca, codigo])=>'<div class="equiv-item" onclick="copyText(\''+escapeHtml(codigo)+'\')" title="Copiar '+escapeHtml(codigo)+'"><span class="equiv-brand">'+escapeHtml(marca)+'</span><span class="equiv-code">'+escapeHtml(codigo)+'</span></div>').join('')+'</div><p style="font-size:11px;color:var(--text-dim);margin-top:10px">💡 Clique em qualquer código para copiá-lo.</p></div>';
  } else {
    html += '<div class="equiv-section"><div class="equiv-empty">ℹ️ Nenhum equivalente cadastrado para este código ainda.</div></div>';
  }
  html += '</div><div class="modal-footer"><button class="btn" onclick="closeModal()">Fechar</button></div>';
  modal.innerHTML = html;
  $('#modalBackdrop').classList.add('show');
}
function openFormModal(vehicle){
  const isEdit = !!vehicle;
  const v = vehicle || {id:uid(), veiculo:'', oleo:'', ar:'', cabine:'', combustivel:'', cambio:'', favorito:false};
  const modal = $('#modal');
  const vJson = JSON.stringify(v).replace(/'/g,'&#39;');
  modal.innerHTML =
    '<div class="modal-header"><div class="modal-title">'+(isEdit?'Editar Veículo':'Novo Veículo')+'<div class="modal-subtitle">'+(isEdit?'Atualize as informações do filtro':'Cadastre um novo veículo e seus filtros')+'</div></div><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><div class="form-group"><label class="form-label">Veículo / Aplicação *</label><input class="form-input" id="f-veiculo" value="'+escapeHtml(v.veiculo)+'" placeholder="Ex: FIAT TORO 1.8 FLEX"></div>' +
    '<div class="form-grid"><div class="form-group"><label class="form-label">Filtro Óleo</label><input class="form-input" id="f-oleo" value="'+escapeHtml(v.oleo)+'" placeholder="Ex: WOE626"></div>' +
    '<div class="form-group"><label class="form-label">Filtro Ar</label><input class="form-input" id="f-ar" value="'+escapeHtml(v.ar)+'" placeholder="Ex: JFA0998"></div>' +
    '<div class="form-group"><label class="form-label">Filtro Cabine</label><input class="form-input" id="f-cabine" value="'+escapeHtml(v.cabine)+'" placeholder="Ex: AKX2108"></div>' +
    '<div class="form-group"><label class="form-label">Filtro Combustível</label><input class="form-input" id="f-combustivel" value="'+escapeHtml(v.combustivel)+'" placeholder="Ex: FCD0793"></div></div>' +
    '<div class="form-group"><label class="form-label">Filtro Câmbio</label><input class="form-input" id="f-cambio" value="'+escapeHtml(v.cambio)+'" placeholder="Ex: WFC572 / WEOC004"></div></div>' +
    '<div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveVehicle('+vJson+')">'+(isEdit?'Salvar Alterações':'Cadastrar')+'</button></div>';
  $('#modalBackdrop').classList.add('show');
  setTimeout(()=>$('#f-veiculo').focus(), 100);
}
function saveVehicle(original){
  const veiculo = $('#f-veiculo').value.trim();
  if(!veiculo){ toast('Informe o nome do veículo', 'error'); return; }
  const payload = {
    ...original, veiculo,
    oleo: $('#f-oleo').value.trim(),
    ar: $('#f-ar').value.trim(),
    cabine: $('#f-cabine').value.trim(),
    combustivel: $('#f-combustivel').value.trim(),
    cambio: $('#f-cambio').value.trim()
  };
  const idx = data.findIndex(x=>x.id===payload.id);
  if(idx>=0){ data[idx] = payload; toast('Veículo atualizado', 'success'); }
  else { data.unshift(payload); toast('Veículo cadastrado', 'success'); }
  save(); closeModal(); refreshAll();
}
function confirmDelete(id){
  const v = data.find(x=>x.id===id);
  if(!v) return;
  const modal = $('#modal');
  modal.innerHTML =
    '<div class="modal-header"><div class="modal-title">Confirmar Exclusão</div><button class="modal-close" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><p>Tem certeza que deseja excluir <strong>'+escapeHtml(v.veiculo)+'</strong>? Essa ação não pode ser desfeita.</p></div>' +
    '<div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-danger" onclick="doDelete(\''+id+'\')">Excluir</button></div>';
  $('#modalBackdrop').classList.add('show');
}
function doDelete(id){
  data = data.filter(x=>x.id!==id);
  save(); closeModal(); refreshAll();
  toast('Veículo excluído', 'success');
}
function closeModal(){
  $('#modalBackdrop').classList.remove('show');
  setTimeout(()=>$('#modal').innerHTML='', 200);
}
function copyText(text){
  navigator.clipboard.writeText(text).then(()=>toast('Copiado: '+text, 'success')).catch(()=>toast('Falha ao copiar', 'error'));
}
function exportData(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'autofiltros_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(url);
  toast('Backup exportado', 'success');
}
function importData(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const parsed = JSON.parse(e.target.result);
      if(!Array.isArray(parsed)) throw new Error('formato inválido');
      const valid = parsed.filter(x=>x && typeof x.veiculo === 'string');
      if(!valid.length) throw new Error('nenhum veículo válido');
      valid.forEach(v=>{ if(!v.id) v.id = uid(); });
      data = valid;
      save(); refreshAll();
      toast(valid.length+' veículos importados', 'success');
    }catch(err){
      toast('Arquivo inválido: '+err.message, 'error');
    }
  };
  reader.readAsText(file);
}
function toggleTheme(){
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, isLight ? 'dark' : 'light');
  $('#themeBtn').textContent = isLight ? '🌙' : '☀️';
  toast(isLight ? 'Tema escuro' : 'Tema claro', 'info');
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  $('#themeBtn').textContent = saved === 'light' ? '☀️' : '🌙';
}
function switchView(view){
  currentView = view;
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===view));
  $$('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+view));
  if(view==='compat') renderCompat();
  if(view==='equiv') renderEquivalencias();
  if(view==='dashboard') renderDashboard();
  if(view==='favoritos') renderFavoritos();
  if(view==='veiculos') renderTable();
}
function updateTabBadges(){
  $('#tabCount').textContent = data.length;
  $('#tabFav').textContent = data.filter(v=>v.favorito).length;
  const idx = buildCompatIndex();
  $('#tabCompat').textContent = [...idx.entries()].filter(([c,l])=>l.length>1).length;
  $('#tabEquiv').textContent = Object.keys(CROSS_REFERENCE).length;
}
function refreshAll(){
  renderTable();
  updateTabBadges();
  if(currentView==='compat') renderCompat();
  if(currentView==='equiv') renderEquivalencias();
  if(currentView==='dashboard') renderDashboard();
  if(currentView==='favoritos') renderFavoritos();
}
function bindEvents(){
  $$('.tab').forEach(t=> t.addEventListener('click', ()=>switchView(t.dataset.view)));
  const si = $('#searchInput');
  si.addEventListener('input', ()=>{
    searchTerm = si.value;
    $('#clearBtn').classList.toggle('hidden', !searchTerm);
    renderTable();
  });
  $('#clearBtn').addEventListener('click', ()=>{
    si.value=''; searchTerm=''; $('#clearBtn').classList.add('hidden'); renderTable();
  });
  $$('.chip[data-chip]').forEach(ch=>ch.addEventListener('click', ()=>{
    $$('.chip[data-chip]').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    activeChip = ch.dataset.chip;
    renderTable();
  }));
  $$('.chip[data-brand]').forEach(ch=>ch.addEventListener('click', ()=>{
    $$('.chip[data-brand]').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    activeEquivBrand = ch.dataset.brand;
    renderEquivalencias();
  }));
  $$('th[data-sort]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const f = th.dataset.sort;
      if(sortState.field === f){ sortState.dir *= -1; }
      else { sortState.field = f; sortState.dir = 1; }
      $$('th').forEach(h=>h.classList.remove('sorted'));
      th.classList.add('sorted');
      renderTable();
    });
  });
  $('#resetSort').addEventListener('click', ()=>{
    sortState = {field:null, dir:1};
    $$('th').forEach(h=>h.classList.remove('sorted'));
    renderTable();
  });
  $('#compatSearch').addEventListener('input', (e)=>{
    compatSearchTerm = e.target.value;
    renderCompat();
  });
  $('#equivSearch').addEventListener('input', (e)=>{
    equivSearchTerm = e.target.value;
    renderEquivalencias();
  });
  $('#addBtn').addEventListener('click', ()=>openFormModal());
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', ()=>$('#importInput').click());
  $('#importInput').addEventListener('change', e=>{
    if(e.target.files[0]) importData(e.target.files[0]);
    e.target.value='';
  });
  $('#modalBackdrop').addEventListener('click', e=>{
    if(e.target === $('#modalBackdrop')) closeModal();
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape') closeModal();
    if(e.key === '/' && !/input|textarea/i.test(e.target.tagName)){
      e.preventDefault();
      (currentView==='compat' ? $('#compatSearch') : currentView==='equiv' ? $('#equivSearch') : $('#searchInput')).focus();
    }
    if(e.key === 't' && !/input|textarea/i.test(e.target.tagName)) toggleTheme();
  });
}
function init(){
  initTheme();
  load();
  bindEvents();
  refreshAll();
}
init();
/* FIM DO ARQUIVO app.js */