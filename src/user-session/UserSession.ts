import { Socket } from "socket.io";

export class UserSession {
    public peer: any;
    public sdpOffer: any;

    constructor(
        public id: string,
        public name: string,
        public ws: Socket,
    ) {

    }

    sendMessage(message: any) {
        this.ws.emit(message.id, message);
    }


    sendTo(to: string, message: any) {
        this.ws.to(to).emit(message.id, message);
    }
}