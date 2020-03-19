export class CandidatesQueue {
    
    queue: { [key: string]: any } = {};
    
    push(callerId: string | number, candidate: any) {
        this.queue[callerId].push(candidate);
    }

    get(callerId: string | number) {
        return this.queue[callerId]
    }

    reset(id: string) {
        this.queue[id] = [];
    }

    clearCandidatesQueue(sessionId: string | number) {
        if (this.queue[sessionId]) {
            delete this.queue[sessionId];
        }
    }

}