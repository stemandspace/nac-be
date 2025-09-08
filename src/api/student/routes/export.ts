module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/export/students',
            handler: 'export.students',
        },
        {
            method: 'GET',
            path: '/export/schools',
            handler: 'export.schools',
        }
    ]
}