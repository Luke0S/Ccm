const cards = [
  { name: 'Sapphire Reserve', network: 'VISA', type: 'visa', limit: 7000, due: 3, color: 'navy', number: '•••• 4812', spend: 1420.12 },
  { name: 'Gold Card', network: 'AMERICAN EXPRESS', type: 'amex', limit: 4500, due: 18, color: 'gold', number: '•••• 1007', spend: 910.45 },
  { name: 'Everyday Cash', network: 'MASTERCARD', type: 'mastercard', limit: 3500, due: 12, color: 'coral', number: '•••• 0834', spend: 515.82 }
];
let activeCard = 0;
const transactions = [
  { merchant: 'The Grocer', category: 'Groceries', amount: 124.46, date: 'Today', icon: '◎' },
  { merchant: 'Airbnb', category: 'Travel', amount: 382.00, date: 'Yesterday', icon: '⌂' },
  { merchant: 'Clover Coffee', category: 'Dining', amount: 6.80, date: 'Sep 24', icon: '♨' },
  { merchant: 'Figma', category: 'Software', amount: 15.00, date: 'Sep 23', icon: '✦' }
];
const categories = [{name:'Travel', amount: 982, color:'#e86c5a'}, {name:'Dining', amount: 664, color:'#f2b861'}, {name:'Groceries', amount: 502, color:'#4f8b81'}, {name:'Shopping', amount: 398, color:'#6b77b8'}, {name:'Other', amount: 300, color:'#c8c2b8'}];
const $ = (q) => document.querySelector(q);
const format = (n) => n.toLocaleString('en-US', {style:'currency', currency:'USD'});

function renderWallet() {
  const wallet = $('#wallet');
  wallet.innerHTML = cards.map((card, index) => `<button class="credit-card ${card.color} ${index === activeCard ? 'selected' : ''}" style="--index:${index}" data-index="${index}"><span class="network">${card.network}</span><span class="chip">▦</span><span class="card-number">${card.number}</span><span class="card-footer"><span>${card.name}</span><span>VALID THRU<br><b>09/29</b></span></span></button>`).join('');
  wallet.querySelectorAll('.credit-card').forEach(el => {
    el.draggable = true;
    el.addEventListener('click', () => { activeCard = +el.dataset.index; renderWallet(); });
    el.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', el.dataset.index); el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', event => event.preventDefault());
    el.addEventListener('drop', event => {
      event.preventDefault();
      const from = +event.dataTransfer.getData('text/plain');
      const to = +el.dataset.index;
      if (from !== to) { const [moved] = cards.splice(from, 1); cards.splice(to, 0, moved); activeCard = to; renderWallet(); }
    });
  });
  const c = cards[activeCard];
  $('#card-count').innerHTML = `0${activeCard + 1} <i>/</i> 0${cards.length}`;
  $('#card-detail').innerHTML = `<div class="detail-top"><span class="mini-network ${c.type}">${c.network === 'AMERICAN EXPRESS' ? 'AMEX' : c.network}</span><button class="open-detail" title="Open card detail">↗</button></div><h3>${c.name}</h3><p class="card-num">${c.number}</p><div class="card-stats"><div><small>CURRENT CYCLE</small><b>${format(c.spend)}</b></div><div><small>AVAILABLE</small><b>${format(c.limit - c.spend)}</b></div></div><div class="utilization"><span><i style="width:${c.spend / c.limit * 100}%"></i></span><p>${Math.round(c.spend/c.limit*100)}% utilized <em>·</em> $${c.limit.toLocaleString()} limit</p></div><div class="due-box"><div><span class="calendar">▦</span><p><small>NEXT PAYMENT</small><b>Oct ${c.due} · $${(c.spend*.55).toFixed(0)} due</b></p></div><button class="text-link">View payment plan →</button></div>`;
  $('.open-detail').addEventListener('click', showCardView);
}
function renderTransactions(target, items = transactions) { $(target).innerHTML = items.map(t => `<div class="transaction"><div class="transaction-icon">${t.icon}</div><div><b>${t.merchant}</b><small>${t.category} · ${t.date}</small></div><strong>−${format(t.amount)}</strong></div>`).join(''); }
function renderLegend(target) { $(target).innerHTML = categories.map(c => `<li><span style="background:${c.color}"></span><b>${c.name}</b><em>${format(c.amount)}</em><small>${Math.round(c.amount/2846*100)}%</small></li>`).join(''); }
function showCardView() { $('#overview-view').classList.add('hidden'); $('#card-view').classList.remove('hidden'); $('#page-label').textContent = cards[activeCard].name; $('#detail-title').textContent = cards[activeCard].name; renderTransactions('#card-transaction-list', transactions.slice(0,3)); renderLegend('.detail-legend'); }
function showOverview() { $('#card-view').classList.add('hidden'); $('#overview-view').classList.remove('hidden'); $('#page-label').textContent = 'Overview'; }

renderWallet(); renderTransactions('#transaction-list'); renderLegend('#category-legend');
$('#previous-card').onclick = () => { activeCard = (activeCard + cards.length - 1) % cards.length; renderWallet(); };
$('#next-card').onclick = () => { activeCard = (activeCard + 1) % cards.length; renderWallet(); };
$('#open-card-modal').onclick = () => $('#card-modal').showModal();
$('#open-transaction-modal').onclick = () => $('#transaction-modal').showModal();
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); b.classList.add('active'); b.dataset.view === 'cards' ? showCardView() : showOverview(); });
$('#card-modal').addEventListener('close', () => { if ($('#card-modal').returnValue === 'default') { const name = $('#new-card-name').value; if (!name) return; cards.push({name, network: $('#new-card-type').value.toUpperCase(), type: 'visa', limit: +$('#new-card-limit').value, due: +$('#new-card-due').value, color: 'navy', number: '•••• ' + Math.floor(1000 + Math.random()*8999), spend: 0}); activeCard = cards.length - 1; renderWallet(); }});
$('#transaction-modal').addEventListener('close', () => { if ($('#transaction-modal').returnValue === 'default') { const merchant = $('#transaction-merchant').value; const amount = +$('#transaction-amount').value; if (!merchant || !amount) return; transactions.unshift({merchant, amount, category:$('#transaction-category').value, date:'Today', icon:'•'}); cards[activeCard].spend += amount; renderWallet(); renderTransactions('#transaction-list'); renderTransactions('#card-transaction-list', transactions.slice(0,3)); }});
