import { GameModel, ROLES, OUTFITS, DIFFICULTIES } from '../dist/model.js';

const MAX_PLAYERS = 4;
const ROOM_LIFETIME = 2 * 60 * 60 * 1000;
const PRESENCE_TIMEOUT = 30000;
const MAX_COMMANDS = 20;
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const text = (value, limit = 160) => (typeof value === 'string' ? value : '').replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const randomHex = bytes => [...crypto.getRandomValues(new Uint8Array(bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
const error = (status, message) => Object.assign(new Error(message), { status });
const safeEqual = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i); return difference === 0; };
async function tokenHash(token) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join(''); }
function configFrom(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return {
    name: text(input.name, 22) || 'New colleague',
    role: ROLES.some(r => r.id === input.role) ? input.role : ROLES[0].id,
    outfit: OUTFITS.some(o => o.id === input.outfit) ? input.outfit : OUTFITS[0].id,
    difficulty: DIFFICULTIES.some(d => d.id === input.difficulty) ? input.difficulty : DIFFICULTIES[0].id,
    skin: /^#[0-9a-f]{6}$/i.test(input.skin || '') ? input.skin : '#d4a181'
  };
}
function hydrate(record) {
  const source = record.model;
  const model = new GameModel(source.seed);
  model.state = clone(source.state);
  for (const [key, value] of Object.entries(source)) if (key !== 'state' && key !== 'version') model[key] = clone(value);
  return model;
}
function activate(model, actor) { model.state.player = actor.player; model.state.route = actor.route; model.state.currentTask = actor.currentTask; }
function retain(model, actor) { actor.player = model.state.player; actor.route = model.state.route; actor.currentTask = model.state.currentTask; }
function releaseTask(record, actor) { if (actor.currentTask && record.locks[actor.currentTask] === actor.id) delete record.locks[actor.currentTask]; actor.currentTask = null; }
function beginEvacuation(record, model, actors) {
  const event = model.state.event;
  if (event?.type !== 'fire') { record.fireEventId = null; return; }
  if (record.fireEventId === event.id) return;
  record.fireEventId = event.id;
  for (const actor of actors) { releaseTask(record, actor); actor.route = []; }
  record.locks = {};
  model.state.currentTask = null;
  model.state.route = [];
}
function reconcileTaskLocks(record, model, actors) {
  const taskIds = new Set(model.state.tasks.map(task => task.id));
  for (const [taskId, ownerId] of Object.entries(record.locks)) {
    const owner = record.players[ownerId];
    if (!taskIds.has(taskId) || !owner || owner.currentTask !== taskId) delete record.locks[taskId];
  }
  for (const actor of actors) {
    if (actor.currentTask && (!taskIds.has(actor.currentTask) || record.locks[actor.currentTask] !== actor.id)) actor.currentTask = null;
  }
}
function addMessage(record, name, content, now, playerId = null, kind = 'player') {
  record.chat.push({ id: randomHex(8), playerId, name, text: text(content), time: now, kind });
  record.chat = record.chat.slice(-50);
}
function publicActor(actor) { return { ...clone(actor.player), id: actor.id, name: actor.player.name, role: actor.player.role, connected: true }; }
function cleanResult(result) { const out = clone(result || {}); if (out.task) delete out.task.answers; return out; }

export class MemoryRoomStore {
  constructor() { this.rooms = new Map(); }
  async get(code) { return this.rooms.has(code) ? clone(this.rooms.get(code)) : null; }
  async create(record) { let cleaned = 0; for (const [code, old] of this.rooms) if (old.expiresAt < record.createdAt && cleaned++ < 100) this.rooms.delete(code); if (this.rooms.has(record.code)) return false; this.rooms.set(record.code, clone(record)); return true; }
  async compareAndSwap(code, revision, record) { const old = this.rooms.get(code); if (!old || old.revision !== revision) return false; this.rooms.set(code, clone(record)); return true; }
}

