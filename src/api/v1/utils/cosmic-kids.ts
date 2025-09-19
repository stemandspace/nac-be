/**
 * Cosmic Kids Club integration utility functions
 */

import axios from 'axios';

const COSMIC_KIDS_API_BASE = 'https://api.cosmickids.club/api';

/**
 * Checks if an email is registered in the external Cosmic Kids system.
 * @param {string} email - The email address to check.
 * @returns {Promise<{ registered: boolean, userId?: number }>} - Registration status and user id if found.
 */
export async function isEmailRegisteredInCosmicKids(email: string) {
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
        console.error('Error checking email in Cosmic Kids:', error);
        throw new Error('Failed to check email registration status');
    }
}

/**
 * Creates a new account in the Cosmic Kids Club system.
 * @param {Object} params - The registration parameters.
 * @param {string} params.username - The username for the new account.
 * @param {string} params.email - The email for the new account.
 * @param {string} params.password - The password for the new account.
 * @returns {Promise<Object>} - The response from the Cosmic Kids Club API.
 */
export async function createCosmicKidsAccount({ username, email, password }: {
    username: string;
    email: string;
    password: string;
}) {
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
        console.error('Error creating account in Cosmic Kids:', error?.response?.data || error.message);
        throw new Error('Failed to create account in Cosmic Kids Club');
    }
}

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
export async function addUserAddons({ userId, addons }: {
    userId: number;
    addons: {
        type: string;
        amount: number;
        credits: number;
    };
}) {
    if (!userId || !addons) {
        throw new Error('User ID and addons are required');
    }
    try {
        const url = `${COSMIC_KIDS_API_BASE}/addons`;
        const payload = {
            userId,
            addons
        };
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error adding addons to user:', error?.response?.data || error.message);
        throw new Error('Failed to add addons to user account');
    }
}
