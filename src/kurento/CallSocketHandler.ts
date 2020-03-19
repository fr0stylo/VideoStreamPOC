import { Socket } from "socket.io";
import { UserRegistry } from "../user-session/UserRegistry";
import { UserSession } from "../user-session/UserSession";
import { CandidatesQueue } from "./CadidatesQueue";
import { CallMediaPipeline } from "./CallMediaPipeline";
import kurento from "kurento-client";

const pipelines: { [key: string]: CallMediaPipeline } = {}

export class CallSocketHandler {
    private socketId: string;

    constructor(private userRegistry: UserRegistry, private candidatesQueue: CandidatesQueue, private kurento: any, private socket: Socket) {
        this.socketId = socket.id;
        console.log('Connected:', this.socketId);

        socket.on('register', (message: any) => {
            console.log('register', message)
            this.register(message.name);
        });

        socket.on('call', (message: any) => {
            console.log('call', message)

            this.call(message.to, message.from, message.sdpOffer);
        })

        socket.on('incomingCallResponse', async (message: any) => {
            console.log('incomingCallResponse', message)

            await this.incomingCallResponse(message.from, message.callResponse, message.sdpOffer);
        });

        socket.on('stop', () => {
            console.log('stop', this.socketId);

            this.stop();
        });

        socket.on('onIceCandidate', async (message: any) => {
            console.log('onIceCandidate', message);

            await this.onIceCandidate(message.candidate);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', this.socketId);

            this.candidatesQueue.clearCandidatesQueue(this.socketId);
            this.userRegistry.unregister(this.socketId);
        })
    }

    onError(error: string) {
        this.socket.emit('registerResponse', { response: 'rejected ', message: error });
    }

    register(name: any) {

        if (!name) {
            return this.onError("empty user name");
        }

        if (this.userRegistry.getByName(name)) {
            return this.onError("User " + name + " is already registered");
        }

        this.userRegistry.register(new UserSession(this.socketId, name, this.socket));

        try {
            this.socket.emit('registerResponse', { response: 'accepted' });
        } catch (exception) {
            this.onError(exception);
        }
    }

    call(to: any, from: any, sdpOffer: any) {
        this.candidatesQueue.clearCandidatesQueue(this.socketId);

        const caller = this.userRegistry.getById(this.socketId);
        let rejectCause = 'User ' + to + ' is not registered';
        if (this.userRegistry.getByName(to)) {
            const callee = this.userRegistry.getByName(to);
            caller.sdpOffer = sdpOffer
            console.log(this.userRegistry.getById(this.socketId));
            callee.peer = from;
            caller.peer = to;
            const message = {
                id: 'incomingCall',
                from: from
            };

            try {
                return callee.sendMessage(message);
            } catch (exception) {
                rejectCause = "Error " + exception;
            }
        }

        let message = {
            id: 'callResponse',
            response: 'rejected: ',
            message: rejectCause
        };

        caller.sendMessage(message);
    }

    async incomingCallResponse(from: any, callResponse: any, calleeSdp: any) {
        this.candidatesQueue.clearCandidatesQueue(this.socketId);

        function onError(callerReason: string | null, calleeReason: string) {
            if (pipeline) pipeline.release();
            if (caller) {
                var callerMessage = {
                    id: 'callResponse',
                    message: "",
                    response: 'rejected'
                }
                if (callerReason) callerMessage.message = callerReason;
                caller.sendMessage(callerMessage);
            }

            var calleeMessage = {
                id: 'stopCommunication',
                message: "",
            };

            if (calleeReason) calleeMessage.message = calleeReason;
            callee.sendMessage(calleeMessage);
        }

        var callee = this.userRegistry.getById(this.socketId);
        if (!from || !this.userRegistry.getByName(from)) {
            return onError(null, 'unknown from = ' + from);
        }
        var caller = this.userRegistry.getByName(from);

        if (callResponse === 'accept') {
            var pipeline = new CallMediaPipeline(this.kurento, this.userRegistry, this.candidatesQueue);
            pipelines[caller.id] = pipeline;
            pipelines[callee.id] = pipeline;

            await pipeline.createPipeline(caller.id, callee.id)
            const callerSdpAnswer = await pipeline.generateSdpAnswer(caller.id, caller.sdpOffer);
            const calleeSdpAnswer = await pipeline.generateSdpAnswer(callee.id, calleeSdp);

            let message = {
                id: 'startCommunication',
                response: '',
                sdpAnswer: calleeSdpAnswer
            };
            await callee.sendMessage(message);

            message = {
                id: 'callResponse',
                response: 'accepted',
                sdpAnswer: callerSdpAnswer
            };
            await caller.sendMessage(message);
        } else {
            const decline = {
                id: 'callResponse',
                response: 'rejected',
                message: 'user declined'
            };
            await caller.sendMessage(decline);
        }
    }

    stop() {
        if (!pipelines[this.socketId]) {
            return;
        }

        const pipeline = pipelines[this.socketId];
        delete pipelines[this.socketId];
        pipeline.release();
        const stopperUser = this.userRegistry.getById(this.socketId);
        const stoppedUser = this.userRegistry.getByName(stopperUser!.peer);
        stopperUser.peer = null;

        if (stoppedUser) {
            stoppedUser.peer = null;
            delete pipelines[stoppedUser.id];
            const message = {
                id: 'stopCommunication',
                message: 'remote user hanged out'
            }
            stoppedUser.sendMessage(message)
        }

        this.candidatesQueue.clearCandidatesQueue(this.socketId);
    }

    async onIceCandidate(_candidate: any) {
        const candidate = kurento.getComplexType('IceCandidate')(_candidate);
        const user = this.userRegistry.getById(this.socketId);

        if (pipelines[user.id] && pipelines[user.id].webRtcEndpoint && pipelines[user.id].webRtcEndpoint[user.id]) {
            var webRtcEndpoint = pipelines[user.id].webRtcEndpoint[user.id];
            await webRtcEndpoint.addIceCandidate(candidate);
        }
        else {
            if (!this.candidatesQueue.get(user.id)) {
                this.candidatesQueue.reset(user.id);
            }
            this.candidatesQueue.push(this.socketId, candidate);
        }
    }

}