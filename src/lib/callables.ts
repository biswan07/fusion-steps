import { httpsCallable, getFunctions } from 'firebase/functions'
import { getApp } from 'firebase/app'
import type { PackSize } from '../types'

export type EditSubscriptionPayload =
  | { subscriptionId: string; op: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { subscriptionId: string; op: 'backdate-count'; usedCount: number }

export async function callEditSubscription(payload: EditSubscriptionPayload) {
  const fn = httpsCallable(getFunctions(getApp()), 'editSubscription')
  return fn(payload)
}
