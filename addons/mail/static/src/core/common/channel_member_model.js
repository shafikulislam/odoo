/* @odoo-module */

import { Record } from "@mail/core/common/record";
import { createLocalId } from "@mail/utils/common/misc";

/**
 * @class ChannelMember
 * @typedef Data
 * @property {number} id
 * @property {string} personaLocalId
 * @property {number} threadId
 */
export class ChannelMember extends Record {
    /** @type {number} */
    id;
    personaLocalId;
    rtcSessionId;
    threadId;
    /** @type {import("@mail/core/common/store_service").Store} */
    _store;

    get persona() {
        return this._store.Persona.records[this.personaLocalId];
    }

    set persona(persona) {
        this.personaLocalId = persona?.localId;
    }

    get rtcSession() {
        return this._store.RtcSession.records[this.rtcSessionId];
    }

    get thread() {
        return this._store.Thread.records[createLocalId("discuss.channel", this.threadId)];
    }

    /**
     * @returns {string}
     */
    getLangName() {
        return this.persona.lang_name;
    }
}
