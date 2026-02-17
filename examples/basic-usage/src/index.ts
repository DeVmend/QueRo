import { QueueRouter } from '../../../src/index'

// 👇 Message types for type-safe queue handling
type NewUser = {
    action: 'new-user'
    userId: string
    email: string
}
type DeleteUser = {
    action: 'delete-user'
    userId: string
}
type UserActions = NewUser | DeleteUser

// 👇 Queue types for QueRo (extends the generated Env from worker-configuration.d.ts)
type Queues = {
    USER_QUEUE: Queue<UserActions>
}

// 👇 Create router using Env from worker-configuration.d.ts
const queueRouter = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
    USER_QUEUE: {
        name: env => `user-queue-${env.ENV_NAME}`,
    },
})

// 👇 Register handlers with full type safety
queueRouter
    .batch('USER_QUEUE', 'new-user', async messages => {
        console.log('New users:', messages)
    })
    .action('USER_QUEUE', 'delete-user', async message => {
        console.log('Delete user:', message.userId)
    })

export default {
    async fetch(req, env): Promise<Response> {
        // Ignore favicon requests
        if (req.url.includes('favicon')) {
            return new Response(null, { status: 204 })
        }

        await env.USER_QUEUE.send({
            action: 'new-user',
            userId: 'foo',
            email: 'foo@bar.com',
        })
        return new Response(`Sent message to queue (env: ${env.ENV_NAME})`)
    },

    async queue(batch, env): Promise<void> {
        await queueRouter.queue(batch, env)
    },
} satisfies ExportedHandler<Env>
