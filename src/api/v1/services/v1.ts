/**
 * v1 service
 */

import { factories } from '@strapi/strapi';
import axios from 'axios';

// Type definitions
interface ZeptoMailRecipient {
    address: string;
    name: string;
    merge_info: {
        password: string;
        grade: string;
        name: string;
        email: string;
        addon: string;
    };
}

interface ZeptoMailResponse {
    message: string;
    success: boolean;
    data?: any;
    error?: string;
}

interface Student {
    email: string;
    name: string;
    grade: string;
    phone?: string;
    [key: string]: any;
}

interface NotificationResult {
    mail_sent: boolean;
    wa_sent: boolean;
}

interface WhatsAppParameters {
    templateId: string;
    parameters: Array<{ type: string, text: string }>;
}

const COSMIC_KIDS_API_BASE = 'https://api.cosmickids.club/api';
const ZEPTO_MAIL_API_URL = 'https://api.zeptomail.in/v1.1/email/template/batch';
const ZEPTO_MAIL_API_KEY = process.env.ZEPTO_MAIL_API_KEY;
const ZEPTO_MAIL_TEMPLATE_KEY = '2518b.5ca07f11c3f3c129.k1.71ca9510-7de5-11f0-8e5b-525400c92439.198c86170e1';
const ULGEBRA_WEBHOOK_URL = 'https://api.ulgebra.com/v1/workflows?extensionName=whatsappforspreadsheet';
const ULGEBRA_WEBHOOK_AUTHTOKEN = process.env.ULGEBRA_WEBHOOK_AUTHTOKEN;

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
     * @param {ZeptoMailRecipient[]} recipients - Array of recipient objects.
     * @returns {Promise<ZeptoMailResponse>} - The response from ZeptoMail API.
     */
    async sendZeptoMailBatch(recipients: ZeptoMailRecipient[]): Promise<ZeptoMailResponse> {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new Error('Recipients array is required');
        }

        // Validate recipient data
        for (const recipient of recipients) {
            if (!recipient.address || !recipient.name || !recipient.merge_info) {
                throw new Error('Each recipient must have address, name, and merge_info');
            }
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
                },
                timeout: 30000 // 30 second timeout
            });

            // Check if response is successful
            if (response.status >= 200 && response.status < 300) {
                return {
                    message: response.data?.message || "OK",
                    success: true,
                    data: response.data
                };
            } else {
                strapi.log.error('ZeptoMail API returned non-success status:', response.status, response.data);
                return {
                    message: `API returned status ${response.status}`,
                    success: false,
                    data: response.data
                };
            }
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error.message || 'Unknown error';
            const errorStatus = error?.response?.status || 'Unknown';

            strapi.log.error('Error sending ZeptoMail batch email:', {
                status: errorStatus,
                message: errorMessage,
                data: error?.response?.data
            });

            return {
                message: `Failed to send email: ${errorMessage}`,
                success: false,
                error: errorMessage
            };
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
    },

    /**
     * Sends a WhatsApp message using Ulgebra workflow API.
     * @param {Object} params - The WhatsApp message parameters.
     * @param {string} params.templateId - The WhatsApp template ID to use.
     * @param {string} params.mobileNumber - The recipient's mobile number (with country code).
     * @param {Array<{type: string, text: string}>} params.parameters - Array of template parameters.
     * @returns {Promise<Object>} - The response from the Ulgebra API.
     */
    async sendWhatsAppMessage({ templateId, mobileNumber, parameters }: {
        templateId: string,
        mobileNumber: string,
        parameters: Array<{ type: string, text: string }>
    }) {
        if (!templateId || !mobileNumber || !parameters || !Array.isArray(parameters)) {
            throw new Error('Template ID, mobile number, and parameters array are required');
        }

        // Ensure mobile number has proper format
        const formattedMobileNumber = mobileNumber.startsWith('+') ? mobileNumber : `+${mobileNumber}`;

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            whatsAppSenderID: "133634283159197",
            to: formattedMobileNumber,
            type: "template",
            source: {
                type: "uaapp-workflow",
                email: "school@stemandspace.com",
                name: "School",
                id: "HUtwpkaYCXUbMF1ip2AynrUpj9T2",
                pic: "https://lh3.googleusercontent.com/a/ACg8ocLMYMfcimGoZJXpaTECZQbIEvD4xvOY_ej4BowWDD8u=s96-c",
                uaApp: "whatsappforspreadsheet",
                uaAppSaaSOrgID: "HUtwpkaYCXUbMF1ip2AynrUpj9T2",
                uaAppSaaSUserId: "HUtwpkaYCXUbMF1ip2AynrUpj9T2"
            },
            template: {
                name: templateId,
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: parameters
                    }
                ]
            },
            from: "919560554900",
            module: "excel",
            recordId: "FILL_HERE",
            channel: "WhatsApp",
            default_country_code: "91",
            ulgebra_webhook_authtoken: ULGEBRA_WEBHOOK_AUTHTOKEN
        };

        console.log("payload", JSON.stringify(payload, null, 2));

        try {
            const response = await axios.post(ULGEBRA_WEBHOOK_URL, payload, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            strapi.log.error('Error sending WhatsApp message:', error?.response?.data || error.message);
            throw new Error('Failed to send WhatsApp message');
        }
    },

    /**
     * Unified notification service that sends both email and WhatsApp notifications
     * This service is designed to be non-blocking and will never throw errors that could stop the registration flow
     * @param {Student} student - Student data
     * @param {string} addon_title - Addon title
     * @param {string} password - Password for the account
     * @param {WhatsAppParameters} whatsappParams - WhatsApp template and parameters (optional)
     * @returns {Promise<NotificationResult>} - Result of all notification attempts
     */
    async sendRegistrationNotifications(student: Student, addon_title: string, password: string, whatsappParams?: WhatsAppParameters): Promise<NotificationResult> {
        const result: NotificationResult = {
            mail_sent: false,
            wa_sent: false
        };

        // Send email notification (non-blocking)
        await this._sendEmailNotification(student, addon_title, password, result);

        // Send WhatsApp notification (non-blocking)
        await this._sendWhatsAppNotification(student, whatsappParams, result);

        strapi.log.info('Notification service completed:', {
            student_email: student.email,
            mail_sent: result.mail_sent,
            wa_sent: result.wa_sent
        });

        return result;
    },

    /**
     * Helper method to send email notification with error handling
     * @private
     */
    async _sendEmailNotification(student: Student, addon_title: string, password: string, result: NotificationResult): Promise<void> {
        try {
            if (!student.email || !student.name || !student.grade) {
                strapi.log.warn('Email notification skipped: Missing required fields', {
                    student: { email: student.email, name: student.name, grade: student.grade }
                });
                return;
            }

            const emailResult = await this.sendZeptoMailBatch([{
                address: student.email,
                name: student.name,
                merge_info: {
                    password: password,
                    grade: student.grade,
                    name: student.name,
                    email: student.email,
                    addon: addon_title
                }
            },
            {
                address: "ckc@stemandspace.com",
                name: "School Registration",
                merge_info: {
                    password: password,
                    grade: student.grade,
                    name: student.name,
                    email: student.email,
                    addon: addon_title
                }
            }]);

            result.mail_sent = emailResult.success;
        } catch (error) {
            strapi.log.error('Email notification failed:', error);
        }
    },

    /**
     * Helper method to send WhatsApp notification with error handling
     * @private
     */
    async _sendWhatsAppNotification(student: Student, whatsappParams: WhatsAppParameters | undefined, result: NotificationResult): Promise<void> {
        try {
            if (!whatsappParams) {
                strapi.log.warn('WhatsApp notification skipped: WhatsApp parameters not provided');
                return;
            }

            if (!student.phone) {
                strapi.log.warn('WhatsApp notification skipped: Phone number not available');
                return;
            }

            const whatsappResult = await this.sendWhatsAppMessage({
                templateId: whatsappParams.templateId,
                mobileNumber: student.phone,
                parameters: whatsappParams.parameters
            });

            result.wa_sent = true;
        } catch (error) {
            strapi.log.error('WhatsApp notification failed:', error);
        }
    }
}));

export default v1Service;
