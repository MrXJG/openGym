import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCoachMessage } from '../coach/core/router.js';

test('an equipment inventory with markdown rows is routed to a focused plan audit', () => {
  const inventory = `| **Super Squat** | 超级深蹲机 |\n| **Power Rack** | 力量笼 |\n| **Pectoral Fly/Rear Deltoid** | 蝴蝶夹胸 |\n| 跑步机 |\n| 划船机 |`;
  assert.equal(routeCoachMessage(inventory, { hasPlan: true }), 'review');
});

test('an explicit equipment-based plan improvement request is a review', () => {
  assert.equal(routeCoachMessage('根据现有器材改善我的计划，没有的器械就去掉', { hasPlan: true }), 'review');
  assert.equal(routeCoachMessage('我目前有哑铃和跑步机', { hasPlan: true }), 'review');
});

test('ordinary questions about one piece of equipment remain chat', () => {
  assert.equal(routeCoachMessage('深蹲时杠铃应该放在哪里？', { hasPlan: true }), 'chat');
  assert.equal(routeCoachMessage('我能继续按照当前计划训练吗？', { hasPlan: true }), 'chat');
  assert.equal(routeCoachMessage('器械训练与自由重量训练有什么区别？', { hasPlan: true }), 'chat');
  assert.equal(routeCoachMessage('我这种训练计划需要增加蛋白质吗？', { hasPlan: true }), 'chat');
});

test('pending plan revisions and missing plans keep their existing routes', () => {
  assert.equal(routeCoachMessage('根据这些器械修改计划', { hasPlan: true, pendingCreate: true }), 'refine');
  assert.equal(routeCoachMessage('我现在只有哑铃和跑步机', { hasPlan: false }), 'create');
});
