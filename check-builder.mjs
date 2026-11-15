import assert from 'node:assert/strict';
import { GameModel } from './dist/model.js';
import { FloorBuilder } from './dist/builder.js';
import { deskStandingPoint, validateLayout } from './dist/layout.js';

// Exercise real builder actions and floor validation. Only the DOM and drawing
// surface are replaced; geometry, ownership, movement, and undo remain real.
class Element {
  children = [];
  value = '';
  textContent = '';
  disabled = false;
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
}
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => new Element() };

function setup() {
  const model = new GameModel(20261114);
  model.start({ name: 'Builder QA', role: 'small', difficulty: 'casual' });
  model.setPaused(true);
  const nodes = new Map(['#builder-selected', '#builder-rotate', '#builder-remove'].map(id => [id, new Element()]));
  const messages = [];
  const builder = Object.create(FloorBuilder.prototype);
  Object.assign(builder, {
    model,
    view: {
      canvas: { setPointerCapture() {} },
      screenToWorld: (x, y) => ({ x, y }),
      hitTest: () => 'desk:desk-npc-0',
      cameraLocked: false,
      ghost: null
    },
    panel: { querySelector: selector => nodes.get(selector) },
    selection: new Element(),
    feedback: new Element(),
    active: true,
    tool: 'move',
    undo: [],
    toast: message => messages.push(message)
  });
  return { model, builder, messages };
}
const pointer = (x, y) => ({
  clientX: x, clientY: y, pointerId: 1, button: 0,
  preventDefault() {}, stopImmediatePropagation() {}
});
const desk = model => model.state.layout.desks.find(item => item.id === 'desk-npc-0');
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}

try {
  test('selecting an off-grid employee desk preserves geometry and undo history', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout), position = { x: desk(model).x, y: desk(model).y };
    assert.notEqual(position.x % 20, 0, 'fixture must exercise an off-grid desk');
    builder.down(pointer(position.x, position.y));
    assert.equal(builder.selected, 'desk:desk-npc-0');
    assert.equal(builder.view.cameraLocked, true);
    builder.up(pointer(position.x, position.y));
    assert.deepEqual(model.state.layout, initial);
    assert.equal(builder.undo.length, 0);
    assert.equal(builder.view.cameraLocked, false);
    assert.equal(builder.view.ghost, null);
  });

  test('dragging a desk twenty units preserves its reachable employee standing spot', () => {
    const { model, builder } = setup(), initial = { ...desk(model) };
    builder.down(pointer(initial.x, initial.y));
    builder.move(pointer(initial.x + 20, initial.y));
    builder.up(pointer(initial.x + 20, initial.y));
    const moved = desk(model), home = deskStandingPoint(moved), employee = model.state.npcs.find(npc => npc.id === moved.ownerId);
    assert.equal(moved.x, initial.x + 20);
    assert.equal(moved.y, initial.y);
    assert.equal(moved.ownerId, initial.ownerId);
    assert.equal(builder.undo.length, 1);
    assert.equal(builder.view.cameraLocked, false);
    assert.equal(validateLayout(model.state.layout).valid, true);
    assert.equal(model.isFree(home.x, home.y), true);
    assert.deepEqual(employee.home, home);
    const route = model.pathTo(model.state.player, home.x, home.y);
    assert.ok(route.length > 0, 'the moved desk must remain reachable');
    assert.ok(Math.hypot(route.at(-1).x - home.x, route.at(-1).y - home.y) < 1);
  });

  test('assigned desks remain owned and present when removal is requested', () => {
    const { model, builder, messages } = setup(), initial = structuredClone(model.state.layout);
    builder.select('desk:desk-npc-0');
    builder.editProp('remove');
    assert.deepEqual(model.state.layout, initial);
    assert.equal(model.state.layout.desks.length, 24);
    assert.equal(desk(model).ownerId, 'npc-0');
    assert.equal(builder.undo.length, 0);
    assert.ok(messages.some(message => message.includes('assigned desk')));
  });

  test('rejected out-of-bounds and overlapping drags release the camera without changing the floor', () => {
    for (const target of [{ x: -100, y: 460 }, { x: 238, y: 460 }]) {
      const { model, builder, messages } = setup(), initial = structuredClone(model.state.layout), start = { ...desk(model) };
      builder.down(pointer(start.x, start.y));
      builder.move(pointer(target.x, target.y));
      builder.up(pointer(target.x, target.y));
      assert.deepEqual(model.state.layout, initial);
      assert.equal(builder.undo.length, 0);
      assert.equal(builder.view.cameraLocked, false);
      assert.equal(builder.view.ghost, null);
      assert.equal(builder.drag, null);
      assert.ok(messages.length > 0, 'rejected moves should explain why they were declined');
    }
  });
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
console.log(passed + ' builder checks passed; ' + failed + ' failed.');
if (failed) process.exitCode = 1;
