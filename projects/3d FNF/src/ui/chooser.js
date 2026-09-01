/* src/ui/chooser.js
   Simple chooser modal extracted from src/ui.js for reuse.
*/
export default function createChooser(title, items, onChoose, allowCancel = true) {
  // ensure single instance
  let existing = document.getElementById('ui-chooser-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'ui-chooser-modal';
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '1000';
  modal.style.background = 'rgba(0,0,0,0.6)';

  const panel = document.createElement('div');
  panel.style.minWidth = '320px';
  panel.style.maxWidth = '90%';
  panel.style.maxHeight = '80%';
  panel.style.overflow = 'auto';
  panel.style.background = '#0f1724';
  panel.style.border = '1px solid #222';
  panel.style.borderRadius = '8px';
  panel.style.padding = '14px';
  panel.style.color = '#fff';
  panel.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';

  const h = document.createElement('h3');
  h.innerText = title;
  h.style.margin = '0 0 8px 0';
  h.style.fontSize = '16px';
  panel.appendChild(h);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';

  items.forEach((it, idx) => {
    const btn = document.createElement('button');
    btn.innerText = typeof it === 'string' ? it : (it.label || String(it));
    btn.style.padding = '8px 10px';
    btn.style.textAlign = 'left';
    btn.style.border = '1px solid #263044';
    btn.style.background = '#081424';
    btn.style.color = '#dbeafe';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      document.body.removeChild(modal);
      onChoose(idx);
    });
    list.appendChild(btn);
  });

  panel.appendChild(list);

  if (allowCancel) {
    const cancel = document.createElement('div');
    cancel.style.display = 'flex';
    cancel.style.justifyContent = 'flex-end';
    cancel.style.marginTop = '10px';
    const cbtn = document.createElement('button');
    cbtn.innerText = 'Cancel';
    cbtn.style.padding = '6px 10px';
    cbtn.style.border = '1px solid #333';
    cbtn.style.background = '#111827';
    cbtn.style.color = '#fff';
    cbtn.style.borderRadius = '6px';
    cbtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      onChoose(-1);
    });
    cancel.appendChild(cbtn);
    panel.appendChild(cancel);
  }

  modal.appendChild(panel);
  document.body.appendChild(modal);
}