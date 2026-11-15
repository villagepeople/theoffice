import assert from 'node:assert/strict';
import { MobileOffice } from './dist/mobile.js';

// Test controller ownership and focus rules with a tiny DOM surface. Real
// viewport layout, native dialog events, and touch behavior stay browser checks.
class Classes {
  values = new Set();
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, on = !this.contains(name)) { on ? this.add(name) : this.remove(name); return on; }
}
class Node {
  children = [];
  classList = new Classes();
  attributes = new Map();
  parentNode = null;
  open = false;
  focusCount = 0;
  get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  append(node) { node.remove(); this.children.push(node); node.parentNode = this; }
  insertBefore(node, before) { node.remove(); const index = before ? this.children.indexOf(before) : -1; this.children.splice(index < 0 ? this.children.length : index, 0, node); node.parentNode = this; }
  replaceChildren() { for (const node of [...this.children]) node.remove(); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  focus() { this.focusCount++; document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const previousDocument = globalThis.document, previousWindow = globalThis.window;
function setup({ phase = 'playing', online = false } = {}) {
  const board = new Node(), chatButton = new Node(), closeButton = new Node(), title = new Node(), styles = new Map(), body = new Node();
  globalThis.document = {
    body, activeElement: null,
    documentElement: { style: { setProperty: (name, value) => styles.set(name, value) } },
    getElementById: id => { assert.equal(id, 'mobile-chat'); return chatButton; },
    querySelector: selector => { assert.equal(selector, '.office-board'); return board; }
  };
  globalThis.window = { innerHeight: 844, visualViewport: { height: 844 } };
  const node = new Node(); node.classList.add('hidden'); node.querySelector = selector => { assert.equal(selector, '#chat-close'); return closeButton; };
  const calls = [], model = { state: { phase }, setPaused(value) { calls.push(value); this.state.phase = value ? 'paused' : 'playing'; } };
  const mobile = Object.create(MobileOffice.prototype);
  Object.assign(mobile, { compact: true, model, network: { active: online }, chat: { node }, content: new Node(), sheet: new Node(), backdrop: new Node(), onBlocking() {} });
  mobile.sheet.querySelector = selector => { assert.equal(selector, '#mobile-sheet-title'); return title; };
  mobile.chat.close = () => { node.classList.add('hidden'); mobile.syncChat(); };
  return { mobile, board, node, closeButton, chatButton, calls, styles, body };
}
let passed = 0;
try {
  {
    const f = setup(); f.node.classList.remove('hidden'); f.mobile.syncChat();
    assert.equal(f.board.inert, true); assert.equal(f.node.attributes.get('aria-modal'), 'true'); assert.equal(f.closeButton.focusCount, 1);
    const input = { tagName: 'INPUT' }; document.activeElement = input;
    for (let i = 0; i < 4; i++) f.mobile.syncChat();
    assert.equal(document.activeElement, input, 'viewport updates must leave a typing user focused in the chat input');
    assert.equal(f.closeButton.focusCount, 1, 'only the opening transition may focus the close button');
    f.mobile.chat.close();
    assert.equal(f.board.inert, false); assert.equal(f.node.attributes.has('aria-modal'), false); assert.equal(f.mobile.backdrop.classList.contains('hidden'), true);
    f.node.classList.remove('hidden'); f.mobile.syncChat(); assert.equal(f.closeButton.focusCount, 2);
    passed++;
  }
  {
    const f = setup(), home = new Node(), before = new Node(), panel = new Node(), after = new Node();
    const originalHandler = () => 'task chosen'; panel.onclick = originalHandler; home.append(before); home.append(panel); home.append(after);
    assert.equal(f.mobile.openSheet('Your shift', 'tasks'), true); f.mobile.movePanel(panel);
    assert.equal(f.mobile.model.state.phase, 'paused'); assert.equal(panel.parentNode, f.mobile.content); assert.equal(f.mobile.content.children[0], panel);
    f.mobile.closeSheet();
    assert.deepEqual(home.children, [before, panel, after]); assert.equal(panel.onclick, originalHandler, 'return the actual panel, including its bound controls');
    assert.equal(f.mobile.model.state.phase, 'playing'); assert.deepEqual(f.calls, [true, false]); assert.equal(f.mobile.moved, null);
    f.mobile.closeSheet(); assert.deepEqual(f.calls, [true, false], 'duplicate close events cannot resume the shift twice');
    passed++;
  }
  {
    for (const config of [{ phase: 'paused' }, { phase: 'playing', online: true }]) {
      const f = setup(config); f.mobile.openSheet('Your shift', 'tasks'); f.mobile.closeSheet();
      assert.deepEqual(f.calls, []); assert.equal(f.mobile.model.state.phase, config.phase, 'a panel must not resume an existing pause or pause a shared office');
    }
    const f = setup(); f.mobile.openSheet('Your shift', 'tasks'); f.mobile.model.state.phase = 'ended'; f.mobile.closeSheet();
    assert.equal(f.mobile.model.state.phase, 'ended'); assert.deepEqual(f.calls, [true], 'clock-out while the panel is open must not be undone');
    passed++;
  }
  {
    const f = setup(), home = new Node(), panel = new Node(), removedSibling = new Node(); home.append(panel); home.append(removedSibling);
    f.mobile.openSheet('Floor tools', 'builder'); f.mobile.movePanel(panel); removedSibling.remove(); f.mobile.closeSheet();
    assert.deepEqual(home.children, [panel], 'a removed sibling must not prevent returning controls to their original parent');
    document.activeElement = { tagName: 'INPUT' }; window.visualViewport.height = 310; f.mobile.setViewport();
    assert.equal(f.styles.get('--office-vh'), '310px'); assert.equal(f.body.classList.contains('mobile-keyboard-open'), true);
    window.visualViewport.height = 844; f.mobile.setViewport(); assert.equal(f.body.classList.contains('mobile-keyboard-open'), false);
    passed++;
  }
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
}
console.log(`${passed} mobile controller checks passed (chat focus, panel ownership, pause lifecycle, and keyboard sizing).`);
