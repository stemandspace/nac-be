/**
 * v1 controller
 */
import Razorpay from 'razorpay';
import { factories } from '@strapi/strapi'

/**
 * Get WhatsApp template ID based on addon type
 * @param {string} addon_id - The addon ID
 * @returns {string} - WhatsApp template ID
 */
function getWhatsAppTemplate(addon_id: string): string {
    const templateMap: { [key: string]: string } = {
        'credits': 'nac_spacetopia_cre',
        'basic': 'nac_spacetopia_protostar',
        'premium': 'nac_spacetopia_supernova'
    };

    return templateMap[addon_id] || 'nac_spacetopia_no_cre';
}


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

            const isStaffRegistration = data.email.includes('@spacetopia.in');

            // Calculate total amount including registration fee
            const addonAmount = selectedAddon ? (data.is_overseas ? selectedAddon.originalPrice : selectedAddon.originalPriceInr) : 0;
            const totalAmount = registrationFee + addonAmount;
            const totalAmountWithGst = data.is_overseas ? totalAmount : totalAmount + (totalAmount * 0.18);
            const totalAmountWithGstInCents = Math.round(totalAmountWithGst * 100);

            // Find existing student registration by email (if any)
            // Find existing student registration by email (if any)
            const existingStudents = await strapi.documents('api::student.student').findMany({
                filters: {
                    email: data.email
                }
            });
            // Find the most recent registration (if multiple, pick the latest by createdAt)
            let registration = null;
            if (existingStudents && existingStudents.length > 0) {
                registration = existingStudents.reduce((latest, curr) => {
                    if (!latest) return curr;
                    return new Date(curr.createdAt) > new Date(latest.createdAt) ? curr : latest;
                }, null);
            }

            console.log("registration found", registration);

            // If the registration is already completed, return false
            if (registration && registration.payment_status === 'completed') {
                return {
                    success: false,
                    message: 'Registration already exists'
                }
            } else if (registration && registration.payment_status === 'pending') {
                // Delete all pending registrations for this email to avoid duplicates
                for (const reg of existingStudents) {
                    if (reg.payment_status === 'pending') {
                        await strapi.documents('api::student.student').delete({
                            documentId: reg.documentId
                        });
                    }
                }
            }

            // Create student as draft (not published yet)
            const studentData = {
                ...data,
                publishedAt: null, // This keeps it as draft
                payment_status: 'pending',
                selected_addon: selectedAddon,
                order_currency: data.is_overseas ? 'USD' : 'INR',
                order_amount: totalAmountWithGstInCents, // Convert to smallest currency unit (cents/paise)
                // mail_sent: mail_sent
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

            const orderAmount = totalAmountWithGstInCents; // Convert to smallest currency unit (cents/paise)
            const orderCurrency = data.is_overseas ? 'USD' : 'INR';

            const order = await razorpay.orders.create({
                amount: isStaffRegistration ? 100 : orderAmount,
                currency: orderCurrency,
                receipt: `student_${student?.documentId}`,
                notes: {
                    student_id: student?.id,
                    student_document_id: student?.documentId,
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

    async webhookHandler(ctx) {
        try {
            const { body } = ctx.request;
            console.log("body", JSON.stringify(body, null, 2));
            const payment = body.payload.payment.entity;

            if (body.event === 'payment.captured' && payment.description.includes('NAC25')) {
                // Find student by order ID
                const student = await strapi.documents('api::student.student').findOne({
                    documentId: payment.notes.student_document_id
                });
                // @ts-ignore
                const addon_title = student?.selected_addon?.title || "N/A";

                // @ts-ignore   
                const addon_id = student?.selected_addon?.id || null;

                let user_id = null

                console.log("student", student);

                if (student) {
                    const isEmailRegisteredInCosmicKids = await strapi.service('api::v1.v1').isEmailRegisteredInCosmicKids(student.email);
                    // If you have forgotten your password, you can change it in the application.
                    let password = "Use your old password. If you have forgotten your password, you can change it in the application.";

                    if (isEmailRegisteredInCosmicKids.registered) {
                        user_id = isEmailRegisteredInCosmicKids.userId;
                        // User is already registered, no need to create new account
                    } else {
                        password = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                        // User is not registered, create new account
                        const cosmicKidsAccount = await strapi.service('api::v1.v1').createCosmicKidsAccount({
                            username: student.email,
                            email: student.email,
                            password: password
                        });

                        const isEmailRegisteredInCosmicKids = await strapi.service('api::v1.v1').isEmailRegisteredInCosmicKids(student.email);
                        user_id = isEmailRegisteredInCosmicKids.userId;

                        console.log("cosmicKidsAccount", cosmicKidsAccount);
                    }

                    // Send unified notifications (email + WhatsApp) - completely non-blocking
                    // Run notification service in background without blocking the main flow
                    setImmediate(async () => {
                        try {
                            // Determine WhatsApp template based on addon type
                            const whatsappTemplateId = getWhatsAppTemplate(addon_id);
                            console.log(`Selected WhatsApp template: ${whatsappTemplateId} for addon: ${addon_id}`);

                            // WhatsApp parameters - template changes based on addon type
                            const whatsappParams = {
                                templateId: whatsappTemplateId,
                                parameters: [
                                    { type: "text", text: student.name || 'Student' },
                                ]
                            };

                            const result = await strapi.service('api::v1.v1').sendRegistrationNotifications(
                                student,
                                addon_title,
                                password,
                                whatsappParams
                            );
                            console.log('Background notification service completed:', result);

                            // Update the student document with the actual notification results
                            await strapi.documents('api::student.student').update({
                                documentId: student.documentId,
                                data: {
                                    mail_sent: result.mail_sent,
                                    wa_sent: result.wa_sent
                                }
                            });

                            // Ensure the document remains published after the update
                            await strapi.documents('api::student.student').publish({
                                documentId: student.documentId
                            });
                        } catch (error) {
                            console.error('Background notification service failed:', error);
                            // Update with error status - both notifications failed
                            await strapi.documents('api::student.student').update({
                                documentId: student.documentId,
                                data: {
                                    mail_sent: false,
                                    wa_sent: false
                                }
                            });

                            // Ensure the document remains published after the update
                            await strapi.documents('api::student.student').publish({
                                documentId: student.documentId
                            });
                        }
                    });

                    // Update student with payment details (notifications handled in background)
                    await strapi.documents('api::student.student').update({
                        documentId: student.documentId,
                        data: {
                            payment_id: payment.id,
                            payment_status: 'completed',
                            payment_method: payment.method,
                            publishedAt: new Date(), // Publish the student
                            payment_verified_at: new Date(),
                            payment_captured_at: new Date(),
                            // Notification fields will be updated by background process
                            mail_sent: false,
                            wa_sent: false
                        }
                    })

                    await strapi.documents('api::student.student').publish({
                        documentId: student.documentId
                    })

                    if (user_id && addon_id) {
                        const addonsPayload = {
                            userId: user_id,
                            addons: {
                                type: addon_id,
                                amount: payment.amount / 100,
                                credits: addon_id === "credits" ? 35 : addon_id === "basic" ? 240 : 315
                            }
                        }
                        console.log("addonsPayload", addonsPayload);
                        await strapi.service('api::v1.v1').addUserAddons(addonsPayload)
                    }

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
            ctx.throw(err.status || 200, err.message || 'Webhook processing failed');
        }
    }
}))
