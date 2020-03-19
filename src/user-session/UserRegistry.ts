import { Application } from "express";
import { UserSession } from "./UserSession";


export class UserRegistry {
    usersById: { [key: string]: UserSession } = {};
    usersByName: { [key: string]: UserSession } = {};

    constructor() {}

    register(user: UserSession) {
        this.usersById[user.id] = user;
        this.usersByName[user.name] = user;
    }

    unregister(id: string | number) {
        var user = this.getById(id);
        if (user) delete this.usersById[id]
        if (user && this.getByName(user.name)) delete this.usersByName[user.name];
    }

    getById(id: string | number) {
        return this.usersById[id];
    }

    getByName(name: string | number) {
        return this.usersByName[name];
    }

    removeById(id: string | number) {
        var userSession = this.usersById[id];
        if (!userSession) return;
        delete this.usersById[id];
        delete this.usersByName[userSession.name];
    }
}
