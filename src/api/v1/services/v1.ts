/**
 * v1 service
 */

import { factories } from '@strapi/strapi';
import axios from 'axios';

const COSMIC_KIDS_API_BASE = 'https://api.cosmickids.club/api';
const ZEPTO_MAIL_API_URL = 'https://api.zeptomail.in/v1.1/email/template/batch';
const ZEPTO_MAIL_API_KEY = 'PHtE6r0PQe++iWMt80VStKSxQMWhZ94nru40f1FC491HAvMHFk1Vq9gslTGzrB0sVaJGF/GTzoxgtuud4ujRd2u7YW9IDWqyqK3sx/VYSPOZsbq6x00csF4dck3aXIXsdddq0CTUvtzeNA==';
const ZEPTO_MAIL_TEMPLATE_KEY = '2518b.5ca07f11c3f3c129.k1.71ca9510-7de5-11f0-8e5b-525400c92439.198c86170e1';

const v1Service = factories.createCoreService('api::v1.v1', ({ strapi }) => ({
    /**
     * Checks if an email is registered in the external Cosmic Kids system.
     * @param {string} email - The email address to check.
     * @returns {Promise<{ registered: boolean, userId?: number }>} - Registration status and user id if found.
     */
    async isEmailRegisteredInCosmicKids(email) {
        if (!email) {
            throw new Error('Email is required');
        }
        try {
            const url = `${COSMIC_KIDS_API_BASE}/users?filters[email][$eq]=${encodeURIComponent(email)}&fields[0]=id`;
            const response = await axios.get(url);
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                return { registered: true, userId: response.data[0].id };
            }
            return { registered: false };
        } catch (error) {
            strapi.log.error('Error checking email in Cosmic Kids:', error);
            throw new Error('Failed to check email registration status');
        }
    },

    /**
     * Creates a new account in the Cosmic Kids Club system.
     * @param {Object} params - The registration parameters.
     * @param {string} params.username - The username for the new account.
     * @param {string} params.email - The email for the new account.
     * @param {string} params.password - The password for the new account.
     * @returns {Promise<Object>} - The response from the Cosmic Kids Club API.
     */
    async createCosmicKidsAccount({ username, email, password }) {
        if (!username || !email || !password) {
            throw new Error('Username, email, and password are required');
        }
        try {
            const url = `${COSMIC_KIDS_API_BASE}/auth/local/register`;
            const payload = {
                username,
                email,
                password
            };
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            strapi.log.error('Error creating account in Cosmic Kids:', error?.response?.data || error.message);
            throw new Error('Failed to create account in Cosmic Kids Club');
        }
    },

    /**
     * Sends an email using ZeptoMail template batch API.
     * @param {Array<{
     *   address: string,
     *   name: string,
     *   merge_info: {
     *     password: string,
     *     grade: string,
     *     name: string,
     *     email: string,
     *     addon: string
     *   }
     * }>} recipients - Array of recipient objects.
     * @returns {Promise<Object>} - The response from ZeptoMail API.
     */
    async sendZeptoMailBatch(recipients) {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new Error('Recipients array is required');
        }

        const to = recipients.map(recipient => ({
            email_address: {
                address: recipient.address,
                name: recipient.name
            },
            merge_info: recipient.merge_info
        }));

        const payload = {
            mail_template_key: ZEPTO_MAIL_TEMPLATE_KEY,
            from: {
                address: "noreply@spacetopia.in",
                name: "noreply"
            },
            to
        };

        try {
            const response = await axios.post(ZEPTO_MAIL_API_URL, payload, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Zoho-enczapikey ${ZEPTO_MAIL_API_KEY}`
                }
            });
            return response.data;
        } catch (error) {
            strapi.log.error('Error sending ZeptoMail batch email:', error?.response?.data || error.message);
            throw new Error('Failed to send ZeptoMail batch email');
        }
    },

    /**
     * Adds addons to a user's account in the Cosmic Kids system.
     * @param {Object} params - The addon parameters.
     * @param {number} params.userId - The user ID to add addons to.
     * @param {Object} params.addons - The addon details.
     * @param {string} params.addons.type - The type of addon (e.g., "premium").
     * @param {number} params.addons.amount - The amount for the addon.
     * @param {number} params.addons.credits - The number of credits to add.
     * @returns {Promise<Object>} - The response from the Cosmic Kids Club API.
     */
    async addUserAddons({ userId, addons }: {
        userId: number,
        addons: {
            type: "credits" | "basic" | "premium",
            amount: number,
            credits: number
        }
    }) {
        if (!userId || !addons) {
            throw new Error('UserId and addons are required');
        }

        if (!addons.type || !addons.amount || !addons.credits) {
            throw new Error('Addon type, amount, and credits are required');
        }

        try {
            const url = `${COSMIC_KIDS_API_BASE}/v1/user/addons`;
            const payload = {
                userId,
                addons: {
                    type: addons.type,
                    amount: addons.amount,
                    credits: addons.credits
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Zoho-enczapikey ${ZEPTO_MAIL_API_KEY}`
                }
            });
            return response.data;
        } catch (error) {
            strapi.log.error('Error adding user addons in Cosmic Kids:', error?.response?.data || error.message);
            throw new Error('Failed to add user addons in Cosmic Kids Club');
        }
    }
}));

export default v1Service;
