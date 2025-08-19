/**
 * v1 controller
 */

import { factories } from '@strapi/strapi'
import Razorpay from 'razorpay';
import crypto from 'crypto';

export default factories.createCoreController('api::v1.v1', ({ strapi }) => ({
    async saveDraftAndCreateOrder(ctx) {
        try {
            const { data, selectedAddon } = ctx.request.body;
            // Basic validat ion: check if data exists and required fields are present
            if (!data) {
                ctx.throw(400, 'Missing data in request body');
            }
            const requiredFields = ['name', 'email', 'phone', 'dob', 'school_name', 'grade', 'section', 'city'];
            const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field) || data[field] === undefined || data[field] === null || data[field] === '');
            if (missingFields.length > 0) {
                ctx.throw(400, `Missing required fields: ${missingFields.join(', ')}`);
            }

            // Create student as draft (not published yet)
            const studentData = {
                ...data,
                publishedAt: null, // This keeps it as draft
                payment_status: 'pending',
                selected_addon: selectedAddon,
                order_amount: selectedAddon ? (data.is_overseas ? selectedAddon.price * 100 : selectedAddon.priceInr * 100) : 0,
                order_currency: data.is_overseas ? 'USD' : 'INR'

            };

            const student = await strapi.documents("api::student.student").create({
                data: studentData
            });

            if (!student) {
                ctx.throw(500, 'Failed to create student draft');
            }

            // If no addon selected (free registration), publish immediately
            if (!selectedAddon) {
                await strapi.service('api::student.student').update(student.id, {
                    data: {
                        publishedAt: new Date().toISOString(),
                        payment_status: 'completed',
                        payment_id: 'free_registration'
                    }
                });
                return { success: true, student, message: 'Free registration completed successfully' };
            }

            // Create Razorpay order
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            const orderAmount = data.is_overseas ? selectedAddon.price * 100 : selectedAddon.priceInr * 100;
            const orderCurrency = data.is_overseas ? 'USD' : 'INR';

            const order = await razorpay.orders.create({
                amount: orderAmount,
                currency: orderCurrency,
                receipt: `student_${student.id}_${Date.now()}`,
                notes: {
                    student_id: student.id.toString(),
                    addon_id: selectedAddon.id,
                    addon_name: selectedAddon.title
                }
            });


            await strapi.documents('api::student.student').update({
                documentId: student.documentId,
                data: {
                    razorpay_order_id: order.id,
                    order_amount: orderAmount,
                    order_currency: orderCurrency
                }
            })

            return {
                success: true,
                student,
                order: {
                    id: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    receipt: order.receipt
                }
            };

        } catch (err) {
            ctx.throw(err.status || 500, err.message || 'An error occurred while processing the registration');
        }
    },

    async verifyPaymentAndPublish(ctx) {
        try {
            const {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature,
                student_id,
                selectedAddon
            } = ctx.request.body;

            if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !student_id) {
                ctx.throw(400, 'Missing required payment verification parameters');
            }

            // Verify the payment signature
            const text = `${razorpay_order_id}|${razorpay_payment_id}`;
            const signature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(text)
                .digest('hex');

            if (signature !== razorpay_signature) {
                ctx.throw(400, 'Invalid payment signature');
            }

            // Get the student record
            const student = await strapi.service('api::student.student').findOne(student_id);
            if (!student) {
                ctx.throw(404, 'Student not found');
            }

            // Verify order amount matches
            if (student.order_amount !== (selectedAddon ? (student.is_overseas ? selectedAddon.price * 100 : selectedAddon.priceInr * 100) : 0)) {
                ctx.throw(400, 'Order amount mismatch');
            }

            // Update student with payment details and publish
            const updatedStudent = await strapi.service('api::student.student').update(student_id, {
                data: {
                    payment_id: razorpay_payment_id,
                    payment_status: 'completed',
                    payment_verified_at: new Date().toISOString(),
                    publishedAt: new Date().toISOString(), // Publish the student
                    selected_addon: selectedAddon
                }
            });

            return {
                success: true,
                student: updatedStudent,
                message: 'Payment verified and student published successfully'
            };

        } catch (err) {
            ctx.throw(err.status || 500, err.message || 'An error occurred while verifying payment');
        }
    },

    async webhookHandler(ctx) {
        try {
            const { body } = ctx.request;

            // Verify webhook signature
            const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
            const signature = ctx.request.headers['x-razorpay-signature'];

            if (!signature) {
                ctx.throw(400, 'Missing webhook signature');
            }

            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(body))
                .digest('hex');

            if (signature !== expectedSignature) {
                ctx.throw(400, 'Invalid webhook signature');
            }

            const event = body.event;
            const payload = body.payload;

            if (event === 'payment.captured') {
                const payment = payload.payment.entity;
                const order = payload.order.entity;

                // Find student by order ID
                const student = await strapi.service('api::student.student').findOne({
                    filters: { razorpay_order_id: order.id }
                });

                if (student) {
                    // Update student with payment details and publish
                    await strapi.service('api::student.student').update(student.id, {
                        data: {
                            payment_id: payment.id,
                            payment_status: 'completed',
                            payment_verified_at: new Date().toISOString(),
                            publishedAt: new Date().toISOString(), // Publish the student
                            payment_method: payment.method,
                            payment_captured_at: new Date(payment.captured_at * 1000).toISOString()
                        }
                    });

                    // Log successful webhook processing
                    console.log(`Webhook: Payment captured for student ${student.id}, order ${order.id}`);
                }
            }

            return { success: true, message: 'Webhook processed successfully' };

        } catch (err) {
            console.error('Webhook error:', err);
            ctx.throw(err.status || 500, err.message || 'Webhook processing failed');
        }
    }
}))
