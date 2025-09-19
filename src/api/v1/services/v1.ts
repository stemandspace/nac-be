/**
 * v1 service
 */

import { factories } from '@strapi/strapi';
import {
    isEmailRegisteredInCosmicKids,
    createCosmicKidsAccount,
    addUserAddons
} from '../utils/cosmic-kids';
import {
    sendZeptoMailBatch,
    sendWhatsAppMessage,
    sendEmailNotification,
    sendWhatsAppNotification,
    type ZeptoMailRecipient,
    type ZeptoMailResponse,
    type Student,
    type WhatsAppParameters
} from '../utils/notifications';

const v1Service = factories.createCoreService('api::v1.v1', ({ strapi }) => ({
    /**
     * Checks if an email is registered in the external Cosmic Kids system.
     * @param {string} email - The email address to check.
     * @returns {Promise<{ registered: boolean, userId?: number }>} - Registration status and user id if found.
     */
    async isEmailRegisteredInCosmicKids(email: string) {
        return await isEmailRegisteredInCosmicKids(email);
    },

    /**
     * Creates a new account in the Cosmic Kids Club system.
     * @param {Object} params - The registration parameters.
     * @param {string} params.username - The username for the new account.
     * @param {string} params.email - The email for the new account.
     * @param {string} params.password - The password for the new account.
     * @returns {Promise<Object>} - The response from the Cosmic Kids Club API.
     */
    async createCosmicKidsAccount({ username, email, password }: {
        username: string;
        email: string;
        password: string;
    }) {
        return await createCosmicKidsAccount({ username, email, password });
    },

    /**
     * Sends a batch of emails using ZeptoMail API
     * @param {ZeptoMailRecipient[]} recipients - Array of email recipients
     * @returns {Promise<ZeptoMailResponse>} - Response from ZeptoMail API
     */
    async sendZeptoMailBatch(recipients: ZeptoMailRecipient[]): Promise<ZeptoMailResponse> {
        return await sendZeptoMailBatch(recipients);
    },

    /**
     * Adds addons to a user's account in the Cosmic Kids Club system.
     * @param {Object} params - The addon parameters.
     * @param {number} params.userId - The user ID in the Cosmic Kids system.
     * @param {Object} params.addons - The addon details.
     * @param {string} params.addons.type - The type of addon.
     * @param {number} params.addons.amount - The amount paid for the addon.
     * @param {number} params.addons.credits - The number of credits to add.
     * @returns {Promise<Object>} - The response from the Cosmic Kids Club API.
     */
    async addUserAddons({ userId, addons }: {
        userId: number;
        addons: {
            type: string;
            amount: number;
            credits: number;
        };
    }) {
        return await addUserAddons({ userId, addons });
    },

    /**
     * Sends a WhatsApp message using Ulgebra webhook
     * @param {Object} params - WhatsApp message parameters
     * @param {string} params.templateId - WhatsApp template ID
     * @param {string} params.mobileNumber - Mobile number to send to
     * @param {Array} params.parameters - Template parameters
     * @returns {Promise<Object>} - Response from Ulgebra webhook
     */
    async sendWhatsAppMessage({ templateId, mobileNumber, parameters }: {
        templateId: string;
        mobileNumber: string;
        parameters: Array<{ type: string, text: string }>;
    }) {
        return await sendWhatsAppMessage({ templateId, mobileNumber, parameters });
    },

    /**
     * Send email notification only
     * @param {Student} student - Student data
     * @param {string} addon_title - Addon title
     * @param {string} password - Password for the account
     * @returns {Promise<boolean>} - True if email sent successfully, false otherwise
     */
    async sendEmailNotification(student: Student, addon_title: string, password: string): Promise<boolean> {
        return await sendEmailNotification(student, addon_title, password);
    },

    /**
     * Send WhatsApp notification only
     * @param {Student} student - Student data
     * @param {WhatsAppParameters} whatsappParams - WhatsApp template and parameters
     * @returns {Promise<boolean>} - True if WhatsApp sent successfully, false otherwise
     */
    async sendWhatsAppNotification(student: Student, whatsappParams: WhatsAppParameters): Promise<boolean> {
        return await sendWhatsAppNotification(student, whatsappParams);
    }
}));

export default v1Service;