export class D1RoomStore {
  constructor(db) { this.db = db; }
  async get(code) { const row = await this.db.prepare('SELECT data FROM game_rooms WHERE code = ?').bind(code).first(); return row ? JSON.parse(row.data) : null; }
  async create(record) { await this.db.prepare('DELETE FROM game_rooms WHERE code IN (SELECT code FROM game_rooms WHERE expires_at < ? LIMIT 100)').bind(record.createdAt).run(); const result = await this.db.prepare('INSERT OR IGNORE INTO game_rooms (code, data, revision, expires_at) VALUES (?, ?, ?, ?)').bind(record.code, JSON.stringify(record), record.revision, record.expiresAt).run(); return result.meta.changes === 1; }
  async compareAndSwap(code, revision, record) { const result = await this.db.prepare('UPDATE game_rooms SET data = ?, revision = ?, expires_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(record), record.revision, record.expiresAt, code, revision).run(); return result.meta.changes === 1; }
}

export class RoomService {
  constructor(store, options = {}) { this.store = store; this.now = options.now || (() => Date.now()); }
  async create(input = {}) {
    const now = this.now(), config = configFrom(input.config), model = new GameModel(crypto.getRandomValues(new Uint32Array(1))[0]);
    model.start(config);
    if (input.layout) { const result = model.setLayout?.(input.layout); if (!result?.ok) throw error(400, result?.message || 'This floor plan cannot be used.'); }
    const token = randomHex(24), playerId = randomHex(12);
    const player = { ...clone(model.state.player), id: playerId };
    const actor = { id: playerId, tokenHash: await tokenHash(token), player, route: [], currentTask: null, lastSeen: now, lastSeq: 0, lastMotionAt: now, motionCredit: .3, replies: [], chatTimes: [] };
    for (let attempt = 0; attempt < 5; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = [...crypto.getRandomValues(new Uint8Array(8))].map(n => alphabet[n % alphabet.length]).join('');
      const record = { code, hostId: playerId, players: { [playerId]: actor }, model: model.serialize(), locks: {}, chat: [], revision: 1, createdAt: now, updatedAt: now, expiresAt: now + ROOM_LIFETIME };
      addMessage(record, 'Office', config.name + ' opened the office. Invite coworkers with code ' + code + '.', now, null, 'system');
      if (await this.store.create(record)) return { code, playerId, token, snapshot: this.snapshot(record, playerId) };
    }
    throw error(503, 'Could not reserve an office. Please try again.');
  }
  async mutate(code, callback) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) throw error(404, 'That office code was not found.');
    for (let retry = 0; retry < 10; retry++) {
      const record = await this.store.get(code), now = this.now();
      if (!record || record.expiresAt < now) throw error(404, 'This office has closed. Create a fresh room.');
      const revision = record.revision;
      const result = await callback(record, now);
      record.revision = revision + 1;
      if (await this.store.compareAndSwap(code, revision, record)) return typeof result === 'function' ? result(record) : result;
    }
    throw error(409, 'The office is busy. Retry this request in a moment.');
  }
  removeAbsent(record, now) {
    const oldHost = record.hostId;
    for (const actor of Object.values(record.players)) if (now - actor.lastSeen > PRESENCE_TIMEOUT) { releaseTask(record, actor); delete record.players[actor.id]; addMessage(record, 'Office', actor.player.name + ' stepped out.', now, null, 'system'); }
    if (!record.players[record.hostId]) record.hostId = Object.keys(record.players)[0] || null;
    if (oldHost && record.hostId && oldHost !== record.hostId) addMessage(record, 'Office', record.players[record.hostId].player.name + ' is now hosting the office.', now, null, 'system');
  }
  advance(record, now) {
    const model = hydrate(record), actors = Object.values(record.players), duration = Math.max(0, Math.min(10, (now - record.updatedAt) / 1000));
    beginEvacuation(record, model, actors);
    if (actors.length && model.state.phase !== 'ended') {
      model.state.phase = 'playing';
      for (let remaining = duration; remaining > .00001; remaining -= .05) {
        const dt = Math.min(.05, remaining), first = actors[0];
        model.state.onlinePlayers = actors.map(publicActor);
        activate(model, first); model.update(dt); beginEvacuation(record, model, actors); retain(model, first);
        for (const actor of actors.slice(1)) {
          if (model.state.phase === 'playing' && !actor.currentTask) model.follow(actor.player, actor.route, 158 * (actor.player.stress > 85 ? .83 : 1), dt);
          actor.player.stress = Math.max(0, actor.player.stress - dt * .11);
          const noisy = model.state.event?.npcId && model.state.npcs.find(n => n.id === model.state.event.npcId);
          if (noisy && Math.hypot(noisy.x - actor.player.x, noisy.y - actor.player.y) < 160) actor.player.stress = Math.min(100, actor.player.stress + dt * .9);
        }
      }
      if (model.state.phase === 'ended') for (const actor of actors) { releaseTask(record, actor); actor.route = []; }
    }
    reconcileTaskLocks(record, model, actors);
    if (actors.length) activate(model, actors[0]);
    record.model = model.serialize(); record.updatedAt = now; record.expiresAt = now + ROOM_LIFETIME;
    return model;
  }
  async join(code, input = {}) {
    const config = configFrom(input.config), token = randomHex(24), hash = await tokenHash(token), playerId = randomHex(12);
    return this.mutate(code, (record, now) => {
      this.removeAbsent(record, now); const model = this.advance(record, now);
      if (Object.keys(record.players).length >= MAX_PLAYERS) throw error(409, 'This office already has four coworkers.');
      const spawn = model.nearestFree(model.state.player.x + 35 + Object.keys(record.players).length * 14, model.state.player.y + 15);
      const player = { ...clone(model.state.player), ...config, ...spawn, id: playerId, stress: 10, walk: false };
      record.players[playerId] = { id: playerId, tokenHash: hash, player, route: [], currentTask: null, lastSeen: now, lastSeq: 0, lastMotionAt: now, motionCredit: .3, replies: [], chatTimes: [] };
      if (!record.hostId) record.hostId = playerId;
      addMessage(record, 'Office', player.name + ' joined the team.', now, null, 'system');
      return saved => ({ code: saved.code, playerId, token, snapshot: this.snapshot(saved, playerId) });
    });
  }
  async sync(code, playerId, token, input = {}) {
    if (typeof token !== 'string' || token.length > 100) throw error(401, 'Your office session could not be verified.');
    if (!Array.isArray(input.commands || []) || (input.commands || []).length > MAX_COMMANDS) throw error(400, 'Too many actions in one request.');
    const hash = await tokenHash(token);
    return this.mutate(code, (record, now) => {
      let actor = record.players[playerId];
      if (!actor || !safeEqual(actor.tokenHash, hash)) throw error(401, 'Your office session has expired. Rejoin with the room code.');
      actor.lastSeen = now; this.removeAbsent(record, now);
      const model = this.advance(record, now), results = [];
      actor.motionCredit = Math.min(.45, actor.motionCredit + Math.max(0, (now - actor.lastMotionAt) / 1000)); actor.lastMotionAt = now;
      activate(model, actor);
      for (const command of input.commands || []) {
        const seq = command?.seq;
        if (!Number.isSafeInteger(seq) || seq < 1 || seq > 1000000000) throw error(400, 'Invalid action sequence.');
        if (seq <= actor.lastSeq) { const cached = actor.replies.find(r => r.seq === seq); if (cached) results.push(clone(cached)); continue; }
        if (seq !== actor.lastSeq + 1) { results.push({ seq, kind: 'blocked', message: 'An earlier action is still arriving. Retry in order.' }); break; }
        let result;
        try { result = this.command(record, model, actor, command, now); } catch (e) { result = { kind: 'blocked', message: e.status ? e.message : 'That action could not be completed.' }; }
        retain(model, actor); actor.lastSeq = seq;
        const reply = { seq, ...cleanResult(result) }; results.push(reply); actor.replies.push(reply); actor.replies = actor.replies.slice(-30);
        if (command.type === 'leave' && result?.left) break;
      }
      record.model = model.serialize();
      return saved => ({ snapshot: this.snapshot(saved, playerId), results, ack: actor.lastSeq, left: !saved.players[playerId] });
    });
  }
  command(record, model, actor, command, now) {
    const type = command.type;
    if (type === 'chat') {
      const message = text(command.text); if (!message) return { kind: 'none', message: 'Type a message first.' };
      actor.chatTimes = actor.chatTimes.filter(t => now - t < 5000); if (actor.chatTimes.length >= 4) throw error(429, 'Give your coworkers a moment to catch up.');
      actor.chatTimes.push(now); addMessage(record, actor.player.name, message, now, actor.id); return { kind: 'chat', message: 'Message sent.' };
    }
    if (type === 'leave') { releaseTask(record, actor); delete record.players[actor.id]; if (record.hostId === actor.id) record.hostId = Object.keys(record.players)[0] || null; addMessage(record, 'Office', actor.player.name + ' clocked out of the room.', now, null, 'system'); return { left: true, kind: 'none' }; }
    if (type === 'nextDay' || type === 'endShift') {
      if (record.hostId !== actor.id) throw error(403, 'Only the host can start or end the shared workday.');
      if (type === 'endShift') { model.state.remaining = 0; model.update(.01); return { kind: 'event', message: 'The team has clocked out.' }; }
      if (model.state.phase !== 'ended') throw error(409, 'Finish this workday before starting the next.');
      model.nextDay(); record.locks = {};
      Object.values(record.players).forEach((p, i) => { p.player = { ...clone(model.state.player), name: p.player.name, role: p.player.role, outfit: p.player.outfit, skin: p.player.skin, id: p.id, ...model.nearestFree(model.state.player.x + i * 25, model.state.player.y) }; p.route = []; p.currentTask = null; });
      activate(model, actor); return { kind: 'event', message: 'A fresh workday. Same excellent coworkers.' };
    }
    if (model.state.phase !== 'playing') return { kind: 'blocked', message: 'This workday has ended.' };
    if (type === 'moveTo') { if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) throw error(400, 'Invalid destination.'); model.moveTo(command.x, command.y); return { kind: 'move' }; }
    if (type === 'moveDirection') {
      if (![command.dx, command.dy, command.duration].every(Number.isFinite)) throw error(400, 'Invalid movement.');
      let duration = Math.min(actor.motionCredit, clamp(command.duration, 0, .3)); actor.motionCredit -= duration;
      while (duration > .00001) { const dt = Math.min(.05, duration); model.moveDirection(clamp(command.dx, -1, 1), clamp(command.dy, -1, 1), dt); duration -= dt; }
      return { kind: 'move' };
    }
    if (type === 'interact') {
      if (typeof command.stationId !== 'string' || command.stationId.length > 60) throw error(400, 'Invalid interaction.');
      const task = model.state.tasks.find(t => t.role === command.stationId), owner = task && record.locks[task.id];
      if (owner && owner !== actor.id && model.state.event?.station !== command.stationId) return { kind: 'blocked', message: 'A coworker is already handling this case. Try another desk.' };
      const result = model.interact(command.stationId);
      if (result.kind === 'task') { if (actor.currentTask && actor.currentTask !== result.task.id) releaseTask(record, actor); record.locks[result.task.id] = actor.id; }
      return result;
    }
    if (type === 'answer') {
      const task = model.state.tasks.find(t => t.id === command.taskId);
      if (!task || model.state.currentTask !== task.id || record.locks[task.id] !== actor.id) return { kind: 'blocked', complete: false, message: 'Open this case at its department desk first.' };
      if (!Number.isInteger(command.step) || command.step !== task.step) return { kind: 'blocked', complete: false, correct: false, message: 'This case has moved to another step. Review the current question before answering.' };
      if (!Number.isInteger(command.choiceIndex) || command.choiceIndex < 0 || command.choiceIndex >= task.choices[task.step].length) throw error(400, 'Choose one of the available answers.');
      const result = model.advanceTask(command.choiceIndex); if (result.complete) delete record.locks[task.id]; return result;
    }
    if (type === 'closeTask') { releaseTask(record, actor); model.closeTask(); return { kind: 'none' }; }
    if (type === 'talk') {
      if (!['greet', 'help', 'quiet'].includes(command.choice)) throw error(400, 'Choose an available conversation option.');
      return model.talkTo?.(String(command.npcId || '').slice(0, 40), command.choice) || { kind: 'chat', message: 'Your coworker appreciates the check-in.' };
    }
    throw error(400, 'That office action is not available.');
  }
  snapshot(record, playerId) {
    const state = clone(record.model.state), actor = record.players[playerId];
    if (actor) { state.player = clone(actor.player); state.route = clone(actor.route); state.currentTask = actor.currentTask; }
    state.otherPlayers = Object.values(record.players).filter(p => p.id !== playerId).map(publicActor);
    state.onlinePlayers = Object.values(record.players).map(publicActor);
    state.tasks = state.tasks.map(task => { delete task.answers; task.lockedBy = record.locks[task.id] || null; return task; });
    return { state, seed: record.model.seed, elapsed: record.model.elapsed, nextTaskId: record.model.nextTaskId, room: { code: record.code, hostId: record.hostId, playerId, players: Object.values(record.players).map(p => ({ id: p.id, name: p.player.name, role: p.player.role })), chat: clone(record.chat), revision: record.revision, maxPlayers: MAX_PLAYERS } };
  }
}

