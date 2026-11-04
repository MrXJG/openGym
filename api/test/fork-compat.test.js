/* The customized client's chat alias shares the upstream ask queue and its server gates. */
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const { coachRoutes } = await import('../coach/routes.js');
const { adapterFor } = await import('../coach/adapters/index.js');
const { forcePrivilegeVerdict } = await import('../coach/adapters/spawn.js');

forcePrivilegeVerdict({ ok: true, dropped: false, why: 'pinned by the test suite' });

const routes = coachRoutes({
  json: (res, status, body) => { res.status = status; res.body = body; },
  readBody: async req => req.body,
  readSession: req => req.user,
  requireAdmin: () => null
});
const call = async (path, body, uid) => {
  const res = {};
  await routes['POST /api/coach/' + path]({ body, user: uid ? { id: uid } : null }, res);
  return res;
};
const settle = async uid => {
  const until = Date.now() + 5000;
  while (jobs.status(uid).job && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
  const status = jobs.status(uid);
  assert.equal(status.job, null, 'the local ask job must finish');
  return status;
};

beforeEach(t => {
  cfg.save({ enabled: true, provider: 'fixture', caps: { perProfileDaily: 10, instanceDaily: 0 }, daily: null });
  // Keep real enqueue, payload construction and validation; only the provider response is fake.
  t.mock.method(adapterFor('fixture'), 'invoke', async () => ({
    code: 0,
    text: JSON.stringify({ coach_contract: 1, answer: 'Keep following your current plan.' })
  }));
});
after(() => {
  forcePrivilegeVerdict(null);
  fs.rmSync(DIR, { recursive: true, force: true });
});

const requests = [
  { name: 'legacy chat note', path: 'chat', body: { note: '  继续当前计划吗？  ', lang: 'zh-CN' }, question: '继续当前计划吗？' },
  { name: 'chat text', path: 'chat', body: { text: '  Continue this plan?  ', lang: 'en' }, question: 'Continue this plan?' },
  { name: 'upstream ask text', path: 'ask', body: { text: '  Keep this routine?  ', lang: 'en' }, question: 'Keep this routine?' }
];

for (const { name, path, body, question } of requests) {
  test(name + ' enters the real queue as ask', async () => {
    const uid = name.replaceAll(' ', '-');
    writeState(DIR, uid, sampleState());
    const response = await call(path, body, uid);
    assert.equal(response.status, 202, JSON.stringify(response.body));
    assert.ok(response.body.job.id);

    const status = await settle(uid);
    assert.equal(status.last.id, response.body.job.id);
    assert.equal(status.last.kind, 'ask');
    assert.equal(status.last.outcome, 'ready');
    assert.equal(status.pending.kind, 'ask');
    assert.equal(status.pending.answer, 'Keep following your current plan.');
    assert.equal(jobs.capState(uid).used, 1);

    const calls = adapterFor('fixture').invoke.mock.calls;
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].arguments[0].prompt.match(/```json\s*([\s\S]*?)```/)[1]);
    assert.equal(payload.task, 'ask');
    assert.equal(payload.question, question);
    assert.equal(payload.meta.lang, body.lang);
  });
}

test('chat and ask refuse unsigned callers before queueing', async () => {
  for (const { path, body } of requests) {
    const response = await call(path, body);
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: 'not signed in' });
  }
  assert.equal(adapterFor('fixture').invoke.mock.callCount(), 0);
});

test('chat and ask require a nonempty message', async () => {
  const uid = 'missing-message';
  writeState(DIR, uid, sampleState());
  for (const path of ['chat', 'ask']) {
    for (const body of [{}, { note: '   ' }, { text: '   ' }, { note: 123 }, { text: [] }]) {
      const response = await call(path, body, uid);
      assert.equal(response.status, 400, path + ': ' + JSON.stringify(body));
      assert.equal(response.body.code, 'invalid');
    }
  }
  assert.equal(jobs.capState(uid).used, 0);
  assert.equal(adapterFor('fixture').invoke.mock.callCount(), 0);
});

test('chat and ask keep the server-side consent gate', async () => {
  const uid = 'without-consent';
  writeState(DIR, uid, sampleState({ coach: {} }));
  for (const { path, body } of requests) {
    const response = await call(path, body, uid);
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'consent');
  }
  assert.equal(jobs.capState(uid).used, 0);
  assert.equal(adapterFor('fixture').invoke.mock.callCount(), 0);
});

test('chat and ask share the real per-profile daily cap', async () => {
  const uid = 'shared-profile-cap';
  writeState(DIR, uid, sampleState());
  cfg.save({ caps: { perProfileDaily: 1, instanceDaily: 0 } });
  assert.equal((await call('chat', { note: 'Keep this plan?', lang: 'en' }, uid)).status, 202);
  assert.equal((await settle(uid)).last.outcome, 'ready');

  for (const { path, body } of requests) {
    const response = await call(path, body, uid);
    assert.equal(response.status, 429);
    assert.equal(response.body.code, 'cap');
  }
  assert.equal(jobs.capState(uid).used, 1);
  assert.equal(adapterFor('fixture').invoke.mock.callCount(), 1);
});

test('chat and ask keep the instance-wide daily cap', async () => {
  const uid = 'instance-cap';
  writeState(DIR, uid, sampleState());
  cfg.save({ caps: { perProfileDaily: 0, instanceDaily: 1 }, daily: { date: new Date().toISOString().slice(0, 10), count: 1 } });
  for (const { path, body } of requests) {
    const response = await call(path, body, uid);
    assert.equal(response.status, 429);
    assert.equal(response.body.code, 'cap');
  }
  assert.equal(jobs.capState(uid).used, 0);
  assert.equal(adapterFor('fixture').invoke.mock.callCount(), 0);
});
