import kurento from 'kurento-client';
import { UserRegistry } from '../user-session/UserRegistry';
import { CandidatesQueue } from './CadidatesQueue';

export class CallMediaPipeline {
    pipeline: any = null;
    webRtcEndpoint: any = {};

    constructor(private kurentoClient: any, private userRegistry: UserRegistry, private candidatesQueue: CandidatesQueue) { }

    createPipeline(callerId: string | number, calleeId: string | number, ws: any, callback: (arg0: null) => void) {
        this.kurentoClient.create('MediaPipeline', (error: any, pipeline: { create: (arg0: string, arg1: { (error: any, callerWebRtcEndpoint: any): any; (error: any, calleeWebRtcEndpoint: any): any; }) => void; release: () => void; }) => {
            if (error) {
                return callback(error);
            }

            pipeline.create('WebRtcEndpoint', (error: any, callerWebRtcEndpoint: { addIceCandidate: (arg0: any) => void; on: (arg0: string, arg1: (event: any) => void) => void; connect: (arg0: any, arg1: (error: any) => any) => void; }) => {
                if (error) {
                    pipeline.release();
                    return callback(error);
                }

                if (this.candidatesQueue.get(callerId)) {
                    while (this.candidatesQueue.get(callerId).length) {
                        var candidate = this.candidatesQueue.get(callerId).shift();
                        callerWebRtcEndpoint.addIceCandidate(candidate);
                    }
                }

                callerWebRtcEndpoint.on('OnIceCandidate', (event: { candidate: any; }) => {
                    var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                    this.userRegistry.getById(callerId).ws.emit('iceCandidate', {
                        candidate: candidate
                    });
                });

                pipeline.create('WebRtcEndpoint', (error: any, calleeWebRtcEndpoint: { addIceCandidate: (arg0: any) => void; on: (arg0: string, arg1: (event: any) => void) => void; connect: (arg0: any, arg1: (error: any) => any) => void; }) => {
                    if (error) {
                        pipeline.release();
                        return callback(error);
                    }

                    if (this.candidatesQueue.get(calleeId)) {
                        while (this.candidatesQueue.get(calleeId).length) {
                            var candidate = this.candidatesQueue.get(calleeId).shift();
                            calleeWebRtcEndpoint.addIceCandidate(candidate);
                        }
                    }

                    calleeWebRtcEndpoint.on('OnIceCandidate', (event: { candidate: any; }) => {
                        var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                        this.userRegistry.getById(calleeId).ws.emit('iceCandidate', {
                            candidate: candidate
                        });
                    });

                    callerWebRtcEndpoint.connect(calleeWebRtcEndpoint, (error: any) => {
                        if (error) {
                            pipeline.release();
                            return callback(error);
                        }

                        calleeWebRtcEndpoint.connect(callerWebRtcEndpoint, (error: any) => {
                            if (error) {
                                pipeline.release();
                                return callback(error);
                            }
                        });

                        this.pipeline = pipeline;
                        this.webRtcEndpoint[callerId] = callerWebRtcEndpoint;
                        this.webRtcEndpoint[calleeId] = calleeWebRtcEndpoint;
                        const recorder = this.pipeline.create('RecorderEndpoint', { uri: "file:///tmp/temp.webm" });

                        recorder.record();
                        callback(null);
                    });
                });
            });
        });
    }

    generateSdpAnswer(id: string | number, sdpOffer: any, callback: (arg0: any) => any) {
        this.webRtcEndpoint[id].processOffer(sdpOffer, callback);
        this.webRtcEndpoint[id].gatherCandidates(function (error: any) {
            if (error) {
                return callback(error);
            }
        });
    }

    release() {
        if (this.pipeline) {
            this.pipeline.release();
        }
        this.pipeline = null;
    }
}

