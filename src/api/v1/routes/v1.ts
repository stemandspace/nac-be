
module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/v1/save-draft-and-create-order',
            handler: 'v1.saveDraftAndCreateOrder',
        },
        {
            method: 'POST',
            path: '/v1/webhook',
            handler: 'v1.webhookHandler',
        },
        {
            method: 'POST',
            path: '/v1/bulk-upload',
            handler: 'bulk-upload.bulkUpload',
        }
    ]
}