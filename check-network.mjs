import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { RoomService, MemoryRoomStore, D1RoomStore, handleRoomRequest } from './worker/room-service.js';
import { GameModel, STATIONS } from './dist/model.js';
import { DEFAULT_LAYOUT } from './dist/layout.js';
import { createPreviewServer } from './server.mjs';

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
const config = (name, role = 'small') => ({ name, role, outfit: 'wizard', difficulty: 'casual' });
const point = id => { const s = STATIONS.find(s => s.id === id); return { x: s.interactX ?? s.x, y: s.interactY ?? s.y + 65 }; };
function sqliteStore() {
  const db = new DatabaseSync(':memory:');
  return fs.readFile('drizzle/0000_multiplayer.sql', 'utf8').then(sql => {
    db.exec(sql);
    return { store: new D1RoomStore({ prepare(sql) { return { bind(...args) { return { async first() { return db.prepare(sql).get(...args) || null; }, async run() { const result = db.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; } }; } }; } }), close: () => db.close() };
  });
}
async function exercise(label, store) {
  let time = 1794690000000;
  const service = new RoomService(store, { now: () => time });
  const a = await service.create({ config: config('Avery') });
  a.seq = 0;
  const b = await service.join(a.code, { config: config('Blair', 'developers') }); b.seq = 0;
  const sync = async (client, commands = [], advance = 0) => {
    time += advance;
    const items = commands.map(command => ({ seq: ++client.seq, ...command }));
    const result = await service.sync(a.code, client.playerId, client.token, { commands: items });
    client.seq = result.ack; return result;
  };
  assert.notEqual(a.playerId, b.playerId); assert.notEqual(a.token, b.token);
  let response = await sync(a);
  assert.equal(response.snapshot.room.players.length, 2);
  assert.ok(!JSON.stringify(response).includes(b.token)); assert.ok(!JSON.stringify(response).includes('tokenHash'));
  assert.ok(response.snapshot.state.tasks.every(t => !('answers' in t)));

  const destination = point('small');
  await sync(a, [{ type: 'moveTo', ...destination }]);
  response = await sync(b, [], 8000);
  const remote = response.snapshot.state.otherPlayers.find(p => p.id === a.playerId);
  assert.ok(Math.hypot(remote.x - destination.x, remote.y - destination.y) < 22, label + ' shared movement');
  await sync(b, [{ type: 'moveTo', ...destination }]); await sync(b, [], 8000);
  response = await sync(a, [{ type: 'interact', stationId: 'small' }]);
  assert.equal(response.results[0].kind, 'task');
  const taskId = response.results[0].task.id;
  assert.ok(!('answers' in response.results[0].task));
  const blocked = await sync(b, [{ type: 'interact', stationId: 'small' }]); assert.equal(blocked.results[0].kind, 'blocked');
  const internal = await store.get(a.code), task = internal.model.state.tasks.find(t => t.id === taskId);
  const batch = task.answers.map((choiceIndex, step) => ({ seq: ++a.seq, type: 'answer', taskId, choiceIndex, step }));
  response = await service.sync(a.code, a.playerId, a.token, { commands: batch });
  assert.equal(response.snapshot.state.stats.completed, 1);
  const duplicate = await service.sync(a.code, a.playerId, a.token, { commands: batch });
  assert.equal(duplicate.snapshot.state.stats.completed, 1);
  assert.equal((await sync(b)).snapshot.state.stats.completed, 1);

  await sync(a, [{ type: 'chat', text: '<hello>\nfrom Avery ' + 'x'.repeat(200) }]);
  response = await sync(b);
  const chat = response.snapshot.room.chat.at(-1);
  assert.equal(chat.name, 'Avery'); assert.equal(chat.playerId, a.playerId); assert.ok(chat.text.length <= 160); assert.ok(!chat.text.includes('<'));
  await assert.rejects(service.sync(a.code, a.playerId, 'incorrect-token', { commands: [] }), e => e.status === 401);
  const unauthorizedDay = await sync(b, [{ type: 'nextDay' }]); assert.equal(unauthorizedDay.results[0].kind, 'blocked');

  const joins = await Promise.all([service.join(a.code, { config: config('Casey') }), service.join(a.code, { config: config('Devon') })]);
  const fullOffice = (await sync(a)).snapshot;
  assert.equal(fullOffice.room.players.length, 4);
  assert.deepEqual(fullOffice.room.players.map(p => p.deskSlot).sort(), [0, 1, 2, 3], 'concurrent joins must reserve separate desks');
  await assert.rejects(service.join(a.code, { config: config('Extra') }), e => e.status === 409);
  assert.equal(new Set(joins.map(j => j.playerId)).size, 2);
  response = await sync(a, [{ type: 'leave' }]); assert.equal(response.left, true);
  response = await sync(b); assert.equal(response.snapshot.room.hostId, b.playerId);
  await sync(b, [{ type: 'endShift' }]);
  response = await sync(b, [{ type: 'nextDay' }]); assert.equal(response.snapshot.state.day, 2); assert.equal(response.snapshot.state.stats.completed, 0);
  response = await sync(b, [], 46000); assert.equal(response.snapshot.room.players.length, 1);
  time += 2 * 60 * 60 * 1000 + 1;
  await assert.rejects(service.sync(a.code, b.playerId, b.token, { commands: [] }), e => e.status === 404);
}

