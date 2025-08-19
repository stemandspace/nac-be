/**
 * v1 controller
 */

import { factories } from '@strapi/strapi'
import Razorpay from 'razorpay';
import crypto from 'crypto';

export default factories.createCoreController('api::v1.v1', ({ strapi }) => ({
    async saveDraftAndCreateOrder(ctx) {
        try {
            const { data, selectedAddon, registrationFee } = ctx.request.body;
            // Basic validat ion: check if data exists and required fields are present
            if (!data) {
                ctx.throw(400, 'Missing data in request body');
            }
            const requiredFields = ['name', 'email', 'phone', 'dob', 'school_name', 'grade', 'section', 'city'];
            const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field) || data[field] === undefined || data[field] === null || data[field] === '');
            if (missingFields.length > 0) {
                ctx.throw(400, `Missing required fields: ${missingFields.join(', ')}`);
            }

            // Calculate total amount including registration fee
            const addonAmount = selectedAddon ? (data.is_overseas ? selectedAddon.price : selectedAddon.priceInr) : 0;
            const totalAmount = registrationFee + addonAmount;

            // Create student as draft (not published yet)
            const studentData = {
                ...data,
                publishedAt: null, // This keeps it as draft
                payment_status: 'pending',
                selected_addon: selectedAddon,
                order_currency: data.is_overseas ? 'USD' : 'INR',
                order_amount: totalAmount * 100, // Convert to smallest currency unit (cents/paise)
            };

            const student = await strapi.documents("api::student.student").create({
                data: studentData
            });

            console.log("student created");

            if (!student) {
                ctx.throw(500, 'Failed to create student draft');
            }

            // Create Razorpay order
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            const orderAmount = totalAmount * 100; // Convert to smallest currency unit (cents/paise)
            const orderCurrency = data.is_overseas ? 'USD' : 'INR';

            const order = await razorpay.orders.create({
                amount: 100,
                currency: orderCurrency,
                receipt: `student_${student?.documentId}`,
                notes: {
                    student_document_id: student?.documentId,
                    addon_id: selectedAddon?.id,
                    addon_name: selectedAddon?.title
                }
            });

            console.log("order created");

            await strapi.documents('api::student.student').update({
                documentId: student.documentId,
                data: {
                    razorpay_order_id: order.id,
                    order_amount: orderAmount,
                    order_currency: orderCurrency
                }
            })

            console.log("order updated");

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
            console.log(err);
            ctx.throw(err.status || 500, err.message || 'An error occurred while processing the registration');
        }
    },

    async verifyPaymentAndPublish(ctx) {
        try {
            const {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature,
                student_document_id,
                selectedAddon
            } = ctx.request.body;

            if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !student_document_id) {
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

            // Get the student record using document API
            const student = await strapi.documents('api::student.student').findOne({
                documentId: student_document_id
            });
            if (!student) {
                ctx.throw(404, 'Student not found');
            }

            // Verify order amount matches (including registration fee)
            const expectedRegistrationFee = student.is_overseas ? 12 : 500; // $12 for overseas, ₹500 for INR
            const expectedAddonAmount = selectedAddon ? (student.is_overseas ? selectedAddon.price : selectedAddon.priceInr) : 0;
            const expectedTotalAmount = (expectedRegistrationFee + expectedAddonAmount) * 100;

            // @ts-ignore
            if (student.order_amount !== expectedTotalAmount) {
                ctx.throw(400, 'Order amount mismatch');
            }
            // Update student with payment details and publish using document API
            const updatedStudent = await strapi.documents('api::student.student').update({
                documentId: student_document_id,
                data: {
                    payment_status: 'completed',
                    selected_addon: selectedAddon,
                    payment_id: razorpay_payment_id,
                    publishedAt: new Date().toISOString(), // Publish the student
                    payment_verified_at: new Date().toISOString(),
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
            console.log("body", body);
            const payment = body.payload.payment.entity;

            if (body.event === 'payment.captured' && !payment.description || !payment.description.includes('NAC25')) {
                // Find student by order ID
                const student = await strapi.documents('api::student.student').findOne({
                    documentId: payment.notes.student_document_id
                });

                if (student) {
                    // Update student with payment details and publish
                    await strapi.documents('api::student.student').update({
                        documentId: student.documentId,
                        data: {
                            payment_id: payment.id,
                            payment_status: 'completed',
                            payment_method: payment.method,
                            publishedAt: new Date(), // Publish the student
                            payment_verified_at: new Date(),
                            payment_captured_at: new Date()
                        }
                    })
                    await strapi.documents('api::student.student').publish({
                        documentId: student.documentId
                    })
                    // Log successful webhook processing
                    console.log(`Webhook: Payment captured for student ${student.id}`);
                }
                return { success: true, message: 'Webhook processed successfully' };
            } else {
                console.log("Invalid payment description");
                return { success: true, message: 'Invalid payment description' };
            }
        } catch (err) {
            console.error('Webhook error:', err);
            ctx.throw(err.status || 500, err.message || 'Webhook processing failed');
        }
    }
}))
