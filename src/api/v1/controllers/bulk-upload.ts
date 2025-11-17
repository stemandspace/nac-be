/**
 * Bulk Upload Controller
 * Handles CSV file uploads for bulk student registration processing
 */
import { parse } from 'csv-parse/sync';
import { factories } from '@strapi/strapi';

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

interface CSVRow {
    name: string;
    email: string;
    phone: string;
    school: string;
    grade: string;
    section: string;
    payment_id: string;
    is_overseas: string;
    addon_id?: string;
    addon_title?: string;
    dob?: string;
    city?: string;
}

export default factories.createCoreController('api::v1.v1', ({ strapi }) => ({
    async bulkUpload(ctx) {
        try {
            // Check if file is uploaded - handle different file upload structures
            let file;
            if (ctx.request.files && ctx.request.files.file) {
                file = ctx.request.files.file;
            } else if (ctx.request.files && Array.isArray(ctx.request.files.files) && ctx.request.files.files.length > 0) {
                file = ctx.request.files.files[0];
            } else if (ctx.request.files && typeof ctx.request.files.files === 'object' && !Array.isArray(ctx.request.files.files)) {
                file = ctx.request.files.files;
            } else {
                ctx.throw(400, 'No file uploaded. Please upload a CSV file using multipart/form-data with field name "file".');
            }

            // Validate file type
            const fileName = file.name || file.filename || 'unknown';
            if (!fileName.endsWith('.csv')) {
                ctx.throw(400, 'Invalid file type. Please upload a CSV file.');
            }

            // Read and parse CSV file
            const fileData = file.data || file.buffer || file;
            const csvContent = Buffer.isBuffer(fileData) ? fileData.toString('utf-8') : fileData.toString('utf-8');
            const records: CSVRow[] = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                cast: true
            });

            if (!records || records.length === 0) {
                ctx.throw(400, 'CSV file is empty or invalid.');
            }

            // Validate required columns
            const requiredColumns = ['name', 'email', 'phone', 'school', 'grade', 'section', 'payment_id', 'is_overseas'];
            const firstRow = records[0];
            const missingColumns = requiredColumns.filter(col => !(col in firstRow));

            if (missingColumns.length > 0) {
                ctx.throw(400, `Missing required columns in CSV: ${missingColumns.join(', ')}`);
            }

            const results = {
                total: records.length,
                successful: 0,
                failed: 0,
                errors: [] as Array<{ row: number; email: string; error: string }>
            };

            // Process each row
            for (let i = 0; i < records.length; i++) {
                const row = records[i];
                const rowNumber = i + 2; // +2 because CSV has header row and arrays are 0-indexed

                try {
                    // Validate row data
                    if (!row.name || !row.email || !row.phone || !row.school || !row.grade || !row.section || !row.payment_id) {
                        throw new Error('Missing required fields in row');
                    }

                    // Convert is_overseas to boolean
                    const isOverseas = row.is_overseas?.toLowerCase() === 'true' || row.is_overseas === '1' || row.is_overseas === 'yes';

                    // Prepare student data
                    const studentData: any = {
                        name: row.name.trim(),
                        email: row.email.trim().toLowerCase(),
                        phone: row.phone.trim(),
                        school_name: row.school.trim(),
                        grade: row.grade.trim(),
                        section: row.section.trim(),
                        is_overseas: isOverseas,
                        payment_id: row.payment_id.trim(),
                        payment_status: 'completed' as const,
                        publishedAt: new Date(),
                        payment_verified_at: new Date(),
                        payment_captured_at: new Date(),
                        payment_method: 'bulk_upload',
                        mail_sent: false,
                        wa_sent: false
                    };

                    // Add optional fields if present
                    if (row.dob) {
                        studentData.dob = row.dob.trim();
                    }
                    if (row.city) {
                        studentData.city = row.city.trim();
                    }
                    if (row.addon_id) {
                        // Store addon info if provided in CSV
                        studentData.selected_addon = {
                            id: row.addon_id.trim(),
                            title: row.addon_title?.trim() || row.addon_id.trim()
                        };
                    }

                    // Check if student already exists
                    const existingStudents = await strapi.documents('api::student.student').findMany({
                        filters: {
                            email: studentData.email
                        }
                    });

                    let student;
                    if (existingStudents && existingStudents.length > 0) {
                        // Update existing student
                        const existingStudent = existingStudents[0];
                        student = await strapi.documents('api::student.student').update({
                            documentId: existingStudent.documentId,
                            data: studentData
                        });
                    } else {
                        // Create new student
                        student = await strapi.documents('api::student.student').create({
                            data: studentData
                        });
                    }

                    // Publish the student
                    await strapi.documents('api::student.student').publish({
                        documentId: student.documentId
                    });

                    // Get addon information from student or row
                    const addon_id = row.addon_id || (student.selected_addon as any)?.id || null;
                    const addon_title = row.addon_title || (student.selected_addon as any)?.title || "N/A";

                    // Process Cosmic Kids account creation and addons (similar to webhook)
                    let user_id = null;
                    const isEmailRegisteredInCosmicKids = await strapi.service('api::v1.v1').isEmailRegisteredInCosmicKids(student.email);

                    let password = "Use your old password. If you have forgotten your password, you can change it in the application.";

                    if (isEmailRegisteredInCosmicKids.registered) {
                        user_id = isEmailRegisteredInCosmicKids.userId;
                    } else {
                        password = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                        const cosmicKidsAccount = await strapi.service('api::v1.v1').createCosmicKidsAccount({
                            username: student.email,
                            email: student.email,
                            password: password
                        });

                        const recheckRegistration = await strapi.service('api::v1.v1').isEmailRegisteredInCosmicKids(student.email);
                        user_id = recheckRegistration.userId;

                        console.log("cosmicKidsAccount created for bulk upload:", cosmicKidsAccount);
                    }

                    // Add addons if user_id and addon_id are available
                    if (user_id && addon_id) {
                        // Get payment amount from student record or use default
                        const paymentAmount = student.order_amount ? Number(student.order_amount) / 100 : 0;

                        const addonsPayload = {
                            userId: user_id,
                            addons: {
                                type: addon_id,
                                amount: paymentAmount,
                                credits: addon_id === "credits" ? 35 : addon_id === "basic" ? 240 : 315
                            }
                        };

                        console.log("addonsPayload for bulk upload:", addonsPayload);
                        await strapi.service('api::v1.v1').addUserAddons(addonsPayload);
                    }

                    // Send notifications in background (non-blocking)
                    setImmediate(async () => {
                        try {
                            const whatsappTemplateId = getWhatsAppTemplate(addon_id);
                            console.log(`Selected WhatsApp template: ${whatsappTemplateId} for addon: ${addon_id}`);

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

                            console.log('Background notification service completed for bulk upload:', result);

                            // Update the student document with notification results
                            await strapi.documents('api::student.student').update({
                                documentId: student.documentId,
                                data: {
                                    mail_sent: result.mail_sent,
                                    wa_sent: result.wa_sent
                                }
                            });

                            await strapi.documents('api::student.student').publish({
                                documentId: student.documentId
                            });
                        } catch (error) {
                            console.error('Background notification service failed for bulk upload:', error);
                            await strapi.documents('api::student.student').update({
                                documentId: student.documentId,
                                data: {
                                    mail_sent: false,
                                    wa_sent: false
                                }
                            });

                            await strapi.documents('api::student.student').publish({
                                documentId: student.documentId
                            });
                        }
                    });

                    results.successful++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        row: rowNumber,
                        email: row.email || 'N/A',
                        error: error.message || 'Unknown error occurred'
                    });
                    console.error(`Error processing row ${rowNumber}:`, error);
                }
            }

            return {
                success: true,
                message: `Bulk upload completed. ${results.successful} successful, ${results.failed} failed.`,
                results
            };

        } catch (err) {
            console.error('Bulk upload error:', err);
            ctx.throw(err.status || 500, err.message || 'An error occurred while processing the bulk upload');
        }
    }
}));

