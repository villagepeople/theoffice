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

  test('Pan mode leaves camera gestures to touch controls without changing furniture', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout);
    builder.tool = 'pan';
    let consumed = 0;
    const event = { ...pointer(82, 460), preventDefault() { consumed++; }, stopImmediatePropagation() { consumed++; } };
    builder.down(event); builder.move(event); builder.up(event);
    assert.equal(consumed, 0);
    assert.deepEqual(model.state.layout, initial);
    assert.equal(builder.undo.length, 0);
    assert.equal(builder.view.cameraLocked, false);
  });

  test('a second touch cancels the pending edit until both fingers are released', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout), start = { ...desk(model) };
    const first = { ...pointer(start.x, start.y), pointerType: 'touch', isPrimary: true };
    const second = { ...pointer(start.x + 50, start.y), pointerId: 2, pointerType: 'touch', isPrimary: false };
    builder.down(first); builder.move({ ...first, clientX: first.clientX + 20 });
    assert.ok(builder.view.ghost);
    builder.down(second);
    assert.equal(builder.drag, null); assert.equal(builder.view.ghost, null); assert.equal(builder.view.cameraLocked, false);
    builder.move({ ...first, clientX: first.clientX + 40 });
    builder.up(first); builder.up(second);
    assert.deepEqual(model.state.layout, initial); assert.equal(builder.undo.length, 0); assert.equal(builder.multiTouch, false);
    builder.down(first); builder.move({ ...first, clientX: first.clientX + 20 }); builder.up(first);
    assert.equal(desk(model).x, start.x + 20, 'editing should recover after the canceled gesture');
  });

  test('pointer cancellation releases the edit camera and cannot commit a half-finished move', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout), start = { ...desk(model) };
    const event = pointer(start.x, start.y);
    builder.down(event); builder.move({ ...event, clientX: event.clientX + 20 });
    builder.cancelPointer(event); builder.up(event);
    assert.deepEqual(model.state.layout, initial); assert.equal(builder.undo.length, 0);
    assert.equal(builder.drag, null); assert.equal(builder.view.ghost, null); assert.equal(builder.view.cameraLocked, false);
    assert.equal(builder.editPointers.size, 0);
  });

  test('nudge arrows move an assigned desk one grid step with validation and undo', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout), start = { ...desk(model) };
    builder.select('desk:desk-npc-0');
    assert.equal(builder.nudge(1, 0), true);
    assert.equal(desk(model).x, start.x + 20); assert.equal(desk(model).y, start.y);
    assert.equal(desk(model).ownerId, start.ownerId); assert.equal(builder.undo.length, 1);
    assert.equal(validateLayout(model.state.layout).valid, true);
    model.setLayout(builder.undo.pop()); builder.refresh();
    assert.deepEqual(model.state.layout, initial);
    assert.equal(builder.nudge(10, 0), false); assert.equal(builder.undo.length, 0);
  });

  test('nudging a department moves its employee desks with it and rejects blocked placements', () => {
    const { model, builder } = setup(), initial = structuredClone(model.state.layout);
    builder.select('small'); assert.equal(builder.nudge(1, 0), true);
    const moved = model.state.layout;
    assert.equal(moved.stations.find(s => s.id === 'small').x, initial.stations.find(s => s.id === 'small').x + 20);
    for (const d of moved.desks.filter(d => d.role === 'small')) {
      assert.equal(d.x, initial.desks.find(p => p.id === d.id).x + 20); assert.equal(d.ownerId, initial.desks.find(p => p.id === d.id).ownerId);
    }
    builder.select('desk:desk-npc-0');
    for (let i = 0; i < 10; i++) {
      const before = structuredClone(model.state.layout), undoLength = builder.undo.length;
      if (!builder.nudge(-1, 0)) { assert.deepEqual(model.state.layout, before); assert.equal(builder.undo.length, undoLength); return; }
    }
    assert.fail('repeated nudges must eventually reject the floor boundary');
  });
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
console.log(passed + ' builder checks passed; ' + failed + ' failed.');
if (failed) process.exitCode = 1;
