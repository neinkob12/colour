import './styles/base.css';
import './styles/landing.css';

// The six toys. `href` present + ready:true means the card is live.
// Flip ready to true and add the href when a toy ships in its phase.
const TOYS = [
  { n: '01', name: 'swarm', tag: 'it follows you', accent: 'var(--glow)', href: '/toys/swarm/', ready: true },
  { n: '02', name: 'fluid', tag: 'stir the ink', accent: 'var(--glow2)', href: '/toys/fluid/', ready: true },
  { n: '03', name: 'warp', tag: 'bend the field', accent: 'var(--glow3)', ready: false },
  { n: '04', name: 'bloom', tag: 'tap to grow', accent: 'var(--glow)', ready: false },
  { n: '05', name: 'kaleido', tag: 'mirror world', accent: 'var(--glow2)', ready: false },
  { n: '06', name: 'bounce', tag: 'launch & collide', accent: 'var(--glow3)', ready: false },
];

const grid = document.getElementById('grid');

for (const toy of TOYS) {
  const el = document.createElement(toy.ready ? 'a' : 'div');
  el.className = `card ${toy.ready ? 'live' : 'soon'}`;
  el.style.setProperty('--accent', toy.accent);
  if (toy.ready) el.href = toy.href;

  el.innerHTML = `
    <span class="num">${toy.n}</span>
    ${toy.ready ? '' : '<span class="badge">coming soon</span>'}
    <span>
      <span class="name">${toy.name}</span>
      <span class="tag">${toy.tag}</span>
    </span>
  `;

  grid.appendChild(el);
}
