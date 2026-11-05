import { describe, expect, it } from 'vitest'
import { needsCoachReview } from './coach-route.js'

describe('needsCoachReview', () => {
  it('recognizes explicit plan changes', () => {
    expect(needsCoachReview('帮我换掉这个动作')).toBe(true)
    expect(needsCoachReview('把卧推换成俯卧撑')).toBe(true)
    expect(needsCoachReview('删除深蹲')).toBe(true)
    expect(needsCoachReview('请调整训练计划的组数')).toBe(true)
    expect(needsCoachReview('improve this routine')).toBe(true)
    expect(needsCoachReview('正式改进计划')).toBe(true)
    expect(needsCoachReview('就这样改进，现在你正式修改我的计划')).toBe(true)
  })

  it('keeps ordinary questions in the ask path', () => {
    expect(needsCoachReview('组间休息多久？')).toBe(false)
    expect(needsCoachReview('深蹲怎么做才标准？')).toBe(false)
    expect(needsCoachReview('我该不该增加重量？')).toBe(false)
    expect(needsCoachReview('那你现在能更新到我的训练计划中吗？')).toBe(false)
  })
})