await test('cooperative room workflow on the concurrent memory store', () => exercise('memory', new MemoryRoomStore()));
await test('same workflow and CAS queries against real SQLite', async () => { const setup = await sqliteStore(); try { await exercise('SQLite', setup.store); } finally { setup.close(); } });
await test('rapid keyboard commands cannot exceed the server movement budget', async () => {
  let now = 1794690000000; const service = new RoomService(new MemoryRoomStore(), { now: () => now });
  const a = await service.create({ config: config('Walker') }); const before = a.snapshot.state.player;
  const commands = Array.from({ length: 20 }, (_, i) => ({ seq: i + 1, type: 'moveDirection', dx: 1, dy: 0, duration: .3 }));
  const result = await service.sync(a.code, a.playerId, a.token, { commands });
  assert.ok(Math.hypot(result.snapshot.state.player.x - before.x, result.snapshot.state.player.y - before.y) <= 158 * .45 + 1);
});
await test('out-of-order commands do not execute and invalid answers cannot advance tasks', async () => {
  const service = new RoomService(new MemoryRoomStore()); const a = await service.create({ config: config('Orderly') });
  const result = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 2, type: 'chat', text: 'Too early' }] });
  assert.equal(result.ack, 0); assert.ok(!result.snapshot.room.chat.some(m => m.text === 'Too early'));
  const answer = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 1, type: 'answer', taskId: a.snapshot.state.tasks[0].id, choiceIndex: 0, step: 0 }] });
  assert.equal(answer.snapshot.state.stats.completed, 0); assert.equal(answer.results[0].kind, 'blocked');
});
await test('a user retry with a new sequence cannot answer a later question using an old step', async () => {
  let now = 1794690000000; const store = new MemoryRoomStore(), service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Careful') });
  const destination = point('small');
  await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 1, type: 'moveTo', ...destination }] });
  now += 8000; await service.sync(a.code, a.playerId, a.token, { commands: [] });
  const opened = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 2, type: 'interact', stationId: 'small' }] });
  const taskId = opened.results[0].task.id, room = await store.get(a.code), task = room.model.state.tasks.find(t => t.id === taskId);
  const correct = task.answers[0];
  await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 3, type: 'answer', taskId, choiceIndex: correct, step: 0 }] });
  const retry = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 4, type: 'answer', taskId, choiceIndex: correct, step: 0 }] });
  assert.equal(retry.results[0].kind, 'blocked');
  assert.equal(retry.snapshot.state.tasks.find(t => t.id === taskId).step, 1);
  const missingStep = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 5, type: 'answer', taskId, choiceIndex: task.answers[1] }] });
  assert.equal(missingStep.results[0].kind, 'blocked');
  assert.equal(missingStep.snapshot.state.tasks.find(t => t.id === taskId).step, 1);
  const completed = await service.sync(a.code, a.playerId, a.token, { commands: [
    { seq: 6, type: 'answer', taskId, choiceIndex: task.answers[1], step: 1 },
    { seq: 7, type: 'answer', taskId, choiceIndex: task.answers[2], step: 2 }
  ] });
  assert.equal(completed.snapshot.state.stats.completed, 1);
});
await test('a fire releases every online case, preserves evacuation routes, and permits reassignment', async () => {
  let now = 1794690000000; const store = new MemoryRoomStore(), service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('First') }), b = await service.join(a.code, { config: config('Second') });
  const firstTask = a.snapshot.state.tasks.find(t => t.role === 'small'), secondTask = a.snapshot.state.tasks.find(t => t.role !== 'small');
  await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 1, type: 'moveTo', ...point(firstTask.role) }] });
  await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 1, type: 'moveTo', ...point(secondTask.role) }] });
  now += 8000; await service.sync(a.code, a.playerId, a.token, { commands: [] });
  assert.equal((await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 2, type: 'interact', stationId: firstTask.role }] })).results[0].kind, 'task');
  assert.equal((await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 2, type: 'interact', stationId: secondTask.role }] })).results[0].kind, 'task');
  const room = await store.get(a.code); assert.equal(Object.keys(room.locks).length, 2);
  const model = new GameModel(room.model.seed); model.state = room.model.state;
  for (const [key, value] of Object.entries(room.model)) if (key !== 'state' && key !== 'version') model[key] = value;
  assert.equal(model.triggerEvent('fire'), true); room.model = model.serialize(); room.revision++;
  await store.compareAndSwap(a.code, room.revision - 1, room);
  const evacuated = await service.sync(a.code, a.playerId, a.token, { commands: [] });
  assert.equal(evacuated.snapshot.state.currentTask, null);
  const cleared = await store.get(a.code); assert.deepEqual(cleared.locks, {});
  assert.ok(Object.values(cleared.players).every(p => p.currentTask === null && p.route.length === 0));
  await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 3, type: 'moveTo', ...point('assembly') }] });
  let arrived;
  for (let poll = 0; poll < 6; poll++) {
    now += 4000;
    arrived = await service.sync(a.code, a.playerId, a.token, { commands: [] });
    await service.sync(a.code, b.playerId, b.token, { commands: [] });
    if (Math.hypot(arrived.snapshot.state.player.x - point('assembly').x, arrived.snapshot.state.player.y - point('assembly').y) < 24) break;
    assert.ok(arrived.snapshot.state.route.length > 0, 'a fire poll erased the unfinished evacuation route');
  }
  assert.ok(Math.hypot(arrived.snapshot.state.player.x - point('assembly').x, arrived.snapshot.state.player.y - point('assembly').y) < 24, 'fire polls repeatedly erased the evacuation path');
  const resolved = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 4, type: 'interact', stationId: 'assembly' }] });
  assert.equal(resolved.snapshot.state.event, null);
  await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 3, type: 'moveTo', ...point(firstTask.role) }] });
  now += 8000; await service.sync(a.code, b.playerId, b.token, { commands: [] });
  const reopened = await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 4, type: 'interact', stationId: firstTask.role }] });
  assert.equal(reopened.results[0].kind, 'task'); assert.equal(reopened.results[0].task.id, firstTask.id);
});
await test('orphaned task locks are reconciled before another player opens the case', async () => {
  const store = new MemoryRoomStore(), service = new RoomService(store);
  const a = await service.create({ config: config('Owner') }); const room = await store.get(a.code);
  const task = room.model.state.tasks[0], destination = point(task.role);
  room.locks[task.id] = 'absent-coworker'; room.players[a.playerId].currentTask = null;
  Object.assign(room.players[a.playerId].player, destination); room.revision++;
  await store.compareAndSwap(a.code, room.revision - 1, room);
  const result = await service.sync(a.code, a.playerId, a.token, { commands: [{ seq: 1, type: 'interact', stationId: task.role }] });
  assert.equal(result.results[0].kind, 'task');
  assert.equal((await store.get(a.code)).players[a.playerId].currentTask, task.id);
});
await test('custom floor plans survive room storage and reach every player', async () => {
  const service = new RoomService(new MemoryRoomStore());
  const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT)); layout.floorColor = '#efe6dd'; layout.stations[0].x += 20;
  const a = await service.create({ config: config('Architect'), layout });
  const b = await service.join(a.code, { config: config('Visitor') });
  assert.equal(b.snapshot.state.layout.floorColor, '#efe6dd');
  assert.equal(b.snapshot.state.layout.stations[0].x, layout.stations[0].x);
  const bad = JSON.parse(JSON.stringify(layout)); bad.stations[0].x = -500;
  await assert.rejects(service.create({ config: config('Invalid'), layout: bad }), e => e.status === 400);
});
await test('a summoned online guest can respond and NPC conversations use that guest', async () => {
  let now = 1794690000000; const store = new MemoryRoomStore(), service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Host') }), b = await service.join(a.code, { config: config('Guest') });
  const record = await store.get(a.code), model = new GameModel(record.model.seed);
  model.state = record.model.state;
  model.state.onlinePlayers = Object.values(record.players).map(p => ({ ...p.player, id: p.id }));
  const call = model.triggerSummon(b.playerId, 'ceo'); assert.equal(call.targetId, b.playerId);
  record.model = model.serialize(); record.revision++;
  await store.compareAndSwap(a.code, record.revision - 1, record);
  const executive = model.stations.find(s => s.id === 'exec:ceo');
  await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 1, type: 'moveTo', x: executive.interactX ?? executive.x, y: executive.interactY ?? executive.y + 100 }] });
  now += 10000;
  await service.sync(a.code, b.playerId, b.token, { commands: [] });
  const response = await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 2, type: 'interact', stationId: 'exec:ceo' }] });
  assert.equal(response.results[0].kind, 'event'); assert.equal(response.snapshot.state.summon, null);
  const room = await store.get(a.code), npc = room.model.state.npcs.find(n => n.role !== 'visitor');
  Object.assign(room.players[b.playerId].player, { x: npc.x + 20, y: npc.y }); room.revision++;
  await store.compareAndSwap(a.code, room.revision - 1, room);
  const talk = await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 3, type: 'talk', npcId: npc.id, choice: 'greet' }] });
  assert.equal(talk.results[0].kind, 'chat'); assert.equal(talk.results[0].npcId, npc.id); assert.ok(talk.results[0].message);
});
async function exercisePersonalDesks(store) {
  let now = 1794690000000;
  let service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Desk host') });
  const b = await service.join(a.code, { config: config('Desk guest', 'call') });
  const c = await service.join(a.code, { config: config('Third desk') });
  const d = await service.join(a.code, { config: config('Fourth desk') });
  const seq = new Map();
  const sync = async (client, commands = []) => service.sync(a.code, client.playerId, client.token, { commands: commands.map(command => ({ seq: seq.set(client.playerId, (seq.get(client.playerId) || 0) + 1).get(client.playerId), ...command })) });
  for (const [slot, client] of [a, b, c, d].entries()) {
    const snapshot = (await sync(client)).snapshot, player = snapshot.state.player;
    assert.equal(player.deskSlot, slot); assert.equal(player.deskId, 'desk-player-' + slot);
    assert.equal(snapshot.state.layout.desks.length, 24);
    for (const list of [snapshot.state.onlinePlayers, snapshot.state.otherPlayers, snapshot.room.players]) {
      assert.ok(list.every(p => Number.isInteger(p.deskSlot) && p.deskId === 'desk-player-' + p.deskSlot));
      assert.equal(new Set(list.map(p => p.deskSlot)).size, list.length);
    }
    const model = new GameModel(); model.state = snapshot.state;
    const desk = model.desks.find(item => item.id === player.deskId), standing = model.point('desk:' + player.deskId);
    assert.equal(desk.ownerId, player.id); assert.equal(desk.ownerName, player.name);
    assert.ok(model.isFree(player.x, player.y), 'new coworker spawned inside furniture');
    assert.ok(Math.hypot(player.x - standing.x, player.y - standing.y) < 2, 'new coworker must arrive beside their own desk');
    const visited = await sync(client, [{ type: 'interact', stationId: 'desk:' + player.deskId }]);
    assert.notEqual(visited.results[0].kind, 'blocked');
  }
  // A new service instance represents a reconnect or another Worker isolate.
  service = new RoomService(store, { now: () => now });
  assert.equal((await sync(c)).snapshot.state.player.deskSlot, 2);
  await sync(a, [{ type: 'leave' }]);
  let snapshot = (await sync(b)).snapshot;
  assert.equal(snapshot.room.hostId, b.playerId); assert.equal(snapshot.state.player.deskSlot, 1);
  const replacement = await service.join(a.code, { config: config('Replacement') });
  assert.equal(replacement.snapshot.state.player.deskSlot, 0);
  await sync(b, [{ type: 'endShift' }]);
  snapshot = (await sync(b, [{ type: 'nextDay' }])).snapshot;
  assert.equal(snapshot.state.player.deskSlot, 1);
  assert.deepEqual(snapshot.room.players.map(p => p.deskSlot).sort(), [0, 1, 2, 3]);
  const model = new GameModel(); model.state = snapshot.state;
  for (const player of snapshot.state.onlinePlayers) {
    assert.ok(model.isFree(player.x, player.y));
    const standing = model.point('desk:' + player.deskId);
    assert.ok(Math.hypot(player.x - standing.x, player.y - standing.y) < 2, 'next day must preserve assigned desk and valid arrival');
  }
}
await test('personal desks remain unique through reconnect, host migration, slot reuse, and next day', () => exercisePersonalDesks(new MemoryRoomStore()));
await test('personal desk reservations survive persisted SQLite room snapshots', async () => {
  const setup = await sqliteStore(); try { await exercisePersonalDesks(setup.store); } finally { setup.close(); }
});
await test('older room records receive stable desks and safe expanded-floor positions', async () => {
  const store = new MemoryRoomStore(), service = new RoomService(store);
  const a = await service.create({ config: config('Original host') }), b = await service.join(a.code, { config: config('Original guest') });
  const record = await store.get(a.code), legacy = cloneLegacyLayout();
  record.model.state.layout = legacy;
  for (const actor of Object.values(record.players)) { delete actor.deskSlot; delete actor.player.deskSlot; delete actor.player.deskId; actor.player.x = 505; actor.player.y = 730; actor.route = [{ x: 900, y: 780 }]; }
  record.revision++; await store.compareAndSwap(a.code, record.revision - 1, record);
  const first = (await service.sync(a.code, a.playerId, a.token, { commands: [] })).snapshot;
  const second = (await service.sync(a.code, b.playerId, b.token, { commands: [] })).snapshot;
  assert.equal(first.state.layout.width, 1600); assert.equal(first.state.layout.height, 1200); assert.equal(first.state.layout.desks.length, 24);
  assert.equal(first.state.player.deskSlot, 0); assert.equal(second.state.player.deskSlot, 1);
  const model = new GameModel(); model.state = first.state;
  for (const player of first.state.onlinePlayers) assert.ok(model.isFree(player.x, player.y));
  assert.ok(first.state.npcs.filter(n => n.role !== 'visitor').every(n => n.deskId && model.isFree(n.x, n.y)));
});
function cloneLegacyLayout() {
  const legacy = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  legacy.version = 2; legacy.width = 1000; legacy.height = 900; delete legacy.desks; legacy.props = [];
  legacy.stations.forEach((station, index) => { if (index < 10) { station.x = 100 + index % 5 * 200; station.y = index < 5 ? 300 : 560; } });
  for (const [id, x, y] of [['coffee', 105, 770], ['gym', 270, 770], ['printer', 430, 770], ['kitchen', 680, 770], ['assembly', 900, 780]]) Object.assign(legacy.stations.find(s => s.id === id), { x, y });
  legacy.executives.forEach((executive, index) => Object.assign(executive, { x: [180, 500, 820][index], y: 90 }));
  return legacy;
}
async function editRoom(store, code, edit) {
  const record = await store.get(code), revision = record.revision;
  edit(record); record.revision++;
  assert.equal(await store.compareAndSwap(code, revision, record), true);
}
async function exerciseOfficeMigration(store) {
  const now = 1794690000000, service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Old office host') });
  const b = await service.join(a.code, { config: config('Old office guest') });
  await editRoom(store, a.code, record => {
    for (const field of ['managers', 'coffee', 'deskMesses', 'deskNotes', 'phoneQueue', 'officeRoutines']) delete record.model.state[field];
  });
  const first = (await service.sync(a.code, a.playerId, a.token, { commands: [] })).snapshot;
  assert.equal(first.state.managers.length, 3);
  assert.ok(first.state.managers.every(manager => Number.isFinite(manager.x) && Number.isFinite(manager.y)));
  assert.ok(['fresh', 'stale', 'brewing'].includes(first.state.coffee.status));
  assert.ok(Array.isArray(first.state.deskMesses)); assert.ok(Array.isArray(first.state.deskNotes));
  assert.equal(first.state.phoneQueue.waiting, 0);
  const second = (await service.sync(a.code, b.playerId, b.token, { commands: [] })).snapshot;
  for (const field of ['managers', 'coffee', 'deskMesses', 'deskNotes', 'phoneQueue']) assert.deepEqual(second.state[field], first.state[field], field + ' must not reset for each poll or player');
  const persisted = await store.get(a.code);
  assert.deepEqual(persisted.model.state.managers, first.state.managers);
}
await test('existing live rooms acquire office routines once and share them across players', () => exerciseOfficeMigration(new MemoryRoomStore()));
await test('office routine migration survives persisted SQLite snapshots', async () => {
  const setup = await sqliteStore(); try { await exerciseOfficeMigration(setup.store); } finally { setup.close(); }
});
await test('private desk notes are readable only by their owner, including after desk-slot reuse', async () => {
  const now = 1794690000000, store = new MemoryRoomStore(), service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Private host') });
  const b = await service.join(a.code, { config: config('Private guest') });
  const aSecret = 'Host: please clean up the crumbs beside your monitor.', bSecret = 'Guest: yesterday’s takeaway is still at your desk.';
  let seq = 0;
  const syncA = commands => service.sync(a.code, a.playerId, a.token, { commands: commands.map(command => ({ seq: ++seq, ...command })) });
  await editRoom(store, a.code, record => {
    record.model.state.deskNotes = [
      { id: 'note-host-private', deskId: 'desk-player-0', ownerId: a.playerId, author: 'Jordan Rush', text: aSecret, read: false, createdAt: 0 },
      { id: 'note-guest-private', deskId: 'desk-player-1', ownerId: b.playerId, author: 'Blair Ledger', text: bSecret, read: false, createdAt: 0 },
      { id: 'note-npc-readable', deskId: 'desk-npc-0', ownerId: 'npc-0', author: 'Pat Sterling', text: 'Thanks for helping keep our kitchen tidy.', read: false, createdAt: 0 }
    ];
  });
  let response = await syncA([]);
  assert.equal(response.snapshot.state.deskNotes.find(note => note.ownerId === a.playerId).text, aSecret);
  assert.ok(!JSON.stringify(response).includes(bSecret));
  assert.equal(response.snapshot.state.deskNotes.find(note => note.ownerId === b.playerId).private, true);
  assert.equal(response.snapshot.state.deskNotes.find(note => note.ownerId === 'npc-0').text, 'Thanks for helping keep our kitchen tidy.');
  const guest = await service.sync(a.code, b.playerId, b.token, { commands: [] });
  assert.equal(guest.snapshot.state.deskNotes.find(note => note.ownerId === b.playerId).text, bSecret);
  assert.ok(!JSON.stringify(guest).includes(aSecret));
  await editRoom(store, a.code, record => {
    const model = new GameModel(); model.state = record.model.state;
    Object.assign(record.players[a.playerId].player, model.point('desk:desk-player-1'));
  });
  response = await syncA([{ type: 'interact', stationId: 'desk:desk-player-1' }, { type: 'dismissNote', noteId: 'note-guest-private' }]);
  assert.notEqual(response.results[0].kind, 'note'); assert.equal(response.results[1].kind, 'blocked');
  assert.ok(!JSON.stringify(response).includes(bSecret));
  assert.equal((await store.get(a.code)).model.state.deskNotes.find(note => note.id === 'note-guest-private').read, false);
  await editRoom(store, a.code, record => {
    const model = new GameModel(); model.state = record.model.state;
    Object.assign(record.players[a.playerId].player, model.point('desk:desk-player-0'));
  });
  response = await syncA([{ type: 'interact', stationId: 'desk:desk-player-0' }]);
  assert.equal(response.results[0].kind, 'note'); assert.equal(response.results[0].note.text, aSecret);
  assert.equal((await store.get(a.code)).model.state.deskNotes.find(note => note.id === 'note-host-private').read, true);
  await syncA([{ type: 'dismissNote', noteId: 'note-host-private' }]);
  assert.ok(!(await store.get(a.code)).model.state.deskNotes.some(note => note.id === 'note-host-private'));
  await service.sync(a.code, b.playerId, b.token, { commands: [{ seq: 1, type: 'leave' }] });
  const replacement = await service.join(a.code, { config: config('Replacement guest') });
  assert.equal(replacement.snapshot.state.player.deskSlot, 1);
  assert.ok(!JSON.stringify(replacement).includes(bSecret), 'a new owner must not inherit the former owner’s note contents');
  const replacementRead = await service.sync(a.code, replacement.playerId, replacement.token, { commands: [{ seq: 1, type: 'interact', stationId: 'desk:desk-player-1' }] });
  assert.notEqual(replacementRead.results[0].kind, 'note'); assert.ok(!JSON.stringify(replacementRead).includes(bSecret));
});
await test('a queued phone can be answered while another player holds the Congierge case, without duplicate answers', async () => {
  const now = 1794690000000, store = new MemoryRoomStore(), service = new RoomService(store, { now: () => now });
  const a = await service.create({ config: config('Case handler', 'call') });
  const b = await service.join(a.code, { config: config('Queue helper') });
  let before, ringId, taskId;
  await editRoom(store, a.code, record => {
    const model = new GameModel(record.model.seed); model.state = record.model.state;
    for (const [key, value] of Object.entries(record.model)) if (key !== 'state' && key !== 'version') model[key] = value;
    model.ensureOfficeState();
    const task = model.state.tasks.find(item => item.role === 'call') || model.addTask('call'); taskId = task.id;
    record.locks[task.id] = a.playerId; record.players[a.playerId].currentTask = task.id;
    Object.assign(record.players[b.playerId].player, model.point('call'));
    model.receiveCall(); before = model.state.phoneQueue.answered; ringId = model.state.phoneQueue.ringId;
    record.model = model.serialize();
  });
  const command = { seq: 1, type: 'interact', stationId: 'call' };
  const answered = await service.sync(a.code, b.playerId, b.token, { commands: [command] });
  assert.notEqual(answered.results[0].kind, 'blocked'); assert.notEqual(answered.results[0].kind, 'task');
  assert.equal(answered.snapshot.state.phoneQueue.waiting, 0);
  assert.equal(answered.snapshot.state.phoneQueue.answered, before + 1);
  const replay = await service.sync(a.code, b.playerId, b.token, { commands: [command] });
  assert.equal(replay.snapshot.state.phoneQueue.answered, before + 1);
  assert.equal(replay.snapshot.state.phoneQueue.ringId, ringId, 'polls and retries must preserve the stable ring identifier');
  const host = await service.sync(a.code, a.playerId, a.token, { commands: [] });
  assert.deepEqual(host.snapshot.state.phoneQueue, replay.snapshot.state.phoneQueue);
  assert.equal(host.snapshot.state.currentTask, taskId);
  assert.equal((await store.get(a.code)).locks[taskId], a.playerId);
});
await test('HTTP handler rejects foreign origins, invalid JSON, invalid sessions, and giant payloads', async () => {
  const service = new RoomService(new MemoryRoomStore());
  const request = (body, headers = {}) => new Request('https://office.test/api/rooms', { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });
  assert.equal((await handleRoomRequest(request('{}', { Origin: 'https://elsewhere.test' }), service)).status, 403);
  assert.equal((await handleRoomRequest(request('{'), service)).status, 400);
  assert.equal((await handleRoomRequest(request(' '.repeat(65000)), service)).status, 413);
  assert.equal((await handleRoomRequest(new Request('https://office.test/api/rooms'), service)).status, 405);
});
await test('local preview exposes the same multiplayer API over HTTP', async () => {
  const server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/api/rooms', { method: 'POST', body: JSON.stringify({ config: config('HTTP Coworker') }), headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.snapshot.state.player.name, 'HTTP Coworker');
    assert.equal((await fetch(base + '/api/health')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
console.log(passed + ' network checks passed; ' + failed + ' failed.');
if (failed) process.exitCode = 1;
