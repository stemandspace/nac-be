/**
 * Notification utility functions for email and WhatsApp
 */

import axios from 'axios';

// Type definitions
export interface ZeptoMailRecipient {
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

export interface ZeptoMailResponse {
    message: string;
    success: boolean;
    data?: any;
    error?: string;
}

export interface Student {
    email: string;
    name: string;
    grade: string;
    phone?: string;
    [key: string]: any;
}

export interface WhatsAppParameters {
    templateId: string;
    parameters: Array<{ type: string, text: string }>;
}

// Constants
const ZEPTO_MAIL_API_URL = 'https://api.zeptomail.in/v1.1/email/template/batch';
const ZEPTO_MAIL_API_KEY = 'PHtE6r0PQe++iWMt80VStKSxQMWhZ94nru40f1FC491HAvMHFk1Vq9gslTGzrB0sVaJGF/GTzoxgtuud4ujRd2u7YW9IDWqyqK3sx/VYSPOZsbq6x00csF4dck3aXIXsdddq0CTUvtzeNA==';
const ZEPTO_MAIL_TEMPLATE_KEY = '2518b.5ca07f11c3f3c129.k1.71ca9510-7de5-11f0-8e5b-525400c92439.198c86170e1';
const ULGEBRA_WEBHOOK_URL = 'https://api.ulgebra.com/v1/workflows?extensionName=whatsappforspreadsheet';
const ULGEBRA_WEBHOOK_AUTHTOKEN = '';

/**
 * Sends a batch of emails using ZeptoMail API
 * @param {ZeptoMailRecipient[]} recipients - Array of email recipients
 * @returns {Promise<ZeptoMailResponse>} - Response from ZeptoMail API
 */
export async function sendZeptoMailBatch(recipients: ZeptoMailRecipient[]): Promise<ZeptoMailResponse> {
    if (!recipients || recipients.length === 0) {
        throw new Error('Recipients array is required and cannot be empty');
    }

    try {
        const payload = {
            from: {
                address: "noreply@spacetopia.in",
                name: "NAC25 Registration"
            },
            to: recipients,
            template_key: ZEPTO_MAIL_TEMPLATE_KEY,
            subject: "Welcome to NAC25 - Your Registration is Complete!"
        };

        const response = await axios.post(ZEPTO_MAIL_API_URL, payload, {
            headers: {
                'Authorization': `Zoho-enczapikey ${ZEPTO_MAIL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error sending ZeptoMail batch:', error?.response?.data || error.message);
        throw new Error('Failed to send email batch');
    }
}

/**
 * Sends a WhatsApp message using Ulgebra webhook
 * @param {Object} params - WhatsApp message parameters
 * @param {string} params.templateId - WhatsApp template ID
 * @param {string} params.mobileNumber - Mobile number to send to
 * @param {Array} params.parameters - Template parameters
 * @returns {Promise<Object>} - Response from Ulgebra webhook
 */
export async function sendWhatsAppMessage({ templateId, mobileNumber, parameters }: {
    templateId: string;
    mobileNumber: string;
    parameters: Array<{ type: string, text: string }>;
}) {
    if (!templateId || !mobileNumber || !parameters) {
        throw new Error('Template ID, mobile number, and parameters are required');
    }

    // Check if auth token is configured
    if (!ULGEBRA_WEBHOOK_AUTHTOKEN) {
        console.warn('WhatsApp notification skipped: ULGEBRA_WEBHOOK_AUTHTOKEN not configured');
        return { success: false, message: 'WhatsApp auth token not configured' };
    }

    try {
        const payload = {
            templateId,
            mobileNumber,
            parameters
        };

        console.log('Sending WhatsApp message with payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(ULGEBRA_WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ULGEBRA_WEBHOOK_AUTHTOKEN}`
            }
        });

        console.log('WhatsApp API response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', {
            error: error?.response?.data || error.message,
            status: error?.response?.status,
            url: ULGEBRA_WEBHOOK_URL
        });
        throw new Error('Failed to send WhatsApp message');
    }
}

/**
 * Send email notification only
 * @param {Student} student - Student data
 * @param {string} addon_title - Addon title
 * @param {string} password - Password for the account
 * @returns {Promise<boolean>} - True if email sent successfully, false otherwise
 */
export async function sendEmailNotification(student: Student, addon_title: string, password: string): Promise<boolean> {
    try {
        if (!student.email || !student.name || !student.grade) {
            console.warn('Email notification skipped: Missing required fields', {
                student: { email: student.email, name: student.name, grade: student.grade }
            });
            return false;
        }

        console.log('Sending email notification to:', student.email);

        const emailResult = await sendZeptoMailBatch([{
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

        console.log('Email notification result:', emailResult);
        return emailResult.success;
    } catch (error) {
        console.error('Email notification service failed:', error);
        return false;
    }
}

/**
 * Send WhatsApp notification only
 * @param {Student} student - Student data
 * @param {WhatsAppParameters} whatsappParams - WhatsApp template and parameters
 * @returns {Promise<boolean>} - True if WhatsApp sent successfully, false otherwise
 */
export async function sendWhatsAppNotification(student: Student, whatsappParams: WhatsAppParameters): Promise<boolean> {
    try {
        if (!whatsappParams) {
            console.warn('WhatsApp notification skipped: WhatsApp parameters not provided');
            return false;
        }

        if (!student.phone) {
            console.warn('WhatsApp notification skipped: Phone number not available');
            return false;
        }

        await sendWhatsAppMessage({
            templateId: whatsappParams.templateId,
            mobileNumber: student.phone,
            parameters: whatsappParams.parameters
        });

        return true;
    } catch (error) {
        console.error('WhatsApp notification service failed:', error);
        return false;
    }
}
