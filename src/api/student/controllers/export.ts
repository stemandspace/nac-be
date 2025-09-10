import { json2csv } from 'json-2-csv';
import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::student.student', ({ strapi }) => ({
    students: async (ctx) => {
        const query = await ctx.query;
        const filters: Record<string, any> = {};

        if (query?.payment_status) {
            filters.payment_status = query.payment_status;
        }
        if (query?.school) {
            filters.school = { documentId: query.school };
        }

        const students = await strapi.documents('api::student.student').findMany({
            filters,
            pageSize: 10000,
            sort: 'createdAt:desc'
        });

        const csv = await json2csv(students);

        const filename = `students_${Date.now()}.csv`;

        ctx.set('Content-Type', 'text/csv');
        ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
        ctx.body = csv;
    },
    schools: async (ctx) => {
        const schools = await strapi.documents('api::school.school').findMany({
            pageSize: 10000,
            sort: 'createdAt:desc'
        });

        // Add link field to each school
        const schoolsWithLink = schools.map(school => ({
            ...school,
            link: `https://www.nationalastronomy.org/student-registration/form?schoolId=${school?.documentId}`
        }));

        const csv = await json2csv(schoolsWithLink);

        const filename = `schools_${Date.now()}.csv`;

        ctx.set('Content-Type', 'text/csv');

        ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
        ctx.body = csv;
    }
}));    