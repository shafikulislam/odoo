/* @odoo-module */

import { LinkPreview } from "@mail/core/common/link_preview_model";
import { removeFromArrayWithPredicate } from "@mail/utils/common/arrays";

import { markup, reactive } from "@odoo/owl";

import { registry } from "@web/core/registry";

export class MailCoreCommon {
    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {Partial<import("services").Services>} services
     */
    constructor(env, services) {
        this.env = env;
        this.busService = services.bus_service;
        this.attachmentService = services["mail.attachment"];
        this.messageService = services["mail.message"];
        this.messagingService = services["mail.messaging"];
        this.personaService = services["mail.persona"];
        this.store = services["mail.store"];
        this.threadService = services["mail.thread"];
        this.userSettingsService = services["mail.user_settings"];
    }

    setup() {
        this.messagingService.isReady.then(() => {
            this.busService.subscribe("ir.attachment/delete", (payload) => {
                const { id: attachmentId, message: messageData } = payload;
                if (messageData) {
                    this.messageService.insert({ ...messageData });
                }
                const attachment = this.store.Attachment.records[attachmentId];
                if (attachment) {
                    this.attachmentService.remove(attachment);
                }
            });
            this.busService.subscribe("mail.link.preview/delete", (payload) => {
                const { id, message_id } = payload;
                const message = this.store.Message.records[message_id];
                if (message) {
                    removeFromArrayWithPredicate(
                        message.linkPreviews,
                        (linkPreview) => linkPreview.id === id
                    );
                }
            });
            this.busService.subscribe("mail.message/delete", (payload) => {
                for (const messageId of payload.message_ids) {
                    const message = this.store.Message.records[messageId];
                    if (!message) {
                        continue;
                    }
                    delete this.store.Message.records[messageId];
                    if (message.originThread) {
                        removeFromArrayWithPredicate(message.originThread.messages, (msg) =>
                            msg.eq(message)
                        );
                    }
                    this.env.bus.trigger("mail.message/delete", { message });
                }
            });
            this.busService.subscribe("mail.message/notification_update", (payload) => {
                payload.elements.map((message) => {
                    this.messageService.insert({
                        ...message,
                        body: markup(message.body),
                        // implicit: failures are sent by the server at
                        // initialization only if the current partner is
                        // author of the message
                        author: this.store.self,
                    });
                });
            });
            this.busService.subscribe("mail.message/toggle_star", (payload) => {
                const { message_ids: messageIds, starred } = payload;
                for (const messageId of messageIds) {
                    const message = this.messageService.insert({ id: messageId });
                    this.messageService.updateStarred(message, starred);
                }
            });
            this.busService.subscribe("mail.record/insert", (payload) => {
                if (payload.Thread) {
                    this.threadService.insert(payload.Thread);
                }
                if (payload.Partner) {
                    const partners = Array.isArray(payload.Partner)
                        ? payload.Partner
                        : [payload.Partner];
                    for (const partner of partners) {
                        if (partner.im_status) {
                            this.personaService.insert({ ...partner, type: "partner" });
                        }
                    }
                }
                if (payload.Guest) {
                    const guests = Array.isArray(payload.Guest) ? payload.Guest : [payload.Guest];
                    for (const guest of guests) {
                        this.personaService.insert({ ...guest, type: "guest" });
                    }
                }
                const { LinkPreview: linkPreviews } = payload;
                if (linkPreviews) {
                    for (const linkPreview of linkPreviews) {
                        this.store.Message.records[linkPreview.message.id]?.linkPreviews.push(
                            new LinkPreview(linkPreview)
                        );
                    }
                }
                const { Message: messageData } = payload;
                if (messageData) {
                    const isStarred = this.store.Message.records[messageData.id]?.isStarred;
                    const message = this.messageService.insert({
                        ...messageData,
                        body: messageData.body ? markup(messageData.body) : messageData.body,
                    });
                    if (isStarred && message.isEmpty) {
                        this.messageService.updateStarred(message, false);
                    }
                }
                const { "res.users.settings": settings } = payload;
                if (settings) {
                    this.userSettingsService.updateFromCommands(settings);
                }
            });
        });
    }
}

export const mailCoreCommon = {
    dependencies: [
        "bus_service",
        "mail.attachment",
        "mail.message",
        "mail.messaging",
        "mail.persona",
        "mail.store",
        "mail.thread",
        "mail.user_settings",
    ],
    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {Partial<import("services").Services>} services
     */
    start(env, services) {
        const mailCoreCommon = reactive(new MailCoreCommon(env, services));
        mailCoreCommon.setup();
        return mailCoreCommon;
    },
};

registry.category("services").add("mail.core.common", mailCoreCommon);
