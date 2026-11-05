// Route typed Coach messages to the task that can actually fulfill them.
// Questions stay in `ask`; explicit plan or exercise changes need a review proposal.

const REVIEW_WORDS = /审查|评估|复盘|review\b|improve\b|adjust\b|modify\b|reorder\b/iu
const CHANGE_WORDS = /换掉|替换|删除|去掉|移除|增加|添加|减少|改成|修改|调整|优化|重排|更新|改进|replace\b|swap\b|remove\b|delete\b|add\b|change\b/iu
const PLAN_TARGETS = /计划|训练安排|训练日|动作|组数|次数|进阶|routine\b|exercise\b|workout\b|sets?\b|reps?\b|progression\b/iu
const DIRECT_CHANGE = /(?:把|将).{1,80}(?:换成|替换成|改成|删除|去掉|移除)|^(?:换掉|删除|去掉|移除).{1,80}$|(?:换掉|删除|去掉|移除).{1,80}(?:动作|训练|计划|routine\b|exercise\b)/iu
const PLAN_UPDATE_QUESTION = /(?:能|可以|可不可以|是否可以).{0,50}(?:更新|改进|修改|调整).{0,50}(?:计划|训练安排)|(?:更新|改进|修改|调整).{0,50}(?:到|进|在).{0,20}(?:计划|训练安排).*[吗?？]$/iu

export function needsCoachReview(message) {
  const text = String(message || '').trim()
  if (!text) return false
  if (PLAN_UPDATE_QUESTION.test(text)) return false
  if (REVIEW_WORDS.test(text)) return true
  if (DIRECT_CHANGE.test(text)) return true
  return CHANGE_WORDS.test(text) && PLAN_TARGETS.test(text)
}
