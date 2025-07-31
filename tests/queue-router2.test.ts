import { describe, it, expect } from 'vitest'
import {
    env,
} from 'cloudflare:test';
import { QueueRouter2 } from '../src/queue-router2'

export const queueRouterTest = (name: string, queueRouter: QueueRouter2) => {
    it('should be defined', async () => {
        expect(queueRouter).toBeDefined()
    })
}

describe('QueueRouter2 Test', () => {

    it('should be defined', async () => {
        console.log(env)
        expect(1).toBe(1)
    })
})
