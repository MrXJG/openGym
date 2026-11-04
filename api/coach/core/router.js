/* Conservative, deterministic routing for free-form Coach messages. */

const EQUIPMENT_TERMS = [
  /器材|器械|设备|装备|健身房|健身器材/giu,
  /杠铃|哑铃|壶铃|龙门架|拉力器|高位下拉|划船机|跑步机|爬楼机|深蹲机|史密斯|蝴蝶机|推胸机|力量笼|深蹲架|双杠|引体向上杆|综合训练器/giu,
  /\b(?:dumbbells?|barbells?|kettlebells?|power rack|squat rack|cable machine|lat pulldown|rowing machine|treadmill|stair climber|pec ?deck|smith machine|gym equipment|equipment list|equipment inventory)\b/giu
];

const EQUIPMENT_CONTEXT = /现有|目前|可用|清单|配置|器材|器械|设备|装备|健身房|根据|按照|结合|匹配|缺少|没有|不具备|可不可以用|能不能用|based on|available|inventory|equipment|gym/iu;
const INVENTORY_CONTEXT = /我有|目前有|现在有|这些是|清单|inventory|equipment list|my equipment/iu;
const PLAN_ACTION = /计划|训练|改善|改进|调整|优化|审查|检查|评估|删除|去掉|移除|替换|换成|修改|安排|review|improv|adjust|change|remove|replace|swap|plan/iu;
const AUDIT_INTENT = /核对|检查.*计划|评估.*计划|根据.*器材|按.*器材|匹配.*器材|缺少.*器材|没有的.*器械|equipment audit|check.*plan|review.*equipment|based on.*equipment/iu;
const EXPLICIT_REVIEW = /审查|评估|复盘|你会改什么|看看.*训练|review/iu;
const EXPLICIT_CHANGE = /删除|去掉|替换|换成|增加|添加|移除|没有.*(?:器材|器械|设备)|remove|replace|swap|add/iu;

function equipmentMentionCount(message) {
  const text = String(message || '');
  let count = 0;
  for (const re of EQUIPMENT_TERMS) {
    re.lastIndex = 0;
    count += [...text.matchAll(re)].length;
  }
  return count;
}

export function isEquipmentAuditRequest(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const mentions = equipmentMentionCount(text);
  // A pasted inventory is often just a markdown list with no sentence around it.
  if (mentions >= 3 || (mentions >= 2 && INVENTORY_CONTEXT.test(text))) return true;
  return mentions > 0 && EQUIPMENT_CONTEXT.test(text) && PLAN_ACTION.test(text)
    && (INVENTORY_CONTEXT.test(text) || AUDIT_INTENT.test(text));
}

export function routeCoachMessage(message, { hasPlan = false, pendingCreate = false } = {}) {
  if (pendingCreate) return 'refine';
  if (!hasPlan) return 'create';
  const text = String(message || '');
  const planTarget = /计划|训练日|训练安排|周[一二三四五六日天]|\b(?:plan|routine|programme|program|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu.test(text);
  const exerciseTarget = /动作|训练项目|\b(?:exercise|movement|lift)\b/iu.test(text);
  const planEdit = /改进|改善|调整|优化|修改|improv|adjust|change/iu.test(text) && planTarget;
  const structuralChange = /删除|去掉|替换|换成|移除|remove|replace|swap/iu.test(text)
    || /增加|添加|add/iu.test(text) && /动作|训练日|训练安排|组|次数|exercise|routine|set|rep/iu.test(text);
  if (isEquipmentAuditRequest(text) || EXPLICIT_REVIEW.test(text) || planEdit || (structuralChange && (planTarget || exerciseTarget))) return 'review';
  return 'chat';
}
