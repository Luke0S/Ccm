const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const day = (date) => new Date(`${date}T12:00:00`);
const iso = (date) => date.toISOString().slice(0, 10);
const palettes = ['#244c42', '#c99044', '#bf6251', '#506f9a', '#655a8f'];
const categoryColors = ['#e86c5a', '#f2b861', '#4f8b81', '#6b77b8', '#9d7b69', '#c8c2b8'];
let user, cards = [], transactions = [], activeCard = 0, selectedCycle = new Date();
async function api(action, body) { const response = await fetch(`/api.php?action=${encodeURIComponent(action)}`, { method: body ? 'POST' : 'GET', headers: body ? {'Content-Type':'application/json'} : {}, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed.'); return data; }

function cycleFor(card, reference = selectedCycle) {
  const today = new Date(reference); const close = Math.min(card.statement_day, 28);
  const start = new Date(today.getFullYear(), today.getMonth(), close + 1);
  if (today.getDate() <= close) start.setMonth(start.getMonth() - 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, close);
  const priorStart = new Date(start.getFullYear(), start.getMonth() - 1, start.getDate());
  const priorEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  return { start, end, priorStart, priorEnd };
}
function inRange(transaction, start, end) { const value = day(transaction.occurred_on); return value >= start && value <= end; }
function cardTransactions(card, range) { return transactions.filter(t => t.card_id === card.id && inRange(t, range.start, range.end)); }
function total(items) { return items.reduce((sum, item) => sum + Number(item.amount), 0); }
function dateRange(range) { return `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; }
function empty(target, message) { $(target).innerHTML = `<p class="empty-state">${message}</p>`; }

async function loadData() {
  try { const data = await api('data'); cards = data.cards; transactions = data.transactions; activeCard = Math.min(activeCard, Math.max(cards.length - 1, 0)); render(); } catch (error) { showError(error.message); }
}
function animateNumber(element, end) { const start=performance.now(), duration=650; const tick=now=>{ const p=Math.min((now-start)/duration,1), value=end*(1-(1-p)*(1-p)); element.textContent=money(value); if(p<1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function render() {
  $('#card-badge').textContent = cards.length;
  $('#page-period').textContent = selectedCycle.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  renderCycleOptions(); renderOverview(); renderWallet(); if (!$('#card-view').classList.contains('hidden')) renderCardView();
}
function renderCycleOptions() {
  const options = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d; });
  const html = options.map(d => `<option value="${iso(d)}">${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>`).join('');
  ['#month-select', '#card-cycle-select'].forEach(id => { $(id).innerHTML = html; $(id).value = iso(selectedCycle); });
}
function renderOverview() {
  if (!cards.length) {
    $('#total-cycle-spend').textContent = money(0); $('#total-available').textContent = money(0); $('#previous-cycle-spend').textContent = money(0); $('#cycle-label').textContent = 'Add a card to begin'; $('#limit-summary').textContent = 'Add a card to begin tracking'; $('#previous-label').textContent = 'Previous statements appear here'; $('#total-meter').style.width = '0%'; $('#donut-total').textContent = money(0); empty('#category-legend', 'Add cards and transactions to see your spending.'); empty('#transaction-list', 'No transactions yet.'); return;
  }
  const cycleItems = cards.flatMap(card => cardTransactions(card, cycleFor(card)));
  const priorItems = cards.flatMap(card => { const c = cycleFor(card); return transactions.filter(t => t.card_id === card.id && inRange(t, c.priorStart, c.priorEnd)); });
  const limit = total(cards.map(c => ({ amount: c.credit_limit }))); const current = total(cycleItems);
  animateNumber($('#total-cycle-spend'), current); animateNumber($('#total-available'), Math.max(limit - current, 0)); animateNumber($('#previous-cycle-spend'), total(priorItems)); $('#cycle-label').textContent = 'Across each card’s active statement cycle'; $('#limit-summary').textContent = `${money(limit)} combined credit limit`; $('#previous-label').textContent = 'Statement spending before this cycle'; $('#total-meter').style.width = `${Math.min(current / limit * 100, 100)}%`; $('#donut-total').textContent = money(current); renderDonut('#donut', cycleItems); renderLegend('#category-legend', cycleItems); renderTransactions('#transaction-list', transactions.slice(0, 5));
}
function renderWallet() {
  const wallet = $('#wallet');
  if (!cards.length) { empty('#wallet', 'Your wallet is ready. Add your first card.'); empty('#card-detail', 'Select “Add a card” to start planning your spending.'); $('#card-count').textContent = '00 / 00'; return; }
  wallet.innerHTML = cards.map((card, index) => `<button class="credit-card ${index === activeCard ? 'selected' : ''}" draggable="true" style="--index:${index};--card-color:${card.color}" data-index="${index}"><span class="network">${networkLogo(card.network)}</span><span class="chip">▦</span><span class="card-number">${escapeHtml(card.issuer || 'CREDIT HUB')}</span><span class="card-footer"><span>${card.name}</span><span>PAYMENT DUE<br><b>DAY ${card.due_day}</b></span></span></button>`).join('');
  wallet.querySelectorAll('.credit-card').forEach(el => { el.onclick = () => { activeCard = Number(el.dataset.index); renderWallet(); }; el.ondragstart = e => e.dataTransfer.setData('card-index', el.dataset.index); el.ondragover = e => e.preventDefault(); el.ondrop = async e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('card-index')), to = Number(el.dataset.index); if (from !== to) await reorderCard(from, to); }; });
  const card = cards[activeCard], range = cycleFor(card), spend = total(cardTransactions(card, range));
  $('#card-count').textContent = `${String(activeCard + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  $('#card-detail').innerHTML = `<div class="detail-top"><span class="mini-network">${card.network}</span><button class="open-detail" aria-label="Open card">↗</button></div><h3>${escapeHtml(card.name)}</h3><p class="card-num">Payment due on day ${card.due_day}</p><div class="card-stats"><div><small>CURRENT CYCLE</small><b>${money(spend)}</b></div><div><small>AVAILABLE</small><b>${money(Math.max(Number(card.credit_limit) - spend, 0))}</b></div></div><div class="utilization"><span><i style="width:${Math.min(spend / card.credit_limit * 100, 100)}%"></i></span><p>${Math.round(spend / card.credit_limit * 100)}% utilized · ${money(card.credit_limit)} limit</p></div><div class="due-box"><p><small>ACTIVE STATEMENT</small><b>${dateRange(range)}</b></p><button class="text-link open-detail">View card →</button></div>`;
  document.querySelectorAll('.open-detail').forEach(button => button.onclick = showCardView);
}
function renderCardView() {
  const card = cards[activeCard]; if (!card) return;
  const range = cycleFor(card), prior = { start: range.priorStart, end: range.priorEnd }, currentItems = cardTransactions(card, range), previousItems = transactions.filter(t => t.card_id === card.id && inRange(t, prior.start, prior.end)), spend = total(currentItems);
  $('#detail-title').textContent = card.name; $('#card-cycle-spend').textContent = money(spend); $('#card-cycle-label').textContent = `${dateRange(range)} · closes on day ${card.statement_day}`; $('#card-meter').style.width = `${Math.min(spend / card.credit_limit * 100, 100)}%`; $('#card-limit-label').textContent = `${money(Math.max(card.credit_limit - spend, 0))} available`; $('#card-previous-spend').textContent = money(total(previousItems)); $('#card-previous-label').textContent = `${dateRange(prior)} · payment due day ${card.due_day}`; $('#card-donut-total').textContent = money(spend); renderDonut('#card-donut', currentItems); renderLegend('#detail-legend', currentItems); renderTransactions('#card-transaction-list', currentItems);
}
function renderDonut(target, items) { const groups = group(items); const values = Object.values(groups); const sum = total(values); if (!sum) { $(target).style.background = '#e8ebe6'; return; } let position = 0; const slices = values.map((item, i) => { const end = position + item.amount / sum * 100; const color = categoryColors[i % categoryColors.length]; const slice = `${color} ${position}% ${end}%`; position = end; return slice; }); $(target).style.background = `conic-gradient(${slices.join(',')})`; }
function group(items) { return items.reduce((groups, item) => { groups[item.category] ||= { category: item.category, amount: 0 }; groups[item.category].amount += Number(item.amount); return groups; }, {}); }
function renderLegend(target, items) { const values = Object.values(group(items)).sort((a,b) => b.amount - a.amount), sum = total(values); if (!values.length) return empty(target, 'No spending in this statement cycle.'); $(target).innerHTML = values.map((item, i) => `<li><span style="background:${categoryColors[i % categoryColors.length]}"></span><b>${escapeHtml(item.category)}</b><em>${money(item.amount)}</em><small>${Math.round(item.amount / sum * 100)}%</small></li>`).join(''); }
function renderTransactions(target, items) { if (!items.length) return empty(target, 'No transactions yet.'); $(target).innerHTML = items.map(t => `<div class="transaction"><div class="transaction-icon">${categoryIcon(t.category)}</div><div><b>${escapeHtml(t.merchant)}</b><small>${escapeHtml(t.category)} · ${day(t.occurred_on).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</small></div><span class="transaction-actions"><strong>−${money(t.amount)}</strong><button data-delete="${t.id}" class="delete-transaction" aria-label="Remove transaction">×</button></span></div>`).join(''); document.querySelectorAll('.delete-transaction').forEach(button => button.onclick = async () => { if (!confirm('Remove this transaction?')) return; try { await api('transaction',{_method:'delete',id:button.dataset.delete}); await loadData(); } catch (error) { showError(error.message); } }); }
function networkLogo(network) { const icons={Visa:'visa',Mastercard:'mastercard','American Express':'americanexpress',Discover:'discover','Diners Club':'dinersclub',JCB:'jcb',UnionPay:'unionpay'}; return icons[network] ? `<img class="network-logo" src="https://cdn.simpleicons.org/${icons[network]}/ffffff" alt="${network}">` : network; }
function categoryIcon(category) { return ({ Groceries:'◎', Dining:'♨', Travel:'✈', Shopping:'□', Utilities:'⌁', Health:'+' })[category] || '•'; }
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
async function reorderCard(from, to) { const next = [...cards], [moved] = next.splice(from, 1); next.splice(to, 0, moved); try { await api('reorder', { ids: next.map(card => card.id) }); cards = next; activeCard = to; render(); } catch (error) { showError(error.message); } }
function showCardView() { if (!cards.length) return; $('#overview-view').classList.add('hidden'); $('#card-view').classList.remove('hidden'); $('#page-label').textContent = cards[activeCard].name; renderCardView(); }
function showOverview() { $('#card-view').classList.add('hidden'); $('#overview-view').classList.remove('hidden'); $('#page-label').textContent = 'Overview'; }
function showError(message) { console.error(message); alert(`Credit Hub couldn’t save your change: ${message}`); }

async function initialize() { try { const data = await api('me'); if (!data.user) return location.replace('/login.html'); user = data.user; $('#profile-email').textContent = user.email; $('#avatar').textContent = user.email.slice(0, 2).toUpperCase(); await loadData(); } catch (error) { location.replace('/login.html'); } }
$('#signout').onclick = async () => { await api('logout', {}); location.replace('/login.html'); };
const cardModal = $('#card-modal'), transactionModal = $('#transaction-modal'), cardForm = $('#card-form'), transactionForm = $('#transaction-form');
$('#open-card-modal').onclick = () => cardModal?.showModal(); $('#open-transaction-modal').onclick = () => { if (cards.length && transactionForm && transactionModal) { transactionForm.elements.occurred_on.value = iso(new Date()); transactionModal.showModal(); } else if (!cards.length) alert('Add a card before adding a transaction.'); };
if (cardForm) cardForm.onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(cardForm)); try { await api('card', data); cardModal.close(); cardForm.reset(); await loadData(); } catch (error) { showError(error.message); } };
if (transactionForm) transactionForm.onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(transactionForm)); try { await api('transaction', { ...data, card_id:cards[activeCard].id }); transactionModal.close(); transactionForm.reset(); await loadData(); } catch (error) { showError(error.message); } };
$('#previous-card').onclick = () => { if (cards.length) { activeCard = (activeCard + cards.length - 1) % cards.length; renderWallet(); } }; $('#next-card').onclick = () => { if (cards.length) { activeCard = (activeCard + 1) % cards.length; renderWallet(); } };
document.querySelectorAll('.nav-item[data-view]').forEach(button => button.onclick = () => { document.querySelectorAll('.nav-item[data-view]').forEach(item => item.classList.remove('active')); button.classList.add('active'); button.dataset.view === 'cards' ? showCardView() : showOverview(); });
document.querySelectorAll('.modal-close').forEach(button => button.onclick = event => { event.preventDefault(); button.closest('dialog')?.close(); });
['#month-select', '#card-cycle-select'].forEach(id => $(id).onchange = event => { selectedCycle = day(event.target.value); render(); }); initialize();
