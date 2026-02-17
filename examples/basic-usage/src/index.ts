import { QueueRouter } from '../../../src/index'

type Environment = {
    KV: KVNamespace // Some example binding
    // ...
} & Queues

// 👇 define your message types by actions
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

// 👇 define your queues with their actions
type Queues = {
    USER_QUEUE: Queue<UserActions>
}

// 👇 create a queue router specify his Binding
const queueRouter = new QueueRouter<{ Bindings: Environment; Queues: Queues }>()

// 👇 add actions to the queue like defining api routes and handle them type safe
queueRouter
    .batch('USER_QUEUE', 'new-user', async messages => {
        console.log(messages) // 👈 get array of messages as configured size in wrangler.json
    })
    .action('USER_QUEUE', 'delete-user', async message => {
        console.log(message) // 👈 callback handles every message by action on his own
    })

export default {
    // 👇 example fetch handler for testing
    async fetch(req, env): Promise<Response> {
        // Ignore favicon requests
        if (req.url.includes('favicon')) {
            return new Response(null, { status: 204 })
        }

        await env.USER_QUEUE.send({
            action: 'delete-user',
            userId: '1337',
        })

        await env.USER_QUEUE.send({
            action: 'new-user',
            userId: '1337',
            email: 'foo@bar.com',
        })
        return new Response('Sent message to the queue')
    },
    // 👇 "link" the queue router to the queue
    async queue(batch, env): Promise<void> {
        queueRouter.queue(batch, env)
    },
} satisfies ExportedHandler<Environment, Error>

// 👇 also possible to export the queue router directly if no other handlers are needed
// export default queueRouter;
