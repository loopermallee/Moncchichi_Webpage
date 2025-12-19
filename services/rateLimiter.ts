
class RateLimiter {
    private queues: Map<string, Promise<any>[]> = new Map();
    private maxConcurrent: number;

    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
    }

    /**
     * Executes an async function, ensuring no more than maxConcurrent tasks
     * are running for the given key.
     */
    async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (!this.queues.has(key)) {
            this.queues.set(key, []);
        }

        const queue = this.queues.get(key)!;

        // If the queue is full, wait for the first promise to settle
        while (queue.length >= this.maxConcurrent) {
            await Promise.race(queue);
        }

        const promise = fn().finally(() => {
            const index = queue.indexOf(promise);
            if (index > -1) queue.splice(index, 1);
        });

        queue.push(promise);
        return promise;
    }
}

/**
 * Global rate limiter instance configured for 3 concurrent requests.
 */
export const rateLimiter = new RateLimiter(3);