export async function handleRoomRequest(request, service) {
  try {
    const url = new URL(request.url), route = url.pathname;
    if (request.method !== 'POST') return Response.json({ error: 'Use POST for office actions.' }, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    const origin = request.headers.get('Origin'); if (origin && origin !== url.origin) throw error(403, 'Office actions must come from this game.');
    if (Number(request.headers.get('Content-Length') || 0) > 64000) throw error(413, 'This office request is too large.');
    const raw = await request.text(); if (raw.length > 64000) throw error(413, 'This office request is too large.');
    let input; try { input = JSON.parse(raw || '{}'); } catch { throw error(400, 'This request was not valid JSON.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw error(400, 'Invalid office request.');
    let data;
    if (route === '/api/rooms') data = await service.create(input);
    else { const match = route.match(/^\/api\/rooms\/([A-Z0-9]{8})\/(join|sync)$/i); if (!match) throw error(404, 'Office route not found.');
      if (match[2].toLowerCase() === 'join') data = await service.join(match[1], input);
      else { const authorization = request.headers.get('Authorization') || ''; data = await service.sync(match[1], input.playerId, authorization.startsWith('Bearer ') ? authorization.slice(7) : '', input); }
    }
    return Response.json(data, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { if (!e.status) console.error('Office request failed:', e.message); return Response.json({ error: e.status ? e.message : 'The office server could not complete this request. Please try again.' }, { status: e.status || 503, headers: { 'Cache-Control': 'no-store' } }); }
}
