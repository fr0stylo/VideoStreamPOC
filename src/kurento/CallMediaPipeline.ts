import kurento from 'kurento-client';
import { UserRegistry } from '../user-session/UserRegistry';
import { CandidatesQueue } from './CadidatesQueue';

export class CallMediaPipeline {
    pipeline: any = null;
    webRtcEndpoint: any = {};

    constructor(private kurentoClient: any, private userRegistry: UserRegistry, private candidatesQueue: CandidatesQueue) { }

    async createPipeline(callerId: string | number, calleeId: string | number) {
        const pipeline = await this.kurentoClient.create('MediaPipeline');//, (error: any, pipeline: { create: (arg0: string, arg1: { (error: any, callerWebRtcEndpoint: any): any; (error: any, calleeWebRtcEndpoint: any): any; }) => void; release: () => void; }) => {
        const callerWebRtcEndpoint = await pipeline.create('WebRtcEndpoint');//, (error: any, callerWebRtcEndpoint: { addIceCandidate: (arg0: any) => void; on: (arg0: string, arg1: (event: any) => void) => void; connect: (arg0: any, arg1: (error: any) => any) => void; }) => {

        if (this.candidatesQueue.get(callerId)) {
            while (this.candidatesQueue.get(callerId).length) {
                const candidate = this.candidatesQueue.get(callerId).shift();
                await callerWebRtcEndpoint.addIceCandidate(candidate);
            }
        }

        callerWebRtcEndpoint.on('OnIceCandidate', async (event: { candidate: any; }) => {
            const candidate = await kurento.getComplexType('IceCandidate')(event.candidate);
            this.userRegistry.getById(callerId).ws.emit('iceCandidate', {
                candidate: candidate
            });
        });

        const calleeWebRtcEndpoint = await pipeline.create('WebRtcEndpoint')//, (error: any, calleeWebRtcEndpoint: { addIceCandidate: (arg0: any) => void; on: (arg0: string, arg1: (event: any) => void) => void; connect: (arg0: any, arg1: (error: any) => any) => void; }) => {
        if (this.candidatesQueue.get(calleeId)) {
            while (this.candidatesQueue.get(calleeId).length) {
                const candidate = this.candidatesQueue.get(calleeId).shift();
                await calleeWebRtcEndpoint.addIceCandidate(candidate);
            }
        }

        calleeWebRtcEndpoint.on('OnIceCandidate', async (event: { candidate: any; }) => {
            const candidate = await kurento.getComplexType('IceCandidate')(event.candidate);
            this.userRegistry.getById(calleeId).ws.emit('iceCandidate', {
                candidate: candidate
            });
        });

        await callerWebRtcEndpoint.connect(calleeWebRtcEndpoint);
        await calleeWebRtcEndpoint.connect(callerWebRtcEndpoint);

        this.pipeline = pipeline;
        this.webRtcEndpoint[callerId] = callerWebRtcEndpoint;
        this.webRtcEndpoint[calleeId] = calleeWebRtcEndpoint;
        const recorder = await this.pipeline.create('RecorderEndpoint', { uri: "file:///tmp/temp.webm" });
        await recorder.record();
    }

    async generateSdpAnswer(id: string | number, sdpOffer: any) {
        const answer = await this.webRtcEndpoint[id].processOffer(sdpOffer);
        await this.webRtcEndpoint[id].gatherCandidates();

        return answer;
    }

    release() {
        if (this.pipeline) {
            this.pipeline.release();
        }
        this.pipeline = null;
    }
}

